/**
 * Slippage and commission models for backtests.
 *
 * Backtests that ignore execution costs systematically overstate Sharpe by
 * 0.3–1.5 depending on holding period and AUM. These functions return a
 * per-fill cost so the backtester can subtract before computing returns.
 *
 * Models:
 *   • flat_bps: cost = price × bps × qty.
 *   • sqrt_size: cost = price × k × √(qty/ADV) × qty (square-root market impact).
 *   • broker_schedule: tiered $/share + min/max ticket.
 */

export type SlippageModelKind = 'flat_bps' | 'sqrt_size' | 'none';

export interface SlippageParams {
  kind: SlippageModelKind;
  /** Used by flat_bps: cost in basis points of notional. */
  bps?: number;
  /** Used by sqrt_size: market-impact coefficient (typical 0.05–0.20). */
  k?: number;
  /** Used by sqrt_size: average daily volume of the asset (shares). */
  adv?: number;
}

export type CommissionKind = 'percent' | 'per_share' | 'flat_per_trade' | 'none';

export interface CommissionParams {
  kind: CommissionKind;
  /** Used by percent: commission as fraction of notional. */
  pct?: number;
  /** Used by per_share: $/share. */
  perShare?: number;
  /** Used by per_share: $ minimum per ticket. */
  minTicket?: number;
  /** Used by per_share: $ maximum per ticket. */
  maxTicket?: number;
  /** Used by flat_per_trade: $ per trade. */
  flat?: number;
}

export interface ExecCostInputs {
  side: 'buy' | 'sell';
  price: number;
  qty: number;
}

/** Slippage in absolute currency. Always non-negative; sign applied by caller. */
export function slippageCost(p: SlippageParams, e: ExecCostInputs): number {
  switch (p.kind) {
    case 'flat_bps': {
      const bps = p.bps ?? 0;
      return e.price * Math.abs(e.qty) * (bps / 10_000);
    }
    case 'sqrt_size': {
      const k = p.k ?? 0.10;
      const adv = p.adv ?? 1;
      const ratio = Math.max(0, Math.abs(e.qty) / adv);
      return e.price * Math.abs(e.qty) * k * Math.sqrt(ratio);
    }
    case 'none':
    default:
      return 0;
  }
}

/** Commission in absolute currency. Always non-negative. */
export function commissionCost(c: CommissionParams, e: ExecCostInputs): number {
  switch (c.kind) {
    case 'percent': {
      const pct = c.pct ?? 0;
      return e.price * Math.abs(e.qty) * pct;
    }
    case 'per_share': {
      const ps = c.perShare ?? 0.005;
      const raw = ps * Math.abs(e.qty);
      const min = c.minTicket ?? 0;
      const max = c.maxTicket ?? Infinity;
      return Math.min(max, Math.max(min, raw));
    }
    case 'flat_per_trade':
      return c.flat ?? 0;
    case 'none':
    default:
      return 0;
  }
}

/**
 * Effective fill price after slippage. Buys pay up; sells receive less.
 * Commission is returned separately because some venues report it explicitly
 * on the fill (so the basis math should keep it visible, not folded into price).
 */
export function applyExecCosts(
  slip: SlippageParams,
  comm: CommissionParams,
  e: ExecCostInputs
): { fillPrice: number; commission: number; slippage: number } {
  const slip$ = slippageCost(slip, e);
  const comm$ = commissionCost(comm, e);
  // Convert dollar slippage to per-unit price impact
  const impactPerUnit = e.qty > 0 ? slip$ / e.qty : 0;
  const fillPrice = e.side === 'buy' ? e.price + impactPerUnit : e.price - impactPerUnit;
  return { fillPrice, commission: comm$, slippage: slip$ };
}

/** Sensible defaults for retail US equities; advisors should tune per broker. */
export const DEFAULT_RETAIL_US: { slippage: SlippageParams; commission: CommissionParams } = {
  slippage: { kind: 'flat_bps', bps: 2 },
  commission: { kind: 'flat_per_trade', flat: 0 }, // commission-free brokers
};

export const DEFAULT_INSTITUTIONAL_US: { slippage: SlippageParams; commission: CommissionParams } = {
  slippage: { kind: 'sqrt_size', k: 0.10, adv: 1_000_000 },
  commission: { kind: 'per_share', perShare: 0.0035, minTicket: 0.35, maxTicket: 1.0 },
};
