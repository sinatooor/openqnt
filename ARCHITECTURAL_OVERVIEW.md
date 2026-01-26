# PPM (Project Prometheus) - Architectural Overview

**Last Updated:** 2026-01-26
**Version:** 2.0.0

## 1. System Overview

**PPM** is an advanced AI-powered algorithmic trading platform capable of:
1.  **Generative Strategy Creation**: Converting natural language requests into visual trading logic (Blockly).
2.  **Multi-Engine Backtesting**: Validating strategies using Python (`backtesting.py`) and Institutional engines (`NautilusTrader`).
3.  **Live Execution**: Executing trades in real-time via broker integrations (IG Markets).
4.  **AI Analysis**: Utilizing Google ADK (Agent Development Kit) for market research, sentiment analysis, and autonomous decision-making.

---

## 2. Technology Stack

### Frontend (User Interface)
*   **Framework**: React 18 + Vite (TypeScript)
*   **UI Library**: Shadcn UI + Tailwind CSS
*   **State Management**: Zustand + React Query
*   **Visualization**: Lightweight Charts (TradingView) + Recharts
*   **Visual Logic Editor**: Google Blockly (Customized for Trading)
*   **Code Generation**: Client-side Generators for Python and MQL5

### Backend (Core Logic)
*   **Server**: FastAPI (Python 3.10+)
*   **Database**: SQLite (SQLAlchemy ORM) - storing market data, strategies, and trade history.
*   **AI Orchestration**:
    *   **Google ADK**: Autonomous agents for research and analysis.
    *   **LLM Providers**: DeepSeek (Logic Generation) + Google Gemini (Multimodal/Agents).
    *   **RAG System**: Vector-based retrieval for selecting relevant strategy blocks.
*   **Trading Engines**:
    *   `backtesting.py`: Fast, vectorized backtesting (Primary).
    *   `NautilusTrader`: Event-driven, institutional-grade engine (Advanced).
    *   `IG Markets API`: Live trading integration.

---

## 3. Core Architecture

```mermaid
graph TD
    User[👤 User] -->|1. Chat / Prompt| UI[React Frontend]
    UI -->|2. Visual Layout| BW[Blockly Workspace]
    
    UI -->|3. API Requests| API[FastAPI Backend :8000]
    
    subgraph "Backend Services"
        API -->|Route| AS[Agent Service (ADK)]
        API -->|Route| BS[Backtest Service]
        API -->|Route| SG[Strategy Generator]
        API -->|Route| SR[Strategy Runner (Live)]
        
        AS -->|Tools| Tools{Agent Tools}
        Tools -->|Search| Web[Google Search]
        Tools -->|Data| FMP[Financial Modeling Prep]
        Tools -->|Calc| TA[Technical Analysis]
        
        BS -->|Execute| BT[backtesting.py]
        BS -->|Execute| NT[NautilusTrader]
        
        SR -->|Trade| IG[IG Markets API]
    end
    
    subgraph "AI Layer"
        SG -->|Prompt| DS[DeepSeek LLM]
        SG -->|Retrieval| RAG[Vector DB]
        AS -->|autonomous| Gemini[Google Gemini]
    end
    
    subgraph "Data Layer"
        BS --> DB[(SQLite DB)]
        SR --> DB
        DB -->|History| YF[yfinance]
    end
```

---

## 4. Key Pipelines

### A. AI Strategy Generation Pipeline
This pipeline converts a user's natural language idea into a working visual strategy.

1.  **Intent Analysis (RAG)**: The system analyzes the user's prompt (e.g., "RSI Reversal") and retrieves relevant block definitions from the `BLOCK_CATALOG.xml` using Vector RAG.
2.  **Plan Generation (GCG)**: DeepSeek creates a strictly formatted JSON execution plan (Grammar-Constrained Generation) to prevent hallucinations.
3.  **Compilation**: A deterministic compiler converts the JSON plan into valid Blockly XML.
4.  **Auto-Validation**: The generated strategy is checked for logical errors (e.g., comparing Price to RSI).
5.  **Frontend Load**: The XML is sent to the frontend and rendered as draggable blocks.

### B. Backtesting Pipeline
Validation of strategies against historical data.

1.  **Block to Code**: The Frontend (or Backend) converts the Blockly XML into valid Python code.
2.  **Engine Selection**:
    *   **Standard**: Uses `backtesting.py` for rapid results (seconds).
    *   **Advanced**: Uses `NautilusTrader` for event-based simulation (tick-level accuracy).
3.  **Data Fetching**:
    *   Checks local SQLite cache first.
    *   Falls back to external providers (FMP, yfinance) if data is missing.
4.  **Execution**: The selected engine runs the simulation.
5.  **Reporting**: Metrics (Sharpe, Drawdown, Return) and Equity Curves are returned to the UI.

### C. Live Trading Pipeline
Real-time execution of strategies.

1.  **Activation**: User activates a strategy in the "Live" tab.
2.  **Polling Loop**: The `StrategyRunner` service starts a dedicated process.
3.  **Market Data**: Fetches real-time price snapshots (e.g., every 1 minute) from the Broker API.
4.  **Signal Generation**: The Python strategy logic is evaluated against the new data.
5.  **Order Execution**: If a signal (Buy/Sell) is generated, an order is placed via the IG Markets API.
6.  **Monitoring**: Position status and P&L are pushed to the frontend via polling endpoints.

---

## 5. Directory Structure Key

| Path | Description |
|------|-------------|
| `src/` | **Frontend Code** (React components, hooks, logic). |
| `src/features/blockly/` | Custom Blockly configuration, themes, and blocks. |
| `backend/` | **Backend Root**. |
| `backend/main.py` | API Entry point (FastAPI). |
| `backend/adk_agents/` | Google ADK Agent logic and Tools definitions. |
| `backend/routers/` | API Route sets (Strategies, Backtests, Chat, Trade History). |
| `backend/fmp/` | Financial Modeling Prep API client. |
| `backend/data/` | Database and local storage. |
| `BLOCK_CATALOG.xml` | The "Brain" - Definitions of all available strategy blocks. |

---

## 6. Development Workflow

### Starting the Environment
1.  **Backend**:
    ```bash
    cd backend
    source venv/bin/activate
    uvicorn main:app --reload --port 8000
    ```
2.  **Frontend**:
    ```bash
    npm run dev
    ```

### Making Changes
*   **New Strategy Blocks**: Update `BLOCK_CATALOG.xml` and `frontend/src/features/blockly/blocks/`.
*   **New AI Tools**: Add functions to `backend/adk_agents/tools/` and register them in `backend/agent_service.py`.
*   **Database Schema**: Update `backend/database/models.py` (SQLAlchemy).
