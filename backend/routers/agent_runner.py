"""
Agent Runner API — FastAPI endpoint for triggering analysis agents.

This endpoint allows the orchestrator to invoke specialized agents
(news_analyst, macro_analyst, social_monitor) with context data
and receive standardized AgentOutput responses.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Optional

from adk_agents.news_analyst import news_analyst
from adk_agents.macro_analyst import macro_analyst
from adk_agents.social_monitor import social_monitor
from adk_agents.synthesis_agent import synthesis_agent
from adk_agents.technical_analyst import technical_analyst

router = APIRouter(prefix="/compute/agents", tags=["agents"])

# ── Agent Registry ────────────────────────────────────────────

AGENT_REGISTRY = {
    "news_analyst": news_analyst,
    "macro_analyst": macro_analyst,
    "social_monitor": social_monitor,
    "synthesis": synthesis_agent,
    "technical_analyst": technical_analyst,
}

# ── Request/Response Models ───────────────────────────────────

class AgentRunRequest(BaseModel):
    agent_type: str          # "news_analyst", "macro_analyst", "social_monitor"
    context: dict[str, Any]  # Agent-specific context (symbols, events, etc.)
    model: Optional[str] = "gemini-2.0-flash"  # LLM model override


class AgentRunResponse(BaseModel):
    success: bool
    agent_type: str
    output: dict[str, Any] | None = None
    error: str | None = None


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/run", response_model=AgentRunResponse)
async def run_agent(req: AgentRunRequest):
    """
    Run a specialized analysis agent with the given context.
    Called by the orchestrator to delegate analysis to the compute service.
    """
    agent = AGENT_REGISTRY.get(req.agent_type)
    if not agent:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown agent type: {req.agent_type}. Available: {list(AGENT_REGISTRY.keys())}"
        )

    # Inject model preference into context
    context = {**req.context}
    if req.model:
        context["model"] = req.model

    try:
        output = await agent.run(context)

        if output.error:
            return AgentRunResponse(
                success=False,
                agent_type=req.agent_type,
                output=output.to_dict(),
                error=output.error,
            )

        return AgentRunResponse(
            success=True,
            agent_type=req.agent_type,
            output=output.to_dict(),
        )
    except Exception as e:
        return AgentRunResponse(
            success=False,
            agent_type=req.agent_type,
            error=str(e),
        )


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
    model: Optional[str] = "gemini-2.0-flash"


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
    model = req.model or "gemini-2.0-flash"

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
