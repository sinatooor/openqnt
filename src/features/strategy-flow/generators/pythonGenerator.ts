/**
 * Python Code Generator for Strategy Flow
 * Converts ReactFlow nodes/edges to executable backtesting.py code
 */

import type { StrategyFlowNode, StrategyFlowEdge } from '../types';

interface IndicatorConfig {
  type: string;
  period?: number;
  timeframe?: number;
  params?: Record<string, any>;
}

interface ConditionConfig {
  left: string;
  operator: string;
  right: string | number;
}

interface ActionConfig {
  type: 'buy' | 'sell' | 'close';
  size?: number;
  stopLoss?: number;
  takeProfit?: number;
}

/**
 * Generate Python code from flow nodes and edges
 */
export function generatePythonCode(nodes: StrategyFlowNode[], edges: StrategyFlowEdge[]): string {
  if (nodes.length === 0) {
    return '# No strategy defined\n# Add nodes to create a strategy';
  }

  // Categorize nodes by type (matching actual node types from catalog)
  const indicators = nodes.filter(n => n.type === 'indicator');
  const conditions = nodes.filter(n => n.type === 'condition');
  const actions = nodes.filter(n => n.type === 'action');
  const environment = nodes.filter(n => n.type === 'environment'); // triggers are environment nodes
  const controls = nodes.filter(n => n.type === 'control');
  const variables = nodes.filter(n => n.type === 'variable');

  // Extract configurations
  const indicatorConfigs = indicators.map(extractIndicatorConfig);
  const entryConditions = extractConditions(conditions, 'entry', edges, nodes);
  const exitConditions = extractConditions(conditions, 'exit', edges, nodes);
  const actionConfigs = actions.map(extractActionConfig);
  const envConfigs = environment.map(n => (n.data.params || {}) as Record<string, any>);

  // Generate the code
  return generateBacktestingPyCode({
    indicators: indicatorConfigs,
    entryConditions,
    exitConditions,
    actions: actionConfigs,
    environment: envConfigs,
    nodes,
    edges,
  });
}

function extractIndicatorConfig(node: StrategyFlowNode): IndicatorConfig {
  const data = node.data as any;
  const params = data.params || {};
  const indicatorType = data.indicatorType || '';
  const label = data.label?.toLowerCase() || '';
  
  // Map indicator types from the catalog
  const indicatorMap: Record<string, string> = {
    'sma': 'SMA',
    'ema': 'EMA',
    'smma': 'SMMA',
    'lwma': 'LWMA',
    'dema': 'DEMA',
    'tema': 'TEMA',
    'rsi': 'RSI',
    'macd': 'MACD',
    'bb': 'BBANDS',
    'atr': 'ATR',
    'stochastic': 'STOCH',
    'adx': 'ADX',
    'cci': 'CCI',
    'williamsR': 'WILLR',
    'momentum': 'MOM',
    'obv': 'OBV',
    'vwap': 'VWAP',
    'supertrend': 'SUPERTREND',
    'sar': 'SAR',
    'ichimoku': 'ICHIMOKU',
  };

  // First try to match by indicatorType from node data
  let type = indicatorMap[indicatorType] || 'SMA';
  
  // Fallback to label matching
  if (!indicatorMap[indicatorType]) {
    for (const [key, value] of Object.entries(indicatorMap)) {
      if (label.includes(key.toLowerCase())) {
        type = value;
        break;
      }
    }
  }

  return {
    type,
    period: params.period || 14,
    timeframe: data.timeframe || params.timeframe || 60,
    params,
  };
}

function extractConditions(
  conditionNodes: StrategyFlowNode[], 
  type: 'entry' | 'exit',
  edges: StrategyFlowEdge[],
  allNodes: StrategyFlowNode[]
): ConditionConfig[] {
  return conditionNodes.map(node => {
    const data = node.data as any;
    const conditionType = data.conditionType || 'compare';
    const label = data.label?.toLowerCase() || '';
    
    // Get operator from node data
    let operator = data.operator || '>';
    
    // Map condition types to operators
    if (conditionType === 'crossover') {
      operator = 'crossover';
    } else if (conditionType === 'crossunder') {
      operator = 'crossunder';
    } else if (conditionType === 'threshold' || conditionType === 'compare') {
      operator = data.operator || '>';
    } else if (conditionType === 'range') {
      operator = 'range';
    }
    
    // Find connected indicator(s) via edges
    const incomingEdges = edges.filter(e => e.target === node.id);
    const connectedIndicators = incomingEdges
      .map(e => allNodes.find(n => n.id === e.source))
      .filter(n => n && n.type === 'indicator');
    
    // Build left operand from connected indicator
    let left = 'self.data.Close[-1]';
    if (connectedIndicators.length > 0) {
      const ind = connectedIndicators[0];
      const indData = ind?.data as any;
      const indType = indData?.indicatorType?.toLowerCase() || 'sma';
      const period = indData?.params?.period || 14;
      left = `self.${indType}_${period}[-1]`;
    }
    
    // Get right value from node data
    let right: string | number = data.value || data.threshold || 30;
    
    // For crossover/crossunder, right is the second indicator
    if ((operator === 'crossover' || operator === 'crossunder') && connectedIndicators.length > 1) {
      const ind2 = connectedIndicators[1];
      const indData2 = ind2?.data as any;
      const indType2 = indData2?.indicatorType?.toLowerCase() || 'sma';
      const period2 = indData2?.params?.period || 14;
      right = `self.${indType2}_${period2}`;
      left = left.replace('[-1]', ''); // Remove indexing for crossover
    }

    return { left, operator, right };
  });
}

function extractActionConfig(node: StrategyFlowNode): ActionConfig {
  const data = node.data as any;
  const actionType = data.actionType || 'order';
  const direction = data.direction || 'long';
  const label = data.label?.toLowerCase() || '';
  
  let type: 'buy' | 'sell' | 'close' = 'buy';
  
  // Determine action type from node data
  if (actionType === 'closePosition' || actionType === 'closeAll') {
    type = 'close';
  } else if (actionType === 'order') {
    type = direction === 'short' ? 'sell' : 'buy';
  } else if (label.includes('sell') || label.includes('short')) {
    type = 'sell';
  } else if (label.includes('close') || label.includes('exit')) {
    type = 'close';
  }

  return {
    type,
    size: data.size || 0.1,
    stopLoss: data.stopPrice || data.stopLoss,
    takeProfit: data.takeProfitPrice || data.takeProfit,
  };
}

interface CodeGenContext {
  indicators: IndicatorConfig[];
  entryConditions: ConditionConfig[];
  exitConditions: ConditionConfig[];
  actions: ActionConfig[];
  environment: Record<string, any>[];
  nodes: StrategyFlowNode[];
  edges: StrategyFlowEdge[];
}

function generateBacktestingPyCode(ctx: CodeGenContext): string {
  const { indicators, entryConditions, exitConditions, actions, nodes } = ctx;
  
  // Build indicator calculations
  const indicatorCode = indicators.map((ind, i) => {
    const varName = `${ind.type.toLowerCase()}_${i}`;
    switch (ind.type) {
      case 'SMA':
        return `        self.${varName} = self.I(SMA, self.data.Close, ${ind.period})`;
      case 'EMA':
        return `        self.${varName} = self.I(EMA, self.data.Close, ${ind.period})`;
      case 'RSI':
        return `        self.${varName} = self.I(RSI, self.data.Close, ${ind.period})`;
      case 'MACD':
        return `        self.macd_line, self.macd_signal, self.macd_hist = self.I(MACD, self.data.Close)`;
      case 'BBANDS':
        return `        self.bb_upper, self.bb_middle, self.bb_lower = self.I(BBANDS, self.data.Close, ${ind.period})`;
      case 'ATR':
        return `        self.${varName} = self.I(ATR, self.data.High, self.data.Low, self.data.Close, ${ind.period})`;
      case 'STOCH':
        return `        self.stoch_k, self.stoch_d = self.I(STOCH, self.data.High, self.data.Low, self.data.Close)`;
      case 'ADX':
        return `        self.${varName} = self.I(ADX, self.data.High, self.data.Low, self.data.Close, ${ind.period})`;
      case 'SUPERTREND':
        return `        self.supertrend, self.supertrend_dir = self.I(supertrend, self.data, ${ind.period}, ${ind.params?.multiplier || 3})`;
      default:
        return `        self.${varName} = self.I(SMA, self.data.Close, ${ind.period})  # Fallback`;
    }
  }).join('\n');

  // Build entry conditions
  const entryConditionCode = entryConditions.length > 0
    ? entryConditions.map(c => {
        if (c.operator === 'crossover') {
          return `crossover(${c.left}, ${c.right})`;
        } else if (c.operator === 'crossunder') {
          return `crossunder(${c.left}, ${c.right})`;
        }
        return `${c.left} ${c.operator} ${c.right}`;
      }).join(' and ')
    : 'True  # No entry conditions defined';

  // Build exit conditions
  const exitConditionCode = exitConditions.length > 0
    ? exitConditions.map(c => {
        if (c.operator === 'crossover') {
          return `crossover(${c.left}, ${c.right})`;
        } else if (c.operator === 'crossunder') {
          return `crossunder(${c.left}, ${c.right})`;
        }
        return `${c.left} ${c.operator} ${c.right}`;
      }).join(' and ')
    : 'False  # No exit conditions defined';

  // Determine trade direction
  const buyAction = actions.find(a => a.type === 'buy');
  const sellAction = actions.find(a => a.type === 'sell');
  const positionSize = buyAction?.size || sellAction?.size || 0.1;
  const hasStopLoss = buyAction?.stopLoss || sellAction?.stopLoss;
  const hasTakeProfit = buyAction?.takeProfit || sellAction?.takeProfit;

  // Risk management
  const stopLossCode = hasStopLoss 
    ? `            sl=self.data.Close[-1] * (1 - ${hasStopLoss / 100}),`
    : '';
  const takeProfitCode = hasTakeProfit
    ? `            tp=self.data.Close[-1] * (1 + ${hasTakeProfit / 100}),`
    : '';

  // Generate full strategy code
  return `"""
Strategy Flow Generated Strategy
Generated on: ${new Date().toISOString()}
Nodes: ${nodes.length}
"""

from backtesting import Backtest, Strategy
from backtesting.lib import crossover, crossunder
from backtesting.test import SMA, EMA
import talib
import numpy as np

# Custom indicator wrappers
def RSI(close, period=14):
    return talib.RSI(close, timeperiod=period)

def MACD(close, fast=12, slow=26, signal=9):
    macd, signal_line, hist = talib.MACD(close, fastperiod=fast, slowperiod=slow, signalperiod=signal)
    return macd, signal_line, hist

def BBANDS(close, period=20, nbdevup=2, nbdevdn=2):
    upper, middle, lower = talib.BBANDS(close, timeperiod=period, nbdevup=nbdevup, nbdevdn=nbdevdn)
    return upper, middle, lower

def ATR(high, low, close, period=14):
    return talib.ATR(high, low, close, timeperiod=period)

def STOCH(high, low, close, fastk=14, slowk=3, slowd=3):
    slowk, slowd = talib.STOCH(high, low, close, fastk_period=fastk, slowk_period=slowk, slowd_period=slowd)
    return slowk, slowd

def ADX(high, low, close, period=14):
    return talib.ADX(high, low, close, timeperiod=period)

def supertrend(data, period=10, multiplier=3):
    """Supertrend indicator implementation"""
    hl2 = (data.High + data.Low) / 2
    atr = talib.ATR(data.High, data.Low, data.Close, timeperiod=period)
    
    upper_band = hl2 + (multiplier * atr)
    lower_band = hl2 - (multiplier * atr)
    
    supertrend = np.zeros(len(data))
    direction = np.zeros(len(data))
    
    for i in range(1, len(data)):
        if data.Close[i] > upper_band[i-1]:
            supertrend[i] = lower_band[i]
            direction[i] = 1
        elif data.Close[i] < lower_band[i-1]:
            supertrend[i] = upper_band[i]
            direction[i] = -1
        else:
            supertrend[i] = supertrend[i-1]
            direction[i] = direction[i-1]
            
    return supertrend, direction


class FlowStrategy(Strategy):
    """Strategy generated from Strategy Flow canvas"""
    
    # Strategy parameters (can be optimized)
    position_size = ${positionSize}
    
    def init(self):
        """Initialize indicators"""
${indicatorCode || '        pass  # No indicators defined'}
        
    def next(self):
        """Execute strategy logic on each bar"""
        # Skip if we don't have enough data
        if len(self.data) < 20:
            return
            
        # Entry Logic
        entry_condition = ${entryConditionCode}
        
        # Exit Logic  
        exit_condition = ${exitConditionCode}
        
        # Execute trades
        if not self.position:
            if entry_condition:
                self.buy(
                    size=self.position_size,
${stopLossCode}
${takeProfitCode}
                )
        else:
            if exit_condition:
                self.position.close()


# Export strategy class for backtesting
Strategy = FlowStrategy
`;
}

/**
 * Generate a summary of the strategy in plain text
 */
export function generateStrategySummary(nodes: StrategyFlowNode[], edges: StrategyFlowEdge[]): string {
  if (nodes.length === 0) {
    return 'Empty strategy - no nodes defined';
  }

  const indicators = nodes.filter(n => n.type === 'indicator');
  const conditions = nodes.filter(n => n.type === 'condition');
  const actions = nodes.filter(n => n.type === 'action');

  let summary = '## Strategy Summary\n\n';
  
  if (indicators.length > 0) {
    summary += '### Indicators\n';
    indicators.forEach(ind => {
      summary += `- ${ind.data.label || ind.data.type}\n`;
    });
    summary += '\n';
  }

  if (conditions.length > 0) {
    summary += '### Conditions\n';
    conditions.forEach(cond => {
      summary += `- ${cond.data.label || cond.data.type}\n`;
    });
    summary += '\n';
  }

  if (actions.length > 0) {
    summary += '### Actions\n';
    actions.forEach(action => {
      summary += `- ${action.data.label || action.data.type}\n`;
    });
  }

  return summary;
}

/**
 * Generate IR (Intermediate Representation) for the strategy
 * This can be used for validation and other transformations
 */
export function generateStrategyIR(nodes: StrategyFlowNode[], edges: StrategyFlowEdge[]) {
  return {
    version: '1.0',
    generated: new Date().toISOString(),
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.type,
      label: n.data.label,
      params: n.data.params,
    })),
    edges: edges.map(e => ({
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
    metadata: {
      indicatorCount: nodes.filter(n => n.type === 'indicator').length,
      conditionCount: nodes.filter(n => n.type === 'condition').length,
      actionCount: nodes.filter(n => n.type === 'action').length,
    },
  };
}
