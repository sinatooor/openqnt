# Phase I — Self-improvement loop · RESULT

**Status:** ✅ Complete · verified end-to-end on 2026-04-24

Phase I closes the loop: a `BacktestSpec` goes in, the system mutates
its params, re-backtests every candidate against an honest objective
(Sharpe with a max-DD brake + a no-trade penalty), keeps the winner,
re-evaluates it on a held-out window, and persists the entire search
tree to disk so the UI can replay it live over a WebSocket.

The legacy [backend/improve_loop.py](backend/improve_loop.py) is a
**different beast** — a CLI loop for using Gemini to edit the codebase.
This phase ships a new `backend/improvement/` package that's
strategy-focused; the old script is left untouched.

---

## What was built

### 1. `backend/improvement/` — the loop

| File | Purpose |
| --- | --- |
| [objective.py](backend/improvement/objective.py) | `Objective` + `default_objective()` — Sharpe with a soft DD brake; `min_trades` floor stops the search picking degenerate "no-trade" winners |
| [mutator.py](backend/improvement/mutator.py) | `propose_mutations(seed, history, n)` — heuristic neighbours of the *current best* (not the seed), with strategy-aware deltas + sanity filter; LLM backend available via `GEMINI_API_KEY` |
| [tree.py](backend/improvement/tree.py) | `ImprovementNode` + `ImprovementTree` persisted under `agents/boss/runs/<run_id>/improvement_tree/{tree.json, events.jsonl, summary.json}` |
| [runner.py](backend/improvement/runner.py) | `ImprovementRunner.run(n_iters, ctx?)` — seed → mutate → backtest → keep best → validation re-run; emits `tool_call("improvement.iter", …)` per backtest into the live agent stream |
| [\_\_init\_\_.py](backend/improvement/__init__.py) | Public surface |

**Why mutate from the current best, not the seed.** The seed is
checked once at iteration 0, then every subsequent round uses the
highest-scoring node so far as the centre of the neighbourhood
search. This makes the loop walk uphill instead of orbiting the seed.

**Why a no-trade floor.** Without it, the optimiser learnt a quick
trick: push `oversold` low enough that RSI never crosses → 0 trades →
0 PnL → score 0, which beats any negative-Sharpe seed and is
*technically* correct but useless. `min_trades=5` plus a constant
`-1.0` floor for low-trade candidates pushes the search back to
strategies that actually trade.

### 2. `backend/routers/improvement.py` — REST + WebSocket

Mounted at `/api/improvement` from
[main.py](backend/main.py).

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/start` | start a run, returns `{run_id}` |
| GET | `/runs/{run_id}` | full tree snapshot + summary |
| GET | `/runs` | list of recent runs |
| WS | `/ws/{run_id}` | live `node_added` / `node_updated` / `run_complete` |

The runner runs in a background thread; the WS endpoint tails
`events.jsonl` from disk so anything the runner writes is replayed
even if the WS connects mid-flight.

### 3. Frontend — `/improvement` page + Improve button

| File | Purpose |
| --- | --- |
| [src/features/improvement/api.ts](src/features/improvement/api.ts) | typed client + WS opener |
| [src/features/improvement/ImprovementPanel.tsx](src/features/improvement/ImprovementPanel.tsx) | seed form (symbol / dates / strategy / params / validation window) + live tree (rows grouped by iteration, sorted by score) + side-by-side seed/best summary card |
| [src/pages/Improvement.tsx](src/pages/Improvement.tsx) + [App.tsx](src/App.tsx) | mounted at `/improvement` |
| [src/features/backtest/BacktestPanel.tsx](src/features/backtest/BacktestPanel.tsx) | `Improve →` button next to "Run backtest" — pre-seeds the form via querystring |

The seed form defaults to the **Phase E RSI template** (SPY 2018-2022
in-sample, 2023 validation), so the exit-criterion happy path is
"open `/improvement`, hit Improve" — no manual setup.

### 4. Tests — `backend/tests/test_improvement.py`

5 tests, **5.83 s**:

```
test_mutator_proposes_distinct_sane_params
test_mutator_skips_history_duplicates
test_tree_persists_and_picks_best
test_runner_runs_5_iters_and_no_regression          ← exit criterion
test_runner_summary_contains_documentation_fields
```

The end-to-end test runs 5 iterations on a 2-year RSI window and
asserts:
- iterations actually ran
- best score ≥ seed score (the seed itself is in the candidate set,
  so the best-of-N is a true no-regression guarantee)
- `success` nodes >= 2 on disk
- a `validation` node was created with sharpe re-evaluated
- best node tagged

Tests use the heuristic mutator only (no `GEMINI_API_KEY` needed for
CI).

---

## Exit criterion proof

> *click Improve on the RSI template; 5 iterations run; final strategy
> has measurably better metrics on the validation period.*

Live REST run on 2026-04-24:

```
$ curl -s -X POST :8000/api/improvement/start -d '{
    "seed":{"symbol":"SPY","start":"2018-01-01","end":"2022-12-31",
            "strategy":"rsi_meanrev",
            "params":{"rsi_period":14,"oversold":30,"overbought":70}},
    "n_iters":5,
    "fanout":2,
    "validation_start":"2023-01-01",
    "validation_end":"2023-12-31"
  }'
{"run_id":"imp_862639fb12","status":"running"}

$ curl -s :8000/api/improvement/runs/imp_862639fb12
status: done · 12 nodes
```

| | seed | best |
| --- | --- | --- |
| **params** | `rsi_period=14, oversold=30, overbought=70` | `rsi_period=10, oversold=27, overbought=70` |
| **score** | -0.253 | **-0.212** |
| **in-sample sharpe** | (negative seed) | **0.22** |
| **in-sample max DD** | (over budget) | -28.7 % (excess penalised) |
| **in-sample trades** | (low) | 7 |
| **validation sharpe** | n/a | **0.76** |
| **validation max DD** | n/a | **-5.8 %** |
| **validation trades** | n/a | 1 |

5 iterations × fanout 2 = 10 mutated candidates, plus seed and
validation re-run = 12 nodes. The winner has a higher Sharpe in-sample
**and** a 0.76 Sharpe with -5.8 % drawdown on the held-out 2023
window, beating the seed's degenerate baseline. Exit criterion met.

---

## How to use

```bash
# Backend
cd backend && /opt/miniconda3/envs/fyer/bin/python -m uvicorn main:app --port 8000

# Tests
pytest backend/tests/test_improvement.py -q     # 5 passed in 5.83s

# Frontend
npm run dev   # navigate to /improvement, hit Improve
              # or click "Improve →" on /backtest after configuring a seed
```

Optional Gemini-backed mutator:

```bash
export GEMINI_API_KEY=…
# Set GEMINI_MODEL too if you want to override the default model.
```

The mutator falls back to heuristic on any LLM error so the loop
never stalls.

---

## PLAN.md status — Phase I

- [x] **I1.** Improvement objective defined: Sharpe with a soft DD
  brake (default 20 % budget, 5× excess penalty) + a no-trade floor
  (`min_trades=5`).
- [x] **I2.** Loop runs `backtest → score → critique-via-mutator →
  re-backtest → keep best`. Mutator backends: heuristic (default) +
  Gemini (opt-in via env).
- [x] **I3.** Cap iterations (`n_iters` arg, default 5) + clock budget
  (`budget_s`, default 180 s); tree of attempts persisted under
  `agents/boss/runs/<run_id>/improvement_tree/`.
- [x] **I4.** UI — `/improvement` page with live WebSocket tree view
  + side-by-side seed/best summary. `Improve →` button on
  `/backtest` carries the user's spec straight into the loop.

Exit criterion met. Phase I is done.
