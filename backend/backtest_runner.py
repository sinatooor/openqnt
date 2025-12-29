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

# Import Nautilus adapter
try:
    # Try importing as backend module (when run from root)
    from backend.nautilus_adapter import run_nautilus_backtest, NAUTILUS_INSTALLED
except ImportError:
    try:
        # Fallback for local run
        from nautilus_adapter import run_nautilus_backtest, NAUTILUS_INSTALLED
    except ImportError:
        NAUTILUS_INSTALLED = False
        def run_nautilus_backtest(*args, **kwargs):
            return {"success": False, "error": "NautilusAdapter import failed", "fallback": True}

# Adjust these imports as needed based on execution context
try:
    from backend.sample_data import generate_ohlcv_data
    from backend.ig_client import IGClient, get_epic_for_symbol
except ImportError:
    from sample_data import generate_ohlcv_data
    from ig_client import IGClient, get_epic_for_symbol


async def fetch_real_data_from_ig(
    ig_client: IGClient,
    symbol: str,
    start_date: str,
    end_date: str,
    resolution: str = "HOUR"
) -> pd.DataFrame:
    """
    Fetch real historical data from IG API.
    
    Returns pandas DataFrame with OHLCV data.
    """
    epic = get_epic_for_symbol(symbol)
    if not epic:
        raise ValueError(f"Unknown symbol: {symbol}. Use one of {list(get_epic_for_symbol.__globals__.get('MARKET_EPICS', {}).keys())}")
    
    # Format dates for IG API
    start_dt = f"{start_date}T00:00:00"
    end_dt = f"{end_date}T23:59:59"
    
    result = await ig_client.get_historical_prices(
        epic=epic,
        resolution=resolution,
        start_date=start_dt,
        end_date=end_dt
    )
    
    if not result.get("success"):
        raise Exception(f"Failed to fetch data: {result.get('error')}")
    
    prices = result.get("prices", [])
    if not prices:
        raise Exception("No price data returned from IG")
    
    # Convert to DataFrame
    df = pd.DataFrame(prices)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['symbol'] = symbol
    
    print(f"Fetched {len(df)} bars from IG for {symbol}")
    return df


def run_backtest_simple(
    strategy_code: str,
    symbol: str = "EURUSD",
    start_date: str = "2024-01-01",
    end_date: str = "2024-03-31",
    initial_balance: float = 100000.0,
    trade_size: int = 100000,
    historical_data: pd.DataFrame = None
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
        historical_data: Optional pre-fetched historical data (uses synthetic if None)
    
    Returns:
        Dict with backtest results
    """
    print(f"Running simplified backtest for {symbol}")
    
    # Use provided historical data or generate synthetic
    if historical_data is not None:
        data = historical_data.copy()
        print(f"Using real historical data: {len(data)} bars")
    else:
        data = generate_ohlcv_data(symbol, start_date, end_date, timeframe_minutes=60)
        print(f"Using synthetic data: {len(data)} bars")
    
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
    entry_time = None
    
    for idx, row in trades.iterrows():
        if row['position_change'] > 0 and position <= 0:
            # Enter long
            if position < 0:
                # Close short (calculate P&L)
                pnl = (entry_price - row['close']) * trade_size
                trade_list.append({
                    'entry_time': entry_time.isoformat() if hasattr(entry_time, 'isoformat') else str(entry_time),
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


def run_backtest(
    strategy_code: str,
    symbol: str = "EURUSD",
    start_date: str = "2024-01-01", 
    end_date: str = "2024-03-31",
    initial_balance: float = 100000.0,
    trade_size: int = 100000,
    use_nautilus: bool = True,
    historical_data: pd.DataFrame = None
) -> dict:
    """
    Main entry point for running backtests.
    
    Tries NautilusTrader first if requested, falls back to simplified simulation.
    
    Args:
        historical_data: Optional DataFrame with real OHLCV data from IG
    """
    if use_nautilus and NAUTILUS_INSTALLED:
        # Prepare data if not provided
        if historical_data is None:
             historical_data = generate_ohlcv_data(symbol, start_date, end_date, timeframe_minutes=60)

        result = run_nautilus_backtest(
            strategy_code=strategy_code,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            initial_balance=initial_balance,
            historical_data=historical_data
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
        trade_size=trade_size,
        historical_data=historical_data
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
