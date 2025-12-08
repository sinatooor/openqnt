"""
AST-based Blockly XML Parser

This module provides a proper XML→AST→Python pipeline for parsing Blockly strategy blocks.
It replaces the regex-based parsing with a tree-based approach that can handle:
- Nested conditions
- Variables and references
- Complex block trees
- Compound boolean expressions
"""

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Union
from enum import Enum


class NodeType(Enum):
    """Types of AST nodes"""
    INDICATOR = "indicator"
    CONDITION = "condition"
    OPERATOR = "operator"
    LITERAL = "literal"
    VARIABLE = "variable"
    TRADE_ACTION = "trade_action"
    RISK_MANAGEMENT = "risk_management"
    PRICE_DATA = "price_data"


@dataclass
class ASTNode:
    """Base AST node"""
    node_type: NodeType
    block_type: str
    children: List['ASTNode'] = field(default_factory=list)
    fields: Dict[str, Any] = field(default_factory=dict)
    mutations: Dict[str, Any] = field(default_factory=dict)
    
    def __repr__(self):
        return f"ASTNode({self.node_type.value}, {self.block_type}, fields={self.fields})"


@dataclass
class IndicatorNode(ASTNode):
    """Indicator-specific AST node"""
    indicator_type: str = ""
    period: int = 14
    params: Dict[str, Any] = field(default_factory=dict)


@dataclass 
class ConditionNode(ASTNode):
    """Condition/comparison AST node"""
    operator: str = ""
    left: Optional[ASTNode] = None
    right: Optional[ASTNode] = None


@dataclass
class TradeActionNode(ASTNode):
    """Trade action AST node (buy, sell, close)"""
    action: str = ""
    direction: str = "long"
    size: float = 0.1
    stop_loss: Optional[ASTNode] = None
    take_profit: Optional[ASTNode] = None


# Block type mappings
INDICATOR_BLOCKS = {
    'ta_sma': 'SMA',
    'ta_ema': 'EMA', 
    'ta_rsi': 'RSI',
    'ta_macd': 'MACD',
    'macd_value': 'MACD',
    'ta_bollinger': 'BOLLINGER',
    'bollinger_upper': 'BOLLINGER_UPPER',
    'bollinger_lower': 'BOLLINGER_LOWER',
    'bollinger_middle': 'BOLLINGER_MIDDLE',
    'ta_stochastic': 'STOCHASTIC',
    'stoch_k': 'STOCH_K',
    'stoch_d': 'STOCH_D',
    'ta_atr': 'ATR',
    'ta_vwap': 'VWAP',
    'ta_cci': 'CCI',
    'ta_williams_r': 'WILLIAMS_R',
    'ta_adx': 'ADX',
    'ta_dmi': 'DMI',
    'donchian': 'DONCHIAN',
    'ta_keltner': 'KELTNER',
    'ta_sar': 'SAR',
    'ta_supertrend': 'SUPERTREND',
    'ta_mfi': 'MFI',
    'ta_obv': 'OBV',
    'momentum': 'MOMENTUM',
    'ta_highest': 'HIGHEST',
    'ta_lowest': 'LOWEST',
}

OPERATOR_BLOCKS = {
    'operator_greater': '>',
    'operator_less': '<',
    'operator_greater_equals': '>=',
    'operator_less_equals': '<=',
    'operator_equals': '==',
    'operator_not_equals': '!=',
    'operator_and': 'and',
    'operator_or': 'or',
    'operator_not': 'not',
    'operator_add': '+',
    'operator_subtract': '-',
    'operator_multiply': '*',
    'operator_divide': '/',
    'logic_compare': 'compare',  # Has OP field
    'logic_operation': 'logic',  # Has OP field (AND/OR)
    'logic_negate': 'not',
    'math_arithmetic': 'arithmetic',  # Has OP field
}

TRADE_ACTION_BLOCKS = {
    'trade_buy': 'buy',
    'trade_sell': 'sell',
    'trade_order': 'order',
    'trade_close': 'close',
    'trade_close_all': 'close_all',
    'trade_stop_loss': 'stop_loss',
    'trade_take_profit': 'take_profit',
}

RISK_MANAGEMENT_BLOCKS = {
    'risk_trailing_stop': 'trailing_stop',
    'risk_scale_in': 'scale_in',
    'risk_scale_out': 'scale_out',
    'risk_max_drawdown': 'max_drawdown',
    'risk_daily_loss_limit': 'daily_loss_limit',
}

PRICE_DATA_BLOCKS = {
    'price_open': 'Open',
    'price_high': 'High',
    'price_low': 'Low',
    'price_close': 'Close',
    'price_volume': 'Volume',
}


class BlocklyASTParser:
    """
    Parses Blockly XML into an Abstract Syntax Tree (AST).
    
    The parser walks the XML tree and builds a corresponding AST
    that can be traversed to generate Python code.
    """
    
    # Blockly XML namespace
    NS = {'blockly': 'https://developers.google.com/blockly/xml'}
    
    def __init__(self):
        self.variables: Dict[str, ASTNode] = {}
        self.indicators: List[IndicatorNode] = []
        self.conditions: List[ConditionNode] = []
        self.trade_actions: List[TradeActionNode] = []
        self.risk_management: Dict[str, Any] = {}
        self.root_nodes: List[ASTNode] = []
        self.has_namespace: bool = False
    
    def _find_all(self, element: ET.Element, tag: str) -> List[ET.Element]:
        """Find all child elements with given tag, handling namespace"""
        # Try without namespace first
        results = element.findall(tag)
        if results:
            return results
        
        # Try with namespace
        if self.has_namespace:
            ns_tag = f"{{https://developers.google.com/blockly/xml}}{tag}"
            results = [e for e in element if e.tag == ns_tag or e.tag.endswith(f'}}{tag}')]
            if results:
                return results
        
        # Fallback: iterate and match tag ending
        return [e for e in element if e.tag == tag or e.tag.endswith(f'}}{tag}')]
    
    def _find(self, element: ET.Element, tag: str) -> Optional[ET.Element]:
        """Find first child element with given tag, handling namespace"""
        results = self._find_all(element, tag)
        return results[0] if results else None
        
    def parse(self, xml_string: str) -> Dict[str, Any]:
        """
        Parse Blockly XML and return structured strategy data.
        
        Args:
            xml_string: The Blockly XML string
            
        Returns:
            Dict containing parsed strategy components
        """
        # Clean up XML string
        xml_string = xml_string.strip()
        if not xml_string:
            return self._empty_result()
        
        try:
            root = ET.fromstring(xml_string)
        except ET.ParseError as e:
            print(f"XML Parse Error: {e}")
            return self._empty_result()
        
        # Check if namespace is present
        self.has_namespace = root.tag.startswith('{')
        
        # Find all blocks - handle namespace
        if self.has_namespace:
            # Iterate through all elements to find blocks
            blocks = [e for e in root.iter() if e.tag.endswith('}block') or e.tag == 'block']
        else:
            blocks = root.findall('.//block')
        
        # Parse all blocks
        for block in blocks:
            node = self._parse_block(block)
            if node:
                self.root_nodes.append(node)
        
        # Build result dictionary
        return self._build_result()
    
    def _parse_block(self, block: ET.Element) -> Optional[ASTNode]:
        """Parse a single block element into an AST node"""
        block_type = block.get('type', '')
        
        # Determine node type and parse accordingly
        if block_type in INDICATOR_BLOCKS:
            return self._parse_indicator(block, block_type)
        elif block_type in OPERATOR_BLOCKS:
            return self._parse_operator(block, block_type)
        elif block_type in TRADE_ACTION_BLOCKS:
            return self._parse_trade_action(block, block_type)
        elif block_type in RISK_MANAGEMENT_BLOCKS:
            return self._parse_risk_management(block, block_type)
        elif block_type in PRICE_DATA_BLOCKS:
            return self._parse_price_data(block, block_type)
        elif block_type == 'math_number':
            return self._parse_number(block)
        elif block_type == 'variables_get':
            return self._parse_variable_get(block)
        elif block_type == 'variables_set':
            return self._parse_variable_set(block)
        elif block_type.startswith('controls_'):
            return self._parse_control(block, block_type)
        else:
            # Generic block parsing
            return self._parse_generic(block, block_type)
    
    def _parse_indicator(self, block: ET.Element, block_type: str) -> IndicatorNode:
        """Parse an indicator block"""
        indicator_type = INDICATOR_BLOCKS[block_type]
        
        # Extract fields
        fields = self._extract_fields(block)
        mutations = self._extract_mutations(block)
        
        # Determine period from various sources
        period = (
            int(mutations.get('ma_period', 0)) or
            int(fields.get('PERIOD', 0)) or
            int(mutations.get('period', 0)) or
            14  # default
        )
        
        # Build params based on indicator type
        params = {}
        
        if indicator_type == 'MACD':
            params = {
                'fast': int(mutations.get('fastema', mutations.get('fast_period', 12))),
                'slow': int(mutations.get('slowema', mutations.get('slow_period', 26))),
                'signal': int(mutations.get('signalsma', mutations.get('signal_period', 9))),
            }
        elif indicator_type == 'BOLLINGER':
            params = {
                'period': int(mutations.get('bb_period', period)),
                'std': float(mutations.get('bb_std', 2.0)),
            }
        elif indicator_type == 'STOCHASTIC':
            params = {
                'k_period': int(mutations.get('k_period', 14)),
                'd_period': int(mutations.get('d_period', 3)),
            }
        elif indicator_type == 'KELTNER':
            params = {
                'period': period,
                'multiplier': float(mutations.get('deviation', 2.0)),
                'component': fields.get('COMPONENT', 'middle'),
            }
        elif indicator_type == 'SAR':
            params = {
                'step': float(mutations.get('step', 0.02)),
                'maximum': float(mutations.get('maximum', 0.2)),
            }
        elif indicator_type == 'SUPERTREND':
            params = {
                'period': period,
                'multiplier': float(mutations.get('multiplier', 3.0)),
            }
        elif indicator_type == 'DONCHIAN':
            params = {
                'period': period,
                'component': fields.get('COMPONENT', 'upper'),
            }
        elif indicator_type == 'DMI':
            params = {
                'period': period,
                'component': fields.get('COMPONENT', 'adx'),
            }
        else:
            params = {'period': period}
        
        node = IndicatorNode(
            node_type=NodeType.INDICATOR,
            block_type=block_type,
            indicator_type=indicator_type,
            period=period,
            params=params,
            fields=fields,
            mutations=mutations,
        )
        
        # Track indicator
        self.indicators.append(node)
        
        return node
    
    def _parse_operator(self, block: ET.Element, block_type: str) -> ConditionNode:
        """Parse an operator/comparison block"""
        operator = OPERATOR_BLOCKS[block_type]
        
        # Handle blocks with OP field (logic_compare, math_arithmetic, etc.)
        fields = self._extract_fields(block)
        if 'OP' in fields:
            op_map = {
                'EQ': '==', 'NEQ': '!=', 'LT': '<', 'LTE': '<=', 
                'GT': '>', 'GTE': '>=',
                'AND': 'and', 'OR': 'or',
                'ADD': '+', 'MINUS': '-', 'MULTIPLY': '*', 'DIVIDE': '/',
            }
            operator = op_map.get(fields['OP'], operator)
        
        # Parse left and right operands
        left = None
        right = None
        
        for value in self._find_all(block, 'value'):
            name = value.get('name', '')
            child_block = self._find(value, 'block') or self._find(value, 'shadow')
            if child_block is not None:
                child_node = self._parse_block(child_block)
                if name in ('A', 'LEFT', 'BOOL'):
                    left = child_node
                elif name in ('B', 'RIGHT'):
                    right = child_node
        
        node = ConditionNode(
            node_type=NodeType.CONDITION,
            block_type=block_type,
            operator=operator,
            left=left,
            right=right,
            fields=fields,
        )
        
        # Track conditions
        self.conditions.append(node)
        
        return node
    
    def _parse_trade_action(self, block: ET.Element, block_type: str) -> TradeActionNode:
        """Parse a trade action block"""
        action = TRADE_ACTION_BLOCKS[block_type]
        fields = self._extract_fields(block)
        
        # Extract direction
        direction = fields.get('DIRECTION', 'long').lower()
        if direction not in ('long', 'short'):
            direction = 'long'
        
        # Extract size
        size = float(fields.get('SIZE', 0.1))
        
        # Parse nested SL/TP
        stop_loss = None
        take_profit = None
        
        for value in self._find_all(block, 'value'):
            name = value.get('name', '')
            child_block = self._find(value, 'block') or self._find(value, 'shadow')
            if child_block is not None:
                if name == 'SL' or name == 'STOP_LOSS':
                    stop_loss = self._parse_block(child_block)
                elif name == 'TP' or name == 'TAKE_PROFIT':
                    take_profit = self._parse_block(child_block)
        
        node = TradeActionNode(
            node_type=NodeType.TRADE_ACTION,
            block_type=block_type,
            action=action,
            direction=direction,
            size=size,
            stop_loss=stop_loss,
            take_profit=take_profit,
            fields=fields,
        )
        
        self.trade_actions.append(node)
        
        return node
    
    def _parse_risk_management(self, block: ET.Element, block_type: str) -> ASTNode:
        """Parse a risk management block"""
        rm_type = RISK_MANAGEMENT_BLOCKS[block_type]
        fields = self._extract_fields(block)
        
        # Extract values from nested blocks if fields are empty
        values = {}
        for value in self._find_all(block, 'value'):
            name = value.get('name', '')
            child = self._find(value, 'block') or self._find(value, 'shadow')
            if child is not None:
                child_type = child.get('type', '')
                if child_type == 'math_number' or child_type.endswith('}math_number'):
                    num_field = self._find(child, 'field')
                    if num_field is not None and num_field.get('name') == 'NUM' and num_field.text:
                        values[name] = float(num_field.text)
        
        # Merge values into fields
        fields.update(values)
        
        # Store in risk management dict
        if rm_type == 'trailing_stop':
            self.risk_management['trailing_stop_pct'] = float(fields.get('PERCENT', 2.0))
        elif rm_type == 'max_drawdown':
            self.risk_management['max_drawdown_pct'] = float(fields.get('PERCENT', 10.0))
        elif rm_type == 'daily_loss_limit':
            self.risk_management['daily_loss_limit'] = float(fields.get('AMOUNT', 500.0))
        elif rm_type == 'scale_in':
            self.risk_management['scale_in'] = {
                'amount': float(fields.get('AMOUNT', 0.25)),
                'intervals': int(fields.get('INTERVALS', 4)),
            }
        elif rm_type == 'scale_out':
            self.risk_management['scale_out'] = {
                'amount': float(fields.get('AMOUNT', 0.25)),
                'intervals': int(fields.get('INTERVALS', 4)),
            }
        
        return ASTNode(
            node_type=NodeType.RISK_MANAGEMENT,
            block_type=block_type,
            fields=fields,
        )
    
    def _parse_price_data(self, block: ET.Element, block_type: str) -> ASTNode:
        """Parse a price data block"""
        price_field = PRICE_DATA_BLOCKS[block_type]
        
        return ASTNode(
            node_type=NodeType.PRICE_DATA,
            block_type=block_type,
            fields={'price': price_field},
        )
    
    def _parse_number(self, block: ET.Element) -> ASTNode:
        """Parse a math_number block"""
        # Find the NUM field using namespace-aware method
        num_field = None
        for f in self._find_all(block, 'field'):
            if f.get('name') == 'NUM':
                num_field = f
                break
        value = float(num_field.text) if num_field is not None and num_field.text else 0.0
        
        return ASTNode(
            node_type=NodeType.LITERAL,
            block_type='math_number',
            fields={'value': value},
        )
    
    def _parse_variable_get(self, block: ET.Element) -> ASTNode:
        """Parse a variables_get block"""
        var_field = None
        for f in self._find_all(block, 'field'):
            if f.get('name') == 'VAR':
                var_field = f
                break
        var_name = var_field.text if var_field is not None else 'unnamed'
        
        return ASTNode(
            node_type=NodeType.VARIABLE,
            block_type='variables_get',
            fields={'name': var_name, 'action': 'get'},
        )
    
    def _parse_variable_set(self, block: ET.Element) -> ASTNode:
        """Parse a variables_set block"""
        var_field = None
        for f in self._find_all(block, 'field'):
            if f.get('name') == 'VAR':
                var_field = f
                break
        var_name = var_field.text if var_field is not None else 'unnamed'
        
        # Parse the value being assigned
        value_node = None
        for value_elem in self._find_all(block, 'value'):
            if value_elem.get('name') == 'VALUE':
                child = self._find(value_elem, 'block') or self._find(value_elem, 'shadow')
                if child is not None:
                    value_node = self._parse_block(child)
                break
        
        node = ASTNode(
            node_type=NodeType.VARIABLE,
            block_type='variables_set',
            fields={'name': var_name, 'action': 'set'},
            children=[value_node] if value_node else [],
        )
        
        # Store variable reference
        self.variables[var_name] = node
        
        return node
    
    def _parse_control(self, block: ET.Element, block_type: str) -> ASTNode:
        """Parse control flow blocks (if, for, etc.)"""
        fields = self._extract_fields(block)
        children = []
        
        # Parse all value inputs (conditions, loop bounds, etc.)
        for value in self._find_all(block, 'value'):
            child = self._find(value, 'block') or self._find(value, 'shadow')
            if child is not None:
                node = self._parse_block(child)
                if node:
                    children.append(node)
        
        # Parse statement blocks (do, else, etc.)
        for statement in self._find_all(block, 'statement'):
            child = self._find(statement, 'block')
            if child is not None:
                node = self._parse_block(child)
                if node:
                    children.append(node)
        
        return ASTNode(
            node_type=NodeType.CONDITION,
            block_type=block_type,
            fields=fields,
            children=children,
        )
    
    def _parse_generic(self, block: ET.Element, block_type: str) -> ASTNode:
        """Parse a generic/unknown block"""
        fields = self._extract_fields(block)
        mutations = self._extract_mutations(block)
        children = []
        
        # Parse nested blocks
        for value in self._find_all(block, 'value'):
            child = self._find(value, 'block') or self._find(value, 'shadow')
            if child is not None:
                node = self._parse_block(child)
                if node:
                    children.append(node)
        
        for statement in self._find_all(block, 'statement'):
            child = self._find(statement, 'block')
            if child is not None:
                node = self._parse_block(child)
                if node:
                    children.append(node)
        
        # Parse next block in chain
        next_elem = self._find(block, 'next')
        if next_elem is not None:
            next_block = self._find(next_elem, 'block')
            if next_block is not None:
                node = self._parse_block(next_block)
                if node:
                    children.append(node)
        
        return ASTNode(
            node_type=NodeType.CONDITION,  # Default type
            block_type=block_type,
            fields=fields,
            mutations=mutations,
            children=children,
        )
    
    def _extract_fields(self, block: ET.Element) -> Dict[str, Any]:
        """Extract all field values from a block"""
        fields = {}
        for field in self._find_all(block, 'field'):
            name = field.get('name', '')
            value = field.text or ''
            # Try to convert to number if possible
            try:
                if '.' in value:
                    fields[name] = float(value)
                else:
                    fields[name] = int(value)
            except ValueError:
                fields[name] = value
        return fields
    
    def _extract_mutations(self, block: ET.Element) -> Dict[str, Any]:
        """Extract mutation attributes from a block"""
        mutations = {}
        mutation = self._find(block, 'mutation')
        if mutation is not None:
            for key, value in mutation.attrib.items():
                # Try to convert to number if possible
                try:
                    if '.' in value:
                        mutations[key] = float(value)
                    else:
                        mutations[key] = int(value)
                except ValueError:
                    mutations[key] = value
        return mutations
    
    def _empty_result(self) -> Dict[str, Any]:
        """Return empty result structure"""
        return {
            "indicators": [],
            "conditions": [],
            "entry_direction": "long",
            "has_short_entry": False,
            "sl_pips": None,
            "tp_pips": None,
            "trade_size": 0.1,
            "atr_sl_mult": None,
            "atr_tp_mult": None,
            "risk_management": {},
            "variables": {},
        }
    
    def _build_result(self) -> Dict[str, Any]:
        """Build the final result dictionary from parsed AST"""
        result = self._empty_result()
        
        # Build indicators list
        for ind in self.indicators:
            ind_dict = {
                "type": ind.indicator_type,
                "period": ind.period,
            }
            ind_dict.update(ind.params)
            result["indicators"].append(ind_dict)
        
        # Determine entry direction from trade actions
        for action in self.trade_actions:
            if action.action in ('buy', 'order'):
                if action.direction == 'short':
                    result["has_short_entry"] = True
                    result["entry_direction"] = "short"
                else:
                    result["entry_direction"] = "long"
        
        # Extract SL/TP from trade actions
        for action in self.trade_actions:
            if action.stop_loss:
                if action.stop_loss.node_type == NodeType.LITERAL:
                    result["sl_pips"] = action.stop_loss.fields.get('value')
            if action.take_profit:
                if action.take_profit.node_type == NodeType.LITERAL:
                    result["tp_pips"] = action.take_profit.fields.get('value')
            if action.size > 0:
                result["trade_size"] = action.size
        
        # Check for ATR-based SL/TP
        for action in self.trade_actions:
            if action.stop_loss and action.stop_loss.node_type == NodeType.CONDITION:
                # Look for ATR indicator in the calculation
                self._check_atr_based_sltp(action.stop_loss, result, 'sl')
            if action.take_profit and action.take_profit.node_type == NodeType.CONDITION:
                self._check_atr_based_sltp(action.take_profit, result, 'tp')
        
        # Add conditions info
        for cond in self.conditions:
            result["conditions"].append({
                "type": cond.block_type.replace('operator_', ''),
                "operator": cond.operator,
            })
        
        # Check for compound conditions
        if any(c.operator in ('and', 'or') for c in self.conditions):
            result["has_compound_condition"] = True
        
        # Add risk management
        result["risk_management"] = self.risk_management
        
        # Add variables
        result["variables"] = {name: True for name in self.variables.keys()}
        
        # Log results
        if result.get("risk_management"):
            print(f"Risk management: {result['risk_management']}")
        print(f"Parsed indicators: {[i['type'] for i in result['indicators']]}")
        print(f"Has both long and short entries: {result['has_short_entry']}")
        
        return result
    
    def _check_atr_based_sltp(self, node: ASTNode, result: Dict, sltp_type: str):
        """Check if SL/TP is ATR-based and extract multiplier"""
        # Look for ATR in node tree
        if hasattr(node, 'children'):
            for child in node.children:
                if isinstance(child, IndicatorNode) and child.indicator_type == 'ATR':
                    # Found ATR, look for multiplier
                    if node.operator == '*':
                        if hasattr(node, 'right') and node.right:
                            if node.right.node_type == NodeType.LITERAL:
                                mult = node.right.fields.get('value', 2.0)
                                if sltp_type == 'sl':
                                    result["atr_sl_mult"] = mult
                                else:
                                    result["atr_tp_mult"] = mult
                self._check_atr_based_sltp(child, result, sltp_type)


def parse_xml_ast(xml: str) -> Dict[str, Any]:
    """
    Parse Blockly XML using AST-based parser.
    
    This is the main entry point for AST-based parsing.
    
    Args:
        xml: Blockly XML string
        
    Returns:
        Parsed strategy dictionary
    """
    parser = BlocklyASTParser()
    return parser.parse(xml)


# Expression generator for converting AST to Python expressions
class ExpressionGenerator:
    """Generates Python expressions from AST nodes"""
    
    def __init__(self):
        self.indicator_vars = {}
        
    def generate(self, node: ASTNode) -> str:
        """Generate Python expression from AST node"""
        if node is None:
            return ""
        
        if isinstance(node, IndicatorNode):
            return self._gen_indicator(node)
        elif isinstance(node, ConditionNode):
            return self._gen_condition(node)
        elif node.node_type == NodeType.LITERAL:
            return str(node.fields.get('value', 0))
        elif node.node_type == NodeType.VARIABLE:
            return node.fields.get('name', 'var')
        elif node.node_type == NodeType.PRICE_DATA:
            price = node.fields.get('price', 'Close')
            return f"self.data.{price}[-1]"
        else:
            return self._gen_generic(node)
    
    def _gen_indicator(self, node: IndicatorNode) -> str:
        """Generate indicator access expression"""
        ind_type = node.indicator_type
        
        # Map indicator type to variable name
        var_names = {
            'SMA': f'sma_{node.period}',
            'EMA': f'ema_{node.period}',
            'RSI': 'rsi',
            'MACD': 'macd',
            'ATR': 'atr',
            'SUPERTREND': 'supertrend',
            'CCI': 'cci',
            'WILLIAMS_R': 'williams_r',
            'ADX': 'adx',
            'MFI': 'mfi',
            'BOLLINGER_UPPER': 'bb_upper',
            'BOLLINGER_LOWER': 'bb_lower',
            'BOLLINGER_MIDDLE': 'bb_middle',
        }
        
        var_name = var_names.get(ind_type, ind_type.lower())
        return f"self.{var_name}[-1]"
    
    def _gen_condition(self, node: ConditionNode) -> str:
        """Generate condition expression"""
        left = self.generate(node.left) if node.left else ""
        right = self.generate(node.right) if node.right else ""
        op = node.operator
        
        if op == 'not':
            return f"not ({left})"
        elif op in ('and', 'or'):
            return f"({left}) {op} ({right})"
        else:
            return f"{left} {op} {right}"
    
    def _gen_generic(self, node: ASTNode) -> str:
        """Generate generic expression"""
        if node.children:
            parts = [self.generate(child) for child in node.children if child]
            return " ".join(filter(None, parts))
        return ""


def generate_condition_code(parsed: Dict[str, Any], conditions: List[ConditionNode]) -> str:
    """
    Generate Python condition code from parsed conditions.
    
    Args:
        parsed: Parsed strategy dict
        conditions: List of condition AST nodes
        
    Returns:
        Python condition expression string
    """
    if not conditions:
        return "True"
    
    gen = ExpressionGenerator()
    parts = []
    
    for cond in conditions:
        if isinstance(cond, ConditionNode):
            expr = gen.generate(cond)
            if expr:
                parts.append(expr)
    
    if not parts:
        return "True"
    
    # Join with 'and' by default
    return " and ".join(parts)
