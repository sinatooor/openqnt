"""
News Analyst Agent — Analyzes news events for portfolio impact.

This agent:
1. Reads recent DataEvents (type=news) from the ingestion pipeline
2. Uses LLM to assess sentiment, relevance, and impact
3. Produces findings about market-moving news
4. Generates actionable recommendations (buy/sell/hold/monitor)

Part of the user's core use case: "an agent that reads most important news
on Yahoo Finance, if there is anything that can have impact on the portfolio
then inform the user"
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


ANALYSIS_PROMPT = """You are an expert financial news analyst. Analyze the following news headlines and determine their impact on the user's portfolio.

PORTFOLIO SYMBOLS: {symbols}

NEWS ITEMS:
{news_items}

For each significant news item, provide:
1. SIGNAL: bullish, bearish, neutral, risk, or opportunity
2. IMPACT: none, low, medium, high, or critical
3. CONFIDENCE: 0.0 to 1.0
4. AFFECTED SYMBOLS: which portfolio symbols are affected
5. RECOMMENDED ACTION: buy, sell, hold, monitor, hedge, increase_position, reduce_position, or no_action
6. REASONING: brief explanation

Respond in this exact JSON format:
{{
    "summary": "Brief overall market assessment",
    "overall_signal": "bullish|bearish|neutral",
    "overall_confidence": 0.0-1.0,
    "findings": [
        {{
            "title": "Headline summary",
            "description": "Analysis of the impact",
            "signal": "bullish|bearish|neutral|risk|opportunity",
            "impact": "none|low|medium|high|critical",
            "confidence": 0.0-1.0,
            "symbols": ["AAPL", "MSFT"],
            "news_index": 0
        }}
    ],
    "recommendations": [
        {{
            "action": "buy|sell|hold|monitor|hedge|increase_position|reduce_position|no_action",
            "symbol": "AAPL",
            "reasoning": "Why this action",
            "confidence": 0.0-1.0,
            "urgency": "none|low|medium|high|critical",
            "time_horizon": "immediate|short_term|medium_term|long_term"
        }}
    ]
}}

Focus on actionable insights. Only include findings for news that has real impact.
If no news is particularly significant, say so in the summary and return empty arrays.
"""


class NewsAnalystAgent(BaseAnalysisAgent):
    """Analyzes news events for portfolio impact and generates recommendations."""

    @property
    def agent_type(self) -> str:
        return "news_analyst"

    @property
    def description(self) -> str:
        return "Analyzes news headlines and articles for market impact on portfolio holdings"

    async def analyze(self, context: dict[str, Any]) -> AgentOutput:
        """
        Analyze news events against user's portfolio.

        Expected context:
        - symbols: list[str] — portfolio symbols to monitor
        - news_events: list[dict] — recent DataEvents (type=news)
        - model: str — LLM model to use (default: gemini-2.0-flash)
        """
        symbols = context.get("symbols", [])
        news_events = context.get("news_events", [])
        model = context.get("model", "gemini-2.0-flash")

        if not news_events:
            return AgentOutput(
                agent_type=self.agent_type,
                summary="No news events to analyze.",
                overall_confidence=1.0,
                overall_signal=SignalType.NEUTRAL,
            )

        # Format news items for the prompt
        news_items_text = "\n".join(
            f"[{i}] {ev.get('headline', 'N/A')} | "
            f"Symbol: {ev.get('symbol', 'N/A')} | "
            f"Published: {ev.get('publishedAt', 'N/A')} | "
            f"Source: {ev.get('sourceName', 'N/A')}\n"
            f"    Body: {(ev.get('body', '') or '')[:300]}"
            for i, ev in enumerate(news_events)
        )

        prompt = ANALYSIS_PROMPT.format(
            symbols=", ".join(symbols) if symbols else "Not specified",
            news_items=news_items_text,
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
            news_idx = f.get("news_index", 0)
            evidence_ids = []
            if news_idx < len(news_events) and "id" in news_events[news_idx]:
                evidence_ids = [news_events[news_idx]["id"]]

            findings.append(Finding(
                title=f.get("title", ""),
                description=f.get("description", ""),
                signal=SignalType(f.get("signal", "neutral")),
                impact=ImpactLevel(f.get("impact", "none")),
                confidence=f.get("confidence", 0.5),
                symbols=f.get("symbols", []),
                evidence_ids=evidence_ids,
            ))

        recommendations = []
        for r in result.get("recommendations", []):
            recommendations.append(Recommendation(
                action=ActionType(r.get("action", "no_action")),
                symbol=r.get("symbol", ""),
                reasoning=r.get("reasoning", ""),
                confidence=r.get("confidence", 0.5),
                urgency=ImpactLevel(r.get("urgency", "low")),
                time_horizon=r.get("time_horizon", "short_term"),
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
news_analyst = NewsAnalystAgent()
