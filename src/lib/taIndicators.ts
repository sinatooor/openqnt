// Comprehensive list of pandas-ta indicators with their parameters
export interface TAIndicatorParam {
  name: string;
  type: 'number' | 'select' | 'boolean';
  default: number | string | boolean;
  options?: string[];
  min?: number;
  max?: number;
  description?: string;
}

export interface TAIndicator {
  id: string;
  name: string;
  category: 'overlap' | 'momentum' | 'volatility' | 'trend' | 'volume' | 'statistics' | 'performance' | 'cycles';
  description: string;
  parameters: TAIndicatorParam[];
}

export const taIndicators: TAIndicator[] = [
  // Overlap Indicators
  {
    id: 'sma',
    name: 'SMA',
    category: 'overlap',
    description: 'Simple Moving Average',
    parameters: [
      { name: 'length', type: 'number', default: 20, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'ema',
    name: 'EMA',
    category: 'overlap',
    description: 'Exponential Moving Average',
    parameters: [
      { name: 'length', type: 'number', default: 20, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'wma',
    name: 'WMA',
    category: 'overlap',
    description: 'Weighted Moving Average',
    parameters: [
      { name: 'length', type: 'number', default: 20, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'dema',
    name: 'DEMA',
    category: 'overlap',
    description: 'Double Exponential Moving Average',
    parameters: [
      { name: 'length', type: 'number', default: 20, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'tema',
    name: 'TEMA',
    category: 'overlap',
    description: 'Triple Exponential Moving Average',
    parameters: [
      { name: 'length', type: 'number', default: 20, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'vwma',
    name: 'VWMA',
    category: 'overlap',
    description: 'Volume Weighted Moving Average',
    parameters: [
      { name: 'length', type: 'number', default: 20, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'vwap',
    name: 'VWAP',
    category: 'overlap',
    description: 'Volume Weighted Average Price',
    parameters: []
  },
  {
    id: 'hma',
    name: 'HMA',
    category: 'overlap',
    description: 'Hull Moving Average',
    parameters: [
      { name: 'length', type: 'number', default: 20, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'alma',
    name: 'ALMA',
    category: 'overlap',
    description: 'Arnaud Legoux Moving Average',
    parameters: [
      { name: 'length', type: 'number', default: 9, min: 1, max: 500, description: 'Period length' },
      { name: 'sigma', type: 'number', default: 6, min: 1, max: 100, description: 'Sigma' },
      { name: 'offset', type: 'number', default: 0.85, min: 0, max: 1, description: 'Offset' }
    ]
  },
  
  // Momentum Indicators
  {
    id: 'rsi',
    name: 'RSI',
    category: 'momentum',
    description: 'Relative Strength Index',
    parameters: [
      { name: 'length', type: 'number', default: 14, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'macd',
    name: 'MACD',
    category: 'momentum',
    description: 'Moving Average Convergence Divergence',
    parameters: [
      { name: 'fast', type: 'number', default: 12, min: 1, max: 100, description: 'Fast period' },
      { name: 'slow', type: 'number', default: 26, min: 1, max: 100, description: 'Slow period' },
      { name: 'signal', type: 'number', default: 9, min: 1, max: 100, description: 'Signal period' }
    ]
  },
  {
    id: 'stoch',
    name: 'Stochastic',
    category: 'momentum',
    description: 'Stochastic Oscillator',
    parameters: [
      { name: 'k', type: 'number', default: 14, min: 1, max: 100, description: '%K period' },
      { name: 'd', type: 'number', default: 3, min: 1, max: 100, description: '%D period' },
      { name: 'smooth_k', type: 'number', default: 3, min: 1, max: 100, description: 'Smooth %K' }
    ]
  },
  {
    id: 'stochrsi',
    name: 'StochRSI',
    category: 'momentum',
    description: 'Stochastic RSI',
    parameters: [
      { name: 'length', type: 'number', default: 14, min: 1, max: 100, description: 'RSI length' },
      { name: 'rsi_length', type: 'number', default: 14, min: 1, max: 100, description: 'RSI period' },
      { name: 'k', type: 'number', default: 3, min: 1, max: 100, description: '%K period' },
      { name: 'd', type: 'number', default: 3, min: 1, max: 100, description: '%D period' }
    ]
  },
  {
    id: 'cci',
    name: 'CCI',
    category: 'momentum',
    description: 'Commodity Channel Index',
    parameters: [
      { name: 'length', type: 'number', default: 20, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'willr',
    name: 'Williams %R',
    category: 'momentum',
    description: "Williams %R Momentum Indicator",
    parameters: [
      { name: 'length', type: 'number', default: 14, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'roc',
    name: 'ROC',
    category: 'momentum',
    description: 'Rate of Change',
    parameters: [
      { name: 'length', type: 'number', default: 12, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'mom',
    name: 'Momentum',
    category: 'momentum',
    description: 'Momentum',
    parameters: [
      { name: 'length', type: 'number', default: 10, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'ppo',
    name: 'PPO',
    category: 'momentum',
    description: 'Percentage Price Oscillator',
    parameters: [
      { name: 'fast', type: 'number', default: 12, min: 1, max: 100, description: 'Fast period' },
      { name: 'slow', type: 'number', default: 26, min: 1, max: 100, description: 'Slow period' },
      { name: 'signal', type: 'number', default: 9, min: 1, max: 100, description: 'Signal period' }
    ]
  },
  {
    id: 'psl',
    name: 'PSL',
    category: 'momentum',
    description: 'Psychological Line',
    parameters: [
      { name: 'length', type: 'number', default: 12, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'pvo',
    name: 'PVO',
    category: 'momentum',
    description: 'Percentage Volume Oscillator',
    parameters: [
      { name: 'fast', type: 'number', default: 12, min: 1, max: 100, description: 'Fast period' },
      { name: 'slow', type: 'number', default: 26, min: 1, max: 100, description: 'Slow period' },
      { name: 'signal', type: 'number', default: 9, min: 1, max: 100, description: 'Signal period' }
    ]
  },
  
  // Volatility Indicators
  {
    id: 'atr',
    name: 'ATR',
    category: 'volatility',
    description: 'Average True Range',
    parameters: [
      { name: 'length', type: 'number', default: 14, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'bbands',
    name: 'Bollinger Bands',
    category: 'volatility',
    description: 'Bollinger Bands',
    parameters: [
      { name: 'length', type: 'number', default: 20, min: 1, max: 500, description: 'Period length' },
      { name: 'std', type: 'number', default: 2, min: 0.1, max: 10, description: 'Standard deviations' }
    ]
  },
  {
    id: 'kc',
    name: 'Keltner Channels',
    category: 'volatility',
    description: 'Keltner Channels',
    parameters: [
      { name: 'length', type: 'number', default: 20, min: 1, max: 500, description: 'Period length' },
      { name: 'scalar', type: 'number', default: 2, min: 0.1, max: 10, description: 'ATR scalar' }
    ]
  },
  {
    id: 'donchian',
    name: 'Donchian Channels',
    category: 'volatility',
    description: 'Donchian Channels',
    parameters: [
      { name: 'lower_length', type: 'number', default: 20, min: 1, max: 500, description: 'Lower period' },
      { name: 'upper_length', type: 'number', default: 20, min: 1, max: 500, description: 'Upper period' }
    ]
  },
  {
    id: 'natr',
    name: 'NATR',
    category: 'volatility',
    description: 'Normalized Average True Range',
    parameters: [
      { name: 'length', type: 'number', default: 14, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'pdist',
    name: 'Price Distance',
    category: 'volatility',
    description: 'Price Distance',
    parameters: []
  },
  {
    id: 'ui',
    name: 'Ulcer Index',
    category: 'volatility',
    description: 'Ulcer Index',
    parameters: [
      { name: 'length', type: 'number', default: 14, min: 1, max: 500, description: 'Period length' }
    ]
  },
  
  // Trend Indicators
  {
    id: 'adx',
    name: 'ADX',
    category: 'trend',
    description: 'Average Directional Index',
    parameters: [
      { name: 'length', type: 'number', default: 14, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'aroon',
    name: 'Aroon',
    category: 'trend',
    description: 'Aroon Indicator',
    parameters: [
      { name: 'length', type: 'number', default: 25, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'psar',
    name: 'Parabolic SAR',
    category: 'trend',
    description: 'Parabolic Stop and Reverse',
    parameters: [
      { name: 'af', type: 'number', default: 0.02, min: 0.01, max: 1, description: 'Acceleration factor' },
      { name: 'max_af', type: 'number', default: 0.2, min: 0.01, max: 1, description: 'Max acceleration' }
    ]
  },
  {
    id: 'supertrend',
    name: 'SuperTrend',
    category: 'trend',
    description: 'SuperTrend Indicator',
    parameters: [
      { name: 'length', type: 'number', default: 7, min: 1, max: 500, description: 'ATR period' },
      { name: 'multiplier', type: 'number', default: 3, min: 0.1, max: 10, description: 'Multiplier' }
    ]
  },
  {
    id: 'vortex',
    name: 'Vortex',
    category: 'trend',
    description: 'Vortex Indicator',
    parameters: [
      { name: 'length', type: 'number', default: 14, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'dpo',
    name: 'DPO',
    category: 'trend',
    description: 'Detrended Price Oscillator',
    parameters: [
      { name: 'length', type: 'number', default: 20, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'qstick',
    name: 'Qstick',
    category: 'trend',
    description: 'Qstick Indicator',
    parameters: [
      { name: 'length', type: 'number', default: 10, min: 1, max: 500, description: 'Period length' }
    ]
  },
  
  // Volume Indicators
  {
    id: 'obv',
    name: 'OBV',
    category: 'volume',
    description: 'On Balance Volume',
    parameters: []
  },
  {
    id: 'ad',
    name: 'A/D',
    category: 'volume',
    description: 'Accumulation/Distribution',
    parameters: []
  },
  {
    id: 'adosc',
    name: 'AD Oscillator',
    category: 'volume',
    description: 'Accumulation/Distribution Oscillator',
    parameters: [
      { name: 'fast', type: 'number', default: 3, min: 1, max: 100, description: 'Fast period' },
      { name: 'slow', type: 'number', default: 10, min: 1, max: 100, description: 'Slow period' }
    ]
  },
  {
    id: 'mfi',
    name: 'MFI',
    category: 'volume',
    description: 'Money Flow Index',
    parameters: [
      { name: 'length', type: 'number', default: 14, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'cmf',
    name: 'CMF',
    category: 'volume',
    description: 'Chaikin Money Flow',
    parameters: [
      { name: 'length', type: 'number', default: 20, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'efi',
    name: 'EFI',
    category: 'volume',
    description: 'Elder Force Index',
    parameters: [
      { name: 'length', type: 'number', default: 13, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'eom',
    name: 'EOM',
    category: 'volume',
    description: 'Ease of Movement',
    parameters: [
      { name: 'length', type: 'number', default: 14, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'nvi',
    name: 'NVI',
    category: 'volume',
    description: 'Negative Volume Index',
    parameters: []
  },
  {
    id: 'pvi',
    name: 'PVI',
    category: 'volume',
    description: 'Positive Volume Index',
    parameters: []
  },
  {
    id: 'pvol',
    name: 'Price Volume',
    category: 'volume',
    description: 'Price Volume',
    parameters: []
  },
  {
    id: 'pvt',
    name: 'PVT',
    category: 'volume',
    description: 'Price Volume Trend',
    parameters: []
  },
  
  // Statistics
  {
    id: 'entropy',
    name: 'Entropy',
    category: 'statistics',
    description: 'Entropy',
    parameters: [
      { name: 'length', type: 'number', default: 10, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'kurtosis',
    name: 'Kurtosis',
    category: 'statistics',
    description: 'Kurtosis',
    parameters: [
      { name: 'length', type: 'number', default: 30, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'mad',
    name: 'MAD',
    category: 'statistics',
    description: 'Mean Absolute Deviation',
    parameters: [
      { name: 'length', type: 'number', default: 30, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'median',
    name: 'Median',
    category: 'statistics',
    description: 'Median',
    parameters: [
      { name: 'length', type: 'number', default: 30, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'quantile',
    name: 'Quantile',
    category: 'statistics',
    description: 'Quantile',
    parameters: [
      { name: 'length', type: 'number', default: 30, min: 1, max: 500, description: 'Period length' },
      { name: 'q', type: 'number', default: 0.5, min: 0, max: 1, description: 'Quantile value' }
    ]
  },
  {
    id: 'skew',
    name: 'Skew',
    category: 'statistics',
    description: 'Skewness',
    parameters: [
      { name: 'length', type: 'number', default: 30, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'stdev',
    name: 'Std Dev',
    category: 'statistics',
    description: 'Standard Deviation',
    parameters: [
      { name: 'length', type: 'number', default: 30, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'variance',
    name: 'Variance',
    category: 'statistics',
    description: 'Variance',
    parameters: [
      { name: 'length', type: 'number', default: 30, min: 1, max: 500, description: 'Period length' }
    ]
  },
  {
    id: 'zscore',
    name: 'Z-Score',
    category: 'statistics',
    description: 'Z-Score',
    parameters: [
      { name: 'length', type: 'number', default: 30, min: 1, max: 500, description: 'Period length' },
      { name: 'std', type: 'number', default: 1, min: 0.1, max: 10, description: 'Standard deviations' }
    ]
  },
];

// Commonly used indicators
export const commonlyUsedIndicators = ['rsi', 'macd', 'sma', 'atr'];

// Support and resistance (special case - not from pandas-ta)
export const supportResistanceIndicators = [
  {
    id: 'support',
    name: 'Nearest Support Level',
    category: 'special' as const,
    description: 'Identifies nearest support level',
    parameters: [
      { 
        name: 'timeframe', 
        type: 'select' as const, 
        default: '1h', 
        options: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'],
        description: 'Timeframe'
      }
    ]
  },
  {
    id: 'resistance',
    name: 'Nearest Resistance Level',
    category: 'special' as const,
    description: 'Identifies nearest resistance level',
    parameters: [
      { 
        name: 'timeframe', 
        type: 'select' as const, 
        default: '1h', 
        options: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'],
        description: 'Timeframe'
      }
    ]
  }
];
