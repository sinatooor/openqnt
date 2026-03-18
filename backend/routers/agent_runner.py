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

router = APIRouter(prefix="/compute/agents", tags=["agents"])

# ── Agent Registry ────────────────────────────────────────────

AGENT_REGISTRY = {
    "news_analyst": news_analyst,
    "macro_analyst": macro_analyst,
    "social_monitor": social_monitor,
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
