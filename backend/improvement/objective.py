"""
Improvement objective — what "better" means.

`default_objective()` is **Sharpe with a max-drawdown brake**: the
score is `sharpe - dd_penalty * max(0, max_dd_pct - dd_budget) / 100`.
A candidate that holds drawdown at or below the seed's drawdown gets
no penalty; one that worsens it pays Sharpe-equivalent points.

Why this objective by default:
  - Sharpe is the most common single-number summary.
  - Free-running Sharpe optimisation famously over-fits leverage and
    blows the drawdown budget. The brake keeps the search honest by
    refusing to "trade DD for Sharpe" past a tolerance.

`objective_from_name(name)` is a tiny registry so callers (REST,
agents) can pick a different objective by string. Today we ship two:

    "sharpe_dd_penalised"  — default
    "sharpe"               — raw Sharpe, no brake (testing only)

The validation window is part of the Objective so the runner re-scores
the chosen winner on out-of-sample data automatically.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional


@dataclass
class Objective:
    name: str
    score: Callable[[dict], float]
    description: str = ""
    higher_is_better: bool = True
    # Optional out-of-sample window. If both are set, the runner re-runs
    # the chosen winner with `start=validation_start, end=validation_end`
    # so we can compare in-sample vs out-of-sample metrics honestly.
    validation_start: Optional[str] = None
    validation_end: Optional[str] = None

    def render(self, metrics: dict) -> float:
        try:
            return float(self.score(metrics))
        except Exception:
            return float("-inf") if self.higher_is_better else float("inf")


def default_objective(
    dd_budget_pct: float = 20.0,
    dd_penalty: float = 5.0,
    min_trades: int = 5,
    no_trade_floor: float = -1.0,
    validation_start: Optional[str] = None,
    validation_end: Optional[str] = None,
) -> Objective:
    """Sharpe with a soft drawdown brake + a minimum-trades guard.

    Without `min_trades`, the search converges on degenerate
    "no-trade" candidates: zero PnL → Sharpe is None → score floor at
    0, which beats any negative-Sharpe seed and is *technically*
    correct but useless. Setting a floor below 0 for low-trade-count
    candidates pushes the mutator back toward strategies that
    actually trade.
    """

    def _score(m: dict) -> float:
        n_trades = int(m.get("n_trades", 0) or 0)
        if n_trades < min_trades:
            # Constant negative score so the runner prefers any honest
            # losing strategy over a no-op.
            return no_trade_floor
        sharpe = float(m.get("sharpe", 0.0) or 0.0)
        dd = abs(float(m.get("max_drawdown_pct", 0.0) or 0.0))
        excess = max(0.0, dd - dd_budget_pct)
        return sharpe - dd_penalty * (excess / 100.0)

    return Objective(
        name="sharpe_dd_penalised",
        score=_score,
        description=(
            f"Sharpe with a {dd_budget_pct:.0f}% max-DD brake (penalty "
            f"{dd_penalty}× excess). Candidates with <{min_trades} trades "
            f"score {no_trade_floor:+.2f} so the search avoids no-op solutions."
        ),
        validation_start=validation_start,
        validation_end=validation_end,
    )


def _raw_sharpe() -> Objective:
    return Objective(
        name="sharpe",
        score=lambda m: float(m.get("sharpe", 0.0) or 0.0),
        description="Raw Sharpe ratio. No drawdown brake.",
    )


_REGISTRY: dict[str, Callable[[], Objective]] = {
    "sharpe_dd_penalised": default_objective,
    "sharpe": _raw_sharpe,
}


def objective_from_name(name: str) -> Objective:
    if name not in _REGISTRY:
        raise KeyError(f"unknown objective '{name}' (have: {sorted(_REGISTRY)})")
    return _REGISTRY[name]()
