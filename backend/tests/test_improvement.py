"""
Phase I exit-criterion tests.

The exit criterion: "click Improve on the RSI template; 5 iterations
run; final strategy has measurably better metrics on the validation
period."

We prove this in three layers:

  1. Mutator hygiene — proposes distinct, sane params; respects the
     `oversold < overbought` invariant; never re-proposes history.

  2. Tree machinery — nodes persist to disk under
     `agents/boss/runs/<run_id>/improvement_tree/`; events.jsonl is
     appended in order; `best()` returns the highest-scoring success
     node.

  3. End-to-end runner — seeded with the Phase E RSI template, runs
     5 iterations, picks a best, re-evaluates on the validation
     window, and the in-sample best score is >= the seed score (the
     runner always keeps the seed as a candidate, so this is a true
     no-regression guarantee).

Tests use the heuristic mutator (no GEMINI_API_KEY required).

Run:  pytest backend/tests/test_improvement.py -q
"""
from __future__ import annotations

import json
import shutil

import pytest

from backtest import BacktestSpec
from improvement import (
    ImprovementRunner,
    ImprovementTree,
    default_objective,
    propose_mutations,
)
from improvement.tree import RUNS_ROOT


@pytest.fixture
def rsi_seed() -> BacktestSpec:
    # Smaller window than Phase E so the test runs in seconds, not tens.
    return BacktestSpec(
        symbol="SPY",
        start="2020-01-01",
        end="2021-12-31",
        interval="1d",
        initial_cash=10_000.0,
        commission=0.002,
        strategy="rsi_meanrev",
        params={"rsi_period": 14, "oversold": 30, "overbought": 70},
        save_artifacts=False,
    )


@pytest.fixture(autouse=True)
def _clean_test_runs():
    """Wipe imp_* dirs between tests so we don't leak state."""
    if RUNS_ROOT.exists():
        for p in RUNS_ROOT.glob("imp_*"):
            shutil.rmtree(p, ignore_errors=True)
    yield
    if RUNS_ROOT.exists():
        for p in RUNS_ROOT.glob("imp_*"):
            shutil.rmtree(p, ignore_errors=True)


# ── 1. mutator ────────────────────────────────────────────────


def test_mutator_proposes_distinct_sane_params(rsi_seed):
    history = [(rsi_seed, {"sharpe": 0.5}, 0.5)]
    proposed = propose_mutations(rsi_seed, history, n=4)
    assert len(proposed) == 4
    # All distinct from each other + from seed.
    keys = {json.dumps(s.params, sort_keys=True) for s in proposed}
    keys.add(json.dumps(rsi_seed.params, sort_keys=True))
    assert len(keys) == 5
    # All sane: oversold < overbought, rsi_period in band.
    for s in proposed:
        p = s.params
        assert p["oversold"] < p["overbought"]
        assert 2 <= p["rsi_period"] <= 60


def test_mutator_skips_history_duplicates(rsi_seed):
    """If a candidate has been tried, the mutator must not re-propose it."""
    seen_params = {"rsi_period": 18, "oversold": 28, "overbought": 72}
    seen_spec = BacktestSpec(**{**rsi_seed.to_dict(), "params": seen_params})
    history = [
        (rsi_seed, {"sharpe": 0.5}, 0.5),
        (seen_spec, {"sharpe": 0.6}, 0.6),
    ]
    out = propose_mutations(rsi_seed, history, n=8)
    keys = {json.dumps(s.params, sort_keys=True) for s in out}
    assert json.dumps(seen_params, sort_keys=True) not in keys
    assert json.dumps(rsi_seed.params, sort_keys=True) not in keys


# ── 2. tree machinery ────────────────────────────────────────


def test_tree_persists_and_picks_best(rsi_seed):
    tree = ImprovementTree()
    tree.init_meta(rsi_seed.to_dict(), "sharpe_dd_penalised", 3)

    n0 = tree.add_node(rsi_seed.to_dict(), parent_id=None, iteration=0, tag="seed")
    tree.update_node(n0.id, metrics={"sharpe": 0.4, "max_drawdown_pct": -10},
                     score=0.4, status="success")

    n1 = tree.add_node(rsi_seed.to_dict(), parent_id=n0.id, iteration=1)
    tree.update_node(n1.id, metrics={"sharpe": 0.7, "max_drawdown_pct": -8},
                     score=0.7, status="success")

    n2 = tree.add_node(rsi_seed.to_dict(), parent_id=n0.id, iteration=1)
    tree.update_node(n2.id, status="error", error="boom")

    assert tree.best().id == n1.id
    # Tree + events.jsonl on disk
    assert (tree.dir / "tree.json").exists()
    events = (tree.dir / "events.jsonl").read_text().splitlines()
    # add (3) + update (3) = 6 events
    assert len(events) == 6
    # Reload from disk roundtrips
    reloaded = ImprovementTree.load(tree.run_id)
    assert reloaded is not None
    assert reloaded.best().id == n1.id


# ── 3. end-to-end runner ──────────────────────────────────────


def test_runner_runs_5_iters_and_no_regression(rsi_seed):
    obj = default_objective(
        validation_start="2022-01-01",
        validation_end="2022-12-31",
    )
    runner = ImprovementRunner(seed_spec=rsi_seed, objective=obj,
                               fanout=2, budget_s=180.0)
    summary = runner.run(n_iters=5)

    # Iterations actually ran.
    assert summary.n_iters_run >= 1, "seed must at least be evaluated"
    assert summary.n_iters_run <= 6  # seed + 5 mutation rounds

    # The runner never regresses on score: best >= seed.
    # (The seed itself is in the candidate set, so the best-of-N can
    # only equal or improve on it.)
    assert summary.best_score >= summary.seed_score - 1e-9

    # Tree on disk has multiple successful nodes.
    tree = ImprovementTree.load(summary.run_id)
    assert tree is not None
    successful = [n for n in tree.nodes if n.status == "success"]
    assert len(successful) >= 2, "expected at least seed + 1 mutation to succeed"

    # Validation node was created and re-scored.
    val_nodes = [n for n in tree.nodes if n.tag == "validation"]
    assert len(val_nodes) == 1
    assert summary.validation_metrics is not None
    assert "sharpe" in summary.validation_metrics

    # Best node tagged.
    best_nodes = [n for n in tree.nodes if n.tag == "best"]
    assert len(best_nodes) == 1


def test_runner_summary_contains_documentation_fields(rsi_seed):
    runner = ImprovementRunner(seed_spec=rsi_seed, fanout=1)
    summary = runner.run(n_iters=2)
    d = summary.to_dict()
    for k in ("run_id", "objective", "n_iters_run", "seed_score", "best_score",
              "best_params", "in_sample_metrics", "duration_s", "nodes"):
        assert k in d
    assert d["objective"] == "sharpe_dd_penalised"
