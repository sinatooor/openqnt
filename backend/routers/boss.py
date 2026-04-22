"""
Boss router — Phase C.

Endpoints (mounted under /api/boss):
  POST /run                    Start a boss run (fire-and-forget).
  GET  /runs                   List past boss runs.
  GET  /runs/{run_id}          Boss run detail (meta + events + artifacts).
  GET  /runs/{run_id}/events   Full events.jsonl.
  WS   /ws/{run_id}            Live event stream for a boss run.

The WS stream carries both the boss's own events (plan, subtask,
subtask_result, synthesis, message, …) AND the events of every sub-run the
boss spawned. This gives the frontend a single socket per boss run that is
sufficient to render the live dispatch tree without opening N more sockets.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from agent_runtime import (
    AgentRunContext,
    EVENT_BUS,
    list_runs,
    load_run,
    load_run_events,
)

from adk_agents.boss_agent import boss_agent


router = APIRouter(prefix="/api/boss", tags=["boss"])


# ── start a boss run ─────────────────────────────────────────────────

class BossRunRequest(BaseModel):
    objective: str
    symbols: list[str] | None = None
    model: str | None = "gemini-2.5-flash"


class BossRunResponse(BaseModel):
    run_id: str
    objective: str


@router.post("/run", response_model=BossRunResponse)
async def start_boss_run(req: BossRunRequest) -> BossRunResponse:
    if not req.objective or not req.objective.strip():
        raise HTTPException(400, "objective is required")

    ctx = AgentRunContext(
        agent_id="boss",
        task=req.objective,
        symbols=req.symbols or [],
        model=req.model,
    )

    async def _runner() -> None:
        try:
            result = await boss_agent.run(
                objective=req.objective,
                symbols=req.symbols or [],
                model=req.model,
                ctx=ctx,
            )
            err = result.get("error")
            if err:
                ctx.finish(status="error", error=err)
            else:
                synth = result.get("synthesis") or {}
                ctx.finish(
                    status="success",
                    conclusion=synth.get("summary") or "Boss cycle complete.",
                    signal=synth.get("overall_signal"),
                    confidence=synth.get("overall_confidence"),
                )
        except Exception as e:  # noqa: BLE001
            ctx.finish(status="error", error=f"{type(e).__name__}: {e}")

    asyncio.create_task(_runner())
    return BossRunResponse(run_id=ctx.run_id, objective=req.objective)


# ── list / detail ────────────────────────────────────────────────────

@router.get("/runs")
async def list_boss_runs(limit: int = 50) -> dict[str, Any]:
    runs = list_runs(agent_id="boss", limit=limit)
    return {"runs": runs, "count": len(runs)}


@router.get("/runs/{run_id}")
async def boss_run_detail(run_id: str) -> dict[str, Any]:
    data = load_run("boss", run_id)
    if not data:
        raise HTTPException(404, "Boss run not found")
    return data


@router.get("/runs/{run_id}/events")
async def boss_run_events(run_id: str) -> dict[str, Any]:
    events = load_run_events("boss", run_id)
    if not events:
        # Distinguish "no events yet" from "not a real run" with the dir check.
        data = load_run("boss", run_id)
        if not data:
            raise HTTPException(404, "Boss run not found")
    return {"run_id": run_id, "events": events}


# ── live WebSocket ───────────────────────────────────────────────────

@router.websocket("/ws/{run_id}")
async def boss_run_stream(ws: WebSocket, run_id: str):
    """
    Stream live events for a boss run.

    We fan in two sources into a single socket:
      1. The boss's own events (by subscribing to EVENT_BUS[run_id]).
      2. Every sub-run spawned by the boss — we detect those from the
         `subtask` events (which carry `subAgentId`), then dynamically
         subscribe to the sub-run's stream as soon as its sub_run_id is
         known (carried by `subtask_result`).

    On connect we replay the on-disk backlog for the boss run so late
    joiners see the full timeline.
    """
    await ws.accept()

    sent_ids: set[str] = set()
    boss_queue = await EVENT_BUS.subscribe(run_id)
    sub_queues: dict[str, asyncio.Queue[dict[str, Any]]] = {}

    async def _send(evt: dict[str, Any]) -> bool:
        eid = evt.get("id") or ""
        if eid and eid in sent_ids:
            return True
        if eid:
            sent_ids.add(eid)
        try:
            await ws.send_text(json.dumps(evt))
            return True
        except Exception:
            return False

    # Replay boss backlog.
    for evt in load_run_events("boss", run_id):
        if not await _send(evt):
            await ws.close()
            return
        # If the boss already dispatched subtasks before the WS connected,
        # replay each sub-run's backlog too.
        sub_run_id = evt.get("subRunId")
        if evt.get("kind") == "subtask_result" and sub_run_id:
            sub_agent = evt.get("subAgentId")
            if sub_agent:
                for sevt in load_run_events(sub_agent, sub_run_id):
                    sevt = {**sevt, "bossSubRunId": sub_run_id, "bossSubAgentId": sub_agent}
                    if not await _send(sevt):
                        await ws.close()
                        return

    async def _subscribe_sub(sub_run_id: str, sub_agent_id: str) -> None:
        if sub_run_id in sub_queues:
            return
        q = await EVENT_BUS.subscribe(sub_run_id)
        sub_queues[sub_run_id] = q
        # Replay any events that already landed on disk before we subscribed.
        for sevt in load_run_events(sub_agent_id, sub_run_id):
            sevt = {**sevt, "bossSubRunId": sub_run_id, "bossSubAgentId": sub_agent_id}
            await _send(sevt)

    try:
        while True:
            # Build the wait set: boss queue + any sub-run queues we've
            # attached so far. asyncio.wait lets us multiplex.
            get_boss = asyncio.create_task(boss_queue.get())
            sub_tasks = {
                asyncio.create_task(q.get()): (srid, sub_queues)
                for srid, q in sub_queues.items()
            }
            all_tasks = [get_boss, *sub_tasks.keys()]
            done, pending = await asyncio.wait(
                all_tasks,
                timeout=30.0,
                return_when=asyncio.FIRST_COMPLETED,
            )

            # Cancel the tasks we didn't consume (they'll be recreated next
            # iteration; a dropped item goes back to the queue only if we
            # await it, which we do via the next iteration's get()).
            for t in pending:
                t.cancel()

            if not done:
                # Heartbeat on timeout.
                if not await _send({"kind": "heartbeat", "runId": run_id}):
                    break
                continue

            terminal = False
            for t in done:
                try:
                    evt = t.result()
                except Exception:
                    continue

                # Annotate sub-run events so the UI can route them.
                if t is not get_boss:
                    evt = {
                        **evt,
                        "bossSubRunId": evt.get("runId"),
                        "bossSubAgentId": evt.get("agentId"),
                    }

                if not await _send(evt):
                    terminal = True
                    break

                # Boss-level dispatch: attach to new sub-run.
                if t is get_boss and evt.get("kind") == "subtask_result":
                    srid = evt.get("subRunId")
                    sagent = evt.get("subAgentId")
                    if srid and sagent:
                        await _subscribe_sub(srid, sagent)

                # Boss-level terminal status.
                rs = evt.get("runStatus")
                if t is get_boss and rs in ("success", "error", "cancelled"):
                    await _send({"kind": "end", "runId": run_id, "runStatus": rs})
                    terminal = True

            if terminal:
                break

    except WebSocketDisconnect:
        pass
    finally:
        await EVENT_BUS.unsubscribe(run_id, boss_queue)
        for srid, q in sub_queues.items():
            await EVENT_BUS.unsubscribe(srid, q)
        try:
            await ws.close()
        except Exception:
            pass
