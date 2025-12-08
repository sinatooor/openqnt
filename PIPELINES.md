# Application Pipelines Reference

This document describes all major pipelines in the PPM trading strategy application, step-by-step.

---

## 1. Strategy Generation Pipeline

**Purpose:** Convert natural language → Blockly XML visual strategy

### Flow Diagram
```
User Input (natural language)
        ↓
[Frontend: AIChatPanel.tsx]
        ↓
[Supabase Edge Function: generate-strategy]
        ↓ (uses Lovable/Gemini API)
Pass 1: Generate initial XML
        ↓
Pass 2: Validate XML structure
        ↓
Pass 3: Fix identical indicators (if crossover)
        ↓
Pass 4: Programmatic fallback fixes
        ↓
Return XML to frontend
        ↓
[Frontend: Load blocks into Blockly workspace]
```

### Step-by-Step

| Step | Location | Action |
|------|----------|--------|
| 1 | `AIChatPanel.tsx` | User types strategy description (e.g., "SMA crossover strategy") |
| 2 | `AIChatPanel.tsx` | Calls `supabase.functions.invoke('generate-strategy')` |
| 3 | `supabase/functions/generate-strategy/index.ts` | Sends prompt to Lovable/Gemini LLM |
| 4 | Supabase Function | LLM returns Blockly XML with strategy blocks |
| 5 | Supabase Function | Validates XML structure, fixes issues |
| 6 | `AIChatPanel.tsx` | Receives XML, calls `onBlocksGenerated(xml)` |
| 7 | `BlocklyWorkspace.tsx` | Parses XML and renders visual blocks |

### Key Files
- `src/features/ai/components/AIChatPanel.tsx` (frontend trigger)
- `supabase/functions/generate-strategy/index.ts` (LLM call + validation)

---

## 2. MQL5 Code Generation Pipeline

**Purpose:** Convert Blockly XML → compilable MQL5 Expert Advisor code

### Flow Diagram
```
Blockly Workspace XML
        ↓
[Frontend: Code Panel refresh button]
        ↓
Backend: POST /generate-mql
        ↓
[DeepSeek LLM]
        ↓
Clean MQL5 code returned
        ↓
Display in Code Panel
```

### Step-by-Step

| Step | Location | Action |
|------|----------|--------|
| 1 | `BlocklyWorkspace.tsx` | User clicks Code panel refresh |
| 2 | Frontend | Extracts workspace XML via `Blockly.Xml.workspaceToDom()` |
| 3 | Frontend | POST to `backend/generate-mql` |
| 4 | `backend/main.py` → `generate_mql()` | Sends XML to DeepSeek with MQL5 system prompt |
| 5 | DeepSeek | Returns complete MQL5 EA code |
| 6 | `main.py` | Cleans markdown formatting, returns code |
| 7 | Frontend | Displays in code panel |

### Key Files
- `src/features/blockly/components/BlocklyWorkspace.tsx` (frontend)
- `backend/main.py` → `generate_mql()` (backend)

---

## 3. Backtesting Pipeline

**Purpose:** Test strategy on historical data and return performance metrics

### Flow Diagram
```
User clicks "Run Backtest" (Settings Panel)
        ↓
[Frontend: SettingsPanel.tsx]
        ↓
Backend: POST /backtest
        ↓
[xml_evaluator.py] Parse XML → Extract conditions
        ↓
[ig_client.py] Fetch historical data (or use synthetic)
        ↓
[backtest_runner.py] Simulate trades
        ↓
Return metrics, trades, equity curve
        ↓
Display results in Settings Panel
```

### Step-by-Step

| Step | Location | Action |
|------|----------|--------|
| 1 | `SettingsPanel.tsx` | User selects symbol, dates, capital, clicks "Run Backtest" |
| 2 | `SettingsPanel.tsx` | POST to `/backtest` with workspace XML |
| 3 | `main.py` → `run_backtest_endpoint()` | Receives request |
| 4 | `xml_evaluator.py` | `BlocklyXMLEvaluator(xml)` parses buy/sell conditions |
| 5 | `ig_client.py` | Try fetching real data from IG API |
| 6 | `sample_data.py` | Fallback: generate synthetic OHLCV data |
| 7 | `backtest_runner.py` → `run_backtest_simple()` | Loop through bars, evaluate conditions, simulate trades |
| 8 | `backtest_runner.py` | Calculate metrics (win rate, return, drawdown, Sharpe) |
| 9 | `main.py` | Return `BacktestResponse` with metrics, trades, equity_curve |
| 10 | `SettingsPanel.tsx` | Display results card |

### Key Files
- `src/components/SettingsPanel.tsx` (frontend)
- `backend/main.py` → `run_backtest_endpoint()` (API)
- `backend/xml_evaluator.py` → `BlocklyXMLEvaluator` (parser)
- `backend/backtest_runner.py` → `run_backtest_simple()` (simulator)

---

## 4. Live Strategy Running Pipeline

**Purpose:** Execute strategy against live market data with real trades

### Flow Diagram
```
User clicks "Launch Strategy" (Settings Panel - Live tab)
        ↓
[Frontend: SettingsPanel.tsx]
        ↓
Backend: POST /strategy/start
        ↓
[xml_evaluator.py] Parse XML → Python logic
        ↓
[LLM Verification via DeepSeek] Verify Python matches XML
        ↓
[strategy_runner.py] Start polling loop
        ↓
Every 60s: Fetch prices → Evaluate conditions → Execute trades
        ↓
User clicks "Stop Strategy"
        ↓
Backend: POST /strategy/stop
```

### Step-by-Step

| Step | Location | Action |
|------|----------|--------|
| 1 | `SettingsPanel.tsx` | User switches to "Live" tab, clicks "Launch Strategy" |
| 2 | `SettingsPanel.tsx` | POST to `/strategy/start` with XML, symbol, size |
| 3 | `main.py` → `start_strategy()` | Get IG client, verify authentication |
| 4 | `strategy_runner.py` → `start_strategy_runner()` | Create `LLMVerifiedEvaluator` |
| 5 | `xml_evaluator.py` → `LLMVerifiedEvaluator.verify()` | Generate Python logic, call DeepSeek for verification |
| 6 | DeepSeek | Verify/correct Python logic |
| 7 | `strategy_runner.py` | Create `StrategyRunner` with verified evaluator |
| 8 | `StrategyRunner.start()` | Begin async polling loop |
| 9 | Every tick (60s): | |
|  | `_tick()` | Fetch latest prices from IG |
|  | `evaluator.calculate_indicators()` | Calculate SMA, RSI, etc. |
|  | `evaluator.should_buy/sell()` | Evaluate conditions |
|  | `_execute_signals()` | If signal, execute trade via IG API |
| 10 | User stops | POST `/strategy/stop` → `stop_strategy_runner()` |

### Key Files
- `src/components/SettingsPanel.tsx` (frontend)
- `backend/main.py` → `start_strategy()`, `stop_strategy()` (API)
- `backend/strategy_runner.py` → `StrategyRunner` (execution loop)
- `backend/xml_evaluator.py` → `LLMVerifiedEvaluator` (verification)
- `backend/ig_client.py` → `IGClient` (trading API)

---

## 5. Chat/Q&A Pipeline

**Purpose:** Answer trading questions without generating blocks

### Flow Diagram
```
User types question (in Chat mode)
        ↓
[Frontend: AIChatPanel.tsx]
        ↓
Backend: POST /chat
        ↓
[DeepSeek LLM] Generate response
        ↓
Return markdown response
        ↓
Display in chat
```

### Step-by-Step

| Step | Location | Action |
|------|----------|--------|
| 1 | `AIChatPanel.tsx` | User switches to "Chat" mode, types question |
| 2 | `AIChatPanel.tsx` | POST to `/chat` with message history |
| 3 | `main.py` → `chat()` | Format messages for DeepSeek |
| 4 | DeepSeek | Generate helpful trading response |
| 5 | `main.py` | Return response |
| 6 | `AIChatPanel.tsx` | Display markdown-formatted response |

### Key Files
- `src/features/ai/components/AIChatPanel.tsx` (frontend)
- `backend/main.py` → `chat()` (backend)

---

## 6. IG Trading Pipeline (Direct Trades)

**Purpose:** Execute manual trades via IG Markets API

### Flow Diagram
```
User clicks Buy/Sell in IGTradingPanel
        ↓
[Frontend: IGTradingPanel.tsx]
        ↓
Backend: POST /ig/trade
        ↓
[ig_client.py] Create position via IG REST API
        ↓
Return deal confirmation
```

### Step-by-Step

| Step | Location | Action |
|------|----------|--------|
| 1 | `IGTradingPanel.tsx` | User enters size, clicks Buy/Sell |
| 2 | Frontend | POST to `/ig/trade` or `/ig/position` |
| 3 | `main.py` → `ig_create_position()` | Get IG client |
| 4 | `ig_client.py` → `create_position()` | Call IG REST API |
| 5 | IG API | Create position, return deal reference |
| 6 | Frontend | Show success/error toast |

### Key Files
- `src/components/IGTradingPanel.tsx` (frontend)
- `backend/main.py` (API endpoints)
- `backend/ig_client.py` → `IGClient` (IG API wrapper)

---

## Summary: API → LLM Mapping

| Pipeline | LLM Used | Endpoint |
|----------|----------|----------|
| Strategy Generation | **Supabase (Gemini/Lovable)** | Supabase Edge Function |
| MQL5 Generation | **DeepSeek** | `/generate-mql` |
| Chat Q&A | **DeepSeek** | `/chat` |
| XML Verification | **DeepSeek** | (internal) |
| Backtest | None (rule-based) | `/backtest` |
| Live Trading | DeepSeek (verification only) | `/strategy/start` |
