import pytest
from datetime import datetime
import pytz
from backend.broker_capabilities import (
    OrderType, 
    get_ig_mock_capabilities, 
    get_binance_mock_capabilities
)

def test_ig_capabilities():
    ig = get_ig_mock_capabilities()
    
    # Valid order
    res = ig.validate_order(OrderType.MARKET, 0.5)
    assert res["valid"] is True
    
    # Unsupported order type
    res = ig.validate_order(OrderType.GUARANTEED_STOP, 0.5)
    assert res["valid"] is False
    assert "not supported" in res["errors"][0]
    
    # Invalid lot size (too small)
    res = ig.validate_order(OrderType.MARKET, 0.05)
    assert res["valid"] is False
    assert "below minimum" in res["errors"][0]
    
    # Invalid lot step
    res = ig.validate_order(OrderType.MARKET, 0.55)
    assert res["valid"] is False
    assert "does not align with lot step" in res["errors"][0]

def test_binance_capabilities():
    binance = get_binance_mock_capabilities()
    
    # Binance supports very small lots
    res = binance.validate_order(OrderType.MARKET, 0.0001)
    assert res["valid"] is True
    
    # Binance does not support Trailing Stop in this mock
    res = binance.validate_order(OrderType.TRAILING_STOP, 1.0)
    assert res["valid"] is False

def test_market_hours():
    ig = get_ig_mock_capabilities()
    binance = get_binance_mock_capabilities()
    
    # Saturday noon UTC
    saturday_noon = datetime(2025, 12, 27, 12, 0, 0, tzinfo=pytz.UTC)
    
    # IG should be closed
    res_ig = ig.validate_order(OrderType.MARKET, 1.0, dt=saturday_noon)
    assert res_ig["valid"] is False
    assert "Market is closed" in res_ig["errors"][0]
    
    # Binance should be open
    res_binance = binance.validate_order(OrderType.MARKET, 1.0, dt=saturday_noon)
    assert res_binance["valid"] is True

def test_capability_mismatch_detection():
    ig = get_ig_mock_capabilities()
    binance = get_binance_mock_capabilities()
    
    order_type = OrderType.TRAILING_STOP
    size = 0.001
    
    # IG supports Trailing Stop but size is too small
    ig_res = ig.validate_order(order_type, size)
    # Binance supports size but not Trailing Stop
    binance_res = binance.validate_order(order_type, size)
    
    assert ig_res["valid"] is False
    assert any("below minimum" in e for e in ig_res["errors"])
    
    assert binance_res["valid"] is False
    assert any("not supported" in e for e in binance_res["errors"])
