
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from nautilus_visualizer import generate_nautilus_chart
import os

def test_visualization():
    print("Testing Nautilus Visualization Generation...")
    
    # 1. Create Mock OHLCV Data (60 days)
    dates = pd.date_range(start="2024-01-01", periods=60, freq="D")
    df = pd.DataFrame({
        'Date': dates,
        'Open': np.random.randn(60).cumsum() + 100,
        'Volume': np.random.randint(1000, 5000, 60)
    })
    df['High'] = df['Open'] + np.random.rand(60) * 2
    df['Low'] = df['Open'] - np.random.rand(60) * 2
    df['Close'] = df['Open'] + np.random.randn(60)
    
    # 2. Create Mock Trades
    trades = [
        {
            "entry_time": dates[5].strftime("%Y-%m-%d %H:%M:%S"),
            "exit_time": dates[10].strftime("%Y-%m-%d %H:%M:%S"),
            "entry_price": float(df.iloc[5]['Open']),
            "exit_price": float(df.iloc[10]['Close']),
            "pnl": 150.50,
            "type": "long"
        },
        {
            "entry_time": dates[20].strftime("%Y-%m-%d %H:%M:%S"),
            "exit_time": dates[25].strftime("%Y-%m-%d %H:%M:%S"),
            "entry_price": float(df.iloc[20]['Open']),
            "exit_price": float(df.iloc[25]['Close']),
            "pnl": -50.25,
            "type": "short"
        }
    ]
    
    # 3. Create Mock Equity Curve
    equity_curve = [
        {"timestamp": dates[0].strftime("%Y-%m-%d"), "equity": 10000},
        {"timestamp": dates[10].strftime("%Y-%m-%d"), "equity": 10150.50},
        {"timestamp": dates[25].strftime("%Y-%m-%d"), "equity": 10100.25},
        {"timestamp": dates[59].strftime("%Y-%m-%d"), "equity": 10200.00}
    ]
    
    # 4. Create Mock Metrics
    metrics = {
        "total_trades": 2,
        "win_rate": 50.0,
        "total_pnl": 100.25,
        "final_balance": 10100.25,
        "max_drawdown": 1.5,
        "sharpe_ratio": 1.2
    }
    
    # 5. Generate Chart
    try:
        html = generate_nautilus_chart(df, trades, equity_curve, metrics, "TEST-SYM")
        
        if html and len(html) > 1000 and "bokeh" in html:
            print(f"SUCCESS: Generated HTML chart ({len(html)} chars)")
            # Save to file for inspection if needed
            with open("test_nautilus_chart.html", "w") as f:
                f.write(html)
            print("Saved to test_nautilus_chart.html")
            return True
        else:
            print("FAILURE: HTML output too short or missing content")
            return False
            
    except Exception as e:
        print(f"FAILURE: Exception during generation: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_visualization()
