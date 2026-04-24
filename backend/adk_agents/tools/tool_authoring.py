"""
Agent-facing wrappers around the dynamic-tool registry.

These are the verbs a `developer_agent` uses to extend the system at
runtime:

  - `create_dynamic_tool_tool(name, code, description, ctx)`
        validate + persist a new Python tool.
  - `call_dynamic_tool_tool(name, kwargs, ctx)`
        run a previously-authored tool inside the sandbox and return its
        JSON result.
  - `list_dynamic_tools_tool(ctx)`
        enumerate what's currently registered.

Each emits a `tool_call` / `tool_result` pair when given a context, so
the new-tool round-trip shows up in the live agent stream.
"""
from __future__ import annotations

from typing import Any, Optional

from dynamic_tools import (
    call_dynamic_tool,
    create_dynamic_tool,
    list_dynamic_tools,
)


def _emit(ctx: Any, name: str, payload: dict[str, Any]) -> Any:
    if ctx is None:
        return _NoCtx()
    return ctx.tool_call(name, payload)


class _NoCtx:
    def __enter__(self):
        return _NoHandle()

    def __exit__(self, *a):
        return False


class _NoHandle:
    def result(self, *_a, **_k): ...
    def set_output(self, *_a, **_k): ...


def create_dynamic_tool_tool(
    name: str,
    code: str,
    description: str = "",
    ctx: Any = None,
) -> dict[str, Any]:
    """Validate + persist a new agent-authored tool."""
    with _emit(ctx, "developer.create_tool",
               {"name": name, "len_code": len(code), "description": description[:120]}) as h:
        result = create_dynamic_tool(name=name, code=code, description=description)
        if result["ok"]:
            sig = result["meta"]["signature"]
            h.result(f"created `{name}` · {sig}")
        else:
            h.result("create failed: " + " · ".join(result.get("errors", [])), status="error")
        return result


def call_dynamic_tool_tool(
    name: str,
    kwargs: Optional[dict[str, Any]] = None,
    timeout_s: float = 8.0,
    ctx: Any = None,
) -> dict[str, Any]:
    """Invoke a previously-registered dynamic tool inside the sandbox."""
    kwargs = kwargs or {}
    with _emit(ctx, f"dyn.{name}", {"kwargs": kwargs}) as h:
        result = call_dynamic_tool(name, kwargs, timeout_s=timeout_s)
        if result["ok"]:
            head = repr(result.get("result"))[:120]
            h.result(f"{result['duration_ms']}ms · {head}")
        else:
            h.result(f"call failed: {result.get('error', 'unknown')}", status="error")
        return result


def list_dynamic_tools_tool(ctx: Any = None) -> dict[str, Any]:
    """List every tool currently authored under `agents/tools/dynamic/`."""
    metas = list_dynamic_tools()
    payload = {
        "count": len(metas),
        "tools": [
            {
                "name": m.name,
                "description": m.description,
                "signature": m.signature,
                "updated_at": m.updated_at,
            }
            for m in metas
        ],
    }
    with _emit(ctx, "developer.list_tools", {}) as h:
        h.result(f"{payload['count']} dynamic tool(s) registered")
    return payload
