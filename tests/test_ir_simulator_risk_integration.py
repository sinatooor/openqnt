"""
Integration Tests for IR Simulator and Risk Controls (Objective 011)
"""
import pytest
import pandas as pd
from datetime import datetime, timedelta
from backend.strategy_ir import StrategyIR, Rule, Condition, ActionType, MarketComponent, ComparisonOperator, PositionSizing
from backend.ir_simulator import IRSimulator
from backend.risk_controls import RiskController, RiskConstraints, RiskViolation

def create_market_data(length=100, start_price=100.0, trend=1.0):
    dates = [datetime(2023, 1, 1) + timedelta(minutes=i) for i in range(length)]
    prices = [start_price + (i * trend) for i in range(length)]
    
    data = pd.DataFrame({
        'timestamp': dates,
        'open': prices,
        'high': prices,
        'low': prices,
        'close': prices,
        'volume': 1000
    })
    data.set_index('timestamp', inplace=True)
    return data

def test_max_position_size_blocks_trade_in_simulation():
    """Test that a trade larger than max_position_size is rejected during simulation."""
    # Data that always goes up
    data = create_market_data(length=10)
    
    # Strategy: Buy immediately
    close_price = MarketComponent(type="Close")
    rule_entry = Rule(
        action=ActionType.ENTER_LONG,
        conditions=[Condition(left=close_price, operator=ComparisonOperator.GT, right=0.0)]
    )
    
    # Size 200, Limit 100
    strategy = StrategyIR(
        name="BigTrade",
        rules=[rule_entry],
        position_sizing=PositionSizing(method="fixed_amount", value=200.0) 
    )
    
    constraints = RiskConstraints(max_position_size=100.0)
    risk_controller = RiskController(constraints)
    
    sim = IRSimulator(initial_equity=10000.0, risk_controller=risk_controller)
    result = sim.run(strategy, data)
    
    # Check that trade was BLOCKED
    assert len(result.trades) == 0
    
    # Check violations logged
    assert len(result.risk_violations) > 0
    assert result.risk_violations[0].rule == "MAX_POSITION_SIZE"

def test_max_drawdown_halts_trading_in_simulation():
    """Test that trading halts when drawdown limit is reached."""
    # Data that goes down sharply then recovers
    # Day 0-9: 100 -> 90 (10% drop). If max DD is 5%, should halt around 95.
    dates = [datetime(2023, 1, 1) + timedelta(minutes=i) for i in range(20)]
    # Prices: 100, 99, 98 ... 90, 91, ... 100
    prices = [100 - i for i in range(11)] + [90 + i for i in range(1, 10)]
    
    data = pd.DataFrame({
        'timestamp': dates,
        'open': prices,
        'high': prices,
        'low': prices,
        'close': prices,
        'volume': 1000
    })
    data.set_index('timestamp', inplace=True)
    
    # Strategy: Buy at start, Exit if price > 150 (never), Enter again if price > 95 (recovery)
    # Actually, we need to be in a position to suffer drawdown.
    # Enter LONG at start.
    rule_entry = Rule(
        action=ActionType.ENTER_LONG,
        conditions=[Condition(left=MarketComponent(type="Close"), operator=ComparisonOperator.GT, right=0.0)]
    )
    
    # Try to Enter LONG again later (pyramiding?) or just ensure no new trades allowed.
    # To test HALT, we can try to reverse or enter another trade later.
    
    strategy = StrategyIR(
        name="DrawdownTest",
        rules=[rule_entry],
        position_sizing=PositionSizing(method="fixed_amount", value=100.0) # Size 100 * $10 drop = $1000 loss on $10k equity = 10% DD
    )
    
    # Max DD 5% = $500 loss allowed.
    constraints = RiskConstraints(max_drawdown_pct=5.0)
    risk_controller = RiskController(constraints, initial_equity=10000.0)
    
    sim = IRSimulator(initial_equity=10000.0, risk_controller=risk_controller)
    result = sim.run(strategy, data)
    
    # We expect a violation
    assert len(result.risk_violations) > 0
    assert any(v.rule == "MAX_DRAWDOWN" for v in result.risk_violations)
    
    # Verify trading was halted (in RiskController)
    assert risk_controller.is_trading_halted

def test_simulation_without_risk_controller():
    """Ensure backward compatibility."""
    data = create_market_data(length=10)
    rule_entry = Rule(
        action=ActionType.ENTER_LONG,
        conditions=[Condition(left=MarketComponent(type="Close"), operator=ComparisonOperator.GT, right=0.0)]
    )
    strategy = StrategyIR(
        name="NoRisk",
        rules=[rule_entry],
        position_sizing=PositionSizing(method="fixed_amount", value=200.0)
    )
    
    sim = IRSimulator(initial_equity=10000.0) # No controller
    result = sim.run(strategy, data)
    
    assert len(result.trades) == 1
    assert result.trades[0].size == 200.0 # Uncapped
    assert len(result.risk_violations) == 0
