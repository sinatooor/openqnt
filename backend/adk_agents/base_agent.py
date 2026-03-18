"""
Base Agent Framework for OpenQwnt Specialized Agents

Every specialized agent (news_analyst, macro_analyst, social_monitor, etc.)
inherits from BaseAnalysisAgent. This provides:

1. Standardized output schema (AgentOutput)
2. Automatic run logging via the orchestrator API
3. Confidence scoring
4. Evidence linking to DataEvents
5. Error handling and retry logic

Inspired by OpenClaw's agent-scope pattern and n8n's execution context.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import Any, Optional
from datetime import datetime
from enum import Enum
import time
import traceback


# ─── Standard Agent Output Schema ──────────────────────────────

class SignalType(str, Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"
    RISK = "risk"
    OPPORTUNITY = "opportunity"
    INFO = "info"


class ImpactLevel(str, Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ActionType(str, Enum):
    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"
    MONITOR = "monitor"
    HEDGE = "hedge"
    INCREASE_POSITION = "increase_position"
    REDUCE_POSITION = "reduce_position"
    NO_ACTION = "no_action"


@dataclass
class Finding:
    """A single finding/insight from the agent's analysis."""
    title: str
    description: str
    signal: SignalType = SignalType.NEUTRAL
    impact: ImpactLevel = ImpactLevel.NONE
    confidence: float = 0.5       # 0-1
    symbols: list[str] = field(default_factory=list)
    evidence_ids: list[str] = field(default_factory=list)  # DataEvent IDs
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Recommendation:
    """An actionable recommendation from the agent."""
    action: ActionType
    symbol: str
    reasoning: str
    confidence: float = 0.5       # 0-1
    urgency: ImpactLevel = ImpactLevel.LOW
    time_horizon: str = "short_term"  # "immediate", "short_term", "medium_term", "long_term"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentOutput:
    """Standardized output from any analysis agent."""
    agent_type: str
    run_id: str | None = None
    findings: list[Finding] = field(default_factory=list)
    recommendations: list[Recommendation] = field(default_factory=list)
    summary: str = ""
    overall_confidence: float = 0.5  # 0-1
    overall_signal: SignalType = SignalType.NEUTRAL
    tokens_used: int = 0
    duration_ms: int = 0
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


# ─── Base Analysis Agent ───────────────────────────────────────

class BaseAnalysisAgent(ABC):
    """
    Base class for all OpenQwnt analysis agents.

    Subclasses must implement:
    - agent_type: The unique identifier for this agent
    - analyze(): The main analysis logic

    The base class handles:
    - Run lifecycle (start, complete, fail)
    - Output schema enforcement
    - Timing and metrics
    """

    @property
    @abstractmethod
    def agent_type(self) -> str:
        """Unique identifier for this agent type, e.g. 'news_analyst'"""
        ...

    @property
    def description(self) -> str:
        """Human-readable description of what this agent does."""
        return f"{self.agent_type} agent"

    @abstractmethod
    async def analyze(self, context: dict[str, Any]) -> AgentOutput:
        """
        Main analysis method. Subclasses implement their analysis here.

        Args:
            context: Dict containing analysis parameters, e.g.:
                - symbols: List of ticker symbols to analyze
                - portfolio: User's portfolio data
                - data_events: Recent DataEvents to analyze
                - time_range: Analysis time window
                - user_preferences: User's risk tolerance, etc.

        Returns:
            AgentOutput with findings and recommendations.
        """
        ...

    async def run(self, context: dict[str, Any]) -> AgentOutput:
        """
        Execute the agent with full lifecycle management.
        This wraps analyze() with timing, error handling, and logging.
        """
        start_time = time.time()

        try:
            output = await self.analyze(context)
            output.agent_type = self.agent_type
            output.duration_ms = int((time.time() - start_time) * 1000)
            return output

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return AgentOutput(
                agent_type=self.agent_type,
                error=f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}",
                duration_ms=duration_ms,
                overall_confidence=0.0,
            )
