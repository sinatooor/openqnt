"""
Test Nautilus Adapter Contract

Verifies that the adapter produces the expected JSON output shape
matching the backtesting.py UI representation.
"""
import pytest
import pandas as pd
from unittest.mock import MagicMock, patch
from backend.nautilus_adapter import run_nautilus_backtest, NAUTILUS_INSTALLED

# Skip if Nautilus not installed
@pytest.mark.skipif(not NAUTILUS_INSTALLED, reason="NautilusTrader not installed")
def test_nautilus_output_shape():
    """Verify the output dictionary keys and types."""
    
    # Mock data
    dates = pd.date_range("2024-01-01", "2024-01-10", freq="1H")
    data = pd.DataFrame({
        "timestamp": dates,
        "open": 1.1000,
        "high": 1.1050,
        "low": 1.0950,
        "close": 1.1010,
        "volume": 1000
    })
    
    # Mock Strategy Code (Minimal Nautilus Strategy)
    strategy_code = """
from nautilus_trader.trading.strategy import Strategy
class TestStrategy(Strategy):
    def on_bar(self, bar):
        pass
"""
    
    result = run_nautilus_backtest(
        strategy_code=strategy_code,
        symbol="EURUSD",
        start_date="2024-01-01",
        end_date="2024-01-10",
        historical_data=data
    )
    
    # Check Top Level Keys
    assert "success" in result
    assert "metrics" in result
    assert "trades" in result
    assert "equity_curve" in result
    
    # Check Metrics
    metrics = result["metrics"]
    expected_metrics = ["total_trades", "win_rate", "total_pnl", "final_balance"]
    for k in expected_metrics:
        assert k in metrics, f"Missing metric: {k}"
        
    # Check Equity Curve
    equity_curve = result["equity_curve"]
    assert isinstance(equity_curve, list)
    if equity_curve:
        assert "time" in equity_curve[0]
        assert "equity" in equity_curve[0]
        
    # Check Trades
    trades = result["trades"]
    assert isinstance(trades, list)
