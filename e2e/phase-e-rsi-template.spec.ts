/**
 * Phase J2 — E2E that walks the Phase E exit-criterion flow.
 *
 * Mostly tests the seam: the API surfaces the RSI template, the
 * canonical backtest engine returns real metrics + an inlined PNG, and
 * (when the frontend dev server is up) the /backtest page renders the
 * result inline.
 *
 * Two layers, both independently useful:
 *   1. API-only — no browser. Exits cleanly when the backend is up but
 *      the frontend isn't installed/built. Covers the canonical-engine
 *      contract end-to-end.
 *   2. UI walk-through — opens the React app, navigates to /backtest,
 *      runs the same RSI spec, asserts the metrics + chart appear.
 *
 * Run:
 *   pnpm exec playwright test
 *
 * Required services:
 *   - Backend at http://localhost:8000 (uvicorn main:app --port 8000)
 *   - Frontend at http://localhost:5173 (started by playwright.config.ts)
 */
import { test, expect, request } from '@playwright/test';

const BACKEND_URL =
  process.env.BACKEND_URL ?? 'http://localhost:8000';

const RSI_SPEC = {
  symbol: 'SPY',
  start: '2018-01-01',
  end: '2023-12-31',
  interval: '1d',
  initial_cash: 10_000,
  commission: 0.002,
  strategy: 'rsi_meanrev',
  params: { rsi_period: 14, oversold: 30, overbought: 70 },
};

// ── 1. API-only walk ──────────────────────────────────────────

test.describe('Phase E · canonical engine (API-only)', () => {
  test('strategies endpoint exposes rsi_meanrev', async () => {
    const ctx = await request.newContext({ baseURL: BACKEND_URL });
    const r = await ctx.get('/api/backtest/strategies');
    expect(r.status()).toBe(200);
    const body = await r.json();
    const names: string[] = (body.strategies ?? []).map(
      (s: { name: string }) => s.name,
    );
    expect(names).toContain('rsi_meanrev');
  });

  test('POST /api/backtest/run on RSI spec returns metrics + plot_b64', async () => {
    const ctx = await request.newContext({ baseURL: BACKEND_URL });
    const r = await ctx.post('/api/backtest/run', { data: RSI_SPEC });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.metrics).toMatchObject({
      n_trades: expect.any(Number),
      return_pct: expect.any(Number),
      buy_and_hold_pct: expect.any(Number),
      max_drawdown_pct: expect.any(Number),
    });
    expect(body.metrics.n_trades).toBeGreaterThanOrEqual(1);
    // Inline equity-curve PNG, rendered server-side.
    expect(body.plot_b64).toMatch(/^data:image\/png;base64,/);
    expect(body.plot_b64.length).toBeGreaterThan(2_000);
    // Equity curve sampled to the canonical shape.
    expect(Array.isArray(body.equity_curve)).toBe(true);
    expect(body.equity_curve.length).toBeGreaterThan(50);
  });
});

// ── 2. UI walk-through ────────────────────────────────────────

test.describe('Phase E · UI walk-through (/backtest page)', () => {
  test('open /backtest, run RSI spec, see metrics + equity image', async ({ page }) => {
    await page.goto('/backtest');

    // Form lives in the BacktestPanel — pick the RSI strategy.
    // The strategy <select> is identifiable by an option containing
    // "rsi_meanrev".
    const strategySelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'rsi_meanrev' }) })
      .first();
    await expect(strategySelect).toBeVisible({ timeout: 15_000 });
    await strategySelect.selectOption('rsi_meanrev');

    // Tighten the window for a faster run.
    await page.fill('input[type="date"]:nth-of-type(1)', '2020-01-01');
    await page.fill('input[type="date"]:nth-of-type(2)', '2021-12-31');

    // Press the "Run backtest" button.
    const runButton = page.getByRole('button', { name: /Run backtest/i });
    await runButton.click();

    // Wait for the equity-curve image rendered from `plot_b64`.
    const equityImg = page.locator('img[alt="Equity curve"]');
    await expect(equityImg).toBeVisible({ timeout: 60_000 });
    const src = await equityImg.getAttribute('src');
    expect(src).toMatch(/^data:image\/png;base64,/);

    // Stat cards labelled "Return" + "Sharpe" + "Trades" must appear.
    await expect(page.getByText(/^Return$/i).first()).toBeVisible();
    await expect(page.getByText(/^Sharpe$/i).first()).toBeVisible();
    await expect(page.getByText(/^Trades$/i).first()).toBeVisible();
  });
});
