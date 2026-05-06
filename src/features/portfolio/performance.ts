/**
 * Performance computation — time-weighted return (TWR), money-weighted
 * return (IRR / MWR), and a Brinson allocation/selection split.
 *
 * TWR is the GIPS-standard for advisor reporting (cash flow neutral).
 * MWR / IRR is the right number for the investor's actual cash experience.
 * Reports should typically show both, clearly labelled.
 */

export interface CashFlow {
  /** ms epoch. */
  date: number;
  /** Positive = contribution into account, negative = withdrawal. */
  amount: number;
}

export interface TwrSegment {
  /** Start-of-period market value (after any contribution at this instant). */
  startValue: number;
  /** End-of-period value before any cash flow. */
  endValue: number;
  /** Cash flow at the START of the period (already in startValue). */
  contribution: number;
}

/**
 * TWR — chains period returns geometrically. Each segment isolates a period
 * with no internal cash flows; cash flows happen between segments.
 *
 * r_i = (endValue_i - contribution_i) / startValue_i
 * TWR = ∏(1 + r_i) - 1
 */
export function twr(segments: TwrSegment[]): number {
  let product = 1;
  for (const s of segments) {
    if (s.startValue <= 0) continue;
    const r = (s.endValue - s.contribution) / s.startValue;
    if (Number.isFinite(r)) product *= 1 + r;
  }
  return product - 1;
}

/**
 * IRR / money-weighted return — the rate that NPV(cash flows) = 0. Uses
 * Newton-Raphson with bisection fallback.
 *
 * Convention: contributions are NEGATIVE (cash leaves the investor),
 * withdrawals/closing-value are POSITIVE.
 */
export function irr(flows: CashFlow[], guess = 0.1): number {
  if (flows.length < 2) return NaN;
  const t0 = flows[0].date;
  const dt = flows.map((f) => (f.date - t0) / (365.25 * 86_400_000)); // years

  const npv = (rate: number) => {
    let s = 0;
    for (let i = 0; i < flows.length; i++) {
      s += flows[i].amount / Math.pow(1 + rate, dt[i]);
    }
    return s;
  };
  const dnpv = (rate: number) => {
    let s = 0;
    for (let i = 0; i < flows.length; i++) {
      s -= (dt[i] * flows[i].amount) / Math.pow(1 + rate, dt[i] + 1);
    }
    return s;
  };

  // Newton-Raphson
  let r = guess;
  for (let i = 0; i < 100; i++) {
    const f = npv(r);
    if (Math.abs(f) < 1e-9) return r;
    const fp = dnpv(r);
    if (Math.abs(fp) < 1e-12) break;
    const next = r - f / fp;
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - r) < 1e-9) return next;
    r = Math.max(-0.99, next);
  }

  // Bisection fallback
  let lo = -0.99;
  let hi = 10;
  let fLo = npv(lo);
  let fHi = npv(hi);
  if (fLo * fHi > 0) return NaN;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fM = npv(mid);
    if (Math.abs(fM) < 1e-9 || hi - lo < 1e-9) return mid;
    if (fM * fLo < 0) {
      hi = mid;
      fHi = fM;
    } else {
      lo = mid;
      fLo = fM;
    }
  }
  return (lo + hi) / 2;
}

// ─── Brinson allocation/selection attribution ───────────────────────────

export interface SectorSlice {
  sector: string;
  /** Portfolio weight in [0,1]. */
  portfolioWeight: number;
  /** Benchmark weight in [0,1]. */
  benchmarkWeight: number;
  /** Sector return earned by the portfolio's holdings in this sector. */
  portfolioReturn: number;
  /** Sector return per the benchmark. */
  benchmarkReturn: number;
}

export interface BrinsonResult {
  /** Sum across sectors of (wp_i - wb_i) * rb_i. */
  allocation: number;
  /** Sum across sectors of wb_i * (rp_i - rb_i). */
  selection: number;
  /** Sum across sectors of (wp_i - wb_i) * (rp_i - rb_i). */
  interaction: number;
  /** Total active return = allocation + selection + interaction. */
  active: number;
  /** Per-sector breakdown. */
  bySector: {
    sector: string;
    allocation: number;
    selection: number;
    interaction: number;
  }[];
}

export function brinson(slices: SectorSlice[]): BrinsonResult {
  let allocation = 0;
  let selection = 0;
  let interaction = 0;
  const bySector: BrinsonResult['bySector'] = [];
  for (const s of slices) {
    const a = (s.portfolioWeight - s.benchmarkWeight) * s.benchmarkReturn;
    const sel = s.benchmarkWeight * (s.portfolioReturn - s.benchmarkReturn);
    const i = (s.portfolioWeight - s.benchmarkWeight) * (s.portfolioReturn - s.benchmarkReturn);
    allocation += a;
    selection += sel;
    interaction += i;
    bySector.push({ sector: s.sector, allocation: a, selection: sel, interaction: i });
  }
  return { allocation, selection, interaction, active: allocation + selection + interaction, bySector };
}
