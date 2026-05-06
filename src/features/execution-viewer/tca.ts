/**
 * Transaction-cost analysis (TCA) primitives.
 *
 * Implementation Shortfall = (Decision Price − Fill Price) × Side × Qty + Fees.
 *  - Side = +1 for buys (paid more than DP = cost), -1 for sells.
 * Slippage vs Arrival = (Fill Price − Arrival Price) × Side, in bps of arrival.
 * Slippage vs Interval VWAP = (Fill Price − VWAP) × Side, in bps of VWAP.
 *
 * All bps are reported as positive numbers when costly to the trader.
 */

export interface FillReport {
  /** Side at decision time. */
  side: 'buy' | 'sell';
  qty: number;
  /** Price when the trade decision was made (paper price). */
  decisionPrice: number;
  /** Mid/arrival price when the order entered the market. */
  arrivalPrice: number;
  /** Average fill price. */
  fillPrice: number;
  /** Volume-weighted average price across the order's interval. */
  intervalVwap: number;
  /** Total commission/fees paid in trade currency. */
  fees: number;
}

export interface TCAResult {
  /** Implementation shortfall in trade currency (positive = cost). */
  implementationShortfall: number;
  /** Implementation shortfall in basis points of decision-price notional. */
  isShortfallBps: number;
  /** Slippage vs arrival in bps of arrival-price notional (positive = cost). */
  slippageVsArrivalBps: number;
  /** Slippage vs interval VWAP in bps of VWAP notional (positive = cost). */
  slippageVsVwapBps: number;
  /** Effective fee bps on traded notional (filled qty × fillPrice). */
  feesBps: number;
}

export function computeTCA(f: FillReport): TCAResult {
  const sign = f.side === 'buy' ? 1 : -1;
  const decisionNotional = f.decisionPrice * f.qty;
  const arrivalNotional = f.arrivalPrice * f.qty;
  const vwapNotional = f.intervalVwap * f.qty;
  const filledNotional = f.fillPrice * f.qty;

  const isCost = sign * (f.fillPrice - f.decisionPrice) * f.qty + f.fees;
  const slippageArrival = sign * (f.fillPrice - f.arrivalPrice) * f.qty;
  const slippageVwap = sign * (f.fillPrice - f.intervalVwap) * f.qty;

  const bps = (cost: number, denom: number) => (denom > 0 ? (cost / denom) * 10_000 : 0);

  return {
    implementationShortfall: isCost,
    isShortfallBps: bps(isCost, decisionNotional),
    slippageVsArrivalBps: bps(slippageArrival, arrivalNotional),
    slippageVsVwapBps: bps(slippageVwap, vwapNotional),
    feesBps: bps(f.fees, filledNotional),
  };
}

/** Aggregate TCA across many fills, weighted by traded notional. */
export function aggregateTCA(fills: FillReport[]): TCAResult & { count: number; totalNotional: number } {
  let totalNotional = 0;
  let isAbs = 0;
  let slipArrAbs = 0;
  let slipVwapAbs = 0;
  let feesAbs = 0;
  let weightedDecisionN = 0;
  let weightedArrivalN = 0;
  let weightedVwapN = 0;
  let weightedFilledN = 0;

  for (const f of fills) {
    const res = computeTCA(f);
    const filledNotional = f.fillPrice * f.qty;
    totalNotional += filledNotional;
    isAbs += res.implementationShortfall;
    slipArrAbs += (res.slippageVsArrivalBps / 10_000) * (f.arrivalPrice * f.qty);
    slipVwapAbs += (res.slippageVsVwapBps / 10_000) * (f.intervalVwap * f.qty);
    feesAbs += f.fees;
    weightedDecisionN += f.decisionPrice * f.qty;
    weightedArrivalN += f.arrivalPrice * f.qty;
    weightedVwapN += f.intervalVwap * f.qty;
    weightedFilledN += filledNotional;
  }
  return {
    count: fills.length,
    totalNotional,
    implementationShortfall: isAbs,
    isShortfallBps: weightedDecisionN > 0 ? (isAbs / weightedDecisionN) * 10_000 : 0,
    slippageVsArrivalBps: weightedArrivalN > 0 ? (slipArrAbs / weightedArrivalN) * 10_000 : 0,
    slippageVsVwapBps: weightedVwapN > 0 ? (slipVwapAbs / weightedVwapN) * 10_000 : 0,
    feesBps: weightedFilledN > 0 ? (feesAbs / weightedFilledN) * 10_000 : 0,
  };
}
