"""
Tests for StrategyExporter.
Validates Python, JSON, Markdown export functionality.
"""
import pytest
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from strategy_ir import StrategyIR, Rule, Condition, MarketComponent, ActionType, ComparisonOperator, PositionSizing
from strategy_exporter import StrategyExporter


@pytest.fixture
def sample_ir():
    """Create a sample StrategyIR for testing."""
    return StrategyIR(
        name="RSI Reversal",
        timeframe="1d",
        position_sizing=PositionSizing(method="fixed_amount", value=1.0),
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
            ),
            Rule(
                action=ActionType.EXIT_LONG,
                conditions=[
                    Condition(
                        left=MarketComponent(type="RSI", params={"period": 14}),
                        operator=ComparisonOperator.GT,
                        right=70
                    )
                ]
            ),
        ]
    )


def test_export_python(sample_ir):
    """Test Python export produces valid syntax."""
    exporter = StrategyExporter()
    code = exporter.export_python(sample_ir)

    # Check structure
    assert "class RSI_Reversal(Strategy):" in code
    assert "def init(self):" in code
    assert "def next(self):" in code
    assert "self.buy()" in code
    assert "self.position.close()" in code

    # Syntax check
    compile(code, "<string>", "exec")


def test_export_json(sample_ir):
    """Test JSON export is valid and round-trip compatible."""
    exporter = StrategyExporter()
    json_str = exporter.export_json(sample_ir)

    # Parse back
    data = json.loads(json_str)

    assert data["name"] == "RSI Reversal"
    assert data["timeframe"] == "1d"
    assert len(data["rules"]) == 2
    assert data["rules"][0]["action"] == "ENTER_LONG"


def test_export_markdown(sample_ir):
    """Test Markdown export has expected structure."""
    exporter = StrategyExporter()
    md = exporter.export_markdown(sample_ir)

    assert "# Strategy: RSI Reversal" in md
    assert "**Timeframe:** 1d" in md
    assert "## Position Sizing" in md
    assert "## Trading Rules" in md
    assert "### Rule 1: ENTER_LONG" in md
    assert "RSI(period=14)" in md


def test_export_pinescript(sample_ir):
    """Test Pine Script export produces valid structure."""
    exporter = StrategyExporter()
    pine = exporter.export_pinescript(sample_ir)

    assert "//@version=5" in pine
    assert 'strategy("RSI Reversal"' in pine
    assert "ta.rsi(close, 14)" in pine
    assert "strategy.entry" in pine
