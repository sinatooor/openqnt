"""
Tests for Risk Controls (Objective 006)
"""
import pytest
from unittest.mock import AsyncMock, patch
from backend.risk_controls import RiskConstraints, RiskController, RiskViolation, PanicService


def test_max_drawdown_blocks_trades():
    """Test that trades are blocked when drawdown exceeds limit."""
    constraints = RiskConstraints(max_drawdown_pct=10.0, max_position_size=100.0)
    controller = RiskController(constraints, initial_equity=10000.0)
    
    # Simulate a 12% drawdown (peak 10000, current 8800)
    controller.update_equity(10000.0, timestamp="T1")  # Peak
    controller.update_equity(8800.0, timestamp="T2")   # 12% drawdown
    
    # Trading should be halted
    assert controller.is_trading_halted is True
    
    # Trade validation should fail
    result = controller.validate_trade(10.0, timestamp="T3")
    assert result["allowed"] is False
    assert len(result["violations"]) > 0


def test_max_position_size_blocks_trades():
    """Test that trades exceeding max position size are blocked."""
    constraints = RiskConstraints(max_drawdown_pct=10.0, max_position_size=50.0)
    controller = RiskController(constraints, initial_equity=10000.0)
    
    # Try to trade with size > max
    result = controller.validate_trade(75.0, timestamp="T1")
    
    assert result["allowed"] is False
    assert any(v.rule == "MAX_POSITION_SIZE" for v in result["violations"])


def test_violations_are_logged():
    """Test that violations are explicitly logged."""
    constraints = RiskConstraints(max_drawdown_pct=5.0, max_position_size=10.0)
    controller = RiskController(constraints, initial_equity=10000.0)
    
    # Trigger drawdown violation
    controller.update_equity(9400.0, timestamp="T1")  # 6% drawdown
    
    # Trigger position size violation
    controller.validate_trade(15.0, timestamp="T2")
    
    logs = controller.get_violations_log()
    assert len(logs) >= 1
    assert any("MAX_DRAWDOWN" in log for log in logs)


def test_trading_allowed_within_limits():
    """Test that trading is allowed when constraints are satisfied."""
    constraints = RiskConstraints(max_drawdown_pct=10.0, max_position_size=100.0)
    controller = RiskController(constraints, initial_equity=10000.0)
    
    # Small drawdown
    controller.update_equity(9500.0, timestamp="T1")  # 5% drawdown
    
    # Trade within limits
    result = controller.validate_trade(50.0, timestamp="T2")
    
    assert result["allowed"] is True
    assert len(result["violations"]) == 0


def test_reset_clears_state():
    """Test that reset clears all state."""
    constraints = RiskConstraints(max_drawdown_pct=5.0, max_position_size=10.0)
    controller = RiskController(constraints, initial_equity=10000.0)
    
    # Trigger halt
    controller.update_equity(9000.0, timestamp="T1")
    assert controller.is_trading_halted is True
    
    # Reset
    controller.reset(initial_equity=10000.0)
    
    assert controller.is_trading_halted is False
    assert len(controller.violations) == 0
    assert controller.peak_equity == 10000.0

@pytest.mark.anyio
async def test_panic_service_trigger():
    """Test that panic service behaves correctly."""
    # Ensure panic is clear
    PanicService.clear_panic()
    assert PanicService.is_panic_active() is False

    # Mock IGClient
    with patch("backend.risk_controls.IGClient") as MockIG:
        client_instance = MockIG.return_value
        client_instance.login = AsyncMock(return_value={"success": True})
        client_instance.close_all_positions = AsyncMock(return_value={"closed": 1})
        client_instance.cancel_all_orders = AsyncMock(return_value={"cancelled": 1})
        
        # Trigger panic
        result = await PanicService.trigger_panic()
        
        # Verify state
        assert result["panic_enabled"] is True
        assert PanicService.is_panic_active() is True
        assert result["positions_closed"]["closed"] == 1
        assert result["orders_cancelled"]["cancelled"] == 1
        
        # Verify calls
        client_instance.login.assert_called_once()
        client_instance.close_all_positions.assert_called_once()
        client_instance.cancel_all_orders.assert_called_once()
        
    # Cleanup
    PanicService.clear_panic()
    assert PanicService.is_panic_active() is False

def test_panic_mode_blocks_trades():
    """Test that risk controller blocks trades when panic is active."""
    # Setup
    constraints = RiskConstraints(max_drawdown_pct=10.0, max_position_size=100.0)
    controller = RiskController(constraints, initial_equity=10000.0)
    
    # Enable panic
    PanicService.LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    PanicService.LOCK_FILE.touch()
    
    try:
        # Attempt trade
        result = controller.validate_trade(10.0, timestamp="T1")
        
        assert result["allowed"] is False
        assert len(result["violations"]) > 0
        assert result["violations"][0].rule == "PANIC_TRIGGERED"
        
    finally:
        # Cleanup
        PanicService.clear_panic()
