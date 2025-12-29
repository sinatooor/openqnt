"""
Broker-Agnostic Strategy Intermediate Representation (IR)

This module defines the data structures for representing trading strategies
in a way that is independent of any specific broker or execution engine.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Union, Optional
from enum import Enum

class ActionType(Enum):
    """Types of trading actions"""
    ENTER_LONG = "ENTER_LONG"
    ENTER_SHORT = "ENTER_SHORT"
    EXIT_LONG = "EXIT_LONG"
    EXIT_SHORT = "EXIT_SHORT"
    EXIT_ALL = "EXIT_ALL"

class ComparisonOperator(Enum):
    """Comparison operators for conditions"""
    GT = ">"
    LT = "<"
    GTE = ">="
    LTE = "<="
    EQ = "=="
    NEQ = "!="

@dataclass
class MarketComponent:
    """Represents a market data derived value (Price or Indicator)"""
    type: str  # e.g., 'RSI', 'SMA', 'Close', 'Open'
    params: Dict[str, Any] = field(default_factory=dict)
    timeframe: Optional[str] = None

@dataclass
class Condition:
    """A generic condition: Left Operator Right"""
    left: MarketComponent
    operator: ComparisonOperator
    right: Union[MarketComponent, float, int]

@dataclass
class Rule:
    """Trigger an action if all conditions are met"""
    action: ActionType
    conditions: List[Condition] = field(default_factory=list)

@dataclass
class PositionSizing:
    """Configuration for position sizing"""
    method: str = "fixed_amount"  # e.g., 'fixed_amount', 'percent_equity'
    value: float = 1.0

@dataclass
class StrategyIR:
    """Complete Strategy Definition"""
    name: str
    rules: List[Rule] = field(default_factory=list)
    position_sizing: PositionSizing = field(default_factory=PositionSizing)
    timeframe: str = "1m"
