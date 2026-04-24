"""
Phase H — `/api/execution/*` REST surface.

A single in-process `ExecutionRunner` backs the REST. Auto-selects
`AlpacaBroker` when both `ALPACA_API_KEY` and `ALPACA_API_SECRET` are
set in env, otherwise falls back to `PaperBroker`. The Phase H exit
criterion runs end-to-end on PaperBroker.

Routes:
    GET    /api/execution/account          account snapshot + positions
    GET    /api/execution/orders           journal (newest first)
    POST   /api/execution/signal           submit a signal {symbol, side, qty}
    GET    /api/execution/panic            panic status
    POST   /api/execution/panic            engage kill switch + close-all
    DELETE /api/execution/panic            clear panic flag
    GET    /api/execution/template-signal  derive a one-shot signal from
                                            a template (Phase E bridge)
"""
from __future__ import annotations

import os
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from execution import (
    AlpacaBroker,
    ExecutionRunner,
    OrderSide,
    OrderType,
    PanicService,
    PaperBroker,
    RiskConfig,
    RiskGate,
)
from execution.alpaca_broker import alpaca_creds_present

router = APIRouter(prefix="/api/execution", tags=["execution"])


# ── singleton runner ─────────────────────────────────────────


def _build_runner() -> ExecutionRunner:
    if alpaca_creds_present():
        try:
            broker = AlpacaBroker()
        except Exception:
            broker = PaperBroker(initial_cash=float(os.getenv("PAPER_CASH", "100000")))
    else:
        broker = PaperBroker(initial_cash=float(os.getenv("PAPER_CASH", "100000")))
    gate = RiskGate(RiskConfig(
        max_order_qty=float(os.getenv("RISK_MAX_ORDER_QTY", "1000")),
        max_position_notional=float(os.getenv("RISK_MAX_POSITION_NOTIONAL", "50000")),
        max_drawdown_pct=float(os.getenv("RISK_MAX_DRAWDOWN_PCT", "20")),
        max_daily_loss_pct=float(os.getenv("RISK_MAX_DAILY_LOSS_PCT", "5")),
        initial_equity=float(os.getenv("PAPER_CASH", "100000")),
    ))
    return ExecutionRunner(broker=broker, gate=gate, session_id="default")


_RUNNER: Optional[ExecutionRunner] = None


def runner() -> ExecutionRunner:
    global _RUNNER
    if _RUNNER is None:
        _RUNNER = _build_runner()
    return _RUNNER


# ── account / orders ─────────────────────────────────────────


@router.get("/account")
async def get_account() -> dict[str, Any]:
    snap = runner().broker.get_account()
    return {
        "broker": runner().broker.name,
        "halted": runner().gate.is_halted(),
        "halt_reason": runner().gate.halt_reason(),
        "panic": PanicService.status(),
        **snap.to_dict(),
    }


@router.get("/orders")
async def list_orders(limit: int = 200) -> dict[str, Any]:
    return {"orders": runner().list_orders(limit=limit)}


# ── signal submit ────────────────────────────────────────────


class SignalRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=12)
    side: str = Field(..., pattern="^(buy|sell)$")
    qty: float = Field(..., gt=0)
    type: str = Field("market", pattern="^(market|limit)$")
    limit_price: Optional[float] = None


@router.post("/signal")
async def submit_signal(req: SignalRequest) -> dict[str, Any]:
    order = runner().submit_signal(
        symbol=req.symbol,
        side=OrderSide(req.side),
        qty=req.qty,
        order_type=OrderType(req.type),
        limit_price=req.limit_price,
    )
    return {"order": order.to_dict()}


# ── kill switch ──────────────────────────────────────────────


class PanicRequest(BaseModel):
    reason: str = "ui-engaged"


@router.get("/panic")
async def panic_status() -> dict[str, Any]:
    return PanicService.status()


@router.post("/panic")
async def engage_panic(req: PanicRequest | None = None) -> dict[str, Any]:
    reason = (req.reason if req else "ui-engaged")
    return runner().kill_switch(reason=reason)


@router.delete("/panic")
async def clear_panic() -> dict[str, Any]:
    out = PanicService.clear()
    runner().gate.reset_halt()
    return out


# ── Phase E bridge: derive a signal from the RSI template ───


@router.get("/template-signal")
async def template_signal(
    template_id: str = "rsi-mean-reversion-spy",
) -> dict[str, Any]:
    """One-shot today-style signal from the RSI template's spec.

    Pulls the template's `backtestSpec` (symbol, params), fetches the
    most recent ~60 days of bars via the canonical loader, computes
    RSI(period), and returns:
      - "buy"  when RSI < oversold
      - "sell" when RSI > overbought
      - "flat" otherwise
    The frontend uses this to flip the Phase-E template into a
    paper-live signal with one click.
    """
    if template_id != "rsi-mean-reversion-spy":
        raise HTTPException(404, f"unknown template '{template_id}' (only RSI is wired)")

    # Hard-code the spec here so we don't need to parse the TS file at
    # request time. It mirrors what's in strategyTemplates.ts.
    spec = {
        "symbol": "SPY",
        "rsi_period": 14,
        "oversold": 30,
        "overbought": 70,
    }

    try:
        from datetime import date, timedelta
        from backtest.data import load_bars
        import numpy as np

        end = date.today()
        start = end - timedelta(days=120)
        bars = load_bars(spec["symbol"], start.isoformat(), end.isoformat(), "1d")
        if bars is None or bars.empty:
            return {"signal": "flat", "reason": "no bars", "spec": spec}

        # Wilder's RSI inline (cheap; mirrors backtest.builtins).
        n = spec["rsi_period"]
        close = bars["Close"].astype(float).values
        delta = np.diff(close)
        gains = np.where(delta > 0, delta, 0.0)
        losses = np.where(delta < 0, -delta, 0.0)
        if len(gains) < n:
            return {"signal": "flat", "reason": "not enough bars", "spec": spec}
        avg_gain = gains[:n].mean()
        avg_loss = losses[:n].mean()
        for g, l in zip(gains[n:], losses[n:]):
            avg_gain = (avg_gain * (n - 1) + g) / n
            avg_loss = (avg_loss * (n - 1) + l) / n
        rs = avg_gain / avg_loss if avg_loss > 0 else 0.0
        rsi = 100 - 100 / (1 + rs) if avg_loss > 0 else 100.0
        last_close = float(close[-1])

        if rsi < spec["oversold"]:
            sig = "buy"
        elif rsi > spec["overbought"]:
            sig = "sell"
        else:
            sig = "flat"
        return {
            "signal": sig,
            "rsi": round(float(rsi), 2),
            "last_close": last_close,
            "spec": spec,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"could not derive signal: {e}")
