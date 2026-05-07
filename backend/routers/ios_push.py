"""
iOS push notifications for non-voice alerts (trade, risk, strategy events).

Distinct from `voice.py` which handles VoIP/PushKit pushes that ring CallKit.
This router takes APNs *standard* device tokens registered by the iOS app
in `NotificationsStore.registerDeviceToken()` and ships banner-style alerts.

Reuses the same APNs cert/key as voice — if voice push works, this works.
"""

from __future__ import annotations

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import local_database as database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# ============================================================
# Schema (lightweight — alerts feed is Python-side in-memory + DB)
# ============================================================

class RegisterDeviceRequest(BaseModel):
    user_id: str
    apns_token: str = Field(..., description="Hex-encoded APNs device token")
    environment: str = Field(default="production", pattern="^(production|sandbox)$")


class AlertEvent(BaseModel):
    id: str
    kind: str
    title: str
    body: str
    created_at: datetime
    read: bool = False
    deep_link: Optional[str] = None


class FeedResponse(BaseModel):
    alerts: List[AlertEvent]
    unread: int


# ============================================================
# Storage (sqlite, sharing the same DB as the rest of the backend)
# ============================================================

def _ensure_schema():
    conn = database.get_db()
    try:
        c = conn.cursor()
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS ios_devices_alerts (
                user_id TEXT NOT NULL,
                apns_token TEXT NOT NULL,
                environment TEXT NOT NULL,
                last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, apns_token)
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS notifications_feed (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                deep_link TEXT,
                read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        c.execute(
            "CREATE INDEX IF NOT EXISTS idx_notifications_user_created "
            "ON notifications_feed(user_id, created_at DESC)"
        )
        conn.commit()
    finally:
        conn.close()


# Run once on import — same pattern as the voice router.
try:
    _ensure_schema()
except Exception as e:
    logger.warning(f"ios_push schema init failed: {e}")


# ============================================================
# Endpoints
# ============================================================

@router.post("/devices/ios/register")
async def register_device(req: RegisterDeviceRequest) -> Dict[str, Any]:
    """Idempotent registration of an APNs token for alerts (not VoIP)."""
    conn = database.get_db()
    try:
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO ios_devices_alerts (user_id, apns_token, environment, last_seen_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, apns_token) DO UPDATE SET
                environment = excluded.environment,
                last_seen_at = CURRENT_TIMESTAMP
            """,
            (req.user_id, req.apns_token, req.environment),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.get("/feed", response_model=FeedResponse)
async def feed(user_id: Optional[str] = None, limit: int = 100) -> FeedResponse:
    """
    Return the most recent alerts for the current user. In single-user
    desktop mode, user_id is optional — falls back to "all".
    """
    conn = database.get_db()
    try:
        c = conn.cursor()
        if user_id:
            rows = c.execute(
                """
                SELECT id, kind, title, body, deep_link, read, created_at
                FROM notifications_feed
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
        else:
            rows = c.execute(
                """
                SELECT id, kind, title, body, deep_link, read, created_at
                FROM notifications_feed
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        alerts = [
            AlertEvent(
                id=r["id"],
                kind=r["kind"],
                title=r["title"],
                body=r["body"],
                deep_link=r["deep_link"],
                read=bool(r["read"]),
                created_at=_parse_ts(r["created_at"]),
            )
            for r in rows
        ]
        unread = sum(1 for a in alerts if not a.read)
        return FeedResponse(alerts=alerts, unread=unread)
    finally:
        conn.close()


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str) -> Dict[str, Any]:
    conn = database.get_db()
    try:
        c = conn.cursor()
        c.execute(
            "UPDATE notifications_feed SET read = 1 WHERE id = ?",
            (notification_id,),
        )
        conn.commit()
        if c.rowcount == 0:
            raise HTTPException(status_code=404, detail="not found")
        return {"ok": True}
    finally:
        conn.close()


# ============================================================
# Helpers used by other routers to push alerts
# ============================================================

async def push_alert(
    *,
    user_id: str,
    kind: str,
    title: str,
    body: str,
    deep_link: Optional[str] = None,
) -> str:
    """
    Insert an alert into the feed AND fire APNs to every registered device.
    Returns the alert id. Other routers (execution, risk_controls, boss)
    call this on relevant events.
    """
    import uuid
    alert_id = str(uuid.uuid4())

    conn = database.get_db()
    try:
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO notifications_feed (id, user_id, kind, title, body, deep_link, read)
            VALUES (?, ?, ?, ?, ?, ?, 0)
            """,
            (alert_id, user_id, kind, title, body, deep_link),
        )
        conn.commit()
        # Pick devices BEFORE closing the connection.
        rows = c.execute(
            "SELECT apns_token, environment FROM ios_devices_alerts WHERE user_id = ?",
            (user_id,),
        ).fetchall()
    finally:
        conn.close()

    # Best-effort APNs delivery — never fail the parent action if push fails.
    if rows:
        try:
            await _send_apns([(r["apns_token"], r["environment"]) for r in rows], title=title, body=body, kind=kind, deep_link=deep_link, alert_id=alert_id)
        except Exception as e:
            logger.warning(f"APNs send failed: {e}")

    return alert_id


async def _send_apns(
    devices: List[tuple[str, str]],
    *,
    title: str,
    body: str,
    kind: str,
    deep_link: Optional[str],
    alert_id: str,
) -> None:
    """Deliver via aioapns. Imported lazily so the backend boots without it."""
    try:
        from aioapns import APNs, NotificationRequest, PushType
    except ImportError:
        logger.info("aioapns not installed — skipping APNs send")
        return

    cert_path = os.environ.get("APNS_CERT_PATH") or os.environ.get("VOICE_APNS_CERT_PATH")
    if not cert_path:
        logger.info("APNS_CERT_PATH not set — skipping APNs send")
        return

    topic = os.environ.get("APNS_TOPIC", "dev.openqnt.OpenQnt")

    for token, env in devices:
        try:
            apns = APNs(
                client_cert=cert_path,
                topic=topic,
                use_sandbox=(env == "sandbox"),
            )
            payload = {
                "aps": {
                    "alert": {"title": title, "body": body},
                    "sound": "default",
                    "badge": 1,
                    "thread-id": kind,
                },
                "kind": kind,
                "alert_id": alert_id,
                "deep_link": deep_link or "",
            }
            await apns.send_notification(
                NotificationRequest(
                    device_token=token,
                    message=payload,
                    push_type=PushType.ALERT,
                )
            )
        except Exception as e:
            logger.warning(f"APNs delivery to {token[:8]}… failed: {e}")


def _parse_ts(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        # SQLite stores TIMESTAMP as ISO-8601-ish strings.
        try:
            return datetime.fromisoformat(value).replace(tzinfo=timezone.utc) if "T" in value else \
                datetime.strptime(value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except Exception:
            return datetime.now(tz=timezone.utc)
    return datetime.now(tz=timezone.utc)
