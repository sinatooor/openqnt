/**
 * Black-Scholes pricing and Greeks for European options on dividend-paying
 * underliers. Inputs use decimals (vol = 0.20, rate = 0.05).
 *
 * Sufficient for the option chain UI's quote-time Greeks; not an interview-
 * grade derivatives library — there is no American early-exercise treatment.
 */

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** Standard normal CDF via Abramowitz–Stegun approximation. */
export function normCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * ax);
  const y =
    1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

/** Standard normal PDF. */
export function normPdf(x: number): number {
  return Math.exp(-(x * x) / 2) / SQRT_2PI;
}

export interface OptionSpec {
  /** Spot price of underlier. */
  S: number;
  /** Strike. */
  K: number;
  /** Risk-free rate (annual, decimal). */
  r: number;
  /** Continuous dividend yield (annual, decimal). 0 for non-dividend-paying. */
  q: number;
  /** Implied volatility (annual, decimal). */
  sigma: number;
  /** Time to expiry in years. */
  T: number;
  /** Call or put. */
  type: 'call' | 'put';
}

function d1d2(o: OptionSpec): { d1: number; d2: number } {
  const { S, K, r, q, sigma, T } = o;
  const denom = sigma * Math.sqrt(T);
  if (denom <= 0) return { d1: 0, d2: 0 };
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / denom;
  const d2 = d1 - denom;
  return { d1, d2 };
}

/** Black-Scholes price. */
export function bsPrice(o: OptionSpec): number {
  const { S, K, r, q, T, type } = o;
  if (T <= 0) {
    return Math.max(0, type === 'call' ? S - K : K - S);
  }
  const { d1, d2 } = d1d2(o);
  if (type === 'call') {
    return S * Math.exp(-q * T) * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
  }
  return K * Math.exp(-r * T) * normCdf(-d2) - S * Math.exp(-q * T) * normCdf(-d1);
}

export interface Greeks {
  price: number;
  delta: number;
  gamma: number;
  vega: number;   // per 1.0 vol change (== per 100 vol points)
  theta: number;  // per year; divide by 365 for per-day
  rho: number;    // per 1.0 rate change
}

/** Full Greeks for a single option. */
export function bsGreeks(o: OptionSpec): Greeks {
  const { S, K, r, q, sigma, T, type } = o;
  if (T <= 0 || sigma <= 0) {
    return {
      price: bsPrice(o),
      delta: type === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0),
      gamma: 0,
      vega: 0,
      theta: 0,
      rho: 0,
    };
  }
  const { d1, d2 } = d1d2(o);
  const Nd1 = normCdf(d1);
  const Nd2 = normCdf(d2);
  const nd1 = normPdf(d1);
  const eq = Math.exp(-q * T);
  const er = Math.exp(-r * T);
  const price = bsPrice(o);
  const delta = type === 'call' ? eq * Nd1 : eq * (Nd1 - 1);
  const gamma = (eq * nd1) / (S * sigma * Math.sqrt(T));
  const vega = S * eq * nd1 * Math.sqrt(T);
  const theta =
    type === 'call'
      ? -(S * eq * nd1 * sigma) / (2 * Math.sqrt(T)) -
        r * K * er * Nd2 +
        q * S * eq * Nd1
      : -(S * eq * nd1 * sigma) / (2 * Math.sqrt(T)) +
        r * K * er * normCdf(-d2) -
        q * S * eq * normCdf(-d1);
  const rho = type === 'call' ? K * T * er * Nd2 : -K * T * er * normCdf(-d2);
  return { price, delta, gamma, vega, theta, rho };
}

/**
 * Newton-Raphson IV solver. Returns NaN if it doesn't converge or the price
 * is below intrinsic. Starts from a Brenner-Subrahmanyam approximation.
 */
export function impliedVol(
  o: Omit<OptionSpec, 'sigma'>,
  marketPrice: number,
  tol = 1e-6,
  maxIter = 60
): number {
  const intrinsic =
    o.type === 'call' ? Math.max(0, o.S - o.K * Math.exp(-o.r * o.T)) : Math.max(0, o.K * Math.exp(-o.r * o.T) - o.S);
  if (marketPrice < intrinsic) return NaN;
  // Brenner-Subrahmanyam initial guess: vol ≈ √(2π/T) · price/S
  let sigma = Math.max(1e-4, Math.sqrt((2 * Math.PI) / o.T) * (marketPrice / o.S));
  for (let i = 0; i < maxIter; i++) {
    const g = bsGreeks({ ...o, sigma });
    const diff = g.price - marketPrice;
    if (Math.abs(diff) < tol) return sigma;
    if (g.vega < 1e-10) return NaN;
    sigma = Math.max(1e-6, sigma - diff / g.vega);
  }
  return NaN;
}
