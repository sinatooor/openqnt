# openqwnt — Build Plan

> A self-improving, autonomous quant research & execution system: hierarchical Boss → Quant Agent orchestration, real data ingestion, working backtests, node-based Strategy Builder, Bloomberg-like terminal, full observability.

This document is the working build plan. It is grounded in what already exists in the repo (so we don't redo work) and is sequenced so each phase produces something **demonstrable in the browser** — no purely-internal scaffolding phases.

---

## 0. Inventory — what we already have

So we don't rebuild what's there.

### Frontend (`src/`)
- React 18 + Vite + TypeScript, Tailwind, Radix, MUI, Ant
- `@xyflow/react` — node-based Strategy Builder (already in use at [src/features/strategy-flow/](src/features/strategy-flow/))
- `lightweight-charts`, `recharts`, `flexlayout-react` (terminal-style panes)
- `socket.io-client` (real-time channel)
- Pages: [Dashboard](src/pages/Dashboard.tsx), [Agents](src/pages/Agents.tsx), [StrategyFlow](src/pages/StrategyFlow.tsx), [Terminal + sub-terminals](src/pages/Terminal.tsx) (BMAP, DES, GIP, HDS, RMAP, SPLC), [Research](src/pages/Research.tsx), [Portfolio](src/pages/Portfolio.tsx), [ExecutionHistory](src/pages/ExecutionHistory.tsx)
- Templates registry already exists: [src/features/strategy-flow/templates/](src/features/strategy-flow/templates/) (`strategyTemplates`, `agenticTemplates`, `pineScriptTemplates`, `onboardingTemplates`, `additionalTemplates`, `advancedTemplates`)

### Backend (`backend/`)
- FastAPI app ([main.py](backend/main.py)) with routers: [agent_chat](backend/routers/agent_chat.py), [agent_runner](backend/routers/agent_runner.py), [strategy_flow](backend/routers/strategy_flow.py), [terminal_data](backend/routers/terminal_data.py), [templates](backend/routers/templates.py), [live_trading](backend/routers/live_trading.py), [news](backend/routers/news.py), [portfolio](backend/routers/portfolio.py), [adk_web](backend/routers/adk_web.py), [compute](backend/routers/compute.py)
- ADK agents ([backend/adk_agents/](backend/adk_agents/)): `agent_orchestrator`, `base_agent`, `technical_analyst`, `fundamentals_agent`, `macro_analyst`, `news_analyst`, `sentiment_agent`, `social_monitor`, `trading_agent`, `synthesis_agent`, `developer_agent`, `exploratory_agent`
- Agent tools ([backend/adk_agents/tools/](backend/adk_agents/tools/)): market_data, technical_analysis, indicators, news, screener, RAG, risk, portfolio, planning, web scraper, file, notebook, broker, custom blocks, etc.
- Strategy flow engine ([backend/strategy_flow/](backend/strategy_flow/)): `backtrader_engine`, `ai_generator`, `live_executor`, `validator`, `router`, `node_catalog_cache.json`
- Backtest stack: [backtest_engine.py](backend/backtest_engine.py), [backtest_runner.py](backend/backtest_runner.py), [walkforward.py](backend/walkforward.py), [monte_carlo.py](backend/monte_carlo.py), [risk_controls.py](backend/risk_controls.py), Rust backtest in [backend/rust_backtest/](backend/rust_backtest/)
- Data: [data_service.py](backend/data_service.py), [market_data_scheduler.py](backend/market_data_scheduler.py), FMP client in [backend/fmp/](backend/fmp/), Polygon/Finnhub/AV via env, [fetch_commodities_crypto.py](backend/fetch_commodities_crypto.py), [fetch_forex_data.py](backend/fetch_forex_data.py)
- Storage: SQLite ([strategies.db](backend/strategies.db)), Chroma vector DB ([backend/chroma_db_v2/](backend/chroma_db_v2/)), local DB layer
- LLM: [llm_service.py](backend/llm_service.py), [llm_logger.py](backend/llm_logger.py), [rag_system.py](backend/rag_system.py)

### Orchestrator (`orchestrator/`)
- TypeScript service (Node + Prisma) — separate from FastAPI backend
- [orchestrator/src/](orchestrator/src/): `engine`, `workers`, `services`, `brokers`, `api`

### Env / API keys (audit)
| Provider | Status | Notes |
|---|---|---|
| Anthropic | ✅ | Primary LLM |
| FMP | ✅ | Fundamentals, screener |
| Alpha Vantage | ✅ | Backup fundamentals/intraday |
| Finnhub | ✅ | Real-time quotes, SEC |
| Polygon | ✅ | US equities/options |
| NewsAPI | ✅ | Headlines |
| FRED | ✅ | Macro |
| Firecrawl | ✅ | Web scrape |
| Telegram, Twilio | ✅ | Notifications |
| Supabase | ✅ | Auth/DB |
| **OpenAI** | ❌ | Some agents may default to it — set or remove fallbacks |
| **Gemini** | ❌ | Same |
| **Mapbox** | ❌ | Spec mentions Mapbox; repo currently uses Leaflet — pick one |
| **Broker creds** (IG, Nordnet) | ❌ | Required for live execution |
| **CoinGecko / crypto** | ❌ | If crypto agent is in scope |

---

## 1. Architecture (target state)

```
┌─────────────────────────────── Frontend (Vite/React) ────────────────────────────────┐
│  Terminal (flexlayout) │ Strategy Builder (xyflow) │ Agents view │ Execution viewer  │
│         │                       │                          │                          │
│         └─────────── socket.io ─┴──────────── REST ────────┘                          │
└──────────────────────────────────────┬───────────────────────────────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                │                                             │
        FastAPI backend                              TS Orchestrator
        (agents + data + RAG)                       (job queue, brokers,
                │                                    live execution)
                │                                             │
   ┌────────────┴───────────┐                        ┌────────┴────────┐
   │ Boss Agent             │                        │ Worker pool     │
   │  ├─ Technical Quant    │                        │ Broker adapters │
   │  ├─ Fundamentals Quant │                        │ Prisma store    │
   │  ├─ Macro Quant        │                        └─────────────────┘
   │  ├─ News/Sentiment     │
   │  ├─ Crypto Quant       │  Each:
   │  ├─ Trading Quant      │   • memory.md (long-term)
   │  └─ Developer Quant    │   • state.md (current task)
   └────────────┬───────────┘   • logs/<run_id>/ (reasoning, tool calls, plots)
                │
   ┌────────────┴───────────┐
   │ Tool layer             │
   │  market_data, TA,      │
   │  news, RAG, backtest,  │
   │  notebook (sandbox),   │
   │  web_scraper, ...      │
   └────────────────────────┘
```

**Key invariants**
- Every agent action is logged to `logs/agents/<agent_id>/<run_id>/` as JSONL + any artifacts (plots, CSVs)
- Every agent has `agents/<agent_id>/memory.md` (slow-changing) and `agents/<agent_id>/state.md` (per-task)
- Boss never executes tools directly — it dispatches to Quant agents
- Strategy templates live in `src/features/strategy-flow/templates/` and are the **canonical** source for the Templates section

---

## 2. Phases & tasks

Each phase ships a thing the user can click on and verify. No phase is "internal only."

Estimates are senior-engineer-days, single contributor.

### Phase A — Ground truth & gaps audit (1–2 d)

**Goal:** know exactly what works and what's broken before building on top.

- [ ] A1. Boot frontend (`bun dev`) + backend (`uvicorn backend.main:app`) + orchestrator. Document any breakage in `BOOT.md`.
- [ ] A2. Hit each backend router with a smoke request; mark working vs broken.
- [ ] A3. Open each page in the browser; mark working vs broken.
- [ ] A4. Run one existing backtest end-to-end (e.g. `backend/test_rsi_template.py`) — does it actually produce a result + plot? If not, why?
- [ ] A5. Trigger one ADK agent via [agent_runner](backend/routers/agent_runner.py) — does it complete and return real output?
- [ ] A6. Resolve env gaps: decide on Mapbox vs Leaflet, OpenAI/Gemini fallbacks, broker creds plan.
- [ ] A7. Output: `AUDIT.md` with a status matrix (Working / Broken / Stub / Missing) for every component listed in section 0.

**Exit criteria:** we have a single page that lists every component with its real status. No more guessing.

---

### Phase B — Agent runtime: memory, state, logs, plots (3–5 d)

**Goal:** every agent run produces persistent memory, state, structured logs, and saves plots to disk — viewable in the UI.

- [ ] B1. Define on-disk layout under `agents/`:
  ```
  agents/
    boss/
      memory.md
      state.md
    quants/
      technical/
        memory.md
        state.md
        runs/<run_id>/
          events.jsonl     # every tool call, LLM message, decision
          plots/*.png
          artifacts/*.{csv,json,parquet}
          summary.md       # human-readable run report
  ```
- [ ] B2. Add `AgentRunContext` in `backend/adk_agents/base_agent.py` that:
  - Creates the run dir
  - Exposes `log_event(type, payload)`, `save_plot(fig, name)`, `save_artifact(...)`, `update_state(...)`, `append_memory(...)`
  - Wraps every tool call so events are logged automatically
- [ ] B3. Refactor existing agents (`technical_analyst`, `fundamentals_agent`, `macro_analyst`, `news_analyst`, `trading_agent`) to receive `AgentRunContext` and use it instead of ad-hoc prints.
- [ ] B4. Add `GET /agents/{agent_id}/runs`, `GET /agents/{agent_id}/runs/{run_id}/events`, `GET /agents/{agent_id}/runs/{run_id}/artifacts` to FastAPI.
- [ ] B5. Add WebSocket channel `ws/agents/{agent_id}/stream` that emits new events as they're written.
- [ ] B6. Frontend: add `AgentRunPanel` to [src/features/agents/](src/features/agents/) showing live event stream + tabs for memory.md, state.md, plots, artifacts. Mount on existing [Agents.tsx](src/pages/Agents.tsx).

**Exit criteria:** click an agent in the UI → trigger a run → see live tool calls, then a saved plot, then `summary.md`, all without refresh.

---

### Phase C — Boss orchestration (3–4 d)

**Goal:** one user prompt fans out across multiple Quant Agents in parallel, Boss aggregates.

- [ ] C1. In [agent_orchestrator.py](backend/adk_agents/agent_orchestrator.py), define a `BossAgent` that:
  - Accepts a high-level objective (e.g. "research SPY mean-reversion edges")
  - Plans: produces a list of `Subtask{agent, prompt, expected_output}`
  - Dispatches subtasks in parallel via `asyncio.gather`, each with its own `AgentRunContext`
  - Aggregates results into a `synthesis` step (delegated to `synthesis_agent`)
  - Decides next action (refine / execute / spawn new task)
- [ ] C2. Persist boss-level reasoning to `agents/boss/runs/<run_id>/`
- [ ] C3. Endpoint `POST /boss/run` and WS `ws/boss/{run_id}` for live tree of subtasks.
- [ ] C4. Frontend: a `BossRunTree` component showing the dispatch tree, each node clickable into the agent's run panel.

**Exit criteria:** type a prompt in the UI, watch a tree of agents light up in parallel, and read the synthesized output.

---

### Phase D — Backtesting that actually works (3–5 d)

**Goal:** one canonical backtest path that produces correct numbers + a saved equity-curve plot, callable from a node graph and from agents.

- [ ] D1. Pick the canonical engine. Existing options: [backtest_engine.py](backend/backtest_engine.py), [strategy_flow/backtrader_engine.py](backend/strategy_flow/backtrader_engine.py), Rust backtest. **Recommendation:** `backtrader_engine` as primary, Rust as optional speed path.
- [ ] D2. Validate against a known reference: SMA(50/200) crossover on SPY 2010–2024 should produce CAGR/Sharpe within tolerance of a hand-computed result. Add this as a CI test.
- [ ] D3. Standardize result schema: `{equity_curve, trades, metrics{cagr, sharpe, sortino, max_dd, win_rate, ...}, plots[]}`. Save to artifacts.
- [ ] D4. Single entrypoint `backtest.run(strategy_ir, data_spec, params) -> BacktestResult` used by:
  - Strategy Flow node graph executor
  - Agent tool `run_backtest`
  - REST endpoint `POST /backtest/run`
- [ ] D5. Plot equity curve + drawdown via matplotlib, save PNG to run artifacts.
- [ ] D6. Frontend: results panel renders metrics table + equity-curve image.

**Exit criteria:** trigger backtest from (a) a strategy graph and (b) an agent — both produce identical metrics on the same inputs and a plot file.

---

### Phase E — Strategy Builder template (1–2 d)

**Goal:** a real, runnable template in the Templates section using the app's own nodes.

- [ ] E1. Pick the template: **RSI(14) mean-reversion on SPY** with stop-loss + take-profit (concrete, testable, classic).
- [ ] E2. Author the template in [src/features/strategy-flow/templates/strategyTemplates.ts](src/features/strategy-flow/templates/strategyTemplates.ts) using only nodes from [node_catalog_cache.json](backend/strategy_flow/node_catalog_cache.json) — verify each node type exists.
- [ ] E3. Validate via [strategy_flow/validator.py](backend/strategy_flow/validator.py).
- [ ] E4. Run end-to-end: load template → click Backtest → results render.
- [ ] E5. Document in `docs/templates/rsi-mean-reversion.md`.

**Exit criteria:** new user opens Templates, clicks RSI template, hits Backtest, sees real metrics + equity curve. No errors in console.

---

### Phase F — Bloomberg-like terminal: real data, real charts (5–7 d)

**Goal:** the existing terminal screens (BMAP, DES, GIP, HDS, RMAP, SPLC) backed by real, current data — not placeholders.

- [ ] F1. Audit each terminal screen ([src/features/terminal/](src/features/terminal/)) — list which currently show real data and which are stubs.
- [ ] F2. Wire each through [terminal_data.py](backend/routers/terminal_data.py) to a real source:
  - **DES** (description): FMP company profile + Finnhub real-time quote
  - **GIP** (price chart): Polygon/AV bars → lightweight-charts
  - **HDS** (historical data): Polygon aggregates table
  - **BMAP** (heatmap): FMP sector + price-change heatmap
  - **RMAP** (regional map): use chosen map provider, plot exposure by country
  - **SPLC** (supply chain): FMP supply-chain peers
- [ ] F3. Add a global symbol search (cmd+k) that updates active symbol across all panes (already partly via `useTerminalData`).
- [ ] F4. Add a dedicated **Agent Activity** pane in the terminal flexlayout showing the boss-run tree from Phase C.

**Exit criteria:** type `AAPL` in cmd+k, all six terminal screens populate with real data within 2s.

---

### Phase G — Sandbox & dynamic tool creation (4–6 d)

**Goal:** agents can write/run Python in an isolated sandbox and create new tools when capabilities are missing.

- [ ] G1. Pick sandbox approach. Options:
  - (a) Docker-per-run (heavy, safest)
  - (b) `subprocess` with `resource.setrlimit` + tmpdir + restricted PYTHONPATH (light, weaker isolation)
  - (c) Use [backend/mcpt/](backend/mcpt/) if it already provides this — check first
  - **Recommendation:** start with (b), document threat model, upgrade later.
- [ ] G2. Tool `execute_python(code, files_in) -> {stdout, stderr, files_out, plots}` with timeout + memory cap.
- [ ] G3. Browser tool: extend [web_scraper_tools.py](backend/adk_agents/tools/web_scraper_tools.py) with Playwright session for interactive flows. Firecrawl already covers static scrape.
- [ ] G4. Dynamic tool registration: `developer_agent` can author a new Python tool file, validate it (signature check), register it in the tool registry, and the next agent run can use it. Persist to `agents/tools/dynamic/`.
- [ ] G5. Tool registry surface in UI (read-only list).

**Exit criteria:** ask the system to compute something it doesn't currently have a tool for; it writes the tool, registers it, uses it, returns the answer.

---

### Phase H — Live execution path (3–4 d) — *gated on broker creds*

**Goal:** signals from a strategy can hit a broker (paper first, then live).

- [ ] H1. Confirm broker choice + paper-trading creds (IG, Nordnet, or add Alpaca for US paper).
- [ ] H2. Wire [orchestrator/src/brokers/](orchestrator/src/brokers/) to one broker end-to-end with paper account.
- [ ] H3. Risk controls path: every order passes through [risk_controls.py](backend/risk_controls.py) before transmission.
- [ ] H4. Execution viewer page ([src/features/execution-viewer/](src/features/execution-viewer/)) shows live orders, fills, P&L.
- [ ] H5. Kill switch in UI.

**Exit criteria:** template strategy from Phase E, switched to "paper-live" mode, places at least one paper order on signal, visible in Execution viewer.

---

### Phase I — Self-improvement loop (3–5 d)

**Goal:** the system uses [improve_loop.py](backend/improve_loop.py) to iterate strategy IR based on backtest results.

- [ ] I1. Define improvement objective (e.g. "improve Sharpe without raising max DD").
- [ ] I2. Loop: backtest → critique (LLM via [synthesis_agent](backend/adk_agents/synthesis_agent.py)) → propose IR mutation → re-backtest → keep if better.
- [ ] I3. Cap iterations + budget; persist tree of attempts under `agents/boss/runs/<run_id>/improvement_tree/`.
- [ ] I4. UI: an "Improve" button on a strategy that opens a live tree view of attempts.

**Exit criteria:** click Improve on the RSI template; 5 iterations run; final strategy has measurably better metrics on the validation period.

---

### Phase J — Hardening (ongoing)

- [ ] J1. CI: lint, typecheck, vitest, pytest, the canonical-backtest reference test.
- [ ] J2. E2E smoke: Playwright script that walks Phase E flow.
- [ ] J3. Telemetry: count agent runs, tool calls, errors; surface on Dashboard.
- [ ] J4. Docs: README rewrite covering the architecture above + how to add a new agent and a new node.

---

## 3. Sequencing & dependencies

```
A (audit) ──► B (agent runtime) ──► C (boss orchestration) ──► I (self-improve)
                  │
                  ├──► D (backtest) ──► E (template) ──► F (terminal) ─┐
                  │                                                     │
                  └──► G (sandbox) ─────────────────────────────────────┤
                                                                        │
                                          H (live exec, gated) ◄────────┘
                                                                        │
                                          J (hardening) — runs alongside everything
```

A blocks everything (we need the truth first). B blocks C/D/G. D blocks E. E blocks F's agent pane integration and H.

---

## 4. Risks & decisions to lock in early

| Risk | Decision needed | Default |
|---|---|---|
| Two backtest engines diverge | Pick one canonical | `backtrader_engine` |
| Sandbox isolation strength | Docker vs subprocess | subprocess + rlimit, document threat model |
| Mapbox vs Leaflet | One mapping stack | Leaflet (already wired) unless Mapbox features needed |
| LLM provider lock-in | Anthropic-only or multi-provider | Anthropic primary, no fallbacks unless added explicitly |
| Live trading auth | Which broker + paper-only first | IG paper or add Alpaca paper |
| Frontend state library | Zustand is in repo — keep | Keep Zustand |
| Agent memory format | Markdown vs JSON | Markdown (human readable, LLM-friendly) |

---

## 5. Definition of done (whole project)

A new user can:

1. Open the app, log in.
2. Open Templates → pick RSI mean-reversion → see the node graph.
3. Click Backtest → see real metrics + equity-curve plot in <10s.
4. Open Terminal → search `AAPL` → all six screens show real data.
5. Open Agents → type "find me a momentum edge in tech stocks" → watch a Boss-run tree dispatch to ≥3 quant agents in parallel.
6. Each agent shows a live event stream, saved plots, and a `summary.md`.
7. Click Improve on the strategy → 5 iterations, final result is better.
8. Switch strategy to paper-live → at least one paper order placed on signal.
9. Every action above is replayable from `agents/.../runs/<run_id>/`.

---

## 6. What I need from you to start

- **Confirm canonical decisions** in section 4 (backtest engine, sandbox model, map stack, broker).
- **Confirm phase order** — happy with A → B → C → D → E → F → G → H → I, or do you want a different first user-visible win?
- **Pick the first phase to actually build.** I'd start with **A (audit)** then **B (agent runtime)** since everything downstream depends on it. If you want a faster visible win, **E (template)** is the smallest standalone slice.
