"""
Phase J3 — `/api/telemetry/*` REST surface.

Exposes the in-process counters built in `backend/telemetry/`. The
dashboard widget polls `GET /api/telemetry/summary` once a few seconds
and renders agent-run / tool-call / error counts with a small recents
list.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from telemetry import reset, snapshot

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])


@router.get("/summary")
async def get_summary() -> dict[str, Any]:
    return snapshot()


@router.post("/reset")
async def reset_counters() -> dict[str, Any]:
    reset()
    return {"ok": True, "since": snapshot()["since"]}
