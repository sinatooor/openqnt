"""Voice call persistence — extends the existing local SQLite (`strategies.db`).

Three tables added on first import:
  - `voice_calls`   — one row per call (started, ended, duration, transport, transcript path)
  - `ios_devices`   — VoIP push tokens registered by the OpenQnt iOS app
  - users.phone_number / users.voice_trading_enabled (added via ALTER if missing)
"""

from __future__ import annotations

import logging
import sqlite3
from typing import Any, Dict, List, Optional

import local_database  # noqa: F401  (uses the same DB_NAME)

logger = logging.getLogger(__name__)


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(local_database.DB_NAME)
    c.row_factory = sqlite3.Row
    return c


def _has_column(conn: sqlite3.Connection, table: str, col: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r["name"] == col for r in rows)


def init_voice_schema() -> None:
    conn = _conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS voice_calls (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                duration_s REAL,
                transport TEXT NOT NULL,
                trigger_source TEXT NOT NULL,
                twilio_call_sid TEXT,
                transcript_path TEXT,
                cost_cents INTEGER DEFAULT 0,
                error TEXT
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS ios_devices (
                voip_push_token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                apns_environment TEXT DEFAULT 'production',
                last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS ios_pairing_tokens (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                consumed_at TIMESTAMP
            )
            """
        )
        # Backfill missing user columns
        if not _has_column(conn, "users", "phone_number"):
            cur.execute("ALTER TABLE users ADD COLUMN phone_number TEXT")
        if not _has_column(conn, "users", "voice_trading_enabled"):
            cur.execute("ALTER TABLE users ADD COLUMN voice_trading_enabled INTEGER DEFAULT 0")
        conn.commit()
    finally:
        conn.close()


# ─── voice_calls ───────────────────────────────────────────────────────

def create_voice_call(
    *,
    call_id: str,
    user_id: str,
    transport: str,
    trigger_source: str,
    twilio_call_sid: Optional[str] = None,
    transcript_path: Optional[str] = None,
) -> None:
    conn = _conn()
    try:
        conn.execute(
            """INSERT INTO voice_calls
               (id, user_id, transport, trigger_source, twilio_call_sid, transcript_path)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (call_id, user_id, transport, trigger_source, twilio_call_sid, transcript_path),
        )
        conn.commit()
    finally:
        conn.close()


def finalize_voice_call(
    *,
    call_id: str,
    ended_at: float,
    duration_s: Optional[float],
    error: Optional[str],
) -> None:
    conn = _conn()
    try:
        conn.execute(
            """UPDATE voice_calls
               SET ended_at = CURRENT_TIMESTAMP,
                   duration_s = COALESCE(?, duration_s),
                   error = COALESCE(?, error)
               WHERE id = ?""",
            (duration_s, error, call_id),
        )
        conn.commit()
    finally:
        conn.close()


def list_voice_calls(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    conn = _conn()
    try:
        rows = conn.execute(
            "SELECT * FROM voice_calls WHERE user_id = ? ORDER BY started_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ─── User profile fields ───────────────────────────────────────────────

def update_user_phone(user_id: str, phone_e164: Optional[str]) -> None:
    conn = _conn()
    try:
        conn.execute("UPDATE users SET phone_number = ? WHERE id = ?", (phone_e164, user_id))
        conn.commit()
    finally:
        conn.close()


def set_voice_trading_enabled(user_id: str, enabled: bool) -> None:
    conn = _conn()
    try:
        conn.execute(
            "UPDATE users SET voice_trading_enabled = ? WHERE id = ?",
            (1 if enabled else 0, user_id),
        )
        conn.commit()
    finally:
        conn.close()


def get_user_voice_profile(user_id: str) -> Optional[Dict[str, Any]]:
    conn = _conn()
    try:
        row = conn.execute(
            "SELECT id, name, email, phone_number, voice_trading_enabled FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


# ─── iOS device registry ───────────────────────────────────────────────

def upsert_ios_device(*, voip_push_token: str, user_id: str, apns_environment: str = "production") -> None:
    conn = _conn()
    try:
        conn.execute(
            """INSERT INTO ios_devices (voip_push_token, user_id, apns_environment, last_seen_at)
               VALUES (?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(voip_push_token) DO UPDATE SET
                 user_id = excluded.user_id,
                 apns_environment = excluded.apns_environment,
                 last_seen_at = CURRENT_TIMESTAMP""",
            (voip_push_token, user_id, apns_environment),
        )
        conn.commit()
    finally:
        conn.close()


def list_ios_devices(user_id: str) -> List[Dict[str, Any]]:
    conn = _conn()
    try:
        rows = conn.execute(
            "SELECT * FROM ios_devices WHERE user_id = ? ORDER BY last_seen_at DESC",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def delete_ios_device(voip_push_token: str) -> None:
    conn = _conn()
    try:
        conn.execute("DELETE FROM ios_devices WHERE voip_push_token = ?", (voip_push_token,))
        conn.commit()
    finally:
        conn.close()


# ─── iOS pairing tokens ────────────────────────────────────────────────

def create_pairing_token(token: str, user_id: str, expires_at_iso: str) -> None:
    conn = _conn()
    try:
        conn.execute(
            "INSERT INTO ios_pairing_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires_at_iso),
        )
        conn.commit()
    finally:
        conn.close()


def consume_pairing_token(token: str) -> Optional[Dict[str, Any]]:
    """Return the pairing record if not expired/consumed, then mark consumed."""
    conn = _conn()
    try:
        row = conn.execute(
            """SELECT token, user_id, expires_at, consumed_at FROM ios_pairing_tokens
               WHERE token = ?""",
            (token,),
        ).fetchone()
        if not row:
            return None
        rec = dict(row)
        if rec["consumed_at"] is not None:
            return None
        # Caller validates expiry
        conn.execute(
            "UPDATE ios_pairing_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE token = ?",
            (token,),
        )
        conn.commit()
        return rec
    finally:
        conn.close()
