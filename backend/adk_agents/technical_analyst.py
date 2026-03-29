"""
Technical Analysis Agent — Monitors RSI, SMA, and other indicators.

This agent:
1. Fetches current price data for portfolio symbols
2. Calculates RSI, SMA, and other key technical indicators
3. Identifies overbought/oversold conditions
4. Generates signals based on user-defined thresholds

Covers the user's requirement: "checks the RSI and SMA of these stocks
every day, and inform the user when it is higher or lower of certain level"
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


TECHNICAL_PROMPT = """You are an expert technical analyst. Analyze the following technical indicator data for the user's portfolio and identify actionable signals.

PORTFOLIO SYMBOLS: {symbols}

TECHNICAL DATA:
{technical_data}

USER THRESHOLDS (if specified):
{thresholds}

ANALYSIS RULES:
1. **RSI**: Below 30 = oversold (potential buy), Above 70 = overbought (potential sell)
2. **SMA Crossover**: Price above SMA200 = bullish trend, below = bearish trend
3. **Golden Cross**: SMA50 crosses above SMA200 = strong bullish signal
4. **Death Cross**: SMA50 crosses below SMA200 = strong bearish signal
5. **MACD**: Histogram turning positive = bullish momentum, negative = bearish
6. **Volume**: Unusually high volume confirms breakouts/breakdowns

Respond in this exact JSON format:
{{
    "summary": "Technical overview of the portfolio (2-3 sentences)",
    "overall_signal": "bullish|bearish|neutral",
    "overall_confidence": 0.0-1.0,
    "findings": [
        {{
            "title": "Technical signal description",
            "description": "Detailed analysis",
            "signal": "bullish|bearish|neutral|risk|opportunity",
            "impact": "none|low|medium|high|critical",
            "confidence": 0.0-1.0,
            "symbols": ["AAPL"],
            "indicator": "RSI|SMA|MACD|Volume|Pattern"
        }}
    ],
    "recommendations": [
        {{
            "action": "buy|sell|hold|monitor|hedge|increase_position|reduce_position|no_action",
            "symbol": "AAPL",
            "reasoning": "Technical reasoning referencing specific indicator values",
            "confidence": 0.0-1.0,
            "urgency": "none|low|medium|high|critical",
            "time_horizon": "immediate|short_term|medium_term|long_term"
        }}
    ],
    "alerts": [
        {{
            "symbol": "AAPL",
            "indicator": "RSI",
            "current_value": 28.5,
            "threshold": 30,
            "condition": "below",
            "message": "RSI is below 30 — oversold territory"
        }}
    ]
}}

Focus on clear, actionable signals. Don't generate noise from insignificant moves.
"""


class TechnicalAnalysisAgent(BaseAnalysisAgent):
    """Monitors technical indicators (RSI, SMA, MACD) and generates alerts."""

    @property
    def agent_type(self) -> str:
        return "technical_analyst"

    @property
    def description(self) -> str:
        return "Monitors RSI, SMA, MACD, and other technical indicators for portfolio symbols"

    async def analyze(self, context: dict[str, Any]) -> AgentOutput:
        """
        Analyze technical indicators for portfolio symbols.

        Expected context:
        - symbols: list[str] — portfolio symbols to analyze
        - technical_data: dict — pre-computed indicator data per symbol
          e.g. {"AAPL": {"rsi_14": 32.5, "sma_50": 185.2, "sma_200": 178.4, ...}}
        - thresholds: dict — user-defined alert thresholds
          e.g. {"rsi_buy": 30, "rsi_sell": 70}
        - model: str — LLM model
        """
        symbols = context.get("symbols", [])
        technical_data = context.get("technical_data", {})
        thresholds = context.get("thresholds", {})
        model = context.get("model", "gemini-2.5-flash")

        if not technical_data:
            return AgentOutput(
                agent_type=self.agent_type,
                summary="No technical data available. Ensure price data is being fetched.",
                overall_confidence=0.0,
                overall_signal=SignalType.NEUTRAL,
            )

        # Format technical data for the prompt
        tech_text = ""
        for symbol, data in technical_data.items():
            tech_text += f"\n{symbol}:\n"
            for indicator, value in data.items():
                tech_text += f"  {indicator}: {value}\n"

        threshold_text = "Default thresholds (RSI: buy<30, sell>70)"
        if thresholds:
            threshold_text = "\n".join(f"  {k}: {v}" for k, v in thresholds.items())

        prompt = TECHNICAL_PROMPT.format(
            symbols=", ".join(symbols) if symbols else "See data below",
            technical_data=tech_text,
            thresholds=threshold_text,
        )

        # Call LLM
        client = genai.Client()
        response = await client.aio.models.generate_content(
            model=model,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,  # Lower temp for technical analysis
            ),
        )

        tokens_used = 0
        if response.usage_metadata:
            tokens_used = (response.usage_metadata.prompt_token_count or 0) + (
                response.usage_metadata.candidates_token_count or 0
            )

        import json
        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            return AgentOutput(
                agent_type=self.agent_type,
                error=f"Failed to parse LLM response: {response.text[:500]}",
                tokens_used=tokens_used,
            )

        # Convert findings
        findings = []
        for f in result.get("findings", []):
            findings.append(Finding(
                title=f.get("title", ""),
                description=f.get("description", ""),
                signal=SignalType(f.get("signal", "neutral")),
                impact=ImpactLevel(f.get("impact", "none")),
                confidence=f.get("confidence", 0.5),
                symbols=f.get("symbols", []),
                metadata={"indicator": f.get("indicator", "unknown")},
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

        # Add alerts to metadata
        alerts = result.get("alerts", [])

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
technical_analyst = TechnicalAnalysisAgent()
