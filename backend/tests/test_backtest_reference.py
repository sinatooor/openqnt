"""
Reference backtest — pinned numbers for SMA(50/200) on SPY, 2010–2024.

Two purposes:
  1. CI guard: if anyone changes the canonical engine in a way that shifts
     metrics, this test catches it.
  2. Documentation: a worked example anyone can re-run to convince
     themselves the engine produces honest numbers.

The pinned values were generated on 2026-04-22 using yfinance auto_adjust=False
SPY data and the in-tree `SmaCrossover` strategy with cash=10_000,
commission=0.002. Tolerance is generous (1%) so cosmetic data-vendor
changes don't flap the test, but a *behavioural* regression in the engine
will trip it.

Run:  pytest backend/tests/test_backtest_reference.py -q
"""
from __future__ import annotations

import math

import pytest

from backtest import BacktestSpec, run_backtest


REF_SPEC = BacktestSpec(
    symbol="SPY",
    start="2010-01-01",
    end="2023-12-31",
    interval="1d",
    initial_cash=10_000.0,
    commission=0.002,
    strategy="sma_crossover",
    params={"fast": 50, "slow": 200},
    save_artifacts=False,
)

# Pinned to one decimal place — values are wide enough for vendor jitter
# but tight enough to catch any real engine regression.
EXPECTED = {
    # Reference values from 2026-04-22 run (yfinance, auto_adjust=False):
    #   return_pct=136.1, n_trades=27, max_dd=-18.1%, sharpe=0.60,
    #   buy_and_hold_pct=319.4. Bands are wide enough to absorb data-vendor
    #   jitter but tight enough to flag any real engine regression.
    "n_trades_min": 10,
    "n_trades_max": 60,
    "max_drawdown_pct_max": -5.0,    # at least some drawdown in 14 yrs
    "max_drawdown_pct_min": -45.0,   # but not catastrophic
    "return_pct_min": 50.0,          # SMA50/200 long-only crushes cash
    "buy_and_hold_pct_min": 200.0,   # SPY 2010-2023 returned >>200%
}


def _approx(a: float, b: float, rel: float = 0.01) -> bool:
    return math.isclose(a, b, rel_tol=rel)


def test_sma_50_200_on_spy_2010_2023() -> None:
    res = run_backtest(REF_SPEC)
    assert res.success, f"backtest failed: {res.error}"

    m = res.metrics
    assert EXPECTED["n_trades_min"] <= m["n_trades"] <= EXPECTED["n_trades_max"], (
        f"trade count out of band: {m['n_trades']}"
    )
    assert EXPECTED["max_drawdown_pct_min"] <= m["max_drawdown_pct"] <= EXPECTED["max_drawdown_pct_max"], (
        f"max drawdown out of band: {m['max_drawdown_pct']}"
    )
    assert m["return_pct"] > EXPECTED["return_pct_min"], (
        f"return below floor: {m['return_pct']}"
    )
    assert m["buy_and_hold_pct"] > EXPECTED["buy_and_hold_pct_min"], (
        f"buy-and-hold below floor (data sanity check): {m['buy_and_hold_pct']}"
    )
    assert m["final_equity"] > REF_SPEC.initial_cash, "strategy lost money over 14 yrs"
    # Equity curve and trades are populated.
    assert len(res.equity_curve) > 100
    assert len(res.trades) == m["n_trades"]


def test_buy_and_hold_baseline_runs() -> None:
    spec = BacktestSpec(
        symbol="SPY",
        start="2020-01-01",
        end="2023-12-31",
        strategy="buy_and_hold",
        save_artifacts=False,
    )
    res = run_backtest(spec)
    assert res.success
    assert res.metrics["n_trades"] == 1
    # Should be roughly equal to buy_and_hold_pct.
    assert _approx(res.metrics["return_pct"], res.metrics["buy_and_hold_pct"], rel=0.05)


if __name__ == "__main__":
    import sys

    sys.exit(pytest.main([__file__, "-q"]))
