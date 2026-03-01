# Project Prometheus (PPM) — StrategyFlow

**Project Prometheus** is an advanced AI-powered algorithmic trading platform that lets users build, backtest, and autonomously execute trading strategies through a visual node-and-edge builder. Inspired by **n8n**'s workflow automation and **OpenClaw**'s heartbeat daemon, the platform is evolving into a 24/7 autonomous financial AI agent.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Frontend](https://img.shields.io/badge/frontend-React%20%7C%20ReactFlow%20%7C%20TypeScript-61DAFB)
![Orchestrator](https://img.shields.io/badge/orchestrator-Bun%20%7C%20BullMQ-f472b6)
![Compute](https://img.shields.io/badge/compute-Python%20%7C%20FastAPI-3776AB)
![AI](https://img.shields.io/badge/AI-Google%20ADK%20%7C%20Gemini-4285F4)

---

## 🚀 Key Features

- **🎨 Visual Strategy Builder** — ReactFlow-based node-and-edge canvas. 10 node categories: Indicators, Conditions, Actions, Environment, Control, Math, Risk, Variables, Trade Info, LLM.
- **🤖 AI Strategy Generation** — Describe strategies in plain English. Gemini/DeepSeek generates the complete node graph via RAG.
- **💬 AI Chat Assistant** — Google ADK agents with 15+ tools for market research, sentiment analysis, and live trading control.
- **📉 Multi-Engine Backtesting** — backtrader, backtesting.py, NautilusTrader. Full metrics: Sharpe, Sortino, CAGR, Drawdown, Win Rate.
- **⚡ Live Trading** — IG Markets and Nordnet broker integrations.
- **⏰ Autonomous Heartbeat Agent** *(upcoming)* — BullMQ-powered background agent that monitors markets 24/7, inspired by OpenClaw.
- **🔗 Webhook Triggers** *(upcoming)* — Event-driven workflow execution, TradingView alert integration.
- **📋 Execution History** *(upcoming)* — Visual debugger for past workflow runs, n8n-style per-node data inspection.

---

## 🏗️ Architecture

### System Overview

```mermaid
graph TD
    User["👤 User"] -->|"Visual Builder / Chat"| Frontend["React + ReactFlow\n(Frontend)"]
    
    Frontend -->|"HTTP / WebSocket"| NodeJS["Node.js Orchestrator\n(Express + BullMQ)"]

    subgraph NodeJS_Services["Node.js — Orchestration Layer"]
        API["REST API\n(Express/Fastify)"]
        Queue["BullMQ\nJob Queue"]
        FlowEngine["Flow Compiler\n& Interpreter (TS)"]
        Webhooks["Webhook Handler"]
        Notify["Notification\nDispatcher"]
        Broker["Broker Clients\n(Alpaca · IG · IBKR)"]
    end

    NodeJS -->|"REST / gRPC\n(compute requests)"| Python["Python Compute\nService (FastAPI)"]

    subgraph Python_Services["Python — Compute Layer"]
        Backtest["Backtesting Engines\n(backtrader · backtesting.py\n· NautilusTrader)"]
        Indicators["Indicator Calculator\n(TA-Lib · pandas · numpy)"]
        ADK["Google ADK Agents\n(Trading · Research)"]
        RAG["RAG / Vector Search\n(ChromaDB)"]
        DataProc["Data Processing\n(pandas · yfinance · FMP)"]
    end

    subgraph Data["Shared Data Layer"]
        PG[("PostgreSQL\n(strategies · executions\n· portfolio · users)")]
        Redis[("Redis\n(BullMQ · cache · pub/sub)")]
        Chroma[("ChromaDB\n(vector store)")]
    end

    NodeJS --> Data
    Python --> Data
```

---

### Heartbeat Agent Pipeline (OpenClaw-Inspired)

```mermaid
sequenceDiagram
    participant Beat as BullMQ Scheduler
    participant Orch as Node.js Orchestrator
    participant PreCheck as Pre-Check Layer (Node.js)
    participant Python as Python Compute Service
    participant Broker as Broker API
    participant User as 📱 User

    Beat->>Orch: Heartbeat fires (every N mins)
    Orch->>Orch: Load user strategy (from PostgreSQL)
    Orch->>PreCheck: Run cheap checks (price threshold, volume spike)
    
    alt No condition met
        PreCheck-->>Orch: HEARTBEAT_OK (silent)
        Note over Orch: Cycle ends. No LLM call. No notification.
    else Condition threshold met
        PreCheck->>Python: POST /compute/indicators {priceData, params}
        Python-->>PreCheck: {rsi: 28, volume_ratio: 2.3}
        PreCheck->>Python: POST /compute/ai-analyze {context, news}
        Python-->>PreCheck: {sentiment: 0.82, action: "buy"}
        Orch->>Orch: Evaluate strategy nodes (topological order)
        Orch->>Broker: Execute trade (if autonomous mode)
        Orch->>User: 📬 Alert via Telegram / Slack / SMS
    end
```

---

### Strategy Execution Pipeline

```mermaid
flowchart LR
    A["👤 User\nBuilds Strategy"] --> B["ReactFlow Canvas\n(nodes + edges)"]
    B --> C["Flow Compiler\n(TypeScript)"]
    C --> D["Compiled JSON\n+ Topological Order"]
    D --> E{"Execution\nMode"}
    
    E -->|"Backtest"| F["Node.js enqueues\nBullMQ job"]
    F --> G["Python Compute\n(backtrader / backtesting.py)"]
    G --> H["Results → PostgreSQL"]
    H --> I["📊 Equity Curve\n& Metrics UI"]

    E -->|"Live / Heartbeat"| J["Node.js\nFlow Interpreter"]
    J -->|"Indicator nodes"| K["Python\n/compute/indicators"]
    J -->|"LLM nodes"| L["Python\n/compute/ai-analyze (ADK)"]
    K --> J
    L --> J
    J -->|"Action node"| M["Broker API\n(Alpaca · IG · IBKR)"]
    M --> N["📬 Notification\n(Telegram · Slack · SMS)"]
```

---

### n8n-Style Execution History

```mermaid
flowchart TD
    Run["ExecutionRun\n(BullMQ job completes)"] --> Log["Node.js logs\nper-node JSON snapshots\n→ PostgreSQL"]
    Log --> Viewer["Frontend\nExecution Viewer"]
    
    Viewer --> Green["🟢 Green node\n= executed OK"]
    Viewer --> Red["🔴 Red node\n= errored"]
    Viewer --> Gray["⚫ Gray node\n= skipped (condition false)"]
    Viewer --> Blue["🔵 Blue node\n= delegated to Python"]
    Viewer --> Hover["Hover → inspect\nJSON in / JSON out"]
```

---

### AI Strategy Generation Pipeline

```mermaid
flowchart LR
    A["User Prompt\n'RSI oversold + SMA cross'"] --> B["Node.js API\n(POST /generate)"]
    B --> C{"RAG Lookup\n(ChromaDB)"}
    C --> D["Relevant node\ndefinitions retrieved"]
    D --> E["LLM\n(Gemini / DeepSeek)"]
    E --> F["Generated\nNodes + Edges JSON"]
    F --> G{"Validator\n(TypeScript)"}
    G -->|"Invalid"| H["Auto-Fix\nPipeline"]
    H --> G
    G -->|"Valid"| I["ReactFlow Canvas\nloads strategy"]
```

---

## 🛠️ Technology Stack

| Layer | Technology | Role |
|---|---|---|
| **Frontend** | React 18 + Vite + TypeScript | Visual strategy builder UI |
| **UI Components** | Shadcn UI + Tailwind CSS | Design system |
| **Canvas** | ReactFlow (`@xyflow/react`) | Node-and-edge graph editor |
| **State** | Zustand | Client state management |
| **Orchestrator** | Bun + Express | API server, workflow orchestration |
| **Job Queue** | BullMQ + Redis | Heartbeat scheduling, async jobs |
| **Compute Service** | Python + FastAPI | Backtesting, indicators, AI agents |
| **Backtesting** | backtrader, backtesting.py, NautilusTrader | Strategy backtesting engines |
| **AI Orchestration** | Google ADK + Gemini | Autonomous trading agents |
| **LLM Providers** | Google Gemini + DeepSeek | Strategy generation + analysis |
| **RAG** | ChromaDB + vector_rag | Block retrieval for AI generation |
| **Data** | pandas, numpy, TA-Lib, yfinance, FMP | Market data processing |
| **Database** | PostgreSQL (prod) / SQLite (dev) | Primary data store |
| **Cache / Events** | Redis | BullMQ broker, pub/sub, caching |

---

## 📦 Installation & Setup

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- Python 3.10+
- Redis
- Git

### 1. Clone the Repository

```bash
git clone git@github.com:sinatooor/project-prometheus.git
cd project-prometheus
```

### 2. Frontend Setup

```bash
bun install
bun run dev
# Access at http://localhost:5173
```

### 3. Python Compute Service

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Add: GEMINI_API_KEY, DEEPSEEK_API_KEY, FMP_API_KEY
```

### 4. Running Services

```bash
# Terminal 1 — Python Compute Service
cd backend && conda activate fyer && uvicorn main:app --reload --port 8000

# Terminal 2 — React Frontend
bun run dev

# Terminal 3 — Node.js Orchestrator
cd orchestrator && bun run dev

# Terminal 4 — Redis (required for BullMQ)
redis-server
```

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React UI |
| Orchestrator | http://localhost:3000 | Bun API server |
| Python API | http://localhost:8000/docs | FastAPI Swagger (compute) |

### 5. Docker (Full Stack)

```bash
docker-compose up --build
```

---

## 🤖 ADK Trading Agent Tools

| Category | Tools |
|---|---|
| **Market Research** | `search_market_news`, `search_sentiment`, `search_economic_calendar`, `get_market_news` |
| **Web Research** | `scrape_url_text` |
| **Custom Indicators** | `create_custom_indicator`, `update`, `delete`, `list`, `get` |
| **Broker** | `execute_trade`, `get_positions`, `close_position`, `get_account_info`, `get_market_price` |
| **RAG** | `find_similar_blocks`, `get_block_info`, `list_block_categories` |
| **Risk & Strategy** | `run_monte_carlo_simulation`, `calculate_position_sizing`, `calculate_risk_metrics`, `calculate_correlation_matrix` |
| **Analysis** | `scan_candlestick_patterns`, `classify_market_regime` |
| **Memory** | `save_note`, `read_note`, `list_notes`, `append_to_note` |
| **Control** | `update_strategy_risk_settings`, `adjust_trade_size`, `emergency_stop_strategy` |

---

## 🧪 Testing Suite

| Test Suite | Command | Description |
|---|---|---|
| **E2E Test** | `python tests/e2e_test.py` | Full flow: AI Gen → Nodes → Backtest → Result |
| **Stress Test** | `python tests/stress_test.py` | 20 distinct scenarios for stability |
| **Benchmark** | `python tests/benchmark_test.py` | Validates against ground truth data |

---

## 📁 Project Structure

```
fyer/
├── src/                          # React Frontend
│   └── features/strategy-flow/  # ReactFlow strategy builder
│       ├── catalog/              # Node definitions by category
│       ├── components/           # Node visual components, panels
│       ├── generators/           # Python code generators
│       ├── store/                # Zustand state (strategyFlowStore.ts)
│       └── types.ts              # TypeScript node/edge types
├── backend/                      # Python Compute Service (FastAPI)
│   ├── adk_agents/               # Google ADK agents + tools
│   ├── flow/                     # Flow compiler + runtime
│   ├── strategy_flow/            # Strategy API router, backtrader engine
│   ├── routers/                  # FastAPI route sets
│   └── main.py                   # FastAPI entry point
├── prd/                          # Product Requirements Documents
│   └── StrategyFlow_PRD_v3.md    # Current PRD (Node.js + Python arch)
├── docker-compose.yml            # Full stack Docker setup
└── CHANGELOG.md                  # Version history
```

---

## 📄 License

Distributed under the MIT License.

---

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


good prompot " check folder /prd and then check if everything is build for the app, if not continue building    
   till it is done, it does not matter how much it takes or how many api calls, You can now begin   
   implementation.                                                                                  
   Follow the task tree.                                                                            
   After completing each module, summarize:                                                         
   - What you built                                                                                 
   - Tests run                                                                                      
                                                                                                    
   use commit and new branches when needed  "

   test@example.com
   test@example.com