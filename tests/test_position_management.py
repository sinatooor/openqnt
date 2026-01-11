"""
Tests for Position Management Rules (Objective 18).
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from strategy_ir import (
    StrategyIR, Rule, Condition, MarketComponent, ActionType, 
    ComparisonOperator, PositionSizing, PositionManagement
)


def test_position_management_defaults():
    """Test PositionManagement has sensible defaults."""
    pm = PositionManagement()
    
    # All features disabled by default
    assert pm.pyramid_enabled == False
    assert pm.partial_exit_enabled == False
    assert pm.breakeven_enabled == False
    assert pm.time_exit_enabled == False
    
    # Default values
    assert pm.pyramid_max_adds == 2
    assert pm.time_exit_bars == 10


def test_strategy_ir_includes_position_management():
    """Test StrategyIR includes position_management field."""
    ir = StrategyIR(name="Test Strategy")
    
    assert hasattr(ir, 'position_management')
    assert isinstance(ir.position_management, PositionManagement)


def test_pyramiding_configuration():
    """Test pyramiding can be configured."""
    pm = PositionManagement(
        pyramid_enabled=True,
        pyramid_max_adds=3,
        pyramid_add_size=0.25
    )
    
    assert pm.pyramid_enabled == True
    assert pm.pyramid_max_adds == 3
    assert pm.pyramid_add_size == 0.25


def test_partial_exit_configuration():
    """Test partial exit can be configured."""
    pm = PositionManagement(
        partial_exit_enabled=True,
        partial_exit_percent=25.0,
        partial_exit_target_percent=3.0
    )
    
    assert pm.partial_exit_enabled == True
    assert pm.partial_exit_percent == 25.0
    assert pm.partial_exit_target_percent == 3.0


def test_breakeven_stop_configuration():
    """Test break-even stop can be configured."""
    pm = PositionManagement(
        breakeven_enabled=True,
        breakeven_trigger_percent=1.5
    )
    
    assert pm.breakeven_enabled == True
    assert pm.breakeven_trigger_percent == 1.5


def test_time_exit_configuration():
    """Test time-based exit can be configured."""
    pm = PositionManagement(
        time_exit_enabled=True,
        time_exit_bars=5
    )
    
    assert pm.time_exit_enabled == True
    assert pm.time_exit_bars == 5


def test_full_strategy_with_position_management():
    """Test creating a full strategy with all position management features."""
    ir = StrategyIR(
        name="Advanced Strategy",
        timeframe="1h",
        position_sizing=PositionSizing(method="percent_equity", value=2.0),
        position_management=PositionManagement(
            pyramid_enabled=True,
            pyramid_max_adds=2,
            partial_exit_enabled=True,
            partial_exit_percent=50.0,
            breakeven_enabled=True,
            breakeven_trigger_percent=2.0,
            time_exit_enabled=True,
            time_exit_bars=20
        ),
        rules=[
            Rule(
                action=ActionType.ENTER_LONG,
                conditions=[
                    Condition(
                        left=MarketComponent(type="RSI", params={"period": 14}),
                        operator=ComparisonOperator.LT,
                        right=30
                    )
                ]
            )
        ]
    )
    
    # Verify structure
    assert ir.name == "Advanced Strategy"
    assert ir.position_management.pyramid_enabled == True
    assert ir.position_management.partial_exit_enabled == True
    assert ir.position_management.breakeven_enabled == True
    assert ir.position_management.time_exit_enabled == True
    assert len(ir.rules) == 1
