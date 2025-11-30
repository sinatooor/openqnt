/**
 * Indicator Configuration System
 * Defines all MQL indicators with their parameters, defaults, and components
 * Based on MQL5 documentation: https://www.mql5.com/en/docs/indicators
 * 
 * Note: symbol parameter is excluded as it is globally set
 * Timeframe (period) is included as a configurable parameter
 */

export interface IndicatorParam {
  name: string;
  label: string;
  type: 'number' | 'double';
  default: number;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: number; label: string }[];
}

export interface IndicatorComponent {
  value: string;
  label: string;
}

export interface IndicatorConfig {
  name: string;
  displayName: string;
  params: IndicatorParam[];
  components?: IndicatorComponent[];
  mqlFunction: string;
}

// MA Method options: 0=MODE_SMA, 1=MODE_EMA, 2=MODE_SMMA, 3=MODE_LWMA
const maMethods = [
  { value: 0, label: 'SMA' },
  { value: 1, label: 'EMA' },
  { value: 2, label: 'SMMA' },
  { value: 3, label: 'LWMA' }
];

// Applied Price options: 0=PRICE_CLOSE, 1=PRICE_OPEN, 2=PRICE_HIGH, 3=PRICE_LOW, 4=PRICE_MEDIAN, 5=PRICE_TYPICAL, 6=PRICE_WEIGHTED
const appliedPrices = [
  { value: 0, label: 'Close' },
  { value: 1, label: 'Open' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Low' },
  { value: 4, label: 'Median' },
  { value: 5, label: 'Typical' },
  { value: 6, label: 'Weighted' }
];

// Stochastic Price Field: 0=STO_LOWHIGH, 1=STO_CLOSECLOSE
const stochasticPriceFields = [
  { value: 0, label: 'Low/High' },
  { value: 1, label: 'Close/Close' }
];

// Timeframe options: 0=PERIOD_CURRENT, 1=PERIOD_M1, 5=PERIOD_M5, 15=PERIOD_M15, 30=PERIOD_M30, 60=PERIOD_H1, 240=PERIOD_H4, 1440=PERIOD_D1, 10080=PERIOD_W1, 43200=PERIOD_MN1
const timeframes = [
  { value: 0, label: 'Current' },
  { value: 1, label: 'M1' },
  { value: 5, label: 'M5' },
  { value: 15, label: 'M15' },
  { value: 30, label: 'M30' },
  { value: 60, label: 'H1' },
  { value: 240, label: 'H4' },
  { value: 1440, label: 'D1' },
  { value: 10080, label: 'W1' },
  { value: 43200, label: 'MN1' }
];

export const indicatorConfigs: Record<string, IndicatorConfig> = {
  // Oscillators
  'ac': {
    name: 'ac',
    displayName: 'Accelerator Oscillator',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes }
    ],
    mqlFunction: 'iAC'
  },
  'ao': {
    name: 'ao',
    displayName: 'Awesome Oscillator',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes }
    ],
    mqlFunction: 'iAO'
  },
  'ad': {
    name: 'ad',
    displayName: 'Accumulation/Distribution',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes }
    ],
    mqlFunction: 'iAD'
  },
  'cci': {
    name: 'cci',
    displayName: 'Commodity Channel Index',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iCCI'
  },
  'chaikin': {
    name: 'chaikin',
    displayName: 'Chaikin Oscillator',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'fastMA', label: 'Fast MA Period', type: 'number', default: 3, min: 1 },
      { name: 'slowMA', label: 'Slow MA Period', type: 'number', default: 10, min: 1 }
    ],
    mqlFunction: 'iChaikin'
  },
  'demarker': {
    name: 'demarker',
    displayName: 'DeMarker',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 }
    ],
    mqlFunction: 'iDeMarker'
  },
  'force': {
    name: 'force',
    displayName: 'Force Index',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 13, min: 1 },
      { name: 'method', label: 'MA Method', type: 'number', default: 0, min: 0, max: 3, options: maMethods },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iForce'
  },
  'momentum': {
    name: 'momentum',
    displayName: 'Momentum',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iMomentum'
  },
  'mfi': {
    name: 'mfi',
    displayName: 'Money Flow Index',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 }
    ],
    mqlFunction: 'iMFI'
  },
  'osma': {
    name: 'osma',
    displayName: 'Moving Average of Oscillator',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'fastEMA', label: 'Fast EMA', type: 'number', default: 12, min: 1 },
      { name: 'slowEMA', label: 'Slow EMA', type: 'number', default: 26, min: 1 },
      { name: 'signalSMA', label: 'Signal SMA', type: 'number', default: 9, min: 1 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    components: [
      { value: 'main', label: 'Main' },
      { value: 'signal', label: 'Signal' }
    ],
    mqlFunction: 'iOsMA'
  },
  'rsi': {
    name: 'rsi',
    displayName: 'Relative Strength Index',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iRSI'
  },
  'rvi': {
    name: 'rvi',
    displayName: 'Relative Vigor Index',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 10, min: 1 },
      { name: 'method', label: 'MA Method', type: 'number', default: 0, min: 0, max: 3, options: maMethods }
    ],
    components: [
      { value: 'main', label: 'Main' },
      { value: 'signal', label: 'Signal' }
    ],
    mqlFunction: 'iRVI'
  },
  'stochastic': {
    name: 'stochastic',
    displayName: 'Stochastic Oscillator',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'kPeriod', label: 'K Period', type: 'number', default: 5, min: 1 },
      { name: 'dPeriod', label: 'D Period', type: 'number', default: 3, min: 1 },
      { name: 'slowing', label: 'Slowing', type: 'number', default: 3, min: 1 },
      { name: 'method', label: 'MA Method', type: 'number', default: 0, min: 0, max: 3, options: maMethods },
      { name: 'price', label: 'Price Field', type: 'number', default: 0, min: 0, max: 1, options: stochasticPriceFields }
    ],
    components: [
      { value: 'main', label: 'Main' },
      { value: 'signal', label: 'Signal' }
    ],
    mqlFunction: 'iStochastic'
  },
  'williams_r': {
    name: 'williams_r',
    displayName: 'Williams\' %R',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 }
    ],
    mqlFunction: 'iWPR'
  },
  'trix': {
    name: 'trix',
    displayName: 'Triple Exponential Moving Averages Oscillator',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iTriX'
  },

  // Moving Averages
  'sma': {
    name: 'sma',
    displayName: 'Simple Moving Average',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'shift', label: 'Shift', type: 'number', default: 0 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iMA'
  },
  'ema': {
    name: 'ema',
    displayName: 'Exponential Moving Average',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'shift', label: 'Shift', type: 'number', default: 0 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iMA'
  },
  'smma': {
    name: 'smma',
    displayName: 'Smoothed Moving Average',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'shift', label: 'Shift', type: 'number', default: 0 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iMA'
  },
  'lwma': {
    name: 'lwma',
    displayName: 'Linear Weighted Moving Average',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'shift', label: 'Shift', type: 'number', default: 0 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iMA'
  },
  'dema': {
    name: 'dema',
    displayName: 'Double Exponential Moving Average',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'shift', label: 'Shift', type: 'number', default: 0 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iDEMA'
  },
  'tema': {
    name: 'tema',
    displayName: 'Triple Exponential Moving Average',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'shift', label: 'Shift', type: 'number', default: 0 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iTEMA'
  },
  'frama': {
    name: 'frama',
    displayName: 'Fractal Adaptive Moving Average',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'shift', label: 'Shift', type: 'number', default: 0 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iFrAMA'
  },
  'vidya': {
    name: 'vidya',
    displayName: 'Variable Index Dynamic Average',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 9, min: 1 },
      { name: 'shift', label: 'Shift', type: 'number', default: 0 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iVIDyA'
  },
  'ama': {
    name: 'ama',
    displayName: 'Adaptive Moving Average',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 9, min: 1 },
      { name: 'fastPeriod', label: 'Fast Period', type: 'number', default: 2, min: 1 },
      { name: 'slowPeriod', label: 'Slow Period', type: 'number', default: 30, min: 1 },
      { name: 'shift', label: 'Shift', type: 'number', default: 0 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iAMA'
  },

  // Bands & Channels
  'bb': {
    name: 'bb',
    displayName: 'Bollinger Bands',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 20, min: 1 },
      { name: 'deviation', label: 'Deviation', type: 'double', default: 2.0, min: 0, step: 0.1 },
      { name: 'shift', label: 'Shift', type: 'number', default: 0 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    components: [
      { value: 'upper', label: 'Upper' },
      { value: 'middle', label: 'Middle' },
      { value: 'lower', label: 'Lower' }
    ],
    mqlFunction: 'iBands'
  },
  'envelopes': {
    name: 'envelopes',
    displayName: 'Envelopes',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'deviation', label: 'Deviation', type: 'double', default: 0.1, min: 0, step: 0.01 },
      { name: 'shift', label: 'Shift', type: 'number', default: 0 },
      { name: 'method', label: 'MA Method', type: 'number', default: 0, min: 0, max: 3, options: maMethods },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    components: [
      { value: 'upper', label: 'Upper' },
      { value: 'lower', label: 'Lower' }
    ],
    mqlFunction: 'iEnvelopes'
  },
  'donchian': {
    name: 'donchian',
    displayName: 'Donchian Channels',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 20, min: 1 },
      { name: 'shift', label: 'Shift', type: 'number', default: 0 }
    ],
    components: [
      { value: 'upper', label: 'Upper' },
      { value: 'middle', label: 'Middle' },
      { value: 'lower', label: 'Lower' }
    ],
    mqlFunction: 'Donchian'
  },
  'keltner': {
    name: 'keltner',
    displayName: 'Keltner Channels',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 20, min: 1 },
      { name: 'deviation', label: 'Deviation', type: 'double', default: 2.0, min: 0, step: 0.1 },
      { name: 'shift', label: 'Shift', type: 'number', default: 0 },
      { name: 'method', label: 'MA Method', type: 'number', default: 0, min: 0, max: 3, options: maMethods },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    components: [
      { value: 'upper', label: 'Upper' },
      { value: 'middle', label: 'Middle' },
      { value: 'lower', label: 'Lower' }
    ],
    mqlFunction: 'Keltner'
  },

  // Complex Indicators
  'macd': {
    name: 'macd',
    displayName: 'MACD',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'fastEMA', label: 'Fast EMA', type: 'number', default: 12, min: 1 },
      { name: 'slowEMA', label: 'Slow EMA', type: 'number', default: 26, min: 1 },
      { name: 'signalSMA', label: 'Signal SMA', type: 'number', default: 9, min: 1 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    components: [
      { value: 'line', label: 'Line' },
      { value: 'signal', label: 'Signal' },
      { value: 'histogram', label: 'Histogram' }
    ],
    mqlFunction: 'iMACD'
  },
  'ichimoku': {
    name: 'ichimoku',
    displayName: 'Ichimoku Kinko Hyo',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'tenkanSen', label: 'Tenkan-sen', type: 'number', default: 9, min: 1 },
      { name: 'kijunSen', label: 'Kijun-sen', type: 'number', default: 26, min: 1 },
      { name: 'senkouSpanB', label: 'Senkou Span B', type: 'number', default: 52, min: 1 }
    ],
    components: [
      { value: 'tenkan', label: 'Tenkan-sen' },
      { value: 'kijun', label: 'Kijun-sen' },
      { value: 'chikou', label: 'Chikou Span' },
      { value: 'senkouA', label: 'Senkou Span A' },
      { value: 'senkouB', label: 'Senkou Span B' }
    ],
    mqlFunction: 'iIchimoku'
  },
  'alligator': {
    name: 'alligator',
    displayName: 'Alligator',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'jawPeriod', label: 'Jaw Period', type: 'number', default: 13, min: 1 },
      { name: 'jawShift', label: 'Jaw Shift', type: 'number', default: 8 },
      { name: 'teethPeriod', label: 'Teeth Period', type: 'number', default: 8, min: 1 },
      { name: 'teethShift', label: 'Teeth Shift', type: 'number', default: 5 },
      { name: 'lipsPeriod', label: 'Lips Period', type: 'number', default: 5, min: 1 },
      { name: 'lipsShift', label: 'Lips Shift', type: 'number', default: 3 },
      { name: 'method', label: 'MA Method', type: 'number', default: 2, min: 0, max: 3, options: maMethods },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    components: [
      { value: 'jaw', label: 'Jaw' },
      { value: 'teeth', label: 'Teeth' },
      { value: 'lips', label: 'Lips' }
    ],
    mqlFunction: 'iAlligator'
  },
  'gator': {
    name: 'gator',
    displayName: 'Gator Oscillator',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'jawPeriod', label: 'Jaw Period', type: 'number', default: 13, min: 1 },
      { name: 'jawShift', label: 'Jaw Shift', type: 'number', default: 8 },
      { name: 'teethPeriod', label: 'Teeth Period', type: 'number', default: 8, min: 1 },
      { name: 'teethShift', label: 'Teeth Shift', type: 'number', default: 5 },
      { name: 'lipsPeriod', label: 'Lips Period', type: 'number', default: 5, min: 1 },
      { name: 'lipsShift', label: 'Lips Shift', type: 'number', default: 3 },
      { name: 'method', label: 'MA Method', type: 'number', default: 2, min: 0, max: 3, options: maMethods },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    components: [
      { value: 'upper', label: 'Upper' },
      { value: 'lower', label: 'Lower' }
    ],
    mqlFunction: 'iGator'
  },
  'dmi': {
    name: 'dmi',
    displayName: 'Directional Movement Index',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    components: [
      { value: 'plusDI', label: '+DI' },
      { value: 'minusDI', label: '-DI' },
      { value: 'adx', label: 'ADX' }
    ],
    mqlFunction: 'iADX'
  },
  'adx': {
    name: 'adx',
    displayName: 'Average Directional Index',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iADX'
  },
  'adxWilder': {
    name: 'adxWilder',
    displayName: 'ADX by Welles Wilder',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iADXWilder'
  },

  // Volatility
  'atr': {
    name: 'atr',
    displayName: 'Average True Range',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 14, min: 1 }
    ],
    mqlFunction: 'iATR'
  },
  'stddev': {
    name: 'stddev',
    displayName: 'Standard Deviation',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 20, min: 1 },
      { name: 'shift', label: 'Shift', type: 'number', default: 0 },
      { name: 'method', label: 'MA Method', type: 'number', default: 0, min: 0, max: 3, options: maMethods },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iStdDev'
  },

  // Trend
  'sar': {
    name: 'sar',
    displayName: 'Parabolic SAR',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'step', label: 'Step', type: 'double', default: 0.02, min: 0, max: 1, step: 0.01 },
      { name: 'maximum', label: 'Maximum', type: 'double', default: 0.2, min: 0, max: 1, step: 0.01 }
    ],
    mqlFunction: 'iSAR'
  },

  // Volume
  'obv': {
    name: 'obv',
    displayName: 'On Balance Volume',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes }
    ],
    mqlFunction: 'iOBV'
  },
  'volumes': {
    name: 'volumes',
    displayName: 'Volumes',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'method', label: 'MA Method', type: 'number', default: 0, min: 0, max: 3, options: maMethods },
      { name: 'volumeType', label: 'Volume Type', type: 'number', default: 0, min: 0, max: 1 }
    ],
    components: [
      { value: 'real', label: 'Real' },
      { value: 'tick', label: 'Tick' }
    ],
    mqlFunction: 'iVolumes'
  },
  'bwmfi': {
    name: 'bwmfi',
    displayName: 'Market Facilitation Index',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes }
    ],
    components: [
      { value: 'main', label: 'Main' },
      { value: 'plus', label: 'Plus' },
      { value: 'minus', label: 'Minus' }
    ],
    mqlFunction: 'iBWMFI'
  },

  // Power Indicators
  'bearsPower': {
    name: 'bearsPower',
    displayName: 'Bears Power',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 13, min: 1 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iBearsPower'
  },
  'bullsPower': {
    name: 'bullsPower',
    displayName: 'Bulls Power',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes },
      { name: 'ma_period', label: 'Period', type: 'number', default: 13, min: 1 },
      { name: 'applied_price', label: 'Applied Price', type: 'number', default: 0, min: 0, max: 6, options: appliedPrices }
    ],
    mqlFunction: 'iBullsPower'
  },

  // Other
  'fractals': {
    name: 'fractals',
    displayName: 'Fractals',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes }
    ],
    components: [
      { value: 'upper', label: 'Upper' },
      { value: 'lower', label: 'Lower' }
    ],
    mqlFunction: 'iFractals'
  },
  'vwap': {
    name: 'vwap',
    displayName: 'Volume Weighted Average Price',
    params: [
      { name: 'period', label: 'Timeframe', type: 'number', default: 0, min: 0, max: 43200, options: timeframes }
    ],
    mqlFunction: 'VWAP'
  }
};

export function getIndicatorConfig(indicatorName: string): IndicatorConfig | undefined {
  return indicatorConfigs[indicatorName.toLowerCase()];
}

export function getDefaultParams(indicatorName: string): Record<string, number> {
  const config = getIndicatorConfig(indicatorName);
  if (!config) return {};
  
  const defaults: Record<string, number> = {};
  config.params.forEach(param => {
    defaults[param.name] = param.default;
  });
  return defaults;
}
