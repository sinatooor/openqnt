"""
Backtrader Engine for Strategy Flow

Converts flow nodes/edges to backtrader strategies and runs backtests.
"""

from __future__ import annotations
import ast
import backtrader as bt
import talib
import numpy as np
import operator as _op
import pandas as pd
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import json
import os
import io
import tempfile


# ============================================================
# Expression DSL — safe substitute for the legacy Code node.
# Allow-listed identifiers + ast-walker; rejects everything else.
# ============================================================

_DSL_ALLOWED_NAMES = {"talib", "np", "abs", "min", "max", "True", "False", "None"}
_DSL_ALLOWED_TALIB_FUNCS = {"SMA", "EMA", "RSI", "MACD", "BBANDS", "ATR", "STDDEV"}
_DSL_ALLOWED_NP_FUNCS = {"abs", "maximum", "minimum", "sign", "where", "log", "exp", "sqrt"}

_DSL_BINOPS = {
    ast.Add: _op.add, ast.Sub: _op.sub, ast.Mult: _op.mul,
    ast.Div: _op.truediv, ast.FloorDiv: _op.floordiv, ast.Mod: _op.mod,
    ast.Pow: _op.pow,
}
_DSL_CMPOPS = {
    ast.Eq: _op.eq, ast.NotEq: _op.ne, ast.Lt: _op.lt, ast.LtE: _op.le,
    ast.Gt: _op.gt, ast.GtE: _op.ge,
}
_DSL_UNARYOPS = {ast.USub: _op.neg, ast.UAdd: _op.pos, ast.Not: _op.not_}


def _switch_match(value: Any, rule: Dict[str, Any]) -> bool:
    """Evaluate a single switch rule against the input value."""
    op = (rule.get('operator') or 'eq').lower()
    target = rule.get('value')
    try:
        if op == 'eq':
            return value == target
        if op == 'neq':
            return value != target
        if op == 'gt':
            return value > target
        if op == 'gte':
            return value >= target
        if op == 'lt':
            return value < target
        if op == 'lte':
            return value <= target
        if op == 'between':
            lo, hi = target
            return lo <= value <= hi
        if op == 'in':
            return value in target
    except Exception:
        return False
    return False


def _eval_safe_expression(expr: str, bindings: Dict[str, Any]) -> Any:
    """Evaluate `expr` against `bindings` using a restricted AST walker.

    Rejects: imports, function/class defs, attribute access on user inputs,
    lambdas, comprehensions, walrus, starred args, and any name not in
    `_DSL_ALLOWED_NAMES` ∪ bindings. talib.<fn> and np.<fn> are allowed only
    for names in `_DSL_ALLOWED_TALIB_FUNCS` / `_DSL_ALLOWED_NP_FUNCS`.
    """
    tree = ast.parse(expr, mode="eval")

    def walk(node: ast.AST) -> Any:
        if isinstance(node, ast.Expression):
            return walk(node.body)
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float, bool)) or node.value is None:
                return node.value
            raise ValueError("only numeric/boolean/None constants allowed")
        if isinstance(node, ast.Name):
            if node.id in bindings:
                return bindings[node.id]
            if node.id in _DSL_ALLOWED_NAMES:
                if node.id == "talib":
                    return talib
                if node.id == "np":
                    return np
                if node.id == "abs":
                    return abs
                if node.id == "min":
                    return min
                if node.id == "max":
                    return max
                if node.id == "True":
                    return True
                if node.id == "False":
                    return False
                if node.id == "None":
                    return None
            raise ValueError(f"name '{node.id}' is not allowed")
        if isinstance(node, ast.BinOp):
            op_fn = _DSL_BINOPS.get(type(node.op))
            if not op_fn:
                raise ValueError(f"binary op {type(node.op).__name__} not allowed")
            return op_fn(walk(node.left), walk(node.right))
        if isinstance(node, ast.UnaryOp):
            op_fn = _DSL_UNARYOPS.get(type(node.op))
            if not op_fn:
                raise ValueError(f"unary op {type(node.op).__name__} not allowed")
            return op_fn(walk(node.operand))
        if isinstance(node, ast.BoolOp):
            values = [walk(v) for v in node.values]
            if isinstance(node.op, ast.And):
                result = True
                for v in values:
                    result = result and v
                return result
            if isinstance(node.op, ast.Or):
                result = False
                for v in values:
                    result = result or v
                return result
            raise ValueError("bool op not allowed")
        if isinstance(node, ast.Compare):
            left = walk(node.left)
            for op_node, comparator in zip(node.ops, node.comparators):
                cmp_fn = _DSL_CMPOPS.get(type(op_node))
                if not cmp_fn:
                    raise ValueError(f"compare op {type(op_node).__name__} not allowed")
                right = walk(comparator)
                if not cmp_fn(left, right):
                    return False
                left = right
            return True
        if isinstance(node, ast.IfExp):
            return walk(node.body) if walk(node.test) else walk(node.orelse)
        if isinstance(node, ast.Attribute):
            # Only allow attribute access on talib / np with allow-listed fn names.
            if isinstance(node.value, ast.Name) and node.value.id in {"talib", "np"}:
                allowed = (_DSL_ALLOWED_TALIB_FUNCS if node.value.id == "talib"
                           else _DSL_ALLOWED_NP_FUNCS)
                if node.attr not in allowed:
                    raise ValueError(f"{node.value.id}.{node.attr} not allowed")
                base = walk(node.value)
                return getattr(base, node.attr)
            raise ValueError("attribute access not allowed")
        if isinstance(node, ast.Call):
            # No keyword args, no starred args.
            if node.keywords:
                raise ValueError("keyword arguments not allowed")
            func = walk(node.func)
            args = [walk(a) for a in node.args]
            return func(*args)
        raise ValueError(f"AST node {type(node).__name__} not allowed in expression DSL")

    return walk(tree)


# ============================================================
# Custom Indicators using TA-Lib
# ============================================================

class TALibIndicator(bt.Indicator):
    """Base class for TA-Lib based indicators."""
    lines = ('value',)
    params = (('period', 14),)
    
    def __init__(self):
        pass
    
    def next(self):
        pass


class TALibRSI(bt.Indicator):
    """RSI using TA-Lib."""
    lines = ('rsi',)
    params = (('period', 14),)
    
    def __init__(self):
        self.addminperiod(self.p.period + 1)
    
    def next(self):
        data = np.array([self.data.close[i] for i in range(-self.p.period - 1, 1)])
        rsi = talib.RSI(data, timeperiod=self.p.period)
        self.lines.rsi[0] = rsi[-1] if not np.isnan(rsi[-1]) else 50


class TALibMACD(bt.Indicator):
    """MACD using TA-Lib."""
    lines = ('macd', 'signal', 'histogram')
    params = (('fast', 12), ('slow', 26), ('signal', 9))
    
    def __init__(self):
        self.addminperiod(self.p.slow + self.p.signal)
    
    def next(self):
        size = self.p.slow + self.p.signal + 10
        data = np.array([self.data.close[i] for i in range(-size, 1)])
        macd, signal, hist = talib.MACD(data, self.p.fast, self.p.slow, self.p.signal)
        self.lines.macd[0] = macd[-1] if not np.isnan(macd[-1]) else 0
        self.lines.signal[0] = signal[-1] if not np.isnan(signal[-1]) else 0
        self.lines.histogram[0] = hist[-1] if not np.isnan(hist[-1]) else 0


class TALibBB(bt.Indicator):
    """Bollinger Bands using TA-Lib."""
    lines = ('upper', 'middle', 'lower')
    params = (('period', 20), ('devfactor', 2.0))
    
    def __init__(self):
        self.addminperiod(self.p.period)
    
    def next(self):
        size = self.p.period + 5
        data = np.array([self.data.close[i] for i in range(-size, 1)])
        upper, middle, lower = talib.BBANDS(
            data, 
            timeperiod=self.p.period, 
            nbdevup=self.p.devfactor, 
            nbdevdn=self.p.devfactor
        )
        self.lines.upper[0] = upper[-1] if not np.isnan(upper[-1]) else self.data.close[0]
        self.lines.middle[0] = middle[-1] if not np.isnan(middle[-1]) else self.data.close[0]
        self.lines.lower[0] = lower[-1] if not np.isnan(lower[-1]) else self.data.close[0]


class TALibATR(bt.Indicator):
    """ATR using TA-Lib."""
    lines = ('atr',)
    params = (('period', 14),)
    
    def __init__(self):
        self.addminperiod(self.p.period + 1)
    
    def next(self):
        size = self.p.period + 5
        high = np.array([self.data.high[i] for i in range(-size, 1)])
        low = np.array([self.data.low[i] for i in range(-size, 1)])
        close = np.array([self.data.close[i] for i in range(-size, 1)])
        atr = talib.ATR(high, low, close, timeperiod=self.p.period)
        self.lines.atr[0] = atr[-1] if not np.isnan(atr[-1]) else 0


class TALibStochastic(bt.Indicator):
    """Stochastic using TA-Lib."""
    lines = ('k', 'd')
    params = (('fastk_period', 14), ('slowk_period', 3), ('slowd_period', 3))
    
    def __init__(self):
        self.addminperiod(self.p.fastk_period + self.p.slowk_period)
    
    def next(self):
        size = self.p.fastk_period + self.p.slowk_period + 5
        high = np.array([self.data.high[i] for i in range(-size, 1)])
        low = np.array([self.data.low[i] for i in range(-size, 1)])
        close = np.array([self.data.close[i] for i in range(-size, 1)])
        slowk, slowd = talib.STOCH(
            high, low, close,
            fastk_period=self.p.fastk_period,
            slowk_period=self.p.slowk_period,
            slowd_period=self.p.slowd_period
        )
        self.lines.k[0] = slowk[-1] if not np.isnan(slowk[-1]) else 50
        self.lines.d[0] = slowd[-1] if not np.isnan(slowd[-1]) else 50


# ============================================================
# Flow Strategy Base Class
# ============================================================

class FlowStrategy(bt.Strategy):
    """
    Base strategy class for Strategy Flow.
    
    Dynamically initializes indicators and evaluates conditions
    based on the compiled flow configuration.
    """
    
    params = (
        ('flow_config', {}),
        ('position_size', 0.1),
        ('stop_loss', None),
        ('take_profit', None),
    )
    
    def __init__(self):
        self.indicators = {}
        self.conditions = {}
        self.order = None
        self.entry_price = None
        
        # Parse flow configuration
        config = self.p.flow_config
        nodes = config.get('nodes', [])
        
        # Initialize indicators from nodes
        for node in nodes:
            if node.get('type') == 'indicator':
                self._init_indicator(node)
    
    def _init_indicator(self, node: Dict[str, Any]):
        """Initialize an indicator from a node definition."""
        node_id = node['id']
        data = node.get('data', {})
        ind_type = data.get('indicatorType', '')
        params = data.get('params', {})
        
        if ind_type == 'sma':
            period = params.get('period', 14)
            self.indicators[node_id] = bt.indicators.SMA(self.data.close, period=period)
        
        elif ind_type == 'ema':
            period = params.get('period', 14)
            self.indicators[node_id] = bt.indicators.EMA(self.data.close, period=period)
        
        elif ind_type == 'rsi':
            period = params.get('period', 14)
            self.indicators[node_id] = TALibRSI(self.data, period=period)
        
        elif ind_type == 'macd':
            fast = params.get('fastPeriod', 12)
            slow = params.get('slowPeriod', 26)
            signal = params.get('signalPeriod', 9)
            self.indicators[node_id] = TALibMACD(self.data, fast=fast, slow=slow, signal=signal)
        
        elif ind_type == 'bb':
            period = params.get('period', 20)
            dev = params.get('deviation', 2)
            self.indicators[node_id] = TALibBB(self.data, period=period, devfactor=dev)
        
        elif ind_type == 'atr':
            period = params.get('period', 14)
            self.indicators[node_id] = TALibATR(self.data, period=period)
        
        elif ind_type == 'stochastic':
            k_period = params.get('kPeriod', 14)
            slow_k = params.get('slowK', 3)
            d_period = params.get('dPeriod', 3)
            self.indicators[node_id] = TALibStochastic(
                self.data, 
                fastk_period=k_period, 
                slowk_period=slow_k, 
                slowd_period=d_period
            )
        
        elif ind_type == 'adx':
            period = params.get('period', 14)
            self.indicators[node_id] = bt.indicators.AverageDirectionalMovementIndex(
                self.data, period=period
            )
        
        elif ind_type == 'sar':
            af = params.get('step', 0.02)
            afmax = params.get('max', 0.2)
            self.indicators[node_id] = bt.indicators.ParabolicSAR(
                self.data, af=af, afmax=afmax
            )
        
        elif ind_type in ('dema', 'tema'):
            period = params.get('period', 14)
            if ind_type == 'dema':
                self.indicators[node_id] = bt.indicators.DEMA(self.data.close, period=period)
            else:
                self.indicators[node_id] = bt.indicators.TEMA(self.data.close, period=period)
    
    def notify_order(self, order):
        """Handle order notifications."""
        if order.status in [order.Submitted, order.Accepted]:
            return
        
        if order.status in [order.Completed]:
            if order.isbuy():
                self.entry_price = order.executed.price
            elif order.issell():
                self.entry_price = None
        
        self.order = None
    
    def next(self):
        """Execute strategy logic on each bar."""
        # Skip if we have a pending order
        if self.order:
            return
        
        # Evaluate conditions from flow configuration
        config = self.p.flow_config
        entry_signal, exit_signal = self._evaluate_conditions(config)
        
        # Execute trades
        if not self.position:
            if entry_signal:
                size = self.broker.getcash() * self.p.position_size / self.data.close[0]
                
                # Place order with optional SL/TP
                if self.p.stop_loss and self.p.take_profit:
                    self.buy_bracket(
                        size=size,
                        stopprice=self.data.close[0] * (1 - self.p.stop_loss),
                        limitprice=self.data.close[0] * (1 + self.p.take_profit),
                    )
                else:
                    self.order = self.buy(size=size)
        else:
            if exit_signal:
                self.order = self.close()
    
    def _evaluate_conditions(self, config: Dict[str, Any]) -> Tuple[bool, bool]:
        """
        Evaluate entry and exit conditions from the flow configuration.
        Returns (entry_signal, exit_signal).
        """
        nodes = config.get('nodes', [])
        edges = config.get('edges', [])
        
        # Build adjacency for condition evaluation
        node_map = {n['id']: n for n in nodes}
        incoming = {}
        for edge in edges:
            target = edge.get('target')
            source = edge.get('source')
            incoming.setdefault(target, []).append({
                'source': source,
                'sourceHandle': edge.get('sourceHandle'),
                'targetHandle': edge.get('targetHandle')
            })
        
        # Find action nodes
        action_nodes = [n for n in nodes if n.get('type') == 'action']
        
        entry_signal = False
        exit_signal = False
        
        for action in action_nodes:
            action_data = action.get('data', {})
            action_type = action_data.get('actionType', '')
            direction = action_data.get('direction', 'buy')
            
            # Get incoming signals to this action
            action_inputs = incoming.get(action['id'], [])
            
            for inp in action_inputs:
                source_node = node_map.get(inp['source'])
                if not source_node:
                    continue
                
                # Evaluate the condition chain
                signal = self._evaluate_node(source_node, node_map, incoming)
                
                if action_type == 'order':
                    if direction == 'buy' and signal:
                        entry_signal = True
                    elif direction == 'sell' and signal:
                        exit_signal = True
                elif action_type in ('closePosition', 'closeAll'):
                    if signal:
                        exit_signal = True
        
        return entry_signal, exit_signal
    
    def _evaluate_node(
        self, 
        node: Dict[str, Any], 
        node_map: Dict[str, Dict[str, Any]],
        incoming: Dict[str, List[Dict[str, Any]]]
    ) -> Any:
        """Recursively evaluate a node's value."""
        node_type = node.get('type')
        node_data = node.get('data', {})
        node_id = node['id']
        
        # Indicator nodes return their current value
        if node_type == 'indicator':
            indicator = self.indicators.get(node_id)
            if indicator:
                # Handle multi-line indicators
                if hasattr(indicator, 'lines'):
                    if hasattr(indicator.lines, 'rsi'):
                        return indicator.lines.rsi[0]
                    elif hasattr(indicator.lines, 'macd'):
                        return indicator.lines.macd[0]
                    elif hasattr(indicator.lines, 'k'):
                        return indicator.lines.k[0]
                    elif hasattr(indicator.lines, 'upper'):
                        return indicator.lines.middle[0]
                    elif hasattr(indicator.lines, 'atr'):
                        return indicator.lines.atr[0]
                return indicator[0]
            return 0
        
        # Environment nodes return market data
        if node_type == 'environment':
            env_type = node_data.get('environmentType', 'price')
            if env_type == 'price':
                return self.data.close[0]
            return self.data.close[0]
        
        # Math nodes compute values
        if node_type == 'math':
            math_type = node_data.get('mathType', 'number')
            if math_type == 'number':
                return node_data.get('value', 0)
            
            # Get input values
            inputs = incoming.get(node_id, [])
            input_values = []
            for inp in inputs:
                source = node_map.get(inp['source'])
                if source:
                    input_values.append(self._evaluate_node(source, node_map, incoming))
            
            if len(input_values) >= 2:
                a, b = input_values[0], input_values[1]
                if math_type == 'add':
                    return a + b
                elif math_type == 'subtract':
                    return a - b
                elif math_type == 'multiply':
                    return a * b
                elif math_type == 'divide':
                    return a / b if b != 0 else 0
            return 0
        
        # Condition nodes evaluate to boolean
        if node_type == 'condition':
            cond_type = node_data.get('conditionType', 'compare')
            inputs = incoming.get(node_id, [])
            
            # Get input values
            input_values = []
            for inp in inputs:
                source = node_map.get(inp['source'])
                if source:
                    input_values.append(self._evaluate_node(source, node_map, incoming))
            
            if cond_type == 'threshold':
                if input_values:
                    value = input_values[0]
                    threshold = node_data.get('value', 30)
                    operator = node_data.get('operator', '<')
                    return self._compare(value, operator, threshold)
            
            elif cond_type == 'compare' and len(input_values) >= 2:
                operator = node_data.get('operator', '>')
                return self._compare(input_values[0], operator, input_values[1])
            
            elif cond_type == 'crossover' and len(input_values) >= 2:
                # Crossover: A crosses above B
                fast_ind = self.indicators.get(inputs[0]['source'])
                slow_ind = self.indicators.get(inputs[1]['source'])
                if fast_ind and slow_ind:
                    return (fast_ind[-1] > slow_ind[-1]) and (fast_ind[-2] <= slow_ind[-2])
            
            elif cond_type == 'crossunder' and len(input_values) >= 2:
                # Crossunder: A crosses below B
                fast_ind = self.indicators.get(inputs[0]['source'])
                slow_ind = self.indicators.get(inputs[1]['source'])
                if fast_ind and slow_ind:
                    return (fast_ind[-1] < slow_ind[-1]) and (fast_ind[-2] >= slow_ind[-2])
            
            elif cond_type == 'and' and len(input_values) >= 2:
                return bool(input_values[0]) and bool(input_values[1])
            
            elif cond_type == 'or' and len(input_values) >= 2:
                return bool(input_values[0]) or bool(input_values[1])
            
            elif cond_type == 'not' and input_values:
                return not bool(input_values[0])

        # Expression node: safe DSL over upstream inputs (a, b, c).
        if node_type == 'math' and node_data.get('mathType') == 'expression':
            return self._eval_expression_node(node, node_map, incoming)

        # Switch node: pick an output by matching the input value against rules.
        # Returns the matched outputIndex (or defaultOutputIndex). Bar-loop
        # downstream nodes inspect the index to decide whether to fire.
        if node_type == 'control' and node_data.get('controlType') == 'switch':
            inputs = incoming.get(node_id, [])
            value = None
            if inputs:
                source = node_map.get(inputs[0]['source'])
                if source:
                    value = self._evaluate_node(source, node_map, incoming)
            rules = node_data.get('rules', []) or []
            for rule in rules:
                if _switch_match(value, rule):
                    return int(rule.get('outputIndex', 0))
            return int(node_data.get('defaultOutputIndex', 0))

        # SplitInBatches: bar-loop is per-tick; batching is a workflow-runtime
        # concept. Stub: pass through the list unchanged so downstream nodes
        # receive the data. Real batched iteration is implemented in the TS
        # builder/runtime layer (Phase 4+).
        if node_type == 'control' and node_data.get('controlType') == 'splitInBatches':
            inputs = incoming.get(node_id, [])
            if inputs:
                source = node_map.get(inputs[0]['source'])
                if source:
                    return self._evaluate_node(source, node_map, incoming)
            return []

        return False

    def _eval_expression_node(
        self,
        node: Dict[str, Any],
        node_map: Dict[str, Dict[str, Any]],
        incoming: Dict[str, List[Dict[str, Any]]],
    ) -> float:
        """Evaluate an expression node by resolving its inputs as a/b/c bindings."""
        node_data = node.get('data', {})
        expr_str = (node_data.get('expression') or 'a').strip()
        bindings: Dict[str, Any] = {}
        for inp in incoming.get(node['id'], []):
            handle = (inp.get('targetHandle') or '').strip().lower()
            source = node_map.get(inp.get('source'))
            if not source or handle not in {'a', 'b', 'c'}:
                continue
            bindings[handle] = self._evaluate_node(source, node_map, incoming)
        try:
            return _eval_safe_expression(expr_str, bindings)
        except Exception:
            return 0

    def _compare(self, a: float, operator: str, b: float) -> bool:
        """Compare two values with an operator."""
        if operator == '>':
            return a > b
        elif operator == '>=':
            return a >= b
        elif operator == '<':
            return a < b
        elif operator == '<=':
            return a <= b
        elif operator == '==':
            return abs(a - b) < 0.0001
        elif operator == '!=':
            return abs(a - b) >= 0.0001
        return False


# ============================================================
# Backtest Runner
# ============================================================

def compile_to_backtrader(
    nodes: List[Dict[str, Any]], 
    edges: List[Dict[str, Any]], 
    settings: Optional[Dict[str, Any]] = None
) -> str:
    """
    Compile flow nodes/edges to executable backtrader code.
    
    Returns Python code as a string.
    """
    config = {
        'nodes': nodes,
        'edges': edges,
        'settings': settings or {}
    }
    
    # Generate Python code
    code = f'''"""
Strategy Flow Generated Strategy
Generated: {datetime.now().isoformat()}
"""

import backtrader as bt
import talib
import numpy as np

# Flow configuration
FLOW_CONFIG = {json.dumps(config, indent=2)}

# Custom TA-Lib Indicators
{_get_indicator_classes()}

class FlowStrategy(bt.Strategy):
    params = (
        ('flow_config', FLOW_CONFIG),
        ('position_size', 0.1),
        ('stop_loss', None),
        ('take_profit', None),
    )
    
    def __init__(self):
        self.indicators = {{}}
        self.order = None
        self.entry_price = None
        
        # Initialize indicators
        config = self.p.flow_config
        for node in config.get('nodes', []):
            if node.get('type') == 'indicator':
                self._init_indicator(node)
    
    def _init_indicator(self, node):
        node_id = node['id']
        data = node.get('data', {{}})
        ind_type = data.get('indicatorType', '')
        params = data.get('params', {{}})
        
        if ind_type == 'sma':
            self.indicators[node_id] = bt.indicators.SMA(self.data.close, period=params.get('period', 14))
        elif ind_type == 'ema':
            self.indicators[node_id] = bt.indicators.EMA(self.data.close, period=params.get('period', 14))
        elif ind_type == 'rsi':
            self.indicators[node_id] = TALibRSI(self.data, period=params.get('period', 14))
        elif ind_type == 'macd':
            self.indicators[node_id] = TALibMACD(
                self.data,
                fast=params.get('fastPeriod', 12),
                slow=params.get('slowPeriod', 26),
                signal=params.get('signalPeriod', 9)
            )
        elif ind_type == 'bb':
            self.indicators[node_id] = TALibBB(
                self.data,
                period=params.get('period', 20),
                devfactor=params.get('deviation', 2)
            )
        elif ind_type == 'atr':
            self.indicators[node_id] = TALibATR(self.data, period=params.get('period', 14))
    
    def next(self):
        if self.order:
            return
        
        # Strategy logic will be generated here based on flow
        pass


Strategy = FlowStrategy
'''
    
    return code


def _get_indicator_classes() -> str:
    """Return the indicator class definitions as a string."""
    return '''
class TALibRSI(bt.Indicator):
    lines = ('rsi',)
    params = (('period', 14),)
    
    def __init__(self):
        self.addminperiod(self.p.period + 1)
    
    def next(self):
        data = np.array([self.data.close[i] for i in range(-self.p.period - 1, 1)])
        rsi = talib.RSI(data, timeperiod=self.p.period)
        self.lines.rsi[0] = rsi[-1] if not np.isnan(rsi[-1]) else 50


class TALibMACD(bt.Indicator):
    lines = ('macd', 'signal', 'histogram')
    params = (('fast', 12), ('slow', 26), ('signal', 9))
    
    def __init__(self):
        self.addminperiod(self.p.slow + self.p.signal)
    
    def next(self):
        size = self.p.slow + self.p.signal + 10
        data = np.array([self.data.close[i] for i in range(-size, 1)])
        macd, signal, hist = talib.MACD(data, self.p.fast, self.p.slow, self.p.signal)
        self.lines.macd[0] = macd[-1] if not np.isnan(macd[-1]) else 0
        self.lines.signal[0] = signal[-1] if not np.isnan(signal[-1]) else 0
        self.lines.histogram[0] = hist[-1] if not np.isnan(hist[-1]) else 0


class TALibBB(bt.Indicator):
    lines = ('upper', 'middle', 'lower')
    params = (('period', 20), ('devfactor', 2.0))
    
    def __init__(self):
        self.addminperiod(self.p.period)
    
    def next(self):
        size = self.p.period + 5
        data = np.array([self.data.close[i] for i in range(-size, 1)])
        upper, middle, lower = talib.BBANDS(data, timeperiod=self.p.period, nbdevup=self.p.devfactor, nbdevdn=self.p.devfactor)
        self.lines.upper[0] = upper[-1] if not np.isnan(upper[-1]) else self.data.close[0]
        self.lines.middle[0] = middle[-1] if not np.isnan(middle[-1]) else self.data.close[0]
        self.lines.lower[0] = lower[-1] if not np.isnan(lower[-1]) else self.data.close[0]


class TALibATR(bt.Indicator):
    lines = ('atr',)
    params = (('period', 14),)
    
    def __init__(self):
        self.addminperiod(self.p.period + 1)
    
    def next(self):
        size = self.p.period + 5
        high = np.array([self.data.high[i] for i in range(-size, 1)])
        low = np.array([self.data.low[i] for i in range(-size, 1)])
        close = np.array([self.data.close[i] for i in range(-size, 1)])
        atr = talib.ATR(high, low, close, timeperiod=self.p.period)
        self.lines.atr[0] = atr[-1] if not np.isnan(atr[-1]) else 0
'''


def run_backtest(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    symbol: str = "BTCUSDT",
    start_date: str = "2024-01-01",
    end_date: str = None,
    initial_capital: float = 10000.0,
    position_size: float = 0.1,
    commission: float = 0.001,
    slippage: float = 0.0005,
    leverage: int = 1,
    timeframe: str = "1d"
) -> Dict[str, Any]:
    """
    Run a backtest using backtrader.
    
    Args:
        nodes: Flow node definitions
        edges: Flow edge connections
        symbol: Trading symbol
        start_date: Backtest start date
        end_date: Backtest end date
        initial_capital: Starting capital
        position_size: Position size as fraction of equity
        commission: Commission rate
        slippage: Slippage rate
        leverage: Leverage multiplier
        timeframe: Data timeframe
    
    Returns:
        Dictionary with backtest results
    """
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    # Create flow configuration
    flow_config = {
        'nodes': nodes,
        'edges': edges,
        'settings': {
            'symbol': symbol,
            'timeframe': timeframe
        }
    }
    
    # Initialize Cerebro
    cerebro = bt.Cerebro()
    
    # Set initial capital
    cerebro.broker.setcash(initial_capital * leverage)
    
    # Set commission
    cerebro.broker.setcommission(commission=commission)
    
    # Add strategy
    cerebro.addstrategy(
        FlowStrategy,
        flow_config=flow_config,
        position_size=position_size,
    )
    
    # Get data — let an explicit dataSource node override provider/symbol/timeframe.
    ds_overrides = _resolve_data_source_node(nodes) or {}
    eff_symbol = ds_overrides.get('symbol') or symbol
    eff_timeframe = ds_overrides.get('timeframe') or timeframe
    eff_provider = ds_overrides.get('provider') or 'yfinance'
    try:
        data = _fetch_data(eff_symbol, start_date, end_date, eff_timeframe, provider=eff_provider)
        if data is None or data.empty:
            return {
                'success': False,
                'error': f'No data available for {eff_symbol} via {eff_provider}'
            }
        
        # Convert to backtrader data feed
        bt_data = bt.feeds.PandasData(dataname=data)
        cerebro.adddata(bt_data)
    except Exception as e:
        return {
            'success': False,
            'error': f'Data fetch error: {str(e)}'
        }
    
    # Add analyzers
    cerebro.addanalyzer(bt.analyzers.SharpeRatio, _name='sharpe')
    cerebro.addanalyzer(bt.analyzers.DrawDown, _name='drawdown')
    cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name='trades')
    cerebro.addanalyzer(bt.analyzers.Returns, _name='returns')
    
    # Run backtest
    try:
        results = cerebro.run()
        strat = results[0]
    except Exception as e:
        return {
            'success': False,
            'error': f'Backtest error: {str(e)}'
        }
    
    # Extract results
    final_value = cerebro.broker.getvalue()
    total_return = ((final_value - initial_capital) / initial_capital) * 100
    
    # Get analyzer results
    sharpe = strat.analyzers.sharpe.get_analysis()
    drawdown = strat.analyzers.drawdown.get_analysis()
    trades = strat.analyzers.trades.get_analysis()
    returns = strat.analyzers.returns.get_analysis()
    
    # Calculate metrics
    total_trades = trades.get('total', {}).get('total', 0)
    won_trades = trades.get('won', {}).get('total', 0)
    win_rate = (won_trades / total_trades * 100) if total_trades > 0 else 0
    
    max_dd = drawdown.get('max', {}).get('drawdown', 0)
    sharpe_ratio = sharpe.get('sharperatio', 0) or 0
    
    # Calculate profit factor
    gross_profit = trades.get('won', {}).get('pnl', {}).get('total', 0)
    gross_loss = abs(trades.get('lost', {}).get('pnl', {}).get('total', 0))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
    
    # Build equity curve (simplified)
    equity_curve = []
    
    # Build trade list
    trade_list = []
    
    return {
        'success': True,
        'metrics': {
            'total_return': round(total_return, 2),
            'win_rate': round(win_rate, 2),
            'total_trades': total_trades,
            'max_drawdown': round(max_dd, 2),
            'sharpe_ratio': round(sharpe_ratio, 2),
            'profit_factor': round(profit_factor, 2),
            'sortino_ratio': 0,  # Would need additional calculation
            'calmar_ratio': round(total_return / max_dd, 2) if max_dd > 0 else 0,
            'avg_holding_time': 'N/A'
        },
        'final_balance': round(final_value, 2),
        'equity_curve': equity_curve,
        'trades': trade_list,
        'visualization_html': None  # Could generate with bokeh/plotly
    }


def _resolve_data_source_node(
    nodes: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """
    Scan the flow for the first node with `nodeType: 'dataSource'`. Returns
    its `data` block (provider, symbol, timeframe overrides) when found.
    Strategies without an explicit data-source node fall back to the
    request-level symbol/timeframe.
    """
    for n in nodes or []:
        kind = (n.get('type') or '').lower()
        node_type = (n.get('nodeType') or n.get('data', {}).get('nodeType') or '').lower()
        # ReactFlow nodes serialise as { type: 'dataSource', data: { ...defaultData } }
        if node_type == 'datasource' or kind == 'datasource':
            return n.get('data') or {}
        # Some flows attach the node type at the top level
        if (n.get('data') or {}).get('provider'):
            return n['data']
    return None


def _fetch_data(
    symbol: str,
    start_date: str,
    end_date: str,
    timeframe: str,
    provider: str = 'yfinance',
) -> Optional[pd.DataFrame]:
    """
    Fetch historical OHLCV for backtesting. Provider is one of:
      - 'yfinance' (default)
      - 'avanza'   (uses our integrations.avanza client, anonymous endpoints)
      - 'fmp'      (Financial Modeling Prep, requires FMP_API_KEY)
    Falls through to yfinance if the requested provider isn't usable.
    """
    provider = (provider or 'yfinance').lower()

    if provider == 'avanza':
        df = _fetch_data_avanza(symbol, start_date, end_date, timeframe)
        if df is not None and not df.empty:
            return df
        # fall through to yfinance

    if provider == 'fmp':
        df = _fetch_data_fmp(symbol, start_date, end_date, timeframe)
        if df is not None and not df.empty:
            return df
        # fall through to yfinance

    return _fetch_data_yfinance(symbol, start_date, end_date, timeframe)


def _fetch_data_yfinance(
    symbol: str, start_date: str, end_date: str, timeframe: str,
) -> Optional[pd.DataFrame]:
    try:
        import yfinance as yf

        interval_map = {
            '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
            '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1wk', '1mo': '1mo',
        }
        interval = interval_map.get(timeframe, '1d')

        yf_symbol = symbol
        if symbol.endswith('USDT'):
            yf_symbol = symbol.replace('USDT', '-USD')

        ticker = yf.Ticker(yf_symbol)
        df = ticker.history(start=start_date, end=end_date, interval=interval)
        if df is None or df.empty:
            return None
        df = df.rename(columns={
            'Open': 'open', 'High': 'high', 'Low': 'low',
            'Close': 'close', 'Volume': 'volume',
        })
        return df[['open', 'high', 'low', 'close', 'volume']]
    except Exception as e:
        print(f"yfinance fetch error: {e}")
        return None


def _fetch_data_avanza(
    symbol: str, start_date: str, end_date: str, timeframe: str,
) -> Optional[pd.DataFrame]:
    """
    Resolve a ticker (or ISIN) to an Avanza orderbookId via the anonymous
    search endpoint, then pull `/_api/price-chart`. Both calls hit
    avanza.se directly with httpx.Client so this stays callable from any
    thread regardless of whether an asyncio loop is already running.
    """
    import httpx

    try:
        # Avanza time period bucket — pick the smallest that covers the
        # requested window so the response stays bounded.
        tp = 'one_year'
        try:
            from datetime import datetime as _dt
            d0 = _dt.fromisoformat(start_date)
            d1 = _dt.fromisoformat(end_date)
            days = (d1 - d0).days
            if days <= 7: tp = 'one_week'
            elif days <= 31: tp = 'one_month'
            elif days <= 95: tp = 'three_months'
            elif days <= 370: tp = 'one_year'
            elif days <= 1100: tp = 'three_years'
            elif days <= 1900: tp = 'five_years'
            else: tp = 'infinity'
        except Exception:
            pass

        res_map = {
            '1m': 'minute', '5m': 'minute', '15m': 'thirty_minutes',
            '30m': 'thirty_minutes', '1h': 'hour', '4h': 'hour',
            '1d': 'day', '1w': 'week', '1mo': 'month',
        }
        resolution = res_map.get(timeframe, 'day')

        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; OpenQwnt/1.0)',
            'Accept': 'application/json',
        }
        with httpx.Client(base_url='https://www.avanza.se', timeout=15.0, headers=headers) as client:
            # Resolve the orderbookId. Numeric input passes straight through.
            normalized = symbol.strip().upper()
            orderbook_id: Optional[str] = None
            if normalized.isdigit():
                orderbook_id = normalized
            else:
                try:
                    sresp = client.post(
                        '/_api/search/filtered-search',
                        json={
                            'query': normalized,
                            'searchFilter': {'types': ['STOCK']},
                            'pagination': {'from': 0, 'size': 5},
                        },
                    )
                    sresp.raise_for_status()
                    sdata = sresp.json()
                    hits = sdata.get('hits') or []
                    if not hits and 'resultGroups' in sdata:
                        for grp in sdata.get('resultGroups', []):
                            hits.extend(grp.get('hits', []) or [])
                    chosen = (
                        next((h for h in hits if (h.get('tickerSymbol') or '').upper() == normalized), None)
                        or next((h for h in hits if (h.get('isin') or '').upper() == normalized), None)
                        or (hits[0] if hits else None)
                    )
                    if chosen:
                        orderbook_id = str(chosen.get('orderbookId') or chosen.get('id') or '')
                except Exception as e:
                    print(f"Avanza search({symbol}) failed: {e}")
                    return None

            if not orderbook_id:
                return None

            # Pull the OHLC chart.
            cresp = client.get(
                f'/_api/price-chart/stock/{orderbook_id}',
                params={'timePeriod': tp, 'resolution': resolution},
            )
            cresp.raise_for_status()
            chart = cresp.json()

        ohlc = chart.get('ohlc') or []
        if not ohlc:
            return None
        rows = []
        for r in ohlc:
            ts = r.get('timestamp')
            if ts is None:
                continue
            rows.append({
                'date': pd.Timestamp(ts // 1000 if ts > 1e12 else ts, unit='s'),
                'open': r.get('open'),
                'high': r.get('high'),
                'low': r.get('low'),
                'close': r.get('close'),
                'volume': r.get('totalVolumeTraded') or 0,
            })
        df = pd.DataFrame(rows).dropna(subset=['close']).set_index('date').sort_index()
        try:
            df = df.loc[start_date:end_date]
        except Exception:
            pass
        return df if not df.empty else None
    except Exception as e:
        print(f"Avanza fetch error: {e}")
        return None


def _fetch_data_fmp(
    symbol: str, start_date: str, end_date: str, timeframe: str,
) -> Optional[pd.DataFrame]:
    """FMP historical price endpoint. Daily resolution only."""
    try:
        import os
        import requests

        key = os.getenv('FMP_API_KEY')
        if not key:
            return None
        url = f'https://financialmodelingprep.com/api/v3/historical-price-full/{symbol}'
        r = requests.get(url, params={'from': start_date, 'to': end_date, 'apikey': key}, timeout=15)
        if r.status_code != 200:
            return None
        rows = (r.json() or {}).get('historical') or []
        if not rows:
            return None
        df = pd.DataFrame(rows)
        df['date'] = pd.to_datetime(df['date'])
        df = df.set_index('date').sort_index()
        df = df.rename(columns={
            'open': 'open', 'high': 'high', 'low': 'low',
            'close': 'close', 'volume': 'volume',
        })
        return df[['open', 'high', 'low', 'close', 'volume']]
    except Exception as e:
        print(f"FMP fetch error: {e}")
        return None


