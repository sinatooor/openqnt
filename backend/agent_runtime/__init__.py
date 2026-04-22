"""
Agent runtime — persistent on-disk runs, in-memory event bus, AgentRunContext.

The runtime is the single piece of plumbing every quant agent uses to:
  • emit Cursor-style stream events (thought, tool_call, tool_result, message, …)
  • persist a per-run event log (events.jsonl) to disk
  • save artifacts (plots, csvs) under the run dir
  • append to the agent's long-running memory.md
  • update the agent's state.md (current task)

The on-disk layout (rooted at REPO/agents/) matches PLAN.md Phase B1.
"""

from .context import AgentRunContext, current_run_dir
from .event_bus import EVENT_BUS, EventBus
from .storage import (
    AGENTS_ROOT,
    agent_dir,
    list_runs,
    load_run,
    load_run_events,
    read_memory,
    read_state,
    write_memory,
    write_state,
)

__all__ = [
    "AgentRunContext",
    "current_run_dir",
    "EVENT_BUS",
    "EventBus",
    "AGENTS_ROOT",
    "agent_dir",
    "list_runs",
    "load_run",
    "load_run_events",
    "read_memory",
    "read_state",
    "write_memory",
    "write_state",
]
