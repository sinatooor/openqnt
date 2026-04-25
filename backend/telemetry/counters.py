"""
Process-local counters with a periodic disk flush.

Snapshot shape (`snapshot()` returns the same dict that lands on disk):

    {
      "since": "<UTC ISO start of process / counter reset>",
      "agent_runs": {
        "started": int,
        "succeeded": int,
        "errored": int,
        "by_agent": { "<agent_id>": {"started": int, "succeeded": int, "errored": int} }
      },
      "tool_calls": {
        "total": int,
        "by_name": { "<tool_name>": int },
        "errors_by_name": { "<tool_name>": int }
      },
      "errors": {
        "total": int,
        "recent": [ {"ts", "where", "message"} ]   # ring buffer, max 50
      },
      "updated_at": "<UTC ISO of last flush>"
    }

`hook_into_context()` monkey-patches `agent_runtime.context.AgentRunContext`
once so every agent run + tool call funnels into the counters without
each agent code path needing to opt in.
"""
from __future__ import annotations

import json
import threading
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
TELEMETRY_DIR = REPO_ROOT / "agents" / "_telemetry"
SNAPSHOT_FILE = TELEMETRY_DIR / "counters.json"

# ── state ────────────────────────────────────────────────────

_LOCK = threading.RLock()
_FLUSH_THROTTLE_S = 1.0  # don't write to disk more than once per second
_RECENT_ERRORS_CAP = 50

_state: dict[str, Any] = {
    "since": None,
    "agent_runs": {"started": 0, "succeeded": 0, "errored": 0, "by_agent": {}},
    "tool_calls": {"total": 0, "by_name": {}, "errors_by_name": {}},
    "errors": {"total": 0, "recent": deque(maxlen=_RECENT_ERRORS_CAP)},
    "updated_at": None,
}
_last_flush_ts: float = 0.0
_hooked: bool = False


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_init() -> None:
    if _state["since"] is None:
        _state["since"] = _utc_iso()


# ── public API ───────────────────────────────────────────────


def reset() -> None:
    """Wipe counters in-process and on disk. Useful for tests + manual reset."""
    with _LOCK:
        _state["since"] = _utc_iso()
        _state["agent_runs"] = {"started": 0, "succeeded": 0, "errored": 0,
                                "by_agent": {}}
        _state["tool_calls"] = {"total": 0, "by_name": {}, "errors_by_name": {}}
        _state["errors"] = {"total": 0, "recent": deque(maxlen=_RECENT_ERRORS_CAP)}
        _flush(force=True)


def bump_agent_run(agent_id: str, kind: str = "started",
                   error: str | None = None) -> None:
    """`kind` ∈ {started, succeeded, errored}."""
    with _LOCK:
        _ensure_init()
        if kind not in {"started", "succeeded", "errored"}:
            return
        _state["agent_runs"][kind] += 1
        per = _state["agent_runs"]["by_agent"].setdefault(
            agent_id, {"started": 0, "succeeded": 0, "errored": 0},
        )
        per[kind] += 1
        if kind == "errored" and error:
            _push_error(where=f"agent:{agent_id}", message=error)
        _flush()


def bump_tool_call(tool_name: str, status: str = "success",
                   message: str | None = None) -> None:
    """`status` ∈ {success, error, pending}. Pending is ignored."""
    with _LOCK:
        _ensure_init()
        if status == "pending":
            return
        _state["tool_calls"]["total"] += 1
        _state["tool_calls"]["by_name"][tool_name] = (
            _state["tool_calls"]["by_name"].get(tool_name, 0) + 1
        )
        if status == "error":
            _state["tool_calls"]["errors_by_name"][tool_name] = (
                _state["tool_calls"]["errors_by_name"].get(tool_name, 0) + 1
            )
            _push_error(where=f"tool:{tool_name}", message=message or "")
        _flush()


def bump_error(where: str, message: str) -> None:
    with _LOCK:
        _ensure_init()
        _push_error(where=where, message=message)
        _flush()


def bump(*, agent_run: tuple[str, str] | None = None,
         tool_call: tuple[str, str] | None = None,
         error: tuple[str, str] | None = None) -> None:
    """Convenience: pass any combination of keyword args."""
    if agent_run is not None:
        bump_agent_run(*agent_run)
    if tool_call is not None:
        bump_tool_call(*tool_call)
    if error is not None:
        bump_error(*error)


def snapshot() -> dict[str, Any]:
    with _LOCK:
        _ensure_init()
        # Convert the deque to a list for JSON encoding.
        out = {
            "since": _state["since"],
            "agent_runs": dict(_state["agent_runs"]),
            "tool_calls": dict(_state["tool_calls"]),
            "errors": {
                "total": _state["errors"]["total"],
                "recent": list(_state["errors"]["recent"]),
            },
            "updated_at": _state["updated_at"] or _utc_iso(),
        }
    return out


# ── persistence ──────────────────────────────────────────────


def _flush(force: bool = False) -> None:
    global _last_flush_ts
    now = datetime.now(timezone.utc).timestamp()
    if not force and (now - _last_flush_ts) < _FLUSH_THROTTLE_S:
        return
    _last_flush_ts = now
    _state["updated_at"] = _utc_iso()
    try:
        TELEMETRY_DIR.mkdir(parents=True, exist_ok=True)
        SNAPSHOT_FILE.write_text(
            json.dumps(snapshot(), indent=2, default=str),
            encoding="utf-8",
        )
    except Exception:
        # Telemetry must never break a request — swallow and move on.
        pass


def _push_error(where: str, message: str) -> None:
    _state["errors"]["total"] += 1
    _state["errors"]["recent"].append({
        "ts": _utc_iso(),
        "where": where,
        "message": (message or "")[:500],
    })


# ── monkey-patch hook ────────────────────────────────────────


def hook_into_context() -> None:
    """Patch `AgentRunContext` so every existing agent emits telemetry."""
    global _hooked
    if _hooked:
        return
    try:
        from agent_runtime import context as ctx_mod
    except Exception:
        # Agent runtime not importable in this process (e.g. tests that
        # import telemetry directly) — noop.
        return

    AgentRunContext = ctx_mod.AgentRunContext
    orig_init = AgentRunContext.__init__
    orig_finish = AgentRunContext.finish
    orig_emit = AgentRunContext._emit

    def _patched_init(self, *a, **kw):
        orig_init(self, *a, **kw)
        try:
            bump_agent_run(self.agent_id, "started")
        except Exception:
            pass

    def _patched_finish(self, status, *a, **kw):
        try:
            kind = "succeeded" if status == "success" else "errored"
            err = kw.get("error") or (a[3] if len(a) > 3 else None)
            bump_agent_run(self.agent_id, kind, error=err if kind == "errored" else None)
        except Exception:
            pass
        return orig_finish(self, status, *a, **kw)

    def _patched_emit(self, kind, **payload):
        eid = orig_emit(self, kind, **payload)
        try:
            if kind == "tool_call":
                # Pending-only; don't double-count when the result lands.
                pass
            elif kind == "tool_result":
                name = payload.get("toolName") or "unknown"
                status = payload.get("toolStatus") or "success"
                bump_tool_call(name, status=status,
                               message=payload.get("toolOutput") if status == "error" else None)
            elif kind == "error":
                bump_error(where=f"agent:{getattr(self, 'agent_id', '?')}",
                           message=payload.get("text", ""))
        except Exception:
            pass
        return eid

    AgentRunContext.__init__ = _patched_init  # type: ignore[assignment]
    AgentRunContext.finish = _patched_finish  # type: ignore[assignment]
    AgentRunContext._emit = _patched_emit     # type: ignore[assignment]
    _hooked = True
