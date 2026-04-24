"""Phase G exit-criterion test.

Demonstrates that an agent (or anyone via REST) can:
  1. Discover the system has no tool to compute a particular thing.
  2. Author a Python tool that does it.
  3. Validate + register it.
  4. Call it through the sandbox.
  5. Get the answer back.

We test it for `compute_var_95(returns)` — Value-at-Risk at the 5%
quantile, a tiny one-liner that the codebase doesn't currently expose
as a tool.

Run:  pytest backend/tests/test_dynamic_tools.py -q
"""
from __future__ import annotations

import shutil

import pytest

from dynamic_tools import (
    DYNAMIC_TOOLS_DIR,
    call_dynamic_tool,
    create_dynamic_tool,
    delete_dynamic_tool,
    list_dynamic_tools,
)
from sandbox import ExecuteRequest, execute_python


@pytest.fixture(autouse=True)
def _clean_registry():
    """Wipe the dynamic-tools dir between tests so we don't leak state."""
    if DYNAMIC_TOOLS_DIR.exists():
        shutil.rmtree(DYNAMIC_TOOLS_DIR)
    yield
    if DYNAMIC_TOOLS_DIR.exists():
        shutil.rmtree(DYNAMIC_TOOLS_DIR)


# ── sandbox basics ───────────────────────────────────────────────────


def test_sandbox_runs_simple_code():
    res = execute_python(ExecuteRequest(code="print(2 + 2)"))
    assert res.success
    assert res.exit_code == 0
    assert res.stdout.strip() == "4"
    assert res.duration_ms < 5000


def test_sandbox_enforces_timeout():
    res = execute_python(ExecuteRequest(code="import time; time.sleep(3)", timeout_s=0.5))
    assert not res.success
    assert res.timed_out
    assert "timed out" in res.stderr


def test_sandbox_returns_plot_inline():
    code = (
        "import matplotlib.pyplot as plt\n"
        "fig, ax = plt.subplots(figsize=(2,1))\n"
        "ax.plot([1, 2, 3])\n"
        "fig.savefig('out.png', dpi=60)\n"
        "print('done')\n"
    )
    res = execute_python(ExecuteRequest(code=code, timeout_s=20.0))
    assert res.success, res.stderr
    assert res.stdout.strip().endswith("done")
    assert any(p.is_plot and p.name == "out.png" for p in res.plots)
    plot = next(p for p in res.plots if p.name == "out.png")
    assert plot.content_b64, "plot must be inlined as base64"


# ── dynamic tool author + call ───────────────────────────────────────


_VAR_TOOL_CODE = """
def compute_var_95(returns: list[float]) -> dict:
    \"\"\"Historical VaR @ 95% — the empirical 5th percentile of `returns`.

    Negative values represent losses. Returns a dict so the caller gets
    both the VaR and the basic descriptive stats.
    \"\"\"
    if not returns:
        return {"var_95": 0.0, "n": 0, "mean": 0.0}
    sorted_r = sorted(returns)
    idx = max(0, int(0.05 * len(sorted_r)) - 1)
    var = sorted_r[idx]
    return {
        "var_95": float(var),
        "n": len(returns),
        "mean": sum(returns) / len(returns),
    }
"""


def test_create_then_call_dynamic_tool():
    out = create_dynamic_tool(
        name="compute_var_95",
        code=_VAR_TOOL_CODE,
        description="Empirical VaR at 95%",
    )
    assert out["ok"], out.get("errors")
    assert out["meta"]["signature"].startswith("compute_var_95(returns:")
    assert "list" in out["meta"]["signature"]

    metas = list_dynamic_tools()
    assert len(metas) == 1
    assert metas[0].name == "compute_var_95"

    # 200 samples around 0 with negative tail → expected VaR ~ -1.5..-2 std.
    returns = [-2.5, -2.1, -1.8, -1.0, -0.5, 0.0, 0.1, 0.4, 0.9, 1.7] * 20
    res = call_dynamic_tool("compute_var_95", {"returns": returns})
    assert res["ok"], res
    val = res["result"]
    assert isinstance(val, dict)
    assert val["n"] == len(returns)
    # 5% of 200 = 10 → VaR is the 10th smallest, which (sorted) is the
    # last value of the 10-row pattern's first decile.
    assert val["var_95"] < 0


def test_validation_rejects_missing_annotations():
    bad = "def my_tool(x):\n    return x + 1\n"
    out = create_dynamic_tool("my_tool", bad)
    assert not out["ok"]
    assert any("type annotation" in e or "return type" in e for e in out["errors"])


def test_validation_rejects_missing_function_name():
    bad = "def something_else(x: int) -> int:\n    \"\"\"docs\"\"\"\n    return x\n"
    out = create_dynamic_tool("compute_var_95", bad)
    assert not out["ok"]
    assert any("compute_var_95" in e for e in out["errors"])


def test_validation_rejects_forbidden_imports():
    bad = (
        "import subprocess\n"
        "def evil_tool(x: int) -> int:\n"
        "    \"\"\"shouldn't make it\"\"\"\n"
        "    return x\n"
    )
    out = create_dynamic_tool("evil_tool", bad)
    assert not out["ok"]
    assert any("Forbidden" in e for e in out["errors"])


def test_delete_dynamic_tool():
    create_dynamic_tool("compute_var_95", _VAR_TOOL_CODE)
    assert delete_dynamic_tool("compute_var_95") is True
    assert delete_dynamic_tool("compute_var_95") is False  # already gone
    assert list_dynamic_tools() == []


# ── end-to-end exit-criterion ────────────────────────────────────────


def test_exit_criterion_full_flow():
    """The Phase G exit criterion: the system gets asked for VaR (no
    tool exists), authors one, registers it, calls it, returns answer.
    """
    # Step 1: nothing registered.
    assert list_dynamic_tools() == []

    # Step 2 + 3: developer flow authors + registers the tool.
    create = create_dynamic_tool("compute_var_95", _VAR_TOOL_CODE)
    assert create["ok"]

    # Step 4: another agent run picks it up + calls it.
    metas = list_dynamic_tools()
    assert any(m.name == "compute_var_95" for m in metas)

    answer = call_dynamic_tool("compute_var_95", {"returns": [-1.0, 0.0, 1.0, 2.0]})
    assert answer["ok"], answer

    # Step 5: the answer is meaningful.
    val = answer["result"]
    assert val["n"] == 4
    assert val["var_95"] == -1.0  # 5% of 4 ≈ 0 → idx max(0,-1)=0 → smallest.
