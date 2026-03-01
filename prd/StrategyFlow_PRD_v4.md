# StrategyFlow AI Agent — Product Requirements Document

**Version:** 4.0 | **Status:** Active Development | **Priority:** Critical | **Date:** February 2026  
*Updates in v4.0: Reflects the actual built state of the codebase. Consolidates architecture decisions from v2/v3. Adds detailed API contracts, data-flow specifications, node execution semantics, and a refined roadmap anchored to what exists today.*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision & Goals](#3-product-vision--goals)
4. [Target Users & Personas](#4-target-users--personas)
5. [Market Disruption Map](#5-market-disruption-map)
6. [Platform Overview — What's Built](#6-platform-overview--whats-built)
7. [System Architecture](#7-system-architecture)
8. [Node System — The Visual Programming Language](#8-node-system--the-visual-programming-language)
9. [Feature Requirements](#9-feature-requirements)
10. [Key Use Cases & User Stories](#10-key-use-cases--user-stories)
11. [API Contracts & Data Flow](#11-api-contracts--data-flow)
12. [Database Schema](#12-database-schema)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Product Roadmap](#14-product-roadmap)
15. [Monetization Strategy](#15-monetization-strategy)
16. [Open Questions & Risks](#16-open-questions--risks)

---

## 1. Executive Summary

StrategyFlow AI Agent transforms an existing visual node-and-edge strategy builder into a **fully autonomous, 24/7 financial AI agent**. Rather than a passive flowchart tool that users reference manually, the platform acts as a **proactive AI coworker** — monitoring markets, reading financial news and reports, executing trades, managing portfolio risk, and alerting users in real time.

The product democratizes capabilities historically reserved for institutional hedge funds — systematic strategy execution, around-the-clock market surveillance, news-aware portfolio management, and automated trade execution — making them accessible to any individual investor, active trader, or wealth manager.

### Core Innovation

The user's flowchart is not a diagram — it is a **living, executable workflow**. A decision engine that an AI agent traverses in real time as market conditions evolve. The platform draws architectural inspiration from:

- **n8n**: Event-driven trigger nodes, webhook-based instant execution, structured JSON data passing between nodes, execution history with per-node data inspection, credential vault, BullMQ job queuing, and Node.js-based orchestration.
- **OpenClaw**: Heartbeat daemon architecture — a persistent background process that wakes the agent at configurable intervals, performs cheap pre-checks before invoking the LLM, and suppresses non-events to minimize cost and noise.

### One-Line Pitch

> *"Your personal AI hedge fund team — one that never sleeps, reads everything, knows your strategy, and acts the moment an opportunity or risk appears."*

---

## 2. Problem Statement

### 2.1 The Gap in Existing Tools

Current financial tools fall into unsatisfying categories:

| Category | Examples | Limitation |
|---|---|---|
| **Passive dashboards** | TradingView, Yahoo Finance | Require constant human monitoring; no autonomous action |
| **Robo-advisors** | Betterment, Wealthfront | Generic, static rebalancing; no custom logic, no news-awareness |
| **Trading bots** | 3Commas, Pionex | React only to price action; cannot interpret context (CEO resignation vs. correction) |
| **Algorithmic platforms** | QuantConnect, Zipline | Require deep programming skills; inaccessible to most investors |
| **Alert services** | TradingView alerts, Trade Ideas | Send alerts but never act; still require human execution |

### 2.2 The Core Pain

Users build sophisticated mental strategies but cannot execute them consistently because:

1. **Markets never sleep** — especially crypto — but humans must.
2. **News breaks at any hour** and requires immediate portfolio assessment.
3. **Emotional decisions override logic** under market pressure — the #1 retail investing failure.
4. **Cognitive overload** — monitoring multiple assets, reading reports, tracking news simultaneously is impossible for one person.
5. **No tool bridges the gap** between strategy definition and autonomous execution without programming.

### 2.3 The Opportunity

There are ~150 million retail investors globally. Fewer than 1% have access to systematic, autonomous strategy execution. The tools that provide this (Bloomberg Terminal, custom quant infrastructure) cost $25,000+/year and require engineering teams. StrategyFlow collapses this to a visual builder and a $29–$499/month subscription.

---

## 3. Product Vision & Goals

### 3.1 Vision Statement

> *"Give every person access to their own AI-powered hedge fund team — one that never sleeps, reads everything, knows their exact strategy and portfolio, and acts on their behalf the moment an opportunity or risk appears — powered by visual, event-driven automation."*

### 3.2 Product Principles

1. **Visual-first** — The flowchart IS the algorithm. No code required.
2. **Trust through transparency** — Every agent decision is logged, inspectable, and replayable.
3. **Progressive autonomy** — Start advisory, graduate to autonomous as trust builds.
4. **Cost-conscious AI** — Cheap pre-checks before expensive LLM calls (OpenClaw pattern).
5. **Context-aware intelligence** — Understand WHY, not just WHAT, before acting.

### 3.3 Success Metrics

| Metric | Target (6 months) | Stretch (12 months) |
|---|---|---|
| Agent Uptime | 99.5% | 99.9% |
| Signal-to-Alert Latency | < 60 seconds | < 10 seconds |
| Strategy Execution Accuracy | 95% match to flowchart logic | 99% match |
| User Retention (90-day) | 40% | 65% |
| Autonomous Actions per User/Month | 50+ | 200+ |
| Strategy Creation Time | < 10 minutes | < 5 minutes |
| False Alert Rate | < 10% | < 3% |

---

## 4. Target Users & Personas

### Persona 1 — The Retail Investor (Primary)

| Attribute | Detail |
|---|---|
| **Background** | Employed full-time. Invests in stocks and ETFs with a long-term strategy. Cannot watch markets during work hours. |
| **Pain Point** | Has a solid strategy on paper but breaks it emotionally when markets move. Misses buying opportunities while at work. |
| **Job To Be Done** | "Execute my strategy consistently without me having to babysit the market." |
| **How They Use StrategyFlow** | Builds a flowchart: *"If quality stock drops 10% with no fundamental news → buy $500."* Receives a Telegram alert when this triggers with option to approve or let the agent auto-execute. |
| **Replaces** | Personal financial advisor ($2,000+/year), robo-advisor limitations |
| **Willingness to Pay** | $29–$99/month |

### Persona 2 — The Active Trader (Primary)

| Attribute | Detail |
|---|---|
| **Background** | Day trader or swing trader monitoring multiple tickers and strategies simultaneously. |
| **Pain Point** | Cannot scan 50 tickers at once, read every earnings report, and track sentiment — cognitive overload. |
| **Job To Be Done** | "Be my second brain — filter out the noise and alert me only when my exact setup is met." |
| **How They Use StrategyFlow** | Builds complex multi-condition nodes: technical triggers (RSI < 30, volume > 2x average), news filters, sector momentum. Agent scans the entire market and alerts with a pre-filled trade recommendation. |
| **Replaces** | Junior analyst, trading alert services (TradingView alerts, Trade Ideas) |
| **Willingness to Pay** | $99/month |

### Persona 3 — The Wealth Manager / RIA (Secondary)

| Attribute | Detail |
|---|---|
| **Background** | Registered Investment Advisor managing 20–100 client portfolios with different risk profiles and strategies. |
| **Pain Point** | Cannot monitor all client portfolios in real time. Quarterly reviews miss time-sensitive opportunities and risks. |
| **Job To Be Done** | "Scale my business by letting AI monitor all client portfolios continuously so I only step in when something important happens." |
| **How They Use StrategyFlow** | Creates a separate strategy flowchart per client. Agent monitors all portfolios simultaneously and surfaces a prioritized alert dashboard. |
| **Replaces** | Associate analysts ($80k+/year salary), manual portfolio review |
| **Willingness to Pay** | $499/month |

### Persona 4 — The Crypto Trader (Secondary)

| Attribute | Detail |
|---|---|
| **Background** | Active crypto investor. Markets never close, creating constant anxiety about missing moves during sleep. |
| **Pain Point** | 3am crashes and pumps happen regularly. No way to manage risk around the clock. |
| **Job To Be Done** | "Protect my portfolio and capture opportunities even when I'm asleep." |
| **How They Use StrategyFlow** | DCA strategy with take-profit and stop-loss rules triggered by on-chain data, fear/greed index, and sentiment. Agent executes autonomously 24/7. |
| **Replaces** | Crypto trading bots (3Commas, Pionex) but with news-awareness and NL strategy definition |
| **Willingness to Pay** | $29–$99/month |

---

## 5. Market Disruption Map

### 5.1 Roles This Tool Replaces (For Retail Users)

| Role Replaced | What They Do (That We Automate) | Our Advantage |
|---|---|---|
| **Hedge Fund Team** | Portfolio manager + quant + risk manager + news analyst. Costs $500k+/year. | Full team in one AI agent. Available at subscription price. |
| **Stockbroker** | Calls with opportunities, executes trades, collects commission. | 24/7 monitoring, zero commission bias. Executes only user-defined rules. |
| **Financial Advisor** | Quarterly portfolio reviews, rebalancing recommendations. | Continuous review every heartbeat cycle — not quarterly. |
| **Quant Trader** | Writes algorithmic code for rules-based strategies. Deep programming required. | No-code visual builder. The flowchart IS the algorithm. |
| **Junior Analyst** | Reads FOMC reports, earnings calls, filings. Synthesizes into memos. | Reads and synthesizes in milliseconds. Never fatigued, never misses a filing. |
| **Robo-Advisor** | Static, generic rebalancing based on risk profile. | Dynamic, news-aware, fully personalized strategy execution. |
| **Static Trading Bots** | React only to price via hard-coded rules. | Interprets context: understands WHY a stock is moving before acting. |

### 5.2 Roles This Tool Augments (For Professionals)

| Professional | How They Use StrategyFlow | Force-Multiplier Effect |
|---|---|---|
| **Independent Trader** | Multi-condition strategy nodes. Agent monitors 50+ tickers. | One trader monitors the whole market. |
| **Wealth Manager** | Separate flowchart per client. Prioritized morning alert dashboard. | Manages 3–5x more clients without adding staff. |
| **Family Office** | Unified strategy layer across stocks, bonds, crypto. | Institutional-grade monitoring at fraction of quant team cost. |
| **Crypto Trader** | DCA rules, take-profit, stop-loss. Agent runs 24/7. | Full market coverage while sleeping. |

### 5.3 The Big Picture

| Previously Only For | StrategyFlow Delivers To | At a Fraction of the Cost |
|---|---|---|
| Hedge funds & institutions | Every individual investor | $29–$499/mo vs. $500k+/yr |
| 24/7 market monitoring | Retail investors with a strategy | Starter: $29/mo |
| Systematic strategy execution | Active traders & day traders | Pro: $99/mo |
| Real-time news analysis | Independent wealth managers | Wealth Mgr: $499/mo |
| Automated trade execution | Crypto investors (24/7 markets) | — |

---

## 6. Platform Overview — What's Built

> This section documents the **current state of the codebase** as of February 2026 to serve as the baseline for all future development.

### 6.1 Frontend (React + TypeScript + ReactFlow) — ✅ Production-Ready

| Component | Technology | Status |
|---|---|---|
| **Strategy Canvas** | ReactFlow (`@xyflow/react`) | ✅ Drag-and-drop, bezier edges, zoom/pan, undo/redo |
| **State Management** | Zustand (persisted localStorage) | ✅ Full CRUD, selection, history stack (50 entries), import/export JSON |
| **UI Framework** | Shadcn UI + Tailwind CSS | ✅ Dark theme, glassmorphism, Framer Motion animations |
| **Charts** | TradingView Lightweight Charts + Recharts | ✅ Equity curves, backtest visualizations |
| **Pages** | 9 pages total | ✅ Dashboard, StrategyFlow, ExecutionHistory, ExecutionDetails, Credentials, AgentConfig, Settings, Login, NotFound |
| **Stores** | 4 Zustand stores | ✅ Auth, Execution, Notification, Preferences |
| **Feature Modules** | strategy-flow (60 files), execution-viewer, notifications | ✅ Fully operational |

### 6.2 Node.js Orchestrator — ✅ Scaffolded & Functional

| Component | Technology | Status |
|---|---|---|
| **API Server** | Express + TypeScript | ✅ 12 route files |
| **Flow Engine** | Custom TypeScript compiler + interpreter | ✅ Topological sort, type checking, JSON data passing |
| **Pre-Check Engine** | OpenClaw-inspired cheap checks | ✅ Lightweight threshold checks before LLM |
| **Job Queue** | BullMQ + Redis | ✅ Heartbeat scheduling, workers |
| **Database** | Prisma ORM → PostgreSQL | ✅ Schema defined |
| **WebSocket** | Socket.io | ✅ Real-time push to frontend |
| **Compute Client** | REST client → Python service | ✅ Indicator, backtest, AI delegation |
| **Broker Clients** | Alpaca, IG scaffolds | ✅ Scaffolded |
| **Notification Service** | Multi-channel dispatcher | ✅ Telegram, Slack, Email, SMS channels scaffolded |
| **Execution Logger** | Per-node JSON logging | ✅ Integrated with execution service |

### 6.3 Python Compute Service (FastAPI) — ✅ Mature

| Module | Status | Notes |
|---|---|---|
| **Backtesting** | ✅ Production | Backtrader, backtesting.py, Nautilus adapters |
| **Indicator Calculator** | ✅ Production | 50+ indicators via TA-Lib, pandas, numpy |
| **Flow Compiler/Runtime** | ✅ Legacy | Original Python implementation — being superseded by TypeScript |
| **AI Generator** | ✅ Functional | LLM-powered NL → node+edge generation |
| **ADK Agents** | ✅ Functional | Google ADK: trading, research, developer agents |
| **RAG/Vector Search** | ✅ Functional | ChromaDB-powered strategy block retrieval |
| **Broker Clients** | ✅ Production | IG Markets, Nordnet |
| **Market Data** | ✅ Production | Data ingestion, scheduling, screening |
| **MCPT Research** | ✅ Functional | Monte Carlo Permutation Test |
| **LLM Service** | ✅ Production | Multi-provider orchestration with logging |
| **Risk Controls** | ✅ Functional | Position sizing, guardrails |

### 6.4 Data Layer

| Component | Technology | Status |
|---|---|---|
| **Primary DB** | PostgreSQL (via Prisma in Node.js, SQLAlchemy in Python) | ✅ Operational (legacy SQLite still present) |
| **Vector Store** | ChromaDB | ✅ Strategy block retrieval for RAG |
| **Cache / Queue** | Redis | ✅ BullMQ broker + general caching |
| **Supabase** | Auth + Postgres | ✅ Integrated (`supabase/` config present) |

### 6.5 Currently Supported Brokers

| Broker | Markets | Status |
|---|---|---|
| **IG Markets** | CFDs, spread betting | ✅ Live trading |
| **Nordnet** | Nordic stock markets | ✅ Live trading |
| **Alpaca** | US stocks, crypto | 🔲 Scaffolded |

---

## 7. System Architecture

### 7.1 The Split: Node.js Orchestrator + Python Compute Service

> **Architecture Philosophy:** Node.js is the "nervous system" — handles all I/O: API requests, webhooks, job scheduling, real-time events, notification dispatch, workflow orchestration. Python is the "brain" — handles all compute: backtesting, indicator math, AI/ML agents, RAG, data analysis. They communicate via REST (and optionally gRPC for high-frequency calls).

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + ReactFlow)                    │
│  Visual Strategy Builder · Dashboard · Execution Viewer             │
│  Zustand · Shadcn UI · Tailwind · Framer Motion · WebSocket        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP / WebSocket
┌──────────────────────────▼──────────────────────────────────────────┐
│                   NODE.JS ORCHESTRATOR (Express + TS)               │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐    │
│  │ Express API │  │ BullMQ       │  │ Flow Engine (TS)        │    │
│  │ (12 routes) │  │ Job Queue    │  │ Compiler + Interpreter  │    │
│  └─────────────┘  └──────────────┘  │ + Pre-Checks            │    │
│                                      └─────────────────────────┘    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐    │
│  │ WebSocket   │  │ Notification │  │ Credential Vault        │    │
│  │ Server      │  │ Dispatcher   │  │ (AES-256)               │    │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘    │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐    │
│  │ Auth Guard  │  │ Execution    │  │ Broker Gateway          │    │
│  │ (Supabase)  │  │ Logger       │  │ Alpaca · IG · Nordnet   │    │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ REST / gRPC
┌──────────────────────────▼──────────────────────────────────────────┐
│                 PYTHON COMPUTE SERVICE (FastAPI)                     │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐    │
│  │ Backtest    │  │ Indicator    │  │ ADK AI Agents           │    │
│  │ Engines     │  │ Calculator   │  │ Trading · Research ·    │    │
│  │ Backtrader  │  │ TA-Lib, np,  │  │ Developer               │    │
│  │ backtesting │  │ pandas       │  └─────────────────────────┘    │
│  │ Nautilus    │  │ (50+ ind.)   │                                  │
│  └─────────────┘  └──────────────┘  ┌─────────────────────────┐    │
│                                      │ RAG · LLM Service ·     │    │
│  ┌─────────────┐  ┌──────────────┐  │ MCPT · Code Gen         │    │
│  │ Data Proc.  │  │ Market Data  │  └─────────────────────────┘    │
│  │ (pandas)    │  │ Service      │                                  │
│  └─────────────┘  └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                      SHARED DATA LAYER                              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ PostgreSQL   │  │ Redis        │  │ ChromaDB                │   │
│  │ (Supabase)   │  │ BullMQ +     │  │ Vector store +          │   │
│  │ Users, strat-│  │ Cache +      │  │ Agent memory            │   │
│  │ egies, exec- │  │ Pub/Sub      │  │                         │   │
│  │ utions, creds│  │              │  │                         │   │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Why This Split Works

| Responsibility | Node.js Orchestrator | Python Compute Service |
|---|---|---|
| **API Server** | Express — handles all external HTTP/WS traffic | FastAPI — internal-only compute endpoints |
| **Workflow Scheduling** | BullMQ — repeatable jobs, heartbeat, retries | — |
| **Webhook Ingestion** | Express routes — instant, low-latency | — |
| **Flow Compiler** | TypeScript — topological sort, type checking, shared types with frontend | — |
| **Flow Interpreter** | TypeScript — orchestrates node execution, JSON data passing | Delegates indicator computation, AI analysis |
| **Broker API Calls** | Node.js HTTP clients — I/O-bound, non-blocking | — |
| **Notifications** | Telegram, Slack, Twilio, SendGrid — all I/O | — |
| **Real-time Updates** | WebSocket/Socket.io — push execution status | — |
| **Backtesting** | — | backtrader, backtesting.py, Nautilus |
| **Indicator Math** | — | TA-Lib, pandas, numpy (50+ indicators) |
| **AI Agents** | — | Google ADK (Python SDK), LLM orchestration |
| **RAG Retrieval** | — | ChromaDB, vector_rag.py |
| **Data Processing** | — | pandas DataFrames, market data transformation |
| **Code Generation** | — | Generates Python backtest code from compiled strategies |

### 7.3 Node.js ↔ Python Communication

| Pattern | When Used | Protocol | Latency Target |
|---|---|---|---|
| **Synchronous REST** | Indicator computation, strategy validation, LLM analysis | HTTP POST to FastAPI | < 100ms (indicators), < 10s (LLM) |
| **gRPC** (Phase 3+) | High-frequency indicator calls during live trading | Protocol Buffers | < 10ms |
| **Async Job** (via Redis) | Backtesting (30s+), batch data processing | BullMQ enqueue → Python worker → result in Redis/Postgres → pub/sub notify | Async |

### 7.4 Operational Modes

| Mode | Description | Best For | Agent Behavior |
|---|---|---|---|
| **Advisory** | Monitor and alert only. Never executes. | New users, risk-averse investors | Sends recommendations via notifications. User acts manually. |
| **Human-in-the-Loop** | Auto-executes with a cancel window (e.g., 2 min). | Active traders wanting speed + oversight | Sends pre-action notification. Executes unless user cancels. |
| **Fully Autonomous** | Executes all strategy-defined actions without confirmation. | Experienced users with backtested strategies | Full guardrails still apply. All actions logged. |
| **Simulation** | Runs all logic against live data but makes no real trades or alerts. | Strategy development and testing | Paper execution only. Results logged for review. |

---

## 8. Node System — The Visual Programming Language

The node system is StrategyFlow's core product — a **visual programming language for financial strategies**. Users compose strategies by connecting typed nodes on a canvas.

### 8.1 Existing Node Categories (10 Categories, 80+ Node Types)

| Category | Node Types | Output Type | Examples |
|---|---|---|---|
| **Indicators** (50+) | Technical analysis indicators | `number` | SMA, EMA, RSI, MACD, Bollinger Bands, Supertrend, Ichimoku, VWAP, ATR, ADX, Stochastic, CCI, Williams %R, Parabolic SAR, OBV |
| **Conditions** | Comparison and logic operators | `boolean` | Compare (>, <, ==), Crossover, Crossunder, Threshold, Range, AND, OR, NOT |
| **Actions** | Trade and notification actions | `signal` | Order (Buy/Sell), Close Position, Close All, Stop Loss, Take Profit, Trailing Stop, Notification, Log |
| **Environment** | Market context data | `number`/`boolean` | Price (OHLCV), Spread, Previous Candle, Time, Day of Week, Market Open |
| **Control** | Flow control structures | `signal` | If, If-Else, Repeat, Repeat Until, Wait, Wait Until, Stop |
| **Math** | Mathematical operations | `number` | Add, Subtract, Multiply, Divide, Number Literal, Advanced Math (log, sqrt, pow) |
| **Risk** | Risk management rules | `number` | Max Drawdown, Daily Loss Limit, Position %, Kelly Criterion, Scale In, Scale Out |
| **Variables** | State management | `any` | Set Variable, Get Variable, Change Variable, Define Function, Call Function, Return |
| **Trade Info** | Current position data | `number` | Entry Price, Position Size, PnL (unrealized/realized), Trade Duration |
| **LLM** | AI-powered analysis | `any` | Sentiment Analysis, Regime Detection, NL Strategy Rules, Parameter Tuning, Custom Code |

### 8.2 New Node Categories (To Be Built)

#### Trigger Nodes (New Category)

| Node Type | Description | Trigger Type |
|---|---|---|
| **Heartbeat Trigger** | Fires workflow on configurable schedule (every N minutes, market open/close, daily). Powered by BullMQ. | Polling |
| **Webhook Trigger** | Fires instantly on external HTTP POST (TradingView alert, custom service). Express route. | Event |
| **Price Alert Trigger** | Fires when asset crosses price threshold. Cheap pre-check in Node.js — no LLM needed. | Event |
| **News Trigger** | Fires when keyword/topic detected in financial news feeds. | Event |
| **Broker Event Trigger** | Fires on broker events: order filled, margin call, position liquidated. | Event |

#### Integration Nodes (n8n-Inspired)

| Node Type | Description | Runs In |
|---|---|---|
| **Telegram Node** | Send message / receive reply via Telegram bot | Node.js |
| **Slack Node** | Post to Slack channel | Node.js |
| **Email Node** | Send via SendGrid/SMTP | Node.js |
| **SMS Node** | Send via Twilio | Node.js |
| **HTTP Request Node** | Generic HTTP request to any API | Node.js |
| **Database Query Node** | Run SQL against strategy database | Node.js |
| **Code Node (Python)** | Custom Python code in workflow — sent to compute service | Python |
| **Code Node (JavaScript)** | Custom JS code in workflow — runs in Node.js sandbox | Node.js |
| **AI Analysis Node** | Send data to ADK agent for AI-powered analysis | Python |
| **Human-in-the-Loop Node** | Pauses execution until user approves/rejects via interactive message | Node.js |

### 8.3 Connection System

| Property | Detail |
|---|---|
| **Type Validation** | Edges enforce type compatibility between output and input handles |
| **Color Coding** | Number = Purple, Boolean = Amber, Signal = Cyan, Any = Pink |
| **Cycle Detection** | Automatic cycle detection prevents infinite loops |
| **Topological Sort** | Compiler produces deterministic execution order |
| **Handle Resolution** | Automatic resolution of compatible handle types |

### 8.4 Node Execution Semantics

Each node in a running workflow follows this lifecycle:

```
PENDING → EVALUATING → [DELEGATED] → RESOLVED → COMPLETED/SKIPPED/ERRORED
```

1. **PENDING**: Node waiting to be reached by the interpreter.
2. **EVALUATING**: Interpreter is computing this node's output.
3. **DELEGATED**: (Optional) Node's computation sent to Python compute service.
4. **RESOLVED**: Output value computed and stored in execution context.
5. **COMPLETED**: Node finished successfully — output passed to downstream nodes.
6. **SKIPPED**: Node not reached (condition branch not taken).
7. **ERRORED**: Node threw an error — error captured in execution log.

Each node produces a **JSON output payload** consumed by downstream nodes:

```json
{
  "nodeId": "rsi_1",
  "type": "indicator",
  "subtype": "rsi",
  "output": { "value": 28.4 },
  "metadata": {
    "computedAt": "2026-02-28T14:30:00Z",
    "delegatedTo": "python",
    "latencyMs": 42
  }
}
```

---

## 9. Feature Requirements

**Priority Legend:** P0 = Must Have (MVP) | P1 = Should Have | P2 = Nice to Have  
**Effort:** S = Small | M = Medium | L = Large | XL = Extra Large  
**Status:** ✅ Built | 🔧 In Progress | 🔲 Not Started

---

### 9.1 Visual Strategy Builder

#### Canvas & Node System `P0` `XL` `✅ Built`

The drag-and-drop visual strategy builder powered by ReactFlow. Users compose financial strategies by placing and connecting typed nodes on an infinite canvas.

- 10 node categories with 80+ node types
- Type-validated, color-coded edge connections
- Undo/redo history stack (50 entries)
- Import/export strategies as JSON
- Zustand-persisted state with full CRUD operations
- AI-assisted strategy generation (NL → nodes+edges via LLM)

#### Strategy Templates `P1` `M` `🔲 Not Started`

Pre-built strategy templates for common patterns to onboard new users:

- "Buy the Dip" — DCA when RSI oversold + no negative news
- "Momentum Scanner" — RSI + Volume + Trend confirmation
- "Risk-Managed Portfolio" — Max drawdown + position sizing + daily limits
- "News-Reactive Hedge" — Sentiment trigger + partial liquidation
- Users can fork templates and customize

---

### 9.2 Autonomous Heartbeat Engine (OpenClaw-Inspired)

#### Background Agent Daemon `P0` `L` `✅ Scaffolded`

A persistent background process that wakes the agent at configurable intervals, independent of the UI. The agent runs continuously whether the user is logged in or not.

**Implementation (Node.js + BullMQ):**

- **BullMQ + Redis** as job queue and scheduler (same stack as n8n)
- Configurable polling intervals: every 5 min, on market open/close, on trigger events
- Per-user agent instances that load active strategy flowchart on each heartbeat
- **Cheap pre-check pattern (OpenClaw-style):** Node.js performs lightweight data checks (price thresholds, volume spikes, news keyword matches) before invoking Python/LLM. Only escalate if a pre-check fires.
- **HEARTBEAT_OK suppression:** If no conditions met, cycle completes silently — no notification, no LLM invocation
- Auto-restart on failure with exponential backoff (BullMQ built-in)
- Agent state persistence between cycles via PostgreSQL
- BullMQ Dashboard (Bull Board) for monitoring jobs

#### Event-Driven Triggers (n8n-Inspired) `P1` `L` `🔲 Not Started`

In addition to polling, certain events fire the workflow instantly:

- **Webhook Trigger Nodes:** Users connect webhook URLs from TradingView/external services → instant workflow evaluation
- **Internal Event Bus:** Price alerts, broker fills, news callbacks trigger instant evaluation via Redis pub/sub
- Express/Fastify webhook endpoints per strategy with HMAC signature verification
- WebSocket push to frontend for real-time execution status

---

### 9.3 Strategy Execution Engine

#### Flow Compiler (TypeScript) `P0` `XL` `✅ Built`

Converts the visual flowchart into a machine-executable decision tree:

- Topological sort of node graph
- Type checking of all connections
- n8n-style JSON data passing between nodes
- Shared TypeScript types with frontend (eliminates type duplication)
- Branch probability scoring — rank which branches are closest to triggering

**Key Files:** `orchestrator/src/engine/compiler.ts`, `orchestrator/src/engine/types.ts`, `orchestrator/src/engine/definitions.ts`

#### Flow Interpreter (TypeScript) `P0` `XL` `✅ Built`

Evaluates compiled node graph at runtime:

- Traverses compiled graph in topological order
- Creates `ExecutionRun` with per-node inputs/outputs, timestamps, decisions
- Delegates compute-heavy nodes to Python service via `computeClient.ts`
- Manages execution context (variables, portfolio state, indicator cache)

**Key File:** `orchestrator/src/engine/interpreter.ts` (24KB)

#### Pre-Check Engine (OpenClaw) `P0` `M` `✅ Built`

Lightweight checks before expensive operations:

- Price threshold checks (Node.js, no Python needed)
- Volume spike detection
- Time-based guards (market hours, cooldown periods)
- Only escalate to full evaluation/LLM if pre-check fires

**Key Files:** `orchestrator/src/engine/precheck.ts`, `orchestrator/src/engine/preChecks.ts`

#### Credential Vault (n8n-Inspired) `P1` `M` `✅ Built`

Secure credential management:

- Encrypted at rest (AES-256) in PostgreSQL
- Referenced by alias in node config: `{{credentials.alpaca}}`
- Scoped per-user with access audit logging
- Dedicated "Credentials" page in frontend

---

### 9.4 Execution History & Visual Debugging (n8n-Inspired)

#### Execution Logger `P0` `L` `✅ Built`

Every workflow run creates an `ExecutionRun` record in PostgreSQL:

- Execution ID, timestamp, trigger type, duration, status (success/error/skipped)
- Per-node JSON snapshots: input, output, evaluation result, errors
- Which nodes delegated to Python and their response times

#### Visual Execution Viewer `P1` `L` `✅ Built`

Users browse past executions and see the canvas highlighted:

- 🟢 Green nodes = executed successfully
- 🔴 Red nodes = errored
- ⚪ Gray nodes = skipped (condition not met)
- 🔵 Blue nodes = delegated to Python compute
- Data preview on hover — shows exact JSON through each connection

#### Replay Mode `P2` `M` `🔲 Not Started`

Re-run a past execution with different parameters for debugging and what-if analysis.

---

### 9.5 Market Data & Intelligence

#### Multi-Source Data Ingestion `P0` `L` `✅ Partially Built`

- Real-time price, volume, order book data via Polygon.io or Alpaca
- Technical indicator computation (50+ indicators — Python compute service)
- Earnings calendar and economic event schedule awareness
- Options flow and unusual activity monitoring (future)
- Crypto on-chain data integration (future)

**Built:** `backend/data_service.py`, `backend/market_data_scheduler.py`, `backend/market_screener.py`

#### News & Sentiment Analysis `P1` `L` `🔲 Not Started`

- Real-time news ingestion via NewsAPI / RSS (Node.js fetcher)
- SEC EDGAR filings monitoring (10-K, 10-Q, 8-K)
- Social sentiment: Reddit (WSB), Twitter/X FinTwit, StockTwits
- LLM-powered news-to-portfolio impact analysis via Python ADK agents
- Sentiment scoring fed into condition nodes as inputs

---

### 9.6 Proactive Notifications

#### Multi-Channel Dispatch `P0` `M` `✅ Scaffolded`

When the agent identifies an opportunity or risk meeting user thresholds, it reaches out:

| Channel | Status | Implementation |
|---|---|---|
| **Telegram Bot** | ✅ Scaffolded | `orchestrator/src/services/channels/` |
| **Slack** | ✅ Scaffolded | `orchestrator/src/services/channels/` |
| **Email** | ✅ Scaffolded | SendGrid/SMTP |
| **SMS** | ✅ Scaffolded | Twilio |
| **Push Notifications** | 🔲 | Firebase (mobile) |
| **Voice Call** | 🔲 | Twilio Voice (critical alerts) |

Each alert includes: what triggered, why it matters, what action the agent recommends or took.

#### Human-in-the-Loop Node `P1` `M` `🔲 Not Started`

Specialized node that pauses workflow execution until user clicks "Approve" or "Reject" via interactive message. Node.js orchestrator holds state in Redis until webhook callback received.

---

### 9.7 Autonomous Trade Execution

#### Brokerage API Integration `P1` `XL` `🔧 In Progress`

| Broker | Status | Markets |
|---|---|---|
| **IG Markets** | ✅ Production | CFDs, spread betting |
| **Nordnet** | ✅ Production | Nordic stocks |
| **Alpaca** | 🔧 Scaffolded | US stocks, crypto (free paper trading) |
| **Interactive Brokers** | 🔲 Planned | Professional multi-asset |

Features:
- Position sizing logic respecting per-trade max allocation from strategy nodes
- Guardrail enforcement: max daily spend, drawdown stop, concentration caps
- Paper trading mode for simulation before live funds
- Full audit log of every agent action with rationale

---

### 9.8 Portfolio Awareness

#### Portfolio Context Engine `P0` `M` `🔲 Not Started`

All agent decisions are contextualized against the user's real portfolio:

- Real-time portfolio sync from connected brokerages (Node.js → PostgreSQL)
- Position tracking: cost basis, unrealized P&L, sector exposure, concentration risk
- Correlation analysis — understand how holdings relate (Python compute for matrix math)
- Tax-awareness: track short vs. long-term gains for sell decisions
- Portfolio health score updated each heartbeat cycle

---

### 9.9 Research & Analytics

#### Backtesting `P0` `XL` `✅ Built`

Multiple backtesting engines:

- **Backtrader** — Full-featured backtesting with equity curves, trade logs, metrics
- **backtesting.py** — Lightweight vectorized backtesting
- **Nautilus** — High-performance event-driven backtesting

**Key Files:** `backend/backtest_engine.py`, `backend/backtest_runner.py`, `backend/backtest_service.py`, `backend/nautilus_adapter.py`

#### Monte Carlo Permutation Test (MCPT) `P1` `M` `✅ Built`

Statistical validation of strategy performance:

- Permutation testing to assess if strategy results are statistically significant
- Confidence intervals for key metrics
- Frontend modal for MCPT analysis and results

**Key Files:** `backend/mcpt/`

#### Walk-Forward Analysis `P2` `L` `🔲 Not Started`

Out-of-sample testing to validate strategy robustness across different time periods.

---

## 10. Key Use Cases & User Stories

### 10.1 The Sleep-Well Risk Protector

> *"As a retail investor, I want my agent to automatically protect my portfolio from major losses overnight so that I wake up knowing my risk parameters were respected while I slept."*

**Strategy:** Monitor tech holdings → IF NASDAQ drops >3% overnight OR negative regulatory AI news detected → liquidate 30% of tech holdings → send Telegram alert with action summary.

**Agent Execution at 3:00 AM:**
1. BullMQ heartbeat fires
2. Node.js pre-check: NASDAQ futures down 3.2% → **pre-check fires**
3. Node.js sends news context to Python ADK agent → confirms EU AI regulation announcement
4. Condition nodes evaluate to TRUE
5. Node.js broker client executes partial liquidation via Alpaca API
6. Telegram bot sends: *"Emergency protocol triggered. Moved $10,200 to cash. EU AI regulation news triggered your risk rule."*
7. Full execution logged with per-node data for morning review

### 10.2 The Alpha Hunter

> *"As an active trader, I want my agent to scan the entire market 24/7 for setups that match my exact criteria so that I never miss a trade."*

**Strategy:** Scan all S&P 500 → IF RSI < 35 AND volume > 2x 20-day avg AND sentiment > 0.7 AND no negative earnings → alert with pre-filled trade recommendation.

**Agent Execution:**
1. BullMQ heartbeat triggers market scan
2. Node.js fetches prices for all 500 tickers (I/O burst — Node.js excels)
3. Tickers crossing basic thresholds batch-sent to Python for RSI/volume computation
4. Python returns results → Node.js evaluates remaining conditions
5. NVDA matches all criteria
6. Sends: *"NVDA matches your breakout setup. RSI: 32. Volume: 3.1x avg. Sentiment: 0.82 positive. No negative news. Recommend $2,000 position. Reply YES to execute."*

### 10.3 The Wealth Manager Multiplier

> *"As an RIA, I want to monitor all 40 client portfolios simultaneously so that I can spot risks and opportunities across my entire book without adding headcount."*

**Agent Execution:**
- Each client has a unique strategy flowchart
- BullMQ runs separate heartbeat jobs per portfolio (concurrency-limited for broker rate limits)
- Morning digest: *"3 portfolios require attention. Client A: earnings risk on 2 positions. Client B: rebalancing triggered. Client C: stop-loss approaching on TSLA."*
- Advisor reviews and approves from single dashboard

### 10.4 The DCA Crypto Guardian

> *"As a crypto trader, I want to dollar-cost average into BTC weekly but automatically pause DCA if the market enters panic mode."*

**Strategy:** Every Monday → Buy $100 BTC via Alpaca → UNLESS Fear & Greed Index < 15 OR BTC dropped > 20% in 7 days → in that case, hold cash and alert me.

**Agent Execution:**
1. Monday heartbeat fires
2. Pre-check: Fear & Greed = 12 (Extreme Fear) → threshold crossed
3. DCA paused, cash held
4. Telegram: *"DCA paused. Extreme Fear detected (12/100). BTC is down 24% this week. Your cash is safe. Will resume when conditions normalize."*

---

## 11. API Contracts & Data Flow

### 11.1 Frontend ↔ Node.js Orchestrator

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/strategies` | List user's strategies |
| `POST` | `/api/strategies` | Create new strategy |
| `PUT` | `/api/strategies/:id` | Update strategy (nodes, edges, metadata) |
| `DELETE` | `/api/strategies/:id` | Delete strategy |
| `POST` | `/api/strategies/:id/compile` | Compile strategy → validate + return execution plan |
| `POST` | `/api/strategies/:id/execute` | Execute strategy (manual trigger) |
| `GET` | `/api/executions` | List past execution runs |
| `GET` | `/api/executions/:id` | Get execution detail with per-node logs |
| `POST` | `/api/executions/:id/replay` | Replay execution with different params |
| `GET` | `/api/credentials` | List credential aliases |
| `POST` | `/api/credentials` | Store encrypted credential |
| `DELETE` | `/api/credentials/:id` | Remove credential |
| `GET` | `/api/agent/config` | Get agent configuration |
| `PUT` | `/api/agent/config` | Update agent config (heartbeat, mode, hours) |
| `POST` | `/api/agent/start` | Start agent |
| `POST` | `/api/agent/stop` | Stop agent (kill switch) |
| `GET` | `/api/portfolio` | Get linked portfolio positions |
| `GET` | `/api/notifications` | Get notification history |
| `WS` | `/ws` | Real-time execution status, alerts, agent health |

### 11.2 Node.js Orchestrator ↔ Python Compute

| Method | Endpoint | Purpose | Latency Target |
|---|---|---|---|
| `POST` | `/compute/indicators` | Compute indicator values given price data + params | < 100ms |
| `POST` | `/compute/backtest` | Run backtest given compiled strategy + data range | Async (< 60s) |
| `POST` | `/compute/ai-analyze` | AI agent analysis given context | < 10s |
| `POST` | `/compute/generate-strategy` | NL → nodes+edges via LLM | < 15s |
| `POST` | `/compute/sentiment` | Sentiment analysis on text/news | < 5s |
| `POST` | `/compute/mcpt` | Monte Carlo Permutation Test | Async (< 120s) |
| `GET` | `/compute/health` | Health check | < 50ms |

### 11.3 Data Flow — Heartbeat Cycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  BullMQ  │───▶│ Pre-Check│───▶│ Compiler │───▶│Interpreter│───▶│  Action  │
│ Heartbeat│    │ (Node.js)│    │ (Node.js)│    │ (Node.js) │    │ Dispatch │
└──────────┘    └────┬─────┘    └──────────┘    └─────┬─────┘    └────┬─────┘
                     │                                │               │
                     │ HEARTBEAT_OK                   │               │
                     │ (silent return                  │               │
                     │  if no threshold               ▼               ▼
                     │  crossed)               ┌──────────┐    ┌──────────┐
                     │                         │  Python   │    │ Broker   │
                     │                         │  Compute  │    │ API      │
                     │                         │  Service  │    │ + Notify │
                     │                         └──────────┘    └──────────┘
                     │                                               │
                     │                                               ▼
                     │                                        ┌──────────┐
                     └───────────────────────────────────────▶│ Exec Log │
                           (all paths log)                    │ (Postgres)│
                                                              └──────────┘
```

---

## 12. Database Schema

### 12.1 PostgreSQL Tables

| Table | Managed By | Purpose | Key Columns |
|---|---|---|---|
| `users` | Node.js (Supabase Auth) | User accounts, preferences, subscription tier | id, email, role, tier, created_at |
| `strategies` | Node.js | Strategy metadata | id, user_id, name, description, is_active, created_at, updated_at |
| `strategy_versions` | Node.js | Version history of node/edge JSON | id, strategy_id, version, nodes_json, edges_json, created_at |
| `credentials` | Node.js | Encrypted API keys (AES-256) | id, user_id, alias, provider, encrypted_value, created_at |
| `execution_runs` | Node.js | Workflow execution records | id, strategy_id, trigger_type, duration_ms, status, started_at, completed_at |
| `execution_node_logs` | Node.js | Per-node JSON I/O snapshots | id, run_id, node_id, input_json, output_json, status, latency_ms |
| `agent_configs` | Node.js | Agent behavior settings | id, user_id, heartbeat_interval, mode, active_hours, is_running |
| `portfolios` | Node.js | Linked brokerage accounts | id, user_id, broker, account_id, positions_json, synced_at |
| `notifications` | Node.js | Notification history + delivery status | id, user_id, channel, message, status, sent_at |
| `market_data` | Python | OHLCV data cache | symbol, timeframe, timestamp, open, high, low, close, volume |
| `backtest_results` | Python | Backtest metrics, equity curves | id, strategy_version_id, metrics_json, equity_json, trades_json |

### 12.2 Redis Keys

| Key Pattern | Purpose | TTL |
|---|---|---|
| `bull:heartbeat:{userId}` | BullMQ heartbeat job per user | Repeatable |
| `cache:price:{symbol}` | Latest price cache | 60s |
| `cache:indicators:{hash}` | Computed indicator cache | 300s |
| `exec:pending:{executionId}` | HITL pending approval state | 30min |
| `agent:state:{userId}` | Agent state between heartbeats | Persistent |
| `pubsub:execution:{userId}` | Real-time execution events | — |

---

## 13. Non-Functional Requirements

### 13.1 Security & Compliance

- All brokerage API keys encrypted at rest using AES-256 via Credential Vault
- Supabase Auth with OAuth 2.0 for user authentication
- OAuth 2.0 for brokerage account connections — never store user login credentials
- Full audit log of every agent decision and action for regulatory compliance
- Default is advisory mode only — execution permissions must be explicitly granted
- SEC/FINRA disclosure: platform is not a registered investment advisor
- Row Level Security (RLS) on all PostgreSQL tables — users can only access their own data
- HTTPS everywhere — all API traffic encrypted in transit

### 13.2 Reliability & Performance

| Metric | Phase 1 Target | Phase 3+ Target |
|---|---|---|
| Agent heartbeat uptime | 99.5% | 99.9% |
| Signal-to-alert latency | < 60s | < 10s |
| API response time (p95) | < 500ms | < 200ms |
| Strategy compilation | < 2s | < 500ms |
| Python compute call (indicators) | < 200ms | < 50ms |

- Graceful degradation: if Python service unavailable, Node.js caches request and retries
- Auto-restart on agent failure with exponential backoff (BullMQ built-in)
- User notified if agent offline > 15 minutes
- Node.js horizontal scaling: add orchestrator instances behind load balancer

### 13.3 Guardrails (Non-Negotiable)

These guardrails are enforced at the **orchestrator level** and cannot be overridden by the agent or strategy:

| Guardrail | Description | Enforcement |
|---|---|---|
| **Max Single Trade** | User-defined maximum single-trade value cap | Node.js middleware, pre-execution |
| **Daily Spend Limit** | Maximum daily spend across all autonomous actions | Running total in Redis, checked pre-execution |
| **Concentration Limit** | Agent cannot allocate > X% to any single position | Portfolio-aware check before order |
| **Market Circuit Breaker** | Pause all autonomous actions during market-wide circuit breakers | External event listener |
| **Emergency Kill Switch** | Halt all agent activity instantly | In-app button, Telegram `/stop`, API `POST /agent/stop` |
| **Cooldown Period** | Minimum time between actions on same asset | Redis-based cooldown counter |
| **Paper Trading Default** | All new strategies start in simulation mode | Enforced at strategy creation |

### 13.4 Deployment

**Docker Compose services:**

| Service | Image | Port | Notes |
|---|---|---|---|
| `frontend` | React via Nginx | 80/443 | Static build served by Nginx |
| `orchestrator` | Node.js (Express + BullMQ) | 3001 | External-facing API + WebSocket |
| `compute` | Python (FastAPI) | 8000 | Internal-only — not exposed publicly |
| `redis` | Redis 7+ | 6379 | BullMQ broker + cache + pub/sub |
| `postgres` | PostgreSQL 15+ (or Supabase) | 5432 | Primary database |
| `chromadb` | ChromaDB | 8500 | Vector store for RAG |

- Environment-based configuration (`.env` files)
- Health check endpoints: `GET /health` on both Node.js and Python services
- Structured JSON logs from both services
- Docker volumes for persistent data (postgres, redis, chromadb)

---

## 14. Product Roadmap

### Phase 1 — Foundation & Migration (Weeks 1–8) `✅ Mostly Complete`

| Deliverable | Status | Notes |
|---|---|---|
| Scaffold Node.js orchestrator (Express + BullMQ + Redis) | ✅ | `orchestrator/` fully operational |
| Rewrite flow compiler in TypeScript | ✅ | `engine/compiler.ts` |
| Rewrite flow interpreter in TypeScript | ✅ | `engine/interpreter.ts` |
| Pre-check engine (OpenClaw pattern) | ✅ | `engine/precheck.ts` |
| Set up PostgreSQL (Prisma ORM) | ✅ | Prisma schema defined |
| Supabase integration (auth) | ✅ | `supabase/` config + auth store |
| Keep Python FastAPI as internal compute service | ✅ | `backend/` operational |
| Frontend connects to Node.js API | ✅ | 12 route files |
| Credential Vault (backend + frontend) | ✅ | Encrypted storage |
| Execution History (backend + frontend) | ✅ | Logger + viewer |
| Agent Config page | ✅ | Heartbeat, mode, hours |

### Phase 2 — Workflow Engine & Triggers (Weeks 9–16) `🔧 Current Phase`

| Deliverable | Status | Priority |
|---|---|---|
| Harden flow interpreter (edge cases, error recovery) | 🔧 | P0 |
| Trigger node category (Heartbeat, Webhook, Price Alert) | 🔲 | P1 |
| Telegram notification channel (full implementation) | 🔧 | P0 |
| Advisory mode — end-to-end working | 🔲 | P0 |
| WebSocket real-time execution status push | ✅ | P0 |
| Replay mode for past executions | 🔲 | P2 |
| Strategy templates (onboarding) | 🔲 | P1 |
| Alpaca paper trading integration | 🔲 | P1 |

### Phase 3 — Intelligence & Execution (Weeks 17–26)

| Deliverable | Priority |
|---|---|
| Full Python compute wiring for indicators, backtesting, AI | P0 |
| News ingestion + LLM sentiment analysis | P1 |
| Paper trading with Alpaca sandbox (full cycle) | P0 |
| Live trade execution with guardrails | P1 |
| Human-in-the-Loop node | P1 |
| Multi-channel notifications (Telegram, Slack, SMS, Email — fully working) | P0 |
| Portfolio sync from brokerage accounts | P1 |
| gRPC for high-frequency indicator calls (optional optimization) | P2 |

### Phase 4 — Scale & Monetization (Weeks 27–36)

| Deliverable | Priority |
|---|---|
| Fully autonomous mode (end-to-end, production-ready) | P0 |
| Multi-portfolio support (wealth manager persona) | P1 |
| Walk-forward & Monte Carlo analysis enhancements | P2 |
| Strategy marketplace (share/sell strategies) | P2 |
| Mobile-responsive dashboard | P1 |
| User auth + subscription tiers (Stripe integration) | P0 |
| Interactive Brokers (IBKR) integration | P1 |
| Crypto on-chain data integration | P2 |
| White-label option for wealth managers | P2 |

---

## 15. Monetization Strategy

| Tier | Features | Price | Target User |
|---|---|---|---|
| **Free** | Visual strategy builder only. No agent. No autonomous actions. Up to 3 strategies. Limited backtest data range. | Free | Hobbyist, evaluation |
| **Starter** | Agent monitoring + alerts. Advisory mode only. 1 connected portfolio. 5 strategies. Telegram/email notifications. | $29/month | Retail investor |
| **Pro** | Full autonomous execution. Unlimited strategies. Multi-asset. Webhook triggers. Execution history. Multi-channel alerts. All backtesting engines. | $99/month | Active trader |
| **Wealth Manager** | Multi-client portfolios. Team access. White-label option. Compliance exports. Priority support. Custom heartbeat intervals. | $499/month | RIA / family office |

### Revenue Levers

| Lever | Description |
|---|---|
| **Subscription tiers** | Core revenue via monthly/annual plans |
| **Compute credits** | Metered billing for heavy backtest/AI usage beyond tier limits |
| **Marketplace commission** | Take rate on strategy marketplace sales |
| **Data source upsell** | Premium data feeds (Bloomberg, options flow) as add-ons |
| **Enterprise / API** | Custom deployment for institutional clients |

---

## 16. Open Questions & Risks

| # | Risk / Question | Severity | Mitigation |
|---|---|---|---|
| 1 | **Regulatory risk:** Does autonomous trade execution require broker-dealer or RIA registration? | 🔴 Critical | Legal review required. Default advisory mode. Frame as "rules engine" not "investment advice." |
| 2 | **LLM hallucination** in financial decisions — agent acts on incorrect news interpretation. | 🔴 Critical | Confidence thresholds required before action. HITL default. Dual-source verification. OpenClaw pre-check reduces unnecessary LLM invocations. |
| 3 | **User trust:** Will users grant execution permissions to an AI? | 🟡 High | Start advisory. Build trust with accuracy track record. Simulation results before live. Transparent audit log. |
| 4 | **Broker API rate limits** at scale. | 🟡 High | BullMQ concurrency controls. Per-broker rate limit configs. Request batching. |
| 5 | **Data source cost** at scale (Polygon, Twitter APIs). | 🟡 High | Start with free tiers (Alpaca, yfinance, Reddit). Gate premium sources behind paid tiers. Model unit economics at 1k/10k/100k users. |
| 6 | **Node.js ↔ Python latency** for real-time indicators. | 🟡 Medium | Heartbeat latency negligible. Live trading: (a) Redis indicator cache, (b) gRPC for < 10ms, (c) port simple indicators (SMA, EMA) to TypeScript. |
| 7 | **Migration effort:** TypeScript compiler/runtime rewrite. | 🟢 Low | Compiler ~240 lines, runtime ~435 lines. One-time investment that pays in shared types and maintainability. **Already largely completed.** |
| 8 | **Two deployment targets** = operational complexity. | 🟢 Low | Docker Compose handles cleanly. Shared Postgres + Redis. Health checks. Structured logging. |
| 9 | **Strategy correctness:** How to verify that the visual flowchart executes exactly as the user intended? | 🟡 High | Simulation mode default. Execution history with per-node inspection. Replay mode. Visual debugging with data preview. |
| 10 | **Multi-tenant data isolation** at scale. | 🟡 High | Supabase RLS policies. Per-user BullMQ jobs. Credential vault scoped per user. |

---

*StrategyFlow AI Agent | PRD v4.0 | Confidential*  
*Last updated: February 2026*
