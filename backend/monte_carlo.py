"""
Monte Carlo Simulator

Performs Monte Carlo analysis on backtest results to assess strategy robustness.
Reshuffles trade sequences to generate probability distributions for drawdown and return.
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from ir_simulator import SimulationResult

@dataclass
class MonteCarloResult:
    iterations: int
    drawdown_distribution: Dict[str, float]  # 5%, 50%, 95%
    return_distribution: Dict[str, float]    # 5%, 50%, 95%
    simulated_drawdowns: List[float]
    simulated_returns: List[float]
    confidence_intervals: Dict[str, Dict[str, float]] # Structured for easy access

class MonteCarloSimulator:
    def __init__(self, iterations: int = 1000):
        self.iterations = iterations

    def run(self, result: SimulationResult) -> MonteCarloResult:
        """
        Runs Monte Carlo simulation on the provided backtest result.
        """
        trades = result.trades
        if not trades:
            return self._create_empty_result()

        # Extract PnL sequence
        pnls = [t.pnl for t in trades]
        initial_equity = result.initial_equity

        sim_drawdowns = []
        sim_returns = []

        # Convert to numpy array for speed
        pnls_array = np.array(pnls)

        for _ in range(self.iterations):
            # Shuffle PnLs
            shuffled_pnls = np.random.permutation(pnls_array)
            
            # Calculate Equity Curve
            # cumsum gives the cumulative PnL. Add initial equity to get equity curve.
            equity_curve = initial_equity + np.cumsum(shuffled_pnls)
            
            # Prepend initial equity to handle drawdown calculation correctly from start
            equity_curve = np.insert(equity_curve, 0, initial_equity)
            
            # Calculate Max Drawdown
            # accumulate max gives running peak
            peaks = np.maximum.accumulate(equity_curve)
            # Avoid division by zero
            peaks[peaks == 0] = 1.0 
            
            drawdowns = (peaks - equity_curve) / peaks
            max_dd = np.max(drawdowns) * 100 # percentage
            
            # Calculate Return
            final_equity = equity_curve[-1]
            total_return = ((final_equity - initial_equity) / initial_equity) * 100
            
            sim_drawdowns.append(max_dd)
            sim_returns.append(total_return)

        # Calculate Percentiles
        dd_percentiles = np.percentile(sim_drawdowns, [5, 50, 95])
        ret_percentiles = np.percentile(sim_returns, [5, 50, 95])

        return MonteCarloResult(
            iterations=self.iterations,
            drawdown_distribution={
                "p05": dd_percentiles[0],
                "p50": dd_percentiles[1],
                "p95": dd_percentiles[2]
            },
            return_distribution={
                "p05": ret_percentiles[0],
                "p50": ret_percentiles[1],
                "p95": ret_percentiles[2]
            },
            simulated_drawdowns=sim_drawdowns,
            simulated_returns=sim_returns,
            confidence_intervals={
                "drawdown": {
                    "best_case_5pct": dd_percentiles[0],
                    "median": dd_percentiles[1],
                    "worst_case_95pct": dd_percentiles[2]
                },
                "return": {
                    "worst_case_5pct": ret_percentiles[0],
                    "median": ret_percentiles[1],
                    "best_case_95pct": ret_percentiles[2]
                }
            }
        )

    def _create_empty_result(self) -> MonteCarloResult:
        return MonteCarloResult(
            iterations=self.iterations,
            drawdown_distribution={"p05": 0.0, "p50": 0.0, "p95": 0.0},
            return_distribution={"p05": 0.0, "p50": 0.0, "p95": 0.0},
            simulated_drawdowns=[],
            simulated_returns=[],
            confidence_intervals={
                "drawdown": {"best_case_5pct": 0.0, "median": 0.0, "worst_case_95pct": 0.0},
                "return": {"worst_case_5pct": 0.0, "median": 0.0, "best_case_95pct": 0.0}
            }
        )
