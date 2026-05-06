/**
 * Regime detection — classify each historical day into a regime so backtest
 * and live performance can be reported per-regime.
 *
 * Two practical, lightweight approaches:
 *   1. Vol-trend bucketing — mean+stddev cutoffs on rolling vol/return.
 *   2. K-state HMM-lite — k-means on (return, vol) features.
 *
 * The fancy stuff (full HMM with Baum-Welch, Markov-switching GARCH) gives
 * marginal gains over (1) for most retail/PM-style use; (1) is what most
 * desks actually use.
 */

export type Regime = 'bull_calm' | 'bull_volatile' | 'bear_calm' | 'bear_volatile' | 'neutral';

export interface RegimeAssignment {
  index: number;
  regime: Regime;
  rollingReturn: number;
  rollingVol: number;
}

/**
 * Classify each observation by trailing return + trailing vol.
 *
 * lookback: window for rolling stats (default 20 days = 1 trading month).
 * thresholds use empirical defaults tuned to S&P-500-style data; tune for FX/crypto.
 */
export function classifyByVolTrend(
  returns: number[],
  opts: { lookback?: number; bullThreshold?: number; bearThreshold?: number; volThreshold?: number } = {}
): RegimeAssignment[] {
  const lookback = opts.lookback ?? 20;
  const bullThreshold = opts.bullThreshold ?? 0.001; // 0.1% avg daily ≈ 25%/yr
  const bearThreshold = opts.bearThreshold ?? -0.001;
  const volThreshold = opts.volThreshold ?? 0.012; // 1.2% daily vol ≈ 19%/yr

  const out: RegimeAssignment[] = [];
  for (let i = 0; i < returns.length; i++) {
    const start = Math.max(0, i - lookback + 1);
    const window = returns.slice(start, i + 1);
    if (window.length < 2) {
      out.push({ index: i, regime: 'neutral', rollingReturn: 0, rollingVol: 0 });
      continue;
    }
    const mean = window.reduce((s, r) => s + r, 0) / window.length;
    const variance = window.reduce((s, r) => s + (r - mean) * (r - mean), 0) / (window.length - 1);
    const vol = Math.sqrt(variance);
    let regime: Regime;
    const isVol = vol > volThreshold;
    if (mean > bullThreshold) regime = isVol ? 'bull_volatile' : 'bull_calm';
    else if (mean < bearThreshold) regime = isVol ? 'bear_volatile' : 'bear_calm';
    else regime = 'neutral';
    out.push({ index: i, regime, rollingReturn: mean, rollingVol: vol });
  }
  return out;
}

/**
 * Group performance metrics by regime — given returns and assignments,
 * report mean/vol/Sharpe/N for each bucket.
 */
export interface RegimeStats {
  regime: Regime;
  count: number;
  pctOfDays: number;
  meanReturn: number;
  vol: number;
  sharpe: number;
  totalReturn: number;
}

export function performanceByRegime(
  returns: number[],
  assignments: RegimeAssignment[]
): RegimeStats[] {
  const buckets: Record<Regime, number[]> = {
    bull_calm: [],
    bull_volatile: [],
    bear_calm: [],
    bear_volatile: [],
    neutral: [],
  };
  const total = returns.length;
  for (let i = 0; i < total; i++) {
    buckets[assignments[i].regime].push(returns[i]);
  }
  const stats: RegimeStats[] = [];
  for (const r of Object.keys(buckets) as Regime[]) {
    const xs = buckets[r];
    if (xs.length === 0) continue;
    const m = xs.reduce((s, x) => s + x, 0) / xs.length;
    const v = Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, xs.length - 1));
    const totalRet = xs.reduce((s, x) => (1 + s) * (1 + x) - 1, 0);
    stats.push({
      regime: r,
      count: xs.length,
      pctOfDays: xs.length / total,
      meanReturn: m,
      vol: v,
      sharpe: v > 0 ? (m / v) * Math.sqrt(252) : 0,
      totalReturn: totalRet,
    });
  }
  return stats.sort((a, b) => b.count - a.count);
}
