"""
On-disk layout for agent runs.

    agents/
      boss/
        memory.md
        state.md
      quants/<agent_id>/
        memory.md
        state.md
        runs/<run_id>/
          run.json          # metadata + final summary
          events.jsonl      # one StreamEvent per line, append-only
          summary.md        # human-readable run report
          plots/*.png
          artifacts/*.{csv,json,parquet,…}

`agent_id` is the canonical agent type (e.g. "technical_analyst") for now.
A future phase can extend it to per-instance dirs (canvas-spawned agents).
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

# Repo root is two parents up from this file (backend/agent_runtime/storage.py)
REPO_ROOT = Path(__file__).resolve().parents[2]
AGENTS_ROOT = REPO_ROOT / "agents"

BOSS_ID = "boss"
QUANTS_DIR = "quants"


def agent_dir(agent_id: str) -> Path:
    """Return the agent's home dir, creating it if missing."""
    if agent_id == BOSS_ID:
        d = AGENTS_ROOT / BOSS_ID
    else:
        d = AGENTS_ROOT / QUANTS_DIR / agent_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def runs_dir(agent_id: str) -> Path:
    d = agent_dir(agent_id) / "runs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def run_dir(agent_id: str, run_id: str) -> Path:
    d = runs_dir(agent_id) / run_id
    (d / "plots").mkdir(parents=True, exist_ok=True)
    (d / "artifacts").mkdir(parents=True, exist_ok=True)
    return d


# ── memory.md / state.md ──────────────────────────────────────────────

def _default_memory(agent_id: str) -> str:
    return (
        f"# {agent_id}\n\n"
        f"> Created: {datetime.now(timezone.utc).isoformat(timespec='seconds')}\n\n"
        "## Mandate\n_What this agent is responsible for._\n\n"
        "## Beliefs & priors\n- _Hypotheses the agent holds._\n\n"
        "## Observations\n- _Append-only log of what the agent has learned._\n\n"
        "## Open questions\n- _Things to investigate next._\n"
    )


def read_memory(agent_id: str) -> str:
    p = agent_dir(agent_id) / "memory.md"
    if not p.exists():
        p.write_text(_default_memory(agent_id), encoding="utf-8")
    return p.read_text(encoding="utf-8")


def write_memory(agent_id: str, markdown: str) -> None:
    (agent_dir(agent_id) / "memory.md").write_text(markdown, encoding="utf-8")


def append_memory(agent_id: str, markdown: str) -> None:
    cur = read_memory(agent_id)
    sep = "" if cur.endswith("\n") else "\n"
    write_memory(agent_id, f"{cur}{sep}{markdown}")


def read_state(agent_id: str) -> str:
    p = agent_dir(agent_id) / "state.md"
    if not p.exists():
        p.write_text("# state\n_idle_\n", encoding="utf-8")
    return p.read_text(encoding="utf-8")


def write_state(agent_id: str, markdown: str) -> None:
    (agent_dir(agent_id) / "state.md").write_text(markdown, encoding="utf-8")


# ── run metadata ──────────────────────────────────────────────────────

def write_run_meta(agent_id: str, run_id: str, meta: dict[str, Any]) -> None:
    p = run_dir(agent_id, run_id) / "run.json"
    p.write_text(json.dumps(meta, indent=2, default=str), encoding="utf-8")


def read_run_meta(agent_id: str, run_id: str) -> dict[str, Any] | None:
    p = run_dir(agent_id, run_id) / "run.json"
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def write_summary(agent_id: str, run_id: str, markdown: str) -> None:
    (run_dir(agent_id, run_id) / "summary.md").write_text(markdown, encoding="utf-8")


# ── events.jsonl (append-only) ────────────────────────────────────────

def append_event(agent_id: str, run_id: str, event: dict[str, Any]) -> None:
    p = run_dir(agent_id, run_id) / "events.jsonl"
    with p.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, default=str) + "\n")


def load_run_events(agent_id: str, run_id: str) -> list[dict[str, Any]]:
    p = run_dir(agent_id, run_id) / "events.jsonl"
    if not p.exists():
        return []
    out: list[dict[str, Any]] = []
    with p.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


# ── run discovery ─────────────────────────────────────────────────────

def list_runs(agent_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    """List runs across all agents (or one agent), newest first."""
    out: list[dict[str, Any]] = []
    if agent_id is None:
        # Walk every agent under agents/
        for sub in (AGENTS_ROOT, AGENTS_ROOT / QUANTS_DIR):
            if not sub.exists():
                continue
            for entry in sub.iterdir():
                if entry.is_dir() and (entry / "runs").exists():
                    aid = entry.name if entry.parent.name == QUANTS_DIR else entry.name
                    out.extend(_list_for(aid, entry / "runs"))
    else:
        out.extend(_list_for(agent_id, runs_dir(agent_id)))
    out.sort(key=lambda r: r.get("started_at") or "", reverse=True)
    return out[:limit]


def _list_for(agent_id: str, runs_path: Path) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    if not runs_path.exists():
        return items
    for d in runs_path.iterdir():
        if not d.is_dir():
            continue
        meta_p = d / "run.json"
        if meta_p.exists():
            try:
                meta = json.loads(meta_p.read_text(encoding="utf-8"))
                meta["agent_id"] = agent_id
                meta["run_id"] = d.name
                items.append(meta)
                continue
            except json.JSONDecodeError:
                pass
        # Fallback: synthesise from dir mtime
        items.append({
            "agent_id": agent_id,
            "run_id": d.name,
            "status": "unknown",
            "started_at": datetime.fromtimestamp(d.stat().st_mtime, tz=timezone.utc).isoformat(),
        })
    return items


def load_run(agent_id: str, run_id: str) -> dict[str, Any] | None:
    meta = read_run_meta(agent_id, run_id)
    if meta is None and not (runs_dir(agent_id) / run_id).exists():
        return None
    events = load_run_events(agent_id, run_id)
    summary_p = run_dir(agent_id, run_id) / "summary.md"
    summary = summary_p.read_text(encoding="utf-8") if summary_p.exists() else None
    return {
        "agent_id": agent_id,
        "run_id": run_id,
        "meta": meta or {},
        "events": events,
        "summary": summary,
        "artifacts": list_artifacts(agent_id, run_id),
    }


def list_artifacts(agent_id: str, run_id: str) -> list[dict[str, Any]]:
    base = run_dir(agent_id, run_id)
    out: list[dict[str, Any]] = []
    for sub, kind in [("plots", "plot"), ("artifacts", "file")]:
        d = base / sub
        if not d.exists():
            continue
        for f in sorted(d.iterdir()):
            if not f.is_file():
                continue
            out.append({
                "name": f.name,
                "kind": kind,
                "size": f.stat().st_size,
                "url_path": f"/{sub}/{f.name}",
            })
    return out


def artifact_path(agent_id: str, run_id: str, sub: str, name: str) -> Path | None:
    if sub not in ("plots", "artifacts"):
        return None
    # Block path traversal.
    if "/" in name or ".." in name:
        return None
    p = run_dir(agent_id, run_id) / sub / name
    return p if p.is_file() else None
