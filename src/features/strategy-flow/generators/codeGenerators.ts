/**
 * StrategyFlow Code Generators
 * Converts ReactFlow nodes/edges to executable code (Python, MQL5, NautilusTrader)
 */

import {
  StrategyFlowNode,
  StrategyFlowEdge,
  IndicatorNodeData,
  ConditionNodeData,
  ActionNodeData,
  EnvironmentNodeData,
  ControlNodeData,
  VariableNodeData,
} from '../types';

// =============================================================================
// GENERATOR INTERFACE
// =============================================================================

export interface GeneratorOutput {
  code: string;
  language: 'python' | 'mql5' | 'nautilus';
  errors: string[];
  warnings: string[];
}

export interface GeneratorOptions {
  leverage?: number;
  symbol?: string;
  timeframe?: string;
  initialCapital?: number;
  beautify?: boolean;
}

// =============================================================================
// TOPOLOGICAL SORT FOR EXECUTION ORDER
// =============================================================================

function topologicalSort(nodes: StrategyFlowNode[], edges: StrategyFlowEdge[]): StrategyFlowNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  nodes.forEach(n => {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  });

  // Build graph
  edges.forEach(e => {
    const targets = adjacency.get(e.source) || [];
    targets.push(e.target);
    adjacency.set(e.source, targets);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  });

  // Kahn's algorithm
  const queue: string[] = [];
  inDegree.forEach((degree, id) => {
    if (degree === 0) queue.push(id);
  });

  const sorted: StrategyFlowNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) sorted.push(node);

    (adjacency.get(id) || []).forEach(targetId => {
      const newDegree = (inDegree.get(targetId) || 1) - 1;
      inDegree.set(targetId, newDegree);
      if (newDegree === 0) queue.push(targetId);
    });
  }

  return sorted;
}

// =============================================================================
// PYTHON GENERATOR (for backtesting.py)
// =============================================================================

export function generatePythonCode(
  nodes: StrategyFlowNode[],
  edges: StrategyFlowEdge[],
  options: GeneratorOptions = {}
): GeneratorOutput {
  const errors: string[] = [];
  const warnings: string[] = [];
  const indicators: string[] = [];
  const conditions: string[] = [];
  const actions: string[] = [];
  const variables: Set<string> = new Set();
  
  const leverage = options.leverage || 1;
  const sortedNodes = topologicalSort(nodes, edges);

  // Process nodes
  sortedNodes.forEach(node => {
    try {
      switch (node.type) {
        case 'indicator':
          indicators.push(generatePythonIndicator(node.data as IndicatorNodeData, node.id));
          break;
        case 'condition':
          conditions.push(generatePythonCondition(node.data as ConditionNodeData, node.id, edges, nodes));
          break;
        case 'action':
          actions.push(generatePythonAction(node.data as ActionNodeData, node.id, leverage));
          break;
        case 'variable':
          const varData = node.data as VariableNodeData;
          if (varData.variableName) variables.add(varData.variableName);
          break;
      }
    } catch (e) {
      errors.push(`Error processing node ${node.id}: ${e}`);
    }
  });

  // Build Python code
  const code = `
from backtesting import Backtest, Strategy
from backtesting.lib import crossover
import numpy as np
import pandas as pd

try:
    import talib
except ImportError:
    talib = None
    print("Warning: TA-Lib not found. Using fallback implementations.")

# =============================================================================
# INDICATOR WRAPPERS
# =============================================================================

def SMA(values, n=14):
    values = np.asarray(values, dtype=float)
    if talib: return talib.SMA(values, timeperiod=n)
    result = np.full_like(values, np.nan)
    for i in range(n - 1, len(values)):
        result[i] = np.mean(values[i - n + 1:i + 1])
    return result

def EMA(values, n=14):
    values = np.asarray(values, dtype=float)
    if talib: return talib.EMA(values, timeperiod=n)
    alpha = 2 / (n + 1)
    result = np.zeros_like(values)
    result[0] = values[0]
    for i in range(1, len(values)):
        result[i] = alpha * values[i] + (1 - alpha) * result[i-1]
    return result

def RSI(values, n=14):
    values = np.asarray(values, dtype=float)
    if talib: return talib.RSI(values, timeperiod=n)
    deltas = np.diff(values)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    avg_gain = np.convolve(gains, np.ones(n)/n, mode='valid')
    avg_loss = np.convolve(losses, np.ones(n)/n, mode='valid')
    rs = avg_gain / (avg_loss + 1e-10)
    rsi = 100 - (100 / (1 + rs))
    return np.concatenate([np.full(n, np.nan), rsi])

def MACD(values, fast=12, slow=26, signal=9):
    values = np.asarray(values, dtype=float)
    if talib:
        macd, signal_line, hist = talib.MACD(values, fastperiod=fast, slowperiod=slow, signalperiod=signal)
        return macd, signal_line, hist
    fast_ema = EMA(values, fast)
    slow_ema = EMA(values, slow)
    macd = fast_ema - slow_ema
    signal_line = EMA(macd, signal)
    hist = macd - signal_line
    return macd, signal_line, hist

def BB(values, n=20, std=2):
    values = np.asarray(values, dtype=float)
    if talib:
        upper, middle, lower = talib.BBANDS(values, timeperiod=n, nbdevup=std, nbdevdn=std)
        return upper, middle, lower
    middle = SMA(values, n)
    rolling_std = np.array([np.std(values[max(0,i-n+1):i+1]) for i in range(len(values))])
    upper = middle + std * rolling_std
    lower = middle - std * rolling_std
    return upper, middle, lower

def ATR(high, low, close, n=14):
    high = np.asarray(high, dtype=float)
    low = np.asarray(low, dtype=float)
    close = np.asarray(close, dtype=float)
    if talib: return talib.ATR(high, low, close, timeperiod=n)
    tr = np.maximum(high - low, np.maximum(abs(high - np.roll(close, 1)), abs(low - np.roll(close, 1))))
    tr[0] = high[0] - low[0]
    return EMA(tr, n)

# =============================================================================
# GENERATED STRATEGY
# =============================================================================

class GeneratedStrategy(Strategy):
    # Parameters
    leverage = ${leverage}
${Array.from(variables).map(v => `    ${v} = 0`).join('\n')}

    def init(self):
        # Initialize indicators
${indicators.map(i => '        ' + i).join('\n') || '        pass'}

    def next(self):
        # Check conditions and execute actions
${conditions.map(c => '        ' + c).join('\n') || '        pass'}
${actions.map(a => '        ' + a).join('\n')}


# =============================================================================
# RUN BACKTEST
# =============================================================================
if __name__ == "__main__":
    # Load your data here
    # data = pd.read_csv("your_data.csv", parse_dates=True, index_col=0)
    # bt = Backtest(data, GeneratedStrategy, cash=10000, commission=0.002)
    # stats = bt.run()
    # print(stats)
    pass
`.trim();

  return { code, language: 'python', errors, warnings };
}

function generatePythonIndicator(data: IndicatorNodeData, nodeId: string): string {
  const params = data.params || {};
  const period = params.period || 14;
  
  switch (data.indicatorType) {
    case 'sma':
      return `self.${nodeId} = self.I(SMA, self.data.Close, ${period})`;
    case 'ema':
      return `self.${nodeId} = self.I(EMA, self.data.Close, ${period})`;
    case 'rsi':
      return `self.${nodeId} = self.I(RSI, self.data.Close, ${period})`;
    case 'macd':
      const fast = params.fastPeriod || 12;
      const slow = params.slowPeriod || 26;
      const signal = params.signalPeriod || 9;
      return `self.${nodeId}_macd, self.${nodeId}_signal, self.${nodeId}_hist = self.I(MACD, self.data.Close, ${fast}, ${slow}, ${signal})`;
    case 'bb':
      const bbPeriod = params.period || 20;
      const stdDev = params.stdDev || 2;
      return `self.${nodeId}_upper, self.${nodeId}_middle, self.${nodeId}_lower = self.I(BB, self.data.Close, ${bbPeriod}, ${stdDev})`;
    case 'atr':
      return `self.${nodeId} = self.I(ATR, self.data.High, self.data.Low, self.data.Close, ${period})`;
    default:
      return `# Indicator ${data.indicatorType} not implemented`;
  }
}

function generatePythonCondition(
  data: ConditionNodeData,
  nodeId: string,
  edges: StrategyFlowEdge[],
  nodes: StrategyFlowNode[]
): string {
  // Find connected inputs
  const inputEdges = edges.filter(e => e.target === nodeId);
  const inputs = inputEdges.map(e => {
    const sourceNode = nodes.find(n => n.id === e.source);
    return sourceNode?.id || 'None';
  });

  switch (data.conditionType) {
    case 'crossover':
      if (inputs.length >= 2) {
        return `if crossover(self.${inputs[0]}, self.${inputs[1]}):`;
      }
      return `# Crossover needs 2 inputs`;
    case 'crossunder':
      if (inputs.length >= 2) {
        return `if crossover(self.${inputs[1]}, self.${inputs[0]}):`;
      }
      return `# Crossunder needs 2 inputs`;
    case 'compare':
    case 'threshold':
      const op = data.operator || '>';
      const value = data.value ?? 50;
      if (inputs.length >= 1) {
        return `if self.${inputs[0]}[-1] ${op} ${value}:`;
      }
      return `# Compare needs input`;
    default:
      return `# Condition ${data.conditionType} handler`;
  }
}

function generatePythonAction(data: ActionNodeData, nodeId: string, leverage: number): string {
  switch (data.actionType) {
    case 'order':
      const size = (data.size || 10) / 100;
      if (data.direction === 'long') {
        return `    self.buy(size=${size})`;
      } else {
        return `    self.sell(size=${size})`;
      }
    case 'closePosition':
    case 'closeAll':
      return `    self.position.close()`;
    case 'stopLoss':
      return `    # Stop loss at ${data.stopPrice}`;
    case 'takeProfit':
      return `    # Take profit at ${data.takeProfitPrice}`;
    case 'log':
      return `    print("${data.message || 'Log message'}")`;
    default:
      return `    # Action ${data.actionType}`;
  }
}

// =============================================================================
// MQL5 GENERATOR
// =============================================================================

export function generateMQL5Code(
  nodes: StrategyFlowNode[],
  edges: StrategyFlowEdge[],
  options: GeneratorOptions = {}
): GeneratorOutput {
  const errors: string[] = [];
  const warnings: string[] = [];
  const indicators: string[] = [];
  const conditions: string[] = [];
  const actions: string[] = [];
  
  const leverage = options.leverage || 1;
  const sortedNodes = topologicalSort(nodes, edges);

  // Process nodes
  sortedNodes.forEach(node => {
    try {
      switch (node.type) {
        case 'indicator':
          indicators.push(generateMQLIndicator(node.data as IndicatorNodeData, node.id));
          break;
        case 'condition':
          conditions.push(generateMQLCondition(node.data as ConditionNodeData, node.id, edges, nodes));
          break;
        case 'action':
          actions.push(generateMQLAction(node.data as ActionNodeData, node.id, leverage));
          break;
      }
    } catch (e) {
      errors.push(`Error processing node ${node.id}: ${e}`);
    }
  });

  const code = `//+------------------------------------------------------------------+
//|                                             Generated Strategy |
//|                        Generated by PPM                        |
//+------------------------------------------------------------------+
#property copyright "Generated by PPM"
#property link      "https://ppm.example.com"
#property version   "1.00"
#property strict

#include <Trade\\Trade.mqh>

CTrade trade;

// Indicator handles
${indicators.map(i => `int ${i.split(' = ')[0]};`).join('\n')}

// Helper functions
double GetIndicatorValue(int handle, int buffer, int shift) {
   double values[];
   if(CopyBuffer(handle, buffer, shift, 1, values) < 0) return 0.0;
   return values[0];
}

void InitTrade() {
   trade.SetExpertMagicNumber(123456);
   trade.SetDeviationInPoints(10);
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
   InitTrade();
   
   // Initialize indicators
${indicators.map(i => '   ' + i).join('\n')}
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
   // Release indicator handles
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick() {
   // Check conditions
${conditions.map(c => '   ' + c).join('\n')}
${actions.map(a => '      ' + a).join('\n')}
}
`.trim();

  return { code, language: 'mql5', errors, warnings };
}

function generateMQLIndicator(data: IndicatorNodeData, nodeId: string): string {
  const params = data.params || {};
  const period = params.period || 14;
  
  switch (data.indicatorType) {
    case 'sma':
      return `handle_${nodeId} = iMA(Symbol(), PERIOD_CURRENT, ${period}, 0, MODE_SMA, PRICE_CLOSE)`;
    case 'ema':
      return `handle_${nodeId} = iMA(Symbol(), PERIOD_CURRENT, ${period}, 0, MODE_EMA, PRICE_CLOSE)`;
    case 'rsi':
      return `handle_${nodeId} = iRSI(Symbol(), PERIOD_CURRENT, ${period}, PRICE_CLOSE)`;
    case 'macd':
      const fast = params.fastPeriod || 12;
      const slow = params.slowPeriod || 26;
      const signal = params.signalPeriod || 9;
      return `handle_${nodeId} = iMACD(Symbol(), PERIOD_CURRENT, ${fast}, ${slow}, ${signal}, PRICE_CLOSE)`;
    case 'bb':
      return `handle_${nodeId} = iBands(Symbol(), PERIOD_CURRENT, ${period}, 0, ${params.stdDev || 2}, PRICE_CLOSE)`;
    case 'atr':
      return `handle_${nodeId} = iATR(Symbol(), PERIOD_CURRENT, ${period})`;
    default:
      return `// Indicator ${data.indicatorType} not implemented`;
  }
}

function generateMQLCondition(
  data: ConditionNodeData,
  nodeId: string,
  edges: StrategyFlowEdge[],
  nodes: StrategyFlowNode[]
): string {
  const inputEdges = edges.filter(e => e.target === nodeId);
  const inputs = inputEdges.map(e => nodes.find(n => n.id === e.source)?.id || '0');

  switch (data.conditionType) {
    case 'crossover':
      if (inputs.length >= 2) {
        return `if(GetIndicatorValue(handle_${inputs[0]}, 0, 1) < GetIndicatorValue(handle_${inputs[1]}, 0, 1) && GetIndicatorValue(handle_${inputs[0]}, 0, 0) > GetIndicatorValue(handle_${inputs[1]}, 0, 0)) {`;
      }
      return `// Crossover needs 2 inputs`;
    case 'compare':
    case 'threshold':
      const op = data.operator || '>';
      const value = data.value ?? 50;
      if (inputs.length >= 1) {
        return `if(GetIndicatorValue(handle_${inputs[0]}, 0, 0) ${op} ${value}) {`;
      }
      return `// Compare needs input`;
    default:
      return `// Condition ${data.conditionType}`;
  }
}

function generateMQLAction(data: ActionNodeData, nodeId: string, leverage: number): string {
  switch (data.actionType) {
    case 'order':
      const lots = ((data.size || 10) / 100) * leverage;
      if (data.direction === 'long') {
        return `trade.Buy(${lots.toFixed(2)}, Symbol());`;
      } else {
        return `trade.Sell(${lots.toFixed(2)}, Symbol());`;
      }
    case 'closePosition':
    case 'closeAll':
      return `trade.PositionClose(Symbol());`;
    case 'log':
      return `Print("${data.message || 'Log message'}");`;
    default:
      return `// Action ${data.actionType}`;
  }
}

// =============================================================================
// NAUTILUS TRADER GENERATOR
// =============================================================================

export function generateNautilusCode(
  nodes: StrategyFlowNode[],
  edges: StrategyFlowEdge[],
  options: GeneratorOptions = {}
): GeneratorOutput {
  const errors: string[] = [];
  const warnings: string[] = [];
  const indicators: string[] = [];
  const conditions: string[] = [];
  const actions: string[] = [];
  
  const sortedNodes = topologicalSort(nodes, edges);

  // Process nodes
  sortedNodes.forEach(node => {
    try {
      switch (node.type) {
        case 'indicator':
          indicators.push(generateNautilusIndicator(node.data as IndicatorNodeData, node.id));
          break;
        case 'condition':
          conditions.push(generateNautilusCondition(node.data as ConditionNodeData, node.id, edges, nodes));
          break;
        case 'action':
          actions.push(generateNautilusAction(node.data as ActionNodeData, node.id));
          break;
      }
    } catch (e) {
      errors.push(`Error processing node ${node.id}: ${e}`);
    }
  });

  const code = `
from decimal import Decimal
import numpy as np

from nautilus_trader.core.data import Data
from nautilus_trader.core.message import Event
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.model.data import Bar, BarType
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.identifiers import InstrumentId, ClientOrderId
from nautilus_trader.model.instruments import Instrument
from nautilus_trader.model.orders import MarketOrder
from nautilus_trader.model.objects import Quantity, Price

from nautilus_trader.indicators import SimpleMovingAverage
from nautilus_trader.indicators import ExponentialMovingAverage
from nautilus_trader.indicators import RelativeStrengthIndex
from nautilus_trader.indicators import AverageTrueRange
from nautilus_trader.indicators import MovingAverageConvergenceDivergence
from nautilus_trader.indicators import BollingerBands

# =============================================================================
# GENERATED STRATEGY
# =============================================================================

class GeneratedStrategy(Strategy):
    """
    A strategy generated from PPM visual builder.
    """

    def __init__(self, config):
        super().__init__(config)
        
        # Indicators
${indicators.map(i => '        ' + i).join('\n') || '        pass'}

    def on_start(self):
        """Called when the strategy is started."""
        self.log.info("Strategy started")
        
        # Subscribe to bar data
        # self.subscribe_bars(bar_type)

    def on_bar(self, bar: Bar):
        """Called when a bar is received."""
        # Update indicators
        for indicator in self.indicators():
            indicator.handle_bar(bar)
        
        # Check conditions
${conditions.map(c => '        ' + c).join('\n') || '        pass'}
${actions.map(a => '            ' + a).join('\n')}

    def on_stop(self):
        """Called when the strategy is stopped."""
        self.log.info("Strategy stopped")
`.trim();

  return { code, language: 'nautilus', errors, warnings };
}

function generateNautilusIndicator(data: IndicatorNodeData, nodeId: string): string {
  const params = data.params || {};
  const period = params.period || 14;
  
  switch (data.indicatorType) {
    case 'sma':
      return `self.${nodeId} = SimpleMovingAverage(${period})`;
    case 'ema':
      return `self.${nodeId} = ExponentialMovingAverage(${period})`;
    case 'rsi':
      return `self.${nodeId} = RelativeStrengthIndex(${period})`;
    case 'atr':
      return `self.${nodeId} = AverageTrueRange(${period})`;
    case 'macd':
      const fast = params.fastPeriod || 12;
      const slow = params.slowPeriod || 26;
      const signal = params.signalPeriod || 9;
      return `self.${nodeId} = MovingAverageConvergenceDivergence(${fast}, ${slow}, ${signal})`;
    case 'bb':
      return `self.${nodeId} = BollingerBands(${period}, ${params.stdDev || 2.0})`;
    default:
      return `# self.${nodeId} = ${data.indicatorType}  # Not implemented`;
  }
}

function generateNautilusCondition(
  data: ConditionNodeData,
  nodeId: string,
  edges: StrategyFlowEdge[],
  nodes: StrategyFlowNode[]
): string {
  const inputEdges = edges.filter(e => e.target === nodeId);
  const inputs = inputEdges.map(e => nodes.find(n => n.id === e.source)?.id || 'None');

  switch (data.conditionType) {
    case 'crossover':
      if (inputs.length >= 2) {
        return `if self.${inputs[0]}.value > self.${inputs[1]}.value:`;
      }
      return `# Crossover condition`;
    case 'threshold':
      const value = data.value ?? 50;
      const op = data.operator || '>';
      if (inputs.length >= 1) {
        return `if self.${inputs[0]}.value ${op} ${value}:`;
      }
      return `# Threshold condition`;
    default:
      return `# Condition ${data.conditionType}`;
  }
}

function generateNautilusAction(data: ActionNodeData, nodeId: string): string {
  switch (data.actionType) {
    case 'order':
      const side = data.direction === 'long' ? 'OrderSide.BUY' : 'OrderSide.SELL';
      return `self.submit_order(MarketOrder(instrument_id=self.instrument.id, order_side=${side}, quantity=Quantity.from_str("1")))`;
    case 'closeAll':
      return `self.close_all_positions(self.instrument.id)`;
    case 'log':
      return `self.log.info("${data.message || 'Log message'}")`;
    default:
      return `# Action ${data.actionType}`;
  }
}

// =============================================================================
// JSON EXPORT (for strategy storage)
// =============================================================================

export function generateJSON(
  nodes: StrategyFlowNode[],
  edges: StrategyFlowEdge[],
  metadata: { name: string; description?: string }
): string {
  return JSON.stringify({
    version: '1.0',
    name: metadata.name,
    description: metadata.description || '',
    nodes,
    edges,
    exportedAt: new Date().toISOString(),
  }, null, 2);
}
