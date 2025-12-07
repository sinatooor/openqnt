"""
Backtest Runner

Executes backtests using NautilusTrader engine.
"""

import os
import sys
import tempfile
import traceback
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

import pandas as pd
import numpy as np

# NautilusTrader imports will be conditional
NAUTILUS_AVAILABLE = False
try:
    from nautilus_trader.backtest.engine import BacktestEngine
    from nautilus_trader.backtest.config import BacktestEngineConfig
    from nautilus_trader.model.currencies import USD
    from nautilus_trader.model.enums import AccountType, OmsType
    from nautilus_trader.model.identifiers import TraderId, Venue
    from nautilus_trader.model.objects import Money
    from nautilus_trader.test_kit.providers import TestInstrumentProvider
    NAUTILUS_AVAILABLE = True
except ImportError:
    pass

from sample_data import generate_ohlcv_data


def run_backtest_simple(
    strategy_code: str,
    symbol: str = "EURUSD",
    start_date: str = "2024-01-01",
    end_date: str = "2024-03-31",
    initial_balance: float = 100000.0,
    trade_size: int = 100000
) -> dict:
    """
    Run a simplified backtest without full NautilusTrader engine.
    
    This is a fallback that simulates basic strategy logic for demonstration.
    
    Args:
        strategy_code: Python strategy code (for logging/debugging)
        symbol: Trading symbol
        start_date: Backtest start date
        end_date: Backtest end date
        initial_balance: Starting account balance
        trade_size: Trade size in units
    
    Returns:
        Dict with backtest results
    """
    print(f"Running simplified backtest for {symbol}")
    
    # Generate sample data
    data = generate_ohlcv_data(symbol, start_date, end_date, timeframe_minutes=60)
    
    # Simple SMA crossover simulation
    data['sma_fast'] = data['close'].rolling(window=10).mean()
    data['sma_slow'] = data['close'].rolling(window=20).mean()
    
    # Generate signals
    data['signal'] = 0
    data.loc[data['sma_fast'] > data['sma_slow'], 'signal'] = 1  # Long
    data.loc[data['sma_fast'] < data['sma_slow'], 'signal'] = -1  # Short
    
    # Calculate returns
    data['returns'] = data['close'].pct_change()
    data['strategy_returns'] = data['signal'].shift(1) * data['returns']
    
    # Remove NaN rows
    data = data.dropna()
    
    # Calculate equity curve
    data['equity'] = initial_balance * (1 + data['strategy_returns']).cumprod()
    
    # Calculate trades
    data['position_change'] = data['signal'].diff()
    trades = data[data['position_change'] != 0].copy()
    
    # Calculate trade P&L
    trade_list = []
    position = 0
    entry_price = 0
    
    for idx, row in trades.iterrows():
        if row['position_change'] > 0 and position <= 0:
            # Enter long
            if position < 0:
                # Close short (calculate P&L)
                pnl = (entry_price - row['close']) * trade_size
                trade_list.append({
                    'entry_time': entry_time.isoformat() if 'entry_time' in dir() else str(idx),
                    'exit_time': row['timestamp'].isoformat() if hasattr(row['timestamp'], 'isoformat') else str(idx),
                    'side': 'short',
                    'entry_price': entry_price,
                    'exit_price': row['close'],
                    'pnl': round(pnl, 2),
                    'size': trade_size
                })
            entry_price = row['close']
            entry_time = row['timestamp']
            position = 1
        elif row['position_change'] < 0 and position >= 0:
            # Enter short
            if position > 0:
                # Close long (calculate P&L)
                pnl = (row['close'] - entry_price) * trade_size
                trade_list.append({
                    'entry_time': entry_time.isoformat() if hasattr(entry_time, 'isoformat') else str(entry_time),
                    'exit_time': row['timestamp'].isoformat() if hasattr(row['timestamp'], 'isoformat') else str(idx),
                    'side': 'long',
                    'entry_price': entry_price,
                    'exit_price': row['close'],
                    'pnl': round(pnl, 2),
                    'size': trade_size
                })
            entry_price = row['close']
            entry_time = row['timestamp']
            position = -1
    
    # Calculate metrics
    total_trades = len(trade_list)
    if total_trades > 0:
        winning_trades = [t for t in trade_list if t['pnl'] > 0]
        losing_trades = [t for t in trade_list if t['pnl'] < 0]
        
        win_rate = len(winning_trades) / total_trades * 100
        total_pnl = sum(t['pnl'] for t in trade_list)
        
        avg_win = np.mean([t['pnl'] for t in winning_trades]) if winning_trades else 0
        avg_loss = abs(np.mean([t['pnl'] for t in losing_trades])) if losing_trades else 0
        
        profit_factor = abs(sum(t['pnl'] for t in winning_trades)) / abs(sum(t['pnl'] for t in losing_trades)) if losing_trades else float('inf')
        
        # Calculate max drawdown
        equity_series = data['equity'].values
        peak = equity_series[0]
        max_dd = 0
        for eq in equity_series:
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak * 100
            if dd > max_dd:
                max_dd = dd
        
        # Calculate Sharpe ratio (assuming 252 trading days)
        if len(data['strategy_returns']) > 1:
            sharpe = np.sqrt(252) * data['strategy_returns'].mean() / data['strategy_returns'].std()
        else:
            sharpe = 0
    else:
        win_rate = 0
        total_pnl = 0
        avg_win = 0
        avg_loss = 0
        profit_factor = 0
        max_dd = 0
        sharpe = 0
    
    # Prepare equity curve (sample every 24 bars for chart)
    equity_curve = []
    step = max(1, len(data) // 100)  # Max 100 points
    for i in range(0, len(data), step):
        row = data.iloc[i]
        equity_curve.append({
            'timestamp': row['timestamp'].isoformat() if hasattr(row['timestamp'], 'isoformat') else str(row['timestamp']),
            'equity': round(row['equity'], 2)
        })
    
    return {
        'success': True,
        'symbol': symbol,
        'start_date': start_date,
        'end_date': end_date,
        'initial_balance': initial_balance,
        'final_balance': round(data['equity'].iloc[-1], 2) if len(data) > 0 else initial_balance,
        'metrics': {
            'total_trades': total_trades,
            'winning_trades': len([t for t in trade_list if t['pnl'] > 0]),
            'losing_trades': len([t for t in trade_list if t['pnl'] < 0]),
            'win_rate': round(win_rate, 2),
            'total_pnl': round(total_pnl, 2),
            'profit_factor': round(profit_factor, 2) if profit_factor != float('inf') else 999.99,
            'max_drawdown': round(max_dd, 2),
            'sharpe_ratio': round(sharpe, 2),
            'avg_win': round(avg_win, 2),
            'avg_loss': round(avg_loss, 2)
        },
        'trades': trade_list[:50],  # Limit to 50 trades for response size
        'equity_curve': equity_curve
    }


def run_backtest_nautilus(
    strategy_code: str,
    symbol: str = "EURUSD",
    start_date: str = "2024-01-01",
    end_date: str = "2024-03-31",
    initial_balance: float = 100000.0
) -> dict:
    """
    Run backtest using full NautilusTrader engine.
    
    This requires nautilus_trader to be properly installed.
    """
    if not NAUTILUS_AVAILABLE:
        return {
            'success': False,
            'error': 'NautilusTrader not available. Using simplified backtest.',
            'fallback': True
        }
    
    try:
        # Configure backtest engine
        config = BacktestEngineConfig(trader_id=TraderId("BACKTESTER-001"))
        engine = BacktestEngine(config=config)
        
        # Add venue
        SIM_VENUE = Venue("SIM")
        engine.add_venue(
            venue=SIM_VENUE,
            oms_type=OmsType.NETTING,
            account_type=AccountType.MARGIN,
            base_currency=USD,
            starting_balances=[Money(initial_balance, USD)],
        )
        
        # This would require more setup for full integration
        # For now, return a placeholder
        return {
            'success': False,
            'error': 'Full NautilusTrader backtest requires additional setup',
            'fallback': True
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc(),
            'fallback': True
        }


def run_backtest(
    strategy_code: str,
    symbol: str = "EURUSD",
    start_date: str = "2024-01-01", 
    end_date: str = "2024-03-31",
    initial_balance: float = 100000.0,
    trade_size: int = 100000,
    use_nautilus: bool = False
) -> dict:
    """
    Main entry point for running backtests.
    
    Tries NautilusTrader first, falls back to simplified simulation.
    """
    if use_nautilus and NAUTILUS_AVAILABLE:
        result = run_backtest_nautilus(
            strategy_code=strategy_code,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            initial_balance=initial_balance
        )
        if result.get('success') or not result.get('fallback'):
            return result
    
    # Use simplified backtest
    return run_backtest_simple(
        strategy_code=strategy_code,
        symbol=symbol,
        start_date=start_date,
        end_date=end_date,
        initial_balance=initial_balance,
        trade_size=trade_size
    )


if __name__ == "__main__":
    # Test backtest runner
    result = run_backtest(
        strategy_code="# Test strategy",
        symbol="EURUSD",
        start_date="2024-01-01",
        end_date="2024-03-31"
    )
    
    print("\n=== BACKTEST RESULTS ===")
    print(f"Symbol: {result['symbol']}")
    print(f"Period: {result['start_date']} to {result['end_date']}")
    print(f"\nMetrics:")
    for key, value in result['metrics'].items():
        print(f"  {key}: {value}")
    print(f"\nTrades: {len(result['trades'])}")
    print(f"Equity points: {len(result['equity_curve'])}")
