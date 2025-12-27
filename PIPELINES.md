# Application Pipelines Reference

This document describes all major pipelines in the PPM trading strategy application with comprehensive flow diagrams.

---

## Complete System Architecture

```mermaid
flowchart TB
    subgraph Frontend["🖥️ Frontend (React/TypeScript)"]
        UI[("User Interface")]
        BW["BlocklyWorkspace.tsx"]
        AIC["AIChatPanel.tsx"]
        SP["BacktestingPanel.tsx"]
        
        subgraph Generators["Code Generators"]
            MQL["mqlGenerator.ts"]
            PY["pyGenerator.ts"]
            JS["javascriptGenerator"]
        end
    end
    
    subgraph Backend["⚙️ Backend (FastAPI/Python)"]
        MAIN["main.py"]
        
        subgraph Engines["Backtest Engines"]
            E1["Simple (regex)"]
            E2["backtesting.py"]
            E3["NautilusTrader"]
        end
        
        subgraph Services["Services"]
            XML["xml_evaluator.py"]
            BS["backtest_service.py"]
            SR["strategy_runner.py"]
            IG["ig_client.py"]
        end
    end
    
    subgraph External["☁️ External Services"]
        DS["DeepSeek API"]
        GEM["Gemini API"]
        IGM["IG Markets API"]
        YF["yfinance / AlphaVantage"]
    end
    
    UI --> BW
    UI --> AIC
    UI --> SP
    BW --> Generators
    AIC --> MAIN
    SP --> MAIN
    MAIN --> Engines
    MAIN --> Services
    Services --> External
    MAIN --> DS
    AIC -.-> GEM
```

---

## 1. Strategy Generation Pipeline

**Purpose:** Convert natural language → Blockly XML visual strategy

```mermaid
flowchart LR
    subgraph Input
        U["👤 User Prompt"]
    end
    
    subgraph Frontend
        AIC["AIChatPanel.tsx"]
    end
    
    subgraph Mode1["Gemini Mode (Default)"]
        SUP["Supabase Edge Function"]
        GEM["Gemini/Lovable API"]
    end
    
    subgraph Mode2["DeepSeek Mode"]
        BE1["/generate-strategy"]
        DSK1["DeepSeek LLM"]
    end
    
    subgraph Validation
        VAL["/validate-strategy"]
        DSR["DeepSeek Reasoning"]
        FIX["Programmatic Fixes"]
    end
    
    subgraph Output
        BL["📦 Blockly Workspace"]
    end
    
    U --> AIC
    AIC -->|"Toggle OFF"| SUP --> GEM --> VAL
    AIC -->|"Toggle ON"| BE1 --> DSK1 --> VAL
    VAL --> DSR --> FIX --> BL
```

### Key Files
| File | Purpose |
|------|---------|
| `src/features/ai/components/AIChatPanel.tsx` | UI + toggle controls |
| `supabase/functions/generate-strategy/index.ts` | Gemini LLM call |
| `backend/main.py` → `/generate-strategy` | DeepSeek generation |
| `backend/main.py` → `/validate-strategy` | DeepSeek Reasoning validation |

---

## 2. Code Generation Pipelines

### MQL5 Generation (LLM-Based)
```mermaid
flowchart LR
    BW["Blockly XML"] --> API["/generate-mql"] --> DS["DeepSeek LLM"] --> MQL["MQL5 Code"]
```

### Python Generation (Deterministic)
```mermaid
flowchart LR
    BW["Blockly Workspace"] --> PG["pyGenerator.ts"] --> PY["Python Code"]
    PG --> |"Indicators"| TALIB["TA-Lib Wrappers"]
    PG --> |"Fallback"| NUMPY["NumPy Implementations"]
```

### Key Files
| Generator | File | Output |
|-----------|------|--------|
| MQL5 | `backend/main.py` → `generate_mql()` | MetaTrader EA |
| Python | `src/config/blockly/pyGenerator.ts` | backtesting.py Strategy |
| JavaScript | `src/config/blockly/generator.ts` | Browser execution |

---

## 3. Backtest Engine Comparison

```mermaid
flowchart TB
    subgraph UI["User Selects Engine"]
        SEL{{"Backtest Engine Dropdown"}}
    end
    
    subgraph Engines
        E1["🟢 Simple (Fast)"]
        E2["🟡 TechnicalIndicators"]
        E3["🔵 PyGenerator ⭐"]
        E4["🟠 Python AI-Generated"]
        E5["🟣 NautilusTrader"]
        E6["⚫ AI Simulation"]
    end
    
    subgraph Processing
        P1["xml_evaluator.py
        Regex Parse → Loop"]
        P2["technicalindicators.js
        Browser-Only"]
        P3["pyGenerator.ts → /backtest-py-code
        backtesting.py + TA-Lib"]
        P4["DeepSeek → backtesting.py
        LLM Writes Code"]
        P5["NautilusTrader Engine
        Event-Driven C++"]
        P6["DeepSeek → Simulate
        LLM Interprets"]
    end
    
    SEL --> E1 --> P1
    SEL --> E2 --> P2
    SEL --> E3 --> P3
    SEL --> E4 --> P4
    SEL --> E5 --> P5
    SEL --> E6 --> P6
```

### Engine Details

| Engine | Speed | Reliability | LLM? | Best For |
|--------|-------|-------------|------|----------|
| Simple (Fast) | ⭐⭐⭐⭐ | ⭐⭐ | No | Quick checks |
| TechnicalIndicators | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | No | Offline testing |
| **PyGenerator** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **No** | **Production** |
| Python (AI-Gen) | ⭐⭐ | ⭐⭐ | Yes | Complex logic |
| NautilusTrader | ⭐⭐⭐⭐ | ⭐⭐ | Yes | HFT simulation |
| AI Simulation | ⭐ | ⭐ | Yes | Exploration |

---

## 4. PyGenerator Pipeline (Recommended)

```mermaid
flowchart TB
    subgraph Frontend["Frontend (TypeScript)"]
        WS["Blockly Workspace"]
        PG["pyGenerator.ts"]
        CODE["Python Source Code"]
    end
    
    subgraph Backend["Backend (Python)"]
        EP["/backtest-py-code"]
        AST["AST Security Check"]
        FETCH["Fetch Market Data"]
        BT["backtesting.py"]
        EXEC["Strategy.init() / next()"]
    end
    
    subgraph Output
        METRICS["📊 Metrics"]
        TRADES["📈 Trades"]
        EQUITY["📉 Equity Curve"]
    end
    
    WS --> PG
    PG -->|"Block Mapping"| CODE
    CODE --> EP
    EP --> AST --> FETCH --> BT --> EXEC
    EXEC --> METRICS
    EXEC --> TRADES
    EXEC --> EQUITY
```

### pyGenerator Block Mapping
```mermaid
flowchart LR
    subgraph Blocks["Blockly Blocks"]
        B1["ta_sma"]
        B2["ta_ema"]
        B3["ta_rsi"]
        B4["trade_order"]
        B5["operator_greater"]
    end
    
    subgraph Python["Generated Python"]
        P1["self.I(SMA, Close, n)"]
        P2["self.I(EMA, Close, n)"]
        P3["self.I(RSI, Close, n)"]
        P4["self.buy() / self.sell()"]
        P5["value_a > value_b"]
    end
    
    B1 --> P1
    B2 --> P2
    B3 --> P3
    B4 --> P4
    B5 --> P5
```

---

## 5. Live Trading Pipeline

```mermaid
flowchart TB
    subgraph Frontend
        UI["Settings Panel - Live Tab"]
    end
    
    subgraph Backend
        START["/strategy/start"]
        EVAL["LLMVerifiedEvaluator"]
        RUNNER["StrategyRunner"]
        LOOP["Polling Loop (60s)"]
    end
    
    subgraph IG["IG Markets"]
        PRICES["Real-time Prices"]
        TRADE["Execute Trade"]
    end
    
    UI -->|"Launch"| START
    START --> EVAL -->|"DeepSeek Verify"| RUNNER
    RUNNER --> LOOP
    LOOP -->|"Fetch"| PRICES
    LOOP -->|"If Signal"| TRADE
    
    UI -->|"Stop"| STOP["/strategy/stop"]
    STOP --> RUNNER
```

### Key Files
| File | Purpose |
|------|---------|
| `backend/strategy_runner.py` | Async polling loop |
| `backend/xml_evaluator.py` | LLM-verified evaluator |
| `backend/ig_client.py` | IG Markets API wrapper |

---

## 6. Data Flow Summary

```mermaid
flowchart LR
    subgraph Sources["Data Sources"]
        YF["yfinance"]
        AV["AlphaVantage"]
        IG["IG Markets API"]
        DB["Local SQLite DB"]
    end
    
    subgraph Backend
        BS["backtest_service.py"]
    end
    
    subgraph Priority
        P1["1. Local DB"]
        P2["2. AlphaVantage"]
        P3["3. yfinance"]
    end
    
    DB --> P1 --> BS
    AV --> P2 --> BS
    YF --> P3 --> BS
    IG --> BS
```

---

## API → LLM Mapping

```mermaid
flowchart TB
    subgraph Endpoints
        E1["/generate-strategy"]
        E2["/validate-strategy"]
        E3["/generate-mql"]
        E4["/chat"]
        E5["/backtest"]
        E6["/backtest-py-code"]
        E7["/strategy/start"]
    end
    
    subgraph LLMs
        DS["DeepSeek"]
        DSR["DeepSeek Reasoning"]
        GEM["Gemini (Supabase)"]
        NONE["No LLM"]
    end
    
    E1 --> DS
    E2 --> DSR
    E3 --> DS
    E4 --> DS
    E5 -->|"ai_simulation"| DS
    E5 -->|"other engines"| NONE
    E6 --> NONE
    E7 -->|"verification"| DS
```

| Endpoint | LLM Used | Notes |
|----------|----------|-------|
| `/generate-strategy` | DeepSeek | Full block catalog |
| `/validate-strategy` | DeepSeek Reasoning | Multi-pass validation |
| `/generate-mql` | DeepSeek | XML → MQL5 |
| `/chat` | DeepSeek | Q&A mode |
| `/backtest-py-code` | **None** | PyGenerator (fastest) |
| `/backtest` (legacy) | Optional | Depends on engine |
| `/strategy/start` | DeepSeek | Verification only |

---

## Quick Reference: File → Function → Purpose

| Layer | Key File | Main Function | Purpose |
|-------|----------|--------------|---------|
| Frontend | `pyGenerator.ts` | `workspaceToCode()` | Blocks → Python |
| Frontend | `mqlGenerator.ts` | `workspaceToCode()` | Blocks → MQL5 |
| Frontend | `AIChatPanel.tsx` | `handleSend()` | AI strategy prompt |
| Frontend | `BacktestingPanel.tsx` | `handleRunBacktest()` | Engine dispatcher |
| Backend | `main.py` | `backtest_py_code()` | Execute Python |
| Backend | `main.py` | `generate_strategy()` | DeepSeek generation |
| Backend | `backtest_service.py` | `run_backtest()` | Backtesting logic |
| Backend | `xml_evaluator.py` | `BlocklyXMLEvaluator` | XML parser |
| Backend | `strategy_runner.py` | `StrategyRunner` | Live execution |
| Backend | `ig_client.py` | `IGClient` | Trading API |
