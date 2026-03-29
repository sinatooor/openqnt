"""
Social Media Monitor Agent — Monitors social media for portfolio impact.

This agent:
1. Reads recent social DataEvents (Reddit, Twitter, Truth Social)
2. Assesses political and social media impact on markets
3. Identifies potential market-moving posts from key figures
4. Generates alerts for high-impact social signals

Covers the user's requirement: "an agent that runs every 15 min and checks
social media of Donald Trump like Truth Social, and decides if it has an impact"
"""

from typing import Any
from google import genai

from .base_agent import (
    BaseAnalysisAgent,
    AgentOutput,
    Finding,
    Recommendation,
    SignalType,
    ImpactLevel,
    ActionType,
)


SOCIAL_ANALYSIS_PROMPT = """You are an expert at analyzing social media posts for market impact. You monitor posts from political leaders, influential investors, and financial communities for signals that could affect markets and specific stocks.

PORTFOLIO SYMBOLS: {symbols}

SOCIAL MEDIA POSTS:
{social_posts}

CRITICAL ANALYSIS AREAS:
1. **Policy Signals**: Any mentions of tariffs, trade wars, regulations, tax changes, government spending
2. **Market-Moving Statements**: Posts that could cause immediate market reactions
3. **Sector Impact**: Which industries or companies are affected
4. **Geopolitical Risk**: Mentions of sanctions, military action, diplomatic tensions
5. **Crypto Signals**: Posts about crypto regulation or adoption

IMPORTANT:
- Posts from heads of state or senior officials are HIGH impact by default
- Look for subtle signals, not just explicit mentions
- Consider the poster's influence and reach
- "Truth Social" posts from political leaders are especially market-sensitive

Respond in this exact JSON format:
{{
    "summary": "Brief assessment of social media landscape (2-3 sentences)",
    "overall_signal": "bullish|bearish|neutral",
    "overall_confidence": 0.0-1.0,
    "alert_level": "none|low|medium|high|critical",
    "findings": [
        {{
            "title": "Finding headline",
            "description": "Analysis of the post and its market implications",
            "signal": "bullish|bearish|neutral|risk|opportunity",
            "impact": "none|low|medium|high|critical",
            "confidence": 0.0-1.0,
            "symbols": ["AAPL"],
            "post_index": 0
        }}
    ],
    "recommendations": [
        {{
            "action": "buy|sell|hold|monitor|hedge|increase_position|reduce_position|no_action",
            "symbol": "AAPL",
            "reasoning": "Social signal reasoning",
            "confidence": 0.0-1.0,
            "urgency": "none|low|medium|high|critical",
            "time_horizon": "immediate|short_term|medium_term|long_term"
        }}
    ]
}}

Be precise about urgency. Political posts from major leaders warrant higher urgency ratings.
If nothing significant is found, return empty arrays with a neutral summary.
"""


class SocialMonitorAgent(BaseAnalysisAgent):
    """Monitors social media for market-impacting posts and political signals."""

    @property
    def agent_type(self) -> str:
        return "social_monitor"

    @property
    def description(self) -> str:
        return "Monitors social media (Reddit, Twitter, Truth Social) for market-moving posts"

    async def analyze(self, context: dict[str, Any]) -> AgentOutput:
        """
        Analyze social media posts for portfolio impact.

        Expected context:
        - symbols: list[str] — portfolio symbols
        - social_events: list[dict] — recent DataEvents (type=social)
        - model: str — LLM model (default: gemini-2.5-flash)
        """
        symbols = context.get("symbols", [])
        social_events = context.get("social_events", [])
        model = context.get("model", "gemini-2.5-flash")

        if not social_events:
            return AgentOutput(
                agent_type=self.agent_type,
                summary="No social media posts to analyze.",
                overall_confidence=1.0,
                overall_signal=SignalType.NEUTRAL,
            )

        # Format posts for the prompt
        posts_text = "\n".join(
            f"[{i}] Platform: {ev.get('metadata', {}).get('platform', 'unknown')} | "
            f"Author: {ev.get('metadata', {}).get('handle', ev.get('metadata', {}).get('author', 'unknown'))} | "
            f"Posted: {ev.get('publishedAt', 'N/A')}\n"
            f"    Title: {ev.get('headline', 'N/A')}\n"
            f"    Content: {(ev.get('body', '') or '')[:500]}\n"
            f"    Engagement: Score={ev.get('metadata', {}).get('score', 'N/A')}, "
            f"Comments={ev.get('metadata', {}).get('numComments', 'N/A')}"
            for i, ev in enumerate(social_events)
        )

        prompt = SOCIAL_ANALYSIS_PROMPT.format(
            symbols=", ".join(symbols) if symbols else "Not specified",
            social_posts=posts_text,
        )

        # Call LLM
        client = genai.Client()
        response = await client.aio.models.generate_content(
            model=model,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )

        tokens_used = 0
        if response.usage_metadata:
            tokens_used = (response.usage_metadata.prompt_token_count or 0) + (
                response.usage_metadata.candidates_token_count or 0
            )

        # Parse LLM response
        import json
        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            return AgentOutput(
                agent_type=self.agent_type,
                error=f"Failed to parse LLM response: {response.text[:500]}",
                tokens_used=tokens_used,
            )

        # Convert to AgentOutput
        findings = []
        for f in result.get("findings", []):
            post_idx = f.get("post_index", 0)
            evidence_ids = []
            if post_idx < len(social_events) and "id" in social_events[post_idx]:
                evidence_ids = [social_events[post_idx]["id"]]

            findings.append(Finding(
                title=f.get("title", ""),
                description=f.get("description", ""),
                signal=SignalType(f.get("signal", "neutral")),
                impact=ImpactLevel(f.get("impact", "none")),
                confidence=f.get("confidence", 0.5),
                symbols=f.get("symbols", []),
                evidence_ids=evidence_ids,
                metadata={"alert_level": result.get("alert_level", "none")},
            ))

        recommendations = []
        for r in result.get("recommendations", []):
            recommendations.append(Recommendation(
                action=ActionType(r.get("action", "no_action")),
                symbol=r.get("symbol", ""),
                reasoning=r.get("reasoning", ""),
                confidence=r.get("confidence", 0.5),
                urgency=ImpactLevel(r.get("urgency", "low")),
                time_horizon=r.get("time_horizon", "immediate"),
            ))

        return AgentOutput(
            agent_type=self.agent_type,
            findings=findings,
            recommendations=recommendations,
            summary=result.get("summary", ""),
            overall_confidence=result.get("overall_confidence", 0.5),
            overall_signal=SignalType(result.get("overall_signal", "neutral")),
            tokens_used=tokens_used,
        )


# Singleton instance
social_monitor = SocialMonitorAgent()
