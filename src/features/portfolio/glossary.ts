/**
 * Glossary — plain-English explanations of every metric the app surfaces.
 *
 * Used by ExplainTip and inline tooltips. Keep entries short (one short
 * paragraph) and concrete; reference how the number is computed where it
 * isn't obvious. Keep the bias toward the reader who wants to learn.
 */

export interface GlossaryEntry {
  term: string;
  short: string;
  long?: string;
  /** "tip" links to a related entry. */
  related?: string[];
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ─── P&L / accounting ──────────────────────────────────
  unrealized_pnl: {
    term: 'Unrealized P&L',
    short: 'Paper gain/loss on positions you still hold. Becomes realized when you sell.',
    long:
      'For each open holding: (current price − cost basis) × units. Sums across all holdings. Goes up and down with the market every day; doesn’t affect taxes until the position is closed.',
  },
  realized_pnl: {
    term: 'Realized P&L',
    short: 'Locked-in gain/loss from completed sales. This is the number that flows to your tax return.',
    long:
      'When you sell, the cost basis of the consumed lots (under FIFO/LIFO/HIFO/Average) is subtracted from net proceeds (sale × qty − fees). Realized YTD is the calendar-year total.',
    related: ['cost_basis', 'fifo', 'wash_sale'],
  },
  cost_basis: {
    term: 'Cost basis',
    short: 'What you paid for shares — the baseline against which gain/loss is measured.',
    long:
      'For lot-tracked holdings, basis is per-lot: price + capitalized fees. The lot consumption method (FIFO/LIFO/HIFO/Average) decides which basis is matched to a sale.',
  },
  fifo: {
    term: 'FIFO / LIFO / HIFO / Average',
    short:
      'How sales pick which lots to consume. FIFO sells the oldest first (default IRS rule); LIFO the newest; HIFO the highest-cost (minimizes tax); Average treats all lots as one weighted-avg basis (mutual-fund-style).',
  },
  wash_sale: {
    term: 'Wash sale',
    short:
      'US rule: if you sell at a loss and buy a "substantially identical" security within ±30 days, the loss is disallowed and added to the new lot’s basis.',
    long:
      'The disallowed amount is preserved (carried forward into the replacement lot’s cost basis), so the loss isn’t lost — it’s deferred until you sell the replacement shares.',
  },

  // ─── Risk ──────────────────────────────────────────────
  var_95: {
    term: 'VaR (95%)',
    short:
      '5%-tail one-day loss. There is a 5% chance the portfolio loses at least this much on any given day, based on historical returns.',
    long:
      'Computed by sorting daily returns and taking the 5th percentile. Read it with CVaR — VaR tells you the threshold; CVaR tells you the average severity beyond it.',
    related: ['cvar_95', 'volatility'],
  },
  cvar_95: {
    term: 'CVaR (Expected Shortfall, 95%)',
    short: 'Average loss in the worst 5% of historical days. Captures tail severity that VaR alone hides.',
    related: ['var_95'],
  },
  volatility: {
    term: 'Volatility (annualized)',
    short:
      'Standard deviation of daily returns × √252. A 20% vol portfolio typically swings ±20% in a year.',
  },
  beta: {
    term: 'Beta',
    short:
      'Sensitivity to a benchmark. Beta = 1 moves with the benchmark; β=1.5 amplifies moves 50%; β=0 is uncorrelated.',
    long:
      'Computed as Cov(asset, benchmark) / Var(benchmark) on returns. Choice of benchmark matters — beta vs the S&P is meaningless for a Nordic-focused or all-bonds portfolio.',
  },
  correlation: {
    term: 'Correlation',
    short:
      'Pearson correlation of two return streams: 1 = move together, 0 = independent, −1 = move opposite. Useful for spotting "I thought I was diversified" clusters.',
  },
  hhi: {
    term: 'HHI (concentration)',
    short:
      'Herfindahl–Hirschman index: sum of squared weights. 1 = single position, ≈0 = perfectly diversified. The reciprocal (1/HHI) gives the "effective number of positions."',
    related: ['effective_n'],
  },
  effective_n: {
    term: 'Effective N',
    short:
      '1/HHI. Equivalent number of equally-weighted positions you’d need to match your current dispersion. <4 ≈ concentrated, 4–8 moderate, 8+ diversified.',
    related: ['hhi'],
  },
  max_drawdown: {
    term: 'Max drawdown',
    short: 'Largest peak-to-trough decline in portfolio value across history (positive number).',
  },

  // ─── Performance / GIPS ────────────────────────────────
  twr: {
    term: 'Time-weighted return (TWR)',
    short:
      'Geometric chaining of period returns; cash flow neutral. The GIPS standard for advisor performance because contributions/withdrawals don’t pollute the result.',
    related: ['mwr'],
  },
  mwr: {
    term: 'Money-weighted return (MWR / IRR)',
    short:
      'The single rate that makes the NPV of all cash flows zero. Reflects the investor’s actual experience including timing of contributions.',
    related: ['twr'],
  },
  sharpe: {
    term: 'Sharpe ratio',
    short:
      'Excess return ÷ volatility, annualized. Above 1 is good; above 2 is great; above 3 raises eyebrows. Sensitive to the chosen risk-free rate.',
  },
  sortino: {
    term: 'Sortino ratio',
    short: 'Like Sharpe but only counts downside volatility. Better for asymmetric strategies.',
  },
  calmar: {
    term: 'Calmar ratio',
    short: 'Annualized return ÷ max drawdown. Highlights how much pain you took to earn the return.',
  },

  // ─── Bonds ─────────────────────────────────────────────
  ytm: {
    term: 'YTM (yield to maturity)',
    short:
      'Internal rate of return if you buy at the current price and hold to maturity, reinvesting coupons at YTM. The discount rate that prices the bond at market.',
  },
  modified_duration: {
    term: 'Modified duration',
    short:
      'Approximate % price change for a 1% (100bp) yield move. ModDur of 7 ⇒ price falls ~7% if yields rise 1%. Use convexity for the curvature correction.',
    related: ['convexity', 'dv01'],
  },
  convexity: {
    term: 'Convexity',
    short:
      'Second-order yield sensitivity. Higher convexity is desirable: prices fall less when yields rise and gain more when yields fall.',
    related: ['modified_duration'],
  },
  dv01: {
    term: 'DV01',
    short: 'Dollar value of 1bp — the per-bond P&L impact of a one basis point yield change.',
    related: ['modified_duration'],
  },

  // ─── Options ───────────────────────────────────────────
  delta: {
    term: 'Delta',
    short:
      'Δ price per $1 move in underlier. Calls: 0→+1; puts: −1→0. Also approximates the probability of finishing in-the-money.',
  },
  gamma: {
    term: 'Gamma',
    short: 'Δ delta per $1 move. Highest at-the-money near expiry. The Greek that "moves the others."',
  },
  vega: {
    term: 'Vega',
    short: 'P&L impact of a 1-vol-point change in implied volatility. Long options have positive vega.',
  },
  theta: {
    term: 'Theta',
    short:
      'P&L per day from time decay. Long options bleed theta (negative); short options collect it.',
  },

  // ─── Execution ────────────────────────────────────────
  limit_order: {
    term: 'Limit order',
    short: 'Buy at or below / sell at or above a price. Won’t fill worse, may not fill at all.',
  },
  stop_order: {
    term: 'Stop order',
    short:
      'Becomes a market order when the stop price trades. Used for stop-losses or breakout entries; risk slippage in fast markets.',
  },
  oco: {
    term: 'OCO (one-cancels-other)',
    short:
      'A pair of orders linked so that filling one cancels the other. Common pattern: limit-take-profit + stop-loss.',
  },
  bracket: {
    term: 'Bracket order',
    short:
      'Parent entry order with two attached children: a limit take-profit and a stop loss. The children are an OCO pair that activates after the parent fills.',
  },
  tif: {
    term: 'Time in force (TIF)',
    short:
      'How long an order rests. DAY = end-of-session; GTC = until cancelled; IOC = fill any available now, kill the rest; FOK = all-or-none, immediately.',
  },
};

/** Returns the entry by id (snake-case key) or null. */
export function explain(id: string): GlossaryEntry | null {
  return GLOSSARY[id] ?? null;
}
