"""
Phase E exit-criteria test for the RSI(14) mean-reversion template.

Two checks:
  1. The graph (nodes/edges) authored in `strategyTemplates.ts` passes
     `strategy_flow.validator.validate_flow()`. This is the same check
     the BacktestModal runs before submitting.
  2. The template's `backtestSpec` runs cleanly through the canonical
     `backtest.run_backtest()` engine and returns real metrics + a
     persisted PNG. This is what the user sees when they hit Backtest
     after loading the template.

Together these prove: load template → validate → backtest → results.
The template itself is parsed straight out of the TS source so the test
can never go stale relative to the file the UI ships.

Run:  pytest backend/tests/test_rsi_template.py -q
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from backtest import BacktestSpec, run_backtest
from strategy_flow.validator import validate_flow

TEMPLATE_FILE = (
    Path(__file__).resolve().parents[2]
    / "src" / "features" / "strategy-flow" / "templates" / "strategyTemplates.ts"
)
TEMPLATE_ID = "rsi-mean-reversion-spy"


def _slice_template(src: str, template_id: str) -> str:
    """Find the `{ id: '<template_id>', ... }` object literal and return it.

    Walks brace depth from the opening `{` of the matching object so we
    don't depend on regex to balance braces.
    """
    needle = f"id: '{template_id}'"
    idx = src.find(needle)
    if idx < 0:
        raise AssertionError(f"template '{template_id}' not found in {TEMPLATE_FILE}")
    # Walk back to the opening brace of this object.
    open_idx = src.rfind("{", 0, idx)
    depth = 0
    for j in range(open_idx, len(src)):
        c = src[j]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return src[open_idx:j + 1]
    raise AssertionError("template object literal never closed")


def _ts_object_to_python(ts: str) -> dict:
    """Light TS→Python literal translation.

    Strategy: strip line comments, quote bare identifier keys, swap
    single quotes for double quotes, drop trailing commas, then json.loads.
    Adequate for the static template literals — *not* a general parser.
    """
    # Strip // line comments.
    ts = re.sub(r"//.*", "", ts)
    # Quote bare-identifier object keys: `key: ` → `"key": `.
    ts = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', ts)
    # Convert single-quoted strings to double-quoted.
    ts = re.sub(r"'((?:[^'\\]|\\.)*)'", lambda m: '"' + m.group(1).replace('"', '\\"') + '"', ts)
    # Numeric literals like 10_000 → 10000.
    ts = re.sub(r"(\d)_(\d)", r"\1\2", ts)
    # Drop trailing commas before } or ].
    ts = re.sub(r",(\s*[}\]])", r"\1", ts)
    return json.loads(ts)


@pytest.fixture(scope="module")
def template() -> dict:
    src = TEMPLATE_FILE.read_text()
    obj = _slice_template(src, TEMPLATE_ID)
    return _ts_object_to_python(obj)


def test_template_validates(template: dict) -> None:
    """Same validator the UI calls before posting a backtest."""
    res = validate_flow(template["nodes"], template["edges"])
    assert res.is_valid, f"template should validate, got errors: {res.errors}"
    # Warnings are allowed (e.g. scale mismatches when comparing RSI to a
    # numeric constant) but errors are not.


def test_template_backtest_runs_canonical(template: dict) -> None:
    """The template's `backtestSpec` is what the Backtest button posts."""
    bt = template.get("backtestSpec")
    assert bt is not None, "RSI template must carry a backtestSpec for canonical routing"

    spec = BacktestSpec(
        symbol=bt.get("symbol", "SPY"),
        start=bt.get("start", "2018-01-01"),
        end=bt.get("end", "2023-12-31"),
        interval=bt.get("interval", "1d"),
        initial_cash=bt.get("initial_cash", 10_000),
        commission=bt.get("commission", 0.002),
        strategy=bt["strategy"],
        params=bt.get("params", {}),
        save_artifacts=True,
        run_id="phaseE_rsi_template_test",
    )
    result = run_backtest(spec)
    assert result.success, f"canonical engine failed: {result.error}"

    m = result.metrics
    # Sanity bands — wide on purpose so vendor jitter doesn't flap. We're
    # checking "engine ran and produced a coherent result", not pinning a
    # specific PnL.
    assert m["n_trades"] >= 1, "rsi_meanrev should fire at least one trade in 2018-2023"
    assert -100.0 < m["return_pct"] < 1000.0
    assert -100.0 < m["max_drawdown_pct"] <= 0.0
    assert len(result.equity_curve) > 50
    # Plot was persisted.
    assert result.plot_path and Path(result.plot_path).exists(), \
        f"plot PNG missing at {result.plot_path}"


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-q", "-s"]))
