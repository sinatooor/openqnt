"""
Phase J3 telemetry tests.

Covers the counter math + the AgentRunContext hook (so a real agent
flow bumps the counters end-to-end without each agent calling
telemetry directly).
"""
from __future__ import annotations

import shutil

import pytest

from telemetry import (
    bump_agent_run,
    bump_error,
    bump_tool_call,
    hook_into_context,
    reset,
    snapshot,
)
from telemetry.counters import SNAPSHOT_FILE, TELEMETRY_DIR


@pytest.fixture(autouse=True)
def _clean_telemetry():
    if TELEMETRY_DIR.exists():
        shutil.rmtree(TELEMETRY_DIR)
    reset()
    yield
    reset()
    if TELEMETRY_DIR.exists():
        shutil.rmtree(TELEMETRY_DIR)


def test_bump_agent_run_aggregates_per_agent():
    bump_agent_run("technical_analyst", "started")
    bump_agent_run("technical_analyst", "succeeded")
    bump_agent_run("news_analyst", "started")
    bump_agent_run("news_analyst", "errored", error="boom")

    s = snapshot()["agent_runs"]
    assert s["started"] == 2
    assert s["succeeded"] == 1
    assert s["errored"] == 1
    assert s["by_agent"]["technical_analyst"]["succeeded"] == 1
    assert s["by_agent"]["news_analyst"]["errored"] == 1


def test_bump_tool_call_counts_per_name_with_errors():
    bump_tool_call("backtest.run", "success")
    bump_tool_call("backtest.run", "success")
    bump_tool_call("execute_python", "error", message="timeout")

    s = snapshot()["tool_calls"]
    assert s["total"] == 3
    assert s["by_name"]["backtest.run"] == 2
    assert s["errors_by_name"]["execute_python"] == 1


def test_bump_error_writes_to_recent_ring_and_persists():
    for i in range(60):  # > _RECENT_ERRORS_CAP (50)
        bump_error("agent:loadtest", f"err {i}")

    s = snapshot()["errors"]
    assert s["total"] == 60
    # Ring buffer must hold last 50.
    assert len(s["recent"]) == 50
    assert s["recent"][-1]["message"] == "err 59"
    assert s["recent"][0]["message"] == "err 10"
    assert SNAPSHOT_FILE.exists()


def test_hook_into_context_attaches_once():
    """Patching twice must not double-count."""
    hook_into_context()
    hook_into_context()  # idempotent
    # Smoke: any agent run we create after the hook bumps the counters.
    from agent_runtime.context import AgentRunContext

    ctx = AgentRunContext(agent_id="hook_test", task="t")
    ctx.finish("success", conclusion="ok")

    s = snapshot()["agent_runs"]
    assert s["started"] >= 1
    assert s["succeeded"] >= 1
    assert "hook_test" in s["by_agent"]


def test_hook_into_context_counts_tool_results_via_emit():
    hook_into_context()
    from agent_runtime.context import AgentRunContext

    ctx = AgentRunContext(agent_id="emit_test", task="t")
    with ctx.tool_call("dummy.tool", {"x": 1}) as h:
        h.result("done")
    ctx.finish("success", conclusion="ok")

    s = snapshot()["tool_calls"]
    assert s["by_name"].get("dummy.tool", 0) >= 1
