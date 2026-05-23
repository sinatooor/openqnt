"""
Credential + status storage for the IBKR integration.

IBKR doesn't have an API key the way Avanza does — the "credentials" are
just the network coordinates of the TWS / IB Gateway instance (host,
port, client id) plus an optional account label. We persist those in
SQLite so the user doesn't have to retype them on every backend restart,
and so the Portfolio / Settings UI can show what they last configured.

Single-user-friendly (matches AvanzaStorage). Encryption is shared via
the same ENCRYPTION_KEY env var because there's no real secret here
beyond the host/port pair, but we encrypt anyway for consistency.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from base64 import urlsafe_b64encode
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any, Dict, Optional

try:
    from cryptography.fernet import Fernet, InvalidToken
except ImportError:
    Fernet = None  # type: ignore
    InvalidToken = Exception  # type: ignore


_DEFAULT_DB = Path(__file__).resolve().parents[2] / "strategies.db"
_LOCK = threading.RLock()


def _fernet() -> "Fernet":
    if Fernet is None:
        raise RuntimeError(
            "cryptography is not installed; pip install cryptography to enable IBKR"
        )
    raw = os.getenv("ENCRYPTION_KEY") or os.getenv("AVANZA_ENCRYPTION_KEY")
    if not raw:
        raw = os.getenv("JWT_SECRET") or "openqwnt-dev-key-change-me"
    return Fernet(urlsafe_b64encode(sha256(raw.encode("utf-8")).digest()))


class IBKRStorage:
    """Persists IBKR connection profile + last-sync metadata."""

    def __init__(self, db_path: Optional[Path] = None) -> None:
        self.db_path = Path(db_path) if db_path else _DEFAULT_DB
        self._init_schema()

    def _conn(self) -> sqlite3.Connection:
        with _LOCK:
            c = sqlite3.connect(self.db_path)
            c.execute("PRAGMA journal_mode=WAL")
            return c

    def _init_schema(self) -> None:
        with self._conn() as c:
            c.executescript(
                """
                CREATE TABLE IF NOT EXISTS ibkr_credentials (
                    account_key TEXT PRIMARY KEY,
                    encrypted_blob TEXT NOT NULL,
                    connected_at TEXT NOT NULL,
                    last_sync_at TEXT,
                    last_error TEXT,
                    last_account_id TEXT
                );
                """
            )

    # ── credentials ──────────────────────────────────────────

    def store_credentials(
        self,
        account_key: str,
        payload: Dict[str, Any],
    ) -> None:
        """payload: { host, port, clientId, accountId? }"""
        token = _fernet().encrypt(json.dumps(payload).encode("utf-8")).decode("utf-8")
        now = datetime.now(timezone.utc).isoformat()
        with self._conn() as c:
            c.execute(
                """
                INSERT INTO ibkr_credentials
                  (account_key, encrypted_blob, connected_at, last_sync_at, last_error, last_account_id)
                VALUES (?, ?, ?, NULL, NULL, ?)
                ON CONFLICT(account_key) DO UPDATE SET
                  encrypted_blob = excluded.encrypted_blob,
                  connected_at = excluded.connected_at,
                  last_error = NULL,
                  last_account_id = excluded.last_account_id
                """,
                (account_key, token, now, str(payload.get("accountId") or "")),
            )

    def load_credentials(self, account_key: str) -> Optional[Dict[str, Any]]:
        with self._conn() as c:
            row = c.execute(
                "SELECT encrypted_blob FROM ibkr_credentials WHERE account_key = ?",
                (account_key,),
            ).fetchone()
        if not row:
            return None
        try:
            return json.loads(_fernet().decrypt(row[0].encode("utf-8")))
        except InvalidToken:
            return None

    def delete_credentials(self, account_key: str) -> None:
        with self._conn() as c:
            c.execute(
                "DELETE FROM ibkr_credentials WHERE account_key = ?",
                (account_key,),
            )

    def status_row(self, account_key: str) -> Optional[Dict[str, Any]]:
        with self._conn() as c:
            row = c.execute(
                """
                SELECT account_key, connected_at, last_sync_at, last_error, last_account_id
                FROM ibkr_credentials WHERE account_key = ?
                """,
                (account_key,),
            ).fetchone()
        if not row:
            return None
        return {
            "account_key": row[0],
            "connected_at": row[1],
            "last_sync_at": row[2],
            "last_error": row[3],
            "last_account_id": row[4],
        }

    def mark_sync(self, account_key: str, error: Optional[str] = None) -> None:
        now = datetime.now(timezone.utc).isoformat() if error is None else None
        with self._conn() as c:
            c.execute(
                """
                UPDATE ibkr_credentials
                SET last_sync_at = COALESCE(?, last_sync_at),
                    last_error = ?
                WHERE account_key = ?
                """,
                (now, error, account_key),
            )


_singleton: Optional[IBKRStorage] = None


def get_ibkr_storage() -> IBKRStorage:
    global _singleton
    if _singleton is None:
        _singleton = IBKRStorage()
    return _singleton
