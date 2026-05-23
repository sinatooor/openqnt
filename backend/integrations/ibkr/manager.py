"""
Singleton-ish manager for the IBKR broker connection.

Wraps the existing `backend/execution/ibkr_broker.py::IBKRBroker` so the
HTTP router can ask `is_connected()`, kick off a `connect()` with a hard
timeout (so a missing TWS fails fast instead of hanging the request),
and share one broker instance across requests.

The underlying `IBKRBroker` is thread-safe (its own `threading.Lock`),
and the calls into it are blocking. We wrap each call in `asyncio.to_thread`
so the FastAPI event loop stays responsive.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from execution.ibkr_broker import IBKRBroker
from execution.schema import AccountSnapshot

from .storage import IBKRStorage, get_ibkr_storage

logger = logging.getLogger(__name__)

# Hard wall-clock timeout for the IBKR `connect()` call. The broker itself
# has an 8 s handshake wait; we add a touch of headroom but no more, so
# the UI never waits longer than this when TWS is offline.
CONNECT_TIMEOUT_SEC = 10.0


class IBKRManager:
    def __init__(self, storage: Optional[IBKRStorage] = None) -> None:
        self._storage = storage or get_ibkr_storage()
        self._broker: Optional[IBKRBroker] = None
        self._lock = asyncio.Lock()

    # ── lifecycle ───────────────────────────────────────────────

    def has_credentials(self, account_key: str = "default") -> bool:
        return self._storage.load_credentials(account_key) is not None

    def is_connected(self) -> bool:
        b = self._broker
        if b is None or b._app is None:
            return False
        try:
            return bool(b._app.isConnected())
        except Exception:
            return False

    async def connect(
        self,
        host: str,
        port: int,
        client_id: int,
        account_key: str = "default",
    ) -> None:
        """Stores creds + connects. Raises on TWS-unreachable / handshake failure.

        Wrapped in a hard `asyncio.wait_for` so a missing TWS returns within
        CONNECT_TIMEOUT_SEC seconds.
        """
        async with self._lock:
            # If we already have an active broker on a different host/port,
            # tear it down before reconnecting.
            if self._broker is not None and (
                self._broker.host != host
                or self._broker.port != port
                or self._broker.client_id != client_id
            ):
                try:
                    await asyncio.to_thread(self._broker.disconnect)
                except Exception:
                    pass
                self._broker = None

            broker = self._broker or IBKRBroker(host=host, port=port, client_id=client_id)
            try:
                await asyncio.wait_for(
                    asyncio.to_thread(broker.connect),
                    timeout=CONNECT_TIMEOUT_SEC,
                )
            except asyncio.TimeoutError as e:
                raise RuntimeError(
                    f"TWS / IB Gateway at {host}:{port} did not respond within "
                    f"{CONNECT_TIMEOUT_SEC:.0f}s. Is TWS running with API access enabled?"
                ) from e
            except (ConnectionRefusedError, OSError) as e:
                raise RuntimeError(
                    f"TWS / IB Gateway not reachable at {host}:{port}. "
                    "Start TWS and enable Configure → API → 'Enable ActiveX and Socket Clients'."
                ) from e

            self._broker = broker
            self._storage.store_credentials(
                account_key,
                {"host": host, "port": port, "clientId": client_id},
            )

    async def disconnect(self, account_key: str = "default") -> None:
        async with self._lock:
            if self._broker is not None:
                try:
                    await asyncio.to_thread(self._broker.disconnect)
                except Exception:
                    pass
                self._broker = None
            self._storage.delete_credentials(account_key)

    async def ensure_connected_from_storage(self, account_key: str = "default") -> bool:
        """Auto-reconnect using stored creds. Returns False if no creds or
        connection fails — never raises (this is best-effort)."""
        if self.is_connected():
            return True
        creds = self._storage.load_credentials(account_key)
        if not creds:
            return False
        try:
            await self.connect(
                host=str(creds.get("host", "127.0.0.1")),
                port=int(creds.get("port", 7497)),
                client_id=int(creds.get("clientId", 42)),
                account_key=account_key,
            )
            return True
        except Exception as e:
            logger.info("IBKR auto-reconnect failed: %s", e)
            return False

    # ── data access ─────────────────────────────────────────────

    async def get_account(self) -> AccountSnapshot:
        """Returns AccountSnapshot. If not connected, raises RuntimeError."""
        broker = self._broker
        if broker is None or not self.is_connected():
            raise RuntimeError("IBKR not connected")
        return await asyncio.to_thread(broker.get_account)

    async def quote(self, symbol: str) -> Optional[float]:
        broker = self._broker
        if broker is None or not self.is_connected():
            return None
        return await asyncio.to_thread(broker.quote, symbol)

    @property
    def broker(self) -> Optional[IBKRBroker]:
        return self._broker


_manager: Optional[IBKRManager] = None


def get_ibkr_manager() -> IBKRManager:
    global _manager
    if _manager is None:
        _manager = IBKRManager()
    return _manager
