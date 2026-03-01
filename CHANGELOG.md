# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-03-01

### Changed

- **Runtime & Package Manager Migration: Node.js/npm → Bun.**
  - All JavaScript workspaces (frontend + orchestrator) now use Bun as the runtime and package manager.
  - Replaced `npm ci` / `npm install` with `bun install --frozen-lockfile` across all Dockerfiles.
  - Orchestrator dev script uses `bun --watch` instead of `tsx watch` (Bun runs TypeScript natively).
  - Production CMD uses `bun dist/index.js` instead of `node dist/index.js`.
  - Docker base images changed from `node:20-alpine` to `oven/bun:1-alpine`.

- **Dependency swap: `bcrypt` → `bcryptjs`.**
  - Replaced native C++ `bcrypt` addon with pure-JS `bcryptjs` (100% API-compatible drop-in).
  - Updated type definitions: `@types/bcrypt` → `@types/bcryptjs`.

### Removed

- `tsx` devDependency from orchestrator (Bun runs `.ts` natively).
- `package-lock.json` files from both workspaces (replaced by `bun.lockb`).

---

## [2.0.0] - 2026-02-22

### Architecture

- **Strategic decision: Node.js-primary + Python-compute microservice architecture.**
  - Node.js (Express/Fastify + BullMQ) becomes the orchestration layer: API server, heartbeat scheduler, webhook handler, notification dispatcher, broker clients, flow compiler/interpreter.
  - Python (FastAPI) becomes an internal compute service: backtesting engines, TA-Lib/pandas indicator computation, Google ADK agents, ChromaDB RAG.
  - Both services share PostgreSQL (primary DB) and Redis (BullMQ broker + cache + pub/sub).
  - Inspired by n8n's Node.js-based workflow engine and OpenClaw's heartbeat daemon architecture.

### Added

- **`prd/` directory** with `StrategyFlow_PRD_v3.md` — full product vision aligned to existing codebase with Node.js orchestration architecture.
- **StrategyFlow PRD v3.0** — comprehensive PRD covering: autonomous heartbeat engine (BullMQ), n8n-style execution history, webhook trigger nodes, credential vault, human-in-the-loop node, and migration strategy from Python to Node.js primary.
- **README.md overhaul** — 5 mermaid architecture diagrams: system overview, heartbeat agent pipeline, strategy execution pipeline, execution history flow, AI strategy generation pipeline.

### Planned (Phase 1 — Weeks 1–8)

- Node.js orchestrator scaffold (Express/Fastify + BullMQ + Redis)
- TypeScript rewrite of flow compiler (`flow/compiler.py` → `orchestrator/src/flow/compiler.ts`)
- PostgreSQL migration from SQLite
- Basic heartbeat scheduler with BullMQ repeatable jobs
- Trigger node category in frontend (Heartbeat, Webhook, Price Alert)

---

## [1.6.0] - 2026-01-02

### Added

- **Nordnet Integration**: Support for connecting to Nordnet broker for live trading.
- **Nordnet Client**: Dedicated Python client (`nordnet_client.py`) with Ed25519 authentication.
- **Broker Modals**: Updated `BrokerConnectModal` to handle Nordnet credentials (UUID, Private Key).
- **Backend API**: New `/api/live/nordnet/login` endpoint for secure authentication.

### Changed

- **Strategy Runner**: Refactored `StrategyRunner` to use an adapter pattern, supporting multiple brokers (IG, Nordnet) dynamically.
- **Profile Modal**: Added Nordnet to the list of available brokers and integrated the connection flow.
- **Live Trading Router**: Updated `/api/live/start` to accept a `broker` parameter for selecting the execution client.

### Fixed

- **Blockly Sidebar**: Resolved block overlap issue in "My Blocks" by moving custom blocks to a dedicated "Custom" category.
- **Category Navigation**: Fixed bug where clicking other categories after "Custom" stopped working by only showing "Custom" when blocks exist.
- **Custom Block Loader**: Made loader robust against malformed or legacy block definitions to prevent panel crashes.

---

## [1.5.0] - 2025-12-31

### Added

- TradingView Market Summary ticker bar at top of Live Trading Dashboard
- FlexLayout integration for resizable panels in modals
- TradingViewAdvancedChart component with full charting features
- TradingViewMarketOverview component with multi-asset tabs

### Changed

- BacktestVisualizationModal now uses FlexLayout with Chart/Summary/Trades panels
- FloatingChartModal upgraded with resizable TradingView widgets
- Increased modal heights to accommodate ticker bar

---

## [1.4.0] - 2025-12-30

### Fixed

- Nautilus backtest pipeline now correctly routes template strategies
- Strategy code generation properly handles tuple return from JSON generator
- Visualization HTML now generated in simple backtest fallback
- Fixed traceback import shadowing in nautilus_adapter.py

### Added

- Fallback visualization for simple backtest engine
- Better error logging for backtest failures

---

## [1.3.0] - 2025-12-29

### Added

- ProfileModal with user authentication and saved strategies
- Connector/Broker integration panel with 17+ broker logos
- Custom block creation via AI chat
- ADK trading_agent connected to frontend Chat mode
- Nautilus HTML visualization with Drawdown, Heatmap, Distribution charts

### Changed

- Modal centering and z-index management improvements
- Smooth corner unsnap behavior for draggable modals

---

## [1.2.0] - 2025-12-28

### Added

- Modular BlocklyWorkspace with extracted components
- WorkspaceToolbar and CodeViewPanel components
- Backtest result enhancements: trade analytics, duration, cumulative P&L
- Trade filters and Summary tab with secondary metrics

### Changed

- Settings Panel refactored with unified BacktestingPanel
- Strategy button replaced with Settings button

---

## [1.1.0] - 2025-12-27

### Added

- Strategy cloning and versioning (objective 017)
- Monte Carlo simulation for strategy robustness (objective 016)
- Walk-forward validation in backtester (objective 015)
- Local database caching for market data (objective 014)
- Strategy performance report generator (objective 013)
- Multi-timeframe indicator support (objective 012)

---

## [1.0.0] - 2025-12-26

### Added

- Initial release of PPM (Personal Portfolio Manager)
- Blockly-based visual strategy builder
- TradingView chart integration
- Multiple backtest engines (VectorBT, NautilusTrader, PyGenerator)
- AI-powered strategy generation via DeepSeek/Gemini
- Real-time code preview panel
- Strategy templates library
- Risk management blocks
- Technical indicator blocks (SMA, EMA, RSI, MACD, etc.)
- Multi-timeframe support
- Drag-and-drop workspace with snap grid

### Infrastructure

- React + TypeScript + Vite frontend
- Python FastAPI backend
- ChromaDB for RAG embeddings
