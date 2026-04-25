"""
ImprovementRunner — drives one full improvement search.

    summary = ImprovementRunner(seed_spec, objective).run(n_iters=5)

Loop:
    0. iteration 0: backtest the seed (in-sample) → score → tree node "seed"
    1..N: while iterations remaining and clock budget intact:
        candidates = propose_mutations(seed, history, n=fanout)
        for each candidate: backtest → score → add child node
        keep going from the *current best* (the mutator already does this)
    final: re-backtest the best in-sample node on the validation
           window (if the objective specifies one), tag it "validation"
           so the UI can show side-by-side metrics, and finalise the
           tree.

Every node is journaled to disk via `ImprovementTree`. When given an
`AgentRunContext`, the runner emits `tool_call("improvement.iter", …)`
+ `tool_result(…)` per backtest so the live agent stream shows the
search in flight.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Optional

from backtest import BacktestSpec, run_backtest

from .mutator import propose_mutations
from .objective import Objective, default_objective
from .tree import ImprovementNode, ImprovementTree


@dataclass
class ImprovementSummary:
    run_id: str
    objective: str
    n_iters_run: int
    seed_score: float
    best_score: float
    best_params: dict[str, Any]
    in_sample_metrics: dict[str, float]
    validation_metrics: Optional[dict[str, float]] = None
    duration_s: float = 0.0
    nodes: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "objective": self.objective,
            "n_iters_run": self.n_iters_run,
            "seed_score": self.seed_score,
            "best_score": self.best_score,
            "best_params": self.best_params,
            "in_sample_metrics": self.in_sample_metrics,
            "validation_metrics": self.validation_metrics,
            "duration_s": self.duration_s,
            "nodes": self.nodes,
        }


class ImprovementRunner:
    def __init__(
        self,
        seed_spec: BacktestSpec,
        objective: Optional[Objective] = None,
        run_id: Optional[str] = None,
        budget_s: float = 300.0,
        fanout: int = 2,
    ) -> None:
        self.seed = seed_spec
        self.objective = objective or default_objective()
        self.budget_s = budget_s
        self.fanout = fanout
        self.tree = ImprovementTree(run_id=run_id)

    # ── public ────────────────────────────────────────────────

    def run(self, n_iters: int = 5, ctx: Any = None) -> ImprovementSummary:
        t0 = time.time()
        self.tree.init_meta(
            seed_spec=self.seed.to_dict(),
            objective_name=self.objective.name,
            n_iters_target=n_iters,
        )

        history: list[tuple[BacktestSpec, dict, float]] = []

        # ── Iteration 0: seed ──────────────────────────────────
        seed_node = self.tree.add_node(self.seed.to_dict(), parent_id=None,
                                       iteration=0, tag="seed")
        seed_metrics, seed_score = self._evaluate(self.seed, seed_node, ctx, label="seed")
        if seed_score is not None:
            history.append((self.seed, seed_metrics, seed_score))

        # ── Iterations 1..N ────────────────────────────────────
        iters_run = 1 if seed_score is not None else 0
        for it in range(1, n_iters + 1):
            if time.time() - t0 > self.budget_s:
                break
            candidates = propose_mutations(self.seed, history, n=self.fanout)
            if not candidates:
                break
            parent_id = (self.tree.best().id if self.tree.best() else seed_node.id)
            for spec in candidates:
                if time.time() - t0 > self.budget_s:
                    break
                node = self.tree.add_node(spec.to_dict(), parent_id=parent_id,
                                          iteration=it, tag="")
                metrics, score = self._evaluate(spec, node, ctx,
                                                label=f"iter {it}")
                if score is not None:
                    history.append((spec, metrics, score))
            iters_run += 1

        # ── Pick winner + validation re-run ────────────────────
        best_node = self.tree.best()
        validation_metrics: Optional[dict[str, float]] = None
        if best_node is not None:
            self.tree.update_node(best_node.id, tag="best")
            if self.objective.validation_start and self.objective.validation_end:
                val_spec = BacktestSpec(
                    **{**best_node.spec,
                       "start": self.objective.validation_start,
                       "end": self.objective.validation_end,
                       "save_artifacts": False,
                       "run_id": None}
                )
                vnode = self.tree.add_node(val_spec.to_dict(), parent_id=best_node.id,
                                           iteration=n_iters + 1, tag="validation")
                validation_metrics, _ = self._evaluate(val_spec, vnode, ctx,
                                                       label="validation")

        self.tree.finalize(best_node_id=best_node.id if best_node else None)

        seed_score = next((s for sp, _, s in history if sp is self.seed), 0.0) \
            if history else 0.0
        return ImprovementSummary(
            run_id=self.tree.run_id,
            objective=self.objective.name,
            n_iters_run=iters_run,
            seed_score=seed_score,
            best_score=(best_node.score if best_node and best_node.score is not None
                        else seed_score),
            best_params=(best_node.spec.get("params", {}) if best_node else
                         self.seed.params),
            in_sample_metrics=(best_node.metrics if best_node else {}),
            validation_metrics=validation_metrics,
            duration_s=round(time.time() - t0, 2),
            nodes=[n.to_dict() for n in self.tree.nodes],
        )

    # ── internals ─────────────────────────────────────────────

    def _evaluate(
        self,
        spec: BacktestSpec,
        node: ImprovementNode,
        ctx: Any,
        label: str,
    ) -> tuple[dict[str, float], Optional[float]]:
        cm = ctx.tool_call("improvement.iter", {
            "label": label, "params": spec.params,
        }) if ctx is not None else None
        handle = cm.__enter__() if cm is not None else None
        try:
            res = run_backtest(spec)
            if not res.success:
                self.tree.update_node(node.id, status="error",
                                      error=res.error or "unknown")
                if handle:
                    handle.result(f"failed: {res.error}", status="error")
                return {}, None
            score = self.objective.render(res.metrics)
            self.tree.update_node(node.id,
                                  metrics=res.metrics,
                                  score=score,
                                  status="success")
            if handle:
                m = res.metrics
                handle.result(
                    f"{label}: sharpe={m.get('sharpe', 0):.2f} "
                    f"dd={m.get('max_drawdown_pct', 0):.1f}% "
                    f"score={score:.3f}"
                )
            return res.metrics, score
        finally:
            if cm is not None:
                cm.__exit__(None, None, None)
