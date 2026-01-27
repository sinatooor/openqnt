/**
 * Node Catalog - Complete catalog of all available nodes for the strategy builder
 * This is the ReactFlow equivalent of the Blockly toolbox
 */

import { NodeCatalogItem } from '../types';

// =============================================================================
// INDICATOR NODES
// =============================================================================

export const INDICATOR_NODES: NodeCatalogItem[] = [
  // Moving Averages
  {
    type: 'sma',
    nodeType: 'indicator',
    label: 'SMA',
    description: 'Simple Moving Average - Average price over N periods',
    category: 'indicators',
    subcategory: 'Moving Averages',
    icon: 'TrendingUp',
    color: '#8b5cf6',
    defaultData: {
      indicatorType: 'sma',
      timeframe: '60',
      params: { period: 14, priceType: 'close' },
    },
  },
  {
    type: 'ema',
    nodeType: 'indicator',
    label: 'EMA',
    description: 'Exponential Moving Average - Weighted average giving more weight to recent prices',
    category: 'indicators',
    subcategory: 'Moving Averages',
    icon: 'TrendingUp',
    color: '#8b5cf6',
    defaultData: {
      indicatorType: 'ema',
      timeframe: '60',
      params: { period: 14, priceType: 'close' },
    },
  },
  {
    type: 'smma',
    nodeType: 'indicator',
    label: 'SMMA',
    description: 'Smoothed Moving Average',
    category: 'indicators',
    subcategory: 'Moving Averages',
    icon: 'TrendingUp',
    color: '#8b5cf6',
    defaultData: {
      indicatorType: 'smma',
      timeframe: '60',
      params: { period: 14, priceType: 'close' },
    },
  },
  {
    type: 'lwma',
    nodeType: 'indicator',
    label: 'LWMA',
    description: 'Linear Weighted Moving Average',
    category: 'indicators',
    subcategory: 'Moving Averages',
    icon: 'TrendingUp',
    color: '#8b5cf6',
    defaultData: {
      indicatorType: 'lwma',
      timeframe: '60',
      params: { period: 14, priceType: 'close' },
    },
  },
  {
    type: 'dema',
    nodeType: 'indicator',
    label: 'DEMA',
    description: 'Double Exponential Moving Average',
    category: 'indicators',
    subcategory: 'Moving Averages',
    icon: 'TrendingUp',
    color: '#8b5cf6',
    defaultData: {
      indicatorType: 'dema',
      timeframe: '60',
      params: { period: 14, priceType: 'close' },
    },
  },
  {
    type: 'tema',
    nodeType: 'indicator',
    label: 'TEMA',
    description: 'Triple Exponential Moving Average',
    category: 'indicators',
    subcategory: 'Moving Averages',
    icon: 'TrendingUp',
    color: '#8b5cf6',
    defaultData: {
      indicatorType: 'tema',
      timeframe: '60',
      params: { period: 14, priceType: 'close' },
    },
  },
  {
    type: 'frama',
    nodeType: 'indicator',
    label: 'FRAMA',
    description: 'Fractal Adaptive Moving Average',
    category: 'indicators',
    subcategory: 'Moving Averages',
    icon: 'TrendingUp',
    color: '#8b5cf6',
    defaultData: {
      indicatorType: 'frama',
      timeframe: '60',
      params: { period: 14 },
    },
  },
  {
    type: 'vidya',
    nodeType: 'indicator',
    label: 'VIDYA',
    description: 'Variable Index Dynamic Average',
    category: 'indicators',
    subcategory: 'Moving Averages',
    icon: 'TrendingUp',
    color: '#8b5cf6',
    defaultData: {
      indicatorType: 'vidya',
      timeframe: '60',
      params: { period: 14, cmo_period: 9 },
    },
  },
  {
    type: 'ama',
    nodeType: 'indicator',
    label: 'AMA',
    description: 'Adaptive Moving Average (Kaufman)',
    category: 'indicators',
    subcategory: 'Moving Averages',
    icon: 'TrendingUp',
    color: '#8b5cf6',
    defaultData: {
      indicatorType: 'ama',
      timeframe: '60',
      params: { period: 10, fast: 2, slow: 30 },
    },
  },

  // Oscillators
  {
    type: 'rsi',
    nodeType: 'indicator',
    label: 'RSI',
    description: 'Relative Strength Index - Measures overbought/oversold conditions',
    category: 'indicators',
    subcategory: 'Oscillators',
    icon: 'Activity',
    color: '#06b6d4',
    defaultData: {
      indicatorType: 'rsi',
      timeframe: '60',
      params: { period: 14 },
    },
  },
  {
    type: 'cci',
    nodeType: 'indicator',
    label: 'CCI',
    description: 'Commodity Channel Index',
    category: 'indicators',
    subcategory: 'Oscillators',
    icon: 'Activity',
    color: '#06b6d4',
    defaultData: {
      indicatorType: 'cci',
      timeframe: '60',
      params: { period: 20 },
    },
  },
  {
    type: 'williamsR',
    nodeType: 'indicator',
    label: 'Williams %R',
    description: 'Williams Percent Range',
    category: 'indicators',
    subcategory: 'Oscillators',
    icon: 'Activity',
    color: '#06b6d4',
    defaultData: {
      indicatorType: 'williamsR',
      timeframe: '60',
      params: { period: 14 },
    },
  },
  {
    type: 'mfi',
    nodeType: 'indicator',
    label: 'MFI',
    description: 'Money Flow Index',
    category: 'indicators',
    subcategory: 'Oscillators',
    icon: 'Activity',
    color: '#06b6d4',
    defaultData: {
      indicatorType: 'mfi',
      timeframe: '60',
      params: { period: 14 },
    },
  },
  {
    type: 'momentum',
    nodeType: 'indicator',
    label: 'Momentum',
    description: 'Momentum indicator',
    category: 'indicators',
    subcategory: 'Oscillators',
    icon: 'Activity',
    color: '#06b6d4',
    defaultData: {
      indicatorType: 'momentum',
      timeframe: '60',
      params: { period: 14 },
    },
  },
  {
    type: 'stochastic',
    nodeType: 'indicator',
    label: 'Stochastic',
    description: 'Stochastic Oscillator',
    category: 'indicators',
    subcategory: 'Oscillators',
    icon: 'Activity',
    color: '#06b6d4',
    defaultData: {
      indicatorType: 'stochastic',
      timeframe: '60',
      params: { kPeriod: 5, dPeriod: 3, slowing: 3 },
    },
  },

  // MACD
  {
    type: 'macd',
    nodeType: 'indicator',
    label: 'MACD',
    description: 'Moving Average Convergence Divergence',
    category: 'indicators',
    subcategory: 'MACD',
    icon: 'BarChart2',
    color: '#f59e0b',
    defaultData: {
      indicatorType: 'macd',
      timeframe: '60',
      params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    },
  },

  // Bands & Channels
  {
    type: 'bb',
    nodeType: 'indicator',
    label: 'Bollinger Bands',
    description: 'Bollinger Bands - Price bands based on standard deviation',
    category: 'indicators',
    subcategory: 'Bands & Channels',
    icon: 'Maximize2',
    color: '#ec4899',
    defaultData: {
      indicatorType: 'bb',
      timeframe: '60',
      params: { period: 20, deviation: 2, band: 'middle' },
    },
  },
  {
    type: 'keltner',
    nodeType: 'indicator',
    label: 'Keltner Channel',
    description: 'Keltner Channel - ATR-based price channel',
    category: 'indicators',
    subcategory: 'Bands & Channels',
    icon: 'Maximize2',
    color: '#ec4899',
    defaultData: {
      indicatorType: 'keltner',
      timeframe: '60',
      params: { period: 20, multiplier: 2, band: 'middle' },
    },
  },
  {
    type: 'donchian',
    nodeType: 'indicator',
    label: 'Donchian Channel',
    description: 'Donchian Channel - Highest high and lowest low',
    category: 'indicators',
    subcategory: 'Bands & Channels',
    icon: 'Maximize2',
    color: '#ec4899',
    defaultData: {
      indicatorType: 'donchian',
      timeframe: '60',
      params: { period: 20, band: 'middle' },
    },
  },
  {
    type: 'envelopes',
    nodeType: 'indicator',
    label: 'Envelopes',
    description: 'Moving Average Envelopes',
    category: 'indicators',
    subcategory: 'Bands & Channels',
    icon: 'Maximize2',
    color: '#ec4899',
    defaultData: {
      indicatorType: 'envelopes',
      timeframe: '60',
      params: { period: 20, deviation: 0.1, band: 'middle' },
    },
  },

  // Complex Indicators
  {
    type: 'ichimoku',
    nodeType: 'indicator',
    label: 'Ichimoku',
    description: 'Ichimoku Kinko Hyo - Cloud indicator',
    category: 'indicators',
    subcategory: 'Complex',
    icon: 'Cloud',
    color: '#10b981',
    defaultData: {
      indicatorType: 'ichimoku',
      timeframe: '60',
      params: { tenkan: 9, kijun: 26, senkou: 52, line: 'tenkan' },
    },
  },
  {
    type: 'adx',
    nodeType: 'indicator',
    label: 'ADX',
    description: 'Average Directional Index - Trend strength',
    category: 'indicators',
    subcategory: 'Complex',
    icon: 'TrendingUp',
    color: '#10b981',
    defaultData: {
      indicatorType: 'adx',
      timeframe: '60',
      params: { period: 14 },
    },
  },
  {
    type: 'dmi',
    nodeType: 'indicator',
    label: 'DMI',
    description: 'Directional Movement Index',
    category: 'indicators',
    subcategory: 'Complex',
    icon: 'TrendingUp',
    color: '#10b981',
    defaultData: {
      indicatorType: 'dmi',
      timeframe: '60',
      params: { period: 14, line: 'plus' },
    },
  },
  {
    type: 'alligator',
    nodeType: 'indicator',
    label: 'Alligator',
    description: 'Bill Williams Alligator',
    category: 'indicators',
    subcategory: 'Complex',
    icon: 'Activity',
    color: '#10b981',
    defaultData: {
      indicatorType: 'alligator',
      timeframe: '60',
      params: { jaw: 13, teeth: 8, lips: 5, line: 'jaw' },
    },
  },

  // Volatility
  {
    type: 'atr',
    nodeType: 'indicator',
    label: 'ATR',
    description: 'Average True Range - Volatility indicator',
    category: 'indicators',
    subcategory: 'Volatility',
    icon: 'Zap',
    color: '#f97316',
    defaultData: {
      indicatorType: 'atr',
      timeframe: '60',
      params: { period: 14 },
    },
  },
  {
    type: 'stddev',
    nodeType: 'indicator',
    label: 'StdDev',
    description: 'Standard Deviation',
    category: 'indicators',
    subcategory: 'Volatility',
    icon: 'Zap',
    color: '#f97316',
    defaultData: {
      indicatorType: 'stddev',
      timeframe: '60',
      params: { period: 20 },
    },
  },

  // Trend
  {
    type: 'sar',
    nodeType: 'indicator',
    label: 'Parabolic SAR',
    description: 'Parabolic Stop and Reverse',
    category: 'indicators',
    subcategory: 'Trend',
    icon: 'GitCommit',
    color: '#a855f7',
    defaultData: {
      indicatorType: 'sar',
      timeframe: '60',
      params: { step: 0.02, max: 0.2 },
    },
  },
  {
    type: 'supertrend',
    nodeType: 'indicator',
    label: 'Supertrend',
    description: 'Supertrend indicator',
    category: 'indicators',
    subcategory: 'Trend',
    icon: 'TrendingUp',
    color: '#a855f7',
    defaultData: {
      indicatorType: 'supertrend',
      timeframe: '60',
      params: { period: 10, multiplier: 3 },
    },
  },

  // Volume
  {
    type: 'obv',
    nodeType: 'indicator',
    label: 'OBV',
    description: 'On Balance Volume',
    category: 'indicators',
    subcategory: 'Volume',
    icon: 'BarChart',
    color: '#3b82f6',
    defaultData: {
      indicatorType: 'obv',
      timeframe: '60',
      params: {},
    },
  },
  {
    type: 'vwap',
    nodeType: 'indicator',
    label: 'VWAP',
    description: 'Volume Weighted Average Price',
    category: 'indicators',
    subcategory: 'Volume',
    icon: 'BarChart',
    color: '#3b82f6',
    defaultData: {
      indicatorType: 'vwap',
      timeframe: '60',
      params: {},
    },
  },

  // Support/Resistance
  {
    type: 'support',
    nodeType: 'indicator',
    label: 'Support',
    description: 'Support level detection',
    category: 'indicators',
    subcategory: 'Support/Resistance',
    icon: 'ArrowDown',
    color: '#22c55e',
    defaultData: {
      indicatorType: 'support',
      timeframe: '60',
      params: { lookback: 20 },
    },
  },
  {
    type: 'resistance',
    nodeType: 'indicator',
    label: 'Resistance',
    description: 'Resistance level detection',
    category: 'indicators',
    subcategory: 'Support/Resistance',
    icon: 'ArrowUp',
    color: '#ef4444',
    defaultData: {
      indicatorType: 'resistance',
      timeframe: '60',
      params: { lookback: 20 },
    },
  },
  {
    type: 'highest',
    nodeType: 'indicator',
    label: 'Highest',
    description: 'Highest value over N periods',
    category: 'indicators',
    subcategory: 'Support/Resistance',
    icon: 'ArrowUp',
    color: '#22c55e',
    defaultData: {
      indicatorType: 'highest',
      timeframe: '60',
      params: { period: 20, priceType: 'high' },
    },
  },
  {
    type: 'lowest',
    nodeType: 'indicator',
    label: 'Lowest',
    description: 'Lowest value over N periods',
    category: 'indicators',
    subcategory: 'Support/Resistance',
    icon: 'ArrowDown',
    color: '#ef4444',
    defaultData: {
      indicatorType: 'lowest',
      timeframe: '60',
      params: { period: 20, priceType: 'low' },
    },
  },
];

// =============================================================================
// CONDITION NODES
// =============================================================================

export const CONDITION_NODES: NodeCatalogItem[] = [
  {
    type: 'compare',
    nodeType: 'condition',
    label: 'Compare',
    description: 'Compare two values (A > B, A < B, A == B)',
    category: 'conditions',
    icon: 'GitCompare',
    color: '#f59e0b',
    defaultData: {
      conditionType: 'compare',
      operator: '>',
    },
  },
  {
    type: 'crossover',
    nodeType: 'condition',
    label: 'Crossover',
    description: 'Detect when A crosses above B',
    category: 'conditions',
    icon: 'ArrowUpRight',
    color: '#22c55e',
    defaultData: {
      conditionType: 'crossover',
    },
  },
  {
    type: 'crossunder',
    nodeType: 'condition',
    label: 'Crossunder',
    description: 'Detect when A crosses below B',
    category: 'conditions',
    icon: 'ArrowDownRight',
    color: '#ef4444',
    defaultData: {
      conditionType: 'crossunder',
    },
  },
  {
    type: 'threshold',
    nodeType: 'condition',
    label: 'Threshold',
    description: 'Check if value is above or below a threshold',
    category: 'conditions',
    icon: 'Minus',
    color: '#f59e0b',
    defaultData: {
      conditionType: 'threshold',
      operator: '>',
      value: 70,
    },
  },
  {
    type: 'range',
    nodeType: 'condition',
    label: 'In Range',
    description: 'Check if value is within a range',
    category: 'conditions',
    icon: 'Maximize2',
    color: '#f59e0b',
    defaultData: {
      conditionType: 'range',
      minValue: 30,
      maxValue: 70,
    },
  },
  {
    type: 'and',
    nodeType: 'condition',
    label: 'AND',
    description: 'Logical AND - Both conditions must be true',
    category: 'conditions',
    icon: 'Plus',
    color: '#6366f1',
    defaultData: {
      conditionType: 'and',
    },
  },
  {
    type: 'or',
    nodeType: 'condition',
    label: 'OR',
    description: 'Logical OR - Either condition must be true',
    category: 'conditions',
    icon: 'Slash',
    color: '#6366f1',
    defaultData: {
      conditionType: 'or',
    },
  },
  {
    type: 'not',
    nodeType: 'condition',
    label: 'NOT',
    description: 'Logical NOT - Inverts the condition',
    category: 'conditions',
    icon: 'X',
    color: '#6366f1',
    defaultData: {
      conditionType: 'not',
    },
  },
];

// =============================================================================
// ACTION NODES
// =============================================================================

export const ACTION_NODES: NodeCatalogItem[] = [
  {
    type: 'order',
    nodeType: 'action',
    label: 'Place Order',
    description: 'Place a market or limit order',
    category: 'actions',
    subcategory: 'Orders',
    icon: 'ShoppingCart',
    color: '#10b981',
    defaultData: {
      actionType: 'order',
      direction: 'long',
      orderType: 'market',
      size: 0.1,
      sizeType: 'lots',
    },
  },
  {
    type: 'closePosition',
    nodeType: 'action',
    label: 'Close Position',
    description: 'Close a specific position',
    category: 'actions',
    subcategory: 'Orders',
    icon: 'XCircle',
    color: '#ef4444',
    defaultData: {
      actionType: 'closePosition',
    },
  },
  {
    type: 'closeAll',
    nodeType: 'action',
    label: 'Close All',
    description: 'Close all open positions',
    category: 'actions',
    subcategory: 'Orders',
    icon: 'XSquare',
    color: '#ef4444',
    defaultData: {
      actionType: 'closeAll',
    },
  },
  {
    type: 'stopLoss',
    nodeType: 'action',
    label: 'Stop Loss',
    description: 'Set stop loss level',
    category: 'actions',
    subcategory: 'Risk Management',
    icon: 'Shield',
    color: '#f59e0b',
    defaultData: {
      actionType: 'stopLoss',
      stopPrice: 0,
    },
  },
  {
    type: 'takeProfit',
    nodeType: 'action',
    label: 'Take Profit',
    description: 'Set take profit level',
    category: 'actions',
    subcategory: 'Risk Management',
    icon: 'Target',
    color: '#22c55e',
    defaultData: {
      actionType: 'takeProfit',
      takeProfitPrice: 0,
    },
  },
  {
    type: 'trailingStop',
    nodeType: 'action',
    label: 'Trailing Stop',
    description: 'Set trailing stop distance',
    category: 'actions',
    subcategory: 'Risk Management',
    icon: 'GitBranch',
    color: '#f59e0b',
    defaultData: {
      actionType: 'trailingStop',
      trailingDistance: 10,
    },
  },
  {
    type: 'notification',
    nodeType: 'action',
    label: 'Notification',
    description: 'Send an alert notification',
    category: 'actions',
    subcategory: 'Alerts',
    icon: 'Bell',
    color: '#ec4899',
    defaultData: {
      actionType: 'notification',
      message: 'Signal triggered',
      channel: 'telegram',
    },
  },
  {
    type: 'log',
    nodeType: 'action',
    label: 'Log',
    description: 'Log a message to console',
    category: 'actions',
    subcategory: 'Alerts',
    icon: 'FileText',
    color: '#6b7280',
    defaultData: {
      actionType: 'log',
      message: 'Log message',
    },
  },
];

// =============================================================================
// ENVIRONMENT NODES
// =============================================================================

export const ENVIRONMENT_NODES: NodeCatalogItem[] = [
  {
    type: 'price',
    nodeType: 'environment',
    label: 'Current Price',
    description: 'Current bid, ask, or mid price',
    category: 'environment',
    subcategory: 'Price & Volume',
    icon: 'DollarSign',
    color: '#6366f1',
    defaultData: {
      environmentType: 'price',
      priceType: 'mid',
    },
  },
  {
    type: 'spread',
    nodeType: 'environment',
    label: 'Spread',
    description: 'Current bid-ask spread',
    category: 'environment',
    subcategory: 'Price & Volume',
    icon: 'ArrowLeftRight',
    color: '#6366f1',
    defaultData: {
      environmentType: 'spread',
    },
  },
  {
    type: 'prevCandleOpen',
    nodeType: 'environment',
    label: 'Prev Candle Open',
    description: 'Previous candle open price',
    category: 'environment',
    subcategory: 'Price & Volume',
    icon: 'BarChart2',
    color: '#6366f1',
    defaultData: {
      environmentType: 'prevCandleOpen',
      shift: 1,
    },
  },
  {
    type: 'prevCandleClose',
    nodeType: 'environment',
    label: 'Prev Candle Close',
    description: 'Previous candle close price',
    category: 'environment',
    subcategory: 'Price & Volume',
    icon: 'BarChart2',
    color: '#6366f1',
    defaultData: {
      environmentType: 'prevCandleClose',
      shift: 1,
    },
  },
  {
    type: 'time',
    nodeType: 'environment',
    label: 'Current Time',
    description: 'Current time',
    category: 'environment',
    subcategory: 'Time',
    icon: 'Clock',
    color: '#8b5cf6',
    defaultData: {
      environmentType: 'time',
    },
  },
  {
    type: 'dayOfWeek',
    nodeType: 'environment',
    label: 'Day of Week',
    description: 'Current day of week (0-6)',
    category: 'environment',
    subcategory: 'Time',
    icon: 'Calendar',
    color: '#8b5cf6',
    defaultData: {
      environmentType: 'dayOfWeek',
    },
  },
  {
    type: 'newCandleOpen',
    nodeType: 'environment',
    label: 'New Candle',
    description: 'Triggers when a new candle opens',
    category: 'environment',
    subcategory: 'Time',
    icon: 'PlayCircle',
    color: '#8b5cf6',
    defaultData: {
      environmentType: 'newCandleOpen',
    },
  },
  {
    type: 'isMarketOpen',
    nodeType: 'environment',
    label: 'Market Open',
    description: 'Check if market is open',
    category: 'environment',
    subcategory: 'Time',
    icon: 'ToggleLeft',
    color: '#8b5cf6',
    defaultData: {
      environmentType: 'isMarketOpen',
    },
  },
];

// =============================================================================
// CONTROL NODES
// =============================================================================

export const CONTROL_NODES: NodeCatalogItem[] = [
  {
    type: 'if',
    nodeType: 'control',
    label: 'If',
    description: 'Execute actions if condition is true',
    category: 'control',
    subcategory: 'Conditionals',
    icon: 'GitBranch',
    color: '#f59e0b',
    defaultData: {
      controlType: 'if',
    },
  },
  {
    type: 'ifElse',
    nodeType: 'control',
    label: 'If-Else',
    description: 'Execute different actions based on condition',
    category: 'control',
    subcategory: 'Conditionals',
    icon: 'GitMerge',
    color: '#f59e0b',
    defaultData: {
      controlType: 'ifElse',
    },
  },
  {
    type: 'repeat',
    nodeType: 'control',
    label: 'Repeat',
    description: 'Repeat actions N times',
    category: 'control',
    subcategory: 'Loops',
    icon: 'RefreshCw',
    color: '#06b6d4',
    defaultData: {
      controlType: 'repeat',
      repeatCount: 10,
    },
  },
  {
    type: 'repeatUntil',
    nodeType: 'control',
    label: 'Repeat Until',
    description: 'Repeat until condition is true',
    category: 'control',
    subcategory: 'Loops',
    icon: 'RefreshCw',
    color: '#06b6d4',
    defaultData: {
      controlType: 'repeatUntil',
    },
  },
  {
    type: 'wait',
    nodeType: 'control',
    label: 'Wait',
    description: 'Wait for N seconds',
    category: 'control',
    subcategory: 'Timing',
    icon: 'Timer',
    color: '#8b5cf6',
    defaultData: {
      controlType: 'wait',
      waitSeconds: 1,
    },
  },
  {
    type: 'waitUntil',
    nodeType: 'control',
    label: 'Wait Until',
    description: 'Wait until condition is true',
    category: 'control',
    subcategory: 'Timing',
    icon: 'TimerOff',
    color: '#8b5cf6',
    defaultData: {
      controlType: 'waitUntil',
    },
  },
  {
    type: 'stop',
    nodeType: 'control',
    label: 'Stop',
    description: 'Stop strategy execution',
    category: 'control',
    subcategory: 'Flow',
    icon: 'Square',
    color: '#ef4444',
    defaultData: {
      controlType: 'stop',
    },
  },
];

// =============================================================================
// VARIABLE NODES
// =============================================================================

export const VARIABLE_NODES: NodeCatalogItem[] = [
  {
    type: 'setVariable',
    nodeType: 'variable',
    label: 'Set Variable',
    description: 'Set a variable value',
    category: 'variables',
    icon: 'Edit3',
    color: '#ec4899',
    defaultData: {
      variableType: 'setVariable',
      variableName: 'myVar',
      value: 0,
    },
  },
  {
    type: 'getVariable',
    nodeType: 'variable',
    label: 'Get Variable',
    description: 'Get a variable value',
    category: 'variables',
    icon: 'Eye',
    color: '#ec4899',
    defaultData: {
      variableType: 'getVariable',
      variableName: 'myVar',
    },
  },
  {
    type: 'changeVariable',
    nodeType: 'variable',
    label: 'Change Variable',
    description: 'Change a variable by amount',
    category: 'variables',
    icon: 'PlusCircle',
    color: '#ec4899',
    defaultData: {
      variableType: 'changeVariable',
      variableName: 'myVar',
      value: 1,
    },
  },
  {
    type: 'defineFunction',
    nodeType: 'variable',
    label: 'Define Function',
    description: 'Define a reusable function',
    category: 'variables',
    icon: 'Code',
    color: '#6366f1',
    defaultData: {
      variableType: 'defineFunction',
      functionName: 'myFunction',
    },
  },
  {
    type: 'callFunction',
    nodeType: 'variable',
    label: 'Call Function',
    description: 'Call a defined function',
    category: 'variables',
    icon: 'Play',
    color: '#6366f1',
    defaultData: {
      variableType: 'callFunction',
      functionName: 'myFunction',
    },
  },
  {
    type: 'return',
    nodeType: 'variable',
    label: 'Return',
    description: 'Return a value from function',
    category: 'variables',
    icon: 'CornerDownLeft',
    color: '#6366f1',
    defaultData: {
      variableType: 'return',
    },
  },
];

// =============================================================================
// COMPLETE CATALOG
// =============================================================================

export const NODE_CATALOG: NodeCatalogItem[] = [
  ...INDICATOR_NODES,
  ...CONDITION_NODES,
  ...ACTION_NODES,
  ...ENVIRONMENT_NODES,
  ...CONTROL_NODES,
  ...VARIABLE_NODES,
];

// Helper to get nodes by category
export const getNodesByCategory = (category: string): NodeCatalogItem[] => {
  return NODE_CATALOG.filter(node => node.category === category);
};

// Helper to get nodes by subcategory
export const getNodesBySubcategory = (category: string, subcategory: string): NodeCatalogItem[] => {
  return NODE_CATALOG.filter(node => node.category === category && node.subcategory === subcategory);
};

// Get all unique subcategories for a category
export const getSubcategories = (category: string): string[] => {
  const nodes = getNodesByCategory(category);
  const subcategories = new Set<string>();
  nodes.forEach(node => {
    if (node.subcategory) {
      subcategories.add(node.subcategory);
    }
  });
  return Array.from(subcategories);
};
