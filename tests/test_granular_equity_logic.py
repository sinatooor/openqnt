"""
Unit Test for Granular Equity Curve Logic

Verifies floating PnL calculation without requiring the full Nautilus engine.
"""
import pandas as pd
import pytest
from backend.nautilus_adapter import _calculate_granular_equity

def test_granular_equity_calculation():
    """Verify equity curve correctly reflects floating PnL and trade exits."""
    
    # 1. Setup Data
    # 3 bars: 10:00, 11:00, 12:00
    dates = pd.to_datetime(["2024-01-01 10:00", "2024-01-01 11:00", "2024-01-01 12:00"])
    # Prices: 100, 110, 105
    data = pd.DataFrame({
        "timestamp": dates,
        "close": [100.0, 110.0, 105.0],
        # Add other columns to satisfy normalization if needed, though close/timestamp is minimal for calculation
        "open": [100.0, 110.0, 105.0],
        "high": [100.0, 110.0, 105.0],
        "low": [100.0, 110.0, 105.0],
        "volume": [1000, 1000, 1000]
    })
    
    initial_balance = 1000.0
    
    # 2. Setup Trades
    # Trade 1: Buy 1 unit at 10:00 (Price 100). Exit at 12:00 (Price 105).
    # Entry matched at 10:00.
    # At 11:00: Open. Price 110. Floating PnL = (110 - 100) * 1 = 10. Equity = 1010.
    # At 12:00: Closed. Price 105. PnL = (105 - 100) * 1 = 5. Equity = 1005.
    
    trades = [{
        "entry_time": "2024-01-01 10:00:00",
        "exit_time": "2024-01-01 12:00:00",
        "entry_price": 100.0,
        "exit_price": 105.0,
        "size": 1.0,
        "direction": 1, # Long
        "type": "long",
        "pnl": 5.0
    }]
    
    # 3. Run Calculation
    curve = _calculate_granular_equity(data, trades, initial_balance)
    
    # 4. Verify
    assert len(curve) == 3, f"Expected 3 equity points, got {len(curve)}"
    
    # Point 1 (10:00): Trade enters. 
    # Logic: entry_dt (10:00) <= ts (10:00). Active.
    # Floating PnL: (Price 100 - Entry 100) * 1 = 0.
    # Equity = 1000 + 0 = 1000.
    assert curve[0]["equity"] == 1000.0, f"Point 1 Equity: {curve[0]['equity']}"
    assert curve[0]["timestamp"] == "2024-01-01 10:00:00"
    
    # Point 2 (11:00): Trade active.
    # Price 110. Entry 100. Floating = 10.
    # Equity = 1010.
    assert curve[1]["equity"] == 1010.0, f"Point 2 Equity: {curve[1]['equity']}"
    
    # Point 3 (12:00): Trade exits.
    # Logic: exit_dt (12:00) <= ts (12:00).
    # Realized PnL added. Trade removed from active.
    # Equity = 1000 + 5 = 1005.
    assert curve[2]["equity"] == 1005.0, f"Point 3 Equity: {curve[2]['equity']}"
