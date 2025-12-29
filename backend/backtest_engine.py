"""
Backtest Engine

Orchestrates backtesting using the IRSimulator.
Supports multiple date ranges, strategy comparison, and data management.
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Union
from dataclasses import dataclass
from datetime import datetime
import json
import sys
import os

from backend.ir_simulator import IRSimulator, SimulationResult, Trade
from backend.strategy_ir import StrategyIR, Rule, Condition, ActionType, MarketComponent, ComparisonOperator, PositionSizing
from backend.sample_data import generate_ohlcv_data
from backend.data_service import MarketDataService

@dataclass
class BacktestRequest:
    strategy: StrategyIR
    symbol: str
    start_date: str
    end_date: str
    initial_equity: float = 10000.0
    timeframe_minutes: int = 60
    data: Optional[pd.DataFrame] = None

@dataclass
class BacktestResult:
    request: BacktestRequest
    simulation_result: SimulationResult
    metrics: Dict[str, Any]

class BacktestEngine:
    def __init__(self):
        self.simulator = IRSimulator()
        # Initialize Data Service
        api_key = os.getenv("FMP_API_KEY")
        self.data_service = MarketDataService(fmp_api_key=api_key)

    def run_backtest(self, request: BacktestRequest) -> BacktestResult:
        """
        Run a single backtest for a strategy over a specific period.
        """
        # 1. Get Data
        if request.data is not None:
            data = request.data.copy()
        else:
            # Determine timeframe string for service
            if request.timeframe_minutes >= 1440:
                tf_str = "1d"
            else:
                tf_str = "1h"
                
            try:
                # Try fetching real data with caching
                data = self.data_service.get_data(
                    symbol=request.symbol,
                    start_date=request.start_date,
                    end_date=request.end_date,
                    timeframe=tf_str
                )
                
                if data.empty:
                    print(f"Warning: No data found for {request.symbol}, falling back to synthetic.")
                    data = generate_ohlcv_data(
                        symbol=request.symbol,
                        start_date=request.start_date,
                        end_date=request.end_date,
                        timeframe_minutes=request.timeframe_minutes
                    )
            except Exception as e:
                print(f"Error fetching data: {e}, falling back to synthetic.")
                data = generate_ohlcv_data(
                    symbol=request.symbol,
                    start_date=request.start_date,
                    end_date=request.end_date,
                    timeframe_minutes=request.timeframe_minutes
                )

        # 2. Run Simulation
        self.simulator.initial_equity = request.initial_equity
        sim_result = self.simulator.run(request.strategy, data)
        
        # 3. Calculate Extended Metrics
        metrics = self._calculate_metrics(sim_result)
        
        return BacktestResult(
            request=request,
            simulation_result=sim_result,
            metrics=metrics
        )

    def compare_strategies(
        self, 
        strategies: List[StrategyIR], 
        symbol: str, 
        start_date: str, 
        end_date: str,
        initial_equity: float = 10000.0
    ) -> pd.DataFrame:
        """
        Run backtests for multiple strategies on the same data and compare results.
        Returns a DataFrame of metrics.
        """
        # Fetch data once
        try:
            data = self.data_service.get_data(symbol, start_date, end_date)
            if data.empty:
                 data = generate_ohlcv_data(symbol=symbol, start_date=start_date, end_date=end_date)
        except:
            data = generate_ohlcv_data(symbol=symbol, start_date=start_date, end_date=end_date)
        
        results = []
        for strategy in strategies:
            req = BacktestRequest(
                strategy=strategy,
                symbol=symbol,
                start_date=start_date,
                end_date=end_date,
                initial_equity=initial_equity,
                data=data
            )
            res = self.run_backtest(req)
            
            row = res.metrics.copy()
            row['strategy_name'] = strategy.name
            results.append(row)
            
        return pd.DataFrame(results).set_index('strategy_name')

    def run_multi_period(
        self,
        strategy: StrategyIR,
        symbol: str,
        periods: List[Dict[str, str]], # [{'start': '...', 'end': '...'}, ...]
        initial_equity: float = 10000.0
    ) -> pd.DataFrame:
        """
        Run backtest for one strategy over multiple distinct periods.
        """
        results = []
        for period in periods:
            req = BacktestRequest(
                strategy=strategy,
                symbol=symbol,
                start_date=period['start'],
                end_date=period['end'],
                initial_equity=initial_equity
            )
            res = self.run_backtest(req)
            
            row = res.metrics.copy()
            row['period'] = f"{period['start']} to {period['end']}"
            results.append(row)
            
        return pd.DataFrame(results).set_index('period')

    def _calculate_metrics(self, sim_result: SimulationResult) -> Dict[str, Any]:
        """
        Calculate standard performance metrics.
        """
        trades = sim_result.trades
        equity_curve = sim_result.equity_curve
        
        total_trades = len(trades)
        if total_trades == 0:
            return {
                'return_pct': 0.0,
                'total_trades': 0,
                'win_rate': 0.0,
                'profit_factor': 0.0,
                'max_drawdown': 0.0,
                'sharpe_ratio': 0.0,
                'final_equity': sim_result.initial_equity
            }
            
        winning_trades = [t for t in trades if t.pnl > 0]
        losing_trades = [t for t in trades if t.pnl <= 0]
        
        win_rate = (len(winning_trades) / total_trades) * 100
        
        gross_profit = sum(t.pnl for t in winning_trades)
        gross_loss = abs(sum(t.pnl for t in losing_trades))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')
        
        # Max Drawdown
        if not equity_curve.empty:
            peaks = equity_curve['equity'].cummax()
            drawdowns = (peaks - equity_curve['equity']) / peaks
            max_drawdown = drawdowns.max() * 100
        else:
            max_drawdown = 0.0
            
        # Return
        return_pct = (sim_result.final_equity - sim_result.initial_equity) / sim_result.initial_equity * 100

        # Sharpe (simplified)
        # Using daily returns approximation if we have equity curve
        sharpe = 0.0
        if not equity_curve.empty:
            # Resample to daily to calculate standard sharpe
            if not isinstance(equity_curve.index, pd.DatetimeIndex):
                equity_curve.index = pd.to_datetime(equity_curve.index)
                
            daily_equity = equity_curve['equity'].resample('D').last().dropna()
            if len(daily_equity) > 1:
                daily_returns = daily_equity.pct_change().dropna()
                if daily_returns.std() > 0:
                    sharpe = np.sqrt(252) * (daily_returns.mean() / daily_returns.std())

        return {
            'return_pct': round(return_pct, 2),
            'total_trades': total_trades,
            'win_rate': round(win_rate, 2),
            'profit_factor': round(profit_factor, 2),
            'max_drawdown': round(max_drawdown, 2),
            'sharpe_ratio': round(sharpe, 2),
            'final_equity': round(sim_result.final_equity, 2)
        }

def create_sample_strategy() -> StrategyIR:
    """Creates a simple SMA Crossover strategy for testing."""
    # Fast SMA
    sma_fast = MarketComponent(type="SMA", params={'period': 10, 'source': 'close'})
    # Slow SMA
    sma_slow = MarketComponent(type="SMA", params={'period': 20, 'source': 'close'})
    
    # Rule 1: Enter Long if Fast > Slow
    rule_enter = Rule(
        action=ActionType.ENTER_LONG,
        conditions=[
            Condition(left=sma_fast, operator=ComparisonOperator.GT, right=sma_slow)
        ]
    )
    
    # Rule 2: Exit Long if Fast < Slow
    rule_exit = Rule(
        action=ActionType.EXIT_LONG,
        conditions=[
            Condition(left=sma_fast, operator=ComparisonOperator.LT, right=sma_slow)
        ]
    )
    
    return StrategyIR(
        name="SMA_Crossover_10_20",
        rules=[rule_enter, rule_exit],
        position_sizing=PositionSizing(method="percent_equity", value=0.1)
    )

if __name__ == "__main__":
    print("=== Backtest Engine CLI ===")
    
    engine = BacktestEngine()
    
    # Create a sample strategy
    strategy = create_sample_strategy()
    print(f"Loaded Strategy: {strategy.name}")
    
    # Run backtest
    print("\nRunning backtest for EURUSD (2024-01-01 to 2024-06-30)...")
    req = BacktestRequest(
        strategy=strategy,
        symbol="EURUSD",
        start_date="2024-01-01",
        end_date="2024-06-30"
    )
    
    result = engine.run_backtest(req)
    
    print("\n--- Results ---")
    for k, v in result.metrics.items():
        print(f"{k}: {v}")
        
    print(f"\nExecuted {len(result.simulation_result.trades)} trades.")
