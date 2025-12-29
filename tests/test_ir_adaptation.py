"""
Tests for IR Adaptation (Objective 008)
"""
import pytest
from backend.strategy_ir import StrategyIR, Rule, Condition, ActionType, MarketComponent, ComparisonOperator, PositionSizing
from backend.broker_capabilities import get_ig_mock_capabilities, get_binance_mock_capabilities
from backend.ir_adaptation import IRAdapter, adapt_strategy_to_broker, AdaptationResult


def _create_simple_strategy(size: float = 1.0) -> StrategyIR:
    """Helper to create a simple strategy for testing."""
    return StrategyIR(
        name="TestStrategy",
        rules=[
            Rule(
                action=ActionType.ENTER_LONG,
                conditions=[
                    Condition(
                        left=MarketComponent(type="RSI", params={"period": 14}),
                        operator=ComparisonOperator.LT,
                        right=30.0
                    )
                ]
            )
        ],
        position_sizing=PositionSizing(method="fixed", value=size)
    )


def test_adaptation_success_within_constraints():
    """Test that strategy adapts successfully when constraints are met."""
    strategy = _create_simple_strategy(size=1.0)
    broker = get_ig_mock_capabilities()  # min=0.1, max=100, step=0.1
    
    result = adapt_strategy_to_broker(strategy, broker)
    
    assert result.success is True
    assert result.adapted_strategy is not None
    assert len(result.errors) == 0


def test_adaptation_fails_with_clear_warning():
    """Test that incompatible strategy fails with clear warning."""
    # Create strategy with size below broker minimum
    strategy = _create_simple_strategy(size=0.01)  # Below IG min of 0.1
    broker = get_ig_mock_capabilities()
    
    result = adapt_strategy_to_broker(strategy, broker)
    
    assert result.success is False
    assert len(result.errors) > 0
    assert "below broker minimum" in result.errors[0]


def test_lot_step_adaptation():
    """Test that position size is adapted to broker lot step."""
    # Create strategy with size that doesn't align with lot step
    strategy = _create_simple_strategy(size=1.55)  # Not aligned to 0.1 step
    broker = get_ig_mock_capabilities()  # lot_step=0.1
    
    result = adapt_strategy_to_broker(strategy, broker)
    
    assert result.success is True
    # Should have a warning about adjustment
    assert len(result.warnings) > 0
    assert any("lot step" in w.message.lower() for w in result.warnings)


def test_max_size_capping():
    """Test that position size is capped to broker maximum."""
    strategy = _create_simple_strategy(size=150.0)  # Above IG max of 100
    broker = get_ig_mock_capabilities()
    
    result = adapt_strategy_to_broker(strategy, broker)
    
    assert result.success is True
    assert len(result.warnings) > 0
    assert any("capped" in w.message.lower() for w in result.warnings)


def test_original_intent_preserved():
    """Test that original strategy intent is preserved where possible."""
    strategy = _create_simple_strategy(size=1.0)
    broker = get_ig_mock_capabilities()
    
    result = adapt_strategy_to_broker(strategy, broker)
    
    assert result.success is True
    # Strategy name and structure should be preserved
    assert result.adapted_strategy.name == strategy.name
    assert len(result.adapted_strategy.rules) == len(strategy.rules)
    # Action should be preserved
    assert result.adapted_strategy.rules[0].action == ActionType.ENTER_LONG


def test_different_brokers_different_results():
    """Test that different brokers produce different adaptation results."""
    # Very small size - valid for Binance, invalid for IG
    strategy = _create_simple_strategy(size=0.001)
    
    ig_result = adapt_strategy_to_broker(strategy, get_ig_mock_capabilities())
    binance_result = adapt_strategy_to_broker(strategy, get_binance_mock_capabilities())
    
    # IG should fail (min 0.1), Binance should succeed (min 0.00001)
    assert ig_result.success is False
    assert binance_result.success is True
