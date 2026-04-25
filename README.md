# openqwnt

A hierarchical multi-agent quant research & execution platform — a
visual strategy builder, a canonical backtest engine, agents that can
write their own tools, a paper/live execution path with a kill
switch, and a self-improvement loop that mutates strategy params and
keeps what wins.

![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB)
![Backend](https://img.shields.io/badge/backend-FastAPI%20%2B%20Python%203.12-3776AB)
![Agents](https://img.shields.io/badge/agents-Google%20ADK%20%2B%20Gemini-4285F4)
![Backtest](https://img.shields.io/badge/backtest-backtesting.py-purple)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## What this is

The platform sequenced through Phases A–J (see [PLAN.md](PLAN.md))
and each phase has a `PHASE_<X>_RESULT.md` that documents what
shipped + the exit criterion. The short version, in dependency order:

| Phase | Theme | Surface |
| --- | --- | --- |
| **A** | Audit & gap analysis | [AUDIT.md](AUDIT.md) |
| **B** | Agent runtime — events, artifacts, WebSocket | [`backend/agent_runtime/`](backend/agent_runtime/) · `/api/agent/*` |
| **C** | Boss orchestration | [`backend/routers/boss.py`](backend/routers/boss.py) · `/boss` |
| **D** | Canonical backtest engine | [`backend/backtest/`](backend/backtest/) · `/api/backtest/*` · `/backtest` |
| **E** | RSI mean-reversion strategy template | [`src/features/strategy-flow/templates/`](src/features/strategy-flow/templates/strategyTemplates.ts) |
| **F** | Bloomberg-style terminal (real data) | [`backend/routers/terminal_data.py`](backend/routers/terminal_data.py) · `/terminal/*` · ⌘K palette |
| **G** | Sandbox + dynamic tool creation | [`backend/sandbox/`](backend/sandbox/) · [`backend/dynamic_tools/`](backend/dynamic_tools/) · `/tools` |
| **H** | Paper / live execution path | [`backend/execution/`](backend/execution/) · `/api/execution/*` · `/execution` |
| **I** | Self-improvement loop | [`backend/improvement/`](backend/improvement/) · `/api/improvement/*` · `/improvement` |
| **J** | Hardening — CI, E2E, telemetry, docs | `.github/workflows/ci.yml` · `e2e/` · `/api/telemetry/*` · this file |

Pages mounted under `/`:

```
/                  Strategy Flow canvas (visual builder)
/backtest          BacktestPanel (Phase D engine)
/improvement       Self-improvement loop (Phase I)
/tools             Sandbox + dynamic tool registry (Phase G)
/execution         Live paper/Alpaca execution (Phase H)
/boss              Boss-run tree
/terminal/{des,gip,hds,rmap,splc,bmap}   Bloomberg-style screens (Phase F)
/dashboard         Widget canvas (incl. Telemetry + Agent Activity)
```

---

## Architecture

```
                   ┌─────────────────────────┐
                   │  React + Vite frontend  │
                   │  /backtest, /execution, │
                   │  /improvement, /tools,  │
                   │  /terminal, /boss, ...  │
                   └────────────┬────────────┘
                                │ REST + WebSocket
                                ▼
        ┌───────────────────────────────────────────────┐
        │           FastAPI backend (uvicorn)           │
        │                                               │
        │  routers/  ── /api/{backtest, execution,      │
        │                     improvement, tools,       │
        │                     terminal_data, agent_*,   │
        │                     boss, telemetry, ...}     │
        │                                               │
        │  agent_runtime/   AgentRunContext + EventBus  │
        │  backtest/        canonical engine            │
        │  execution/       PaperBroker, RiskGate, ...  │
        │  improvement/     Objective / Mutator / Tree  │
        │  sandbox/         subprocess + setrlimit      │
        │  dynamic_tools/   agent-authored tools        │
        │  telemetry/       counters + flush            │
        │  adk_agents/      Google ADK agents + tools   │
        └───────────────────────┬───────────────────────┘
                                │
                                ▼
              On-disk under  agents/
                ├── boss/runs/<run_id>/        boss + improvement trees
                ├── _backtests/<run_id>/       canonical engine artefacts
                ├── _execution/<session>/      order journal + panic.lock
                ├── _telemetry/counters.json   J3 telemetry snapshot
                ├── tools/dynamic/             agent-authored Python tools
                └── _cache/bars/               yfinance parquet cache
```

The Node.js orchestrator and TypeScript broker clients (under
`orchestrator/`) predate Phase B; they're left in place but the agent
runtime, backtest engine, sandbox, execution, and self-improvement
loop are all Python and don't depend on them.

### Data flow — a typical user gesture

```
user clicks "Run backtest" on /backtest
    → fetch POST /api/backtest/run
        → backend/routers/backtest.py
        → backend/backtest/engine.py:run_backtest(spec)
            → backtesting.py executes the strategy on the bars
            → backend/backtest/plot.py renders equity+drawdown PNG
            → result.json + equity.png persisted under
              agents/_backtests/<run_id>/
        → response includes inline plot_b64 + metrics + trades
    → BacktestPanel renders the chart from the data URL
```

Same code path serves the agent tool — `run_backtest_tool()` in
[`adk_agents/tools/backtest_tools.py`](backend/adk_agents/tools/backtest_tools.py)
calls the same `run_backtest()` with the same `BacktestSpec`, so an
agent reports byte-for-byte identical numbers.

---

## Quick start

Three flavours — pick the one that matches your environment.

### A. Local (no Docker)

```bash
# Backend (Python 3.12)
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8000

# Frontend
npm install
npm run dev      # http://localhost:5173

# Run the test suites
cd backend && pytest tests/ -q
npm test         # vitest, frontend unit tests
npm run e2e      # Playwright (needs backend on :8000 + chromium)
```

Or use the bundled launcher (uses the `fyer` conda env at
`/opt/miniconda3/envs/fyer/bin/python` — override with `FYER_PY=...`):

```bash
scripts/start-all.sh paper        # PaperBroker (no creds needed)
scripts/start-all.sh ibkr         # routes orders to TWS on 127.0.0.1:7497
scripts/start-all.sh alpaca       # needs ALPACA_API_{KEY,SECRET}
```

### B. Docker

Minimal two-service stack — `backend` (FastAPI) + `frontend` (Vite dev
server). Persists state to a named volume so dynamic tools, order
journals, telemetry counters, and backtest artefacts survive
restarts.

```bash
make docker-up                    # build + start, hot-reload mounted
make docker-logs                  # tail both services
make docker-down                  # stop (volumes preserved)
make docker-test                  # run pytest inside the backend container

# closer-to-prod (frontend on :80, source COPY'd not mounted):
make docker-prod-up
```

Behind the scenes: [`docker-compose.yml`](docker-compose.yml) +
[`docker-compose.prod.yml`](docker-compose.prod.yml). The Postgres /
Redis / orchestrator / NautilusTrader / TA-Lib / torch baggage from
the pre-Phase-B compose is gone — Phase B-J persists everything to
disk under `agents/`.

**IBKR from inside the container.** TWS / IB Gateway runs on the
*host*, the backend in the *container*. Compose maps
`host.docker.internal:7497` (auto on Docker Desktop, explicit
`extra_hosts: host-gateway` for Linux). Set `EXECUTION_BROKER=ibkr` in
`.env` and the broker selector picks it up:

```bash
echo 'EXECUTION_BROKER=ibkr' >> .env
make docker-up
curl localhost:8000/api/execution/broker/probe   # → {"broker":"ibkr",...}
```

### State that persists across restarts

The `agents/` directory and its subfolders are **gitignored** —
they're per-user state. In Docker mode they live in the
`openqwnt-agents` named volume, in local mode they sit in the repo
under `agents/`. Created on demand. Wiped only by `make
docker-clean` (which prompts).

### Environment variables

| Var | Used for | Default |
| --- | --- | --- |
| `EXECUTION_BROKER` | Force a specific broker (`paper` / `ibkr` / `alpaca`) | infer from creds → `paper` |
| `IB_HOST` / `IB_PORT` / `IB_CLIENT_ID` | TWS connection (Phase H IBKR) | `127.0.0.1` / `7497` / `42` |
| `ALPACA_API_KEY` / `ALPACA_API_SECRET` | Live broker (Phase H) | unset → PaperBroker |
| `GEMINI_API_KEY` | Boss + synthesis + LLM mutator (optional) | unset → heuristic fallback |
| `PAPER_CASH` | Paper-broker starting cash + risk gate's `initial_equity` | 100 000 |
| `RISK_MAX_ORDER_QTY` | Hard order-size cap | 1 000 |
| `RISK_MAX_POSITION_NOTIONAL` | Per-symbol notional cap | 50 000 |
| `RISK_MAX_DRAWDOWN_PCT` | Halt threshold vs peak equity | 20 |
| `RISK_MAX_DAILY_LOSS_PCT` | Halt threshold vs day-open equity | 5 |
| `FMP_API_KEY` | RMAP peers + DES fundamentals | optional |
| `VITE_BACKEND_URL` | Frontend base URL (compiled into the bundle) | `http://localhost:8000` |

---

## How to add an agent

A new agent is a class that subclasses
[`BaseAnalysisAgent`](backend/adk_agents/base_agent.py), wraps a
Gemini model with a system prompt + the tools it should have access
to, and returns a structured `AgentOutput`.

```python
# backend/adk_agents/my_new_agent.py
from .base_agent import BaseAnalysisAgent, AgentOutput
from .tools.market_data_tools import get_market_quote
from .tools.backtest_tools import run_backtest_tool

class MyNewAgent(BaseAnalysisAgent):
    name = "my_new"
    description = "What this agent does, in one sentence."
    tools = [get_market_quote, run_backtest_tool]
    system_prompt = """You are a …. Use the tools to ….
                      Return your conclusion as JSON matching AgentOutput."""

    async def analyze(self, context, ctx):
        # `ctx` is an AgentRunContext (Phase B).
        # Anything you do with it shows up live on the agent stream:
        ctx.status("Pulling market data…")
        with ctx.tool_call("market_data.quote", {"symbol": context.symbol}) as h:
            quote = get_market_quote(context.symbol)
            h.result(f"price={quote['price']}")
        ctx.thought("Quote looks normal; running a quick backtest.")
        # …
        return AgentOutput(...)
```

Telemetry (`agent_runs`, `tool_calls`) is wired automatically because
Phase J3 monkey-patches `AgentRunContext` at backend startup —
`backend/main.py` calls `telemetry.hook_into_context()` once.

To dispatch the new agent from the Boss, add it to the registry the
boss reads when planning subtasks; see
[`backend/routers/boss.py`](backend/routers/boss.py).

## How to add a node to the visual builder

A node has three pieces: catalogue metadata, a renderer, and (if it
needs to compute something at backtest time) a hook into the
canonical engine.

1. **Catalogue entry** — add the node type to
   [`src/features/strategy-flow/catalog/nodeCatalog.ts`](src/features/strategy-flow/catalog/nodeCatalog.ts)
   so it appears in the palette and the validator knows its inputs +
   outputs.
2. **Backend mirror** — add the same shape to
   [`backend/strategy_flow/node_catalog_cache.json`](backend/strategy_flow/node_catalog_cache.json)
   so the Python validator (`strategy_flow/validator.py`) and the
   template tests (Phase E) can reason about it.
3. **Renderer** (if it needs custom UI) — add a React component under
   [`src/features/strategy-flow/components/nodes/`](src/features/strategy-flow/components/nodes/)
   and wire it into the renderer map.
4. **Backtest behaviour** — for indicators / conditions / actions,
   add the implementation to
   [`backend/backtest/builtins.py`](backend/backtest/builtins.py) (or
   reference an existing `backtesting.py` helper). Templates that
   want to route through the canonical engine ship a `backtestSpec`
   (see Phase E doc) instead of hitting the legacy code-gen path.

If you're adding a *strategy* not a node, the simpler path is:
register it in `STRATEGIES` in `backend/backtest/builtins.py`, then
either add a template that points to it via `backtestSpec.strategy`,
or pass `strategy: "<your_name>"` in any `POST /api/backtest/run`.

---

## Hardening (Phase J)

- **CI** — [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs
  lint + typecheck + vitest + pytest (incl. the canonical-backtest
  reference test) on every PR.
- **E2E** — [`e2e/phase-e-rsi-template.spec.ts`](e2e/phase-e-rsi-template.spec.ts)
  walks the Phase E flow in a real browser (Playwright + Chromium):
  open `/backtest`, pick the RSI strategy, run it, assert the inline
  PNG and metric tiles appear.
- **Telemetry** — every `AgentRunContext` start/finish + every
  `tool_call/tool_result` increments counters in
  [`backend/telemetry/`](backend/telemetry/) which flush to
  `agents/_telemetry/counters.json`. The dashboard's **Telemetry**
  widget polls `/api/telemetry/summary` every 5 s.
- **Reference test** —
  [`backend/tests/test_backtest_reference.py`](backend/tests/test_backtest_reference.py)
  pins SMA(50/200) on SPY 2010-2023; if the engine drifts, CI fails.

---

## Phase test suites at a glance

```bash
# All in backend/, run with the project's Python env (pytest).
tests/test_backtest_reference.py      # Phase D · canonical engine
tests/test_rsi_template.py            # Phase E · template + validator
tests/test_dynamic_tools.py           # Phase G · sandbox + tool authoring
tests/test_execution.py               # Phase H · paper broker + risk gate
tests/test_improvement.py             # Phase I · self-improvement loop
tests/test_telemetry.py               # Phase J · counters + AgentRunContext hook
```

```bash
# Frontend
npm test                              # vitest (unit)
npm run e2e                           # Playwright (E2E)
```

---

## Repository layout

```
backend/
  main.py                  # FastAPI app, mounts every router
  agent_runtime/           # Phase B: AgentRunContext, EventBus, storage
  backtest/                # Phase D: canonical engine, builtins, plot
  execution/               # Phase H: PaperBroker, AlpacaBroker, RiskGate
  improvement/             # Phase I: Objective, Mutator, Tree, Runner
  sandbox/                 # Phase G: subprocess + setrlimit runner
  dynamic_tools/           # Phase G: agent-authored tool registry
  telemetry/               # Phase J3: counters + AgentRunContext hook
  adk_agents/              # Google-ADK agents + their Python tools
  routers/                 # FastAPI routers per concern
  tests/                   # pytest, one file per phase
  strategy_flow/           # node catalogue + validator (mirrors frontend)

src/
  pages/                   # React Router pages
  features/
    backtest/              # /backtest panel
    execution-viewer/      # /execution panel + LiveExecutionPanel
    improvement/           # /improvement panel
    tools/                 # /tools sandbox + dynamic-tool UI
    strategy-flow/         # / canvas (templates, BacktestModal, ...)
    terminal/              # Bloomberg-style screens + ⌘K palette
    dashboard/             # widget grid + AgentActivity + Telemetry
    boss/                  # boss-run tree
  stores/                  # Zustand state (auth, terminal symbol, ...)

orchestrator/              # legacy Node.js orchestrator (pre-Phase-B)
e2e/                       # Playwright E2E specs (Phase J2)
docs/templates/            # template docs (Phase E onward)
```

---

## Phase result docs

Each phase shipped with a result document — what was built, the exit
criterion proof, and how to run it.

- [PHASE_B_RESULT.md](PHASE_B_RESULT.md)
- [PHASE_D_RESULT.md](PHASE_D_RESULT.md)
- [PHASE_F_RESULT.md](PHASE_F_RESULT.md)
- [PHASE_G_RESULT.md](PHASE_G_RESULT.md)
- [PHASE_H_RESULT.md](PHASE_H_RESULT.md)
- [PHASE_I_RESULT.md](PHASE_I_RESULT.md)
- [PHASE_J_RESULT.md](PHASE_J_RESULT.md)

(Phases A, C, E shipped without dedicated docs; their work is
captured in [PLAN.md](PLAN.md) and the relevant code paths.)

---

## License

MIT.
