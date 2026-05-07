"""
ImprovementNode + ImprovementTree — the persisted search.

The runner appends one node per iteration; the tree is just a flat
list of nodes with optional `parent_id` references so the UI can render
it as a graph. Persisted under
`agents/boss/runs/<run_id>/improvement_tree/`:

    tree.json         — full snapshot (overwritten each step)
    events.jsonl      — one row per node, in exploration order
                        (the WS endpoint streams these)
    summary.json      — final summary written when the run ends
"""
from __future__ import annotations

import json
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import os
REPO_ROOT = Path(__file__).resolve().parents[2]
_DATA_DIR = Path(os.environ.get("OPENQWNT_DATA_DIR", str(REPO_ROOT)))
RUNS_ROOT = _DATA_DIR / "agents" / "boss" / "runs"


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_node_id() -> str:
    return f"n_{uuid.uuid4().hex[:8]}"


@dataclass
class ImprovementNode:
    id: str
    parent_id: Optional[str]
    depth: int
    iteration: int
    spec: dict[str, Any]
    metrics: dict[str, float] = field(default_factory=dict)
    score: Optional[float] = None
    status: str = "pending"          # pending | success | error | skipped
    error: Optional[str] = None
    created_at: str = field(default_factory=_utc_iso)
    completed_at: Optional[str] = None
    tag: str = ""                    # human label, e.g. "seed", "best", "validation"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class TreeMeta:
    run_id: str
    seed_spec: dict[str, Any]
    objective_name: str
    n_iters_target: int
    started_at: str
    ended_at: Optional[str] = None
    best_node_id: Optional[str] = None
    status: str = "running"          # running | done | error


class ImprovementTree:
    def __init__(self, run_id: Optional[str] = None) -> None:
        self.run_id = run_id or f"imp_{uuid.uuid4().hex[:10]}"
        self.dir = RUNS_ROOT / self.run_id / "improvement_tree"
        self.dir.mkdir(parents=True, exist_ok=True)
        self._nodes: list[ImprovementNode] = []
        self._meta: Optional[TreeMeta] = None
        self._lock = threading.Lock()

    # ── public ────────────────────────────────────────────────

    @property
    def nodes(self) -> list[ImprovementNode]:
        return list(self._nodes)

    @property
    def meta(self) -> Optional[TreeMeta]:
        return self._meta

    def init_meta(
        self,
        seed_spec: dict[str, Any],
        objective_name: str,
        n_iters_target: int,
    ) -> None:
        self._meta = TreeMeta(
            run_id=self.run_id,
            seed_spec=seed_spec,
            objective_name=objective_name,
            n_iters_target=n_iters_target,
            started_at=_utc_iso(),
        )
        self._persist()

    def add_node(
        self,
        spec: dict[str, Any],
        parent_id: Optional[str],
        iteration: int,
        tag: str = "",
    ) -> ImprovementNode:
        with self._lock:
            depth = 0
            if parent_id:
                parent = next((n for n in self._nodes if n.id == parent_id), None)
                if parent:
                    depth = parent.depth + 1
            node = ImprovementNode(
                id=_new_node_id(),
                parent_id=parent_id,
                depth=depth,
                iteration=iteration,
                spec=spec,
                tag=tag,
            )
            self._nodes.append(node)
            self._append_event({"kind": "node_added", "node": node.to_dict()})
            self._persist()
            return node

    def update_node(
        self,
        node_id: str,
        *,
        metrics: Optional[dict[str, float]] = None,
        score: Optional[float] = None,
        status: Optional[str] = None,
        error: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> ImprovementNode:
        with self._lock:
            node = next(n for n in self._nodes if n.id == node_id)
            if metrics is not None:
                node.metrics = metrics
            if score is not None:
                node.score = score
            if status is not None:
                node.status = status
            if error is not None:
                node.error = error
            if tag is not None:
                node.tag = tag
            node.completed_at = _utc_iso()
            self._append_event({"kind": "node_updated", "node": node.to_dict()})
            self._persist()
            return node

    def best(self) -> Optional[ImprovementNode]:
        succeeded = [n for n in self._nodes if n.status == "success" and n.score is not None]
        if not succeeded:
            return None
        return max(succeeded, key=lambda n: n.score)  # type: ignore[arg-type]

    def finalize(self, best_node_id: Optional[str], status: str = "done") -> None:
        with self._lock:
            if self._meta:
                self._meta.best_node_id = best_node_id
                self._meta.status = status
                self._meta.ended_at = _utc_iso()
            self._append_event({
                "kind": "run_finalised",
                "best_node_id": best_node_id,
                "status": status,
            })
            self._persist()
            (self.dir / "summary.json").write_text(json.dumps({
                "run_id": self.run_id,
                "best_node_id": best_node_id,
                "status": status,
                "node_count": len(self._nodes),
                "ended_at": _utc_iso(),
            }, indent=2))

    # ── persistence ───────────────────────────────────────────

    def _persist(self) -> None:
        snap = {
            "meta": asdict(self._meta) if self._meta else None,
            "nodes": [n.to_dict() for n in self._nodes],
        }
        (self.dir / "tree.json").write_text(json.dumps(snap, indent=2, default=str))

    def _append_event(self, event: dict[str, Any]) -> None:
        event = {"ts": _utc_iso(), **event}
        with (self.dir / "events.jsonl").open("a") as f:
            f.write(json.dumps(event, default=str) + "\n")

    @classmethod
    def load(cls, run_id: str) -> Optional["ImprovementTree"]:
        path = RUNS_ROOT / run_id / "improvement_tree" / "tree.json"
        if not path.exists():
            return None
        snap = json.loads(path.read_text())
        tree = cls(run_id=run_id)
        if snap.get("meta"):
            m = snap["meta"]
            tree._meta = TreeMeta(**m)
        tree._nodes = [ImprovementNode(**n) for n in snap.get("nodes", [])]
        return tree
