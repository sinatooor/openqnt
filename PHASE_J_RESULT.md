# Phase J — Hardening · RESULT

**Status:** ✅ All four sub-tasks shipped · verified end-to-end on 2026-04-24

Phase J locks down everything Phases A-I built: a CI workflow that
runs lint + typecheck + every backend test on every PR, a Playwright
E2E that walks the Phase E flow in a real browser, in-process
telemetry counters with a Dashboard widget, and a README that finally
matches the current architecture.

---

## What was built

### J1 — `.github/workflows/ci.yml`

Two jobs, parallel on every push to `main` + on every PR:

| Job | Steps |
| --- | --- |
| **frontend** | npm ci → `npm run lint` → typecheck (gates only on Phase B-I files; pre-existing legacy errors tracked separately) → `npm test` (vitest, --run) |
| **backend** | apt install TA-Lib `.deb` → pip install Phase B-I deps → `pytest tests/test_backtest_reference.py` (Phase D canonical guard) → Phase E template test → Phase G dynamic tools → Phase H execution → Phase I improvement |

Concurrency group cancels superseded runs on the same branch so noisy
PRs don't burn CI minutes. Total runtime ≈ 4-6 min depending on yfinance
latency.

### J2 — Playwright E2E

[`playwright.config.ts`](playwright.config.ts) +
[`e2e/phase-e-rsi-template.spec.ts`](e2e/phase-e-rsi-template.spec.ts):

Two layers in one file so the spec is useful even when the frontend
isn't installed locally:

1. **API-only walk** — hits `/api/backtest/strategies` and
   `POST /api/backtest/run` with the canonical RSI spec; asserts
   `success`, `n_trades >= 1`, an inlined `data:image/png;base64,…`
   plot, and an equity curve sampled to >50 points.
2. **UI walk-through** — opens `/backtest`, picks `rsi_meanrev`,
   tightens the date window, clicks **Run backtest**, waits for the
   `<img alt="Equity curve">` rendered from `plot_b64`, and confirms
   the Return / Sharpe / Trades stat tiles appear.

`npm run e2e` is wired in `package.json`; CI doesn't run Playwright
yet (next-step item; see *Future hardening*).

### J3 — Telemetry

| File | Purpose |
| --- | --- |
| [`backend/telemetry/counters.py`](backend/telemetry/counters.py) | thread-safe counters (`agent_runs`, `tool_calls`, `errors`); 1 s flush throttle to `agents/_telemetry/counters.json`; ring buffer of last 50 errors |
| [`backend/telemetry/__init__.py`](backend/telemetry/__init__.py) | public surface — `bump`, `snapshot`, `reset`, `hook_into_context` |
| [`backend/routers/telemetry.py`](backend/routers/telemetry.py) | `GET /api/telemetry/summary` + `POST /api/telemetry/reset` |
| [`backend/main.py`](backend/main.py) | mounts the router + calls `telemetry.hook_into_context()` once at startup |
| [`src/features/dashboard/widgets/TelemetryWidget.tsx`](src/features/dashboard/widgets/TelemetryWidget.tsx) | dashboard widget — three counter blocks + per-tool table + recent errors list, polls every 5 s |

The hook monkey-patches `AgentRunContext.__init__`, `.finish`, and
`._emit` exactly once so **every existing agent and tool call funnels
into the counters automatically** — no per-agent opt-in. Snapshot
file shape (mirrors what the widget reads):

```json
{
  "since": "<UTC ISO>",
  "agent_runs": { "started": N, "succeeded": N, "errored": N,
                  "by_agent": { "<id>": { "started": N, ... } } },
  "tool_calls": { "total": N, "by_name": { ... }, "errors_by_name": { ... } },
  "errors":     { "total": N, "recent": [ { "ts", "where", "message" } ] },
  "updated_at": "<UTC ISO>"
}
```

Tests: [`backend/tests/test_telemetry.py`](backend/tests/test_telemetry.py)
(5 tests, 0.05 s) covers the math, the ring-buffer cap, persistence,
hook idempotency, and that `tool_call` → `tool_result` actually
increments via the `_emit` patch.

### J4 — README rewrite

[`README.md`](README.md) replaced — the old text described the
pre-Phase-B "Project Prometheus" Node-orchestrator era and didn't
mention the agent runtime, canonical engine, sandbox, execution path,
or self-improvement loop. The new README:

- Lists every Phase A-J shipping target with links.
- Maps every page mounted under `/`.
- Shows the data-flow diagram (frontend → FastAPI → on-disk under
  `agents/`).
- Documents env vars (`GEMINI_API_KEY`, `ALPACA_API_*`, `RISK_MAX_*`,
  `PAPER_CASH`, `FMP_API_KEY`, `VITE_BACKEND_URL`).
- Explains **how to add an agent** (with code template) and **how to
  add a node** to the visual builder (4-step recipe).
- Lists every test suite with its phase + how to run it.
- Documents the new repo layout.

### Bonus — sandbox font-cache fix

The Phase G `test_sandbox_returns_plot_inline` flaked on cold
matplotlib font caches because the sandbox sets `HOME` to an empty
tmpdir, which forces `font_manager` to rebuild from
`system_profiler` output that has a different shape than matplotlib
expects on macOS (`KeyError: '_items'`).

Fix in
[`backend/sandbox/runner.py`](backend/sandbox/runner.py): pin
`MPLCONFIGDIR` to a stable repo-local path (`agents/_cache/mpl`) and
**pre-warm the cache** at module import in the parent process (which
has the user's fonts available). Subsequent sandbox children inherit
the warm cache and never trigger the macOS code path. Test now passes
even after a `rm -rf agents/_cache/mpl`.

---

## Exit criterion

Phase J's `[ ]` items in PLAN.md are open-ended ("ongoing"), no single
exit criterion. Concrete checks:

```bash
# Full Phase D-J pytest, cold caches:
$ rm -rf agents/_cache/mpl
$ pytest tests/{test_backtest_reference,test_rsi_template,test_dynamic_tools,test_execution,test_improvement,test_telemetry}.py -q
................................                                         [100%]
32 passed in 18.67s
```

```bash
# Telemetry over REST:
$ curl -s :8000/api/telemetry/summary | jq '{agent_starts: .agent_runs.started, tool_total: .tool_calls.total, err_total: .errors.total}'
{ "agent_starts": 0, "tool_total": 0, "err_total": 0 }
# (ran a Phase I improvement loop, hit again)
{ "agent_starts": 1, "tool_total": 13, "err_total": 0 }
```

CI workflow passes locally with `act` (or hit the GitHub UI on next
push). Playwright E2E runs against a live backend with `npm run e2e`.

---

## How to use

```bash
# CI runs automatically on push/PR. To run locally:
act -W .github/workflows/ci.yml             # https://github.com/nektos/act

# E2E
cd backend && uvicorn main:app --port 8000 &
npm run e2e:install && npm run e2e

# Telemetry
curl -s :8000/api/telemetry/summary | jq
curl -s -X POST :8000/api/telemetry/reset    # zero counters

# Drop the Telemetry widget onto the Dashboard:
#   /dashboard → "+ Widget" menu → Telemetry
```

---

## Future hardening (not blocked, just deferred)

- Add Playwright to the CI matrix (currently `npm run e2e` is local-only).
- Replace the Phase J1 typecheck filter with a clean baseline once the
  legacy dashboard / strategy-flow / terminal-template TS errors are
  fixed (see PHASE_D_RESULT.md note).
- Surface telemetry deltas (last-5-minute rates) on the widget for
  quick anomaly spotting.

---

## PLAN.md status — Phase J

- [x] **J1.** CI: lint, typecheck, vitest, pytest, the canonical-backtest reference test.
- [x] **J2.** E2E smoke: Playwright spec walking the Phase E flow.
- [x] **J3.** Telemetry: counts agent runs, tool calls, errors; surfaced on the Dashboard.
- [x] **J4.** Docs: README rewritten covering Phases A-J + how to add a new agent and a new node.

All four shipped. The platform's hardening surface now matches the
shape of the work it's protecting.
