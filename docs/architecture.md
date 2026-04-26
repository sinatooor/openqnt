# openqwnt — architecture

This document is the architectural reference for the platform as it
exists at the end of Phase J (see [PLAN.md](../PLAN.md) and the
`PHASE_*_RESULT.md` files at the repo root). It supersedes the
pre-Phase-B "Project Prometheus" doc that lived here previously — that
text described a Node-orchestrator era that no longer matches the
shipped surface.

If you only read one diagram, read [§ 1](#1-system-overview).
If you want to understand a single user gesture, jump to
[§ 9 Sequence diagrams](#9-sequence-diagrams).

---

## 1. System overview

The platform is a thin React/Vite frontend talking to a FastAPI
backend that owns every piece of state. State persists under
`agents/` on disk; the database used elsewhere in the repo
(PostgreSQL, Redis) is **not** on the Phase-B-onwards critical path.

```mermaid
graph TD
    user["👤 User"] -->|"browser"| FE["⚛️ React + Vite (frontend)<br/>pages: /backtest, /improvement,<br/>/tools, /execution, /terminal/*,<br/>/boss, /dashboard"]

    FE -->|"REST + WebSocket<br/>JSON only"| API["🐍 FastAPI backend<br/>(uvicorn)"]

    subgraph BE["backend/ — single FastAPI app"]
        direction TB
        ROUTERS["routers/<br/>backtest · execution · improvement<br/>tools · terminal_data · agent_live<br/>boss · telemetry"]
        AR["agent_runtime/<br/>AgentRunContext · EventBus · storage"]
        BT["backtest/<br/>canonical engine + builtins + plot"]
        EX["execution/<br/>PaperBroker · AlpacaBroker<br/>RiskGate · PanicService · Runner"]
        IMP["improvement/<br/>Objective · Mutator · Tree · Runner"]
        SB["sandbox/<br/>subprocess + setrlimit"]
        DT["dynamic_tools/<br/>agent-authored Python"]
        TM["telemetry/<br/>counters + AgentRunContext hook"]
        ADK["adk_agents/<br/>Google ADK agents + tools"]

        ROUTERS --> AR
        ROUTERS --> BT
        ROUTERS --> EX
        ROUTERS --> IMP
        ROUTERS --> SB
        ROUTERS --> DT
        ROUTERS --> TM
        ADK -.uses.-> AR
        ADK -.uses.-> BT
        ADK -.uses.-> SB
        ADK -.uses.-> DT
        EX -.events.-> AR
        IMP -.events.-> AR
        TM -.hooks.-> AR
    end

    API --> BE

    BE -->|"persists"| DISK["📂 agents/ (gitignored)<br/>boss/runs/&lt;id&gt;/<br/>_backtests/&lt;id&gt;/<br/>_execution/&lt;session&gt;/<br/>_telemetry/<br/>tools/dynamic/<br/>_cache/{bars, mpl}"]

    BE -.optional.-> EXT["🌐 External<br/>Gemini API · Alpaca REST<br/>yfinance · FMP"]
```

Two subsystems on the diagram are dotted because they can run without
external services: the boss + improvement loop fall back to a
heuristic when `GEMINI_API_KEY` is unset, and execution falls back to
`PaperBroker` when Alpaca creds are unset.

---

## 2. Frontend page map

```mermaid
graph LR
    root["/<br/>StrategyFlow canvas"] --> bt["/backtest<br/>BacktestPanel"]
    root --> imp["/improvement<br/>ImprovementPanel"]
    root --> tools["/tools<br/>Sandbox + dynamic tools"]
    root --> exe["/execution<br/>LiveExecutionPanel"]
    root --> boss["/boss<br/>BossRunTree"]
    root --> dash["/dashboard<br/>Widget canvas"]

    subgraph term["/terminal/* (Phase F)"]
        des["/des"]
        gip["/gip"]
        hds["/hds"]
        rmap["/rmap"]
        splc["/splc"]
        bmap["/bmap"]
    end
    root --> term

    bt -.->|"Improve →"| imp
    boss -.->|"open Boss"| dash

    cmdk["⌘K palette<br/>(global, mounted in App.tsx)"]
    cmdk -.activates from any /terminal/*.-> des & gip & hds & rmap & splc
```

The cmd+K palette is mounted once at the App level
([`SymbolPalette.tsx`](../src/features/terminal/SymbolPalette.tsx))
and works on any non-strategy-flow page. URL `:ticker` and the global
[`terminalSymbolStore`](../src/stores/terminalSymbolStore.ts) are
synced both directions by every `/terminal/*` page.

---

## 3. Phase B — agent runtime

Every agent run holds an `AgentRunContext`. It's the only thing an
agent uses to talk to the runtime. Each method appends to disk
(durable) **and** publishes to the in-process `EventBus` (which the
WebSocket router fans out to live subscribers).

```mermaid
graph LR
    agent["AnalysisAgent.analyze(ctx)"]
    ctx["AgentRunContext"]
    bus["EventBus<br/>asyncio.Queue per run_id"]
    storage["storage.py<br/>events.jsonl · run.json<br/>summary.md · state.md<br/>artifacts/* · plots/*"]
    ws["/api/agent/ws/&lt;run_id&gt;"]
    rest["/api/agent/runs/&lt;run_id&gt;"]
    fe["frontend (BossRunTree,<br/>AgentActivityWidget, ...)"]

    agent -->|"status / thought / tool_call /<br/>tool_result / message / error"| ctx
    ctx --> storage
    ctx --> bus
    bus --> ws --> fe
    storage --> rest --> fe
```

Tool calls use a context-manager so the `tool_call` (pending) and
`tool_result` (success/error) are paired automatically:

```python
with ctx.tool_call("backtest.run", {"symbol": "SPY", ...}) as h:
    result = run_backtest(spec)
    h.result(f"sharpe={result.metrics['sharpe']:.2f}")
```

---

## 4. Phase D — canonical backtest engine

One module, one entrypoint. The frontend `/backtest` page, every
agent `run_backtest_tool` invocation, and the Phase I improvement
loop all call the same `run_backtest(spec)` and get the same shape
back, byte-for-byte identical for identical inputs.

```mermaid
graph TD
    rest_caller["frontend<br/>POST /api/backtest/run"]
    agent_caller["agent<br/>run_backtest_tool(spec, ctx)"]
    imp_caller["Phase I runner<br/>(per candidate)"]

    rest_caller --> engine
    agent_caller --> engine
    imp_caller --> engine

    subgraph engine_box["backend/backtest/"]
        engine["engine.run_backtest(spec)<br/>– never raises"]
        data["data.load_bars()<br/>yfinance + parquet cache"]
        builtins["builtins.STRATEGIES<br/>sma_crossover · rsi_meanrev<br/>buy_and_hold · custom"]
        plot["plot.render_equity_drawdown()<br/>matplotlib Agg"]
    end

    engine --> data
    engine --> builtins
    engine --> plot

    engine -->|"BacktestResult"| out_rest["JSON response<br/>plot_b64 inlined"]
    engine -->|"BacktestResult (trimmed)"| out_agent["dict the LLM sees<br/>~20 sampled equity points"]
    engine -->|"persists"| disk["agents/_backtests/&lt;run_id&gt;/<br/>equity.png · result.json · spec.json"]
```

The Phase D guarantee — that REST and agent return identical numbers
for the same `BacktestSpec` — is locked down by
`backend/tests/test_rsi_template.py::test_template_backtest_runs_canonical`
and the SMA reference test
`tests/test_backtest_reference.py`.

---

## 5. Phase F — terminal data routing

Every `/terminal/*` screen has the same render-instantly-then-upgrade
shape: deterministic mock fallback in JS, real data via
`terminalApiGet → /api/terminal/<screen>/<ticker>`, merged so empty
sections never blank the layout.

```mermaid
graph TD
    page["/terminal/&lt;fn&gt;/:ticker page"] --> hook["useTerminalData(tool, input, fallback)"]
    hook --> tool["features/terminal/&lt;fn&gt;/tool.ts<br/>fetch + formatForAgent + summarise"]
    tool --> mock["mockData.ts<br/>(deterministic, seeded)"]
    tool --> backend["GET /api/terminal/&lt;fn&gt;/&lt;ticker&gt;"]
    backend --> td["routers/terminal_data.py"]
    td --> yf["yfinance / FMP / SEC EDGAR"]

    backend -.empty section.-> mock_merge["mock-merge<br/>(per-section)"]
    backend -.populated section.-> live_merge["live-merge"]
    mock_merge --> page
    live_merge --> page

    cmdk["SymbolPalette ⌘K"] -->|"navigate(/terminal/fn/SYM)"| page
    cmdk -->|"setActiveSymbol"| store["stores/terminalSymbolStore"]
    page -->|"useSyncTerminalSymbol(:ticker)"| store
```

Six screens × one shape. Adding a screen = drop a `tool.ts` +
`mockData.ts` + a backend `/api/terminal/<x>/<ticker>` route.

---

## 6. Phase G — sandbox + dynamic tools

Two layers: a generic Python subprocess sandbox and a registry that
lets agents author *new* Python tools at runtime.

```mermaid
graph TD
    agent["agent (boss / synthesis / dev)"]
    create["create_dynamic_tool(name, code)"]
    call["call_dynamic_tool(name, kwargs)"]
    valid["_validate_module<br/>(ast checks + sandbox import probe)"]
    registry["agents/tools/dynamic/&lt;name&gt;.py<br/>+ _index.json"]
    sb["sandbox.execute_python<br/>(subprocess + setrlimit + tmpdir)"]
    rest["POST /api/tools/dynamic<br/>POST /api/tools/dynamic/&lt;name&gt;/call<br/>POST /api/tools/sandbox/execute"]
    ui["/tools page<br/>catalogue + playground + author"]

    ui --> rest
    agent --> create
    agent --> call
    create --> valid
    valid -->|"ok"| registry
    valid -->|"sandbox probe"| sb
    call --> registry
    call --> sb
    rest --> create
    rest --> call
    rest --> sb
```

Every tool call — generated or built-in — runs in a fresh tmpdir as
`python -I main.py` with `RLIMIT_CPU`, `RLIMIT_FSIZE`, `RLIMIT_AS`
applied via `preexec_fn`. The backend never imports agent-authored
code into its own process.

---

## 7. Phase H — live execution path

One verb (`runner.submit_signal`) gates every order through
`RiskGate` before it reaches the broker. Every order — allowed or
rejected — is journalled. The kill switch is file-backed so it
survives a backend restart.

```mermaid
graph TD
    sig["signal source<br/>UI 'Send' · agent · template-signal endpoint"]
    runner["ExecutionRunner.submit_signal(symbol, side, qty)"]
    gate["RiskGate.evaluate(order, account)"]
    panic["PanicService<br/>agents/_execution/panic.lock"]
    broker["Broker<br/>PaperBroker (default)<br/>AlpacaBroker (env creds)"]
    journal["agents/_execution/&lt;session&gt;/orders.jsonl"]
    rest["/api/execution/{account, orders, signal,<br/>panic, template-signal}"]
    ui["/execution<br/>LiveExecutionPanel"]

    sig --> runner
    runner --> gate
    gate -.checks.-> panic
    gate -->|"allowed"| broker
    gate -->|"rejected"| journal
    broker --> journal
    broker -->|"fill"| runner
    runner -->|"update equity"| gate
    runner --> rest
    ui --> rest
    ui -.panic button.-> panic
```

Six gate rules, evaluated in order: panic → halt-state → max_order_qty
→ max_position_notional → drawdown vs peak → daily loss vs day-open.
First failure stops evaluation and rejects.

---

## 8. Phase I — self-improvement loop

`ImprovementRunner` walks a search tree centred on the *current best*
node, scores every candidate with `Objective` (Sharpe with a max-DD
brake + a no-trade floor), and re-evaluates the winner on a held-out
window.

```mermaid
graph TD
    seed["seed BacktestSpec"]
    iter0["iter 0: backtest seed → score"]
    propose["propose_mutations(seed, history)<br/>heuristic by default<br/>LLM if GEMINI_API_KEY set"]
    backtest["run_backtest(candidate)<br/>(Phase D engine)"]
    score["Objective.score(metrics)<br/>sharpe − dd_penalty − no_trade_floor"]
    tree["ImprovementTree<br/>tree.json + events.jsonl"]
    best["pick best by score"]
    val["re-backtest best on validation window"]
    summary["ImprovementSummary"]
    ws["/api/improvement/ws/&lt;run_id&gt;<br/>tails events.jsonl"]
    fe["/improvement panel<br/>live tree + side-by-side card"]

    seed --> iter0 --> tree
    iter0 -->|"history[0]"| propose
    propose --> backtest --> score --> tree
    tree -->|"loop n_iters"| propose
    tree --> best --> val --> tree --> summary
    tree --> ws --> fe
```

`/backtest`'s **Improve →** button pre-seeds the form via querystring
so the user goes from "I just ran a backtest" to "I'm watching it
self-tune" in one click.

---

## 9. Sequence diagrams

### 9.1 Run a backtest from the UI

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant FE as /backtest (BacktestPanel)
    participant API as POST /api/backtest/run
    participant E as backtest.run_backtest(spec)
    participant FS as agents/_backtests/<id>/

    U->>FE: pick params, click "Run backtest"
    FE->>API: { symbol, start, end, strategy, params }
    API->>E: run_backtest(spec)
    E->>E: load_bars() (yfinance + parquet cache)
    E->>E: backtesting.py executes strategy on bars
    E->>E: render_equity_drawdown() → PNG bytes
    E->>FS: write equity.png · result.json · spec.json
    E-->>API: BacktestResult (with plot_b64 data URL)
    API-->>FE: JSON
    FE-->>U: stat tiles + inline equity chart
```

### 9.2 Agent runs a tool that emits events live

```mermaid
sequenceDiagram
    autonumber
    participant A as agent.analyze()
    participant CTX as AgentRunContext
    participant FS as events.jsonl
    participant BUS as EventBus (run_id queue)
    participant WS as /api/agent/ws/<run_id>
    participant FE as frontend subscriber

    A->>CTX: with ctx.tool_call("backtest.run", {…}) as h
    CTX->>FS: append {kind: tool_call, status: pending}
    CTX->>BUS: publish(event)
    BUS-->>WS: dequeue
    WS-->>FE: send_json(event)
    A->>A: run_backtest(...) — heavy work
    A->>CTX: h.result(f"sharpe={x:.2f}")
    CTX->>FS: append {kind: tool_result, status: success}
    CTX->>BUS: publish(event)
    BUS-->>WS: dequeue
    WS-->>FE: send_json(event)
```

### 9.3 Self-improvement loop end-to-end

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant FE as /improvement
    participant API as POST /api/improvement/start
    participant R as ImprovementRunner (background thread)
    participant T as ImprovementTree (events.jsonl)
    participant E as backtest.run_backtest
    participant WS as /api/improvement/ws/<run_id>

    U->>FE: configure seed + n_iters, click "Improve"
    FE->>API: start request
    API->>R: kicks off in background thread
    API-->>FE: { run_id }
    FE->>WS: connect
    R->>E: backtest seed (iter 0)
    R->>T: node_added · node_updated → events.jsonl
    WS-->>FE: stream events as they land
    loop for each iteration (1..N)
        R->>R: propose_mutations(history)
        loop for each candidate
            R->>E: backtest candidate
            R->>T: node_added · node_updated
            WS-->>FE: stream
        end
    end
    R->>R: pick best by score
    R->>E: re-backtest best on validation window
    R->>T: node_added (tag=validation)
    R->>T: finalize (best + summary)
    WS-->>FE: run_complete + summary
```

### 9.4 Paper order from signal to journal

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant FE as /execution
    participant API as POST /api/execution/signal
    participant RUN as ExecutionRunner
    participant GATE as RiskGate
    participant B as PaperBroker
    participant FS as orders.jsonl

    U->>FE: pick {SPY, buy, 2}, Send
    FE->>API: { symbol, side, qty }
    API->>RUN: submit_signal(...)
    RUN->>B: get_account() + quote(symbol)
    RUN->>GATE: evaluate(order, account, price)
    alt rejected
        GATE-->>RUN: { allowed: false, reason }
        RUN->>FS: append rejected order
        RUN-->>API: Order(status=REJECTED, rejected_reason=…)
    else allowed
        GATE-->>RUN: { allowed: true }
        RUN->>B: place_order(symbol, side, qty)
        B-->>RUN: Order(status=FILLED, fill_price)
        RUN->>B: get_account() (fresh equity)
        RUN->>GATE: update_equity(fresh.equity)
        RUN->>FS: append filled order
        RUN-->>API: Order(status=FILLED)
    end
    API-->>FE: { order }
    FE-->>U: order appears in journal + position card updates
```

---

## 10. Phase J — telemetry, CI, E2E

```mermaid
graph LR
    AR["AgentRunContext<br/>(every agent uses)"]
    HOOK["telemetry.hook_into_context()<br/>called once at startup"]
    COUNT["telemetry/counters.py<br/>thread-safe + 1s flush"]
    DISK["agents/_telemetry/counters.json"]
    REST["/api/telemetry/{summary, reset}"]
    WIDGET["TelemetryWidget<br/>polls every 5s"]

    AR -.patched at startup.-> HOOK
    HOOK -->|"on __init__/finish/_emit"| COUNT
    COUNT --> DISK
    DISK --> REST
    REST --> WIDGET
```

CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs
two parallel jobs: **frontend** (lint + typecheck-of-Phase-B-I files
+ vitest) and **backend** (Phase D canonical reference + Phase E
template + Phase G dynamic tools + Phase H execution + Phase I
improvement, all pytest).

E2E ([`e2e/phase-e-rsi-template.spec.ts`](../e2e/phase-e-rsi-template.spec.ts))
walks the Phase E flow in Chromium: open `/backtest`, pick
`rsi_meanrev`, run, assert the inlined equity PNG + stat tiles.

---

## 11. On-disk layout

Everything under `agents/` is gitignored — it's per-user state.
Created on demand by the modules that own it.

```mermaid
graph TD
    root["agents/<br/>(gitignored)"]
    boss["boss/runs/&lt;id&gt;/<br/>events.jsonl · run.json<br/>summary.md · state.md<br/>improvement_tree/* (Phase I)"]
    bt["_backtests/&lt;id&gt;/<br/>equity.png · result.json · spec.json"]
    exe["_execution/&lt;session&gt;/<br/>orders.jsonl<br/>panic.lock (when engaged)"]
    tele["_telemetry/<br/>counters.json"]
    tools["tools/dynamic/<br/>&lt;name&gt;.py + _index.json"]
    cache["_cache/<br/>bars/*.parquet (yfinance)<br/>mpl/* (matplotlib font cache)"]
    quants["quants/&lt;agent_id&gt;/<br/>state.md · memory.md<br/>runs/&lt;run_id&gt;/*"]

    root --> boss
    root --> bt
    root --> exe
    root --> tele
    root --> tools
    root --> cache
    root --> quants
```

Owners:
- `boss/`, `quants/` — Phase B agent_runtime/storage.py
- `_backtests/` — Phase D backtest/engine.py
- `_execution/` — Phase H execution/runner.py + execution/panic.py
- `_telemetry/` — Phase J telemetry/counters.py
- `tools/dynamic/` — Phase G dynamic_tools/registry.py
- `_cache/bars/` — Phase D backtest/data.py
- `_cache/mpl/` — Phase G sandbox/runner.py (pre-warmed font cache)

---

## 12. Module dependency graph

```mermaid
graph TD
    routers["routers/*"]
    AR["agent_runtime"]
    BT["backtest"]
    EX["execution"]
    IMP["improvement"]
    SB["sandbox"]
    DT["dynamic_tools"]
    TM["telemetry"]
    ADK["adk_agents"]

    routers --> AR
    routers --> BT
    routers --> EX
    routers --> IMP
    routers --> SB
    routers --> DT
    routers --> TM

    ADK --> AR
    ADK --> BT
    ADK --> SB
    ADK --> DT

    EX --> AR
    IMP --> BT
    IMP --> AR
    DT --> SB
    TM -.monkey-patches.-> AR
```

Cycle-free. The agent runtime sits at the bottom because everything
that emits events ultimately writes through `AgentRunContext`. The
canonical backtest engine has no dependency back into the runtime.

---

## 13. Where to look next

| Question | File |
| --- | --- |
| What ships in each phase? | [PLAN.md](../PLAN.md) + `PHASE_*_RESULT.md` at repo root |
| How do I add an agent? | [README.md](../README.md#how-to-add-an-agent) |
| How do I add a node? | [README.md](../README.md#how-to-add-a-node-to-the-visual-builder) |
| How is the canonical engine invoked? | [`backend/backtest/engine.py`](../backend/backtest/engine.py) |
| How does the boss orchestrate? | [`backend/routers/boss.py`](../backend/routers/boss.py) |
| Where do orders journal? | `agents/_execution/<session>/orders.jsonl` (on disk) |
| How does the kill switch work? | [`backend/execution/panic.py`](../backend/execution/panic.py) |
| What does a tool call look like in the stream? | [§ 9.2 above](#92-agent-runs-a-tool-that-emits-events-live) |
