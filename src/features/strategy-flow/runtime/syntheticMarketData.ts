/**
 * syntheticMarketData — Deterministic OHLCV series for in-browser preview.
 *
 * Real market data lives on the backend (yfinance/FMP/Avanza). For the
 * canvas execution preview we don't want to round-trip — we just need a
 * realistic-looking series so indicators produce real (non-random) values
 * that the user can reason about.
 *
 * Series are seeded by ticker, so the same ticker always produces the
 * same series in a session. Tweaking the period in an indicator config
 * therefore produces a *consistent* output change the user can see.
 */

import type { Candle } from './computeKernel';

const TWO_PI = Math.PI * 2;

/** Deterministic hash: string → 32-bit unsigned int. */
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

/** mulberry32 — tiny, fast, deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, Candle[]>();

export type SyntheticOptions = {
  ticker?: string;
  bars?: number;
  startPrice?: number;
  /** Daily-equivalent vol; 0.02 ≈ 2% daily. */
  volatility?: number;
  /** Drift per bar; small positive = uptrend bias. */
  drift?: number;
  /** Bar interval in ms (60 = minute, 3600000 = hourly, 86400000 = daily). */
  intervalMs?: number;
};

/**
 * Generate (or fetch cached) synthetic candles for a ticker.
 *
 * Mixes a sine wave (cyclical regime), a random walk (noise) and small
 * drift to produce a series that exercises trend, mean-reversion and
 * volatility indicators without looking unrealistic.
 */
export function getSyntheticCandles(opts: SyntheticOptions = {}): Candle[] {
  const ticker = (opts.ticker || 'SPY').toUpperCase();
  const bars = opts.bars ?? 250;
  const cacheKey = `${ticker}:${bars}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const seed = hashSeed(ticker);
  const rand = mulberry32(seed);
  const startPrice = opts.startPrice ?? 100 + (seed % 400);
  const vol = opts.volatility ?? 0.018;
  const drift = opts.drift ?? 0.0002;
  const intervalMs = opts.intervalMs ?? 86_400_000; // 1 day
  const now = Date.now();

  const candles: Candle[] = [];
  let price = startPrice;
  // Cycle component — period roughly 1/4 of total bars
  const cyclePeriod = Math.max(20, Math.floor(bars / 4));
  const cycleAmp = startPrice * 0.06;

  for (let i = 0; i < bars; i++) {
    // log-normal walk + small drift
    const z = (rand() - 0.5) * 2; // ~uniform; close enough for preview
    const cyclical = Math.sin((i / cyclePeriod) * TWO_PI) * cycleAmp;
    const stepReturn = drift + vol * z * 0.5;
    price = Math.max(0.01, price * (1 + stepReturn) + cyclical * 0.02);

    // Build bar: open from prev close, close = price, h/l with intra-bar noise
    const open = candles.length === 0 ? startPrice : candles[candles.length - 1].close;
    const high = Math.max(open, price) * (1 + Math.abs(rand()) * 0.005);
    const low = Math.min(open, price) * (1 - Math.abs(rand()) * 0.005);
    const volume = Math.floor(1_000_000 + rand() * 5_000_000);
    const timestamp = now - (bars - i) * intervalMs;

    candles.push({ open, high, low, close: price, volume, timestamp });
  }

  cache.set(cacheKey, candles);
  return candles;
}

/** Clear the synthetic data cache (e.g. when user changes the strategy ticker). */
export function clearSyntheticCache(): void {
  cache.clear();
}
