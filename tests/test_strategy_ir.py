"""
Tests for Strategy IR definitions (Objective 002)
"""
from backend.strategy_ir import (
    StrategyIR, Rule, Condition, MarketComponent, 
    ActionType, ComparisonOperator, PositionSizing
)

def test_ir_instantiation():
    """Verify basic IR object creation and structure"""
    ir = StrategyIR(
        name="Test Strategy",
        rules=[
            Rule(
                action=ActionType.ENTER_LONG,
                conditions=[
                    Condition(
                        left=MarketComponent(type="SMA", params={"period": 20}),
                        operator=ComparisonOperator.GT,
                        right=MarketComponent(type="SMA", params={"period": 50})
                    )
                ]
            )
        ]
    )
    
    assert ir.name == "Test Strategy"
    assert len(ir.rules) == 1
    assert ir.rules[0].action == ActionType.ENTER_LONG
    
    cond = ir.rules[0].conditions[0]
    assert cond.left.type == "SMA"
    assert cond.left.params["period"] == 20
    assert cond.operator == ComparisonOperator.GT
    assert cond.right.type == "SMA"

def test_enums():
    """Verify Enums are accessible and correct"""
    assert ActionType.ENTER_LONG.value == "ENTER_LONG"
    assert ComparisonOperator.EQ.value == "=="
