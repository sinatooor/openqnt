/**
 * Multi-currency P&L attribution.
 *
 * Splits total return for a non-base-currency position into:
 *   • Local return — what the asset did in its own currency.
 *   • FX return — what the FX rate did against base currency.
 *   • Cross — interaction term (small, usually negligible).
 *
 * Total ≈ Local + FX + Cross (geometric chain), with Cross = Local × FX.
 */

export interface CurrencyAttribution {
  /** Total return in base currency. */
  totalReturn: number;
  /** Asset's return in its native currency. */
  localReturn: number;
  /** Foreign-exchange return: (fx_now / fx_then) - 1. */
  fxReturn: number;
  /** Interaction term: localReturn × fxReturn. */
  crossReturn: number;
  /** Same numbers as currency-converted dollar amounts. */
  amounts: {
    base: { startValue: number; endValue: number; pnl: number };
    local: { startValue: number; endValue: number; pnl: number };
    fxImpact: number; // base-currency PnL solely from FX move
  };
}

export interface PositionMultiCurrency {
  /** Quantity (units, shares). */
  qty: number;
  /** Entry price in local currency. */
  startPriceLocal: number;
  /** Current price in local currency. */
  endPriceLocal: number;
  /** FX rate: 1 unit of local currency in base currency at entry. */
  startFx: number;
  /** FX rate at current. */
  endFx: number;
}

export function attributeReturn(p: PositionMultiCurrency): CurrencyAttribution {
  const startLocal = p.qty * p.startPriceLocal;
  const endLocal = p.qty * p.endPriceLocal;
  const startBase = startLocal * p.startFx;
  const endBase = endLocal * p.endFx;
  const localReturn = p.startPriceLocal > 0 ? p.endPriceLocal / p.startPriceLocal - 1 : 0;
  const fxReturn = p.startFx > 0 ? p.endFx / p.startFx - 1 : 0;
  const crossReturn = localReturn * fxReturn;
  const totalReturn = (1 + localReturn) * (1 + fxReturn) - 1;

  // FX impact in base currency dollars: held qty * startPriceLocal * (endFx - startFx)
  const fxImpact = startLocal * (p.endFx - p.startFx);

  return {
    totalReturn,
    localReturn,
    fxReturn,
    crossReturn,
    amounts: {
      base: { startValue: startBase, endValue: endBase, pnl: endBase - startBase },
      local: { startValue: startLocal, endValue: endLocal, pnl: endLocal - startLocal },
      fxImpact,
    },
  };
}

/**
 * Aggregate multi-currency attribution across many positions, returning
 * total dollar attribution and a per-currency breakdown.
 */
export function portfolioAttribution(
  positions: { currency: string; pos: PositionMultiCurrency }[]
): {
  totalPnL: number;
  localPnL: number;
  fxPnL: number;
  crossPnL: number;
  byCurrency: { currency: string; localPnL: number; fxPnL: number; totalPnL: number }[];
} {
  const byCcy = new Map<string, { localPnL: number; fxPnL: number; totalPnL: number }>();
  let total = 0;
  let local = 0;
  let fx = 0;

  for (const { currency, pos } of positions) {
    const a = attributeReturn(pos);
    const totalForPos = a.amounts.base.pnl;
    const localForPos = a.amounts.local.pnl * pos.startFx; // express local-only in base $ at entry FX
    const fxForPos = a.amounts.fxImpact;

    total += totalForPos;
    local += localForPos;
    fx += fxForPos;

    const existing = byCcy.get(currency) ?? { localPnL: 0, fxPnL: 0, totalPnL: 0 };
    existing.localPnL += localForPos;
    existing.fxPnL += fxForPos;
    existing.totalPnL += totalForPos;
    byCcy.set(currency, existing);
  }

  return {
    totalPnL: total,
    localPnL: local,
    fxPnL: fx,
    crossPnL: total - local - fx,
    byCurrency: [...byCcy.entries()].map(([currency, v]) => ({ currency, ...v })),
  };
}
