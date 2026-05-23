"""
agent_runs_db — persistence layer for ADK agent run outputs.

This closes the surprising silo described in the integration audit:
quant agents (news_analyst, technical_analyst, etc.) used to leave
their output in `agents/quants/<agent_id>/runs/<run_id>/run.json` files
where nothing else in the app could reach them. With this module:

  - every successful `POST /compute/agents/run` writes a row here
  - strategy-flow's `agentRunQuery` data node reads the latest row by
    (agent_type, symbol, max_age)
  - `scheduled_agents` lets a user cron a recurring run from the UI

Schema is intentionally light — `output_json` keeps the full agent
output so the data node can pull arbitrary fields without a migration.
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import local_database as ldb


# ── schema ─────────────────────────────────────────────────────

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS agent_runs (
    id              TEXT PRIMARY KEY,
    agent_type      TEXT NOT NULL,
    symbols_json    TEXT NOT NULL DEFAULT '[]',
    signal          TEXT,
    confidence      REAL,
    summary         TEXT,
    output_json     TEXT,
    error           TEXT,
    duration_ms     INTEGER DEFAULT 0,
    tokens_used     INTEGER DEFAULT 0,
    schedule_id     TEXT,
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_lookup
    ON agent_runs (agent_type, created_at DESC);

CREATE TABLE IF NOT EXISTS scheduled_agents (
    id                  TEXT PRIMARY KEY,
    agent_type          TEXT NOT NULL,
    symbols_json        TEXT NOT NULL DEFAULT '[]',
    context_json        TEXT NOT NULL DEFAULT '{}',
    interval_minutes    INTEGER NOT NULL,
    enabled             INTEGER NOT NULL DEFAULT 1,
    last_run_at         TEXT,
    next_run_at         TEXT,
    last_status         TEXT,
    last_error          TEXT,
    created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_agents_due
    ON scheduled_agents (enabled, next_run_at);
"""


def init_schema() -> None:
    """Create the tables if they don't exist. Idempotent."""
    conn = ldb.get_db()
    try:
        conn.executescript(_SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()


# ── helpers ────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    if d.get("symbols_json"):
        try:
            d["symbols"] = json.loads(d["symbols_json"])
        except Exception:
            d["symbols"] = []
    else:
        d["symbols"] = []
    if d.get("output_json"):
        try:
            d["output"] = json.loads(d["output_json"])
        except Exception:
            d["output"] = None
    return d


# ── agent_runs CRUD ───────────────────────────────────────────

def record_run(
    *,
    agent_type: str,
    symbols: Optional[List[str]] = None,
    signal: Optional[str] = None,
    confidence: Optional[float] = None,
    summary: Optional[str] = None,
    output: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
    duration_ms: int = 0,
    tokens_used: int = 0,
    schedule_id: Optional[str] = None,
    run_id: Optional[str] = None,
) -> str:
    """Append a row for a completed (or errored) agent run. Returns the row id."""
    rid = run_id or f"agr_{uuid.uuid4().hex[:10]}"
    conn = ldb.get_db()
    try:
        conn.execute(
            """
            INSERT INTO agent_runs
              (id, agent_type, symbols_json, signal, confidence, summary,
               output_json, error, duration_ms, tokens_used, schedule_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rid,
                agent_type,
                json.dumps(symbols or []),
                signal,
                confidence,
                (summary or "")[:2000] if summary else None,
                json.dumps(output) if output is not None else None,
                error,
                int(duration_ms or 0),
                int(tokens_used or 0),
                schedule_id,
                _now_iso(),
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return rid


def latest_run(
    *,
    agent_type: str,
    symbol: Optional[str] = None,
    max_age_minutes: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """Most-recent run matching (agent_type, symbol). When symbol is given we
    accept rows where `symbols` contains it OR is empty (so a generic run
    on the whole portfolio still satisfies a per-symbol query)."""
    conn = ldb.get_db()
    try:
        sql = "SELECT * FROM agent_runs WHERE agent_type = ?"
        args: List[Any] = [agent_type]
        if max_age_minutes is not None and max_age_minutes > 0:
            cutoff = (datetime.now(timezone.utc) - timedelta(minutes=max_age_minutes)).isoformat()
            sql += " AND created_at >= ?"
            args.append(cutoff)
        sql += " ORDER BY created_at DESC LIMIT 50"  # fetch a few, filter by symbol in py
        rows = conn.execute(sql, args).fetchall()
    finally:
        conn.close()
    target = (symbol or "").upper().strip()
    for r in rows:
        d = _row_to_dict(r)
        if not target:
            return d
        syms = [s.upper() for s in (d.get("symbols") or [])]
        if not syms or target in syms:
            return d
    return None


def list_history(
    *,
    agent_type: Optional[str] = None,
    symbol: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    conn = ldb.get_db()
    try:
        sql = "SELECT * FROM agent_runs"
        clauses, args = [], []
        if agent_type:
            clauses.append("agent_type = ?")
            args.append(agent_type)
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY created_at DESC LIMIT ?"
        args.append(max(1, min(int(limit), 500)))
        rows = conn.execute(sql, args).fetchall()
    finally:
        conn.close()
    out = [_row_to_dict(r) for r in rows]
    if not symbol:
        return out
    target = symbol.upper().strip()
    return [
        r for r in out
        if not r.get("symbols") or target in [s.upper() for s in r["symbols"]]
    ]


# ── scheduled_agents CRUD ─────────────────────────────────────

def create_schedule(
    *,
    agent_type: str,
    symbols: List[str],
    interval_minutes: int,
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    sid = f"sch_{uuid.uuid4().hex[:10]}"
    now = _now_iso()
    next_run = (datetime.now(timezone.utc) + timedelta(minutes=interval_minutes)).isoformat()
    conn = ldb.get_db()
    try:
        conn.execute(
            """
            INSERT INTO scheduled_agents
              (id, agent_type, symbols_json, context_json, interval_minutes,
               enabled, last_run_at, next_run_at, last_status, last_error, created_at)
            VALUES (?, ?, ?, ?, ?, 1, NULL, ?, NULL, NULL, ?)
            """,
            (
                sid,
                agent_type,
                json.dumps(symbols or []),
                json.dumps(context or {}),
                int(interval_minutes),
                next_run,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return get_schedule(sid)  # type: ignore[return-value]


def get_schedule(schedule_id: str) -> Optional[Dict[str, Any]]:
    conn = ldb.get_db()
    try:
        row = conn.execute(
            "SELECT * FROM scheduled_agents WHERE id = ?", (schedule_id,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    d = dict(row)
    d["symbols"] = json.loads(d.get("symbols_json") or "[]")
    d["context"] = json.loads(d.get("context_json") or "{}")
    d["enabled"] = bool(d.get("enabled"))
    return d


def list_schedules(enabled_only: bool = False) -> List[Dict[str, Any]]:
    conn = ldb.get_db()
    try:
        sql = "SELECT * FROM scheduled_agents"
        if enabled_only:
            sql += " WHERE enabled = 1"
        sql += " ORDER BY created_at DESC"
        rows = conn.execute(sql).fetchall()
    finally:
        conn.close()
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        d["symbols"] = json.loads(d.get("symbols_json") or "[]")
        d["context"] = json.loads(d.get("context_json") or "{}")
        d["enabled"] = bool(d.get("enabled"))
        out.append(d)
    return out


def due_schedules(now: Optional[datetime] = None) -> List[Dict[str, Any]]:
    """Schedules whose next_run_at <= now and are enabled."""
    cutoff = (now or datetime.now(timezone.utc)).isoformat()
    conn = ldb.get_db()
    try:
        rows = conn.execute(
            """
            SELECT * FROM scheduled_agents
            WHERE enabled = 1 AND (next_run_at IS NULL OR next_run_at <= ?)
            ORDER BY next_run_at ASC
            """,
            (cutoff,),
        ).fetchall()
    finally:
        conn.close()
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        d["symbols"] = json.loads(d.get("symbols_json") or "[]")
        d["context"] = json.loads(d.get("context_json") or "{}")
        d["enabled"] = bool(d.get("enabled"))
        out.append(d)
    return out


def mark_schedule_fired(
    schedule_id: str,
    *,
    status: str,
    error: Optional[str] = None,
) -> None:
    conn = ldb.get_db()
    try:
        row = conn.execute(
            "SELECT interval_minutes FROM scheduled_agents WHERE id = ?", (schedule_id,),
        ).fetchone()
        if not row:
            return
        interval = int(row["interval_minutes"])
        now = datetime.now(timezone.utc)
        conn.execute(
            """
            UPDATE scheduled_agents
            SET last_run_at = ?, next_run_at = ?, last_status = ?, last_error = ?
            WHERE id = ?
            """,
            (
                now.isoformat(),
                (now + timedelta(minutes=interval)).isoformat(),
                status,
                error,
                schedule_id,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def set_schedule_enabled(schedule_id: str, enabled: bool) -> Optional[Dict[str, Any]]:
    conn = ldb.get_db()
    try:
        conn.execute(
            "UPDATE scheduled_agents SET enabled = ? WHERE id = ?",
            (1 if enabled else 0, schedule_id),
        )
        conn.commit()
    finally:
        conn.close()
    return get_schedule(schedule_id)


def delete_schedule(schedule_id: str) -> bool:
    conn = ldb.get_db()
    try:
        cur = conn.execute(
            "DELETE FROM scheduled_agents WHERE id = ?", (schedule_id,),
        )
        conn.commit()
    finally:
        conn.close()
    return cur.rowcount > 0
