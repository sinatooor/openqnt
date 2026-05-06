/**
 * Pure portfolio-risk math. No store/UI dependencies; tested by feeding in
 * arrays. All return-series functions assume daily-frequency returns and use
 * the standard √252 annualization factor.
 */

const TRADING_DAYS = 252;

/** Daily simple returns from a value series. Skips non-finite ratios. */
export function dailyReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const cur = values[i];
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev === 0) continue;
    out.push((cur - prev) / prev);
  }
  return out;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let acc = 0;
  for (const x of xs) acc += (x - m) ** 2;
  return Math.sqrt(acc / (xs.length - 1));
}

export function annualizedVolatility(returns: number[]): number {
  return stdDev(returns) * Math.sqrt(TRADING_DAYS);
}

/**
 * Historical VaR — the (1-confidence) lower-tail loss as a positive number.
 * E.g. confidence=0.95 returns the 5th-percentile loss magnitude.
 * Returns 0 when there is insufficient data.
 */
export function historicalVaR(returns: number[], confidence = 0.95): number {
  if (returns.length < 5) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.max(0, Math.floor((1 - confidence) * sorted.length));
  const r = sorted[idx];
  return r < 0 ? -r : 0;
}

/**
 * Conditional VaR (a.k.a. Expected Shortfall) — average loss in the tail
 * worse than the VaR threshold. Returns 0 when insufficient data.
 */
export function conditionalVaR(returns: number[], confidence = 0.95): number {
  if (returns.length < 5) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const cutoff = Math.max(1, Math.floor((1 - confidence) * sorted.length));
  let s = 0;
  for (let i = 0; i < cutoff; i++) s += sorted[i];
  const m = s / cutoff;
  return m < 0 ? -m : 0;
}

/**
 * Sharpe ratio — annualized excess-return over volatility.
 * rf is the daily risk-free return (e.g. 0.04/252 for a 4% annual rate).
 */
export function sharpe(returns: number[], rf = 0): number {
  if (returns.length < 2) return 0;
  const excess = returns.map((r) => r - rf);
  const sd = stdDev(excess);
  if (sd === 0) return 0;
  return (mean(excess) / sd) * Math.sqrt(TRADING_DAYS);
}

/** Pearson correlation between two equal-length return series. */
export function correlation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

/** Beta of asset returns against benchmark returns. cov(a,b)/var(b). */
export function beta(asset: number[], benchmark: number[]): number {
  const n = Math.min(asset.length, benchmark.length);
  if (n < 2) return 0;
  const ma = mean(asset.slice(0, n));
  const mb = mean(benchmark.slice(0, n));
  let cov = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    cov += (asset[i] - ma) * (benchmark[i] - mb);
    varB += (benchmark[i] - mb) ** 2;
  }
  if (varB === 0) return 0;
  return cov / varB;
}

/** Maximum peak-to-trough drawdown of a value series (positive number). */
export function maxDrawdown(values: number[]): number {
  let peak = -Infinity;
  let mdd = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (peak - v) / peak;
      if (dd > mdd) mdd = dd;
    }
  }
  return mdd;
}

/**
 * Herfindahl–Hirschman concentration index on weights. 0 ≈ perfectly diversified
 * (across many equal positions); 1 = single position. Returns the [0,1] HHI
 * computed on weights expressed as fractions (sum to 1).
 */
export function hhi(weights: number[]): number {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total === 0) return 0;
  let acc = 0;
  for (const w of weights) {
    const wf = Math.max(0, w) / total;
    acc += wf * wf;
  }
  return acc;
}

/** "Effective number of holdings" = 1 / HHI. Higher is better-diversified. */
export function effectiveHoldings(weights: number[]): number {
  const h = hhi(weights);
  return h > 0 ? 1 / h : 0;
}
