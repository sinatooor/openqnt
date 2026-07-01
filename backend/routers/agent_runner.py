"""
Agent Runner API — FastAPI endpoint for triggering analysis agents.

This endpoint allows the orchestrator to invoke specialized agents
(news_analyst, macro_analyst, social_monitor) with context data
and receive standardized AgentOutput responses.

Also provides a run-history log so the frontend Agents page can
display past runs, statuses, and outputs.
"""

from collections import deque
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Optional
import uuid

from adk_agents.news_analyst import news_analyst
from adk_agents.macro_analyst import macro_analyst
from adk_agents.social_monitor import social_monitor
from adk_agents.synthesis_agent import synthesis_agent
from adk_agents.technical_analyst import technical_analyst
from services import agent_runs_db

router = APIRouter(prefix="/compute/agents", tags=["agents"])

# ── Agent Registry ────────────────────────────────────────────

AGENT_REGISTRY = {
    "news_analyst": news_analyst,
    "macro_analyst": macro_analyst,
    "social_monitor": social_monitor,
    "synthesis": synthesis_agent,
    "technical_analyst": technical_analyst,
}

# ── In-memory run log (last 200 runs) ────────────────────────
MAX_LOG_SIZE = 200
_run_log: deque[dict] = deque(maxlen=MAX_LOG_SIZE)


def _log_run(
    run_id: str,
    agent_type: str,
    status: str,
    duration_ms: int = 0,
    output: dict | None = None,
    error: str | None = None,
    context_summary: dict | None = None,
):
    _run_log.appendleft({
        "id": run_id,
        "agent_type": agent_type,
        "status": status,
        "duration_ms": duration_ms,
        "output_summary": _summarize_output(output) if output else None,
        "error": error,
        "context_summary": context_summary,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


def _summarize_output(output: dict) -> dict:
    """Keep only the key fields so the log stays lightweight."""
    return {
        "overall_signal": output.get("overall_signal"),
        "overall_confidence": output.get("overall_confidence"),
        "summary": (output.get("summary") or "")[:300],
        "findings_count": len(output.get("findings", [])),
        "recommendations_count": len(output.get("recommendations", [])),
        "tokens_used": output.get("tokens_used", 0),
    }

# ── Request/Response Models ───────────────────────────────────

class AgentRunRequest(BaseModel):
    agent_type: str          # "news_analyst", "macro_analyst", "social_monitor"
    context: dict[str, Any]  # Agent-specific context (symbols, events, etc.)
    model: Optional[str] = "gemini-2.5-flash"  # LLM model override


class AgentRunResponse(BaseModel):
    success: bool
    agent_type: str
    output: dict[str, Any] | None = None
    error: str | None = None
    run_id: Optional[str] = None  # row id in `agent_runs` (consumable by strategy nodes)


# ── Endpoints ─────────────────────────────────────────────────

def _persist_run(
    *,
    agent_type: str,
    context: dict[str, Any],
    output_dict: Optional[dict] = None,
    error: Optional[str] = None,
    schedule_id: Optional[str] = None,
) -> Optional[str]:
    """Best-effort write to the `agent_runs` table so the strategy-flow
    `agentRunQuery` node can read it back. Never raises — failures here
    must not break the agent run path."""
    persisted_id = None
    try:
        symbols = context.get("symbols") if isinstance(context, dict) else []
        persisted_id = agent_runs_db.record_run(
            agent_type=agent_type,
            symbols=list(symbols) if symbols else [],
            signal=(output_dict or {}).get("overall_signal"),
            confidence=(output_dict or {}).get("overall_confidence"),
            summary=(output_dict or {}).get("summary"),
            output=output_dict,
            error=error,
            duration_ms=int((output_dict or {}).get("duration_ms") or 0),
            tokens_used=int((output_dict or {}).get("tokens_used") or 0),
            schedule_id=schedule_id,
        )
    except Exception:
        persisted_id = None

    # ── Learning phase ────────────────────────────────────────────────
    # After every cron/manual run, let the copilot reflect and update its
    # long-term memory. Best-effort and fail-soft — never breaks the run.
    try:
        from memory import curator
        curator.curate_from_run(
            agent_type=agent_type,
            context=context if isinstance(context, dict) else {},
            output_dict=output_dict,
            error=error,
        )
    except Exception:
        pass

    return persisted_id


@router.post("/run", response_model=AgentRunResponse)
async def run_agent(req: AgentRunRequest):
    """
    Run a specialized analysis agent with the given context.
    Called by the orchestrator to delegate analysis to the compute service.
    Successful runs are persisted into `agent_runs` so strategies and
    the dashboard can replay them.
    """
    agent = AGENT_REGISTRY.get(req.agent_type)
    if not agent:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown agent type: {req.agent_type}. Available: {list(AGENT_REGISTRY.keys())}"
        )

    run_id = str(uuid.uuid4())[:8]
    context = {**req.context}
    if req.model:
        context["model"] = req.model

    context_summary = {"symbols": context.get("symbols", []), "model": context.get("model")}
    _log_run(run_id, req.agent_type, "running", context_summary=context_summary)

    try:
        output = await agent.run(context)
        output_dict = output.to_dict()

        if output.error:
            _log_run(run_id, req.agent_type, "error",
                     duration_ms=output.duration_ms, output=output_dict, error=output.error)
            persisted_id = _persist_run(
                agent_type=req.agent_type, context=context,
                output_dict=output_dict, error=output.error,
            )
            return AgentRunResponse(success=False, agent_type=req.agent_type,
                                   output=output_dict, error=output.error,
                                   run_id=persisted_id)

        _log_run(run_id, req.agent_type, "success",
                 duration_ms=output.duration_ms, output=output_dict)
        persisted_id = _persist_run(
            agent_type=req.agent_type, context=context, output_dict=output_dict,
        )
        return AgentRunResponse(success=True, agent_type=req.agent_type,
                               output=output_dict, run_id=persisted_id)

    except Exception as e:
        _log_run(run_id, req.agent_type, "error", error=str(e))
        persisted_id = _persist_run(
            agent_type=req.agent_type, context=context, error=str(e),
        )
        return AgentRunResponse(success=False, agent_type=req.agent_type,
                               error=str(e), run_id=persisted_id)


@router.get("/types")
async def list_agent_types():
    """List all available agent types."""
    return {
        "agents": [
            {
                "type": agent_type,
                "description": agent.description,
            }
            for agent_type, agent in AGENT_REGISTRY.items()
        ]
    }


# ── Full Pipeline (runs all agents → synthesis) ──────────────

class PipelineRequest(BaseModel):
    symbols: list[str] = []
    news_events: list[dict[str, Any]] = []
    macro_events: list[dict[str, Any]] = []
    social_events: list[dict[str, Any]] = []
    technical_data: dict[str, Any] = {}
    thresholds: dict[str, Any] = {}
    model: Optional[str] = "gemini-2.5-flash"


class PipelineResponse(BaseModel):
    success: bool
    synthesis: dict[str, Any] | None = None
    agent_outputs: dict[str, dict[str, Any]] = {}
    error: str | None = None


@router.post("/pipeline", response_model=PipelineResponse)
async def run_full_pipeline(req: PipelineRequest):
    """
    Run the full agent pipeline:
    1. Runs all specialist agents in parallel (news, macro, social, technical)
    2. Feeds all outputs into the synthesis agent
    3. Returns the unified action plan

    This implements the user's requirement: "a final agent that gets all the
    information, technical, RSI and SMA, news, social media post, and decides
    what to buy, sell or do"
    """
    import asyncio

    agent_outputs: dict[str, dict] = {}
    model = req.model or "gemini-2.5-flash"

    # Run specialist agents in parallel
    tasks = {}

    if req.news_events:
        tasks["news_analyst"] = news_analyst.run({
            "symbols": req.symbols,
            "news_events": req.news_events,
            "model": model,
        })

    if req.macro_events:
        tasks["macro_analyst"] = macro_analyst.run({
            "symbols": req.symbols,
            "macro_events": req.macro_events,
            "model": model,
        })

    if req.social_events:
        tasks["social_monitor"] = social_monitor.run({
            "symbols": req.symbols,
            "social_events": req.social_events,
            "model": model,
        })

    if req.technical_data:
        tasks["technical_analyst"] = technical_analyst.run({
            "symbols": req.symbols,
            "technical_data": req.technical_data,
            "thresholds": req.thresholds,
            "model": model,
        })

    if not tasks:
        return PipelineResponse(
            success=False,
            error="No data provided to analyze. Provide at least one of: news_events, macro_events, social_events, technical_data"
        )

    # Execute all agents concurrently
    results = await asyncio.gather(
        *[task for task in tasks.values()],
        return_exceptions=True,
    )

    for agent_name, result in zip(tasks.keys(), results):
        if isinstance(result, Exception):
            agent_outputs[agent_name] = {
                "agent_type": agent_name,
                "error": str(result),
                "findings": [],
                "recommendations": [],
                "summary": f"Agent failed: {result}",
                "overall_confidence": 0.0,
                "overall_signal": "neutral",
            }
        else:
            agent_outputs[agent_name] = result.to_dict()

    # Run synthesis agent with all outputs
    try:
        synthesis_output = await synthesis_agent.run({
            "symbols": req.symbols,
            "agent_outputs": list(agent_outputs.values()),
            "model": model,
        })

        return PipelineResponse(
            success=True,
            synthesis=synthesis_output.to_dict(),
            agent_outputs=agent_outputs,
        )
    except Exception as e:
        return PipelineResponse(
            success=False,
            agent_outputs=agent_outputs,
            error=f"Synthesis failed: {e}",
        )


# ── Run History / Logs ────────────────────────────────────────

@router.get("/logs")
async def get_agent_logs(limit: int = 50):
    """Return recent agent run logs for the monitoring UI."""
    return {"logs": list(_run_log)[:limit]}


@router.get("/logs/stats")
async def get_agent_log_stats():
    """Aggregate stats across recent runs."""
    logs = list(_run_log)
    total = len(logs)
    by_agent: dict[str, dict] = {}
    for entry in logs:
        agent = entry["agent_type"]
        if agent not in by_agent:
            by_agent[agent] = {"total": 0, "success": 0, "error": 0, "running": 0, "avg_duration_ms": 0, "total_duration": 0}
        by_agent[agent]["total"] += 1
        by_agent[agent][entry["status"]] = by_agent[agent].get(entry["status"], 0) + 1
        by_agent[agent]["total_duration"] += entry.get("duration_ms", 0)

    for agent, stats in by_agent.items():
        completed = stats["success"] + stats["error"]
        stats["avg_duration_ms"] = round(stats["total_duration"] / completed) if completed else 0
        del stats["total_duration"]

    return {
        "total_runs": total,
        "by_agent": by_agent,
    }


# ── Persisted run query (consumed by strategy-flow's agentRunQuery node) ─

@router.get("/last-run")
async def get_last_agent_run(
    agent_type: str,
    symbol: Optional[str] = None,
    max_age_minutes: Optional[int] = None,
):
    """Latest persisted run for (agent_type, symbol). Returns 404 when no
    matching row exists — the strategy node treats that as "no signal yet"."""
    row = agent_runs_db.latest_run(
        agent_type=agent_type, symbol=symbol, max_age_minutes=max_age_minutes,
    )
    if not row:
        raise HTTPException(status_code=404, detail="no matching agent run")
    return row


@router.get("/history")
async def get_agent_history(
    agent_type: Optional[str] = None,
    symbol: Optional[str] = None,
    limit: int = 50,
):
    """Recent runs across all agent_types unless filtered. Used by the
    Agents page to render a history timeline."""
    return {"runs": agent_runs_db.list_history(
        agent_type=agent_type, symbol=symbol, limit=limit,
    )}


# ── Scheduled-agent (cron) management ────────────────────────

class ScheduleRequest(BaseModel):
    agent_type: str
    symbols: list[str] = Field(default_factory=list)
    interval_minutes: int = Field(..., gt=0, le=24 * 60)
    context: Optional[dict[str, Any]] = None


@router.post("/schedule")
async def create_schedule(req: ScheduleRequest):
    """Cron a recurring run. The background agent scheduler picks it up
    on its next poll and starts firing at `interval_minutes`. Output of
    each fire lands in `agent_runs` (so strategy nodes see it)."""
    agent = AGENT_REGISTRY.get(req.agent_type)
    if not agent:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown agent type: {req.agent_type}. Available: {list(AGENT_REGISTRY.keys())}",
        )
    sched = agent_runs_db.create_schedule(
        agent_type=req.agent_type,
        symbols=req.symbols,
        interval_minutes=req.interval_minutes,
        context=req.context or {},
    )
    return {"schedule": sched}


@router.get("/schedule")
async def list_schedules(enabled_only: bool = False):
    return {"schedules": agent_runs_db.list_schedules(enabled_only=enabled_only)}


@router.patch("/schedule/{schedule_id}")
async def toggle_schedule(schedule_id: str, enabled: bool):
    row = agent_runs_db.set_schedule_enabled(schedule_id, enabled)
    if not row:
        raise HTTPException(status_code=404, detail="schedule not found")
    return {"schedule": row}


@router.delete("/schedule/{schedule_id}")
async def delete_schedule(schedule_id: str):
    ok = agent_runs_db.delete_schedule(schedule_id)
    if not ok:
        raise HTTPException(status_code=404, detail="schedule not found")
    return {"deleted": True}
