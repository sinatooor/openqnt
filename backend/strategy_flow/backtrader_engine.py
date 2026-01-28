"""
Backtrader Engine for Strategy Flow

Converts flow nodes/edges to backtrader strategies and runs backtests.
"""

from __future__ import annotations
import backtrader as bt
import talib
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import json
import os
import io
import tempfile


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
        
        return False
    
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
    
    # Get data
    try:
        data = _fetch_data(symbol, start_date, end_date, timeframe)
        if data is None or data.empty:
            return {
                'success': False,
                'error': f'No data available for {symbol}'
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


def _fetch_data(
    symbol: str, 
    start_date: str, 
    end_date: str, 
    timeframe: str
) -> Optional[pd.DataFrame]:
    """
    Fetch historical data for backtesting.
    
    Uses yfinance for stocks/crypto, or falls back to sample data.
    """
    try:
        import yfinance as yf
        
        # Map timeframe to yfinance interval
        interval_map = {
            '1m': '1m',
            '5m': '5m',
            '15m': '15m',
            '1h': '1h',
            '4h': '4h',
            '1d': '1d',
            '1w': '1wk'
        }
        interval = interval_map.get(timeframe, '1d')
        
        # Map symbol for yfinance
        yf_symbol = symbol
        if symbol.endswith('USDT'):
            yf_symbol = symbol.replace('USDT', '-USD')
        
        # Fetch data
        ticker = yf.Ticker(yf_symbol)
        df = ticker.history(start=start_date, end=end_date, interval=interval)
        
        if df.empty:
            return None
        
        # Rename columns to match backtrader expectations
        df = df.rename(columns={
            'Open': 'open',
            'High': 'high',
            'Low': 'low',
            'Close': 'close',
            'Volume': 'volume'
        })
        
        # Keep only OHLCV columns
        df = df[['open', 'high', 'low', 'close', 'volume']]
        
        return df
        
    except Exception as e:
        print(f"Data fetch error: {e}")
        return None
