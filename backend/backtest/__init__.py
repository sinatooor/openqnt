"""
Canonical backtest module — one entry point for every caller.

Use this from anywhere that needs to run a backtest:

    from backtest import run_backtest, BacktestSpec
    result = run_backtest(BacktestSpec(symbol="SPY", start="2010-01-01", ...))

The same call is wired into:
  • REST endpoint   POST /api/backtest/run        (routers/backtest.py)
  • Agent tool      adk_agents/tools/backtest_tools.py
  • Strategy Flow   (Phase E will bind the node-graph compiler to this entry)

The point is that there is exactly one path that produces metrics + a saved
equity-curve plot. No more "which engine did this number come from?"
"""
from .schema import BacktestSpec, BacktestResult
from .engine import run_backtest, available_strategies

__all__ = ["BacktestSpec", "BacktestResult", "run_backtest", "available_strategies"]
