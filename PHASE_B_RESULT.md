# Phase B — Agent Runtime + Live Streaming · RESULT

**Status:** ✅ Complete · verified end-to-end on 2026-04-22

Phase B turns the agents from "scripted simulation" into a real backend
runtime that any agent can use to (a) emit Cursor-style stream events,
(b) persist a per-run event log + artifacts to disk, and (c) be driven
live from the frontend over WebSocket.

---

## What was built

### 1. `backend/agent_runtime/` — the plumbing every agent uses

- [storage.py](backend/agent_runtime/storage.py) — on-disk layout under
  `agents/`, with helpers for `agent_dir`, `run_dir`, `read/write_memory`,
  `read/write_state`, `append_event` (jsonl), `list_runs`, `load_run`,
  `list_artifacts`, `artifact_path`.
- [event_bus.py](backend/agent_runtime/event_bus.py) — in-process
  `asyncio.Queue` pub/sub keyed by `run_id`. Subscribers get a queue
  bounded at 1024 events (drops oldest on overflow).
- [context.py](backend/agent_runtime/context.py) — `AgentRunContext`,
  the single object every agent uses. Methods: `status`, `thought`,
  `message`, `error_event`, `tool_call` (context manager →
  pending/success/error), `tool_result`, `save_artifact`, `save_plot`,
  `save_json`, `append_memory`, `update_state`, `add_tokens`, `finish`.
  Every emit appends to `events.jsonl` AND publishes to `EVENT_BUS`.

### 2. Refactored agents

- [base_agent.py](backend/adk_agents/base_agent.py) — `BaseAnalysisAgent.run()`
  now accepts an optional `ctx`. If `None`, it auto-creates one (so legacy
  tests/scripts keep working) and auto-finishes the run. Threads `ctx` into
  `analyze(context, ctx)`.
- [technical_analyst.py](backend/adk_agents/technical_analyst.py) — full
  rewrite. Auto-fetches yfinance bars, computes RSI/SMA/MACD via TA-Lib
  (with pandas fallback), saves a 2-panel matplotlib chart via
  `ctx.save_plot()`, calls Gemini for synthesis, maps JSON →
  `AgentOutput`. Tool calls emitted: `market_data.history`, `llm.generate`.
- [news_analyst.py](backend/adk_agents/news_analyst.py) — refactored to
  auto-fetch headlines via `news_tools.get_market_news` when context is
  empty. Emits `news.search` and `llm.generate` tool calls. Saves
  `news_findings.json` artifact.
- Other agents (`fundamentals`, `macro`, `sentiment`, `social`,
  `synthesis`) had their `analyze()` signature widened to accept
  `ctx=None` so they don't break.

### 3. `backend/routers/agent_live.py` — live REST + WS API

Mounted under `/api/agent-runtime/`:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/run` | Start a run (fire-and-forget). Returns `{run_id, agent_id, task}`. |
| `GET`  | `/runs?agent_id=&limit=` | List runs. |
| `GET`  | `/runs/{run_id}` | Run summary + meta + artifacts. |
| `GET`  | `/runs/{run_id}/events` | Full `events.jsonl`. |
| `GET`  | `/runs/{run_id}/artifact/{sub}/{name}` | Serve a plot / json file. |
| `GET`  | `/agents/{agent_id}/memory` | `memory.md` (text/plain). |
| `PUT`  | `/agents/{agent_id}/memory` | Overwrite `memory.md`. |
| `GET`  | `/agents/{agent_id}/state` | `state.md` (text/plain). |
| `GET`  | `/agents` | Registry listing. |
| `WS`   | `/ws/runs/{run_id}` | Live event stream. |

The WS handler **replays the events.jsonl backlog first** (so a
late-joining client sees the full timeline), then subscribes to
`EVENT_BUS` and pumps events live until terminal status. Sends a
heartbeat every 30 s.

Registered in [main.py](backend/main.py) via:
```python
from routers import agent_live
app.include_router(agent_live.router)
```

### 4. Frontend live adapter

- [src/features/agents/runtime/liveRun.ts](src/features/agents/runtime/liveRun.ts)
  — `startLiveAgentRun({agentId, ...})` POSTs to the backend, mirrors the
  run into Zustand using the backend's `run_id`, opens a WS, dispatches
  every backend event into `emitEvent` / `addArtifact` / `endRun`. Also
  exports `hydrateAgentMemoryFromBackend()`.
- [src/features/agents/store/agentMonitorStore.ts](src/features/agents/store/agentMonitorStore.ts)
  — `startRun()` now accepts an optional `runId` so the live adapter can
  reuse the backend ID.
- [src/features/agents/components/StreamPanel.tsx](src/features/agents/components/StreamPanel.tsx)
  — replaced the single "Run" button with **Sim** (existing simulated
  runtime) + **Run live** (real backend).

### 5. On-disk layout

Real runs land under `agents/`:
```
agents/
  quants/
    technical_analyst/
      memory.md          # long-running notebook (append-only)
      state.md           # current task / idle marker
      runs/
        run_<id>/
          run.json       # meta (status, signal, conclusion, tokens, …)
          events.jsonl   # one event per line
          summary.md     # human-readable run summary
          plots/<X>.png
          artifacts/<X>.json
```

---

## Verification

Booted the backend (`uvicorn main:app --port 8000` from `backend/`,
inside the `fyer` conda env) and exercised every layer:

1. **`GET /api/agent-runtime/agents`** → returns 7 registered agents
   (technical, news, fundamentals, macro, sentiment, social, synthesis).
2. **`POST /api/agent-runtime/run` (SPY)** → `run_74337cb95e`. After
   ~13 s: `status=success · tokens=1242 · signal=bullish · conf=0.6`,
   conclusion synthesised, 2 artifacts saved (`SPY_technical.png`,
   `indicators.json`), 11 events in jsonl.
3. **`GET …/runs/{id}/artifact/plots/SPY_technical.png`** → `200` ·
   `image/png` · 85 KB.
4. **WebSocket `ws://…/ws/runs/{id}` (MSFT run)** → received 11 events
   in order: `status, tool_call, tool_result, artifact, thought,
   artifact, status, tool_call, tool_result, message, status` —
   terminating cleanly on `runStatus=success`.
5. **Error path** (one Gemini 503): runtime captured the exception,
   emitted `tool_result` with `toolStatus=error`, then `error` event,
   then `runStatus=error`. Frontend would mark the run errored — no
   spinner-stuck state.

Frontend `tsc --noEmit` is clean against the new files.

---

## How to use it from the UI

1. Boot the backend: `cd backend && uvicorn main:app --reload --port 8000`
   (must use the `fyer` conda env so `yfinance`, `TA-Lib`, `google-genai`,
   `matplotlib` resolve, and so dotenv finds `backend/.env` with
   `GEMINI_API_KEY`).
2. Boot the frontend: `npm run dev` (Vite serves at `http://localhost:5173`).
3. Open `/agents`, pick a quant agent (e.g. one whose `agentType` is
   `technical_analyst`), click **Run live**. The Cursor-style timeline
   should fill in with thoughts, the `market_data.history` tool call,
   the saved chart, the `llm.generate` call, and a final BULLISH /
   BEARISH / NEUTRAL conclusion.
4. The run is persisted to disk and survives a backend restart — opening
   the same `run_id` later replays everything.

`VITE_BACKEND_URL` overrides the default `http://localhost:8000`.

---

## What this unlocks for Phase C

Phase C (Boss Agent) can now be built on top of this runtime without
touching plumbing again. The Boss only needs to:

- Spawn a child `AgentRunContext` per delegated task.
- Subscribe to those children via `EVENT_BUS` to aggregate signals.
- Write its own consolidated `memory.md` / `state.md` using the same
  helpers.

In other words: every event the Boss will need to coordinate is already
on the bus and on disk.
