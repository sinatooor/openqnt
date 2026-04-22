"""
Canonical backtest API — `/api/backtest/*`.

One endpoint, one schema, one engine. Wraps `backtest.run_backtest()` so
both the frontend and the agent tool layer hit the exact same code path.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backtest import BacktestSpec, available_strategies, run_backtest

router = APIRouter(prefix="/api/backtest", tags=["backtest"])


class BacktestRunRequest(BaseModel):
    symbol: str = "SPY"
    start: str = "2020-01-01"
    end: str = "2024-12-31"
    interval: str = "1d"
    initial_cash: float = 10_000.0
    commission: float = 0.002
    strategy: str = "sma_crossover"
    params: dict[str, Any] = Field(default_factory=dict)
    code: Optional[str] = None
    save_artifacts: bool = True
    run_id: Optional[str] = None


@router.get("/strategies")
async def list_strategies() -> dict[str, Any]:
    return {"strategies": available_strategies()}


@router.post("/run")
async def run(req: BacktestRunRequest) -> dict[str, Any]:
    spec = BacktestSpec(**req.model_dump())
    result = run_backtest(spec)
    if not result.success:
        # Still 200 — surface the error in the body so the UI can render it
        # without going through HTTP-error UX. 4xx/5xx is reserved for
        # invalid requests / programmer errors.
        return result.to_dict()
    return result.to_dict()


@router.get("/runs/{run_id}/plot")
async def get_plot(run_id: str):
    """Serve the equity-curve PNG saved by an earlier run.

    Lets the UI keep the result page small (no inline base64) when it just
    wants to show the chart by URL.
    """
    p = Path(__file__).resolve().parents[2] / "agents" / "_backtests" / run_id / "equity.png"
    if not p.exists():
        raise HTTPException(404, f"plot not found for run {run_id}")
    return FileResponse(str(p), media_type="image/png")


@router.get("/runs/{run_id}")
async def get_run(run_id: str) -> dict[str, Any]:
    """Return the persisted result.json for an earlier run."""
    import json as _json

    p = Path(__file__).resolve().parents[2] / "agents" / "_backtests" / run_id / "result.json"
    if not p.exists():
        raise HTTPException(404, f"run not found: {run_id}")
    return _json.loads(p.read_text())
