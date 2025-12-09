#!/usr/bin/env python3
"""
Test script for RSI Oversold Reversal template strategy using TA-Lib
Tests against AAPL for the past year with daily data
"""

import sys
sys.path.insert(0, '/Users/sina/project-fire/PPM/backend')

import yfinance as yf
from backtesting import Backtest
from template_strategies import TEMPLATE_STRATEGIES, get_template_strategy

def main():
    print("=" * 60)
    print("Testing RSI Oversold Reversal Template Strategy")
    print("=" * 60)
    
    # 1. Fetch AAPL data for past year
    print("\n[1] Fetching AAPL data (1 year, daily)...")
    ticker = yf.Ticker("AAPL")
    data = ticker.history(period="1y", interval="1d")
    
    if data.empty:
        print("ERROR: No data returned for AAPL")
        return
    
    # Ensure correct column names
    data = data[['Open', 'High', 'Low', 'Close', 'Volume']]
    print(f"    Loaded {len(data)} bars from {data.index[0].date()} to {data.index[-1].date()}")
    
    # 2. Get template code
    print("\n[2] Loading RSI Oversold Reversal template...")
    code, params = get_template_strategy("rsi-oversold-reversal")
    
    if not code:
        print("ERROR: Template not found")
        return
    
    print(f"    Default params: {params}")
    print(f"    Code length: {len(code)} chars")
    
    # 3. Execute the strategy code to get the class
    print("\n[3] Compiling strategy...")
    local_namespace = {}
    exec(code, local_namespace)
    
    # Find the strategy class (look for GeneratedStrategy specifically)
    strategy_class = local_namespace.get('GeneratedStrategy')
    
    if not strategy_class:
        # Fallback: find any Strategy subclass
        from backtesting import Strategy
        for name, obj in local_namespace.items():
            if isinstance(obj, type) and issubclass(obj, Strategy) and obj is not Strategy:
                strategy_class = obj
                break
    
    if not strategy_class:
        print("ERROR: No Strategy class found in generated code")
        return
    
    print(f"    Found strategy class: {strategy_class.__name__}")
    
    # 4. Run backtest
    print("\n[4] Running backtest...")
    bt = Backtest(data, strategy_class, cash=10000, commission=0.002)
    stats = bt.run()
    
    # 5. Print results
    print("\n" + "=" * 60)
    print("BACKTEST RESULTS")
    print("=" * 60)
    print(f"\nReturn:           {stats['Return [%]']:.2f}%")
    print(f"Max Drawdown:     {stats['Max. Drawdown [%]']:.2f}%")
    print(f"Total Trades:     {stats['# Trades']}")
    print(f"Win Rate:         {stats['Win Rate [%]']:.1f}%" if stats['Win Rate [%]'] else "N/A")
    print(f"Sharpe Ratio:     {stats['Sharpe Ratio']:.2f}" if stats['Sharpe Ratio'] else "N/A")
    print(f"Final Equity:     ${stats['Equity Final [$]']:,.2f}")
    
    print("\n" + "-" * 40)
    print("Full Stats:")
    print("-" * 40)
    print(stats)
    
    print("\n✅ Test completed successfully!")


if __name__ == "__main__":
    main()
