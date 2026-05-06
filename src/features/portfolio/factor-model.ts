/**
 * Factor-model regression. OLS multiple regression of strategy/portfolio
 * returns onto a factor matrix (typically Fama-French 3 or 5 factors).
 *
 * Computes betas, alpha, t-stats, and R². No external libraries — pure
 * normal-equation solve via Gauss-Jordan elimination, fine for ≤ 10 factors.
 *
 * Sign convention: returns are excess-of-risk-free; alpha is annualized.
 */

const TRADING_DAYS = 252;

export interface FactorRegressionInput {
  /** Daily portfolio excess returns. */
  y: number[];
  /** Object whose keys are factor names ("MKT", "SMB", "HML", "RMW", "CMA", "MOM"...)
   * and values are arrays of the same length as y. */
  factors: Record<string, number[]>;
}

export interface FactorRegressionResult {
  alpha: number;
  alphaAnnualized: number;
  alphaTStat: number;
  betas: { factor: string; beta: number; tStat: number }[];
  rSquared: number;
  /** Standard error of the regression (residual stddev). */
  residualStdDev: number;
  observations: number;
}

/** Solve A x = b in-place via Gauss-Jordan elimination with partial pivot. */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m: number[][] = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    // partial pivot
    let pivot = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(m[r][i]) > Math.abs(m[pivot][i])) pivot = r;
    }
    if (pivot !== i) [m[i], m[pivot]] = [m[pivot], m[i]];
    const piv = m[i][i];
    if (Math.abs(piv) < 1e-14) return null;
    for (let j = i; j <= n; j++) m[i][j] /= piv;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const factor = m[r][i];
      for (let j = i; j <= n; j++) m[r][j] -= factor * m[i][j];
    }
  }
  return m.map((row) => row[n]);
}

export function regressFactors(input: FactorRegressionInput): FactorRegressionResult | null {
  const { y, factors } = input;
  const factorNames = Object.keys(factors);
  if (y.length < factorNames.length + 2) return null;

  const n = y.length;
  const k = factorNames.length;

  // Design matrix X: column 0 is the intercept, rest are factors
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = [1];
    for (const f of factorNames) row.push(factors[f][i] ?? 0);
    X.push(row);
  }

  // Build normal equations: (X' X) β = X' y
  const xtx: number[][] = Array.from({ length: k + 1 }, () => Array(k + 1).fill(0));
  const xty: number[] = Array(k + 1).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a <= k; a++) {
      xty[a] += X[i][a] * y[i];
      for (let b = 0; b <= k; b++) {
        xtx[a][b] += X[i][a] * X[i][b];
      }
    }
  }
  const beta = solveLinearSystem(xtx, xty);
  if (!beta) return null;

  // Compute residuals + standard errors
  const residuals = y.map((yi, i) => {
    let pred = 0;
    for (let a = 0; a <= k; a++) pred += beta[a] * X[i][a];
    return yi - pred;
  });
  const sumSqRes = residuals.reduce((s, r) => s + r * r, 0);
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  const sumSqTot = y.reduce((s, v) => s + (v - meanY) * (v - meanY), 0);
  const rSquared = sumSqTot > 0 ? 1 - sumSqRes / sumSqTot : 0;
  const dof = Math.max(1, n - k - 1);
  const sigma2 = sumSqRes / dof;
  const residualSd = Math.sqrt(sigma2);

  // Diagonal of (X'X)^-1 for std errors
  const inv = invertMatrix(xtx);
  const seBetas = inv ? inv.map((row, i) => Math.sqrt(Math.max(0, sigma2 * row[i]))) : new Array(k + 1).fill(NaN);

  return {
    alpha: beta[0],
    alphaAnnualized: beta[0] * TRADING_DAYS,
    alphaTStat: seBetas[0] > 0 ? beta[0] / seBetas[0] : NaN,
    betas: factorNames.map((f, i) => ({
      factor: f,
      beta: beta[i + 1],
      tStat: seBetas[i + 1] > 0 ? beta[i + 1] / seBetas[i + 1] : NaN,
    })),
    rSquared,
    residualStdDev: residualSd,
    observations: n,
  };
}

function invertMatrix(A: number[][]): number[][] | null {
  const n = A.length;
  const I: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
  const m: number[][] = A.map((row, i) => [...row, ...I[i]]);
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(m[r][i]) > Math.abs(m[pivot][i])) pivot = r;
    }
    if (pivot !== i) [m[i], m[pivot]] = [m[pivot], m[i]];
    const piv = m[i][i];
    if (Math.abs(piv) < 1e-14) return null;
    for (let j = 0; j < 2 * n; j++) m[i][j] /= piv;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const factor = m[r][i];
      for (let j = 0; j < 2 * n; j++) m[r][j] -= factor * m[i][j];
    }
  }
  return m.map((row) => row.slice(n));
}
