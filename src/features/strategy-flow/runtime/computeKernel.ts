/**
 * computeKernel — Browser-side indicator compute kernel.
 *
 * Designed as a thin abstraction over the actual numerical implementation so
 * the JS backing can be swapped for a real WASM module without touching any
 * call sites. The public surface is async (`init()`) so a future loader can
 * fetch and instantiate a `.wasm` binary, then resolve.
 *
 *   await kernel.init();
 *   const out = kernel.compute('rsi', candles, { period: 14 });
 *   // out.values is the time series; out.value is the latest (most recent).
 *
 * Currently backed by hand-rolled TypeScript. Each indicator is O(n) over
 * the candle array, well under 1ms for n=1000 in V8 — the WASM win at this
 * size is small. The architecture matters more than the binary right now.
 *
 * Indicators implemented: SMA, EMA, RSI, MACD, BB, ATR, Stochastic.
 *
 * NaN is used as the "warmup" sentinel — values before the indicator has
 * enough history. Consumers should check Number.isNaN().
 */

export type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
};

export type IndicatorOutput = {
  /** Time series of values aligned with input candles. NaN during warmup. */
  values: number[];
  /** Latest (most recent) value. Number.NaN if not yet warm. */
  value: number;
  /** For multi-output indicators (MACD, BB, Stoch). */
  series?: Record<string, number[]>;
  /** Latest values for series. */
  latest?: Record<string, number>;
};

export type KernelStatus = {
  ready: boolean;
  backend: 'js' | 'wasm';
  initializedAt: number;
};

// ---------------------------------------------------------------------------
// Indicator implementations (pure JS for now; swap-in for WASM later)
// ---------------------------------------------------------------------------

const closes = (candles: Candle[]): number[] => candles.map((c) => c.close);

function sma(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(Number.NaN);
  if (period < 1 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(Number.NaN);
  if (period < 1 || values.length === 0) return out;
  const k = 2 / (period + 1);
  // Seed with the SMA of the first `period` values
  if (values.length < period) return out;
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  out[period - 1] = seed / period;
  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

function rsi(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(Number.NaN);
  if (values.length <= period) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function macd(values: number[], fast: number, slow: number, signal: number): {
  line: number[];
  signal: number[];
  histogram: number[];
} {
  const fastE = ema(values, fast);
  const slowE = ema(values, slow);
  const line = values.map((_, i) => {
    const f = fastE[i];
    const s = slowE[i];
    return Number.isNaN(f) || Number.isNaN(s) ? Number.NaN : f - s;
  });
  // Signal = EMA of MACD line (skipping NaN warmup region)
  const firstReal = line.findIndex((v) => !Number.isNaN(v));
  let signalSeries: number[];
  if (firstReal === -1) {
    signalSeries = new Array(values.length).fill(Number.NaN);
  } else {
    const trimmed = line.slice(firstReal);
    const sig = ema(trimmed, signal);
    signalSeries = new Array(firstReal).fill(Number.NaN).concat(sig);
  }
  const histogram = line.map((v, i) =>
    Number.isNaN(v) || Number.isNaN(signalSeries[i]) ? Number.NaN : v - signalSeries[i]
  );
  return { line, signal: signalSeries, histogram };
}

function bollinger(values: number[], period: number, stdDev: number): {
  upper: number[];
  middle: number[];
  lower: number[];
} {
  const middle = sma(values, period);
  const upper = new Array(values.length).fill(Number.NaN);
  const lower = new Array(values.length).fill(Number.NaN);
  for (let i = period - 1; i < values.length; i++) {
    const mean = middle[i];
    if (Number.isNaN(mean)) continue;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (values[j] - mean) ** 2;
    const sd = Math.sqrt(sumSq / period);
    upper[i] = mean + stdDev * sd;
    lower[i] = mean - stdDev * sd;
  }
  return { upper, middle, lower };
}

function atr(candles: Candle[], period: number): number[] {
  const out = new Array(candles.length).fill(Number.NaN);
  if (candles.length < period + 1) return out;
  const trs: number[] = [Number.NaN];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  // First ATR = simple average of first `period` TRs (skip index 0)
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += trs[i];
  out[period] = sum / period;
  for (let i = period + 1; i < candles.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + trs[i]) / period;
  }
  return out;
}

function stochastic(candles: Candle[], kPeriod: number, dPeriod: number): {
  k: number[];
  d: number[];
} {
  const k = new Array(candles.length).fill(Number.NaN);
  for (let i = kPeriod - 1; i < candles.length; i++) {
    let high = -Infinity;
    let low = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].high > high) high = candles[j].high;
      if (candles[j].low < low) low = candles[j].low;
    }
    const denom = high - low;
    k[i] = denom === 0 ? 50 : ((candles[i].close - low) / denom) * 100;
  }
  const d = sma(k, dPeriod);
  return { k, d };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let _status: KernelStatus = { ready: false, backend: 'js', initializedAt: 0 };

export const computeKernel = {
  /**
   * Initialize the kernel. Today returns immediately (JS backend). A future
   * impl will `fetch('/wasm/indicators.wasm')` and instantiate it here,
   * swapping `backend` to `'wasm'` before resolving.
   */
  async init(): Promise<KernelStatus> {
    if (!_status.ready) {
      _status = { ready: true, backend: 'js', initializedAt: Date.now() };
    }
    return _status;
  },

  status(): KernelStatus {
    return _status;
  },

  /**
   * Run an indicator. Returns time series + latest value. NaN-safe.
   */
  compute(
    indicator: string,
    candles: Candle[],
    params: Record<string, number | string> = {}
  ): IndicatorOutput {
    if (!candles || candles.length === 0) {
      return { values: [], value: Number.NaN };
    }
    const c = closes(candles);

    switch (indicator) {
      case 'sma': {
        const p = Number(params.period ?? 20);
        const vs = sma(c, p);
        return { values: vs, value: vs[vs.length - 1] };
      }
      case 'ema': {
        const p = Number(params.period ?? 20);
        const vs = ema(c, p);
        return { values: vs, value: vs[vs.length - 1] };
      }
      case 'rsi': {
        const p = Number(params.period ?? 14);
        const vs = rsi(c, p);
        return { values: vs, value: vs[vs.length - 1] };
      }
      case 'macd': {
        const fast = Number(params.fastPeriod ?? params.fast ?? 12);
        const slow = Number(params.slowPeriod ?? params.slow ?? 26);
        const sig = Number(params.signalPeriod ?? params.signal ?? 9);
        const r = macd(c, fast, slow, sig);
        return {
          values: r.line,
          value: r.line[r.line.length - 1],
          series: r,
          latest: {
            line: r.line[r.line.length - 1],
            signal: r.signal[r.signal.length - 1],
            histogram: r.histogram[r.histogram.length - 1],
          },
        };
      }
      case 'bb': {
        const p = Number(params.period ?? 20);
        const sd = Number(params.stdDev ?? 2);
        const r = bollinger(c, p, sd);
        return {
          values: r.middle,
          value: r.middle[r.middle.length - 1],
          series: r,
          latest: {
            upper: r.upper[r.upper.length - 1],
            middle: r.middle[r.middle.length - 1],
            lower: r.lower[r.lower.length - 1],
          },
        };
      }
      case 'atr': {
        const p = Number(params.period ?? 14);
        const vs = atr(candles, p);
        return { values: vs, value: vs[vs.length - 1] };
      }
      case 'stochastic': {
        const k = Number(params.kPeriod ?? params.k ?? 14);
        const d = Number(params.dPeriod ?? params.d ?? 3);
        const r = stochastic(candles, k, d);
        return {
          values: r.k,
          value: r.k[r.k.length - 1],
          series: r,
          latest: { k: r.k[r.k.length - 1], d: r.d[r.d.length - 1] },
        };
      }
      default:
        // Unknown indicator → return NaN series; caller falls back to backend.
        return { values: new Array(candles.length).fill(Number.NaN), value: Number.NaN };
    }
  },

  /**
   * List indicators the browser kernel can compute. Anything not in this set
   * must be delegated to the Python backend.
   */
  supports(indicator: string): boolean {
    return ['sma', 'ema', 'rsi', 'macd', 'bb', 'atr', 'stochastic'].includes(indicator);
  },
};
