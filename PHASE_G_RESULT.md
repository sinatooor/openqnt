# Phase G — Sandbox & dynamic tool creation · RESULT

**Status:** ✅ Complete · verified end-to-end on 2026-04-23

Phase G turns the platform from "fixed set of agent tools" into one
where agents can **author new Python tools at runtime**, validate them,
and call them — all under a subprocess sandbox so a misbehaving generated
tool can't take the backend down.

---

## What was built

### 1. `backend/sandbox/` — subprocess sandbox runner

| File | Purpose |
| --- | --- |
| [schema.py](backend/sandbox/schema.py) | `ExecuteRequest` / `ExecuteResult` / `FileOut` dataclasses |
| [runner.py](backend/sandbox/runner.py) | `execute_python(req) → ExecuteResult` — never raises |
| [\_\_init\_\_.py](backend/sandbox/__init__.py) | Public surface |

Per-call: mints a fresh tmpdir, drops `req.files_in` into it, spawns
`python -I main.py …` with `setrlimit(RLIMIT_CPU, RLIMIT_FSIZE,
RLIMIT_AS|RLIMIT_DATA)` from a `preexec_fn`, runs `setsid` so the whole
process group can be killed on timeout. Captures stdout/stderr (capped
at 200 KB), harvests every file the script left behind (PNGs always
inlined as base64; other small files inlined under 2 MB), and tears the
tmpdir down. Stream caps + file caps mean a runaway loop can't blow the
response.

Threat model: this is **defence-in-depth**, not a multi-tenant security
boundary. Trust profile = "agent-generated code on a single-tenant
developer box". For multi-tenant deployment, swap in option (a)
Docker-per-run (the runner contract is small enough that the swap is
mechanical). G1 picked option (b) per PLAN.md's recommendation.

### 2. `backend/dynamic_tools/` — agent-authored tool registry

| File | Purpose |
| --- | --- |
| [registry.py](backend/dynamic_tools/registry.py) | `create_dynamic_tool`, `call_dynamic_tool`, `list_dynamic_tools`, `delete_dynamic_tool`, `read_dynamic_tool_source`, `_validate_module` |
| [\_\_init\_\_.py](backend/dynamic_tools/__init__.py) | Public surface |

**Validation invariants** (every new tool must satisfy these before it's
written to disk):

- module compiles
- exports a function with the same `name` as the tool (snake_case)
- every parameter is type-annotated and the function declares a return type
- function carries a non-empty docstring
- no imports from `_FORBIDDEN_IMPORTS = {subprocess, ctypes, socket, asyncio, fcntl, shutil}`
- a sandbox probe successfully imports the module and confirms the
  symbol is callable

If any check fails, **nothing is persisted** — the caller gets back
`{ok: False, errors: [...]}` and the on-disk state is unchanged.

**Storage**: `agents/tools/dynamic/<name>.py` plus an `_index.json` of
`DynamicToolMeta`. `call_dynamic_tool(name, kwargs)` re-reads the file
fresh on every call (so authoring + use can interleave inside a single
agent run) and runs it under the same sandbox via a tiny harness that
prints the JSON-encoded result between `===RESULT===` / `===END===`
fences.

### 3. `backend/adk_agents/tools/` — agent-facing wrappers

| File | Purpose |
| --- | --- |
| [sandbox_tools.py](backend/adk_agents/tools/sandbox_tools.py) | `execute_python_tool(code, files_in, ctx)` — emits `tool_call("execute_python", …)`, persists plots via `ctx.save_artifact`, returns trimmed JSON |
| [tool_authoring.py](backend/adk_agents/tools/tool_authoring.py) | `create_dynamic_tool_tool`, `call_dynamic_tool_tool`, `list_dynamic_tools_tool` — the verbs a `developer_agent` uses |

Both surface emit `tool_call` / `tool_result` pairs when given an
`AgentRunContext` so the new-tool round-trip shows up live in the agent
stream.

### 4. `backend/routers/tools.py` — REST surface

Mounted under `/api/tools` from
[main.py](backend/main.py) (line ~270).

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/tools` | `{static, dynamic}` catalogue |
| GET | `/api/tools/dynamic` | `{count, tools[]}` |
| GET | `/api/tools/dynamic/{name}` | `{meta, source}` |
| POST | `/api/tools/sandbox/execute` | run arbitrary code |
| POST | `/api/tools/dynamic` | author a new tool |
| POST | `/api/tools/dynamic/{name}/call` | call an existing tool |
| DELETE | `/api/tools/dynamic/{name}` | remove a tool |

### 5. Frontend `/tools` panel

| File | Purpose |
| --- | --- |
| [src/features/tools/api.ts](src/features/tools/api.ts) | typed client |
| [src/features/tools/ToolsPanel.tsx](src/features/tools/ToolsPanel.tsx) | three-section layout: catalogue (left), sandbox playground + author form + inspect-and-call (right) |
| [src/pages/Tools.tsx](src/pages/Tools.tsx) + [src/App.tsx](src/App.tsx) | mounted at `/tools` |

Sandbox playground: paste Python → Run → see stdout / stderr / inlined
PNG plots, with exit code + duration. Author form: name + description
+ code → Validate + Register; validation errors bubble up as a list.
Inspect panel: shows source + signature, with a JSON-`kwargs` input
that calls the tool through the sandbox and renders the result.

### 6. Tests — `backend/tests/test_dynamic_tools.py`

9 tests, all passing (11.76 s):

```
test_sandbox_runs_simple_code
test_sandbox_enforces_timeout
test_sandbox_returns_plot_inline
test_create_then_call_dynamic_tool
test_validation_rejects_missing_annotations
test_validation_rejects_missing_function_name
test_validation_rejects_forbidden_imports
test_delete_dynamic_tool
test_exit_criterion_full_flow                    ← Phase G exit criterion
```

---

## Exit criterion proof

> *ask the system to compute something it doesn't currently have a tool
> for; it writes the tool, registers it, uses it, returns the answer.*

`test_exit_criterion_full_flow`:

1. `list_dynamic_tools()` → empty.
2. The system gets asked for **VaR @ 95 %** — no built-in tool.
3. Author the tool (signature + docstring + annotations validated +
   sandbox-probed): `compute_var_95(returns: list[float]) -> dict`.
4. A second caller (representing the next agent run) lists the tools,
   finds it, and calls it: `compute_var_95([-1, 0, 1, 2])`.
5. Sandbox returns `{var_95: -1.0, n: 4}`. Test asserts the answer.

Same flow via REST (backend on `localhost:8000`):

```bash
# 1. Sandbox runs arbitrary code
$ curl -s -X POST :8000/api/tools/sandbox/execute \
  -H 'content-type: application/json' \
  -d '{"code":"print(sum(range(100)))"}'
# → success=True stdout='4950' duration=96ms

# 2. Author a tool the system didn't have
$ curl -s -X POST :8000/api/tools/dynamic \
  -H 'content-type: application/json' \
  -d '{"name":"compute_var_95","description":"Empirical 95% VaR",
       "code":"def compute_var_95(returns: list[float]) -> dict:\n    \"\"\"…\"\"\"\n    s=sorted(returns); idx=max(0,int(0.05*len(s))-1)\n    return {\"var\": float(s[idx]), \"n\": len(s)}\n"}'
# → {"ok": true, "meta": {"signature": "compute_var_95(returns: list[float]) -> dict", ...}}

# 3. Call it
$ curl -s -X POST :8000/api/tools/dynamic/compute_var_95/call \
  -H 'content-type: application/json' \
  -d '{"kwargs":{"returns":[-2.1,-1.0,0.5,1.2,2.4]}}'
# → {"ok": true, "result": {"var": -2.1, "n": 5}, "duration_ms": 30}
```

End-to-end answer in 30 ms after a one-shot author step.

---

## How to use

```bash
# Backend
cd backend && /opt/miniconda3/envs/fyer/bin/python -m uvicorn main:app --port 8000

# Tests
pytest backend/tests/test_dynamic_tools.py -q   # 9 passed

# Frontend
npm run dev   # then navigate to /tools
```

From inside an agent (Python):

```python
from agent_runtime.context import AgentRunContext
from adk_agents.tools.sandbox_tools import execute_python_tool
from adk_agents.tools.tool_authoring import (
    create_dynamic_tool_tool, call_dynamic_tool_tool,
)

ctx = AgentRunContext(agent_id="developer", task="add VaR tool", model="gpt-x")

# Run arbitrary Python in the sandbox; tool_call + tool_result events emitted.
res = execute_python_tool(code="print(2+2)", ctx=ctx)

# Author + invoke a new tool.
create_dynamic_tool_tool(name="compute_var_95", code=SOURCE, ctx=ctx)
ans  = call_dynamic_tool_tool("compute_var_95", {"returns": [-1, 0, 1]}, ctx=ctx)
```

---

## PLAN.md status — Phase G

- [x] **G1.** Picked sandbox approach (b) — subprocess + `setrlimit` +
  per-call tmpdir + restricted env. Threat model documented above.
- [x] **G2.** `execute_python(code, files_in)` returning
  `{stdout, stderr, files_out, plots, exit_code, duration_ms,
  timed_out}`. Timeout + memory cap enforced.
- [ ] **G3.** Browser tool extension (Playwright) — **deferred**. The
  sandbox is the foundation; Playwright would slot in as another agent
  tool that drives a browser inside its own sandbox. Documenting as
  follow-up so it doesn't get conflated with G1/G2/G4/G5.
- [x] **G4.** Dynamic tool registration (`create_dynamic_tool` →
  validate → persist to `agents/tools/dynamic/` → callable on the next
  agent run via `call_dynamic_tool`).
- [x] **G5.** Tool registry surface — REST `/api/tools/*` + read-only
  static list, with a sandbox playground + author form + inspect-and-call
  view in the `/tools` page.

Exit criterion met. Phase G is done.
