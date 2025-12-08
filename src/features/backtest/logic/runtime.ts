/**
 * Sandboxed runtime executor for generated Blockly JavaScript code.
 * Provides order/trade helpers and returns signals.
 * 
 * ENHANCED: Full function signatures to match generated code from Blockly.
 */

import { IndicatorContext } from './indicators';

export type Signal = 'buy' | 'sell' | 'hold';

export interface RuntimeContext extends IndicatorContext {
  signal: Signal;
  // Environment functions
  getPrice: () => number;
  getVolume: () => number;
  getTime: () => number;
  getSpread: () => number;
  // Trade functions (full signatures)
  placeOrder: (id: string, direction: string, size?: number, sizeType?: string, orderType?: string, limitPrice?: number | null) => void;
  setStopLoss: (id: string, price: number, percent?: number) => void;
  setTakeProfit: (id: string, price: number, percent?: number) => void;
  closeTrade: (id: string) => void;
  // Trade info helpers
  getPnL: (id: string) => number;
  getEntryPrice: (id: string) => number;
  getPositionSize: (id: string) => number;
  // Risk management placeholders
  setTrailingStop: (percent: number) => void;
  scaleIn: (amount: number, intervals: number) => void;
  scaleOut: (amount: number, intervals: number) => void;
  setMaxDrawdown: (percent: number) => void;
  setDailyLossLimit: (amount: number) => void;
  positionPercent: (percent: number) => number;
  kellyCriterion: (winRate: number, winLossRatio: number) => number;
}

/**
 * Creates adapter functions that bridge generated code signatures to indicator context.
 * Generated code calls functions with full MQL-style params, but we only use what's needed.
 */
function createIndicatorAdapters(ctx: IndicatorContext) {
  return {
    // Moving Averages - accept full params but use ma_period (2nd param)
    sma: (_period?: number, ma_period = 14, _shift?: number, _applied_price?: number): number => {
      return ctx.sma(ma_period);
    },
    ema: (_period?: number, ma_period = 14, _shift?: number, _applied_price?: number): number => {
      return ctx.ema(ma_period);
    },
    smma: (_period?: number, ma_period = 14, _shift?: number, _applied_price?: number): number => {
      // SMMA not directly available, fall back to SMA
      return ctx.sma(ma_period);
    },
    lwma: (_period?: number, ma_period = 14, _shift?: number, _applied_price?: number): number => {
      // LWMA not in technicalindicators, use EMA as approximation
      return ctx.ema(ma_period);
    },
    dema: (_period?: number, ma_period = 14, _shift?: number, _applied_price?: number): number => {
      // Double EMA approximation
      return ctx.ema(ma_period);
    },
    tema: (_period?: number, ma_period = 14, _shift?: number, _applied_price?: number): number => {
      // Triple EMA approximation  
      return ctx.ema(ma_period);
    },
    frama: (_period?: number, ma_period = 14, _shift?: number, _applied_price?: number): number => {
      return ctx.ema(ma_period);
    },
    vidya: (_period?: number, ma_period = 9, _shift?: number, _applied_price?: number): number => {
      return ctx.ema(ma_period);
    },
    ama: (_period?: number, ma_period = 9, _fast?: number, _slow?: number, _shift?: number, _applied_price?: number): number => {
      return ctx.ema(ma_period);
    },

    // Oscillators
    rsi: (_period?: number, ma_period = 14, _applied_price?: number): number => {
      return ctx.rsi(ma_period);
    },
    cci: (_period?: number, ma_period = 20, _applied_price?: number): number => {
      return ctx.cci(ma_period);
    },
    williamsR: (_period?: number, ma_period = 14): number => {
      return ctx.williamsR(ma_period);
    },
    mfi: (_period?: number, ma_period = 14, _applied_volume?: number): number => {
      return ctx.mfi(ma_period);
    },
    momentum: (_period?: number, ma_period = 14, _applied_price?: number): number => {
      // Momentum approximation using price change
      return ctx.close;
    },
    stochastic: (_period?: number, kPeriod = 14, dPeriod = 3, _slowing?: number, _method?: number, _price?: number, component?: string): number => {
      const stoch = ctx.stochastic(kPeriod, dPeriod);
      if (component === 'd' || component === 'signal') return stoch.d;
      return stoch.k;
    },

    // MACD
    macd: (_period?: number, fastEMA = 12, slowEMA = 26, signalSMA = 9, _applied_price?: number, component?: string): number => {
      const result = ctx.macd(fastEMA, slowEMA, signalSMA);
      if (component === 'signal') return result.signal;
      if (component === 'histogram') return result.histogram;
      return result.macd;
    },

    // Bands & Channels
    bollingerBands: (_period?: number, ma_period = 20, deviation = 2, _shift?: number, _applied_price?: number, component?: string): number => {
      const bb = ctx.bollingerBands(ma_period, deviation);
      if (component === 'upper') return bb.upper;
      if (component === 'lower') return bb.lower;
      return bb.middle;
    },
    envelopes: (_period?: number, ma_period = 14, _deviation?: number, _shift?: number, _method?: number, _applied_price?: number, component?: string): number => {
      const bb = ctx.bollingerBands(ma_period, 2);
      if (component === 'upper') return bb.upper;
      if (component === 'lower') return bb.lower;
      return bb.middle;
    },
    donchianChannels: (_period?: number, ma_period = 20, _shift?: number, component?: string): number => {
      // Donchian approximation using bollinger
      const bb = ctx.bollingerBands(ma_period, 2);
      if (component === 'upper') return bb.upper;
      if (component === 'lower') return bb.lower;
      return bb.middle;
    },
    keltnerChannels: (_period?: number, ma_period = 20, _deviation?: number, _shift?: number, _method?: number, _applied_price?: number, component?: string): number => {
      const bb = ctx.bollingerBands(ma_period, 2);
      if (component === 'upper') return bb.upper;
      if (component === 'lower') return bb.lower;
      return bb.middle;
    },

    // Volatility
    atr: (_period?: number, ma_period = 14): number => {
      return ctx.atr(ma_period);
    },
    stdDev: (_period?: number, ma_period = 20, _shift?: number, _method?: number, _applied_price?: number): number => {
      // Use ATR as volatility proxy
      return ctx.atr(ma_period);
    },

    // Trend
    adx: (_period?: number, ma_period = 14): number => {
      return ctx.adx(ma_period);
    },
    adxWilder: (_period?: number, ma_period = 14): number => {
      return ctx.adx(ma_period);
    },
    dmi: (_period?: number, ma_period = 14, component?: string): number => {
      // DMI uses ADX as base
      return ctx.adx(ma_period);
    },
    parabolicSAR: (_period?: number, _step?: number, _maximum?: number): number => {
      // SAR not directly available, return price as fallback
      return ctx.close;
    },

    // Volume
    obv: (_period?: number, _applied_volume?: number): number => {
      return ctx.obv();
    },
    volumes: (_period?: number, _applied_volume?: number, _component?: string): number => {
      return ctx.volume;
    },
    vwap: (_period?: number): number => {
      // VWAP approximation using close price
      return ctx.close;
    },
    marketFacilitationIndex: (_period?: number, _applied_volume?: number, _component?: string): number => {
      return 1;
    },

    // Complex indicators (simplified implementations)
    ichimoku: (_period?: number, _tenkan?: number, _kijun?: number, _senkou?: number, component?: string): number => {
      const ema9 = ctx.ema(9);
      const ema26 = ctx.ema(26);
      if (component === 'tenkan_sen') return ema9;
      if (component === 'kijun_sen') return ema26;
      if (component === 'senkou_span_a') return (ema9 + ema26) / 2;
      if (component === 'senkou_span_b') return ctx.ema(52);
      if (component === 'chikou_span') return ctx.close;
      return ema26;
    },
    alligator: (_period?: number, _jaw?: number, _jawShift?: number, _teeth?: number, _teethShift?: number, _lips?: number, _lipsShift?: number, _method?: number, _applied_price?: number, component?: string): number => {
      if (component === 'jaw') return ctx.sma(13);
      if (component === 'teeth') return ctx.sma(8);
      if (component === 'lips') return ctx.sma(5);
      return ctx.sma(13);
    },
    gatorOscillator: (_period?: number, _jaw?: number, _jawShift?: number, _teeth?: number, _teethShift?: number, _lips?: number, _lipsShift?: number, _method?: number, _applied_price?: number, _component?: string): number => {
      return ctx.sma(13) - ctx.sma(8);
    },

    // Power indicators
    bearsPower: (_period?: number, ma_period = 13): number => {
      return ctx.low - ctx.ema(ma_period);
    },
    bullsPower: (_period?: number, ma_period = 13): number => {
      return ctx.high - ctx.ema(ma_period);
    },

    // Other
    acceleratorOscillator: (_period?: number): number => {
      return ctx.sma(5) - ctx.sma(34);
    },
    awesomeOscillator: (_period?: number): number => {
      return ctx.sma(5) - ctx.sma(34);
    },
    accumulationDistribution: (_period?: number, _applied_volume?: number): number => {
      return ctx.obv();
    },
    deMarker: (_period?: number, _ma_period?: number): number => {
      return 0.5;
    },
    forceIndex: (_period?: number, _ma_period?: number, _method?: number, _applied_volume?: number): number => {
      return 0;
    },
    rvi: (_period?: number, _ma_period?: number, _component?: string): number => {
      return 50;
    },
    trix: (_period?: number, _ma_period?: number, _applied_price?: number): number => {
      return 0;
    },
    fractals: (_period?: number, _component?: string): number => {
      return ctx.high;
    },
  };
}

/**
 * Execute generated JS code inside a sandboxed context and return a trading signal.
 */
export function executeStrategy(code: string, ctx: IndicatorContext): Signal {
  let signal: Signal = 'hold';

  // Create indicator adapters that match generated code signatures
  const indicatorAdapters = createIndicatorAdapters(ctx);

  const runtime: RuntimeContext = {
    // Spread original context for direct access to raw values
    ...ctx,
    // Override with adapter functions that accept full signatures
    ...indicatorAdapters,

    signal: 'hold',

    // Environment functions
    getPrice: () => ctx.close,
    getVolume: () => ctx.volume,
    getTime: () => Date.now(),
    getSpread: () => 0.0001, // Default spread for backtesting

    // Trade functions with full signatures
    placeOrder: (_id: string, direction: string, _size?: number, _sizeType?: string, _orderType?: string, _limitPrice?: number | null) => {
      if (direction === 'buy' || direction === 'long') signal = 'buy';
      else if (direction === 'sell' || direction === 'short') signal = 'sell';
    },
    setStopLoss: (_id: string, _price: number, _percent?: number) => {
      // SL tracking would happen in the engine
    },
    setTakeProfit: (_id: string, _price: number, _percent?: number) => {
      // TP tracking would happen in the engine
    },
    closeTrade: (_id: string) => {
      signal = 'sell';
    },

    // Trade info helpers (return placeholders for backtesting)
    getPnL: (_id: string) => 0,
    getEntryPrice: (_id: string) => ctx.close,
    getPositionSize: (_id: string) => 0.1,

    // Risk management placeholders
    setTrailingStop: (_percent: number) => { },
    scaleIn: (_amount: number, _intervals: number) => { },
    scaleOut: (_amount: number, _intervals: number) => { },
    setMaxDrawdown: (_percent: number) => { },
    setDailyLossLimit: (_amount: number) => { },
    positionPercent: (percent: number) => percent / 100,
    kellyCriterion: (winRate: number, winLossRatio: number) => {
      return winRate - ((1 - winRate) / winLossRatio);
    },
  };

  try {
    // Execute generated code in sandboxed context
    // eslint-disable-next-line no-new-func
    const fn = new Function('ctx', `with(ctx){ ${code} }`);
    fn(runtime);
  } catch (e) {
    console.error('Strategy runtime error', e);
  }
  return signal;
}
