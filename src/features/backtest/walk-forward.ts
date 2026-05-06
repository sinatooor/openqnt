/**
 * Walk-forward validation + look-ahead bias detection for backtests.
 *
 * Walk-forward splits the timeline into N consecutive (train, test) pairs;
 * the test window of pair i is the training input for pair i+1. The strategy
 * is re-fit on training and evaluated only on the test window — every metric
 * reported is purely out-of-sample.
 *
 * Look-ahead detection runs a heuristic over the strategy's feature
 * dependency graph (or, when not available, its parameter dict) and warns
 * about anything that looks like it uses future information.
 */

export interface WalkForwardWindow {
  /** Start index (inclusive) into the unified timeline. */
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
}

export interface WalkForwardConfig {
  /** Total bars in the timeline. */
  total: number;
  /** Initial training-window length (bars). */
  trainBars: number;
  /** Test-window length (bars). */
  testBars: number;
  /** "expanding" grows the train window each step; "rolling" keeps it fixed. */
  mode: 'expanding' | 'rolling';
}

export function buildWalkForwardWindows(cfg: WalkForwardConfig): WalkForwardWindow[] {
  const out: WalkForwardWindow[] = [];
  if (cfg.total < cfg.trainBars + cfg.testBars) return out;
  let trainStart = 0;
  let trainEnd = cfg.trainBars - 1;
  while (trainEnd + cfg.testBars < cfg.total) {
    const testStart = trainEnd + 1;
    const testEnd = Math.min(cfg.total - 1, testStart + cfg.testBars - 1);
    out.push({ trainStart, trainEnd, testStart, testEnd });
    if (cfg.mode === 'rolling') {
      trainStart = trainStart + cfg.testBars;
      trainEnd = trainEnd + cfg.testBars;
    } else {
      trainEnd = testEnd;
    }
  }
  return out;
}

// ─── Look-ahead detection ───────────────────────────────────────────

export interface FeatureDependency {
  name: string;
  /** Bar offsets the feature reads from. Negative = past, 0 = current, positive = future. */
  reads: number[];
  /** Whether the feature is computed at decision time on bar t. */
  computedAt: 't';
}

export interface LookAheadReport {
  ok: boolean;
  violations: { feature: string; reason: string; severity: 'low' | 'medium' | 'high' }[];
  warnings: string[];
}

/**
 * A feature passes iff `reads` all reference bar offsets ≤ 0 (past or current).
 *
 * Any read with offset > 0 is a hard violation. Features that read from bar 0
 * (today's close, etc.) are flagged as "use the prior close on the open" —
 * common bias source. Indicators with min-window > 0 don't get flagged here
 * (that's a warmup, not a leak).
 */
export function detectLookAhead(features: FeatureDependency[]): LookAheadReport {
  const violations: LookAheadReport['violations'] = [];
  const warnings: string[] = [];
  for (const f of features) {
    for (const offset of f.reads) {
      if (offset > 0) {
        violations.push({
          feature: f.name,
          reason: `reads bar t+${offset} (future) at decision time t`,
          severity: 'high',
        });
      } else if (offset === 0) {
        warnings.push(
          `${f.name} reads bar t at decision time t — make sure you're using the OPEN, not the CLOSE, for execution.`
        );
      }
    }
  }
  return { ok: violations.length === 0, violations, warnings };
}

// ─── Survivorship-bias warning ──────────────────────────────────────

export interface SurvivorshipReport {
  ok: boolean;
  message: string;
  recommendation: string;
}

/**
 * Heuristic: any backtest universe that contains only currently-active tickers
 * over a multi-year window has survivorship bias by construction. Real datasets
 * include delisted/merged tickers (LEH, BSC, WDC pre-merger, etc.).
 */
export function checkSurvivorshipBias(opts: {
  universeSize: number;
  hasDelistedTickers: boolean;
  windowYears: number;
}): SurvivorshipReport {
  if (opts.windowYears < 2) {
    return {
      ok: true,
      message: 'Window is short enough that survivorship bias is minor.',
      recommendation: 'No action needed.',
    };
  }
  if (!opts.hasDelistedTickers) {
    return {
      ok: false,
      message: `Universe of ${opts.universeSize} symbols over ${opts.windowYears.toFixed(1)} years contains no delisted/merged tickers — survivorship bias likely.`,
      recommendation:
        'Source point-in-time membership (FactSet/Compustat/Norgate) and include delisted symbols. Long-only equity backtests can overstate Sharpe by 0.3–0.6 without this fix.',
    };
  }
  return {
    ok: true,
    message: 'Universe includes delisted/merged tickers.',
    recommendation: 'Verify the inclusion timestamp matches PIT (point-in-time) membership.',
  };
}

// ─── Capacity analysis ──────────────────────────────────────────────

export interface CapacityScenario {
  /** Notional traded per rebalance (USD). */
  notional: number;
  /** Sqrt-impact assumption: cost in bps = k × √(notional / ADV). */
  k?: number;
  /** Average daily volume of the universe (shares × price). */
  adv: number;
  /** Per-rebalance turnover as fraction of book (1.0 = full turnover). */
  turnover: number;
}

export interface CapacityResult {
  /** Estimated AUM at which expected alpha equals expected impact (USD). */
  breakEvenAUM: number;
  /** Cost in bps at the requested notional. */
  costBpsAtNotional: number;
  /** Notional implied by 0.25 / 0.5 / 1.0 / 2.0 × ADV (cost knees). */
  knees: { ratio: number; cost_bps: number; notional: number }[];
}

export function capacity(scenario: CapacityScenario, expectedAlphaBps: number): CapacityResult {
  const k = scenario.k ?? 10; // 10 bps × √fraction of ADV; rough institutional default
  const cost_bps = (n: number) => k * Math.sqrt(n / Math.max(1, scenario.adv));
  // Break-even AUM: cost_bps(turnover * AUM) === expectedAlphaBps
  // → k √(turnover * AUM / ADV) = α → AUM = (α / k)² × ADV / turnover
  const breakEvenAUM =
    expectedAlphaBps > 0
      ? Math.pow(expectedAlphaBps / k, 2) * scenario.adv / Math.max(1e-9, scenario.turnover)
      : NaN;
  const knees = [0.25, 0.5, 1.0, 2.0].map((ratio) => ({
    ratio,
    cost_bps: cost_bps(ratio * scenario.adv),
    notional: ratio * scenario.adv,
  }));
  return {
    breakEvenAUM,
    costBpsAtNotional: cost_bps(scenario.notional),
    knees,
  };
}
