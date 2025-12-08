/**
 * TypeScript indicator wrapper using the `technicalindicators` library.
 * Provides a unified API for the backtest engine to compute TA values.
 */

import {
  SMA,
  EMA,
  RSI,
  MACD,
  BollingerBands,
  Stochastic,
  ATR,
  CCI,
  WilliamsR,
  ADX,
  OBV,
  MFI,
} from 'technicalindicators';

export interface OHLCVBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Creates an indicator context bound to a growing price history.
 */
export function createIndicatorContext(bars: OHLCVBar[]) {
  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const volumes = bars.map(b => b.volume);

  return {
    sma: (period: number): number => {
      const result = SMA.calculate({ period, values: closes });
      return result.length > 0 ? result[result.length - 1] : closes[closes.length - 1];
    },
    ema: (period: number): number => {
      const result = EMA.calculate({ period, values: closes });
      return result.length > 0 ? result[result.length - 1] : closes[closes.length - 1];
    },
    rsi: (period: number = 14): number => {
      const result = RSI.calculate({ period, values: closes });
      return result.length > 0 ? result[result.length - 1] : 50;
    },
    macd: (
      fastPeriod = 12,
      slowPeriod = 26,
      signalPeriod = 9,
    ): { macd: number; signal: number; histogram: number } => {
      const result = MACD.calculate({
        values: closes,
        fastPeriod,
        slowPeriod,
        signalPeriod,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      if (result.length === 0) return { macd: 0, signal: 0, histogram: 0 };
      const last = result[result.length - 1];
      return {
        macd: last.MACD ?? 0,
        signal: last.signal ?? 0,
        histogram: last.histogram ?? 0,
      };
    },
    bollingerBands: (
      period = 20,
      stdDev = 2,
    ): { upper: number; middle: number; lower: number } => {
      const result = BollingerBands.calculate({
        period,
        values: closes,
        stdDev,
      });
      if (result.length === 0) {
        const mid = closes[closes.length - 1];
        return { upper: mid, middle: mid, lower: mid };
      }
      const last = result[result.length - 1];
      return { upper: last.upper, middle: last.middle, lower: last.lower };
    },
    stochastic: (
      kPeriod = 14,
      dPeriod = 3,
    ): { k: number; d: number } => {
      const result = Stochastic.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: kPeriod,
        signalPeriod: dPeriod,
      });
      if (result.length === 0) return { k: 50, d: 50 };
      const last = result[result.length - 1];
      return { k: last.k, d: last.d };
    },
    atr: (period = 14): number => {
      const result = ATR.calculate({ high: highs, low: lows, close: closes, period });
      return result.length > 0 ? result[result.length - 1] : 0;
    },
    cci: (period = 20): number => {
      const result = CCI.calculate({ high: highs, low: lows, close: closes, period });
      return result.length > 0 ? result[result.length - 1] : 0;
    },
    williamsR: (period = 14): number => {
      const result = WilliamsR.calculate({ high: highs, low: lows, close: closes, period });
      return result.length > 0 ? result[result.length - 1] : -50;
    },
    adx: (period = 14): number => {
      const result = ADX.calculate({ high: highs, low: lows, close: closes, period });
      return result.length > 0 ? result[result.length - 1].adx : 0;
    },
    mfi: (period = 14): number => {
      const result = MFI.calculate({
        high: highs,
        low: lows,
        close: closes,
        volume: volumes,
        period,
      });
      return result.length > 0 ? result[result.length - 1] : 50;
    },
    obv: (): number => {
      const result = OBV.calculate({ close: closes, volume: volumes });
      return result.length > 0 ? result[result.length - 1] : 0;
    },
    // Raw series accessors
    price: closes[closes.length - 1] ?? 0,
    open: bars[bars.length - 1]?.open ?? 0,
    high: highs[highs.length - 1] ?? 0,
    low: lows[lows.length - 1] ?? 0,
    close: closes[closes.length - 1] ?? 0,
    volume: volumes[volumes.length - 1] ?? 0,
  };
}

export type IndicatorContext = ReturnType<typeof createIndicatorContext>;
