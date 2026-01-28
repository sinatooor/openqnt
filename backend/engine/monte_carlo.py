"""Monte Carlo simulation for backtest results."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


@dataclass
class MonteCarloReport:
    iterations: int
    method: str
    final_equity_dist: Dict[str, float]
    max_drawdown_dist: Dict[str, float]
    monthly_return_dist: Dict[str, float]
    risk_of_ruin: float
    series: Dict[str, List[float]]


def run_monte_carlo(
    equity_curve: List[Dict[str, Any]],
    trades: List[Dict[str, Any]],
    iterations: int = 1000,
    method: str = "trade_shuffle",
    ruin_threshold: float = 0.5,
    seed: Optional[int] = None,
) -> MonteCarloReport:
    rng = np.random.default_rng(seed)
    if not equity_curve:
        return MonteCarloReport(
            iterations=iterations,
            method=method,
            final_equity_dist={"p05": 0, "p50": 0, "p95": 0},
            max_drawdown_dist={"p05": 0, "p50": 0, "p95": 0},
            monthly_return_dist={"p05": 0, "p50": 0, "p95": 0},
            risk_of_ruin=0.0,
            series={"final_equity": [], "max_drawdown": [], "monthly_returns": []},
        )

    equity_df = pd.DataFrame(equity_curve)
    equity_df["timestamp"] = pd.to_datetime(equity_df["timestamp"])
    equity_df = equity_df.set_index("timestamp")

    initial_equity = float(equity_df["equity"].iloc[0])
    returns = equity_df["equity"].pct_change().dropna().to_numpy()
    trade_pnls = np.array([t.get("pnl", 0.0) for t in trades], dtype=float)

    final_equity_list: List[float] = []
    max_dd_list: List[float] = []
    monthly_return_list: List[float] = []

    for _ in range(iterations):
        if method == "return_bootstrap":
            sampled = rng.choice(returns, size=len(returns), replace=True)
            equity_path = initial_equity * np.cumprod(1 + sampled)
        else:
            shuffled = rng.permutation(trade_pnls) if len(trade_pnls) > 0 else np.array([0.0])
            equity_path = initial_equity + np.cumsum(shuffled)

        peaks = np.maximum.accumulate(equity_path)
        drawdowns = (peaks - equity_path) / np.maximum(peaks, 1e-9)
        max_dd_list.append(float(np.max(drawdowns) * 100))
        final_equity_list.append(float(equity_path[-1]))

        # Monthly returns approximation
        if len(sampled := returns) > 0:
            monthly_return_list.append(float(rng.choice(sampled)))

    ruin_count = sum(1 for eq in final_equity_list if eq <= initial_equity * ruin_threshold)
    risk_of_ruin = ruin_count / max(iterations, 1)

    def _percentiles(values: List[float]) -> Dict[str, float]:
        if not values:
            return {"p05": 0.0, "p50": 0.0, "p95": 0.0}
        p = np.percentile(values, [5, 50, 95])
        return {"p05": float(p[0]), "p50": float(p[1]), "p95": float(p[2])}

    return MonteCarloReport(
        iterations=iterations,
        method=method,
        final_equity_dist=_percentiles(final_equity_list),
        max_drawdown_dist=_percentiles(max_dd_list),
        monthly_return_dist=_percentiles(monthly_return_list),
        risk_of_ruin=risk_of_ruin,
        series={
            "final_equity": final_equity_list,
            "max_drawdown": max_dd_list,
            "monthly_returns": monthly_return_list,
        },
    )
