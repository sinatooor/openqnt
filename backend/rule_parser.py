"""
Rule-Based Strategy Parser

Parses human-readable or structured dictionary definitions of strategies
into the strict Strategy Intermediate Representation (IR).
"""
from typing import Dict, Any, List, Union
from .strategy_ir import (
    StrategyIR, Rule, Condition, MarketComponent, 
    ActionType, ComparisonOperator, PositionSizing
)

class RuleParser:
    """
    Parses a dictionary-based strategy definition into the Strategy IR.
    """
    
    def parse(self, data: Dict[str, Any]) -> StrategyIR:
        """
        Convert a raw dictionary definition into a typed StrategyIR object.
        
        Args:
            data: Dictionary containing strategy definition
            
        Returns:
            StrategyIR: The parsed strategy intermediate representation
            
        Raises:
            ValueError: If the definition is invalid
        """
        name = data.get("name", "Untitled Strategy")
        timeframe = data.get("timeframe", "1m")
        
        # Parse Position Sizing
        pos_data = data.get("position_sizing", {})
        position_sizing = PositionSizing(
            method=pos_data.get("method", "fixed_amount"),
            value=float(pos_data.get("value", 1.0))
        )
        
        # Parse Rules
        rules = []
        for rule_data in data.get("rules", []):
            rules.append(self._parse_rule(rule_data))
            
        return StrategyIR(
            name=name,
            rules=rules,
            position_sizing=position_sizing,
            timeframe=timeframe
        )

    def _parse_rule(self, data: Dict[str, Any]) -> Rule:
        action_str = data.get("action", "").upper()
        try:
            action = ActionType(action_str)
        except ValueError:
            raise ValueError(f"Invalid action type: {action_str}")
            
        conditions = []
        for cond_data in data.get("conditions", []):
            conditions.append(self._parse_condition(cond_data))
            
        return Rule(action=action, conditions=conditions)

    def _parse_condition(self, data: Dict[str, Any]) -> Condition:
        if "left" not in data or "operator" not in data or "right" not in data:
            raise ValueError("Condition must have 'left', 'operator', and 'right' fields")

        left = self._parse_component(data.get("left"))
        
        op_str = data.get("operator", "")
        try:
            operator = ComparisonOperator(op_str)
        except ValueError:
            raise ValueError(f"Invalid operator: {op_str}")
            
        right_data = data.get("right")
        right: Union[MarketComponent, float, int]
        
        # Improved number parsing to handle negative numbers and strings
        is_numeric_str = False
        if isinstance(right_data, str):
            try:
                float(right_data)
                is_numeric_str = True
            except ValueError:
                is_numeric_str = False

        if isinstance(right_data, (int, float)):
            right = right_data
        elif is_numeric_str:
            right = float(right_data) # type: ignore
        elif isinstance(right_data, dict):
            right = self._parse_component(right_data)
        elif isinstance(right_data, str):
             right = self._parse_component(right_data)
        else:
             raise ValueError(f"Invalid right-hand operand: {right_data}")
            
        return Condition(left=left, operator=operator, right=right)

    def _parse_component(self, data: Any) -> MarketComponent:
        if isinstance(data, str):
            # Shorthand for simple price types like 'Close', 'Open'
            return MarketComponent(type=data)
        elif isinstance(data, dict):
            return MarketComponent(
                type=data.get("type", "Unknown"),
                params=data.get("params", {})
            )
        else:
            raise ValueError(f"Invalid component definition: {data}")
