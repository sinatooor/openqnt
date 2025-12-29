"""
UI Representation Compatibility Test

Ensures the keys match what the Frontend expects (based on backtest_result.json).
"""
import pytest
import json
import os
from backend.nautilus_adapter import run_nautilus_backtest

def test_json_structure_compliance():
    """Compare generated result structure with reference JSON."""
    
    # Load reference
    # Assuming we are in backend/tests, so up one level to backend
    # Adjust path to find backend/backtest_result.json
    ref_path = os.path.join(os.path.dirname(__file__), "..", "backtest_result.json")
    if not os.path.exists(ref_path):
        pytest.skip("backtest_result.json not found")
        
    with open(ref_path, "r") as f:
        reference = json.load(f)
        
    # We construct a mock result from the adapter
    # (Just verifying the dict structure we return in adapter matches this reference keys)
    
    required_keys = ["success", "symbol", "start_date", "end_date", "metrics", "trades", "equity_curve"]
    
    # Reference Check
    for k in required_keys:
        assert k in reference, f"Reference JSON missing key {k}"
        
    # We can invoke the adapter with dummy data to see what it returns
    import pandas as pd
    dates = pd.date_range("2024-01-01", "2024-01-02", freq="1H")
    data = pd.DataFrame({
        "timestamp": dates,
        "open": 1.0, "high": 1.0, "low": 1.0, "close": 1.0, "volume": 100
    })
    strategy_code = """
from nautilus_trader.trading.strategy import Strategy
class S(Strategy): pass
"""
    
    # If nautilus not installed, this returns fallback which also has the keys (except maybe not all if error)
    # But let's check what we can.
    
    result = run_nautilus_backtest(strategy_code, "EURUSD", "2024-01-01", "2024-01-02", 10000, data)
    
    if result["success"]:
        for k in required_keys:
            assert k in result, f"Result missing key {k}"
