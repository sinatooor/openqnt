#!/usr/bin/env python3
"""
Headless test for backtesting.py with Simple MA Crossover template on AAPL.
Settings: AAPL, $10000, 2024-01-01 to 2024-03-31, 1 Day
"""

from backtesting import Backtest, Strategy
from backtesting.lib import crossover
from backtesting.test import SMA
import yfinance as yf
import pandas as pd

# Simple MA Crossover Strategy (from backend/strategy_templates.py)
class SimpleMAcrossover(Strategy):
    """Simple Moving Average Crossover Strategy."""
    fast_period = 10
    slow_period = 20
    
    def init(self):
        close = self.data.Close
        self.sma_fast = self.I(SMA, close, self.fast_period)
        self.sma_slow = self.I(SMA, close, self.slow_period)
    
    def next(self):
        if crossover(self.sma_fast, self.sma_slow):
            self.buy()
        elif crossover(self.sma_slow, self.sma_fast):
            self.position.close()


def main():
    # Settings from user
    symbol = "AAPL"
    start_date = "2024-01-01"
    end_date = "2024-03-31"
    initial_balance = 10000
    commission = 0.001
    
    print(f"=== Headless Backtest: {symbol} ===")
    print(f"Period: {start_date} to {end_date}")
    print(f"Capital: ${initial_balance}, Commission: {commission}")
    print()
    
    # Fetch data
    print("Fetching data from yfinance...")
    ticker = yf.Ticker(symbol)
    df = ticker.history(start=start_date, end=end_date)
    print(f"Fetched {len(df)} bars")
    print(df.head())
    print()
    
    # Run backtest
    bt = Backtest(df, SimpleMAcrossover, cash=initial_balance, commission=commission)
    stats = bt.run()
    
    # Print key stats
    print("=== Key Metrics ===")
    print(f"# Trades: {stats['# Trades']}")
    print(f"Return [%]: {stats['Return [%]']:.4f}" if pd.notna(stats['Return [%]']) else "Return: N/A")
    print(f"Win Rate [%]: {stats.get('Win Rate [%]', 'N/A')}")
    print(f"Max. Drawdown [%]: {stats['Max. Drawdown [%]']:.4f}" if pd.notna(stats['Max. Drawdown [%]']) else "Max DD: N/A")
    print()
    
    # Check for open positions (trades not closed)
    if hasattr(stats, '_trades') and stats._trades is not None:
        if len(stats._trades) > 0:
            print(f"=== Trades ({len(stats._trades)}) ===")
            print(stats._trades[['Size', 'EntryTime', 'ExitTime', 'EntryPrice', 'ExitPrice', 'PnL']])
        else:
            print("No closed trades. Checking if there's an open position...")
    
    # Try with finalize_trades to close open positions at end of backtest
    print("\n=== Running with finalize_trades=True ===")
    stats2 = bt.run(finalize_trades=True)
    print(f"# Trades (with finalize): {stats2['# Trades']}")
    print(f"Return [%] (with finalize): {stats2['Return [%]']:.4f}" if pd.notna(stats2['Return [%]']) else "Return: N/A")
    
    if hasattr(stats2, '_trades') and stats2._trades is not None and len(stats2._trades) > 0:
        print(f"\n=== Trades ({len(stats2._trades)}) ===")
        print(stats2._trades[['Size', 'EntryTime', 'ExitTime', 'EntryPrice', 'ExitPrice', 'PnL']])
    
    print("\n=== Done ===")


if __name__ == "__main__":
    main()
