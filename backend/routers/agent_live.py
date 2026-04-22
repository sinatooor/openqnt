"""
Agent live runtime API — start runs, list past runs, stream live events,
serve persisted artifacts and memory/state files.

Endpoints (mounted under /api/agent-runtime):
  POST  /run                        Start a run for a registered agent.
  GET   /runs                       List past runs (optionally filter by agent).
  GET   /runs/{run_id}              Run summary + meta + artifacts.
  GET   /runs/{run_id}/events       events.jsonl (full).
  GET   /runs/{run_id}/artifact/{sub}/{name}
                                    Serve a saved artifact (plots/* or artifacts/*).
  GET   /agents/{agent_id}/memory   memory.md (markdown text).
  GET   /agents/{agent_id}/state    state.md  (markdown text).
  PUT   /agents/{agent_id}/memory   Overwrite memory.md.

  WS    /ws/runs/{run_id}           Live event stream (Cursor-style).

Run dispatch is fire-and-forget: POST /run returns the run_id immediately,
and the WebSocket pumps events as they're produced. The same events are
appended to events.jsonl on disk so reload-after-the-fact is consistent.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel

from agent_runtime import (
    AgentRunContext,
    EVENT_BUS,
    list_runs,
    load_run,
    load_run_events,
    read_memory,
    read_state,
    write_memory,
)
from agent_runtime.storage import artifact_path

# Reuse the central registry from the older runner so we don't drift.
from .agent_runner import AGENT_REGISTRY

# Add the two not in the original registry yet, so the live UI can run all of them.
try:
    from adk_agents.fundamentals_agent import fundamentals_agent
    AGENT_REGISTRY.setdefault("fundamentals_agent", fundamentals_agent)
except Exception:
    pass
try:
    from adk_agents.sentiment_agent import sentiment_agent
    AGENT_REGISTRY.setdefault("sentiment_agent", sentiment_agent)
except Exception:
    pass


router = APIRouter(prefix="/api/agent-runtime", tags=["agent-runtime"])


# ── start a run ───────────────────────────────────────────────────────

class StartRunRequest(BaseModel):
    agent_id: str
    task: str | None = None
    symbols: list[str] | None = None
    model: str | None = None
    context: dict[str, Any] | None = None


class StartRunResponse(BaseModel):
    run_id: str
    agent_id: str
    task: str


@router.post("/run", response_model=StartRunResponse)
async def start_run(req: StartRunRequest) -> StartRunResponse:
    agent = AGENT_REGISTRY.get(req.agent_id)
    if not agent:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown agent_id: {req.agent_id}. Available: {sorted(AGENT_REGISTRY)}",
        )
    task = req.task or f"{req.agent_id} run"
    ctx = AgentRunContext(
        agent_id=req.agent_id,
        task=task,
        symbols=req.symbols or [],
        model=req.model,
    )

    # Build the analyze() context.
    context: dict[str, Any] = {**(req.context or {})}
    if req.symbols and "symbols" not in context:
        context["symbols"] = req.symbols
    if req.model and "model" not in context:
        context["model"] = req.model
    context.setdefault("task", task)

    async def _runner() -> None:
        try:
            out = await agent.run(context, ctx)
            ctx.finish(
                status="error" if out.error else "success",
                conclusion=out.summary or None,
                signal=out.overall_signal.value if out.overall_signal else None,
                confidence=out.overall_confidence,
                error=out.error,
            )
        except Exception as e:  # noqa: BLE001
            ctx.finish(status="error", error=f"{type(e).__name__}: {e}")

    # Fire-and-forget. We deliberately don't await — the WS subscriber will follow events.
    asyncio.create_task(_runner())

    return StartRunResponse(run_id=ctx.run_id, agent_id=req.agent_id, task=task)


# ── list runs ────────────────────────────────────────────────────────

@router.get("/runs")
async def runs_list(agent_id: Optional[str] = None, limit: int = 50) -> dict[str, Any]:
    runs = list_runs(agent_id=agent_id, limit=limit)
    return {"runs": runs, "count": len(runs)}


@router.get("/runs/{run_id}")
async def run_detail(run_id: str, agent_id: Optional[str] = None) -> dict[str, Any]:
    aid = agent_id or _resolve_agent_id(run_id)
    if not aid:
        raise HTTPException(404, "Run not found")
    data = load_run(aid, run_id)
    if not data:
        raise HTTPException(404, "Run not found")
    return data


@router.get("/runs/{run_id}/events")
async def run_events(run_id: str, agent_id: Optional[str] = None) -> dict[str, Any]:
    aid = agent_id or _resolve_agent_id(run_id)
    if not aid:
        raise HTTPException(404, "Run not found")
    return {"run_id": run_id, "events": load_run_events(aid, run_id)}


@router.get("/runs/{run_id}/artifact/{sub}/{name}")
async def run_artifact(run_id: str, sub: str, name: str, agent_id: Optional[str] = None):
    aid = agent_id or _resolve_agent_id(run_id)
    if not aid:
        raise HTTPException(404, "Run not found")
    p = artifact_path(aid, run_id, sub, name)
    if not p:
        raise HTTPException(404, "Artifact not found")
    return FileResponse(str(p))


# ── memory & state ────────────────────────────────────────────────────

@router.get("/agents/{agent_id}/memory", response_class=PlainTextResponse)
async def get_memory(agent_id: str) -> str:
    return read_memory(agent_id)


class MemoryWrite(BaseModel):
    markdown: str


@router.put("/agents/{agent_id}/memory")
async def put_memory(agent_id: str, body: MemoryWrite) -> dict[str, Any]:
    write_memory(agent_id, body.markdown)
    return {"ok": True, "agent_id": agent_id, "bytes": len(body.markdown)}


@router.get("/agents/{agent_id}/state", response_class=PlainTextResponse)
async def get_state(agent_id: str) -> str:
    return read_state(agent_id)


@router.get("/agents")
async def list_agents() -> dict[str, Any]:
    return {
        "agents": [
            {"id": k, "description": getattr(v, "description", k)}
            for k, v in sorted(AGENT_REGISTRY.items())
        ]
    }


# ── live WebSocket ────────────────────────────────────────────────────

@router.websocket("/ws/runs/{run_id}")
async def run_stream(ws: WebSocket, run_id: str, agent_id: Optional[str] = None):
    """
    Stream live events for a run.

    On connect, replays any events already on disk (so a late-joining client
    sees the full timeline), then pumps live events from the in-process bus
    until the client disconnects or the run hits a terminal status.
    """
    await ws.accept()

    aid = agent_id or _resolve_agent_id(run_id)
    # If the run is brand-new we may not yet have events on disk; that's fine.
    sent_ids: set[str] = set()

    # Replay backlog.
    if aid:
        for evt in load_run_events(aid, run_id):
            sent_ids.add(evt.get("id", ""))
            try:
                await ws.send_text(json.dumps(evt))
            except Exception:
                await ws.close()
                return

    # Subscribe live.
    queue = await EVENT_BUS.subscribe(run_id)
    try:
        while True:
            try:
                evt = await asyncio.wait_for(queue.get(), timeout=30.0)
            except asyncio.TimeoutError:
                # Heartbeat (cheap keep-alive)
                await ws.send_text(json.dumps({"kind": "heartbeat", "runId": run_id}))
                continue
            if evt.get("id") in sent_ids:
                continue
            sent_ids.add(evt.get("id", ""))
            await ws.send_text(json.dumps(evt))

            # Detect terminal status emitted by ctx.finish().
            run_status = evt.get("runStatus")
            if run_status in ("success", "error", "cancelled"):
                # Give the client a tick to receive then close.
                await asyncio.sleep(0.05)
                await ws.send_text(json.dumps({"kind": "end", "runId": run_id, "runStatus": run_status}))
                break
    except WebSocketDisconnect:
        return
    finally:
        await EVENT_BUS.unsubscribe(run_id, queue)
        try:
            await ws.close()
        except Exception:
            pass


# ── helpers ───────────────────────────────────────────────────────────

def _resolve_agent_id(run_id: str) -> Optional[str]:
    """Find which agent owns a given run_id by scanning agents/. Cheap for
    the run counts we expect (≤ 50 per agent)."""
    for r in list_runs(limit=500):
        if r.get("run_id") == run_id:
            return r.get("agent_id")
    return None
