"""
Standardized request/result types for the canonical backtest entrypoint.

Everything that calls `run_backtest()` — REST, agents, the node-graph
compiler — speaks this exact shape. Adding a metric? Add it here once and
every consumer gets it.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Optional


@dataclass
class BacktestSpec:
    """Everything needed to reproduce a backtest run."""

    # ── data ──
    symbol: str = "SPY"
    start: str = "2020-01-01"
    end: str = "2024-12-31"
    interval: str = "1d"             # yfinance interval

    # ── account ──
    initial_cash: float = 10_000.0
    commission: float = 0.002        # fraction (0.002 == 0.2%)

    # ── strategy ──
    # Pre-built names live in `builtins.STRATEGIES`. "custom" requires `code`.
    strategy: str = "sma_crossover"
    params: dict[str, Any] = field(default_factory=dict)
    code: Optional[str] = None       # raw `backtesting.py` Strategy subclass

    # ── output ──
    save_artifacts: bool = True      # write PNG + result.json under runs/
    run_id: Optional[str] = None     # if provided, artifacts go under that run

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class BacktestResult:
    """Canonical result. Same shape from every caller."""

    success: bool
    spec: dict[str, Any]
    metrics: dict[str, float] = field(default_factory=dict)
    equity_curve: list[dict[str, Any]] = field(default_factory=list)
    trades: list[dict[str, Any]] = field(default_factory=list)
    plot_b64: Optional[str] = None        # data:image/png base64 of equity+dd
    plot_path: Optional[str] = None       # absolute path on disk if saved
    artifacts_dir: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


# Canonical metric names — kept here so every consumer can refer to them.
METRIC_KEYS = (
    "return_pct",
    "cagr_pct",
    "sharpe",
    "sortino",
    "calmar",
    "max_drawdown_pct",
    "win_rate_pct",
    "profit_factor",
    "n_trades",
    "exposure_pct",
    "final_equity",
    "buy_and_hold_pct",
)
