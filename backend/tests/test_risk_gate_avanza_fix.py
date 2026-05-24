"""Verify bug 17 fix: RiskGate gets drawdown protection from evaluate alone,
without requiring an FILLED-only update_equity callback from the runner.

This is the Avanza case (orders always return PENDING).
"""
from __future__ import annotations

import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Import sub-modules directly to skip execution/__init__.py's IBKR pull-in
# (ibapi may not be installed in every dev environment).
from execution.risk_gate import RiskGate, RiskConfig  # noqa: E402
from execution.schema import (  # noqa: E402
    AccountSnapshot,
    Order,
    OrderSide,
    OrderType,
)


def _order():
    return Order(
        id="t", symbol="AAPL", side=OrderSide.BUY, qty=1,
        type=OrderType.MARKET, broker="test",
    )


def _snap(equity: float):
    return AccountSnapshot(
        cash=equity * 0.5, equity=equity, buying_power=equity * 0.5,
        realised_pnl=0.0, unrealised_pnl=0.0, positions=[], broker="test",
    )


def test_evaluate_bumps_peak_equity():
    gate = RiskGate(RiskConfig(initial_equity=100_000))
    gate.evaluate(_order(), _snap(110_000), price_estimate=200)
    assert gate._peak_equity == 110_000


def test_evaluate_triggers_drawdown_halt_without_FILLED_callback():
    """Bug 17: previously the gate's drawdown protection only kicked in when
    runner.submit_signal saw OrderStatus.FILLED and called update_equity.
    For Avanza (PENDING-only) that never happened. The fix makes evaluate
    itself update equity from the snapshot, so halts trigger normally."""
    gate = RiskGate(RiskConfig(initial_equity=100_000, max_drawdown_pct=20.0))

    # Bring peak up.
    gate.evaluate(_order(), _snap(120_000), price_estimate=200)
    assert gate._peak_equity == 120_000
    assert not gate.is_halted()

    # Now drop equity 30% from peak — should halt + reject.
    decision = gate.evaluate(_order(), _snap(84_000), price_estimate=200)
    assert gate.is_halted()
    assert "drawdown" in (gate.halt_reason() or "").lower()
    assert not decision.allowed


def test_evaluate_triggers_daily_loss_halt_without_FILLED_callback():
    gate = RiskGate(RiskConfig(initial_equity=100_000, max_daily_loss_pct=5.0))
    # First evaluate anchors day_open via update_equity.
    gate.evaluate(_order(), _snap(100_000), price_estimate=200)
    # Drop 10% in one snapshot — exceeds 5% daily loss cap.
    decision = gate.evaluate(_order(), _snap(89_000), price_estimate=200)
    assert gate.is_halted()
    assert "daily" in (gate.halt_reason() or "").lower()
    assert not decision.allowed
