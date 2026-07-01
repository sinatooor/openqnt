"""
Memory Router — browse and edit the copilot's brain.

Backs the memory-browser UI. Human edits (actor="user") may touch any file,
including soul.md; the agent's learning phase is the only thing bound by the
stricter write policy in memory.store.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from memory import store

router = APIRouter(prefix="/api/memory", tags=["memory"])


class MemoryFile(BaseModel):
    name: str
    content: str


class ResetRequest(BaseModel):
    name: str


class AssetRequest(BaseModel):
    ticker: str


@router.get("/files")
async def list_memory_files():
    """List every memory file with metadata (for the browser sidebar)."""
    return {"files": store.list_files()}


@router.get("/file")
async def read_memory_file(name: str):
    """Read one memory file's markdown content."""
    try:
        return {"name": store.normalize_name(name), "content": store.read(name)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/file")
async def write_memory_file(body: MemoryFile):
    """Overwrite one memory file (human edit — no agent write restrictions)."""
    try:
        canonical = store.write(body.name, body.content)  # actor=user: unrestricted
        return {"name": canonical, "ok": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/file/reset")
async def reset_memory_file(body: ResetRequest):
    """Reset a file to its shipped default (soul.md / user.md / …)."""
    try:
        canonical = store.reset_to_default(body.name)
        return {"name": canonical, "content": store.read(canonical), "ok": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/asset")
async def create_asset_file(body: AssetRequest):
    """Create an assets/<TICKER>.md note from the template (idempotent)."""
    try:
        canonical = store.ensure_asset(body.ticker)
        return {"name": canonical, "content": store.read(canonical), "ok": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
