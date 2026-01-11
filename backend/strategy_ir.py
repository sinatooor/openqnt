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
class PositionManagement:
    """
    Advanced position management rules for professional-grade strategies.
    
    Attributes:
        pyramid_enabled: Allow adding to winning positions
        pyramid_max_adds: Maximum number of adds to a position (1 = no pyramiding)
        pyramid_add_size: Size of each pyramid add (same units as position_sizing)
        
        partial_exit_enabled: Allow scaling out of positions
        partial_exit_percent: Percent of position to exit (e.g., 50 for half)
        partial_exit_target: Price target or profit % to trigger partial exit
        
        breakeven_enabled: Move stop to break-even after reaching target
        breakeven_trigger_percent: Profit % to trigger break-even stop
        
        time_exit_enabled: Close position after N bars regardless of P&L
        time_exit_bars: Number of bars before forced exit
    """
    # Pyramiding
    pyramid_enabled: bool = False
    pyramid_max_adds: int = 2
    pyramid_add_size: float = 0.5  # Fraction of original size
    
    # Partial Exits
    partial_exit_enabled: bool = False
    partial_exit_percent: float = 50.0  # Exit 50% of position
    partial_exit_target_percent: float = 5.0  # At 5% profit
    
    # Break-even Stop
    breakeven_enabled: bool = False
    breakeven_trigger_percent: float = 2.0  # Move stop to break-even at 2% profit
    
    # Time-based Exit
    time_exit_enabled: bool = False
    time_exit_bars: int = 10  # Close after 10 bars


@dataclass
class StrategyIR:
    """Complete Strategy Definition"""
    name: str
    rules: List[Rule] = field(default_factory=list)
    position_sizing: PositionSizing = field(default_factory=PositionSizing)
    position_management: PositionManagement = field(default_factory=PositionManagement)
    timeframe: str = "1m"

