"""
In-process pub/sub for live agent stream events.

A thin wrapper around per-run asyncio.Queue subscribers so the WebSocket
endpoint can stream events as they are produced by AgentRunContext.

No external broker (Redis, etc) — this is intentionally simple. Multi-process
deployments would swap this for Redis pub/sub or similar.
"""

from __future__ import annotations

import asyncio
from typing import Any


class EventBus:
    def __init__(self) -> None:
        # run_id → list[asyncio.Queue]
        self._subs: dict[str, list[asyncio.Queue[dict[str, Any]]]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, run_id: str) -> asyncio.Queue[dict[str, Any]]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=1024)
        async with self._lock:
            self._subs.setdefault(run_id, []).append(q)
        return q

    async def unsubscribe(self, run_id: str, q: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            queues = self._subs.get(run_id, [])
            if q in queues:
                queues.remove(q)
            if not queues:
                self._subs.pop(run_id, None)

    def publish(self, run_id: str, event: dict[str, Any]) -> None:
        """Fire-and-forget. Drops events for slow subscribers (no backpressure)."""
        for q in self._subs.get(run_id, []):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                # Drop the oldest, push the new one.
                try:
                    _ = q.get_nowait()
                    q.put_nowait(event)
                except Exception:
                    pass


EVENT_BUS = EventBus()
