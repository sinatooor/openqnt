## Strategy Flow System

This implementation provides an end-to-end ReactFlow strategy builder, compiler, backtesting engine, Monte Carlo simulation, and live execution runtime.

### Architecture
- **ReactFlow Builder**: `src/features/strategy-flow` (nodes, palette, validation, code view).
- **Compiler**: `backend/flow/compiler.py` (graph validation, topological sort, Python module generation).
- **Runtime**: `backend/flow/runtime.py` (graph interpreter, indicator cache, order intents).
- **Backtesting Engine**: `backend/engine/backtester.py` (bar loop, order fills, PnL, metrics).
- **Monte Carlo**: `backend/engine/monte_carlo.py` (trade shuffle / return bootstrap).
- **Live Engine**: `backend/engine/live_engine.py` (bar-based loop, broker interface, persistence).
- **Schema**: `backend/flow/strategy_graph.schema.json`.

### Flow Strategy JSON
- **Schema**: `backend/flow/strategy_graph.schema.json`
- **Shape**:
  - `nodes[]`: ReactFlow nodes (`id`, `type`, `position`, `data`)
  - `edges[]`: ReactFlow edges (`source`, `target`, optional handles)
  - `settings`: runtime settings (symbol, allowCycles, etc.)

### Compiler Pipeline
1. Validate graph (type checking, required inputs, cycle detection).
2. Topological sort for deterministic evaluation order.
3. Build `inputs` map + indicator definitions.
4. Emit Python code embedding compiled graph.

### Runtime Strategy Interface
Generated code exports a `GeneratedStrategy` class extending `FlowStrategy`:
- `on_bar(bar, history, index, portfolio, indicator_cache)` → list of `OrderIntent`.

### Backtest Outputs
`BacktestEngine` returns:
- `equity_curve`: `[{timestamp, equity}]`
- `trades`: list of trades with entry/exit/pnl
- `fills`: execution log
- `metrics`: Sharpe, Sortino, MDD, win rate, expectancy, total trades
- `per_bar`: per-bar portfolio snapshot

### Monte Carlo Outputs
`run_monte_carlo` returns:
- distributions for final equity and max drawdown
- monthly return distribution
- risk-of-ruin probability

### Example Strategy Graph (SMA Crossover)
```json
{
  "version": "2.0.0",
  "settings": { "name": "SMA Crossover", "symbol": "AAPL" },
  "nodes": [
    { "id": "sma_fast", "type": "indicator", "position": { "x": 100, "y": 100 }, "data": { "label": "SMA 10", "indicatorType": "sma", "timeframe": "60", "params": { "period": 10 } } },
    { "id": "sma_slow", "type": "indicator", "position": { "x": 100, "y": 200 }, "data": { "label": "SMA 20", "indicatorType": "sma", "timeframe": "60", "params": { "period": 20 } } },
    { "id": "cross_up", "type": "condition", "position": { "x": 350, "y": 140 }, "data": { "label": "Cross Up", "conditionType": "crossover" } },
    { "id": "order", "type": "action", "position": { "x": 600, "y": 140 }, "data": { "label": "Buy", "actionType": "order", "direction": "long", "orderType": "market", "size": 1 } }
  ],
  "edges": [
    { "id": "e1", "source": "sma_fast", "target": "cross_up", "targetHandle": "input-a" },
    { "id": "e2", "source": "sma_slow", "target": "cross_up", "targetHandle": "input-b" },
    { "id": "e3", "source": "cross_up", "target": "order", "targetHandle": "trigger" }
  ]
}
```

### Chart Data Formats
Use these formats for front-end charts:
- **Price + trades**: `[{timestamp, open, high, low, close, entries:[], exits:[]}]`
- **Equity curve**: `[{timestamp, equity}]`
- **Drawdown**: `[{timestamp, drawdownPct}]`
- **Indicators**: `[{timestamp, name, value}]`
- **Monte Carlo**: `{series: {final_equity:[], max_drawdown:[]}, dist: {p05,p50,p95}}`

### API Endpoints (Flow)
- `POST /api/flow/compile` → returns compiled Python code + validation
- `POST /api/flow/backtest` → runs bar-based backtest
- `POST /api/flow/monte-carlo` → runs Monte Carlo simulation

### Example Backtest Request
```json
{
  "nodes": [],
  "edges": [],
  "settings": { "symbol": "AAPL" },
  "symbol": "AAPL",
  "start_date": "2024-01-01",
  "end_date": "2024-06-30",
  "initial_cash": 100000
}
```

### Example Monte Carlo Request
```json
{
  "equity_curve": [{ "timestamp": "2024-01-01T00:00:00Z", "equity": 100000 }],
  "trades": [{ "pnl": 120 }],
  "iterations": 1000,
  "method": "trade_shuffle"
}
```

### Notes
- LLM nodes are runtime-enabled in the backend compiler and runtime.
- For live trading, use `IGBrokerAdapter` (IG API key only) or implement `BrokerClient`.
