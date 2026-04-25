"""
Phase J telemetry — process-local counters, persisted to disk.

Three counter families:
  * `agent_runs`  — bumped on AgentRunContext.__init__ + .finish()
  * `tool_calls`  — bumped on every `ctx.tool_call(name, …)`
  * `errors`      — bumped on tool_result(status="error") + run-level error

Counters live in process memory and snapshot to
`agents/_telemetry/counters.json` every 30 s + on every public mutation
so a backend restart doesn't lose recent activity. The file is the
single source of truth — REST + the dashboard widget read it back.

Public surface intentionally tiny:

    from telemetry import (
        bump, snapshot, hook_into_context, reset,
    )

`hook_into_context()` is called once at module import so every
existing AgentRunContext (Phase B's runtime) increments counters
without each agent needing to opt in.
"""
from .counters import (
    bump,
    bump_agent_run,
    bump_error,
    bump_tool_call,
    hook_into_context,
    reset,
    snapshot,
)

__all__ = [
    "bump",
    "bump_agent_run",
    "bump_error",
    "bump_tool_call",
    "hook_into_context",
    "reset",
    "snapshot",
]
