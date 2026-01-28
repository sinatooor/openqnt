# Strategy Flow - Product Requirements Document

## Overview

Strategy Flow is a visual, node-based trading strategy builder that allows users to create, backtest, and execute trading strategies without writing code. It uses ReactFlow for the visual canvas and integrates with backtrader for backtesting and live trading execution.

## Goals

1. **Visual Strategy Building**: Enable users to create trading strategies by connecting visual nodes
2. **AI-Powered Generation**: Allow users to describe strategies in natural language and generate node configurations
3. **Comprehensive Backtesting**: Provide detailed backtesting with performance metrics and visualizations
4. **Live Trading**: Execute strategies in real-time with broker integration (Binance)
5. **No-Code Experience**: Make algorithmic trading accessible to non-programmers

## Target Users

- Retail traders who want to automate strategies without coding
- Quantitative analysts who prefer visual workflow design
- Trading educators demonstrating strategy concepts
- Developers prototyping trading ideas quickly

---

## Core Features

### 1. Visual Node Canvas

**Node Categories:**
- **Indicators**: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic, ADX, etc.
- **Conditions**: Compare, Crossover, Crossunder, Threshold, Range, Logical operators
- **Actions**: Order (Buy/Sell), Close Position, Stop Loss, Take Profit, Trailing Stop
- **Environment**: Price, Spread, Time, Market Status, Previous Candle data
- **Control**: If/Else, Repeat, Wait, Stop
- **Math**: Add, Subtract, Multiply, Divide, Advanced functions
- **Risk**: Position sizing, Kelly Criterion, Max Drawdown limits
- **Variables**: Set/Get/Change variables, Functions

**Node Features:**
- Drag-and-drop from categorized palette
- Color-coded by category
- Configurable parameters in property panel
- Multi-output support (e.g., MACD Line/Signal/Histogram)
- Detachable parameters (value from input edge instead of fixed)

### 2. Connection System

**Edge Types:**
- Number (purple) - Numeric values
- Boolean (amber) - True/False signals
- Signal (cyan) - Trading signals
- Any (gray) - Universal compatibility

**Connection Rules:**
- Type validation on connection attempt
- Visual feedback for valid/invalid connections
- Auto-routing for clean layouts

### 3. AI Strategy Generator

**Features:**
- Natural language input ("Create an RSI oversold strategy")
- Generate complete node + edge configurations
- Modify existing strategies via chat
- Two modes: Generate (create nodes) and Chat (Q&A)
- Fast/Slow mode for generation quality

**Backend Integration:**
- Primary LLM: Gemini 2.5 Pro
- Fallback: DeepSeek
- Validation pipeline with auto-fix
- Node definitions as context for accurate generation

### 4. Backtesting Engine

**Engine:** Backtrader (Python)

**Configuration:**
- Symbol selection (Forex, Crypto, Stocks)
- Timeframe (1m to 1w)
- Date range
- Initial capital
- Position size (%)
- Commission and slippage
- Leverage

**Results:**
- Total Return %
- Win Rate
- Total Trades
- Max Drawdown
- Sharpe Ratio
- Profit Factor
- Sortino Ratio
- Calmar Ratio
- Average Holding Time
- Equity curve visualization
- Trade-by-trade breakdown

### 5. Live Trading

**Supported Brokers:**
- Binance (Spot & Futures)
- Paper trading mode

**Features:**
- API key configuration
- Real-time position monitoring
- Order execution
- Emergency stop (panic button)
- Trade history logging

---

## Technical Architecture

### Frontend (React + TypeScript)

```
src/features/strategy-flow/
├── components/
│   ├── StrategyFlowCanvas.tsx    # Main ReactFlow canvas
│   ├── LeftSidebar.tsx           # Node palette
│   ├── RightPropertyPanel.tsx    # Node configuration
│   ├── AIChatPanel.tsx           # AI assistant (glassmorphism)
│   ├── nodes/                    # Node visual components
│   └── modals/
│       ├── BacktestModal.tsx     # Backtesting configuration
│       ├── LiveTradingPanel.tsx  # Live trading controls
│       └── SettingsModal.tsx     # Broker API keys
├── catalog/
│   └── nodes/                    # Node definitions by category
├── data/
│   └── nodeDefinitions.json      # Complete node specs with Python code
├── generators/
│   └── pythonGenerator.ts        # Flow to Python code
├── store/
│   └── strategyFlowStore.ts      # Zustand state management
└── types.ts                      # TypeScript definitions
```

### Backend (FastAPI + Python)

```
backend/strategy_flow/
├── __init__.py
├── router.py                     # API endpoints
├── ai_generator.py               # LLM-based flow generation
├── validator.py                  # Flow validation & auto-fix
├── backtrader_engine.py          # Backtrader integration
├── live_executor.py              # Live trading with Binance
└── prompts/
    ├── flow_system_prompt.txt    # AI generation prompt
    └── flow_validation_prompt.txt # Validation prompt
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/strategy-flow/generate` | POST | Generate flow from natural language |
| `/api/strategy-flow/chat` | POST | Conversational Q&A about strategies |
| `/api/strategy-flow/validate` | POST | Validate flow configuration |
| `/api/strategy-flow/compile` | POST | Compile flow to Python code |
| `/api/strategy-flow/backtest` | POST | Run backtest with backtrader |
| `/api/strategy-flow/live/start` | POST | Start live trading |
| `/api/strategy-flow/live/stop` | POST | Stop live trading |
| `/api/strategy-flow/live/status` | GET | Get live trading status |

---

## Node Definitions Schema

Each node in `nodeDefinitions.json` follows this structure:

```json
{
  "type": "sma",
  "nodeType": "indicator",
  "label": "SMA",
  "description": "Simple Moving Average",
  "category": "indicators",
  "subcategory": "Moving Averages",
  "icon": "TrendingUp",
  "color": "#8b5cf6",
  "pythonCode": "talib.SMA({{price}}, timeperiod={{period}})",
  "backtraderCode": "bt.indicators.SMA(self.data.{{price}}, period={{period}})",
  "inputs": [
    {
      "id": "price",
      "label": "Price",
      "dataType": "number",
      "required": true,
      "default": "close"
    }
  ],
  "outputs": [
    {
      "id": "value",
      "label": "Value",
      "dataType": "number"
    }
  ],
  "params": [
    {
      "id": "period",
      "label": "Period",
      "type": "number",
      "default": 14,
      "min": 1,
      "max": 500,
      "canDetach": true
    }
  ],
  "connections": {
    "canConnectTo": ["condition", "math", "indicator"],
    "canReceiveFrom": ["environment", "indicator", "math"]
  }
}
```

### Detachable Parameters

Parameters with `canDetach: true` can be:
1. **Attached**: User enters a fixed value in the property panel
2. **Detached**: Parameter becomes a node input, value comes from connected edge

This enables dynamic parameter values (e.g., ATR-based stop loss distances).

---

## UI/UX Requirements

### AI Chat Panel (Glassmorphism Style)

- Width: 288px (w-72)
- Background: `bg-card/80 backdrop-blur-xl`
- Border: `border-l border-white/10`
- User messages: `bg-pink-500/20` (pink tint)
- Assistant messages: `bg-muted`
- Primary buttons: `bg-pink-500 hover:bg-pink-600`
- Loading: Pink spinner with progress bar
- Mode toggle: Generate / Chat
- Speed toggle: Fast / Slow (Precise)

### Backtest Modal

- Full-featured configuration panel
- Single engine (backtrader - no engine selection)
- Results display:
  - Summary cards (Return, Win Rate, Trades, Drawdown)
  - Performance metrics grid
  - Equity curve chart
  - Trade list table
- Actions: Open Chart, Download Report, Run Again

### Node Styling

- Dark theme with category-based colors
- Indicators: Purple (#8b5cf6)
- Conditions: Cyan (#06b6d4)
- Actions: Green (#10b981)
- Environment: Blue (#3b82f6)
- Math: Orange (#f97316)
- Risk: Red (#ef4444)
- Control: Gray (#6b7280)

---

## Data Flow

```
User Input (Natural Language)
    ↓
AI Generator (LLM + Node Definitions)
    ↓
Flow Validator (Type check, Connection rules)
    ↓
Auto-Fix (Common issues)
    ↓
Nodes + Edges (ReactFlow)
    ↓
Python Code Generator
    ↓
Backtrader Strategy Class
    ↓
Backtest / Live Execution
    ↓
Results + Visualization
```

---

## Validation Rules

1. **Required Nodes**: Strategy must have at least one indicator/environment and one action node
2. **Type Compatibility**: Connected nodes must have compatible data types
3. **No Cycles**: Cycles not allowed unless explicitly enabled
4. **Required Inputs**: All required input handles must be connected
5. **Scale Compatibility**: Price-based indicators cannot be directly compared with oscillators
6. **Trade ID Uniqueness**: Each trade order must have a unique ID

---

## Performance Requirements

- Canvas should handle 100+ nodes smoothly
- Backtest should complete within 30 seconds for 1 year of daily data
- AI generation should respond within 10 seconds
- Live trading latency < 100ms for order execution

---

## Security Considerations

- API keys stored securely (encrypted at rest)
- Paper trading mode for testing
- Position size limits to prevent accidents
- Emergency stop functionality
- Rate limiting on API endpoints

---

## Future Enhancements

1. Multi-broker support (Interactive Brokers, Alpaca)
2. Walk-forward optimization
3. Monte Carlo simulation
4. Strategy marketplace/sharing
5. Mobile app for monitoring
6. Portfolio-level backtesting
7. Custom indicator creation
8. Machine learning node types
