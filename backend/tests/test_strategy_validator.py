import pytest
import sys
import os

# Ensure backend is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from strategy_validator import StrategyValidator, ValidationSeverity, ValidationIssue

@pytest.fixture
def validator():
    return StrategyValidator()

def test_validate_empty_strategy(validator):
    strategy = {"rules": [], "position_sizing": {"value": 1}}
    issues = validator.validate(strategy)
    assert len(issues) == 1
    assert issues[0].code == "NO_RULES"
    assert issues[0].severity == ValidationSeverity.ERROR

def test_validate_entry_exit_mismatch(validator):
    # Long entry only
    strategy = {
        "rules": [
            {"action": {"type": "ENTER_LONG"}}
        ],
        "position_sizing": {"value": 1}
    }
    issues = validator.validate(strategy)
    codes = [i.code for i in issues]
    assert "NO_LONG_EXIT" in codes

    # Short entry only
    strategy = {
        "rules": [
            {"action": {"type": "ENTER_SHORT"}}
        ],
        "position_sizing": {"value": 1}
    }
    issues = validator.validate(strategy)
    codes = [i.code for i in issues]
    assert "NO_SHORT_EXIT" in codes

    # Matched pair
    strategy = {
        "rules": [
            {"action": {"type": "ENTER_LONG"}},
            {"action": {"type": "EXIT_LONG"}}
        ],
        "position_sizing": {"value": 1}
    }
    issues = validator.validate(strategy)
    codes = [i.code for i in issues]
    assert "NO_LONG_EXIT" not in codes
    assert "NO_SHORT_EXIT" not in codes

def test_validate_position_sizing(validator):
    # Invalid size <= 0
    strategy = {
        "rules": [{"action": {"type": "ENTER_LONG"}}, {"action": {"type": "EXIT_LONG"}}],
        "position_sizing": {"value": 0}
    }
    issues = validator.validate(strategy)
    codes = [i.code for i in issues]
    assert "INVALID_SIZE" in codes

    # High risk > 100% equity
    strategy = {
        "rules": [{"action": {"type": "ENTER_LONG"}}, {"action": {"type": "EXIT_LONG"}}],
        "position_sizing": {"value": 150, "method": "percent_equity"}
    }
    issues = validator.validate(strategy)
    codes = [i.code for i in issues]
    assert "HIGH_RISK_SIZE" in codes

    # Valid size
    strategy = {
        "rules": [{"action": {"type": "ENTER_LONG"}}, {"action": {"type": "EXIT_LONG"}}],
        "position_sizing": {"value": 10}
    }
    issues = validator.validate(strategy)
    # Filter out other potential issues (though there shouldn't be any based on logic)
    codes = [i.code for i in issues]
    assert "INVALID_SIZE" not in codes
    assert "HIGH_RISK_SIZE" not in codes

def test_validate_indicator_params(validator):
    # Invalid period
    strategy = {
        "rules": [
            {
                "conditions": [
                    {
                        "left": {
                            "type": "RSI",
                            "params": {"period": 1}
                        }
                    }
                ],
                "action": {"type": "ENTER_LONG"}
            },
            {"action": {"type": "EXIT_LONG"}}
        ],
        "position_sizing": {"value": 1}
    }
    issues = validator.validate(strategy)
    codes = [i.code for i in issues]
    assert "INVALID_PERIOD" in codes

    # Valid period
    strategy["rules"][0]["conditions"][0]["left"]["params"]["period"] = 14
    issues = validator.validate(strategy)
    codes = [i.code for i in issues]
    assert "INVALID_PERIOD" not in codes

def test_validate_redundant_conditions(validator):
    # More than 5 conditions
    conditions = [{"left": {"type": "SMA", "params": {"period": 14}}} for _ in range(6)]
    strategy = {
        "rules": [
            {
                "conditions": conditions,
                "action": {"type": "ENTER_LONG"}
            },
            {"action": {"type": "EXIT_LONG"}}
        ],
        "position_sizing": {"value": 1}
    }
    issues = validator.validate(strategy)
    codes = [i.code for i in issues]
    assert "MANY_CONDITIONS" in codes

    # 5 conditions
    strategy["rules"][0]["conditions"] = conditions[:5]
    issues = validator.validate(strategy)
    codes = [i.code for i in issues]
    assert "MANY_CONDITIONS" not in codes

def test_is_valid(validator):
    # Error (No Rules)
    strategy = {"rules": []}
    assert validator.is_valid(strategy) is False

    # Warning (No Exit) - Should be valid as warnings don't block
    strategy = {
        "rules": [{"action": {"type": "ENTER_LONG"}}],
        "position_sizing": {"value": 1}
    }
    # Check that we actually have a warning but no error
    issues = validator.validate(strategy)
    assert any(i.severity == ValidationSeverity.WARNING for i in issues)
    assert not any(i.severity == ValidationSeverity.ERROR for i in issues)
    assert validator.is_valid(strategy) is True

    # Clean
    strategy = {
        "rules": [
            {"action": {"type": "ENTER_LONG"}},
            {"action": {"type": "EXIT_LONG"}}
        ],
        "position_sizing": {"value": 1}
    }
    assert validator.is_valid(strategy) is True
