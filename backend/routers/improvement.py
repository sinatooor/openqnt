"""
Phase I — `/api/improvement/*` REST + WebSocket surface.

A single in-process registry tracks running ImprovementRunners by
`run_id` so the WS endpoint can stream events as they're written to
disk.

Routes:
    POST    /api/improvement/start                start a run, returns {run_id}
    GET     /api/improvement/runs/{run_id}        full tree snapshot
    GET     /api/improvement/runs                 list recent runs
    WS      /api/improvement/ws/{run_id}          live event stream
"""
from __future__ import annotations

import asyncio
import json
import threading
import time
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from backtest import BacktestSpec
from improvement import (
    ImprovementRunner,
    ImprovementSummary,
    ImprovementTree,
    default_objective,
    objective_from_name,
)
from improvement.tree import RUNS_ROOT

router = APIRouter(prefix="/api/improvement", tags=["improvement"])

# ── singleton state ─────────────────────────────────────────

_RUNS: dict[str, dict[str, Any]] = {}
"""Map run_id → {summary?, status, started_at}."""


# ── request shapes ──────────────────────────────────────────


class ImprovementSeed(BaseModel):
    symbol: str = "SPY"
    start: str = "2018-01-01"
    end: str = "2022-12-31"
    interval: str = "1d"
    initial_cash: float = 10_000.0
    commission: float = 0.002
    strategy: str = "rsi_meanrev"
    params: dict[str, Any] = Field(default_factory=dict)
    code: Optional[str] = None


class ImprovementStartRequest(BaseModel):
    seed: ImprovementSeed
    n_iters: int = Field(5, ge=1, le=20)
    fanout: int = Field(2, ge=1, le=6)
    objective: str = "sharpe_dd_penalised"
    validation_start: Optional[str] = None
    validation_end: Optional[str] = None
    budget_s: float = Field(180.0, ge=10.0, le=1800.0)


# ── routes ───────────────────────────────────────────────────


@router.post("/start")
async def start_improvement(req: ImprovementStartRequest) -> dict[str, Any]:
    seed = BacktestSpec(
        symbol=req.seed.symbol,
        start=req.seed.start,
        end=req.seed.end,
        interval=req.seed.interval,
        initial_cash=req.seed.initial_cash,
        commission=req.seed.commission,
        strategy=req.seed.strategy,
        params=req.seed.params,
        code=req.seed.code,
        save_artifacts=False,
    )

    # Wire validation window into the chosen objective if provided.
    if req.objective == "sharpe_dd_penalised":
        objective = default_objective(
            validation_start=req.validation_start,
            validation_end=req.validation_end,
        )
    else:
        objective = objective_from_name(req.objective)
        objective.validation_start = req.validation_start
        objective.validation_end = req.validation_end

    runner = ImprovementRunner(
        seed_spec=seed,
        objective=objective,
        budget_s=req.budget_s,
        fanout=req.fanout,
    )
    run_id = runner.tree.run_id
    _RUNS[run_id] = {"status": "running", "started_at": time.time(),
                     "n_iters": req.n_iters}

    def _go() -> None:
        try:
            summary: ImprovementSummary = runner.run(n_iters=req.n_iters)
            _RUNS[run_id].update({"status": "done",
                                  "summary": summary.to_dict(),
                                  "ended_at": time.time()})
        except Exception as e:  # noqa: BLE001
            _RUNS[run_id].update({"status": "error", "error": str(e),
                                  "ended_at": time.time()})

    threading.Thread(target=_go, daemon=True).start()
    return {"run_id": run_id, "status": "running"}


@router.get("/runs/{run_id}")
async def get_run(run_id: str) -> dict[str, Any]:
    tree = ImprovementTree.load(run_id)
    if tree is None:
        raise HTTPException(404, f"unknown improvement run '{run_id}'")
    state = _RUNS.get(run_id, {})
    return {
        "run_id": run_id,
        "meta": tree.meta.__dict__ if tree.meta else None,
        "nodes": [n.to_dict() for n in tree.nodes],
        "status": state.get("status", tree.meta.status if tree.meta else "unknown"),
        "summary": state.get("summary"),
    }


@router.get("/runs")
async def list_runs(limit: int = 20) -> dict[str, Any]:
    if not RUNS_ROOT.exists():
        return {"runs": []}
    runs = []
    # Improvement runs live under boss/runs/<run_id>/improvement_tree/.
    for d in sorted(RUNS_ROOT.glob("imp_*"), key=lambda p: p.stat().st_mtime,
                    reverse=True)[:limit]:
        tj = d / "improvement_tree" / "tree.json"
        if not tj.exists():
            continue
        try:
            snap = json.loads(tj.read_text())
            meta = snap.get("meta") or {}
            runs.append({
                "run_id": meta.get("run_id") or d.name,
                "objective": meta.get("objective_name"),
                "started_at": meta.get("started_at"),
                "ended_at": meta.get("ended_at"),
                "status": meta.get("status"),
                "n_nodes": len(snap.get("nodes", [])),
            })
        except Exception:
            continue
    return {"runs": runs}


@router.websocket("/ws/{run_id}")
async def stream_improvement(ws: WebSocket, run_id: str) -> None:
    await ws.accept()
    events_path = RUNS_ROOT / run_id / "improvement_tree" / "events.jsonl"
    # Wait briefly for the file to appear (background thread may not have
    # written its first event yet).
    for _ in range(20):
        if events_path.exists():
            break
        await asyncio.sleep(0.1)
    if not events_path.exists():
        await ws.send_json({"kind": "error",
                            "message": f"unknown improvement run '{run_id}'"})
        await ws.close()
        return

    pos = 0
    try:
        while True:
            with events_path.open() as f:
                f.seek(pos)
                while True:
                    line = f.readline()
                    if not line:
                        pos = f.tell()
                        break
                    try:
                        await ws.send_json(json.loads(line))
                    except WebSocketDisconnect:
                        return
                    pos = f.tell()
            state = _RUNS.get(run_id, {})
            if state.get("status") in {"done", "error"}:
                # Flush any final events the run wrote between the last
                # readline() and the status flip.
                with events_path.open() as f:
                    f.seek(pos)
                    rest = f.read()
                    for ln in rest.splitlines():
                        if ln.strip():
                            try:
                                await ws.send_json(json.loads(ln))
                            except WebSocketDisconnect:
                                return
                await ws.send_json({"kind": "run_complete",
                                    "status": state.get("status"),
                                    "summary": state.get("summary")})
                await ws.close()
                return
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        return
