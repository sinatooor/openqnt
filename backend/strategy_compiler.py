"""
Strategy Compiler - Converts JSON strategy plans to Blockly XML.
Enhanced with full indicator support, SL/TP, and exit conditions.
"""
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional
import uuid


class StrategyCompiler:
    """Compiles structured JSON strategy plans into valid Blockly XML."""
    
    # Indicator configuration: type -> (mutation_attrs, field_configs)
    INDICATOR_CONFIGS = {
        'ta_sma': {
            'mutation': {'ma_period': '14', 'shift': '0', 'applied_price': '0'},
            'fields': {'NAME': 'SMA', 'PERIOD': '60'}
        },
        'ta_ema': {
            'mutation': {'ma_period': '14', 'shift': '0', 'applied_price': '0'},
            'fields': {'NAME': 'EMA', 'PERIOD': '60'}
        },
        'ta_rsi': {
            'mutation': {'ma_period': '14', 'applied_price': '0'},
            'fields': {'NAME': 'RSI', 'PERIOD': '60'}
        },
        'ta_atr': {
            'mutation': {'ma_period': '14'},
            'fields': {'NAME': 'ATR', 'PERIOD': '60'}
        },
        'ta_cci': {
            'mutation': {'ma_period': '14', 'applied_price': '0'},
            'fields': {'NAME': 'CCI', 'PERIOD': '60'}
        },
        'ta_adx': {
            'mutation': {'ma_period': '14'},
            'fields': {'NAME': 'ADX', 'PERIOD': '60'}
        },
        'ta_bb': {
            'mutation': {'ma_period': '20', 'deviation': '2', 'shift': '0', 'applied_price': '0'},
            'fields': {'NAME': 'BB', 'PERIOD': '60', 'COMPONENT': 'middle'}
        },
        'ta_stochastic': {
            'mutation': {'k_period': '14', 'd_period': '3', 'slowing': '3'},
            'fields': {'NAME': 'Stoch', 'PERIOD': '60', 'COMPONENT': 'main'}
        },
        'macd_value': {
            'mutation': {'fastEMA': '12', 'slowEMA': '26', 'signalSMA': '9', 'applied_price': '0'},
            'fields': {'NAME': 'MACD', 'PERIOD': '60', 'COMPONENT': 'line'}
        },
        'ta_supertrend': {
            'mutation': {'ma_period': '10', 'multiplier': '3'},
            'fields': {'NAME': 'SuperTrend', 'PERIOD': '60'}
        },
    }

    # Comparison operators that require different operands
    COMPARISON_OPERATORS = {
        'operator_greater', 'operator_less', 
        'operator_greater_equals', 'operator_less_equals'
    }
    
    # Indicator types that should never be compared with identical params
    INDICATOR_TYPES = {
        'ta_sma', 'ta_ema', 'ta_rsi', 'ta_atr', 'ta_cci', 'ta_adx', 
        'ta_bb', 'ta_stochastic', 'macd_value', 'ta_supertrend',
        'ta_macd', 'ta_lwma', 'ta_smma', 'dema', 'tema', 'momentum',
        'ta_williams_r', 'ta_sar', 'ta_keltner', 'ta_obv', 'ta_mfi'
    }

    def __init__(self):
        self.id_counter = 0
        self.validation_errors = []

    def _gen_id(self, prefix: str = "block") -> str:
        """Generate unique block ID."""
        self.id_counter += 1
        return f"{prefix}_{self.id_counter}"

    def validate_conditions(self, conditions: List[Dict], variables: List[Dict]) -> List[str]:
        """
        Validate conditions for grammar rules.
        Returns list of validation errors.
        """
        errors = []
        
        for i, condition in enumerate(conditions):
            operator = condition.get("operator", "")
            
            # Check if it's a comparison operator
            if operator in self.COMPARISON_OPERATORS:
                left = condition.get("left")
                right = condition.get("right")
                
                # Get variable definitions
                left_var = next((v for v in variables if v.get("id") == left), None) if isinstance(left, str) else None
                right_var = next((v for v in variables if v.get("id") == right), None) if isinstance(right, str) else None
                
                # Rule: Cannot compare two identical indicators
                if left_var and right_var:
                    if self._are_identical_indicators(left_var, right_var):
                        errors.append(
                            f"Condition {i+1}: Cannot compare identical indicators "
                            f"({left_var.get('type')} with same parameters). "
                            f"Use different periods (e.g., Fast vs Slow)."
                        )
        
        return errors

    def _are_identical_indicators(self, var1: Dict, var2: Dict) -> bool:
        """Check if two variable definitions represent identical indicators."""
        type1 = var1.get("type", "")
        type2 = var2.get("type", "")
        
        # Must be same type
        if type1 != type2:
            return False
        
        # Must be an indicator type
        if type1 not in self.INDICATOR_TYPES:
            return False
        
        # Compare params
        params1 = var1.get("params", {})
        params2 = var2.get("params", {})
        
        # Key params to compare
        key_params = ['period', 'ma_period', 'timeframe', 'k_period', 'fastEMA', 'slowEMA']
        
        for param in key_params:
            val1 = params1.get(param)
            val2 = params2.get(param)
            if val1 is not None and val2 is not None and val1 != val2:
                return False  # Different params, not identical
        
        # If same type and same/missing params, they're identical
        return True

    def fix_identical_indicators(self, strategy_json: Dict[str, Any]) -> Dict[str, Any]:
        """
        Auto-fix identical indicators by making them Fast/Slow variants.
        """
        variables = strategy_json.get("variables", [])
        conditions = strategy_json.get("entry_conditions", []) + strategy_json.get("exit_conditions", [])
        
        for condition in conditions:
            operator = condition.get("operator", "")
            if operator in self.COMPARISON_OPERATORS:
                left_id = condition.get("left")
                right_id = condition.get("right")
                
                left_var = next((v for v in variables if v.get("id") == left_id), None) if isinstance(left_id, str) else None
                right_var = next((v for v in variables if v.get("id") == right_id), None) if isinstance(right_id, str) else None
                
                if left_var and right_var and self._are_identical_indicators(left_var, right_var):
                    # Fix: Make left "Fast" (shorter period) and right "Slow" (longer period)
                    ind_type = left_var.get("type", "")
                    
                    # Default periods for Fast/Slow
                    period_configs = {
                        'ta_sma': (10, 20),
                        'ta_ema': (12, 26),
                        'ta_rsi': (7, 14),
                        'ta_cci': (7, 14),
                        'ta_adx': (7, 14),
                        'ta_atr': (7, 14),
                    }
                    
                    fast_period, slow_period = period_configs.get(ind_type, (10, 20))
                    
                    # Update left to Fast
                    if "params" not in left_var:
                        left_var["params"] = {}
                    left_var["params"]["period"] = fast_period
                    left_var["params"]["name"] = f"Fast {ind_type.replace('ta_', '').upper()}"
                    
                    # Update right to Slow
                    if "params" not in right_var:
                        right_var["params"] = {}
                    right_var["params"]["period"] = slow_period
                    right_var["params"]["name"] = f"Slow {ind_type.replace('ta_', '').upper()}"
                    
                    print(f"Auto-fixed identical indicators: {ind_type} -> Fast({fast_period}) vs Slow({slow_period})")
        
        return strategy_json

    def compile(self, strategy_json: Dict[str, Any]) -> str:
        """
        Compile structured JSON strategy into Blockly XML.
        
        Enhanced JSON schema:
        {
            "variables": [
                {"id": "rsi1", "type": "ta_rsi", "params": {"period": 14, "timeframe": 60}}
            ],
            "entry_conditions": [
                {"operator": "operator_less", "left": "rsi1", "right": 30}
            ],
            "exit_conditions": [
                {"operator": "operator_greater", "left": "rsi1", "right": 70}
            ],
            "entry_action": {
                "direction": "long",
                "size": 0.1,
                "sl_pips": 50,
                "tp_pips": 100
            },
            "exit_action": {
                "type": "close_all"
            }
        }
        """
        try:
            self.id_counter = 0
            self.validation_errors = []
            
            # Auto-fix identical indicators before compilation
            strategy_json = self.fix_identical_indicators(strategy_json)
            
            # Create root XML
            root = ET.Element("xml", {"xmlns": "https://developers.google.com/blockly/xml"})
            
            # Main strategy structure: forever -> new_candle_check -> entry_logic
            forever = self._create_forever_block(root)
            candle_check = self._create_candle_check(forever, strategy_json)
            
            # Build entry logic
            entry_conditions = strategy_json.get("entry_conditions", [])
            entry_action = strategy_json.get("entry_action", strategy_json.get("action", {}))
            variables = strategy_json.get("variables", [])
            
            if entry_conditions and entry_action:
                self._build_entry_logic(candle_check, entry_conditions, entry_action, variables)
            
            # Build exit logic if present
            exit_conditions = strategy_json.get("exit_conditions", [])
            exit_action = strategy_json.get("exit_action", {})
            
            if exit_conditions and exit_action:
                self._build_exit_logic(candle_check, exit_conditions, exit_action, variables)
            
            return ET.tostring(root, encoding="unicode")
            
        except Exception as e:
            print(f"Compilation error: {e}")
            import traceback
            traceback.print_exc()
            return ""

    def _create_forever_block(self, root) -> ET.Element:
        """Create the main forever loop."""
        forever = ET.SubElement(root, "block", {
            "type": "control_forever",
            "id": self._gen_id("forever"),
            "x": "50",
            "y": "50"
        })
        return ET.SubElement(forever, "statement", {"name": "DO"})

    def _create_candle_check(self, parent, strategy_json) -> ET.Element:
        """Create new candle check wrapper."""
        timeframe = strategy_json.get("timeframe", 60)
        
        candle_if = ET.SubElement(parent, "block", {
            "type": "control_if",
            "id": self._gen_id("candle_check")
        })
        
        # Condition: new candle
        cond_val = ET.SubElement(candle_if, "value", {"name": "CONDITION"})
        new_candle = ET.SubElement(cond_val, "block", {
            "type": "environment_new_candle_open",
            "id": self._gen_id("new_candle")
        })
        ET.SubElement(new_candle, "field", {"name": "TIMEFRAME"}).text = str(timeframe)
        
        # Return the DO statement for nesting
        return ET.SubElement(candle_if, "statement", {"name": "DO"})

    def _build_entry_logic(self, parent, conditions, action, variables):
        """Build entry condition and trade action."""
        entry_if = ET.SubElement(parent, "block", {
            "type": "control_if",
            "id": self._gen_id("entry_if")
        })
        
        # Build condition tree
        cond_val = ET.SubElement(entry_if, "value", {"name": "CONDITION"})
        self._build_condition_tree(cond_val, conditions, variables)
        
        # Build trade action
        do_stmt = ET.SubElement(entry_if, "statement", {"name": "DO"})
        self._build_trade_order(do_stmt, action)

    def _build_exit_logic(self, parent, conditions, action, variables):
        """Build exit condition and close action."""
        # Add as next block after entry logic
        exit_if = ET.SubElement(parent, "block", {
            "type": "control_if",
            "id": self._gen_id("exit_if")
        })
        
        cond_val = ET.SubElement(exit_if, "value", {"name": "CONDITION"})
        self._build_condition_tree(cond_val, conditions, variables)
        
        do_stmt = ET.SubElement(exit_if, "statement", {"name": "DO"})
        
        # Close action
        if action.get("type") == "close_all":
            close_block = ET.SubElement(do_stmt, "block", {
                "type": "trade_close_all",
                "id": self._gen_id("close_all")
            })

    def _build_condition_tree(self, parent_elem, conditions, variables):
        """Recursively build condition blocks with AND chaining."""
        if not conditions:
            return

        if len(conditions) == 1:
            self._build_single_condition(parent_elem, conditions[0], variables)
        else:
            # AND all conditions together
            and_block = ET.SubElement(parent_elem, "block", {
                "type": "operator_and",
                "id": self._gen_id("and")
            })
            left_val = ET.SubElement(and_block, "value", {"name": "LEFT"})
            right_val = ET.SubElement(and_block, "value", {"name": "RIGHT"})
            
            self._build_single_condition(left_val, conditions[0], variables)
            
            if len(conditions) == 2:
                self._build_single_condition(right_val, conditions[1], variables)
            else:
                self._build_condition_tree(right_val, conditions[1:], variables)

    def _build_single_condition(self, parent_elem, condition, variables):
        """Build a single comparison block."""
        op_type = condition.get("operator", "operator_less")
        op_block = ET.SubElement(parent_elem, "block", {
            "type": op_type,
            "id": self._gen_id("compare")
        })
        
        left_val = ET.SubElement(op_block, "value", {"name": "LEFT"})
        right_val = ET.SubElement(op_block, "value", {"name": "RIGHT"})
        
        self._build_operand(left_val, condition.get("left"), variables)
        self._build_operand(right_val, condition.get("right"), variables)

    def _build_operand(self, parent_elem, operand, variables):
        """Build an operand (variable reference or literal number)."""
        if isinstance(operand, (int, float)):
            # Number literal
            num_shadow = ET.SubElement(parent_elem, "shadow", {
                "type": "math_number",
                "id": self._gen_id("num")
            })
            ET.SubElement(num_shadow, "field", {"name": "NUM"}).text = str(operand)
        elif isinstance(operand, str):
            # Variable reference - find and create indicator block
            var_def = next((v for v in variables if v.get("id") == operand), None)
            if var_def:
                self._create_indicator_block(parent_elem, var_def)
            else:
                # Might be a direct indicator type
                self._create_indicator_block(parent_elem, {"type": operand, "params": {}})

    def _create_indicator_block(self, parent_elem, var_def: Dict):
        """Create an indicator block from variable definition."""
        b_type = var_def.get("type", "ta_sma")
        params = var_def.get("params", {})
        
        # Get config for this indicator type
        config = self.INDICATOR_CONFIGS.get(b_type, {
            'mutation': {},
            'fields': {'NAME': b_type, 'PERIOD': '60'}
        })
        
        block = ET.SubElement(parent_elem, "block", {
            "type": b_type,
            "id": self._gen_id(b_type)
        })
        
        # Build mutation with params overrides
        mutation_attrs = dict(config.get('mutation', {}))
        if 'period' in params:
            # Map period to appropriate mutation attr
            if 'ma_period' in mutation_attrs:
                mutation_attrs['ma_period'] = str(params['period'])
            elif 'k_period' in mutation_attrs:
                mutation_attrs['k_period'] = str(params['period'])
        
        if mutation_attrs:
            ET.SubElement(block, "mutation", mutation_attrs)
        
        # Add fields
        fields = dict(config.get('fields', {}))
        if 'timeframe' in params:
            fields['PERIOD'] = str(params['timeframe'])
        if 'name' in params:
            fields['NAME'] = params['name']
        if 'component' in params:
            fields['COMPONENT'] = params['component']
            
        for field_name, default_value in fields.items():
            ET.SubElement(block, "field", {"name": field_name}).text = default_value

    def _build_trade_order(self, parent_elem, action: Dict):
        """Build trade order with optional SL/TP."""
        if not action:
            return
        
        trade_id = action.get("trade_id", "trade_1")
        direction = action.get("direction", "long")
        size = action.get("size", 0.1)
        
        order = ET.SubElement(parent_elem, "block", {
            "type": "trade_order",
            "id": self._gen_id("order")
        })
        
        ET.SubElement(order, "field", {"name": "TRADE_ID"}).text = trade_id
        ET.SubElement(order, "field", {"name": "DIRECTION"}).text = direction
        ET.SubElement(order, "field", {"name": "ORDER_TYPE"}).text = "market"
        ET.SubElement(order, "field", {"name": "LEVERAGE"}).text = str(action.get("leverage", 1))
        
        # Size
        size_val = ET.SubElement(order, "value", {"name": "SIZE"})
        size_shadow = ET.SubElement(size_val, "shadow", {"type": "math_number"})
        ET.SubElement(size_shadow, "field", {"name": "NUM"}).text = str(size)
        
        # Add SL/TP if specified
        sl_pips = action.get("sl_pips")
        tp_pips = action.get("tp_pips")
        
        if sl_pips or tp_pips:
            next_elem = ET.SubElement(order, "next")
            self._build_sl_tp(next_elem, trade_id, direction, sl_pips, tp_pips)

    def _build_sl_tp(self, parent_elem, trade_id: str, direction: str, sl_pips: Optional[float], tp_pips: Optional[float]):
        """Build stop loss and take profit blocks."""
        current_parent = parent_elem
        
        if sl_pips:
            sl_block = ET.SubElement(current_parent, "block", {
                "type": "trade_stop_loss",
                "id": self._gen_id("sl")
            })
            ET.SubElement(sl_block, "field", {"name": "CLOSE_TYPE"}).text = "full"
            ET.SubElement(sl_block, "field", {"name": "TRADE_ID"}).text = trade_id
            
            # SL price calculation: entry - (ATR * multiplier) for long, entry + for short
            price_val = ET.SubElement(sl_block, "value", {"name": "PRICE"})
            self._build_sl_tp_price(price_val, direction, sl_pips, is_sl=True)
            
            if tp_pips:
                current_parent = ET.SubElement(sl_block, "next")
        
        if tp_pips:
            tp_block = ET.SubElement(current_parent, "block", {
                "type": "trade_take_profit",
                "id": self._gen_id("tp")
            })
            ET.SubElement(tp_block, "field", {"name": "CLOSE_TYPE"}).text = "full"
            ET.SubElement(tp_block, "field", {"name": "TRADE_ID"}).text = trade_id
            
            price_val = ET.SubElement(tp_block, "value", {"name": "PRICE"})
            self._build_sl_tp_price(price_val, direction, tp_pips, is_sl=False)

    def _build_sl_tp_price(self, parent_elem, direction: str, pips: float, is_sl: bool):
        """Build price calculation for SL/TP using entry price +/- pips."""
        # For simplicity, use entry_price +/- a number
        # Long SL: entry - pips, Long TP: entry + pips
        # Short SL: entry + pips, Short TP: entry - pips
        
        is_subtract = (direction == "long" and is_sl) or (direction == "short" and not is_sl)
        op_type = "operator_subtract" if is_subtract else "operator_add"
        
        op_block = ET.SubElement(parent_elem, "block", {
            "type": op_type,
            "id": self._gen_id("sltp_calc")
        })
        
        # Left: entry price
        left_val = ET.SubElement(op_block, "value", {"name": "LEFT"})
        entry_block = ET.SubElement(left_val, "block", {
            "type": "trade_entry_price",
            "id": self._gen_id("entry_price")
        })
        ET.SubElement(entry_block, "field", {"name": "TRADE_ID"}).text = "trade_1"
        
        # Right: pips value
        right_val = ET.SubElement(op_block, "value", {"name": "RIGHT"})
        pips_shadow = ET.SubElement(right_val, "shadow", {"type": "math_number"})
        ET.SubElement(pips_shadow, "field", {"name": "NUM"}).text = str(pips)


# Singleton
strategy_compiler = StrategyCompiler()
