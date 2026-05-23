"""
notification_tools — Python ↔ orchestrator bridge for sending Telegram /
Slack / SMS / email from inside an agent or voice tool.

Used by:
  - trading_agent / research-agent: e.g. "send the MC plot to Telegram"
  - the voice in-call AI: when the user says "Telegram me this summary"

Wire: POST {ORCHESTRATOR_URL}/api/notifications/dispatch with header
`X-Internal-Token: $INTERNAL_API_TOKEN`. The orchestrator pushes onto
its BullMQ `notifications` queue, which `notificationService.dispatch()`
consumes — same code path as in-graph `notification`/`telegramNode`
nodes, so the tool inherits attachments / photo support for free.
"""
from __future__ import annotations

import base64
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


def _orchestrator_url() -> str:
    return os.getenv("ORCHESTRATOR_URL", "http://localhost:3000").rstrip("/")


def _internal_token() -> Optional[str]:
    return os.getenv("INTERNAL_API_TOKEN")


def _build_attachment(
    *, kind: str, path: Optional[str], caption: Optional[str], filename: Optional[str],
    inline_buffer: bool,
) -> Optional[Dict[str, Any]]:
    if not path:
        return None
    p = Path(path)
    if not p.exists():
        logger.warning("attachment path missing: %s", path)
        return None
    out: Dict[str, Any] = {"kind": kind, "caption": caption, "filename": filename or p.name}
    if inline_buffer:
        # Read + base64 — for deployments where Python and Node don't share a FS.
        out["bufferBase64"] = base64.b64encode(p.read_bytes()).decode("ascii")
    else:
        # Absolute path — orchestrator reads it directly.
        out["path"] = str(p.resolve())
    return out


def send_notification(
    *,
    channel: str = "telegram",
    body: str,
    title: Optional[str] = None,
    user_id: Optional[str] = None,
    chat_id: Optional[str] = None,
    attachment_path: Optional[str] = None,
    attachment_kind: str = "photo",
    attachment_filename: Optional[str] = None,
    caption: Optional[str] = None,
    execution_run_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Push a notification through the orchestrator.

    Args:
        channel: 'telegram' | 'slack' | 'sms' | 'email' | 'in_app' | 'push'
        body: message text. For Telegram photo/document, this becomes the caption
            of the first attachment unless `caption` is set.
        title: optional title (used by some channels)
        user_id: target user. Falls back to env `DEFAULT_USER_ID` for the local
            single-user desktop case.
        chat_id: explicit override (Telegram chat_id, Slack channel, etc.)
        attachment_path: absolute path to a file (PNG, PDF, CSV…). Optional.
        attachment_kind: 'photo' (compressed) or 'document' (preserves file).
        attachment_filename: filename shown in Telegram for documents.
        caption: optional caption for the attachment (defaults to body).
        execution_run_id: link the notification to an in-progress run.

    Returns:
        {"ok": True} on success, {"ok": False, "error": ...} on failure.
    """
    target_user = user_id or os.getenv("DEFAULT_USER_ID") or "default"
    token = _internal_token()
    if not token:
        msg = "INTERNAL_API_TOKEN not configured; set it in backend/.env and orchestrator/.env"
        logger.error(msg)
        return {"ok": False, "error": msg}

    # Auto-resolve Telegram chat_id from the backend voice_db when the caller
    # didn't pass one explicitly. Lets the user configure their chat id once
    # via Settings → Voice & Notifications and have every send_notification
    # call from a voice session / strategy / agent route to the right chat.
    if channel == "telegram" and not chat_id:
        try:
            from services import voice_db as _vdb
            chat_id = _vdb.get_telegram_chat_id(target_user)
        except Exception:
            pass

    # Decide whether to inline the file as base64 (cross-container) or pass a path.
    inline = os.getenv("NOTIFICATION_INLINE_ATTACHMENTS", "false").lower() in {"1", "true", "yes"}
    attachments: List[Dict[str, Any]] = []
    if attachment_path:
        att = _build_attachment(
            kind=attachment_kind,
            path=attachment_path,
            caption=caption or body,
            filename=attachment_filename,
            inline_buffer=inline,
        )
        if att:
            attachments.append(att)

    payload: Dict[str, Any] = {
        "userId": target_user,
        "channel": channel,
        "title": title,
        "body": body,
        "executionRunId": execution_run_id,
    }
    if chat_id and channel == "telegram":
        payload["telegram"] = {"chatId": chat_id}
    if attachments:
        payload["attachments"] = attachments

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{_orchestrator_url()}/api/notifications/dispatch",
                json=payload,
                headers={"X-Internal-Token": token},
            )
        if resp.status_code >= 400:
            logger.warning("dispatch failed %s: %s", resp.status_code, resp.text[:200])
            return {"ok": False, "error": f"HTTP {resp.status_code}: {resp.text}"}
        return {"ok": True, "response": resp.json() if resp.content else {}}
    except Exception as e:  # noqa: BLE001
        logger.exception("send_notification failed")
        return {"ok": False, "error": str(e)}
