# Application Architecture & Logic Analysis

## 1. Overview
**PPM (Project Fire)** is a comprehensive algorithmic trading platform that bridges visual programming with professional trading execution. It allows users to build trading strategies using a drag-and-drop interface (Blockly), backtest them against historical data, and execute them live on IG Markets. The platform is enhanced with AI capabilities for strategy generation and verification.

## 2. Technology Stack

### Frontend
- **Framework**: React (Vite)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Shadcn UI
- **State Management**: React Hooks / Context
- **Visual Editor**: Google Blockly
- **Charting**: Lightweight Charts (implied)

### Backend
- **Framework**: FastAPI (Python)
- **AI Engine**: DeepSeek API (via `httpx`)
- **Trading Integration**: IG Markets API (`trading_ig` library wrapper)
- **Data Processing**: Pandas, NumPy
- **Backtesting**: Custom engine + NautilusTrader (partial integration)

---

## 3. Core Pipelines & Logic

### A. Visual Strategy Creation (Blockly)
**Goal**: Enable non-coders to build complex trading logic.
- **Input**: User drags blocks (Logic, Math, Indicators, Trade Actions) onto the canvas.
- **Process**:
    1.  **Blockly Workspace**: Manages the state of blocks.
    2.  **XML Generation**: The workspace state is serialized to XML.
    3.  **Code Generation**:
        - **Python**: Custom generator converts blocks to Python code for backtesting.
        - **MQL4**: Generator for MetaTrader 4 export (legacy/alternative feature).
- **Key Component**: `src/features/blockly/components/BlocklyWorkspace.tsx`

### B. AI Integration (DeepSeek)
**Goal**: Assist users in creating and verifying strategies.
- **Conversational Chat**:
    - **Endpoint**: `POST /chat`
    - **Logic**: Accepts user messages, maintains context, and returns AI responses about trading/coding.
- **Strategy Generation**:
    - **Endpoint**: `POST /generate-strategy`
    - **Logic**: User describes a strategy in English -> LLM generates Blockly XML -> Frontend loads XML into workspace.
- **Logic Verification** (New):
    - **Process**: Before live trading, the XML and its Python translation are sent to the LLM.
    - **Goal**: Verify that the Python logic accurately reflects the visual blocks.
    - **File**: `backend/xml_evaluator.py`

### C. Backtesting Pipeline
**Goal**: Validate strategies before risking capital.
- **Endpoint**: `POST /backtest`
- **Logic Flow**:
    1.  **Input**: Blockly XML + Configuration (Symbol, Date Range, Balance).
    2.  **Data Fetching**:
        - **Real Data**: If authenticated with IG, fetches historical OHLCV data (`fetch_real_data_from_ig`).
        - **Synthetic Fallback**: If offline, generates realistic random walk data (`sample_data.py`).
    3.  **Strategy Conversion**: XML is converted to executable Python strategy code (`strategy_converter.py`).
    4.  **Execution**: `backtest_runner.py` iterates through data, evaluating logic and simulating trades.
    5.  **Output**: Equity curve, trade list, and performance metrics (Win Rate, Drawdown, etc.).

### D. Live Trading Pipeline (IG Markets)
**Goal**: Execute strategies in real-time.
- **Components**:
    - **IGTradingPanel**: Frontend UI for connection, manual trading, and strategy control.
    - **StrategyRunner**: Backend service managing the execution loop.
- **Logic Flow**:
    1.  **Start**: User clicks "Run Strategy".
    2.  **Initialization**: `strategy_runner.py` initializes with the XML.
    3.  **Verification**: `LLMVerifiedEvaluator` checks XML-to-Python translation.
    4.  **Loop** (every 60s):
        - **Poll**: Fetch latest prices from IG.
        - **Calculate**: Compute indicators (SMA, RSI, etc.) via `xml_evaluator.py`.
        - **Evaluate**: Check `should_buy` / `should_sell` conditions.
        - **Execute**: If signal triggers, call IG API to Open/Close positions.
    5.  **Feedback**: Status updates sent to frontend (Position, P&L, Signals).

---

## 4. Key Backend Modules

| File | Purpose |
|------|---------|
| `main.py` | **API Gateway**. Handles HTTP requests, routes to services, manages global state. |
| `ig_client.py` | **IG Adapter**. Handles authentication, price fetching, and order execution. |
| `xml_evaluator.py` | **Logic Engine**. Parses Blockly XML, calculates indicators, evaluates conditions. Includes LLM verification. |
| `strategy_runner.py` | **Execution Service**. Manages the live trading loop, polling, and trade lifecycle. |
| `backtest_runner.py` | **Simulation Engine**. Runs strategies against historical data. |
| `strategy_converter.py` | **Code Transpiler**. Uses LLM to convert XML to NautilusTrader/Python code. |
| `llm_verified_evaluator.py` | **LLM Verification Service**. Verifies XML-to-Python translation using LLM. |
| `block_python_map.json` | **Block to Python Mapping**. Maps Blockly blocks to Python code. |
| `blockly_generator.py` | **Blockly Generator**. Converts Python code to Blockly XML. |
| `backtesting.py` | **Backtesting Engine**. main and best backtesting engine. |

## 5. Key Frontend Features

| Feature | Description |
|---------|-------------|
| **Blockly Workspace** | The core canvas for building strategies. |
| **IG Trading Panel** | Sidebar for IG connection, manual trades, and auto-strategy control. |
| **AI Chat Panel** | Assistant for answering questions and generating strategies. |
| **Backtest Panel** | UI for configuring and running backtests, displaying results/charts. |

## 6. Data Flow Summary

1.  **User Action** (Frontend) -> **API Request** (FastAPI)
2.  **API Layer** -> **Service Layer** (Runner/Client)
3.  **Service Layer** -> **External API** (IG / DeepSeek)
4.  **Response** -> **Frontend State Update** (React)

This architecture separates concerns effectively: the **Frontend** handles visualization and user intent, the **Backend** handles heavy computation, integration, and security, and **External Services** provide the data and intelligence.
