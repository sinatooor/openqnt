# AUDIT — Phase A status matrix

Captured: 2026-04-22. See [BOOT.md](BOOT.md) for service startup details.

Legend:
- ✅ **Working** — verified end-to-end with real data
- ⚠️ **Stub** — endpoint exists and responds 200, but returns placeholder / empty / hardcoded data
- ❌ **Broken** — errors or missing
- 🔒 **Auth-gated** — endpoint exists, returns 401 without credentials (expected, not tested)
- ❓ **Unverified** — exists in code but not exercised in this audit (e.g. SPA routes that need a browser)

---

## A2 — Backend routers (`/backend/main.py`, 93 paths total)

### Health & metadata
| Endpoint | Method | Status | Evidence |
|---|---|---|---|
| `/health` | GET | ✅ | 200 |
| `/api/health/` | GET | ✅ | 200 |
| `/api/health/detailed` | GET | ✅ | 200 |
| `/custom-blocks` | GET | ✅ | 200 |

### Templates & strategies
| Endpoint | Method | Status | Evidence |
|---|---|---|---|
| `/api/templates/` | GET | ✅ | Returns real catalog (`rsi_oversold_bounce`, `ma_crossover`, …) |
| `/api/flow/templates` | GET | ✅ | Returns full node graphs |
| `/api/strategy-flow/templates` | GET | ✅ | Returns template list |
| `/api/strategy-flow/node-definitions` | GET | ✅ | 200 |
| `/api/strategy-flow/generator-info` | GET | ✅ | 200 |
| `/api/strategy-flow/validate` | POST | ✅ | Correctly rejects empty graph: `{"isValid":false,"errors":["Strategy has no nodes."]}` |
| `/api/strategies` | GET | ⚠️ | Returns `[]` — DB is empty (no saved strategies) |

### Symbols & market data
| Endpoint | Method | Status | Evidence |
|---|---|---|---|
| `/api/symbols/popular` | GET | ✅ | Real list (EURUSD, GBPUSD, AAPL, MSFT, …) |
| `/api/symbols/types` | GET | ✅ | 200 |
| `/api/symbols/search?q=AAPL` | GET | ✅ | 200 |
| `/api/symbols/{symbol}` | GET | ✅ | 200 |
| `/compute/market-bars` | POST | ✅ | Returns real OHLCV via yfinance (verified SPY 5-bar tail) |

### Terminal data — **all real, all working**
| Endpoint | Method | Status | Evidence |
|---|---|---|---|
| `/api/terminal/quote/AAPL` | GET | ✅ | Real-time yfinance quote ($266.17, mkt cap $3.91T) |
| `/api/terminal/des/AAPL` | GET | ✅ | Real company profile (Apple Inc., Cupertino, NMS, GICS) |
| `/api/terminal/gip/AAPL` | GET | ✅ | Real 5m bars |
| `/api/terminal/hds/AAPL` | GET | ✅ | Real holders summary (institutional/insider %, top 10) |
| `/api/terminal/splc/AAPL` | GET | ⚠️ | Center data real, but `suppliers: []`, `customers: []` — FMP supply-chain peers requires Ultimate tier |
| `/api/terminal/wei` | GET | ✅ | Real world-equity-index snapshots (S&P, TSX, MEX, …) |

### Agents
| Endpoint | Method | Status | Evidence |
|---|---|---|---|
| `/api/agent/status` | GET | ✅ | `{"backend":"ADK","model":"gemini-3-flash-preview"}` — note non-existent model name (typo? Gemini 3 isn't a real model — should be `gemini-2.5-flash`) |
| `/api/agent/chat` | POST | ✅ | Returns real LLM-backed text. **But** the response hallucinated `AAPL = $189.84` (real ~$266) — agent has no tool to fetch live prices in chat path |
| `/compute/agents/types` | GET | ✅ | Lists 11 agents: news_analyst, macro_analyst, social_monitor, synthesis, technical_analyst, fundamentals_agent, sentiment_agent, trading_agent, developer_agent, exploratory_agent, … |
| `/compute/agents/run` | POST | ⚠️ | Endpoint structurally works. **But** every agent tested (`technical_analyst`, `news_analyst`, `macro_analyst`) returned summary "No data available" — they do **not** self-fetch data, they expect it pre-loaded into `context`. This is the single biggest functional gap. |
| `/compute/agents/logs` | GET | ⚠️ | Returns `{"logs":[]}` — no run history persisted yet |
| `/compute/agents/logs/stats` | GET | ✅ | 200 |
| `/compute/agents/pipeline` | POST | ❓ | Not exercised (depends on agents which return empty) |
| `/api/ai-assistant/tools` | GET | ✅ | Lists `build_strategy`, `run_backtest`, … |
| `/api/ai-assistant/chat`, `/chat/stream` | POST | ❓ | Not exercised |
| `/adk/status` | GET | ✅ | `{"running":false}` — ADK web UI not started |
| `/adk/start`, `/adk/stop` | POST | ❓ | Not exercised |

### Compute / quant
| Endpoint | Method | Status | Evidence |
|---|---|---|---|
| `/compute/health` | GET | ✅ | 200 |
| `/compute/backtest` | POST | ❌ | **Stub.** Returns `{"message":"Backtest endpoint available - full implementation pending","metrics": {all zeros}}` |
| `/compute/indicators` | POST | ❓ | Not exercised — code path uses TA-Lib, looks real |
| `/compute/monte-carlo` | POST | ❓ | Not exercised |
| `/compute/walk-forward` | POST | ❓ | Not exercised |
| `/compute/var-cvar` | POST | ❓ | Not exercised |
| `/compute/cointegration` | POST | ❓ | Not exercised |
| `/compute/param-sweep` | POST | ❓ | Not exercised |
| `/compute/quantstats-report` | POST | ❓ | Not exercised |
| `/compute/quant-strategy` | POST | ❓ | Not exercised |
| `/compute/quant-strategies-list` | GET | ✅ | 200 |
| `/compute/hmm-regime` | POST | ❓ | Not exercised |
| `/compute/ai-analyze` | POST | ❓ | Not exercised |

### Backtest paths (multiple)
| Path | Status |
|---|---|
| `backend/backtest_runner.py` direct call (`run_backtest`) | ✅ Verified via `test_rsi_template.py` — see A4 |
| `/api/strategy-flow/backtest` | ❓ Not exercised — likely works, same engine |
| `/api/flow/backtest` | ❓ Not exercised |
| `/compute/backtest` | ❌ Stub (above) |
| `/backtest-py-code` | ❓ Not exercised |

> **Three backtest endpoints + one direct path exist.** Phase D in [PLAN.md](PLAN.md) calls for consolidation to one canonical entrypoint — confirmed necessary.

### News, trades, portfolio
| Endpoint | Method | Status | Evidence |
|---|---|---|---|
| `/api/news/` | GET | ✅ | Real Yahoo Finance headlines |
| `/api/trades/` | GET | ✅ | 200 (empty until trades exist) |
| `/api/trades/summary` | GET | ✅ | 200 |
| `/api/portfolio/prices` | GET | ❓ | Not exercised |
| `/api/export/*` | GET | ❓ | Not exercised |

### Live trading
| Endpoint | Method | Status | Evidence |
|---|---|---|---|
| `/api/live/status` | GET | ✅ | `{"connected":false,"runner":{"success":false,"active":false}}` |
| `/api/live/login`, `/nordnet/login`, `/start`, `/strategy/stop`, `/panic` | POST | ❓ | Not exercised — needs broker session |

### Strategy generation
| Endpoint | Method | Status | Evidence |
|---|---|---|---|
| `/generate-strategy` | POST | ❓ | Not exercised — main LLM-driven generator |
| `/api/screen` | POST | ❓ | Not exercised |
| `/api/llm/execute` | POST | ❓ | Not exercised |
| `/api/strategy-flow/generate` | POST | ❓ | Not exercised |
| `/api/strategy-flow/chat` | POST | ❓ | Not exercised |

---

## A2 (cont.) — Orchestrator (Node, port 3000)

| Endpoint | Status | Evidence |
|---|---|---|
| `/health` | ✅ | `{"status":"ok","service":"strategyflow-orchestrator"}` |
| `/admin/queues` (Bull-board UI) | ✅ | 200, no jobs in queues yet |
| `/api/strategies`, `/api/executions`, `/api/notifications`, `/api/portfolio`, `/api/data-sources`, `/api/agent-runs`, `/api/research`, `/api/credentials`, `/api/auth`, `/api/ai`, `/api/webhooks`, `/api/data-events`, `/api/alert-rules`, `/api/approvals` | 🔒 | All return 401 unauthenticated — auth wiring intact, no smoke past it |

**Blockers:** Redis is not running. BullMQ workers cannot dequeue jobs. Live execution and scheduled triggers will silently fail until `redis-server` is running.

---

## A3 — Frontend pages

I cannot interactively render React in this audit — page status below is **served by Vite (HTTP 200)** but **runtime correctness not verified**. This requires a browser pass before Phase B.

Routes from [src/App.tsx](src/App.tsx):

| Route | File | Served | Runtime |
|---|---|---|---|
| `/` | [StrategyFlow.tsx](src/pages/StrategyFlow.tsx) | ✅ | ❓ |
| `/dashboard` | [Dashboard.tsx](src/pages/Dashboard.tsx) | ✅ | ❓ |
| `/executions` | [ExecutionHistory.tsx](src/pages/ExecutionHistory.tsx) | ✅ | ❓ |
| `/execution/:id` | [ExecutionDetails.tsx](src/pages/ExecutionDetails.tsx) | ✅ | ❓ |
| `/research` | [Research.tsx](src/pages/Research.tsx) | ✅ | ❓ |
| `/news` | [News.tsx](src/pages/News.tsx) | ✅ | ❓ — backend feed verified |
| `/terminal` | [Terminal.tsx](src/pages/Terminal.tsx) | ✅ | ❓ — backend data verified |
| `/terminal/rmap[/:ticker]` | [TerminalRmap.tsx](src/pages/TerminalRmap.tsx) | ✅ | ❓ |
| `/terminal/bmap` | [TerminalBmap.tsx](src/pages/TerminalBmap.tsx) | ✅ | ❓ — uses Leaflet |
| `/terminal/splc[/:ticker]` | [TerminalSplc.tsx](src/pages/TerminalSplc.tsx) | ✅ | ⚠️ — backend returns empty supplier/customer arrays |
| `/terminal/hds[/:ticker]` | [TerminalHds.tsx](src/pages/TerminalHds.tsx) | ✅ | ❓ — backend data verified |
| `/terminal/gip[/:ticker]` | [TerminalGip.tsx](src/pages/TerminalGip.tsx) | ✅ | ❓ — backend data verified |
| `/terminal/des[/:ticker]` | [TerminalDes.tsx](src/pages/TerminalDes.tsx) | ✅ | ❓ — backend data verified |
| `/ai-chat` | [AiChat.tsx](src/pages/AiChat.tsx) | ✅ | ❓ |
| `/agent` | [AgentConfig.tsx](src/pages/AgentConfig.tsx) | ✅ | ❓ |
| `/agents[/:id]` | [Agents.tsx](src/pages/Agents.tsx) | ✅ | ❓ |
| `/settings` | [Settings.tsx](src/pages/Settings.tsx) | ✅ | ❓ |
| `/portfolio` | [Portfolio.tsx](src/pages/Portfolio.tsx) | ✅ | ❓ |

> Action: do a one-pass browser walkthrough before Phase B, marking ✅/⚠️/❌ per page. ~30 min.

---

## A4 — Backtest end-to-end ✅

Ran `python backend/test_rsi_template.py`. **It works.**

```
Return:           -0.53%
Max Drawdown:     -5.55%
Total Trades:     3
Win Rate:         33.3%
Sharpe Ratio:     -0.12
Final Equity:     $9,946.85
…
Buy & Hold Return [%]    26.6569
CAGR [%]                 -0.3683
Calmar Ratio             -0.0962
```

- Real SPY data (2025-04-22 → 2026-04-21, 364 days)
- `backtesting.py` engine (not `backtrader`) — note: contradicts PLAN's assumption of backtrader as primary. **Two engines coexist**, need to pick one.
- Strategy is bad (negative return, only 3 trades) — not a defect, just a weak template.
- Returns full Pandas Series for `_equity_curve` and `_trades`, but **no plot is produced and nothing is saved to disk**. PLAN Phase D requires saving plots/artifacts.

---

## A5 — Agent invocation

Two agent invocation paths:

**Path 1: `/api/agent/chat` (ADK trading_agent)** — ✅ structurally; ⚠️ correctness
- Sent: `"give me the current AAPL quote and a 1-line trend take"`
- Received: real LLM text response, but **price was hallucinated** ($189.84 vs real ~$266). The chat agent does not invoke a quote tool.

**Path 2: `/compute/agents/run` (analysis agents)** — ⚠️
- `technical_analyst`, `news_analyst`, `macro_analyst` all responded with structured output but `summary: "No data available"` — they expect upstream data injection, do not self-fetch.
- This is the **biggest gap**: there's no working "boss → quant agent with autonomous data fetch" loop today. PLAN Phase B/C must address this.

---

## A6 — Env & API keys (corrected — both `.env` files)

| Key | In `/.env` | In `/backend/.env` | Verified usable |
|---|---|---|---|
| Anthropic | ✅ | ✅ | ✅ |
| Gemini | ❌ | ✅ | ✅ (used by ADK + ai_assistant) |
| DeepSeek | ❌ | ✅ | ❓ |
| AI Gateway | ❌ | ✅ | ❓ |
| OpenAI | ❌ | ❌ | n/a — confirm no agents need it |
| FMP | ✅ | ✅ | ✅ (terminal/des, splc) |
| Alpha Vantage | ✅ | ✅ | ❓ |
| Finnhub | ✅ | ✅ | ❓ |
| Polygon | ✅ | ✅ | ❓ |
| FRED | ✅ | ✅ | ❓ |
| NewsAPI | ✅ | ✅ | ❓ — `/api/news/` uses Google News RSS, not NewsAPI |
| Firecrawl | ✅ | ✅ | ❓ |
| Twilio | ✅ | ✅ | ❓ |
| Telegram | ✅ | ✅ | ❓ |
| Supabase | ✅ | ✅ | ❓ |
| **IG broker** | ❌ | ✅ (`IG_API_KEY` + creds) | ❓ — present, untested |
| **Nordnet** | ❌ | ❌ | ❌ — code references it, no creds |
| **Mapbox** | ❌ | ❌ | n/a — see decision below |

### Decisions resolved this phase

| Decision | Resolution |
|---|---|
| **Mapbox vs Leaflet** | **Leaflet.** Codebase has 0 Mapbox references; [BmapView.tsx](src/features/terminal/bmap/BmapView.tsx) and rmap use Leaflet. PLAN.md updated. No Mapbox token needed. |
| **OpenAI fallback** | **Not needed** for current code. Anthropic + Gemini cover all observed call sites. |
| **Broker** | **IG (paper)** for Phase H — credentials already present. Add Alpaca only if US equities paper is needed. |
| **Backtest engine** | **Two coexist** (`backtesting.py` and `backtrader`). Defer pick to Phase D — but data point: the working test uses `backtesting.py`. |

### Remaining env / config gaps

- [ ] `GEMINI_API_KEY` should also be in root `.env` so frontend tooling and ADK web UI agree.
- [ ] Consolidate to a single `.env` file (or document that two exist on purpose).
- [ ] `NEWSAPI_KEY` is set but `/api/news/` uses Google News RSS — either wire NewsAPI or remove the key from docs.
- [ ] `redis-server` install/run docs missing — orchestrator silently degrades without it.
- [ ] `BLOCK_CATALOG.xml` not found at runtime — investigate path or remove.
- [ ] Agent default model `gemini-3-flash-preview` doesn't exist — fix to `gemini-2.5-flash`.

---

## Top findings — action items going into Phase B

Ranked by impact on the PLAN.

1. **🔴 Agents have no autonomous data fetch.** `/compute/agents/run` agents return "No data available" because they read from `context`, never fetch. Phase B must wire each agent to its tools (market_data_tools, news_tools, etc.) and run them in a loop.
2. **🔴 No agent run logs / memory persisted.** `/compute/agents/logs` returns `[]`. Need the on-disk layout from PLAN B1 (`agents/<id>/runs/<run_id>/events.jsonl`, `memory.md`, `state.md`).
3. **🟠 Backtest is fragmented.** Three HTTP entrypoints (`/compute/backtest` is a stub, `/api/strategy-flow/backtest` and `/api/flow/backtest` untested), plus a working direct path. Phase D consolidation is real work, not paper.
4. **🟠 Backtest produces no saved plot/artifact.** Test prints metrics, doesn't save anything. Phase D5 required.
5. **🟠 Chat agent hallucinates prices.** `/api/agent/chat` doesn't invoke a quote tool — needs tool wiring.
6. **🟡 Redis not running.** Orchestrator silently degrades. Add to boot checklist (already in [BOOT.md](BOOT.md)).
7. **🟡 Two `.env` files.** Confusing, contributed to PLAN inventory mistake. Consolidate.
8. **🟡 SPLC empty.** FMP supply-chain peers needs Ultimate tier or another source.
9. **🟡 Page-level runtime not verified.** 18 routes served but not exercised in a browser. Do this before Phase B.
10. **🟢 Wrong default agent model name** (`gemini-3-flash-preview`). One-line fix.

---

## What this changes in PLAN.md

- Map decision **locked to Leaflet** — remove Mapbox from open questions.
- Broker decision **locked to IG paper** for Phase H — creds already present.
- OpenAI fallback decision **locked: not needed.**
- Phase D scoping: **two backtest engines** to consolidate (not one canonical + one optional). Recommend `backtesting.py` because it's the one that demonstrably works on real data today.
- Add a **pre-Phase-B browser walkthrough** task (~30 min) to A3 to convert ❓ → ✅/⚠️ for the 18 routes.
- Add a **`backend/.env` consolidation** task to Phase J (hardening).
