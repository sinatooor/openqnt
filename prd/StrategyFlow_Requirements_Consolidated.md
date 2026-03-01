# StrategyFlow — Consolidated Requirements

**Purpose:** Align StrategyFlow PRD v4 with explicit product requirements for Interactive Brokers, n8n parity, webhooks, deterministic backtesting, and advanced quantitative research tools.

---

## 1. User Needs & App Purpose (from PRD)

### Target Users
- **Retail investors** — Execute strategies consistently without babysitting markets
- **Active traders** — Scan markets 24/7 for setups matching exact criteria
- **Wealth managers / RIAs** — Monitor multiple client portfolios simultaneously
- **Crypto traders** — 24/7 risk management and DCA with news-awareness

### Core Value Proposition
> *"Your personal AI hedge fund team — one that never sleeps, reads everything, knows your strategy, and acts the moment an opportunity or risk appears."*

### Product Principles
1. **Visual-first** — The flowchart IS the algorithm. No code required.
2. **Trust through transparency** — Every decision is logged, inspectable, replayable.
3. **Progressive autonomy** — Start advisory, graduate to autonomous as trust builds.
4. **Cost-conscious AI** — Cheap pre-checks before expensive LLM calls.
5. **Context-aware intelligence** — Understand WHY, not just WHAT, before acting.

---

## 2. Interactive Brokers — Primary Broker (Now)

**Requirement:** The app must work with Interactive Brokers first. Other brokers (Alpaca, IG, Nordnet) will be added later.

### Current State
- IBKR client exists as a **stub** in `orchestrator/src/brokers/ibkr.ts`
- Credentials page, ProfileModal, and LiveTradingPanel already list IBKR as an option
- Broker gateway registers IBKR and routes to it

### Implementation Options

| Option | Pros | Cons |
|--------|------|------|
| **Client Portal Web API (REST)** | REST-based, no TWS/Gateway required for some flows; OAuth 2.0 | Requires Client Portal Gateway (Java) for individual accounts; some endpoints not supported in Gateway mode |
| **TWS API / IB Gateway (Socket)** | Full feature set, real-time streaming | Requires TWS or IB Gateway running; socket-based |
| **ib** (npm) | Node.js native | Outdated (~2017), missing newer order types |
| **ib-tws-api** (npm) | Node.js TWS client | Socket-based, requires TWS/Gateway |

### Recommended Approach
1. **Phase 1:** Implement **Client Portal Web API** via REST for:
   - Portfolio/positions
   - Order placement (market, limit, stop, stop-limit)
   - Account info
   - Historical and live market data (where supported)
2. **Phase 2:** Add **TWS/IB Gateway** support via `ib` or `ib-tws-api` for:
   - Real-time streaming quotes
   - Advanced order types (trailing stop, bracket, etc.)
   - Options and futures (if needed)

### IBKR-Specific Credentials
- OAuth 2.0 or CP Gateway session
- Store in Credential Vault with alias `ibkr` or `interactive_brokers`

### Tasks
- [ ] Replace IBKR stub with real Client Portal API client
- [ ] Add IBKR credential type and OAuth flow (or session-based auth)
- [ ] Map `BrokerOrder` → IBKR order format (conid, orderType, etc.)
- [ ] Map IBKR positions → `BrokerPosition`
- [ ] Handle IBKR-specific symbols (conid vs ticker)
- [ ] Paper trading via IBKR Paper Trading account

---

## 3. n8n-Style Nodes & Features — Parity for StrategyFlow

**Requirement:** Copy as much useful functionality from n8n as possible and adapt it for trading and quantitative strategy building.

### n8n Concepts to Adopt

| n8n Concept | StrategyFlow Equivalent | Status |
|-------------|-------------------------|--------|
| **Trigger nodes** | Heartbeat, Webhook, Price Alert, News, Broker Event | ✅ Defined in catalog; Webhook handler exists |
| **Schedule Trigger** | Heartbeat Trigger (BullMQ) | ✅ Scaffolded |
| **Webhook** | Webhook Trigger | ✅ Route exists; HMAC verification |
| **HTTP Request** | HTTP Request Node | ✅ In integrationNodes |
| **Code (JS)** | JavaScript Code Node | ✅ In integrationNodes |
| **Code (Python)** | Python Code Node | ✅ In integrationNodes |
| **Credentials** | Credential Vault (AES-256) | ✅ Built |
| **Execution history** | Execution runs + per-node logs | ✅ Built |
| **Manual Trigger** | Manual execution via API | ✅ `POST /api/strategies/:id/execute` |
| **Form Trigger** | — | 🔲 Consider for HITL forms |
| **Merge/Split** | — | 🔲 Add Merge/Split nodes for data flow |
| **Switch** | If/If-Else control | ✅ Exists |
| **Loop** | Repeat, Repeat Until | ✅ Exists |
| **Wait** | Wait, Wait Until | ✅ Exists |
| **Sticky Note** | Comment node | ✅ Exists |
| **Human-in-the-Loop** | HITL node | 🔲 Planned; HITL approval flow scaffolded |

### Additional n8n-Inspired Nodes to Add

| Node | Description | Use Case |
|------|-------------|----------|
| **Merge Node** | Combine outputs from multiple branches into one | Combine signals from different indicators |
| **Split Out Node** | Split one output to multiple branches | Fan-out to multiple actions |
| **Set Node** | Set/transform fields on the payload | Rename, reshape, filter data |
| **Filter Node** | Pass through only items matching condition | Filter tickers by criteria |
| **Aggregate Node** | Aggregate data (sum, avg, count) | Portfolio-level metrics |
| **Schedule Trigger (Cron)** | Cron expression for precise scheduling | "Every Monday 9:30 AM ET" |
| **Manual Trigger** | Explicit "Run" button trigger | Ad-hoc backtests, manual scans |
| **Form Trigger** | Web form that triggers workflow | Custom alert forms, HITL forms |

### Trading-Specific Adaptations
- **Webhook payload** — Accept TradingView JSON (`{ "symbol": "AAPL", "action": "buy", "price": 150 }`)
- **HTTP Request** — Pre-configured for common APIs (Polygon, Alpha Vantage, etc.)
- **Database Query** — Access `market_data`, `backtest_results`, `execution_runs`

---

## 4. Webhooks — TradingView & External Services

**Requirement:** Users must be able to add webhooks like from TradingView.

### Current State
- `POST /api/webhooks/:strategyId` exists in `orchestrator/src/api/routes/webhooks.ts`
- HMAC signature verification via `x-webhook-signature` header
- Webhook Trigger node defined in catalog with `webhookPath`, `hmacSecret`, `expectedFields`
- Synthetic bar built from webhook data for downstream nodes

### TradingView Alert Format
TradingView sends JSON in the request body. Common structure:
```json
{
  "symbol": "AAPL",
  "action": "buy",
  "price": 150.25,
  "time": "2025-03-01T14:30:00Z",
  "strategy": "My Strategy"
}
```

### Enhancements Needed
- [ ] **Per-strategy webhook URL** — `https://api.strategyflow.io/api/webhooks/{strategyId}` (or user-specific subdomain)
- [ ] **Webhook path customization** — Allow user to set a custom path segment for obscurity
- [ ] **TradingView template** — Pre-fill TradingView webhook URL + body template in docs
- [ ] **Payload mapping** — Map TradingView fields to StrategyFlow context (`symbol`, `price`, `action`)
- [ ] **Optional HMAC** — TradingView doesn't support HMAC by default; support both signed and unsigned webhooks with configurable validation

### Documentation
- Add "Connect TradingView" guide: copy webhook URL, paste in TradingView alert, select JSON body format

---

## 5. Backtesting — Deterministic vs Non-Deterministic

**Requirement:** Users must be able to backtest strategies. However, if a strategy includes nodes that prevent deterministic backtesting (e.g., custom LLM prompt node), backtesting should only be available for strategies that are fully data-driven and reproducible.

### Non-Deterministic Nodes (Block Backtest)
- **LLM nodes** — Sentiment Analysis, Regime Detection, NL Strategy Rules, Parameter Tuning, Custom Code (LLM)
- **AI Analysis Node** — Sends data to ADK agent
- **Code nodes** — If they call external APIs, use random seeds, or depend on live data
- **Webhook Trigger** — Inherently event-driven; backtest uses historical data, not webhooks
- **News Trigger** — Historical news may not be available or reproducible

### Deterministic Nodes (Allow Backtest)
- **Indicators** — SMA, EMA, RSI, MACD, etc. (pure math on OHLCV)
- **Conditions** — Compare, Crossover, AND, OR, NOT
- **Environment** — Price, Volume, Time, etc. (from historical data)
- **Math** — Add, Multiply, etc.
- **Risk** — Max Drawdown, Position %, Kelly (formula-based)
- **Control** — If, Repeat, Wait (logic only)
- **Variables** — Set/Get (state within run)
- **Trade Info** — Entry Price, PnL (from backtest simulation)
- **Heartbeat Trigger** — Can be simulated as "every bar" or "every N bars"

### Implementation

1. **Node tagging** — Each node definition has `backtestEligible: boolean`
   - `llm`, `aiAnalysisNode`, `webhookTrigger`, `newsTrigger` → `false`
   - All others → `true` (with caveats for Code nodes)

2. **Strategy validation** — Before backtest:
   ```ts
   const canBacktest = nodes.every(n => isBacktestEligible(n.type, n.data));
   if (!canBacktest) {
     return { error: "Strategy contains non-deterministic nodes (LLM, AI Analysis, Webhook, News). Backtest disabled. Use simulation mode for live testing." };
   }
   ```

3. **UI** — BacktestModal already shows LLM warning. Extend to:
   - **Disable Run Backtest** button when strategy has non-deterministic nodes
   - Tooltip: "Remove LLM/AI/Webhook/News nodes to enable backtesting"
   - **Simulation mode** — Always available; runs strategy logic against live/paper data without historical replay

4. **Code nodes** — Default `backtestEligible: false`; allow user to mark as "deterministic" if they guarantee no external calls/randomness

---

## 6. Advanced Research & Quantitative Tools

**Requirement:** The app should include advanced research tools and quantitative features for sophisticated users.

### Already Built
| Tool | Location | Status |
|------|----------|--------|
| **Monte Carlo Permutation Test (MCPT)** | `backend/mcpt/` | ✅ Functional |
| **Backtesting** | Backtrader, backtesting.py, Nautilus | ✅ Production |
| **50+ Indicators** | TA-Lib, pandas, numpy | ✅ Production |

### To Add / Enhance

#### 6.1 Simulations
- **Monte Carlo Simulation** — Simulate N equity paths by randomizing trade order or returns
  - Input: Backtest result (trades, returns)
  - Output: Distribution of outcomes (P5, P50, P95), confidence bands
  - Use case: "What's the range of possible outcomes?"
- **Bootstrap** — Resample returns with replacement for robustness
- **Parameter sensitivity** — Vary indicator params (e.g., RSI period 12–18) and plot heatmap

#### 6.2 Hidden Markov Models (HMM)
- **Regime detection** — Identify bull/bear/sideways regimes from price/volatility
- **State transition probabilities** — P(regime A → regime B)
- **Use in strategy** — Condition nodes: "If regime == bear, reduce position size"
- **Library** — `hmmlearn` (Python)

#### 6.3 Additional Mathematical/Statistical Tools
| Tool | Description | Use Case |
|------|-------------|----------|
| **Walk-Forward Analysis** | Train on window 1, test on window 2; roll forward | Out-of-sample validation |
| **Cointegration test** | Engle-Granger, Johansen | Pairs trading, mean reversion |
| **Correlation matrix** | Rolling correlation, cluster assets | Portfolio construction |
| **Factor exposure** | Beta, size, value, momentum | Risk decomposition |
| **VaR / CVaR** | Value at Risk, Conditional VaR | Risk metrics |
| **Optimal position sizing** | Kelly, risk parity, mean-variance | Portfolio allocation |
| **Sharpe/Sortino/Calmar** | Already in backtest; ensure exposed in API | Performance comparison |
| **Information ratio** | Active return / tracking error | Benchmark-relative performance |

#### 6.4 Research Modal / Workspace
- Extend `ResearchModal.tsx` to include:
  - Monte Carlo Simulation (new)
  - HMM Regime Detection (new)
  - Walk-Forward Analysis (new)
  - MCPT (existing)
- Tabbed or accordion UI for each tool
- Export results (JSON, CSV, charts)

### Python Compute Endpoints
```
POST /compute/monte-carlo     — Monte Carlo simulation on backtest result
POST /compute/hmm-regime      — HMM regime detection on price series
POST /compute/walk-forward   — Walk-forward analysis
POST /compute/cointegration  — Cointegration test (pairs)
POST /compute/var-cvar       — VaR/CVaR calculation
```

---

## 7. Design for Sophisticated Quantitative Users

**Requirement:** The system should be designed with sophisticated quantitative users in mind and support serious research and strategy development.

### Principles
1. **Transparency** — Every computation is inspectable. Log formulas, parameters, intermediate results.
2. **Reproducibility** — Seed control for all random operations. Version strategy + data + params.
3. **Extensibility** — Code nodes (Python/JS) for custom logic. Plugin architecture for new indicators.
4. **Performance** — Vectorized operations where possible. Caching for repeated indicator calls.
5. **Data quality** — Clearly mark synthetic vs real data. Handle missing data explicitly.

### UX for Quants
- **Parameter sweeps** — Run backtest across param grid, visualize heatmap
- **Statistical significance** — MCPT, confidence intervals on all metrics
- **Export** — Full backtest result as JSON (trades, equity curve, params) for external analysis
- **API-first** — All research tools callable via REST for scripting/automation
- **Notebook integration** — (Future) Jupyter kernel or API for notebook users

---

## 8. Implementation Priority Matrix

| Area | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| IBKR real implementation | P0 | L | Credential vault, broker gateway |
| Webhook TradingView docs + payload mapping | P0 | S | Webhook route exists |
| Backtest eligibility (block non-deterministic) | P0 | M | Node definitions, BacktestModal |
| Monte Carlo simulation endpoint | P1 | M | Backtest result schema |
| HMM regime detection | P1 | M | hmmlearn, price data |
| n8n Merge/Split/Set nodes | P1 | M | Node catalog, interpreter |
| Walk-Forward Analysis | P2 | L | Backtest engine |
| Human-in-the-Loop node | P1 | M | Redis, webhook callback |

---

## 9. Summary Checklist

- [ ] **IBKR** — Replace stub with Client Portal API (or TWS) implementation
- [ ] **Webhooks** — TradingView integration guide; payload mapping; optional HMAC
- [ ] **n8n parity** — Merge, Split, Set, Filter nodes; Manual Trigger; Schedule (cron)
- [ ] **Backtest** — Enforce deterministic-only; disable button for LLM/AI/Webhook/News strategies
- [ ] **Monte Carlo** — New endpoint + ResearchModal tab
- [ ] **HMM** — Regime detection endpoint + optional regime condition node
- [ ] **Walk-Forward** — Out-of-sample validation
- [ ] **Quant UX** — Param sweeps, export, API-first design

---

*StrategyFlow Requirements Consolidated | March 2026*
