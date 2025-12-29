"""
Tests for Rule Parser (Objective 003)
"""
import pytest
from backend.rule_parser import RuleParser
from backend.strategy_ir import StrategyIR, ActionType, ComparisonOperator

def test_parse_simple_strategy():
    definition = {
        "name": "RSI Strategy",
        "timeframe": "1h",
        "rules": [
            {
                "action": "ENTER_LONG",
                "conditions": [
                    {
                        "left": {"type": "RSI", "params": {"period": 14}},
                        "operator": "<",
                        "right": 30
                    }
                ]
            }
        ]
    }
    
    parser = RuleParser()
    ir = parser.parse(definition)
    
    assert isinstance(ir, StrategyIR)
    assert ir.name == "RSI Strategy"
    assert len(ir.rules) == 1
    
    rule = ir.rules[0]
    assert rule.action == ActionType.ENTER_LONG
    assert len(rule.conditions) == 1
    
    cond = rule.conditions[0]
    assert cond.left.type == "RSI"
    assert cond.left.params["period"] == 14
    assert cond.operator == ComparisonOperator.LT
    assert cond.right == 30

def test_parse_nested_component():
    """Test comparison between two indicators"""
    definition = {
        "rules": [
            {
                "action": "EXIT_LONG",
                "conditions": [
                    {
                        "left": "Close",
                        "operator": "<",
                        "right": {"type": "SMA", "params": {"period": 200}}
                    }
                ]
            }
        ]
    }
    
    parser = RuleParser()
    ir = parser.parse(definition)
    
    cond = ir.rules[0].conditions[0]
    assert cond.left.type == "Close"
    assert cond.right.type == "SMA"
    assert cond.right.params["period"] == 200

def test_parse_negative_number():
    """Test parsing of negative numbers in conditions"""
    definition = {
        "rules": [
            {
                "action": "ENTER_SHORT",
                "conditions": [
                    {
                        "left": "MACD",
                        "operator": "<",
                        "right": "-0.5"
                    }
                ]
            }
        ]
    }
    
    parser = RuleParser()
    ir = parser.parse(definition)
    
    cond = ir.rules[0].conditions[0]
    assert cond.right == -0.5

def test_parse_invalid_action():
    definition = {
        "rules": [{"action": "INVALID_ACTION"}]
    }
    parser = RuleParser()
    with pytest.raises(ValueError, match="Invalid action type"):
        parser.parse(definition)

def test_parse_missing_fields():
    definition = {
        "rules": [{"action": "ENTER_LONG", "conditions": [{"left": "RSI"}]}]
    }
    parser = RuleParser()
    with pytest.raises(ValueError, match="must have 'left', 'operator', and 'right'"):
        parser.parse(definition)
