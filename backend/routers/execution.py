"""
Phase H — `/api/execution/*` REST surface.

Multi-broker: each available broker gets its own `ExecutionRunner`
(its own `RiskGate`, its own on-disk journal). The router exposes the
broker name as an optional query/body field on each route; defaults to
`EXECUTION_BROKER` env or the first available broker.

Routes:
    GET    /api/execution/brokers              list available brokers + default
    GET    /api/execution/account              ?broker=<name>  account snapshot + positions
    GET    /api/execution/account/all          all-broker dashboard view
    GET    /api/execution/orders               ?broker=<name|all>  journal (newest first)
    POST   /api/execution/signal               submit a signal {symbol, side, qty, broker?}
    GET    /api/execution/broker/probe         ?broker=<name>  cheap connectivity check
    GET    /api/execution/panic                panic status
    POST   /api/execution/panic                engage kill switch + close-all on every broker
    DELETE /api/execution/panic                clear panic flag
    GET    /api/execution/template-signal      derive a one-shot signal from a template
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from execution import (
    AlpacaBroker,
    AvanzaBroker,
    ExecutionRunner,
    IBKRBroker,
    OrderSide,
    OrderType,
    PanicService,
    PaperBroker,
    RiskConfig,
    RiskGate,
)
from execution.alpaca_broker import alpaca_creds_present
from execution.avanza_broker import avanza_creds_present
from execution.ibkr_broker import ibkr_creds_present

router = APIRouter(prefix="/api/execution", tags=["execution"])
logger = logging.getLogger(__name__)


# ── multi-broker runner registry ─────────────────────────────


def _new_risk_gate() -> RiskGate:
    return RiskGate(RiskConfig(
        max_order_qty=float(os.getenv("RISK_MAX_ORDER_QTY", "1000")),
        max_position_notional=float(os.getenv("RISK_MAX_POSITION_NOTIONAL", "50000")),
        max_drawdown_pct=float(os.getenv("RISK_MAX_DRAWDOWN_PCT", "20")),
        max_daily_loss_pct=float(os.getenv("RISK_MAX_DAILY_LOSS_PCT", "5")),
        initial_equity=float(os.getenv("PAPER_CASH", "100000")),
    ))


def _build_runners() -> Dict[str, ExecutionRunner]:
    """Build one ExecutionRunner per available broker.

    Selection rules:
        paper   → always built (no creds, no network).
        ibkr    → built when EXECUTION_BROKER=ibkr or EXECUTION_INCLUDE_IBKR=true.
                  Connection is LAZY — we don't call .connect() here, so a
                  TWS-down box still boots the router. First quote / order
                  triggers the connect attempt.
        alpaca  → built when EXECUTION_BROKER=alpaca or ALPACA_API_KEY/SECRET set.
        avanza  → built when EXECUTION_BROKER=avanza or AVANZA_USER/PASS/TOTP set
                  or encrypted credentials are present in storage. Auth is lazy.

    Each runner gets its own risk gate and a distinct session_id so journals
    don't collide.
    """
    explicit = os.getenv("EXECUTION_BROKER", "").lower()
    runners: Dict[str, ExecutionRunner] = {}

    # paper — always.
    paper = PaperBroker(initial_cash=float(os.getenv("PAPER_CASH", "100000")))
    runners["paper"] = ExecutionRunner(
        broker=paper, gate=_new_risk_gate(), session_id="default-paper",
    )

    # ibkr
    want_ibkr = explicit == "ibkr" or os.getenv("EXECUTION_INCLUDE_IBKR", "").lower() in {"1", "true", "yes"} or ibkr_creds_present()
    if want_ibkr:
        try:
            ibkr = IBKRBroker()
            runners["ibkr"] = ExecutionRunner(
                broker=ibkr, gate=_new_risk_gate(), session_id="default-ibkr",
            )
        except Exception as e:
            logger.warning("ibkr runner skipped: %s", e)

    # alpaca
    want_alpaca = explicit == "alpaca" or alpaca_creds_present()
    if want_alpaca:
        try:
            alpaca = AlpacaBroker()
            runners["alpaca"] = ExecutionRunner(
                broker=alpaca, gate=_new_risk_gate(), session_id="default-alpaca",
            )
        except Exception as e:
            logger.warning("alpaca runner skipped: %s", e)

    # avanza
    want_avanza = explicit == "avanza" or avanza_creds_present()
    if want_avanza:
        try:
            avanza = AvanzaBroker()
            runners["avanza"] = ExecutionRunner(
                broker=avanza, gate=_new_risk_gate(), session_id="default-avanza",
            )
        except Exception as e:
            logger.warning("avanza runner skipped: %s", e)

    return runners


_RUNNERS: Optional[Dict[str, ExecutionRunner]] = None


def runners() -> Dict[str, ExecutionRunner]:
    global _RUNNERS
    if _RUNNERS is None:
        _RUNNERS = _build_runners()
    return _RUNNERS


def _default_broker_name() -> str:
    avail = runners()
    explicit = os.getenv("EXECUTION_BROKER", "").lower()
    if explicit and explicit in avail:
        return explicit
    if "paper" in avail:
        return "paper"
    # Falls back to the first key — at least one is guaranteed (paper is always present).
    return next(iter(avail))


def _resolve_runner(broker: Optional[str]) -> ExecutionRunner:
    avail = runners()
    name = (broker or _default_broker_name()).lower()
    runner = avail.get(name)
    if runner is None:
        raise HTTPException(
            status_code=400,
            detail=f"broker '{name}' not available; have {sorted(avail.keys())}",
        )
    return runner


# Backwards-compat shim — some older callers / tests may still expect
# a single `runner()` callable. Default to the default broker.
def runner() -> ExecutionRunner:
    return _resolve_runner(None)


# ── broker discovery ─────────────────────────────────────────


@router.get("/brokers")
async def list_brokers() -> dict[str, Any]:
    avail = runners()
    return {
        "available": sorted(avail.keys()),
        "default": _default_broker_name(),
    }


# ── account / orders ─────────────────────────────────────────


@router.get("/account")
async def get_account(broker: Optional[str] = None) -> dict[str, Any]:
    r = _resolve_runner(broker)
    snap = r.broker.get_account()
    return {
        "broker": r.broker.name,
        "halted": r.gate.is_halted(),
        "halt_reason": r.gate.halt_reason(),
        "panic": PanicService.status(),
        "available_brokers": sorted(runners().keys()),
        **snap.to_dict(),
    }


@router.get("/account/all")
async def get_account_all() -> dict[str, Any]:
    out: Dict[str, Any] = {}
    for name, r in runners().items():
        try:
            out[name] = r.broker.get_account().to_dict()
        except Exception as e:
            out[name] = {"error": f"{type(e).__name__}: {e}"}
    return {
        "brokers": out,
        "panic": PanicService.status(),
        "default": _default_broker_name(),
    }


@router.get("/broker/probe")
async def broker_probe(broker: Optional[str] = None) -> dict[str, Any]:
    """Cheap connectivity check — useful for a per-broker "connected" pill in
    the UI. Pulls a trivial AAPL quote; returns latency + which broker ran."""
    import time
    r = _resolve_runner(broker)
    t0 = time.time()
    px: float | None = None
    error: str | None = None
    try:
        px = r.broker.quote("AAPL")
    except Exception as e:
        error = f"{type(e).__name__}: {e}"
    return {
        "broker": r.broker.name,
        "ok": px is not None and px > 0,
        "quote_aapl": px,
        "latency_ms": int((time.time() - t0) * 1000),
        "error": error,
    }


@router.get("/orders")
async def list_orders(broker: Optional[str] = None, limit: int = 200) -> dict[str, Any]:
    if (broker or "").lower() == "all":
        merged: list[dict[str, Any]] = []
        for r in runners().values():
            merged.extend(r.list_orders(limit=limit))
        merged.sort(key=lambda o: o.get("journaled_at", ""), reverse=True)
        return {"orders": merged[:limit], "broker": "all"}
    r = _resolve_runner(broker)
    return {"orders": r.list_orders(limit=limit), "broker": r.broker.name}


# ── signal submit ────────────────────────────────────────────


class SignalRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=64)
    side: str = Field(..., pattern="^(buy|sell)$")
    qty: float = Field(..., gt=0)
    type: str = Field("market", pattern="^(market|limit)$")
    limit_price: Optional[float] = None
    broker: Optional[str] = None


@router.post("/signal")
async def submit_signal(req: SignalRequest) -> dict[str, Any]:
    r = _resolve_runner(req.broker)
    order = r.submit_signal(
        symbol=req.symbol,
        side=OrderSide(req.side),
        qty=req.qty,
        order_type=OrderType(req.type),
        limit_price=req.limit_price,
    )
    return {"order": order.to_dict(), "broker": r.broker.name}


# ── kill switch ──────────────────────────────────────────────


class PanicRequest(BaseModel):
    reason: str = "ui-engaged"


@router.get("/panic")
async def panic_status() -> dict[str, Any]:
    return PanicService.status()


@router.post("/panic")
async def engage_panic(req: PanicRequest | None = None) -> dict[str, Any]:
    """Engage global panic + close_all on every available broker."""
    reason = (req.reason if req else "ui-engaged")
    PanicService.engage(reason)
    closed_by_broker: dict[str, list[dict[str, Any]]] = {}
    for name, r in runners().items():
        try:
            closed = r.broker.close_all()
            for o in closed:
                r._journal_order(o)
            closed_by_broker[name] = [o.to_dict() for o in closed]
        except Exception as e:
            closed_by_broker[name] = [{"error": f"{type(e).__name__}: {e}"}]
    return {
        "panic": PanicService.status(),
        "closed_by_broker": closed_by_broker,
    }


@router.delete("/panic")
async def clear_panic() -> dict[str, Any]:
    out = PanicService.clear()
    for r in runners().values():
        r.gate.reset_halt()
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
