"""
Sample Data Generator for Backtesting

Generates synthetic market data for testing strategies.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional


def generate_ohlcv_data(
    symbol: str = "EURUSD",
    start_date: str = "2024-01-01",
    end_date: str = "2024-06-30",
    timeframe_minutes: int = 60,
    initial_price: float = 1.1000,
    volatility: float = 0.0005
) -> pd.DataFrame:
    """
    Generate synthetic OHLCV data for backtesting.
    
    Args:
        symbol: Trading symbol name
        start_date: Start date string (YYYY-MM-DD)
        end_date: End date string (YYYY-MM-DD)
        timeframe_minutes: Bar timeframe in minutes
        initial_price: Starting price
        volatility: Price volatility (standard deviation of returns)
    
    Returns:
        DataFrame with columns: timestamp, open, high, low, close, volume
    """
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    # Generate timestamps
    timestamps = []
    current = start
    while current <= end:
        # Skip weekends for Forex
        if current.weekday() < 5:
            timestamps.append(current)
        current += timedelta(minutes=timeframe_minutes)
    
    n_bars = len(timestamps)
    if n_bars == 0:
        raise ValueError("No data points generated for the given date range")
    
    # Generate price series with random walk
    np.random.seed(42)  # For reproducibility
    returns = np.random.normal(0, volatility, n_bars)
    
    # Add some trend and mean reversion
    trend = np.sin(np.linspace(0, 4 * np.pi, n_bars)) * volatility * 10
    returns += trend / n_bars
    
    prices = initial_price * np.cumprod(1 + returns)
    
    # Generate OHLCV from close prices
    data = []
    for i, ts in enumerate(timestamps):
        close = prices[i]
        # Generate realistic OHLC from close
        spread = abs(np.random.normal(0, volatility * 0.5))
        high = close + abs(np.random.normal(0, volatility * 0.3))
        low = close - abs(np.random.normal(0, volatility * 0.3))
        
        # Open is previous close with small gap
        if i > 0:
            open_price = prices[i-1] + np.random.normal(0, volatility * 0.1)
        else:
            open_price = close - np.random.normal(0, volatility * 0.2)
        
        # Ensure OHLC consistency
        high = max(open_price, close, high)
        low = min(open_price, close, low)
        
        data.append({
            "timestamp": ts,
            "symbol": symbol,
            "open": round(open_price, 5),
            "high": round(high, 5),
            "low": round(low, 5),
            "close": round(close, 5),
            "volume": np.random.randint(100, 10000)
        })
    
    return pd.DataFrame(data)


def generate_quote_ticks(
    symbol: str = "EURUSD",
    start_date: str = "2024-01-01",
    end_date: str = "2024-01-07",
    ticks_per_hour: int = 100,
    initial_price: float = 1.1000,
    spread_pips: float = 0.5
) -> pd.DataFrame:
    """
    Generate synthetic quote tick data.
    
    Args:
        symbol: Trading symbol
        start_date: Start date
        end_date: End date  
        ticks_per_hour: Number of ticks per hour
        initial_price: Starting price
        spread_pips: Bid-ask spread in pips
    
    Returns:
        DataFrame with columns: timestamp, bid, ask
    """
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    total_hours = int((end - start).total_seconds() / 3600)
    n_ticks = total_hours * ticks_per_hour
    
    np.random.seed(42)
    
    # Generate timestamps with irregular intervals
    timestamps = []
    current = start
    for _ in range(n_ticks):
        current += timedelta(seconds=np.random.randint(1, 60))
        if current > end:
            break
        if current.weekday() < 5:  # Skip weekends
            timestamps.append(current)
    
    # Generate mid prices
    returns = np.random.normal(0, 0.0001, len(timestamps))
    mid_prices = initial_price * np.cumprod(1 + returns)
    
    # Convert spread from pips to price
    spread = spread_pips * 0.0001
    
    data = []
    for i, ts in enumerate(timestamps):
        mid = mid_prices[i]
        data.append({
            "timestamp": ts,
            "symbol": symbol,
            "bid": round(mid - spread / 2, 5),
            "ask": round(mid + spread / 2, 5)
        })
    
    return pd.DataFrame(data)


if __name__ == "__main__":
    # Test data generation
    ohlcv = generate_ohlcv_data("EURUSD", "2024-01-01", "2024-01-31")
    print(f"Generated {len(ohlcv)} OHLCV bars")
    print(ohlcv.head())
    
    ticks = generate_quote_ticks("EURUSD", "2024-01-01", "2024-01-02")
    print(f"\nGenerated {len(ticks)} quote ticks")
    print(ticks.head())
