"""
AgentRunContext — the single thing every agent uses to talk to the runtime.

Usage inside an agent:

    async def analyze(self, context, ctx: AgentRunContext) -> AgentOutput:
        ctx.status("Fetching market data…")
        with ctx.tool_call("market_data.history", {"symbol": "AAPL"}):
            df = fetch_history("AAPL")           # may raise — recorded as error
            ctx.tool_result(f"{len(df)} bars")
        ctx.thought("Looks like a clean uptrend.")
        ctx.save_plot(fig, "equity.png")
        ctx.message("Final view: bullish.")

Every emit:
  • appends to events.jsonl (durable)
  • publishes to EVENT_BUS for live WebSocket subscribers
  • mirrors the StreamEvent shape used by the frontend store (kind, ts, …)
"""

from __future__ import annotations

import contextlib
import io
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from .event_bus import EVENT_BUS
from .storage import (
    append_event,
    append_memory,
    list_artifacts,
    run_dir,
    write_run_meta,
    write_state,
    write_summary,
)


def _now_ms() -> int:
    return int(time.time() * 1000)


def _evt_id() -> str:
    return f"evt_{uuid.uuid4().hex[:10]}"


class AgentRunContext:
    """One context per run. Not thread-safe; use one per asyncio task."""

    def __init__(
        self,
        agent_id: str,
        task: str,
        symbols: list[str] | None = None,
        model: str | None = None,
        run_id: str | None = None,
    ) -> None:
        self.agent_id = agent_id
        self.run_id = run_id or f"run_{uuid.uuid4().hex[:10]}"
        self.task = task
        self.symbols = symbols or []
        self.model = model
        self.started_at = datetime.now(timezone.utc).isoformat()
        self._tokens = 0

        # Initialise the run dir + meta.
        run_dir(agent_id, self.run_id)
        write_run_meta(agent_id, self.run_id, {
            "agent_id": agent_id,
            "run_id": self.run_id,
            "task": task,
            "symbols": self.symbols,
            "model": model,
            "status": "running",
            "started_at": self.started_at,
        })
        write_state(agent_id, f"# state\n_running_\n\nTask: {task}\nRun: {self.run_id}\n")

    # ── low-level emit ────────────────────────────────────────────

    def _emit(self, kind: str, **payload: Any) -> str:
        eid = payload.pop("id", None) or _evt_id()
        event = {
            "id": eid,
            "agentId": self.agent_id,
            "runId": self.run_id,
            "kind": kind,
            "ts": _now_ms(),
            **payload,
        }
        # Drop None values so the JSON stays small.
        event = {k: v for k, v in event.items() if v is not None}
        append_event(self.agent_id, self.run_id, event)
        EVENT_BUS.publish(self.run_id, event)
        return eid

    # ── high-level convenience ────────────────────────────────────

    def status(self, text: str) -> str:
        return self._emit("status", text=text)

    def thought(self, text: str) -> str:
        return self._emit("thought", text=text)

    def message(self, text: str) -> str:
        return self._emit("message", text=text)

    def error_event(self, text: str) -> str:
        return self._emit("error", text=text)

    @contextlib.contextmanager
    def tool_call(self, name: str, input: dict[str, Any] | None = None) -> Iterator["ToolCallHandle"]:
        """Context manager that emits tool_call (pending) on entry and
        tool_result (success/error) on exit. Use `handle.result(...)` to set
        the output text — otherwise the str() of the returned value is used."""
        call_id = self._emit("tool_call", toolName=name, toolInput=input or {}, toolStatus="pending")
        handle = ToolCallHandle(self, call_id, name)
        try:
            yield handle
        except Exception as e:  # noqa: BLE001
            self._emit(
                "tool_result",
                parentEventId=call_id,
                toolName=name,
                toolStatus="error",
                toolOutput=f"{type(e).__name__}: {e}",
            )
            raise
        else:
            if not handle._sent:
                self._emit(
                    "tool_result",
                    parentEventId=call_id,
                    toolName=name,
                    toolStatus="success",
                    toolOutput=handle._output or "(no output)",
                )

    def tool_result(self, output: str, status: str = "success", parent_event_id: str | None = None) -> str:
        """Standalone tool_result — useful when not using the context manager."""
        return self._emit(
            "tool_result",
            parentEventId=parent_event_id,
            toolStatus=status,
            toolOutput=output,
        )

    # ── artifacts ─────────────────────────────────────────────────

    def save_artifact(self, name: str, content: bytes | str, kind: str = "file", caption: str | None = None) -> str:
        sub = "plots" if kind == "plot" else "artifacts"
        path = run_dir(self.agent_id, self.run_id) / sub / name
        if isinstance(content, str):
            path.write_text(content, encoding="utf-8")
        else:
            path.write_bytes(content)
        return self._emit(
            "artifact",
            artifactId=name,
            text=name,
            artifactKind=kind,
            artifactPath=f"/{sub}/{name}",
            caption=caption,
        )

    def save_plot(self, fig, name: str = "plot.png", caption: str | None = None) -> str:
        """Save a matplotlib Figure as PNG."""
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=120, bbox_inches="tight")
        buf.seek(0)
        return self.save_artifact(name, buf.read(), kind="plot", caption=caption)

    def save_json(self, name: str, data: Any, caption: str | None = None) -> str:
        return self.save_artifact(
            name, json.dumps(data, indent=2, default=str), kind="file", caption=caption,
        )

    # ── memory & state ────────────────────────────────────────────

    def append_memory(self, markdown: str) -> None:
        append_memory(self.agent_id, markdown)

    def update_state(self, markdown: str) -> None:
        write_state(self.agent_id, markdown)

    # ── tokens ────────────────────────────────────────────────────

    def add_tokens(self, n: int) -> None:
        self._tokens += int(n or 0)

    @property
    def tokens(self) -> int:
        return self._tokens

    # ── lifecycle close ───────────────────────────────────────────

    def finish(
        self,
        status: str,
        conclusion: str | None = None,
        signal: str | None = None,
        confidence: float | None = None,
        error: str | None = None,
    ) -> None:
        ended_at = datetime.now(timezone.utc).isoformat()
        meta: dict[str, Any] = {
            "agent_id": self.agent_id,
            "run_id": self.run_id,
            "task": self.task,
            "symbols": self.symbols,
            "model": self.model,
            "status": status,
            "started_at": self.started_at,
            "ended_at": ended_at,
            "tokens": self._tokens,
            "signal": signal,
            "confidence": confidence,
            "conclusion": conclusion,
            "error": error,
        }
        write_run_meta(self.agent_id, self.run_id, meta)

        # human-readable summary.md
        lines: list[str] = [
            f"# Run {self.run_id}",
            "",
            f"- **Agent:** `{self.agent_id}`",
            f"- **Task:** {self.task}",
            f"- **Symbols:** {', '.join(self.symbols) or '—'}",
            f"- **Model:** {self.model or '—'}",
            f"- **Status:** {status}",
            f"- **Started:** {self.started_at}",
            f"- **Ended:** {ended_at}",
            f"- **Tokens:** {self._tokens}",
        ]
        if signal:
            lines.append(f"- **Signal:** {signal} (confidence {confidence})")
        if conclusion:
            lines += ["", "## Conclusion", "", conclusion]
        if error:
            lines += ["", "## Error", "", f"```\n{error}\n```"]
        write_summary(self.agent_id, self.run_id, "\n".join(lines) + "\n")

        # idle state.md
        write_state(self.agent_id, f"# state\n_idle_\n\nLast run: {self.run_id} ({status})\n")

        # signal-bearing memory append (only on success)
        if status == "success" and conclusion:
            stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            tail = (
                f"\n---\n### Run {self.run_id} · {stamp}\n"
                f"- Task: _{self.task}_\n"
                f"- Symbols: {', '.join(self.symbols) or '—'}\n"
                + (f"- Signal: **{signal}** (confidence {confidence})\n" if signal else "")
                + f"- Conclusion: {conclusion[:300]}\n"
            )
            self.append_memory(tail)

        # Final lifecycle event.
        self._emit(
            "status" if status == "success" else "error",
            text=conclusion or error or status,
            runStatus=status,
            signal=signal,
            confidence=confidence,
        )


class ToolCallHandle:
    def __init__(self, ctx: AgentRunContext, call_id: str, name: str) -> None:
        self._ctx = ctx
        self.call_id = call_id
        self.name = name
        self._output: str | None = None
        self._sent = False

    def result(self, output: str, status: str = "success") -> None:
        """Explicitly set the tool_result text. Otherwise the context manager
        emits a generic success on clean exit."""
        self._output = output
        self._sent = True
        self._ctx._emit(
            "tool_result",
            parentEventId=self.call_id,
            toolName=self.name,
            toolStatus=status,
            toolOutput=output,
        )

    def set_output(self, output: str) -> None:
        """Set the success text without emitting yet — exit handler will emit."""
        self._output = output


# ── current_run_dir helper (rare — exposed for tools that bypass ctx) ──

def current_run_dir(ctx: AgentRunContext) -> Path:
    return run_dir(ctx.agent_id, ctx.run_id)
