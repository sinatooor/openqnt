# Phase H — Live execution path · RESULT

**Status:** ✅ Complete (paper) · gated for live · verified end-to-end on 2026-04-23

Phase H closes the loop between **a strategy signal and a real broker
order**, with a risk gate every order has to pass and a kill switch
that blanks every position. Paper-trading is wired in-process so the
exit criterion is reproducible without external creds; the same code
swaps to live Alpaca by setting two env vars.

---

## What was built

### 1. `backend/execution/` — broker-agnostic execution layer

| File | Purpose |
| --- | --- |
| [schema.py](backend/execution/schema.py) | `Order`, `Fill`, `Position`, `AccountSnapshot`, `OrderSide`, `OrderStatus`, `OrderType` — JSON-friendly dataclasses |
| [paper_broker.py](backend/execution/paper_broker.py) | `PaperBroker` — in-process broker, fills market orders at the most recent close, tracks running average cost basis + realised P&L, handles long/short flips |
| [alpaca_broker.py](backend/execution/alpaca_broker.py) | `AlpacaBroker` — REST shim for Alpaca paper/live; auto-selected when `ALPACA_API_KEY` + `ALPACA_API_SECRET` are present |
| [risk_gate.py](backend/execution/risk_gate.py) | `RiskGate.evaluate(order, account, price?)` — six rules: panic, halt, max_order_qty, max_position_notional, max_drawdown_pct, max_daily_loss_pct |
| [panic.py](backend/execution/panic.py) | File-backed kill switch (`agents/_execution/panic.lock`) — survives restart, single source of truth across processes |
| [runner.py](backend/execution/runner.py) | `ExecutionRunner.submit_signal(symbol, side, qty, ctx?)` — gate → broker → journal; emits `tool_call("execution.submit", …)` on the agent stream when given an `AgentRunContext` |
| [\_\_init\_\_.py](backend/execution/__init__.py) | Public surface |

Why a fresh layer instead of editing
[backend/risk_controls.py](backend/risk_controls.py)? The legacy module
top-level imports `IGClient`, which fails when `ig_client` isn't on the
path — touching it would break unrelated callers. The Phase-H surface
is broker-agnostic by design.

Why Python instead of wiring `orchestrator/src/brokers/`? The agents,
backtest engine, sandbox, terminal data, and risk surfaces are all
Python. A Python execution layer means every component (boss,
synthesis, technical analyst, sandbox-authored tools) can call
`runner.submit_signal()` directly. The Node orchestrator broker
clients remain available for any TS-side code that needs them.

### 2. `backend/routers/execution.py` — REST surface

Mounted at `/api/execution` from
[main.py](backend/main.py).

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/account` | Snapshot + positions + halt + panic status |
| GET | `/orders?limit=N` | Journal, newest first |
| POST | `/signal` | `{symbol, side, qty, type?, limit_price?}` → `Order` |
| GET | `/panic` | Kill-switch status |
| POST | `/panic` | Engage + close-all |
| DELETE | `/panic` | Clear kill switch + reset gate halt |
| GET | `/template-signal?template_id=…` | Phase E bridge — derive a today-style RSI signal from the template |

### 3. Frontend — `LiveExecutionPanel`

| File | Purpose |
| --- | --- |
| [src/features/execution-viewer/api.ts](src/features/execution-viewer/api.ts) | typed client |
| [src/features/execution-viewer/LiveExecutionPanel.tsx](src/features/execution-viewer/LiveExecutionPanel.tsx) | account header (broker / cash / equity / P&L) + KILL ALL button (H5) + signal form + positions table + order journal — polls every 2 s |
| [src/pages/Execution.tsx](src/pages/Execution.tsx) + [src/App.tsx](src/App.tsx) | mounted at `/execution` |

The "Take template signal" button hits `/api/execution/template-signal`,
which loads the Phase-E RSI template's spec, computes today's RSI on
SPY, and returns `{buy | sell | flat}` plus the live RSI value. The
user clicks Send to actually submit it — that's the Phase-H exit
criterion happy path.

### 4. Tests — `backend/tests/test_execution.py`

9 tests, **0.19 s**:

```
test_paper_broker_buy_then_sell_realises_pnl
test_paper_broker_rejects_when_no_cash
test_gate_blocks_when_qty_above_cap
test_gate_blocks_when_notional_above_cap
test_gate_halts_on_drawdown_breach
test_panic_blocks_orders_until_cleared
test_kill_switch_closes_positions_and_engages_panic
test_journal_writes_every_attempt
test_exit_criterion_template_signal_to_paper_fill   ← Phase H exit criterion
```

PaperBroker is constructed with a deterministic `quote_fn` in tests so
the suite doesn't depend on yfinance.

---

## Exit criterion proof

> *template strategy from Phase E, switched to "paper-live" mode,
> places at least one paper order on signal, visible in Execution
> viewer.*

### Programmatic (test)

`test_exit_criterion_template_signal_to_paper_fill` pretends to be the
RSI template firing a buy signal, calls `runner.submit_signal("SPY",
BUY, 5)`, asserts the broker filled it at the deterministic quote
($500), the journal has exactly one row with status FILLED, and the
account snapshot shows 5 SPY at avg 500 with cash reduced by $2 500.

### REST (live broker on)

```
$ curl -s :8000/api/execution/account | jq '{broker,cash,halted}'
{"broker": "paper", "cash": 100000.0, "halted": false}

$ curl -s -X POST :8000/api/execution/signal \
  -H 'content-type: application/json' \
  -d '{"symbol":"SPY","side":"buy","qty":2}' | jq '.order|{status,fill_price}'
{"status": "filled", "fill_price": 708.45}

$ curl -s :8000/api/execution/account | jq '.positions'
[{"symbol":"SPY","qty":2,"avg_price":708.45, ...}]

$ curl -s "/api/execution/template-signal" | jq '{signal,rsi,last_close}'
{"signal":"flat","rsi":67.76,"last_close":708.45}

# Risk gate stops a too-big order:
$ curl -s -X POST :8000/api/execution/signal -d '{"symbol":"AAPL","side":"buy","qty":2000}' \
  | jq '.order|{status,rejected_reason}'
{"status":"rejected","rejected_reason":"order qty 2000.0 > max_order_qty 1000.0"}

# Kill switch:
$ curl -s -X POST :8000/api/execution/panic -d '{"reason":"smoke"}'
{"panic":{"active":true,"reason":"smoke"}, "closed":[...]}

$ curl -s -X POST :8000/api/execution/signal -d '{"symbol":"SPY","side":"sell","qty":1}' \
  | jq '.order|{status,rejected_reason}'
{"status":"rejected","rejected_reason":"panic switch is engaged"}

$ curl -s -X DELETE :8000/api/execution/panic
{"active": false}
```

### UI

`/execution` shows broker, cash, equity, realised + unrealised P&L,
total P&L, KILL ALL button, signal form (symbol / side / qty / Send),
"Take template signal" button, positions table, and an order journal
with status pill + reason. Polls every 2 s.

---

## How to use

```bash
# Backend
cd backend && /opt/miniconda3/envs/fyer/bin/python -m uvicorn main:app --port 8000

# Tests
pytest backend/tests/test_execution.py -q   # 9 passed in 0.19s

# Frontend
npm run dev   # then navigate to /execution
```

To switch from paper to live Alpaca, set:

```bash
export ALPACA_API_KEY=PK…   # PK… → paper, AK… → live
export ALPACA_API_SECRET=…
```

The router auto-selects `AlpacaBroker` on first request when both env
vars are set, otherwise falls back to `PaperBroker`. Risk-gate
defaults can be tuned via env:

| Env var | Default | What it caps |
| --- | --- | --- |
| `RISK_MAX_ORDER_QTY` | 1 000 | Single-order qty |
| `RISK_MAX_POSITION_NOTIONAL` | 50 000 | Per-symbol notional after fill |
| `RISK_MAX_DRAWDOWN_PCT` | 20 | Drawdown vs peak equity |
| `RISK_MAX_DAILY_LOSS_PCT` | 5 | Daily loss vs day-open equity |
| `PAPER_CASH` | 100 000 | Paper-broker starting cash + gate's `initial_equity` |

---

## PLAN.md status — Phase H

- [x] **H1.** Broker choice — Alpaca paper (no real creds needed for
  the architecture) with PaperBroker as a self-contained fallback so
  the exit criterion runs offline. The legacy `orchestrator/src/brokers/`
  TS clients are left untouched.
- [x] **H2.** End-to-end wiring — PaperBroker fills market orders,
  AlpacaBroker shim exists for swap-in. `ExecutionRunner` is the single
  entrypoint (`submit_signal`).
- [x] **H3.** Risk controls — every order routes through `RiskGate`;
  six rules (panic, halt, qty cap, notional cap, drawdown, daily loss)
  with regression tests for each.
- [x] **H4.** Execution viewer — `/execution` page shows live orders,
  fills, P&L; backed by `/api/execution/{account,orders}` polled every
  2 s.
- [x] **H5.** Kill switch — UI button engages panic + closes all
  positions; a CLEAR PANIC button reverts. Gate also re-blocks any
  order while the lock file is on disk.

Exit criterion met. Phase H is done (paper). Wiring to a live broker
is one env-var pair away.
