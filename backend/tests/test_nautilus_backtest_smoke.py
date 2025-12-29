"""
Smoke Test for Nautilus Adapter

Runs a simple strategy to ensure it executes without crashing.
"""
import pytest
import pandas as pd
from nautilus_adapter import run_nautilus_backtest, NAUTILUS_INSTALLED

@pytest.mark.skipif(not NAUTILUS_INSTALLED, reason="NautilusTrader not installed")
def test_smoke_strategy_execution():
    """Run a basic MA crossover-like strategy (logic simplified)."""
    
    # Generate synthetic data
    dates = pd.date_range("2024-01-01", "2024-01-05", freq="1H")
    data = pd.DataFrame({
        "timestamp": dates,
        "open": [1.0 + i*0.001 for i in range(len(dates))], # Trending up
        "high": [1.01 + i*0.001 for i in range(len(dates))],
        "low": [0.99 + i*0.001 for i in range(len(dates))],
        "close": [1.005 + i*0.001 for i in range(len(dates))],
        "volume": 1000
    })
    
    # Valid Nautilus Strategy Code
    strategy_code = """
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.objects import Quantity

class SmokeStrategy(Strategy):
    def on_start(self):
        self.subscribe_bars(self.bar_type)
        
    def on_bar(self, bar):
        # Buy on first bar
        # Note: In real nautilus, we need to check instrument, etc.
        # This is just to parse and run 'on_bar'
        pass
"""

    result = run_nautilus_backtest(
        strategy_code=strategy_code,
        symbol="EURUSD",
        start_date="2024-01-01",
        end_date="2024-01-05",
        historical_data=data
    )
    
    assert result["success"] == True
    assert result["metrics"]["total_trades"] == 0 # Logic doesn't trade
