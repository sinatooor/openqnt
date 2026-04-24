"""
Phase G — `/api/tools/*` REST surface.

Read-only listing of every tool the system can call, split into:

  * `static`  — modules under `backend/adk_agents/tools/` (built-ins).
  * `dynamic` — agent-authored tools persisted under
                `agents/tools/dynamic/<name>.py` via the Phase-G
                developer flow.

Plus two action endpoints used by the UI demo + tests:

  * `POST /api/tools/sandbox/execute`       run arbitrary Python
  * `POST /api/tools/dynamic/{name}/call`   call a registered dynamic tool
"""
from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from dynamic_tools import (
    call_dynamic_tool,
    create_dynamic_tool,
    delete_dynamic_tool,
    list_dynamic_tools,
    read_dynamic_tool_source,
)
from sandbox import ExecuteRequest, execute_python

router = APIRouter(prefix="/api/tools", tags=["tools"])


# ── built-in (static) tool catalog ────────────────────────────────────

_STATIC_TOOLS_DIR = Path(__file__).resolve().parents[1] / "adk_agents" / "tools"


def _scan_static_tools() -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    if not _STATIC_TOOLS_DIR.exists():
        return out
    for p in sorted(_STATIC_TOOLS_DIR.glob("*.py")):
        if p.name.startswith("_") or p.stem.startswith("_"):
            continue
        head = ""
        try:
            text = p.read_text(encoding="utf-8")
            # Module docstring's first paragraph.
            if text.startswith('"""'):
                end = text.find('"""', 3)
                if end > 0:
                    head = text[3:end].strip().split("\n\n")[0].strip()
        except Exception:
            head = ""
        out.append({"name": p.stem, "description": head})
    return out


@router.get("")
async def list_all_tools() -> dict[str, Any]:
    return {
        "static": _scan_static_tools(),
        "dynamic": [asdict(m) for m in list_dynamic_tools()],
    }


@router.get("/dynamic")
async def list_dynamic() -> dict[str, Any]:
    metas = list_dynamic_tools()
    return {"count": len(metas), "tools": [asdict(m) for m in metas]}


@router.get("/dynamic/{name}")
async def get_dynamic_tool(name: str) -> dict[str, Any]:
    metas = [m for m in list_dynamic_tools() if m.name == name]
    if not metas:
        raise HTTPException(404, f"unknown dynamic tool '{name}'")
    src = read_dynamic_tool_source(name)
    return {"meta": asdict(metas[0]), "source": src}


# ── sandbox execute ──────────────────────────────────────────────────


class SandboxExecuteRequest(BaseModel):
    code: str
    files_in: dict[str, str] = Field(default_factory=dict)
    timeout_s: float = 8.0
    cpu_seconds: int = 10
    mem_mb: int = 512


@router.post("/sandbox/execute")
async def sandbox_execute(req: SandboxExecuteRequest) -> dict[str, Any]:
    res = execute_python(ExecuteRequest(
        code=req.code,
        files_in=dict(req.files_in),
        timeout_s=req.timeout_s,
        cpu_seconds=req.cpu_seconds,
        mem_mb=req.mem_mb,
    ))
    return res.to_dict()


# ── dynamic tool create / call / delete ──────────────────────────────


class CreateDynamicRequest(BaseModel):
    name: str
    code: str
    description: str = ""


@router.post("/dynamic")
async def create_dynamic(req: CreateDynamicRequest) -> dict[str, Any]:
    return create_dynamic_tool(name=req.name, code=req.code, description=req.description)


class CallDynamicRequest(BaseModel):
    kwargs: dict[str, Any] = Field(default_factory=dict)
    timeout_s: float = 8.0


@router.post("/dynamic/{name}/call")
async def call_dynamic(name: str, req: CallDynamicRequest) -> dict[str, Any]:
    return call_dynamic_tool(name, req.kwargs, timeout_s=req.timeout_s)


@router.delete("/dynamic/{name}")
async def delete_dynamic(name: str) -> dict[str, Any]:
    ok = delete_dynamic_tool(name)
    if not ok:
        raise HTTPException(404, f"unknown dynamic tool '{name}'")
    return {"ok": True}
