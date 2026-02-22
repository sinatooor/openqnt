# StrategyFlow AI Agent — Product Requirements Document

**Version:** 3.0 | **Status:** Discovery | **Priority:** Critical | **Date:** 2026  
*Updates in v3.0: Node.js-primary architecture with Python as a focused compute microservice. Inspired by n8n (event-driven workflows, execution history, credential vault) and OpenClaw (heartbeat daemon, cheap pre-checks). Comprehensive documentation of what's already built.*

---

## 1. Executive Summary

StrategyFlow AI Agent transforms an existing visual node-and-edge strategy builder into a fully autonomous, 24/7 financial AI agent. Rather than serving as a passive flowchart tool that users reference manually, the upgraded platform acts as a proactive AI coworker — monitoring markets, reading financial news and reports, executing trades, managing portfolio risk, and alerting users in real time.

The product democratizes capabilities that have historically been reserved for institutional hedge funds — systematic strategy execution, around-the-clock market surveillance, news-aware portfolio management, and automated trade execution — and makes them accessible to any individual investor, active trader, or wealth manager.

The core innovation is treating the user's flowchart not as a diagram, but as a **living, executable n8n-style workflow** — a decision engine that an AI agent traverses in real time as market conditions evolve. The platform draws architectural inspiration from:

- **n8n**: Event-driven trigger nodes, webhook-based instant execution, structured JSON data passing between nodes, execution history with per-node data inspection, credential vault, BullMQ job queuing — and critically, n8n's **Node.js-based orchestration architecture**.
- **OpenClaw**: Heartbeat daemon architecture — a persistent background process that wakes the agent at configurable intervals, consults a checklist of tasks, performs cheap pre-checks before invoking the LLM, and suppresses non-events to minimize cost and noise.

---

## 2. Problem Statement

### 2.1 The Gap in Existing Tools

Current financial tools fall into two unsatisfying categories:

- **Passive dashboards and charting tools** that require the user to constantly monitor screens and manually execute decisions based on their strategy.
- **Robo-advisors** (Betterment, Wealthfront) that offer generic, static rebalancing with no ability to incorporate custom user logic, real-time news, or nuanced market conditions.
- **Traditional trading bots** that react only to price action, with no ability to interpret context (e.g., understanding why a stock is dropping — market correction vs. CEO resignation).

### 2.2 The Core Pain

Users build sophisticated mental strategies but cannot execute them consistently because:

- Markets move 24/7 (especially crypto) but humans need to sleep.
- Relevant news breaks at any hour and requires immediate portfolio assessment.
- Emotional decisions override well-designed strategic logic under pressure.
- The cognitive load of monitoring multiple assets, reading reports, and tracking news simultaneously is impossible for a single person.

---

## 3. Product Vision & Goals

### 3.1 Vision Statement

> *"Give every person access to their own AI-powered hedge fund team — one that never sleeps, reads everything, knows their exact strategy and portfolio, and acts on their behalf the moment an opportunity or risk appears — powered by visual, event-driven automation."*

### 3.2 Success Metrics

| Metric | Target (6 months) | Stretch Goal (12 months) |
|---|---|---|
| Agent Uptime | 99.5% | 99.9% |
| Signal-to-Alert Latency | < 60 seconds | < 10 seconds |
| Strategy Execution Accuracy | 95% match to flowchart logic | 99% match |
| User Retention (90-day) | 40% | 65% |
| Autonomous Actions per User/Month | 50+ | 200+ |

---

## 4. Target Users & Real-World Personas

### Persona 1 — The Retail Investor (Primary)

| | |
|---|---|
| **Background** | Employed full-time. Invests in stocks and ETFs with a long-term strategy. Can't watch markets during work hours. |
| **Pain Point** | Has a solid strategy on paper but breaks it emotionally when markets move. Misses buying opportunities while at work. |
| **Job To Be Done** | "Execute my strategy consistently without me having to babysit the market." |
| **How They Use It** | Builds a flowchart: 'If quality stock drops 10% with no fundamental news, buy $500.' Receives a WhatsApp alert when this triggers with option to approve or let agent auto-execute. |
| **Replaces** | Personal financial advisor, robo-advisor |

### Persona 2 — The Active Trader (Primary)

| | |
|---|---|
| **Background** | Day trader or swing trader who monitors multiple tickers and strategies simultaneously. |
| **Pain Point** | Cannot scan 50 tickers at once, read every earnings report, and track sentiment — cognitive overload. |
| **Job To Be Done** | "Be my second brain — filter out the noise and alert me only when my exact setup is met." |
| **How They Use It** | Builds complex multi-condition nodes: technical triggers (RSI, volume), news filters, sector momentum. Agent scans the entire market and alerts with a pre-filled trade recommendation. |
| **Replaces** | Junior analyst, trading alert services (TradingView alerts, Trade Ideas) |

### Persona 3 — The Wealth Manager / RIA (Secondary)

| | |
|---|---|
| **Background** | Registered Investment Advisor managing 20–100 client portfolios, each with different risk profiles and strategies. |
| **Pain Point** | Cannot monitor all client portfolios in real time. Quarterly reviews miss time-sensitive opportunities and risks. |
| **Job To Be Done** | "Scale my business by letting AI monitor all client portfolios continuously so I only step in when something important happens." |
| **How They Use It** | Creates a separate strategy flowchart per client. Agent monitors all portfolios simultaneously and surfaces a prioritized alert dashboard for the advisor to review and act on. |
| **Replaces** | Associate analysts, manual portfolio review process |

### Persona 4 — The Crypto Trader (Secondary)

| | |
|---|---|
| **Background** | Active crypto investor. Markets never close, creating constant anxiety about missing moves during sleep. |
| **Pain Point** | 3am crashes and pumps happen regularly. No way to manage risk around the clock. |
| **Job To Be Done** | "Protect my portfolio and capture opportunities even when I'm asleep." |
| **How They Use It** | DCA strategy with take-profit and stop-loss rules triggered by on-chain data, fear/greed index, and sentiment. Agent executes autonomously 24/7. |
| **Replaces** | Crypto trading bots (3Commas, Pionex) but with news-awareness and natural language strategy definition |

---

## 5. Market Disruption Map

StrategyFlow AI Agent does not sit in a vacuum. It directly disrupts a set of expensive, inaccessible, or inefficient real-world financial roles — and augments a set of professionals who currently rely on slow, manual workflows.

### 5.1 — Roles This Tool Replaces (For Retail Users)

The following roles are typically only accessible to high-net-worth individuals or institutional investors. StrategyFlow makes them available to anyone with a strategy and an internet connection.

| Role Replaced | What They Do (That We Automate) | Our Advantage |
|---|---|---|
| **Hedge Fund Team** | Portfolio manager + quant analyst + risk manager + news analyst working together. Costs $500k+/year in salaries. | Full team capability delivered by one AI agent. Available to any individual investor at a subscription price. |
| **Stockbroker** | Calls clients with opportunities, executes trades, monitors positions, collects commission on every trade. | 24/7 autonomous monitoring with zero commission bias. Executes only what the user's strategy dictates. |
| **Financial Advisor** | Reviews portfolio quarterly, recommends rebalancing, checks if strategy still makes sense given market conditions. | Continuous review every heartbeat cycle — not quarterly. Always aware of breaking news and macro shifts. |
| **Quant Trader** | Writes algorithmic code to systematically execute rules-based strategies. Requires deep programming skills. | No-code visual builder replaces the programming requirement. Strategy flowchart IS the algorithm. |
| **Junior Analyst** | Reads FOMC reports, earnings calls, and financial filings. Synthesizes data into memos for senior staff. | Agent reads and synthesizes in milliseconds. Never fatigued, never misses a filing, never needs sleep. |
| **Robo-Advisor (Betterment, Wealthfront)** | Offers static, generic rebalancing based on basic risk profile. No custom logic, no news-awareness. | Dynamic, news-aware, fully personalised strategy execution. User defines every rule — not a generic algorithm. |
| **Static Trading Bots (3Commas, Pionex)** | React only to price action via hard-coded rules. Cannot interpret context or reason about why a stock is moving. | Interprets context: understands WHY a stock is dropping (CEO resigned vs. normal correction) before acting. |

### 5.2 — Roles This Tool Augments (For Professionals)

For professionals who already hold these roles, StrategyFlow acts as a force-multiplier — letting them scale their practice without adding headcount.

| Professional | How They Use StrategyFlow | The Force-Multiplier Effect |
|---|---|---|
| **Independent Trader / Day Trader** | Builds multi-condition strategy nodes (RSI + volume + sentiment + news filters). Agent monitors 50+ tickers simultaneously. | One trader effectively monitors the whole market. No more missed setups because they were watching a different ticker. |
| **RIA / Boutique Wealth Manager** | Creates a separate strategy flowchart per client. Agent monitors all portfolios simultaneously and surfaces a prioritized morning alert dashboard. | Manages 3–5x more clients without adding junior staff. Competitive edge over firms using quarterly manual reviews. |
| **Family Office** | Uses the agent to monitor a diversified multi-asset portfolio across stocks, bonds, real estate funds, and crypto with a single unified strategy layer. | Institutional-grade monitoring at a fraction of the cost of building an in-house quant team. |
| **Retail Investor (Active)** | Builds their strategy once in the visual builder. Agent executes it consistently — without emotional deviation — while they are at work or asleep. | Removes the #1 retail investing failure: abandoning a good strategy due to emotional decisions under market pressure. |
| **Crypto Trader** | Sets DCA rules, take-profit nodes, and stop-loss triggers. Agent runs 24/7 since crypto markets never close — including 3am pumps and crashes. | Full market coverage without needing to be awake. No missed opportunities, no panic sells while sleeping. |

### 5.3 — The Big Picture: Democratizing Institutional Finance

> *"The tools hedge funds use — systematic strategies, 24/7 monitoring, automated execution, news analysis, risk management — have historically only been available to people with millions to invest and entire teams to operate them. StrategyFlow makes all of that available to anyone with a strategy and an internet connection."*

Think of it this way: imagine if every person could have their own Bloomberg terminal, their own quant analyst, and their own portfolio manager — all inside one app, all running on their personal strategy, all autonomous. That is the final goal.

| Previously Only For | StrategyFlow Delivers To | At a Fraction of the Cost |
|---|---|---|
| Hedge funds & institutions | Every individual investor | $29–$499/month vs. $500k+/year for a team |
| 24/7 market monitoring | Retail investors with a strategy | Starter: $29/month |
| Systematic strategy execution | Active traders & day traders | Pro: $99/month |
| Real-time news analysis | Independent wealth managers | Wealth Mgr: $499/month |
| Automated trade execution | Crypto investors (24/7 markets) | — |
| Portfolio risk management | Family offices without quant teams | — |

---

## 6. Existing Platform — What's Already Built

> **This section documents the current state of the codebase** to serve as the baseline for all future development. Components will either migrate to Node.js or remain as the Python compute service.

### 6.1 — Frontend (React + TypeScript + ReactFlow) ✅ Keeps as-is

The visual strategy builder is fully operational with:

| Component | Technology | Current State |
|---|---|---|
| **Canvas** | ReactFlow (`@xyflow/react`) | Drag-and-drop node placement, bezier edge connections, zoom/pan, undo/redo |
| **State Management** | Zustand (persisted to localStorage) | Full node/edge CRUD, selection, history stack (50 entries), import/export JSON |
| **UI Framework** | Shadcn UI + Tailwind CSS | Dark theme, glassmorphism AI chat panel, resizable sidebars |
| **Charts** | Lightweight Charts (TradingView) + Recharts | Equity curves, backtest visualizations |

**10 Node Categories Already Implemented:**

| Category | Examples | Data Type |
|---|---|---|
| **Indicators** (50+) | SMA, EMA, RSI, MACD, Bollinger Bands, Supertrend, Ichimoku, VWAP, ATR, ADX | `number` |
| **Conditions** | Compare, Crossover, Crossunder, Threshold, Range, AND/OR/NOT | `boolean` |
| **Actions** | Order, Close Position, Close All, Stop Loss, Take Profit, Trailing Stop, Notification, Log | `signal` |
| **Environment** | Price, Spread, Previous Candle, Time, Day of Week, Market Open | `number`/`boolean` |
| **Control** | If, If-Else, Repeat, Repeat Until, Wait, Wait Until, Stop | `signal` |
| **Math** | Add, Subtract, Multiply, Divide, Number literal, Advanced Math | `number` |
| **Risk** | Max Drawdown, Daily Loss Limit, Position %, Kelly Criterion, Scale In/Out | `number` |
| **Variables** | Set Variable, Get Variable, Change Variable, Define/Call Function, Return | `any` |
| **Trade Info** | Entry Price, Position Size, PnL, Trade Duration | `number` |
| **LLM** | Sentiment Analysis, Regime Detection, NL Strategy Rules, Parameter Tuning, Custom Code | `any` |

**Connection System:**
- Type-validated edges with color coding: Number (purple), Boolean (amber), Signal (cyan), Any (pink)
- Automatic handle resolution and cycle detection
- Topological sort for execution ordering

### 6.2 — Backend (Python + FastAPI) — Migration Targets

Each module is tagged with its migration destination:

| Module | File(s) | Purpose | Migration |
|---|---|---|---|
| **API Server** | `main.py` | FastAPI app with all routers | → **Node.js** (Express/Fastify) |
| **Strategy Flow Router** | `routers/strategy_flow.py`, `strategy_flow/router.py` | Generate, validate, compile, backtest, live-trade endpoints | → **Node.js** (API layer) |
| **Flow Compiler** | `flow/compiler.py` | Graph→AST→topological sort→type-checked compilation | → **Node.js** (rewrite in TypeScript) |
| **Flow Runtime** | `flow/runtime.py` | `FlowInterpreter` evaluates nodes bar-by-bar with indicator registry, portfolio state tracking, order intents | → **Split**: orchestration logic in Node.js, indicator computation calls to Python |
| **AI Generator** | `strategy_flow/ai_generator.py` | LLM-powered natural language → node+edge generation | → **Node.js** (LLM APIs are language-agnostic) |
| **Validator** | `strategy_flow/validator.py` | Auto-fix pipeline for generated strategies | → **Node.js** (pure logic) |
| **Backtrader Engine** | `strategy_flow/backtrader_engine.py` | Full backtesting with equity curves, trade logs, metrics | 🐍 **Stays Python** |
| **Live Executor** | `strategy_flow/live_executor.py` | Real-time strategy execution | → **Node.js** (I/O-heavy, broker API calls) |
| **Tool Calling** | `strategy_flow/tool_calling.py` | Function-calling interface for LLM tools | → **Node.js** |
| **ADK Agents** | `adk_agents/` | Google ADK agents: trading agent, developer agent, exploratory agent | 🐍 **Stays Python** (Google ADK is Python SDK) |
| **Strategy Compiler** | `strategy_compiler.py` | Blockly→Python code compilation (legacy system) | 🐍 **Stays Python** (generates Python code) |
| **AST Parser** | `ast_parser.py` | Advanced strategy parsing | 🐍 **Stays Python** |
| **Backtesting** | `backtest_engine.py`, `backtest_runner.py`, `backtest_service.py` | backtesting.py engine | 🐍 **Stays Python** |
| **Market Data** | `data_service.py`, `market_data_scheduler.py`, `market_screener.py` | Data ingestion, caching, scheduling | → **Split**: scheduling/caching in Node.js, pandas processing stays Python |
| **Brokers** | `ig_client.py`, `nordnet_client.py`, `broker_capabilities.py` | IG Markets, Nordnet integration | → **Node.js** (I/O-bound API calls) |
| **Risk** | `risk_controls.py` | Position sizing, guardrails | → **Node.js** (pure math/logic) |
| **RAG** | `rag_system.py`, `vector_rag.py` | Vector-based strategy block retrieval | 🐍 **Stays Python** (ChromaDB) |
| **LLM** | `llm_service.py`, `llm_logger.py` | Multi-provider LLM orchestration with logging | → **Node.js** (LLM APIs work in any language; or call Python for ADK-specific agents) |

### 6.3 — Data Layer

| Component | Technology | Migration |
|---|---|---|
| **Primary DB** | SQLite (SQLAlchemy ORM) — market data, strategies, trade history | → **PostgreSQL** (shared between Node.js and Python via Prisma / Knex + SQLAlchemy) |
| **Vector Store** | ChromaDB — strategy block retrieval for RAG | 🐍 **Stays Python** |
| **Caching** | In-memory + file-based caching (`cache_service.py`) | → **Redis** (shared cache accessible by both Node.js and Python) |

### 6.4 — Currently Supported Broker Integrations

- **IG Markets** — Live trading (CFDs, spread betting)
- **Nordnet** — Nordic markets

---

## 7. Feature Requirements

**Priority Legend:** P0 = Must Have (MVP) | P1 = Should Have | P2 = Nice to Have  
**Effort:** S = Small | M = Medium | L = Large | XL = Extra Large

---

### 7.1 — Autonomous Heartbeat Engine (OpenClaw-Inspired)

#### Background Agent Daemon (Heartbeat Loop) `P0` `L`

*Inspired by OpenClaw's heartbeat architecture.* A persistent background process that wakes the agent at configurable intervals, independent of the UI. The agent runs continuously whether the user is logged in or not.

**Implementation (Node.js + BullMQ — exactly like n8n):**
- **BullMQ + Redis** as the job queue and scheduler — the same stack n8n uses for workflow execution
- Configurable polling intervals (e.g., every 5 mins, on market open/close, on trigger events)
- Per-user agent instances that load the user's active strategy flowchart on each heartbeat cycle
- **Cheap pre-check pattern (OpenClaw-style):** Before invoking the LLM (via Python compute service), the Node.js orchestrator performs lightweight data checks (price thresholds, volume spikes, news keyword matches). Only escalate to Python AI evaluation if a pre-check fires — this controls LLM costs dramatically.
- **HEARTBEAT_OK suppression:** If no conditions are met, the cycle completes silently (no user notification, no LLM invocation). Agent only speaks when something matters.
- Heartbeat health monitoring with auto-restart on failure (BullMQ built-in retries + exponential backoff)
- Agent state persistence between heartbeat cycles via PostgreSQL
- **BullMQ Dashboard** (Bull Board) for monitoring job queues, failed jobs, and retry status

#### Event-Driven Triggers (n8n-Inspired) `P1` `L`

*Inspired by n8n's webhook trigger nodes.* In addition to polling, certain events should fire the workflow instantly — not on the next heartbeat cycle.

- **Webhook Trigger Nodes:** A new node type in the visual builder (`trigger` category). Users connect a webhook URL from TradingView alerts, or external services, which fires the workflow immediately.
- **Internal Event Bus:** Price alert thresholds, broker fill notifications, and news service callbacks trigger instant workflow evaluation via Redis pub/sub, managed by the Node.js orchestrator.
- Express/Fastify webhook endpoints per strategy, with HMAC signature verification for security.
- WebSocket push to frontend for real-time execution status updates (Socket.io or native WS).

---

### 7.2 — Strategy Flowchart Execution Engine

#### Node-to-Logic Compiler (Rewrite in TypeScript) `P0` `XL`

The existing flow compiler (`flow/compiler.py`) converts the visual flowchart into a machine-executable decision tree. The `FlowInterpreter` (`flow/runtime.py`) evaluates nodes via topological sort. **This will be rewritten in TypeScript** for the Node.js orchestrator, with computation-heavy nodes delegating to the Python service.

- **n8n-style JSON Data Passing:** Each node outputs a structured JSON payload that the next node consumes. The Node.js orchestrator manages data flow between nodes. When a node requires Python computation (indicators, backtesting, AI), the orchestrator sends the JSON payload to the Python service and receives the result.
- **Execution Context Object:** Each workflow run creates an `ExecutionRun` with per-node inputs/outputs, timestamps, and decisions — enabling the Execution History viewer (see §7.5).
- **TypeScript shared types:** The flow compiler and frontend share TypeScript type definitions (node types, edge types, data schemas), eliminating the current type duplication between Python and TypeScript.
- Branch probability scoring — agent can rank which branch paths are closest to triggering
- Strategy simulation / backtesting mode — orchestrator sends compiled strategy to Python backtest service

#### Credential Vault (n8n-Inspired) `P1` `M`

*Inspired by n8n's credential management.* Users securely input their API keys (broker keys, Twilio, OpenAI, etc.) once into a central vault. Nodes reference these credentials by alias without exposing raw keys in the strategy graph or logs.

- Encrypted at rest (AES-256) in PostgreSQL, managed by the Node.js API
- Referenced by alias in node configuration (e.g., `{{credentials.alpaca}}`)
- Scoped per-user with access audit logging
- UI: Dedicated "Credentials" page in settings, similar to n8n's credential editor

---

### 7.3 — Market Data & Intelligence

#### Multi-Source Data Ingestion (Extend Existing) `P0` `L`

The existing Python `data_service.py`, `market_data_scheduler.py`, and `market_screener.py` provide the computation foundation. **The Node.js orchestrator handles scheduling and caching, while Python processes the raw data.**

- Real-time price, volume, and order book data via Polygon.io or Alpaca Markets API — fetched by Node.js, processed by Python when pandas/numpy is needed
- Technical indicator calculation delegated to the Python compute service (TA-Lib, pandas, numpy — 50+ indicators already implemented)
- Earnings calendar and economic event schedule awareness
- Options flow and unusual activity monitoring
- Crypto on-chain data integration (Glassnode, Santiment)

#### News & Sentiment Analysis `P1` `L`

The agent autonomously reads and interprets financial news, social sentiment, and regulatory announcements — then maps findings to the user's portfolio and active strategy nodes. **Node.js fetches the data; Python's ADK agents and LLM service analyze it.**

- Real-time news ingestion via NewsAPI, or RSS aggregators (Node.js fetcher)
- SEC EDGAR filings monitoring (10-K, 10-Q, 8-K event-driven alerts)
- Social sentiment aggregation: Reddit (WallStreetBets), Twitter/X FinTwit, StockTwits
- **LLM-powered news-to-portfolio impact analysis** — "Does this news affect my positions?" — routed from Node.js orchestrator to Python ADK agent infrastructure
- Sentiment scoring with confidence levels fed into condition nodes as inputs

---

### 7.4 — Proactive Multi-Channel Notifications

#### Outbound Agent Communications `P0` `M`

When the agent identifies an opportunity or risk that meets the user's defined thresholds, it initiates contact — the user does not need to check the app. The agent reaches out. **All notification dispatch happens in Node.js** (I/O-bound, perfect for Node's event loop).

- **Telegram and Slack** bots via their native APIs (easiest to implement, no per-message cost) — highest priority
- WhatsApp and SMS alerts via Twilio API with contextual, plain-English explanations
- Voice call capability for critical alerts (e.g., major drawdown, margin call risk)
- Push notifications via Firebase for mobile app users
- Email summaries for non-urgent periodic reports (daily/weekly digest)
- Alert includes: what triggered, why it matters, what action the agent recommends or took
- **Human-in-the-Loop Node (n8n-Inspired):** A specialized node type that pauses workflow execution until the user clicks "Approve" or "Reject" via an interactive message delivered through any channel. The Node.js orchestrator holds state in Redis until the user responds via webhook callback.

---

### 7.5 — Execution History & Visual Debugging (n8n-Inspired) `P1` `L`

*Directly inspired by n8n's execution history.* This is one of n8n's most powerful features — the ability to click on any past workflow execution and see exactly what data entered and exited each node.

- **Execution Log:** Every workflow run (heartbeat cycle or event trigger) creates an `ExecutionRun` record stored in PostgreSQL by the Node.js orchestrator with:
  - Execution ID, timestamp, trigger type, duration, status (success/error/skipped)
  - Per-node data snapshots: the JSON input, JSON output, evaluation result, and any errors
  - Which nodes were delegated to Python and their response times
- **Visual Execution Viewer (Frontend):** Users can browse past executions, click one, and see the strategy canvas highlighted with:
  - Green nodes = executed successfully
  - Red nodes = errored
  - Gray nodes = skipped (condition not met)
  - Blue nodes = delegated to Python compute service
  - Data preview on hover — shows exactly what JSON flowed through each connection
- **Replay Mode:** Re-run a past execution with different parameters for debugging
- API endpoint: `GET /api/strategy-flow/executions` and `GET /api/strategy-flow/executions/{id}`

---

### 7.6 — Autonomous Trade Execution

#### Brokerage API Integration (Extend Existing) `P1` `XL`

The existing `ig_client.py` and `nordnet_client.py` provide the integration pattern. **Broker API clients will be rewritten in Node.js** (I/O-bound REST/WebSocket calls are Node.js's strength). Python only involved if trade decisions require AI analysis.

- Alpaca Markets integration for stocks and crypto (free paper trading for testing)
- Interactive Brokers (IBKR) integration for professional users
- Position sizing logic — agent respects max allocation per trade defined in strategy nodes
- Guardrail nodes: max daily spend limits, drawdown stop thresholds, position concentration caps (existing risk node types: `maxDrawdown`, `dailyLossLimit`, `positionPercent`, `kellyCriterion`)
- Paper trading mode — full simulation before live funds are committed
- Full audit log of every agent action with rationale for compliance and trust

---

### 7.7 — Portfolio Awareness

#### Portfolio Context Engine `P0` `M`

All agent analysis and decisions are contextualized against the user's real current portfolio. The agent never makes generic recommendations — every signal is filtered through the lens of what the user actually holds.

- Real-time portfolio sync from connected brokerage accounts (Node.js fetches, stores in PostgreSQL)
- Position tracking: cost basis, unrealized P&L, sector exposure, concentration risk
- Correlation analysis — agent understands how holdings relate to each other (Python compute for matrix math)
- Tax-awareness layer: tracks short vs. long-term gains to inform sell decisions
- Portfolio health score updated on each heartbeat cycle

---

## 8. System Architecture

### 8.1 — The Split: Node.js Orchestrator + Python Compute Service

> **Architecture Philosophy:** Node.js is the "nervous system" — it handles everything I/O-bound: API requests, webhook ingestion, job scheduling, real-time events, notification dispatch, and workflow orchestration. Python is the "brain" — it handles everything compute-heavy: backtesting, indicator math, AI/ML agents, RAG retrieval, and data analysis. They communicate via REST/gRPC.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + ReactFlow)                │
│  Visual Strategy Builder · Dashboard · Execution Viewer            │
│  Zustand · Shadcn UI · Tailwind · WebSocket client                 │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP / WebSocket
┌──────────────────────────▼──────────────────────────────────────────┐
│                    NODE.JS ORCHESTRATOR                             │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐    │
│  │ Express /   │  │ BullMQ       │  │ Flow Engine (TS)        │    │
│  │ Fastify API │  │ Job Queue    │  │ Compiler + Interpreter  │    │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘    │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐    │
│  │ Webhook     │  │ Notification │  │ Credential Vault        │    │
│  │ Handler     │  │ Dispatcher   │  │ (AES-256 encrypted)     │    │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘    │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐    │
│  │ WebSocket   │  │ Auth / User  │  │ Execution Logger        │    │
│  │ Server      │  │ Management   │  │ (per-node JSON logs)    │    │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Broker Clients: Alpaca · IG · IBKR · Nordnet               │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ REST / gRPC
┌──────────────────────────▼──────────────────────────────────────────┐
│                    PYTHON COMPUTE SERVICE (FastAPI)                 │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐    │
│  │ Backtest    │  │ Indicator    │  │ ADK AI Agents           │    │
│  │ Engines     │  │ Calculator   │  │ (Trading · Research ·   │    │
│  │ (backtrader │  │ (TA-Lib,     │  │  Developer)             │    │
│  │  backtesting│  │  pandas,     │  │                         │    │
│  │  .py, Naut.)│  │  numpy)      │  │                         │    │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘    │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐    │
│  │ RAG /       │  │ Data         │  │ Strategy Code           │    │
│  │ Vector      │  │ Processing   │  │ Generation              │    │
│  │ Search      │  │ (pandas)     │  │ (Python output)         │    │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                       SHARED DATA LAYER                            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ PostgreSQL   │  │ Redis        │  │ ChromaDB                │   │
│  │ (users,      │  │ (BullMQ      │  │ (vector store,          │   │
│  │  strategies, │  │  broker,     │  │  agent memory)          │   │
│  │  executions, │  │  cache,      │  │                         │   │
│  │  portfolios) │  │  pub/sub)    │  │                         │   │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 — Why This Split Works

| Responsibility | Node.js Orchestrator | Python Compute Service |
|---|---|---|
| **API Server** | Express/Fastify — handles all HTTP/WS traffic | FastAPI — internal-only, receives computation requests |
| **Workflow Scheduling** | BullMQ — repeatable jobs, heartbeat intervals, retries | — |
| **Webhook Ingestion** | Express routes — instant, low-latency | — |
| **Flow Compiler** | TypeScript — topological sort, type checking, shared types with frontend | — |
| **Flow Interpreter** | TypeScript — orchestrates node execution, manages JSON data passing | Delegates to Python for indicator computation, AI analysis |
| **Broker API Calls** | Node.js HTTP clients — I/O-bound, non-blocking | — |
| **Notifications** | Telegram Bot, Slack, Twilio, SendGrid — all I/O | — |
| **Real-time Updates** | WebSocket/Socket.io — push execution status | — |
| **Backtesting** | — | backtrader, backtesting.py, NautilusTrader (Python-only libraries) |
| **Indicator Math** | — | TA-Lib, pandas, numpy (50+ indicators already implemented) |
| **AI Agents** | — | Google ADK (Python SDK), LLM orchestration |
| **RAG Retrieval** | — | ChromaDB, vector_rag.py |
| **Data Processing** | — | pandas DataFrames, market data transformation |
| **Code Generation** | — | Generates Python backtest code from compiled strategies |

### 8.3 — Node.js ↔ Python Communication

| Pattern | When Used | Protocol |
|---|---|---|
| **Synchronous REST** | Indicator computation, strategy validation, LLM analysis | HTTP POST to FastAPI (< 100ms for indicators, < 10s for LLM) |
| **gRPC** (optional, Phase 3+) | High-frequency indicator calls during live trading | Protocol Buffers — lower latency than REST |
| **Async Job (via Redis)** | Backtesting (can take 30s+), batch data processing | Node.js enqueues job → Python worker picks up → result stored in Redis/PostgreSQL → Node.js notified via pub/sub |

### 8.4 — Operational Modes

| Mode | Description | Best For |
|---|---|---|
| **Advisory Mode** | Agent monitors and alerts but never executes. User approves all actions via reply or in-app. | New users, risk-averse investors |
| **Human-in-the-Loop** | Agent executes automatically but sends a pre-action notification with a cancel window (e.g., 2 min to cancel). Uses the HITL node. | Active traders who want speed but oversight |
| **Fully Autonomous** | Agent executes all trades defined in the strategy flowchart without confirmation. Full guardrails apply. | Experienced users with backtested strategies |
| **Simulation Mode** | Agent runs all logic against live data but makes no real trades or alerts. Used for strategy testing. | Strategy development and backtesting |

---

## 9. New Node Types (n8n-Inspired Additions)

The existing 10 node categories are extended with a new `trigger` category and enhanced `integration` nodes:

### 9.1 — Trigger Nodes (New Category)

| Node Type | Description | Trigger Type |
|---|---|---|
| **Heartbeat Trigger** | Fires workflow on a configurable schedule (every N minutes, at market open/close, daily at a specific time). Powered by BullMQ repeatable jobs. | Polling (OpenClaw) |
| **Webhook Trigger** | Fires instantly when an external HTTP POST is received (TradingView alert, custom service). Express/Fastify route. | Event (n8n) |
| **Price Alert Trigger** | Fires when a specific asset crosses a price threshold. Implemented as a cheap pre-check in Node.js, not requiring LLM/Python. | Event |
| **News Trigger** | Fires when a keyword or topic is detected in financial news feeds. | Event |
| **Broker Event Trigger** | Fires on broker events: order filled, margin call, position liquidated. | Event |

### 9.2 — Integration Nodes (n8n-Inspired)

| Node Type | Description | Runs In |
|---|---|---|
| **Telegram Node** | Send message / receive reply via Telegram bot | Node.js |
| **Slack Node** | Post message to Slack channel | Node.js |
| **Email Node** | Send email via SendGrid/SMTP | Node.js |
| **SMS Node** | Send SMS via Twilio | Node.js |
| **HTTP Request Node** | Generic HTTP request to any API (n8n's most versatile node) | Node.js |
| **Database Query Node** | Run a SQL query against the strategy database | Node.js |
| **Code Node (Python)** | Custom Python code execution within the workflow — sent to Python service | Python |
| **Code Node (JavaScript)** | Custom JavaScript code execution within the workflow — runs in Node.js sandbox | Node.js |
| **AI Analysis Node** | Send data to ADK agent for AI-powered analysis | Python |

---

## 10. Key Use Cases & User Stories

### 10.1 The Sleep-Well Risk Protector

> *"As a retail investor, I want my agent to automatically protect my portfolio from major losses overnight so that I wake up knowing my risk parameters were respected while I slept."*

**Strategy Flowchart Logic:** Monitor tech holdings → IF NASDAQ drops >3% overnight OR negative regulatory AI news detected → liquidate 30% of tech holdings to cash → send WhatsApp message with action summary.

**Agent Action at 3:00 AM:** BullMQ heartbeat job triggers. Node.js orchestrator checks NASDAQ futures price (cheap pre-check) — down 3.2%. Pre-check fires → sends news context to Python ADK agent. Agent confirms EU AI regulation announcement. Condition nodes evaluate to TRUE. Node.js broker client executes partial liquidation via Alpaca API. Telegram bot sends: *"Emergency protocol triggered. Moved $10,200 to cash to protect your portfolio. EU AI regulation news triggered your risk rule."*

---

### 10.2 The Alpha Hunter

> *"As an active trader, I want my agent to scan the entire market 24/7 for setups that match my exact criteria so that I never miss a trade because I wasn't watching."*

**Strategy Flowchart Logic:** Scan all S&P 500 tickers → IF RSI < 35 AND volume > 2x 20-day average AND sentiment score > 0.7 positive AND no negative earnings in last 30 days → alert user with pre-filled trade recommendation.

**Agent Action:** BullMQ heartbeat triggers market scan. Node.js orchestrator fetches prices for all tickers (I/O burst — Node.js excels here). Tickers crossing basic thresholds are batch-sent to Python for RSI/volume indicator computation. Python returns results. Node.js evaluates conditions, finds NVDA matching all criteria. Sends alert: *"NVDA matches your breakout setup. RSI: 32. Volume: 3.1x average. Sentiment: 0.82 positive. No negative news. Recommend $2,000 position. Reply YES to execute."*

---

### 10.3 The Wealth Manager Multiplier

> *"As an RIA, I want to monitor all 40 of my client portfolios simultaneously so that I can spot risks and opportunities across my entire book of business without adding headcount."*

**Agent Action:** Each client has a unique strategy flowchart. BullMQ runs separate heartbeat jobs per client portfolio (concurrency-limited to avoid broker rate limits). The advisor receives a morning digest: *"3 portfolios require attention today: Client A — earnings risk on 2 positions. Client B — rebalancing threshold triggered. Client C — stop-loss approaching on TSLA."* Advisor reviews and approves recommended actions from a single dashboard.

---

## 11. Product Roadmap

| Phase | Name | Deliverables | Timeline |
|---|---|---|---|
| **1** | Node.js Foundation & Migration | Scaffold Node.js orchestrator (Express/Fastify + BullMQ + Redis). Rewrite flow compiler in TypeScript. Set up PostgreSQL (migrate from SQLite). Keep Python FastAPI as internal compute service. Basic heartbeat scheduler. Frontend connects to new Node.js API. | Weeks 1–8 |
| **2** | Workflow Engine & Triggers | TypeScript flow interpreter with n8n-style JSON data passing. Trigger node category (Heartbeat, Webhook, Price Alert). Execution History backend + visual debugging viewer. Credential Vault. Telegram notifications. Advisory mode. | Weeks 9–16 |
| **3** | Intelligence & Execution | Wire Python compute service for indicators, backtesting, AI agents. News ingestion + LLM sentiment analysis. Paper trading with Alpaca sandbox. Live trade execution with guardrails. Human-in-the-Loop node. Multi-channel notifications (Telegram, Slack, SMS, Email). | Weeks 17–26 |
| **4** | Scale & Monetization | Fully autonomous mode. Multi-portfolio support (wealth manager persona). Walk-forward & Monte Carlo (Python compute). Strategy marketplace. WebSocket real-time updates. Mobile-responsive dashboard. User auth & subscription tiers. | Weeks 27–36 |

---

## 12. Migration Strategy: Python → Node.js Primary

### Phase 1: Parallel Operation (Weeks 1–4)

1. **Scaffold Node.js project** alongside existing Python backend:
   ```
   backend/          ← Existing Python (FastAPI) — becomes internal compute service
   orchestrator/     ← New Node.js project (Express/Fastify + TypeScript)
   src/              ← Existing React frontend (unchanged)
   ```
2. **Shared database:** Both Node.js and Python connect to the same PostgreSQL instance.
3. **Shared Redis:** BullMQ (Node.js) and general caching.
4. **Frontend migration:** Point React app's API calls from Python FastAPI to Node.js Express API, one endpoint at a time.

### Phase 2: Compiler & Interpreter Migration (Weeks 3–8)

1. **Rewrite `flow/compiler.py`** in TypeScript. Share types with frontend type definitions (already in `types.ts`).
2. **Rewrite `flow/runtime.py`** orchestration logic in TypeScript. The `FlowInterpreter`'s node evaluation loop moves to Node.js, but `IndicatorRegistry.compute()` calls are proxied to the Python service.
3. **Shared contract:** Define a REST API contract between Node.js and Python:
   - `POST /compute/indicators` — given price data + indicator params, return computed values
   - `POST /compute/backtest` — given compiled strategy + data range, return backtest results
   - `POST /compute/ai-analyze` — given context, return AI agent analysis
   - `POST /compute/generate-strategy` — given natural language prompt, return nodes+edges (if ADK-dependent)

### Phase 3: Full Cutover (Weeks 6–10)

1. **Python FastAPI** strips down to only the compute endpoints (no more user-facing API routes).
2. **Node.js** handles 100% of external traffic.
3. **Docker Compose** runs: React (Nginx), Node.js Orchestrator, Python Compute Service, PostgreSQL, Redis, ChromaDB.

---

## 13. Non-Functional Requirements

### 13.1 Security & Compliance

- All brokerage API keys encrypted at rest using AES-256. Never stored in plaintext. Managed via Credential Vault in Node.js.
- OAuth 2.0 for brokerage account connections — never store user credentials directly.
- Full audit log of every agent decision and action for regulatory compliance.
- Users must explicitly grant execution permissions — default is advisory mode only.
- SEC/FINRA regulatory disclosure: platform is not a registered investment advisor. All autonomous actions are user-configured rules, not financial advice.

### 13.2 Reliability & Performance

- Agent heartbeat uptime target: 99.5% (Phase 1), 99.9% (Phase 3+).
- Signal-to-alert latency: < 60 seconds from market event to user notification.
- Graceful degradation: if the Python compute service is unavailable, Node.js orchestrator caches the request and retries. Agent logs the gap and continues with available data.
- Auto-restart on agent failure with exponential backoff (BullMQ built-in) — user notified if agent is offline for > 15 minutes.
- Node.js horizontal scaling: add orchestrator instances behind a load balancer. BullMQ workers scale independently.

### 13.3 Guardrails (Non-Negotiable)

- Maximum single-trade value cap (user-defined, enforced by Node.js middleware — cannot be overridden by agent).
- Maximum daily spend limit across all autonomous actions.
- Portfolio concentration limit: agent cannot allocate more than X% to any single position.
- Market circuit breaker: agent pauses all autonomous actions during circuit breaker events.
- Emergency kill switch: user can halt all agent activity instantly via app, Telegram reply (`/stop`), or web dashboard.

### 13.4 Deployment

- **Docker Compose** for all services:
  - `frontend` — React app served via Nginx
  - `orchestrator` — Node.js (Express/Fastify + BullMQ workers)
  - `compute` — Python (FastAPI, internal-only, not exposed to public)
  - `redis` — BullMQ broker + cache + pub/sub
  - `postgres` — Primary database
  - `chromadb` — Vector store for RAG
- Environment-based configuration (`.env` files — already in use).
- Health check endpoints on both Node.js and Python services.
- Logging: structured JSON logs from both services, shipped to optional log aggregation.

---

## 14. Database Schema (PostgreSQL)

### New Tables Required

| Table | Managed By | Purpose |
|---|---|---|
| `users` | Node.js | User accounts, preferences, subscription tier |
| `strategies` | Node.js | Strategy metadata (name, description, active flag) |
| `strategy_versions` | Node.js | Version history of node/edge JSON snapshots |
| `credentials` | Node.js | Encrypted API keys (AES-256), referenced by alias |
| `execution_runs` | Node.js | Workflow execution log (trigger, duration, status) |
| `execution_node_logs` | Node.js | Per-node JSON input/output snapshots |
| `agent_configs` | Node.js | Heartbeat intervals, operational mode, active hours |
| `portfolios` | Node.js | Linked brokerage accounts and synced positions |
| `notifications` | Node.js | Notification history and delivery status |
| `market_data` | Python | OHLCV data cache, scheduled fetches |
| `backtest_results` | Python | Backtest metrics, equity curves, trade logs |

---

## 15. Monetization Strategy

| Tier | Features | Price | Target User |
|---|---|---|---|
| **Free** | Visual strategy builder only. No agent. No autonomous actions. Up to 3 strategies. Backtest with limited data range. | Free | Hobbyist, evaluation |
| **Starter** | Agent monitoring + alerts. Advisory mode only. 1 connected portfolio. 5 strategies. Telegram/email notifications. | $29 / month | Retail investor |
| **Pro** | Full autonomous execution. Unlimited strategies. Multi-asset. Webhook triggers. Execution history. Multi-channel alerts. | $99 / month | Active trader |
| **Wealth Manager** | Multi-client portfolios. Team access. White-label option. Compliance exports. Priority support. | $499 / month | RIA / family office |

---

## 16. Open Questions & Risks

| # | Risk / Open Question | Mitigation / Decision Needed |
|---|---|---|
| 1 | Regulatory risk: does autonomous trade execution require the platform to register as a broker-dealer or RIA? | Legal review required. Default advisory mode only until legal structure is confirmed. Consider "rules engine" framing, not "investment advice." |
| 2 | LLM hallucination in financial decisions — agent acts on incorrect news interpretation. | Confidence thresholds required before action. Human-in-the-loop default. Dual-source news verification before triggering critical actions. OpenClaw's cheap-check-first pattern reduces unnecessary LLM invocations. |
| 3 | Brokerage API rate limits may prevent real-time execution at scale. | BullMQ's concurrency controls and rate limiting. Per-broker rate limit configs in the Node.js orchestrator. |
| 4 | User trust: will users actually grant execution permissions to an AI agent? | Start with advisory mode. Build trust with accuracy track record. Show simulation results before live deployment. Transparent execution history and audit log are essential. |
| 5 | Data source cost at scale: Polygon, Bloomberg, and Twitter APIs are expensive. | Start with free tiers (Alpaca, yfinance — already integrated, Reddit). Gate premium data sources behind paid tiers. Model unit economics at 1k, 10k, 100k users. |
| 6 | Node.js ↔ Python latency for real-time indicator computation. | For heartbeat (every 5 min) latency is negligible. For live trading, consider: (a) caching frequently used indicators in Redis, (b) gRPC instead of REST for sub-10ms calls, (c) moving simple indicators (SMA, EMA) to TypeScript to avoid round-trip entirely. |
| 7 | Migration effort: rewriting compiler and runtime in TypeScript. | The flow compiler is ~240 lines and the runtime interpreter is ~435 lines — not massive. TypeScript rewrite is a one-time investment that pays dividends in shared types with frontend and long-term maintainability. |
| 8 | Two deployment targets creates operational complexity. | Docker Compose handles this cleanly. Both services share PostgreSQL and Redis. Health checks and structured logging make monitoring straightforward. |

---

*StrategyFlow AI Agent | PRD v3.0 | Confidential*  
*Questions? Reach your product team to schedule a strategy review session.*
