"""
Singleton-ish manager that gives every backend caller the same authenticated
AvanzaClient per `account_key`. Keeps connections warm between requests.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Dict, Optional

from .auth import AvanzaAuth, AvanzaAuthError
from .client import AvanzaClient
from .storage import AvanzaStorage, get_storage

logger = logging.getLogger(__name__)


class AvanzaManager:
    def __init__(self, storage: Optional[AvanzaStorage] = None) -> None:
        self._storage = storage or get_storage()
        self._clients: Dict[str, AvanzaClient] = {}
        self._anon: Optional[AvanzaClient] = None
        self._lock = asyncio.Lock()

    def has_credentials(self, account_key: str) -> bool:
        return self._storage.load_credentials(account_key) is not None

    async def anon_client(self) -> AvanzaClient:
        async with self._lock:
            if self._anon is None:
                self._anon = AvanzaClient()
            return self._anon

    async def authed_client(self, account_key: str) -> AvanzaClient:
        async with self._lock:
            existing = self._clients.get(account_key)
            if existing:
                return existing
            creds = self._storage.load_credentials(account_key)
            if not creds:
                raise AvanzaAuthError("no Avanza credentials stored for this account")
            auth = AvanzaAuth(
                username=creds["username"],
                password=creds["password"],
                totp_secret=creds["totp_secret"],
            )
            client = AvanzaClient(auth=auth)
            self._clients[account_key] = client
            return client

    async def reset(self, account_key: str) -> None:
        async with self._lock:
            client = self._clients.pop(account_key, None)
        if client:
            await client.aclose()

    async def aclose(self) -> None:
        async with self._lock:
            clients = list(self._clients.values())
            self._clients.clear()
            anon = self._anon
            self._anon = None
        for c in clients:
            await c.aclose()
        if anon:
            await anon.aclose()


_manager: Optional[AvanzaManager] = None


def get_manager() -> AvanzaManager:
    global _manager
    if _manager is None:
        _manager = AvanzaManager()
    return _manager
