import json
import xml.etree.ElementTree as ET
from typing import Dict, Any, List
from rag_system import block_library

class StrategyCompiler:
    def __init__(self):
        self.block_lib = block_library

    def compile(self, strategy_json: Dict[str, Any]) -> str:
        """
        Compile structured JSON strategy into Blockly XML.
        
        Expected JSON format:
        {
            "variables": [
                {"id": "rsi1", "type": "ta_rsi", "params": {"period": 14, "timeframe": 60}}
            ],
            "entry_conditions": [
                {"operator": "operator_less", "left": "rsi1", "right": 30}
            ],
            "exit_conditions": [],
            "action": {
                "type": "trade_order",
                "direction": "long",
                "size": 0.1,
                "sl_atr_mult": 1.5,
                "tp_atr_mult": 3.0
            }
        }
        """
        try:
            # Start with the main wrapper
            root = ET.Element("xml", {"xmlns": "https://developers.google.com/blockly/xml"})
            
            # Create main loop: control_forever -> control_if (new candle)
            forever = ET.SubElement(root, "block", {"type": "control_forever", "x": "50", "y": "50"})
            forever_stmt = ET.SubElement(forever, "statement", {"name": "DO"})
            
            # New candle check
            candle_if = ET.SubElement(forever_stmt, "block", {"type": "control_if"})
            candle_val = ET.SubElement(candle_if, "value", {"name": "CONDITION"})
            new_candle = ET.SubElement(candle_val, "block", {"type": "environment_new_candle_open"})
            ET.SubElement(new_candle, "field", {"name": "TIMEFRAME"}).text = "60" # Default, can be parameterized
            
            candle_do = ET.SubElement(candle_if, "statement", {"name": "DO"})
            
            # Entry Logic
            entry_if = ET.SubElement(candle_do, "block", {"type": "control_if"})
            entry_cond = ET.SubElement(entry_if, "value", {"name": "CONDITION"})
            
            # Build condition tree
            self._build_condition_tree(entry_cond, strategy_json.get("entry_conditions", []), strategy_json.get("variables", []))
            
            # Build action (Trade)
            entry_do = ET.SubElement(entry_if, "statement", {"name": "DO"})
            self._build_trade_action(entry_do, strategy_json.get("action", {}))
            
            return ET.tostring(root, encoding="unicode")
            
        except Exception as e:
            print(f"Compilation error: {e}")
            return ""

    def _build_condition_tree(self, parent_elem, conditions, variables):
        """Recursively build condition blocks."""
        if not conditions:
            return

        # For simplicity, AND all conditions together
        if len(conditions) == 1:
            self._build_single_condition(parent_elem, conditions[0], variables)
        else:
            # Create AND block
            and_block = ET.SubElement(parent_elem, "block", {"type": "operator_and"})
            left_val = ET.SubElement(and_block, "value", {"name": "LEFT"})
            right_val = ET.SubElement(and_block, "value", {"name": "RIGHT"})
            
            # First condition on Left
            self._build_single_condition(left_val, conditions[0], variables)
            
            # Remaining conditions on Right (recursive if > 2)
            if len(conditions) == 2:
                self._build_single_condition(right_val, conditions[1], variables)
            else:
                self._build_condition_tree(right_val, conditions[1:], variables)

    def _build_single_condition(self, parent_elem, condition, variables):
        """Build a single comparison block (e.g., RSI < 30)."""
        op_type = condition.get("operator", "operator_less")
        op_block = ET.SubElement(parent_elem, "block", {"type": op_type})
        
        left_val = ET.SubElement(op_block, "value", {"name": "LEFT"})
        right_val = ET.SubElement(op_block, "value", {"name": "RIGHT"})
        
        self._build_operand(left_val, condition.get("left"), variables)
        self._build_operand(right_val, condition.get("right"), variables)

    def _build_operand(self, parent_elem, operand, variables):
        """Build an operand (variable or number)."""
        if isinstance(operand, (int, float)):
            # Number block
            num_block = ET.SubElement(parent_elem, "shadow", {"type": "math_number"})
            ET.SubElement(num_block, "field", {"name": "NUM"}).text = str(operand)
        elif isinstance(operand, str):
            # Variable lookup
            var_def = next((v for v in variables if v["id"] == operand), None)
            if var_def:
                self._create_indicator_block(parent_elem, var_def)

    def _create_indicator_block(self, parent_elem, var_def):
        """Create an indicator block from definition."""
        b_type = var_def["type"]
        params = var_def.get("params", {})
        
        block = ET.SubElement(parent_elem, "block", {"type": b_type})
        
        # Handle specific fields/mutations based on type
        if b_type == "ta_rsi":
            ET.SubElement(block, "field", {"name": "PERIOD"}).text = str(params.get("timeframe", 60))
            ET.SubElement(block, "field", {"name": "NAME"}).text = "RSI"
            ET.SubElement(block, "mutation", {"ma_period": str(params.get("period", 14)), "applied_price": "0"})
        elif b_type == "ta_sma":
            ET.SubElement(block, "field", {"name": "PERIOD"}).text = str(params.get("timeframe", 60))
            ET.SubElement(block, "field", {"name": "NAME"}).text = "SMA"
            ET.SubElement(block, "mutation", {"ma_period": str(params.get("period", 14)), "shift": "0", "applied_price": "0"})
        # Add more mappings as needed

    def _build_trade_action(self, parent_elem, action):
        """Build trade order block."""
        if not action:
            return
            
        order = ET.SubElement(parent_elem, "block", {"type": "trade_order"})
        ET.SubElement(order, "field", {"name": "TRADE_ID"}).text = "trade_1"
        ET.SubElement(order, "field", {"name": "DIRECTION"}).text = action.get("direction", "long")
        ET.SubElement(order, "field", {"name": "ORDER_TYPE"}).text = "market"
        ET.SubElement(order, "field", {"name": "LEVERAGE"}).text = "1"
        
        size_val = ET.SubElement(order, "value", {"name": "SIZE"})
        size_shadow = ET.SubElement(size_val, "shadow", {"type": "math_number"})
        ET.SubElement(size_shadow, "field", {"name": "NUM"}).text = str(action.get("size", 0.1))

# Singleton
strategy_compiler = StrategyCompiler()
