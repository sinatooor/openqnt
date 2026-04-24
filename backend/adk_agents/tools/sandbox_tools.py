"""
Agent-facing sandbox tools.

`execute_python_tool(code, files_in, ctx)` runs `code` inside the
Phase-G subprocess sandbox and returns the trimmed result the LLM can
reason about. When given an `AgentRunContext` it:

  - emits `tool_call("execute_python", {…})` on entry
  - persists any plots returned by the sandbox via `ctx.save_artifact`
  - emits a one-line `tool_result` with exit code, duration, and a
    head/tail of stdout
"""
from __future__ import annotations

import base64
from typing import Any, Optional

from sandbox import ExecuteRequest, execute_python


def _summarise_streams(stdout: str, stderr: str, head: int = 800, tail: int = 400) -> dict[str, str]:
    def squeeze(s: str) -> str:
        if len(s) <= head + tail + 80:
            return s
        return f"{s[:head]}\n…[middle truncated; {len(s)} chars total]…\n{s[-tail:]}"
    return {"stdout": squeeze(stdout), "stderr": squeeze(stderr)}


def execute_python_tool(
    code: str,
    files_in: Optional[dict[str, str | bytes]] = None,
    timeout_s: float = 8.0,
    cpu_seconds: int = 10,
    mem_mb: int = 512,
    ctx: Any = None,
) -> dict[str, Any]:
    """Run arbitrary Python in the sandbox.

    Returns a JSON-friendly dict:
      {
        success, exit_code, duration_ms, timed_out,
        stdout, stderr, files: [{name, size_bytes, is_plot, content_b64?}],
      }
    """
    files_in = files_in or {}
    req = ExecuteRequest(
        code=code,
        files_in=files_in,
        timeout_s=timeout_s,
        cpu_seconds=cpu_seconds,
        mem_mb=mem_mb,
    )

    if ctx is None:
        result = execute_python(req)
        return _shape(result)

    with ctx.tool_call(
        "execute_python",
        {
            "code_preview": code[:200],
            "files_in": list(files_in.keys()),
            "timeout_s": timeout_s,
        },
    ) as h:
        result = execute_python(req)
        # Persist plots into the run's artifact dir so they show inline.
        for plot in result.plots:
            if not plot.content_b64:
                continue
            try:
                png = base64.b64decode(plot.content_b64)
                ctx.save_artifact(plot.name, png, kind="plot",
                                  caption=f"sandbox plot · {plot.name}")
            except Exception:  # noqa: BLE001
                pass

        head = (result.stdout or "").strip().splitlines()
        tail_line = head[-1] if head else "(no output)"
        status = "success" if result.success else "error"
        h.result(
            f"exit={result.exit_code} · {result.duration_ms}ms · "
            f"plots={len(result.plots)} · last: {tail_line[:80]}",
            status=status,
        )

    return _shape(result)


def _shape(result) -> dict[str, Any]:
    streams = _summarise_streams(result.stdout, result.stderr)
    return {
        "success": result.success,
        "exit_code": result.exit_code,
        "duration_ms": result.duration_ms,
        "timed_out": result.timed_out,
        "stdout": streams["stdout"],
        "stderr": streams["stderr"],
        "error": result.error,
        "files": [
            {
                "name": f.name,
                "size_bytes": f.size_bytes,
                "is_plot": f.is_plot,
                # Only inline plots into the LLM-facing payload — other
                # files would balloon the context. Code can re-read them
                # from `ctx.run_dir / "plots" / name` if it really wants.
                "content_b64": f.content_b64 if f.is_plot else None,
            }
            for f in result.files_out
        ],
    }
