"""
Walkforward Validation Module

Implements walkforward analysis for trading strategies.
Splits data into in-sample and out-of-sample windows,
running the strategy on each to assess robustness and detect overfitting.
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass
from backend.backtest_engine import BacktestEngine, BacktestRequest, BacktestResult
from backend.strategy_ir import StrategyIR

@dataclass
class WalkforwardConfig:
    """Configuration for Walkforward Analysis"""
    train_window: int = 100     # Number of bars for In-Sample (Optimization/Training)
    test_window: int = 20       # Number of bars for Out-of-Sample (Validation)
    step_size: int = 20         # Number of bars to shift forward for next window
    anchored: bool = False      # If True, start of train window is fixed (growing window)

@dataclass
class WalkforwardResult:
    """Results of Walkforward Analysis"""
    windows: List[Dict[str, Any]]
    aggregate_metrics: Dict[str, Any]
    degradation_score: float # Average OOS/IS Performance Ratio

class WalkforwardValidator:
    def __init__(self, engine: Optional[BacktestEngine] = None):
        # Use existing engine or create new one
        self.engine = engine if engine else BacktestEngine()

    def validate(
        self,
        strategy: StrategyIR,
        data: pd.DataFrame,
        config: WalkforwardConfig,
        metric: str = 'sharpe_ratio',
        optimize_fn: Optional[Callable[[StrategyIR, pd.DataFrame], StrategyIR]] = None
    ) -> WalkforwardResult:
        """
        Performs walkforward validation on the provided strategy and data.

        Args:
            strategy: The base strategy to validate.
            data: DataFrame containing OHLCV data.
            config: Window configuration.
            metric: The primary metric to use for degradation calculation (default: 'sharpe_ratio').
            optimize_fn: Optional callback to optimize strategy on In-Sample data.
                         Signature: (strategy, train_data) -> optimized_strategy

        Returns:
            WalkforwardResult containing detailed and aggregated metrics.
        """
        n_bars = len(data)
        required_bars = config.train_window + config.test_window
        
        if n_bars < required_bars:
            raise ValueError(f"Data length ({n_bars}) insufficient for window config (min {required_bars}).")

        windows = []
        current_idx = 0
        
        # Loop until we cannot form a full test window
        while current_idx + config.train_window + config.test_window <= n_bars:
            # Define indices
            train_start = 0 if config.anchored else current_idx
            train_end = train_start + config.train_window if config.anchored else current_idx + config.train_window
            
            test_start = train_end
            test_end = test_start + config.test_window
            
            # Slice Data
            train_data = data.iloc[train_start:train_end].copy()
            test_data = data.iloc[test_start:test_end].copy()
            
            # Identify period labels
            # Ensure index is string-friendly
            train_period_lbl = f"{train_data.index[0]} to {train_data.index[-1]}"
            test_period_lbl = f"{test_data.index[0]} to {test_data.index[-1]}"

            # Optimize (Optional)
            current_strategy = strategy
            if optimize_fn:
                current_strategy = optimize_fn(strategy, train_data)

            # Run In-Sample Backtest
            is_req = BacktestRequest(
                strategy=current_strategy,
                symbol="IS_WINDOW",
                start_date=str(train_data.index[0]),
                end_date=str(train_data.index[-1]),
                data=train_data,
                initial_equity=10000.0,
                timeframe_minutes=60 # Assumption, or derive from data
            )
            is_res = self.engine.run_backtest(is_req)
            
            # Run Out-of-Sample Backtest
            oos_req = BacktestRequest(
                strategy=current_strategy,
                symbol="OOS_WINDOW",
                start_date=str(test_data.index[0]),
                end_date=str(test_data.index[-1]),
                data=test_data,
                initial_equity=10000.0, # Reset equity to compare pure performance
                timeframe_minutes=60
            )
            oos_res = self.engine.run_backtest(oos_req)

            # Store Result
            window_res = {
                'window_index': len(windows),
                'train_period': train_period_lbl,
                'test_period': test_period_lbl,
                'is_metrics': is_res.metrics,
                'oos_metrics': oos_res.metrics,
                # 'optimized_params': ... if we tracked them
            }
            windows.append(window_res)
            
            # Move forward
            current_idx += config.step_size

        # Aggregate Results
        agg = self._aggregate_results(windows, metric)
        
        return WalkforwardResult(
            windows=windows,
            aggregate_metrics=agg['aggregate'],
            degradation_score=agg['degradation']
        )

    def _aggregate_results(self, windows: List[Dict], metric: str) -> Dict[str, Any]:
        if not windows:
            return {'aggregate': {}, 'degradation': 0.0}

        # Extract metrics safely
        is_vals = [w['is_metrics'].get(metric, 0.0) for w in windows]
        oos_vals = [w['oos_metrics'].get(metric, 0.0) for w in windows]
        
        avg_is = np.mean(is_vals) if is_vals else 0.0
        avg_oos = np.mean(oos_vals) if oos_vals else 0.0
        
        # Calculate consistency/degradation
        # Degradation Score: OOS / IS. 
        # Ideally should be close to 1.0. < 0.5 is bad. > 1.0 is lucky or regime shift.
        
        degradation = 0.0
        if avg_is != 0:
            degradation = avg_oos / avg_is
        
        aggregate = {
            f'avg_is_{metric}': float(avg_is),
            f'avg_oos_{metric}': float(avg_oos),
            'windows_count': len(windows),
            'positive_oos_count': sum(1 for v in oos_vals if v > 0),
            'win_rate_oos': (sum(1 for v in oos_vals if v > 0) / len(windows)) * 100
        }
        
        return {
            'aggregate': aggregate,
            'degradation': float(degradation)
        }
