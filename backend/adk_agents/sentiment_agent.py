"""
Sentiment Agent — Multi-source sentiment fusion and analysis.

This agent:
1. Aggregates sentiment from multiple sources (news, social, options, technical)
2. Applies weighted scoring across sources
3. Detects sentiment divergences and extreme readings
4. Produces a composite sentiment score with trend direction

Addresses Task Tree Phase 2.2.7: Sentiment Agent
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


ANALYSIS_PROMPT = """You are an expert market sentiment analyst. Analyze the following multi-source sentiment data for the given symbols and produce a composite sentiment assessment.

SYMBOLS TO ANALYZE: {symbols}

SENTIMENT DATA:
{sentiment_data}

Your analysis should:
1. **Composite Sentiment Score**: Weighted average across all sources (0.0 = extreme bearish, 0.5 = neutral, 1.0 = extreme bullish)
2. **Trend Direction**: Is sentiment improving, deteriorating, or stable?
3. **Divergence Detection**: Are any sources diverging from the consensus? (e.g., news bullish but social bearish)
4. **Extreme Readings**: Are any sentiment indicators at extreme levels that may signal a turning point?
5. **Smart Money vs. Retail**: If options/institutional data differs from social/retail sentiment, flag this divergence

Respond in this exact JSON format:
{{
    "summary": "Overall sentiment assessment across all sources",
    "overall_signal": "bullish|bearish|neutral",
    "overall_confidence": 0.0-1.0,
    "findings": [
        {{
            "title": "Sentiment observation",
            "description": "Detailed sentiment analysis with data points",
            "signal": "bullish|bearish|neutral|risk|opportunity",
            "impact": "none|low|medium|high|critical",
            "confidence": 0.0-1.0,
            "symbols": ["AAPL"],
            "source": "composite|news|social|options|technical|institutional"
        }}
    ],
    "recommendations": [
        {{
            "action": "buy|sell|hold|monitor|hedge|increase_position|reduce_position|no_action",
            "symbol": "AAPL",
            "reasoning": "Sentiment-driven rationale",
            "confidence": 0.0-1.0,
            "urgency": "none|low|medium|high|critical",
            "time_horizon": "immediate|short_term|medium_term|long_term"
        }}
    ],
    "sentiment_scores": [
        {{
            "symbol": "AAPL",
            "composite_score": 0.0-1.0,
            "news_score": 0.0-1.0,
            "social_score": 0.0-1.0,
            "options_score": 0.0-1.0,
            "trend": "improving|stable|deteriorating",
            "divergence_alert": true|false,
            "extreme_reading": true|false,
            "contrarian_signal": "none|bullish_contrarian|bearish_contrarian"
        }}
    ]
}}

Focus on actionable sentiment shifts. Highlight divergences between smart money and retail sentiment.
Extreme readings (e.g., > 0.85 or < 0.15) may indicate contrarian opportunities.
"""


class SentimentAgent(BaseAnalysisAgent):
    """Multi-source sentiment fusion and analysis agent."""

    @property
    def agent_type(self) -> str:
        return "sentiment_analyst"

    @property
    def description(self) -> str:
        return "Fuses sentiment from news, social media, options flow, and technical indicators into composite scores"

    async def analyze(self, context: dict[str, Any], ctx=None) -> AgentOutput:
        """
        Analyze multi-source sentiment data.

        Expected context:
        - symbols: list[str] — stock symbols to analyze
        - news_sentiment: list[dict] — sentiment from news sources
        - social_sentiment: list[dict] — sentiment from social media
        - options_data: list[dict] — options flow data (put/call ratios, unusual activity)
        - technical_signals: list[dict] — technical indicator signals
        - model: str — LLM model to use (default: gemini-2.5-flash)
        """
        symbols = context.get("symbols", [])
        model = context.get("model", "gemini-2.5-flash")

        if not symbols:
            return AgentOutput(
                agent_type=self.agent_type,
                summary="No symbols provided for sentiment analysis.",
                overall_confidence=1.0,
                overall_signal=SignalType.NEUTRAL,
            )

        # Gather sentiment data from context
        sentiment_data = self._gather_sentiment_data(context)

        prompt = ANALYSIS_PROMPT.format(
            symbols=", ".join(symbols),
            sentiment_data=sentiment_data,
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
            findings.append(Finding(
                title=f.get("title", ""),
                description=f.get("description", ""),
                signal=SignalType(f.get("signal", "neutral")),
                impact=ImpactLevel(f.get("impact", "none")),
                confidence=f.get("confidence", 0.5),
                symbols=f.get("symbols", []),
                metadata={
                    "source": f.get("source", "composite"),
                },
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

    def _gather_sentiment_data(self, context: dict[str, Any]) -> str:
        """Gather and format all sentiment sources into text for the prompt."""
        sections = []

        # News sentiment
        news = context.get("news_sentiment", [])
        if news:
            sections.append("── News Sentiment ──")
            for item in news[:20]:
                headline = item.get("headline", "N/A")
                sentiment = item.get("sentiment", "N/A")
                symbol = item.get("symbol", "N/A")
                sections.append(f"  [{symbol}] {headline} → Sentiment: {sentiment}")
        else:
            sections.append("── News Sentiment ──\n  No news sentiment data available")

        # Social media sentiment
        social = context.get("social_sentiment", [])
        if social:
            sections.append("\n── Social Media Sentiment ──")
            for item in social[:20]:
                platform = item.get("platform", "unknown")
                content = (item.get("content", "") or "")[:200]
                sentiment = item.get("sentiment", "N/A")
                symbol = item.get("symbol", "N/A")
                engagement = item.get("engagement", "N/A")
                sections.append(f"  [{platform}] [{symbol}] {content}... → Sentiment: {sentiment}, Engagement: {engagement}")
        else:
            sections.append("\n── Social Media Sentiment ──\n  No social sentiment data available")

        # Options data
        options = context.get("options_data", [])
        if options:
            sections.append("\n── Options Flow ──")
            for item in options[:15]:
                symbol = item.get("symbol", "N/A")
                put_call = item.get("put_call_ratio", "N/A")
                unusual = item.get("unusual_activity", False)
                volume = item.get("volume", "N/A")
                sections.append(f"  [{symbol}] P/C Ratio: {put_call} | Volume: {volume} | Unusual: {'YES' if unusual else 'No'}")
        else:
            sections.append("\n── Options Flow ──\n  No options data available")

        # Technical signals
        technical = context.get("technical_signals", [])
        if technical:
            sections.append("\n── Technical Signals ──")
            for item in technical[:15]:
                symbol = item.get("symbol", "N/A")
                indicator = item.get("indicator", "N/A")
                signal = item.get("signal", "N/A")
                value = item.get("value", "N/A")
                sections.append(f"  [{symbol}] {indicator}: {value} → Signal: {signal}")
        else:
            sections.append("\n── Technical Signals ──\n  No technical signal data available")

        return "\n".join(sections)


# Singleton instance
sentiment_analyst = SentimentAgent()
