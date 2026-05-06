/**
 * Fixed-income math — bond pricing, YTM, modified duration, convexity, DV01.
 *
 * All functions accept an annualized coupon rate (e.g. 0.05 for 5%) and a
 * payment frequency (typically 2 for semi-annual US treasuries). Time-to-
 * maturity is in years. YTM solver uses bisection: stable but ~1ms per call.
 */

export interface BondSpec {
  /** Face / par value at maturity. */
  face: number;
  /** Annual coupon rate as a decimal (5% = 0.05). 0 for zero-coupon. */
  couponRate: number;
  /** Coupon payments per year (2 = semi-annual). */
  freq: number;
  /** Years to maturity. */
  ttm: number;
}

/** Present value of a bond's cash flows given a yield (annual decimal). */
export function priceFromYield(bond: BondSpec, yieldAnnual: number): number {
  const periods = Math.max(1, Math.round(bond.ttm * bond.freq));
  const couponPayment = (bond.face * bond.couponRate) / bond.freq;
  const r = yieldAnnual / bond.freq;
  let pv = 0;
  for (let i = 1; i <= periods; i++) {
    pv += couponPayment / Math.pow(1 + r, i);
  }
  pv += bond.face / Math.pow(1 + r, periods);
  return pv;
}

/**
 * Yield-to-maturity from a clean price. Returns NaN if no solution can be
 * found in the [-0.5, 1.0] yield range (covers extreme but valid markets).
 */
export function yieldToMaturity(bond: BondSpec, price: number, tol = 1e-7, maxIter = 100): number {
  let lo = -0.5;
  let hi = 1.0;
  let pLo = priceFromYield(bond, lo) - price;
  let pHi = priceFromYield(bond, hi) - price;
  if (pLo * pHi > 0) return NaN;
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const pMid = priceFromYield(bond, mid) - price;
    if (Math.abs(pMid) < tol) return mid;
    if (pMid * pLo < 0) {
      hi = mid;
      pHi = pMid;
    } else {
      lo = mid;
      pLo = pMid;
    }
  }
  return (lo + hi) / 2;
}

/** Macaulay duration: weighted-average time to cash flows. */
export function macaulayDuration(bond: BondSpec, yieldAnnual: number): number {
  const periods = Math.max(1, Math.round(bond.ttm * bond.freq));
  const couponPayment = (bond.face * bond.couponRate) / bond.freq;
  const r = yieldAnnual / bond.freq;
  let weighted = 0;
  let pv = 0;
  for (let i = 1; i <= periods; i++) {
    const cf = i === periods ? couponPayment + bond.face : couponPayment;
    const dpv = cf / Math.pow(1 + r, i);
    pv += dpv;
    weighted += (i / bond.freq) * dpv;
  }
  return pv > 0 ? weighted / pv : 0;
}

/** Modified duration = Macaulay / (1 + y/freq). Sensitivity to yield change. */
export function modifiedDuration(bond: BondSpec, yieldAnnual: number): number {
  const mac = macaulayDuration(bond, yieldAnnual);
  return mac / (1 + yieldAnnual / bond.freq);
}

/** DV01 = price change for a 1bp yield move (positive number for long bond). */
export function dv01(bond: BondSpec, yieldAnnual: number): number {
  const p0 = priceFromYield(bond, yieldAnnual);
  const p1 = priceFromYield(bond, yieldAnnual + 0.0001);
  return p0 - p1;
}

/** Convexity — second-order yield sensitivity. Higher convexity = more curved. */
export function convexity(bond: BondSpec, yieldAnnual: number): number {
  const periods = Math.max(1, Math.round(bond.ttm * bond.freq));
  const couponPayment = (bond.face * bond.couponRate) / bond.freq;
  const r = yieldAnnual / bond.freq;
  let conv = 0;
  let pv = 0;
  for (let i = 1; i <= periods; i++) {
    const cf = i === periods ? couponPayment + bond.face : couponPayment;
    const dpv = cf / Math.pow(1 + r, i);
    pv += dpv;
    conv += (i * (i + 1) * dpv) / Math.pow(1 + r, 2);
  }
  return pv > 0 ? conv / pv / Math.pow(bond.freq, 2) : 0;
}

/**
 * Approximate price impact for a yield shock (in absolute decimal, e.g. +0.01 for +100bp):
 *   ΔP/P ≈ -ModDur · Δy + ½ · Convexity · (Δy)²
 */
export function priceImpact(bond: BondSpec, yieldAnnual: number, deltaYield: number): number {
  const md = modifiedDuration(bond, yieldAnnual);
  const cx = convexity(bond, yieldAnnual);
  return -md * deltaYield + 0.5 * cx * deltaYield * deltaYield;
}

/** Convenience: full bond analytics in one call. */
export function bondAnalytics(bond: BondSpec, marketPrice: number) {
  const ytm = yieldToMaturity(bond, marketPrice);
  return {
    ytm,
    macaulayDuration: macaulayDuration(bond, ytm),
    modifiedDuration: modifiedDuration(bond, ytm),
    dv01: dv01(bond, ytm),
    convexity: convexity(bond, ytm),
    cleanPrice: marketPrice,
    accrued: 0, // Caller must supply settlement / last-coupon date for true accrued.
  };
}
