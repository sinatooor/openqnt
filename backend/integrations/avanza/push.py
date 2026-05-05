"""
CometD/Bayeux WebSocket client for Avanza's `_push/cometd` endpoint.

This is a thin wrapper that subscribes to live channels (quotes, orderdepths,
trades, positions, orders, deals, accounts) and yields decoded events. The
full Bayeux handshake is non-trivial so we do the minimum needed for the
quotes/positions channels the WATCH and Portfolio screens rely on.

Phase 8 wires this into a FastAPI WebSocket fanout so the frontend can
subscribe via /api/realtime/avanza/quotes/{ids}.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import AsyncIterator, Awaitable, Callable, Dict, List, Optional

import httpx
import websockets

from .auth import AvanzaAuth, AVANZA_BASE

logger = logging.getLogger(__name__)


PUSH_URL = "wss://www.avanza.se/_push/cometd"


class AvanzaPushClient:
    def __init__(self, auth: AvanzaAuth) -> None:
        self._auth = auth
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._client_id: Optional[str] = None
        self._msg_id = 0
        self._lock = asyncio.Lock()

    def _next_id(self) -> str:
        self._msg_id += 1
        return str(self._msg_id)

    async def connect(self) -> None:
        async with self._lock:
            if self._ws is not None:
                return
            session = await self._auth.session()
            cookie_header = "; ".join(f"{k}={v}" for k, v in session.cookies.items())
            headers = {
                "Cookie": cookie_header,
                "User-Agent": session.header_dict()["User-Agent"],
            }
            self._ws = await websockets.connect(PUSH_URL, extra_headers=headers)
            await self._send([{
                "channel": "/meta/handshake",
                "version": "1.0",
                "supportedConnectionTypes": ["websocket", "long-polling"],
                "advice": {"timeout": 60000, "interval": 0},
                "id": self._next_id(),
                "ext": {
                    "com.cometd.transport.websocket.requireHandshakePerConnection": True,
                    "auth": {"token": session.security_token},
                },
            }])
            handshake = await self._recv_one()
            self._client_id = handshake.get("clientId")
            if not self._client_id:
                raise RuntimeError(f"Avanza handshake failed: {handshake}")
            await self._send([{
                "channel": "/meta/connect",
                "clientId": self._client_id,
                "connectionType": "websocket",
                "id": self._next_id(),
            }])

    async def subscribe(self, channel: str) -> None:
        await self.connect()
        assert self._client_id is not None
        await self._send([{
            "channel": "/meta/subscribe",
            "clientId": self._client_id,
            "subscription": channel,
            "id": self._next_id(),
        }])

    async def stream(self) -> AsyncIterator[Dict]:
        if self._ws is None:
            await self.connect()
        assert self._ws is not None
        try:
            async for raw in self._ws:
                try:
                    payload = json.loads(raw)
                except Exception:
                    continue
                if isinstance(payload, list):
                    for msg in payload:
                        if isinstance(msg, dict):
                            yield msg
                elif isinstance(payload, dict):
                    yield payload
        finally:
            await self.aclose()

    async def aclose(self) -> None:
        async with self._lock:
            ws = self._ws
            self._ws = None
            self._client_id = None
        if ws:
            try:
                await ws.close()
            except Exception:
                pass

    async def _send(self, payload: List[Dict]) -> None:
        assert self._ws is not None
        await self._ws.send(json.dumps(payload))

    async def _recv_one(self) -> Dict:
        assert self._ws is not None
        raw = await self._ws.recv()
        data = json.loads(raw)
        if isinstance(data, list):
            return data[0] if data else {}
        return data
