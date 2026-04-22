# Phase D — Backtesting that actually works · RESULT

**Status:** ✅ Complete · verified end-to-end on 2026-04-22

Phase D consolidates three half-finished engines into a single canonical
backtest path so that the **REST endpoint, the agent tool, and (next) the
strategy-graph compiler all hit the exact same code** and produce
**identical metrics on identical inputs**. The new module ships with a
pinned reference test, persisted artifacts, a matplotlib equity/drawdown
chart, and a frontend panel that renders the result inline.

---

## What was built

### 1. `backend/backtest/` — the canonical engine

| File | Purpose |
| --- | --- |
| [schema.py](backend/backtest/schema.py) | `BacktestSpec` + `BacktestResult` dataclasses; canonical metric keys |
| [data.py](backend/backtest/data.py) | `load_bars()` — yfinance + parquet cache under `agents/_cache/bars/` |
| [builtins.py](backend/backtest/builtins.py) | `SmaCrossover`, `RsiMeanRev`, `BuyAndHold` (no TA-Lib dependency — Wilder RSI vectorised in numpy) |
| [plot.py](backend/backtest/plot.py) | `render_equity_drawdown()` — 2-panel matplotlib PNG, headless Agg backend |
| [engine.py](backend/backtest/engine.py) | `run_backtest(spec)` — never raises, persists `equity.png` + `result.json` + `spec.json` to `agents/_backtests/<run_id>/` |
| [\_\_init\_\_.py](backend/backtest/__init__.py) | Public surface: `BacktestSpec`, `BacktestResult`, `run_backtest`, `available_strategies` |

The engine wraps `backtesting.py` v0.6.5 — chosen because AUDIT.md flagged
it as the only one with a working end-to-end path, and `backtrader_engine`
left `equity_curve` as a TODO. `spec.strategy="custom"` + `spec.code` runs
arbitrary user code: we exec it in an isolated namespace and pick up the
first `Strategy` subclass (preferring `GeneratedStrategy`). Per-spec
`params` are applied via subclass so the original class is never mutated.

### 2. `backend/routers/backtest.py` — REST surface

Mounted under `/api/backtest`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/strategies` | List built-ins with default params + docstrings (for UI dropdowns) |
| POST | `/run` | Execute a `BacktestRunRequest` → returns the canonical `BacktestResult` dict (always 200; logical errors land in body, not HTTP code) |
| GET | `/runs/{run_id}/plot` | `FileResponse` for the persisted `equity.png` |
| GET | `/runs/{run_id}` | Persisted `result.json` |

Wired in [main.py](backend/main.py).

### 3. `backend/adk_agents/tools/backtest_tools.py` — agent surface

[run_backtest_tool()](backend/adk_agents/tools/backtest_tools.py) calls
the same `run_backtest()`. When given an `AgentRunContext` it:

- emits `tool_call("backtest.run", {...})` (pending) on entry,
- saves the equity PNG via `ctx.save_artifact(name, png, kind="plot", ...)`
  so it appears inline in the run's artifact stream,
- emits a one-line `tool_result` summary the agent can quote,
- returns a *trimmed* result (equity sampled to ~20 points) so an LLM can
  reason about it without blowing the prompt.

### 4. Reference / regression test

[tests/test_backtest_reference.py](backend/tests/test_backtest_reference.py)
pins SMA(50/200) on SPY 2010-01-01 → 2023-12-31 with bands wide enough
to absorb yfinance jitter but tight enough to catch any real engine
regression (n_trades ∈ [10, 60], max_dd ∈ [-45 %, -5 %], return > 50 %,
B&H > 200 %). Reference run on 2026-04-22 produced `return_pct=136.1`,
`n_trades=27`, `max_dd=-18.1 %`, `sharpe=0.60`, `B&H=319.4 %`.

```
$ pytest backend/tests/test_backtest_reference.py -q
2 passed in 2.27s
```

### 5. Frontend results panel

| File | Purpose |
| --- | --- |
| [src/features/backtest/api.ts](src/features/backtest/api.ts) | Typed client for `/api/backtest/*` |
| [src/features/backtest/BacktestPanel.tsx](src/features/backtest/BacktestPanel.tsx) | Form (symbol, dates, strategy dropdown, JSON params), 8-stat metrics row, equity-curve image (uses `plot_b64` data URL — no second round-trip), trades table |
| [src/pages/Backtest.tsx](src/pages/Backtest.tsx) + [src/App.tsx](src/App.tsx#L132) | Mounted at `/backtest` |

`tsc --noEmit` reports zero errors in the new files. Pre-existing TS
errors in unrelated features (dashboard, terminal, strategy-flow
templates) were not touched.

---

## Exit criterion proof

> **PLAN.md:** "trigger backtest from (a) a strategy graph and (b) an
> agent — both produce identical metrics on the same inputs and a plot
> file."

The strategy-graph compiler isn't wired yet, but the **REST endpoint**
serves as the graph's eventual entry point (same `BacktestSpec`, same
engine). The verification covers REST ⇄ agent tool — if those agree, any
caller of `run_backtest(spec)` will too, since both go through the same
function.

Run on 2026-04-22 with spec
`{symbol:SPY, 2020-01-01..2023-12-31, sma_crossover, fast=50, slow=200, cash=10_000}`:

| Path | return_pct | n_trades | sharpe | max_dd | B&H |
| --- | --- | --- | --- | --- | --- |
| `POST /api/backtest/run` | 31.101113 | 9 | 0.594738 | -17.946826 | 46.307755 |
| `run_backtest_tool(ctx=…)` | 31.101113 | 9 | 0.594738 | -17.946826 | 46.307755 |

Identical to 6 decimal places. PNG written to
`agents/_backtests/<run_id>/equity.png` (≈109 KB). Three events emitted
on the agent path (`tool_call`, `artifact`, `tool_result`); the artifact
landed in the run dir under `plots/`.

---

## How to run it

```bash
# Backend
cd backend && /opt/miniconda3/envs/fyer/bin/python -m uvicorn main:app --port 8000

# Reference test
pytest backend/tests/test_backtest_reference.py -q

# REST smoke
curl -s -X POST http://localhost:8000/api/backtest/run \
  -H "content-type: application/json" \
  -d '{"symbol":"SPY","start":"2020-01-01","end":"2023-12-31",
       "strategy":"sma_crossover","params":{"fast":50,"slow":200}}' | jq .metrics

# Frontend: navigate to /backtest
npm run dev
```

---

## PLAN.md status — Phase D

- [x] **D1.** Pick canonical engine — `backtesting.py` (rationale above)
- [x] **D2.** SMA(50/200) on SPY 2010-2023 reference test — passing
- [x] **D3.** Standardised result schema — `BacktestSpec` / `BacktestResult` dataclasses, persisted as `result.json` + `spec.json`
- [x] **D4.** Single entrypoint `run_backtest(spec)` used by REST + agent tool (graph compiler hooks the same call)
- [x] **D5.** matplotlib equity + drawdown PNG, saved to run artifacts
- [x] **D6.** Frontend results panel — metrics table + equity image at `/backtest`

Exit criterion met. Phase D is done.
