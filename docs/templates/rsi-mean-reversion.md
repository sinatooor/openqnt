# RSI(14) Mean Reversion · SPY

> Phase E reference template. Lives in
> [strategyTemplates.ts](../../src/features/strategy-flow/templates/strategyTemplates.ts)
> as `id: 'rsi-mean-reversion-spy'`. Featured in the Templates dialog
> under the **Mean Reversion** category.

## What it does

Classic counter-trend strategy on SPY (S&P 500 ETF) at the daily timeframe:

| | |
| --- | --- |
| **Entry** | Buy 10 % when RSI(14) drops below 30 (oversold) |
| **Exit** | Close when RSI(14) crosses above 70 (overbought) |
| **Risk** | Stop-loss −3 %, take-profit +6 % attached to the entry |
| **Universe** | SPY, daily bars |
| **Default backtest window** | 2018-01-01 → 2023-12-31 |
| **Initial cash / commission** | $10 000 · 0.2 % |

The exit rules are intentionally simple — the point of the template is
to be **understandable end-to-end**, not to print money. It's the
"hello world" of a real graph-defined strategy that runs on real data.

## Why this template

PLAN.md Phase E E1 picked RSI mean-reversion because it is:

- **Concrete** — RSI is a single, scalar indicator with a tiny config.
- **Testable** — small enough to verify by eye against a chart.
- **Classic** — every quant book ships with this exact strategy, so
  results are easy to sanity-check.
- **Non-trivial enough to exercise the full graph** — needs an
  indicator, a numeric constant, a comparison, an order action, two
  risk-action legs (stop-loss + take-profit), and an exit condition. If
  this template runs end-to-end, every basic node category works.

## Graph layout

Nine nodes, eight edges. All node types come straight from
[node_catalog_cache.json](../../backend/strategy_flow/node_catalog_cache.json).

```
       overbought-70 (math 70)
              │
              ▼
RSI(14) ──► RSI > 70 (compare) ──► closePosition
   │
   ├──► RSI < 30 (compare) ──► Buy 10% (order) ──┬──► Stop Loss -3%
   │                                              └──► Take Profit +6%
   ▲
oversold-30 (math 30)
```

| Node id | Type | Notes |
| --- | --- | --- |
| `rsi` | indicator | `indicatorType: rsi`, `params.period: 14` |
| `oversold-30`, `overbought-70` | math | `mathType: number`, `value: 30` / `70` |
| `cond-oversold` | condition | `compare`, `operator: '<'` |
| `cond-overbought` | condition | `compare`, `operator: '>'` |
| `buy` | action | `order`, `direction: long`, `size: 10`, `sizeType: percent` |
| `stop-loss` | action | `stopLoss`, `stopDistance: percent`, `stopPercent: 3` |
| `take-profit` | action | `takeProfit`, `profitDistance: percent`, `profitPercent: 6` |
| `exit` | action | `closePosition` |

## How "click Backtest" actually runs

The template ships a `backtestSpec` field — a hint that maps the graph to
a built-in canonical strategy:

```ts
backtestSpec: {
  strategy: 'rsi_meanrev',
  params: { rsi_period: 14, oversold: 30, overbought: 70 },
  symbol: 'SPY',
  start: '2018-01-01',
  end: '2023-12-31',
  interval: '1d',
  initial_cash: 10_000,
  commission: 0.002,
}
```

When `TemplatesDialog` loads the template it calls
`store.setTemplateBacktestSpec(template.backtestSpec)`. When the user
then clicks **Backtest**, `BacktestModal` sees the hint and posts to
`POST /api/backtest/run` (the **canonical** engine from Phase D — the
same one `run_backtest_tool()` uses from inside an agent). Result: the
metrics shown in the modal are byte-for-byte identical to what the
agent's `run_backtest_tool` would compute for the same spec.

If a user edits the canvas heavily and `clearCanvas()` fires, the hint
is dropped and the modal falls back to the legacy code-gen path. The
canonical path is opt-in by the template author, not auto-detected.

## Verifying it works

Two tests live in [test_rsi_template.py](../../backend/tests/test_rsi_template.py).
They parse the template **out of the TS source** so they can never
silently drift from what the UI ships:

1. `test_template_validates` — runs `strategy_flow.validator.validate_flow()`
   on the template's nodes/edges. Same check the modal runs before
   submitting. Must pass with `is_valid=True`.
2. `test_template_backtest_runs_canonical` — feeds the template's
   `backtestSpec` to `backtest.run_backtest()`. Must return success,
   ≥ 1 trade, a coherent return / max-dd, and a persisted PNG.

Run:

```bash
cd backend && pytest tests/test_rsi_template.py -q
# 2 passed
```

## Reference numbers

Run on 2026-04-22 with the spec above:

| metric | value |
| --- | --- |
| return | **+47.70 %** |
| n_trades | 7 |
| sharpe | 0.37 |
| max drawdown | −29.26 % |
| buy & hold (SPY) | 76.85 % |
| plot | `agents/_backtests/<run_id>/equity.png` |

Mean reversion underperforms buy-and-hold here — that's the right
answer. SPY in 2018-2023 was a near-monotone uptrend; counter-trend
strategies sit out most of the move. The template is for *teaching the
mechanics*, not a recommendation to deploy capital.

## End-to-end exit-criteria check

PLAN.md Phase E exit criteria:

> *new user opens Templates, clicks RSI template, hits Backtest, sees
> real metrics + equity curve. No errors in console.*

Manual flow (with backend on `localhost:8000`):

1. `npm run dev` and navigate to `/` (the Strategy Flow canvas).
2. Open the Templates dialog from the toolbar.
3. Click **Load** on **"RSI(14) Mean Reversion · SPY"** (top of the
   Mean-Reversion category, starred as featured).
4. The canvas populates with the 9-node graph above.
5. Click **Backtest** in the toolbar → modal opens → click **Run**.
6. Toast: *"Running canonical backtest…"* → *"Backtest completed:
   47.7 % return"*.
7. Results tab renders metrics + the embedded equity-curve PNG (returned
   inline as `plot_b64`, no extra round-trip).

Programmatic equivalent: the pytest above.

## Future work

- Make the validator stop warning about `size <= 0` on `stopLoss` /
  `takeProfit` / `closePosition` actions — those legitimately have no
  size field. Pre-existing Phase D issue, not a Phase E regression.
- Build a real graph-compiler so non-template strategies can also route
  through the canonical engine (currently only template-shipped specs
  do; arbitrary canvases fall back to the legacy code-gen path).
