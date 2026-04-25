"""
Phase I — strategy self-improvement loop.

Public verbs:

    from improvement import (
        Objective, default_objective,
        propose_mutations,
        ImprovementRunner, ImprovementSummary,
    )

`ImprovementRunner.run(seed_spec, n_iters, ctx?)` does:

    iteration 0: backtest the seed (in-sample)            → score
    iterations 1..N: mutate(seed_or_best, history)        → backtest → score
    final: best in-sample candidate is re-evaluated on the
           validation period (`Objective.validation_window`) and the
           whole tree is persisted under
           `agents/boss/runs/<run_id>/improvement_tree/`.

Every node is a `BacktestSpec` plus its result + score. The full tree
plus an `events.jsonl` (one row per node, in the order they were
explored) is written to disk so the UI can replay the search live.
"""
from .objective import Objective, default_objective, objective_from_name
from .mutator import propose_mutations
from .runner import ImprovementRunner, ImprovementSummary
from .tree import ImprovementNode, ImprovementTree

__all__ = [
    "ImprovementNode",
    "ImprovementRunner",
    "ImprovementSummary",
    "ImprovementTree",
    "Objective",
    "default_objective",
    "objective_from_name",
    "propose_mutations",
]
