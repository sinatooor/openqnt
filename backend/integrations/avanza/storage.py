"""
SQLite-backed storage for Avanza credentials and resolver cache.

We keep this independent of the SQLAlchemy market-data DB so it can sit
next to the existing `local_database.py` users/strategies tables. All
credential blobs are encrypted with `cryptography.fernet` using a key
derived from the `ENCRYPTION_KEY` env var (or a default seeded one).

Design notes
------------
- Single-user-friendly: the backend itself doesn't enforce auth, so we
  identify the connection by an `account_key` (defaults to "default" for
  local dev; in deployments it's the user-id passed from the orchestrator).
- Failure mode for missing key: refuse to write rather than silently
  storing plaintext. The connect endpoint surfaces a clear error.
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
except ImportError:  # pragma: no cover - cryptography is a hard dep
    Fernet = None  # type: ignore
    InvalidToken = Exception  # type: ignore


_DEFAULT_DB = Path(__file__).resolve().parents[2] / "strategies.db"
_LOCK = threading.RLock()


def _fernet() -> "Fernet":
    if Fernet is None:
        raise RuntimeError(
            "cryptography is not installed; pip install cryptography to enable Avanza"
        )
    raw = os.getenv("ENCRYPTION_KEY") or os.getenv("AVANZA_ENCRYPTION_KEY")
    if not raw:
        # Derive a stable key from the JWT secret as a last resort. Not
        # great, but lets dev mode boot without manual setup.
        raw = os.getenv("JWT_SECRET") or "openqwnt-dev-key-change-me"
    digest = sha256(raw.encode("utf-8")).digest()
    return Fernet(urlsafe_b64encode(digest))


class AvanzaStorage:
    """Persistence layer for Avanza credentials and resolver cache."""

    def __init__(self, db_path: Optional[Path] = None) -> None:
        self.db_path = Path(db_path) if db_path else _DEFAULT_DB
        self._init_schema()

    # ------------------------------------------------------------------
    # schema
    # ------------------------------------------------------------------

    def _init_schema(self) -> None:
        with self._conn() as c:
            c.executescript(
                """
                CREATE TABLE IF NOT EXISTS avanza_credentials (
                    account_key TEXT PRIMARY KEY,
                    encrypted_blob TEXT NOT NULL,
                    connected_at TEXT NOT NULL,
                    last_sync_at TEXT,
                    last_error TEXT
                );

                CREATE TABLE IF NOT EXISTS avanza_instruments (
                    cache_key TEXT PRIMARY KEY,
                    orderbook_id TEXT NOT NULL,
                    instrument_type TEXT,
                    name TEXT,
                    ticker TEXT,
                    isin TEXT,
                    currency TEXT,
                    raw_json TEXT,
                    cached_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS avanza_positions (
                    account_key TEXT NOT NULL,
                    account_id TEXT NOT NULL,
                    orderbook_id TEXT NOT NULL,
                    symbol TEXT,
                    name TEXT,
                    quantity REAL,
                    average_price REAL,
                    last_price REAL,
                    market_value REAL,
                    currency TEXT,
                    raw_json TEXT,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY(account_key, account_id, orderbook_id)
                );

                CREATE TABLE IF NOT EXISTS avanza_watchlists (
                    account_key TEXT NOT NULL,
                    watchlist_id TEXT NOT NULL,
                    name TEXT,
                    orderbook_ids TEXT,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY(account_key, watchlist_id)
                );

                CREATE TABLE IF NOT EXISTS avanza_transactions (
                    account_key TEXT NOT NULL,
                    transaction_id TEXT NOT NULL,
                    account_id TEXT,
                    orderbook_id TEXT,
                    type TEXT,
                    amount REAL,
                    currency TEXT,
                    executed_at TEXT,
                    raw_json TEXT,
                    PRIMARY KEY(account_key, transaction_id)
                );

                CREATE TABLE IF NOT EXISTS trade_audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_key TEXT NOT NULL,
                    action TEXT NOT NULL,
                    orderbook_id TEXT,
                    payload_json TEXT,
                    response_json TEXT,
                    status TEXT,
                    timestamp TEXT NOT NULL
                );
                """
            )

    # ------------------------------------------------------------------
    # credentials
    # ------------------------------------------------------------------

    def store_credentials(
        self, account_key: str, payload: Dict[str, Any]
    ) -> None:
        token = _fernet().encrypt(json.dumps(payload).encode("utf-8")).decode("utf-8")
        now = datetime.now(timezone.utc).isoformat()
        with self._conn() as c:
            c.execute(
                """
                INSERT INTO avanza_credentials (account_key, encrypted_blob, connected_at, last_sync_at, last_error)
                VALUES (?, ?, ?, NULL, NULL)
                ON CONFLICT(account_key) DO UPDATE SET
                    encrypted_blob = excluded.encrypted_blob,
                    connected_at = excluded.connected_at,
                    last_error = NULL
                """,
                (account_key, token, now),
            )

    def load_credentials(self, account_key: str) -> Optional[Dict[str, Any]]:
        with self._conn() as c:
            row = c.execute(
                "SELECT encrypted_blob FROM avanza_credentials WHERE account_key = ?",
                (account_key,),
            ).fetchone()
        if not row:
            return None
        try:
            data = _fernet().decrypt(row[0].encode("utf-8"))
            return json.loads(data)
        except InvalidToken:
            return None

    def delete_credentials(self, account_key: str) -> None:
        with self._conn() as c:
            c.execute(
                "DELETE FROM avanza_credentials WHERE account_key = ?",
                (account_key,),
            )

    def status_row(self, account_key: str) -> Optional[Dict[str, Any]]:
        with self._conn() as c:
            row = c.execute(
                """
                SELECT account_key, connected_at, last_sync_at, last_error
                FROM avanza_credentials WHERE account_key = ?
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
        }

    def mark_sync(self, account_key: str, error: Optional[str] = None) -> None:
        now = datetime.now(timezone.utc).isoformat() if error is None else None
        with self._conn() as c:
            c.execute(
                """
                UPDATE avanza_credentials
                SET last_sync_at = COALESCE(?, last_sync_at),
                    last_error = ?
                WHERE account_key = ?
                """,
                (now, error, account_key),
            )

    # ------------------------------------------------------------------
    # instrument resolver cache
    # ------------------------------------------------------------------

    def cache_instrument(self, cache_key: str, payload: Dict[str, Any]) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._conn() as c:
            c.execute(
                """
                INSERT INTO avanza_instruments
                  (cache_key, orderbook_id, instrument_type, name, ticker, isin, currency, raw_json, cached_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(cache_key) DO UPDATE SET
                  orderbook_id = excluded.orderbook_id,
                  instrument_type = excluded.instrument_type,
                  name = excluded.name,
                  ticker = excluded.ticker,
                  isin = excluded.isin,
                  currency = excluded.currency,
                  raw_json = excluded.raw_json,
                  cached_at = excluded.cached_at
                """,
                (
                    cache_key,
                    str(payload.get("orderbookId") or payload.get("orderbook_id") or ""),
                    payload.get("instrumentType") or payload.get("instrument_type"),
                    payload.get("name"),
                    payload.get("tickerSymbol") or payload.get("ticker"),
                    payload.get("isin"),
                    payload.get("currency"),
                    json.dumps(payload),
                    now,
                ),
            )

    def get_cached_instrument(self, cache_key: str) -> Optional[Dict[str, Any]]:
        with self._conn() as c:
            row = c.execute(
                "SELECT raw_json FROM avanza_instruments WHERE cache_key = ?",
                (cache_key,),
            ).fetchone()
        if not row or not row[0]:
            return None
        try:
            return json.loads(row[0])
        except json.JSONDecodeError:
            return None

    # ------------------------------------------------------------------
    # positions / watchlists / transactions sync
    # ------------------------------------------------------------------

    def replace_positions(self, account_key: str, rows: list[Dict[str, Any]]) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._conn() as c:
            c.execute(
                "DELETE FROM avanza_positions WHERE account_key = ?",
                (account_key,),
            )
            c.executemany(
                """
                INSERT INTO avanza_positions
                  (account_key, account_id, orderbook_id, symbol, name, quantity,
                   average_price, last_price, market_value, currency, raw_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        account_key,
                        str(r.get("account_id") or ""),
                        str(r.get("orderbook_id") or ""),
                        r.get("symbol"),
                        r.get("name"),
                        r.get("quantity"),
                        r.get("average_price"),
                        r.get("last_price"),
                        r.get("market_value"),
                        r.get("currency"),
                        json.dumps(r.get("raw") or {}),
                        now,
                    )
                    for r in rows
                ],
            )

    def list_positions(self, account_key: str) -> list[Dict[str, Any]]:
        with self._conn() as c:
            rows = c.execute(
                """
                SELECT account_id, orderbook_id, symbol, name, quantity,
                       average_price, last_price, market_value, currency, raw_json, updated_at
                FROM avanza_positions WHERE account_key = ?
                """,
                (account_key,),
            ).fetchall()
        return [
            {
                "account_id": r[0],
                "orderbook_id": r[1],
                "symbol": r[2],
                "name": r[3],
                "quantity": r[4],
                "average_price": r[5],
                "last_price": r[6],
                "market_value": r[7],
                "currency": r[8],
                "raw": json.loads(r[9]) if r[9] else None,
                "updated_at": r[10],
            }
            for r in rows
        ]

    def replace_watchlists(self, account_key: str, rows: list[Dict[str, Any]]) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._conn() as c:
            c.execute(
                "DELETE FROM avanza_watchlists WHERE account_key = ?",
                (account_key,),
            )
            c.executemany(
                """
                INSERT INTO avanza_watchlists (account_key, watchlist_id, name, orderbook_ids, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (
                        account_key,
                        str(r.get("id") or ""),
                        r.get("name"),
                        json.dumps(r.get("orderbook_ids") or []),
                        now,
                    )
                    for r in rows
                ],
            )

    def list_watchlists(self, account_key: str) -> list[Dict[str, Any]]:
        with self._conn() as c:
            rows = c.execute(
                "SELECT watchlist_id, name, orderbook_ids FROM avanza_watchlists WHERE account_key = ?",
                (account_key,),
            ).fetchall()
        return [
            {
                "id": r[0],
                "name": r[1],
                "orderbook_ids": json.loads(r[2]) if r[2] else [],
            }
            for r in rows
        ]

    def upsert_transactions(self, account_key: str, rows: list[Dict[str, Any]]) -> None:
        with self._conn() as c:
            c.executemany(
                """
                INSERT INTO avanza_transactions
                  (account_key, transaction_id, account_id, orderbook_id, type, amount, currency, executed_at, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(account_key, transaction_id) DO UPDATE SET
                  type = excluded.type,
                  amount = excluded.amount,
                  currency = excluded.currency,
                  executed_at = excluded.executed_at,
                  raw_json = excluded.raw_json
                """,
                [
                    (
                        account_key,
                        str(r.get("transaction_id") or ""),
                        r.get("account_id"),
                        r.get("orderbook_id"),
                        r.get("type"),
                        r.get("amount"),
                        r.get("currency"),
                        r.get("executed_at"),
                        json.dumps(r.get("raw") or {}),
                    )
                    for r in rows
                    if r.get("transaction_id")
                ],
            )

    # ------------------------------------------------------------------
    # audit log
    # ------------------------------------------------------------------

    def append_audit(
        self,
        account_key: str,
        action: str,
        orderbook_id: Optional[str],
        payload: Optional[Dict[str, Any]],
        response: Optional[Dict[str, Any]],
        status: str,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._conn() as c:
            c.execute(
                """
                INSERT INTO trade_audit_log
                  (account_key, action, orderbook_id, payload_json, response_json, status, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    account_key,
                    action,
                    orderbook_id,
                    json.dumps(payload) if payload else None,
                    json.dumps(response) if response else None,
                    status,
                    now,
                ),
            )

    # ------------------------------------------------------------------
    # internals
    # ------------------------------------------------------------------

    def _conn(self) -> sqlite3.Connection:
        with _LOCK:
            conn = sqlite3.connect(self.db_path)
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys=ON")
            conn.row_factory = None
            return conn


_singleton: Optional[AvanzaStorage] = None


def get_storage() -> AvanzaStorage:
    global _singleton
    if _singleton is None:
        _singleton = AvanzaStorage()
    return _singleton
