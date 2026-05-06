"""APNs VoIP push — wakes the OpenQnt iOS app for an incoming AI call.

Apple's PushKit terminates an app process if it doesn't immediately report
a CallKit incoming call after every VoIP push. So this module sends the
*minimum* payload the app needs to reach `CXProvider.reportNewIncomingCall`
fast: call_id, opening_message, and the WS URL to dial.

Auth: APNs token-based (HTTP/2, ES256-signed JWT). The cert path is
required when the app config sets one; otherwise we fall back to
`token-based` auth via APNS_AUTH_KEY_PATH + APNS_KEY_ID + APNS_TEAM_ID.

Lazy-import `aioapns` so the rest of the voice subsystem still works on
machines without the package.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

APNS_TOPIC_ENV = "APNS_VOIP_TOPIC"          # e.g. com.openqnt.app.voip
APNS_KEY_PATH_ENV = "APNS_AUTH_KEY_PATH"     # path to .p8 file
APNS_KEY_ID_ENV = "APNS_KEY_ID"              # 10-char Apple key ID
APNS_TEAM_ID_ENV = "APNS_TEAM_ID"            # 10-char Apple team ID
APNS_USE_SANDBOX_ENV = "APNS_USE_SANDBOX"    # "1" → development gateway


_client = None  # cached aioapns.APNs


async def _get_client():
    global _client
    if _client is not None:
        return _client
    try:
        from aioapns import APNs
    except Exception as e:  # pragma: no cover
        raise RuntimeError(
            "aioapns is not installed — pip install aioapns to enable iOS VoIP push"
        ) from e

    key_path = os.getenv(APNS_KEY_PATH_ENV)
    key_id = os.getenv(APNS_KEY_ID_ENV)
    team_id = os.getenv(APNS_TEAM_ID_ENV)
    if not (key_path and key_id and team_id):
        raise RuntimeError(
            f"APNs config missing — set {APNS_KEY_PATH_ENV}, {APNS_KEY_ID_ENV}, {APNS_TEAM_ID_ENV}"
        )

    use_sandbox = os.getenv(APNS_USE_SANDBOX_ENV, "0") == "1"
    _client = APNs(
        key=key_path,
        key_id=key_id,
        team_id=team_id,
        topic=os.getenv(APNS_TOPIC_ENV) or "com.openqnt.app.voip",
        use_sandbox=use_sandbox,
    )
    logger.info("APNs client ready (sandbox=%s)", use_sandbox)
    return _client


async def send_voip_push(
    *,
    voip_push_token: str,
    call_id: str,
    opening_message: str,
    ws_url: str,
    extra: Optional[Dict[str, Any]] = None,
) -> bool:
    """Fire one VoIP push. Returns True on success."""
    try:
        from aioapns import NotificationRequest, PushType
    except Exception:  # pragma: no cover
        logger.warning("aioapns unavailable; skipping VoIP push")
        return False

    client = await _get_client()
    payload: Dict[str, Any] = {
        "call_id": call_id,
        "opening_message": opening_message,
        "ws_url": ws_url,
    }
    if extra:
        payload.update(extra)
    request = NotificationRequest(
        device_token=voip_push_token,
        message=payload,
        push_type=PushType.VOIP,
        priority=10,
    )
    response = await client.send_notification(request)
    if response.is_successful:
        return True
    logger.warning(
        "VoIP push failed: status=%s description=%s",
        response.status, getattr(response, "description", ""),
    )
    return False


async def ring_user_devices(
    *,
    user_id: str,
    call_id: str,
    opening_message: str,
    ws_url: str,
) -> List[Dict[str, Any]]:
    """Push to every registered iOS device for the user. Returns per-device results."""
    from .. import voice_db  # type: ignore

    devices = voice_db.list_ios_devices(user_id)
    results: List[Dict[str, Any]] = []
    for d in devices:
        ok = await send_voip_push(
            voip_push_token=d["voip_push_token"],
            call_id=call_id,
            opening_message=opening_message,
            ws_url=ws_url,
        )
        results.append({"voip_push_token": d["voip_push_token"], "ok": ok})
        if not ok:
            # If APNs returned BadDeviceToken or Unregistered, deregister.
            # (aioapns surfaces those via response.description; conservatively
            # leave the entry — refine in v1.1 with response inspection.)
            pass
    return results
