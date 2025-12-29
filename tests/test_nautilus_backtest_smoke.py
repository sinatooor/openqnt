"""
Smoke Test for Nautilus Adapter

Runs a simple strategy to ensure it executes without crashing.
"""
import pytest
import pandas as pd
from backend.nautilus_adapter import run_nautilus_backtest, NAUTILUS_INSTALLED

@pytest.mark.skipif(not NAUTILUS_INSTALLED, reason="NautilusTrader not installed")
def test_smoke_strategy_execution():
    """Run a basic strategy that does nothing (just verifies engine runs)."""
    
    # Generate synthetic data
    dates = pd.date_range("2024-01-01", "2024-01-05", freq="1h")
    data = pd.DataFrame({
        "timestamp": dates,
        "open": [1.0 + i*0.001 for i in range(len(dates))], # Trending up
        "high": [1.01 + i*0.001 for i in range(len(dates))],
        "low": [0.99 + i*0.001 for i in range(len(dates))],
        "close": [1.005 + i*0.001 for i in range(len(dates))],
        "volume": 1000
    })
    
    # Minimal Nautilus Strategy that runs without error
    strategy_code = """
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.config import StrategyConfig

class SmokeStrategy(Strategy):
    def __init__(self, config: StrategyConfig):
        super().__init__(config)
    
    def on_start(self):
        # Don't subscribe to anything - just test basic execution
        pass
        
    def on_bar(self, bar):
        # Just receive bars, don't trade
        pass
    
    def on_stop(self):
        pass
"""

    result = run_nautilus_backtest(
        strategy_code=strategy_code,
        symbol="EURUSD",
        start_date="2024-01-01",
        end_date="2024-01-05",
        historical_data=data
    )
    
    # Check that backtest succeeded
    assert result["success"] == True, f"Backtest failed: {result.get('error', 'unknown')}"
    assert result["metrics"]["total_trades"] == 0  # Strategy doesn't trade
