"""
Macro Analyst Agent — Analyzes macroeconomic data for portfolio impact.

This agent:
1. Reads recent macro DataEvents (FRED data, economic calendar)
2. Assesses the macroeconomic environment (expansionary/contractionary)
3. Identifies risks and opportunities from macro trends
4. Recommends sector rotations and defensive/offensive positioning

Covers the user's requirement: "an agent that does macro economic research"
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


MACRO_ANALYSIS_PROMPT = """You are an expert macroeconomist and portfolio strategist. Analyze the following macroeconomic data points and their implications for the user's investment portfolio.

PORTFOLIO SYMBOLS: {symbols}

MACRO DATA POINTS:
{macro_data}

Your analysis should cover:
1. **Economic Regime**: Is the economy expansionary, peak, contractionary, or trough?
2. **Key Risks**: What risks do these data points suggest? (recession, inflation, rate hikes, etc.)
3. **Sector Impact**: Which sectors benefit or suffer from these macro conditions?
4. **Portfolio Impact**: How do these conditions affect the user's specific holdings?

For yield curve data (T10Y2Y), negative values signal potential recession.
For CPI/PCEPI data, values above 3% suggest persistent inflation.
For unemployment, rising values above 4.5% suggest economic weakness.

Respond in this exact JSON format:
{{
    "summary": "Concise macro environment assessment (2-3 sentences)",
    "overall_signal": "bullish|bearish|neutral",
    "overall_confidence": 0.0-1.0,
    "economic_regime": "expansion|peak|contraction|trough",
    "findings": [
        {{
            "title": "Finding headline",
            "description": "Detailed analysis",
            "signal": "bullish|bearish|neutral|risk|opportunity",
            "impact": "none|low|medium|high|critical",
            "confidence": 0.0-1.0,
            "symbols": ["AAPL"],
            "data_point_index": 0
        }}
    ],
    "recommendations": [
        {{
            "action": "buy|sell|hold|monitor|hedge|increase_position|reduce_position|no_action",
            "symbol": "AAPL",
            "reasoning": "Macro-driven reasoning",
            "confidence": 0.0-1.0,
            "urgency": "none|low|medium|high|critical",
            "time_horizon": "immediate|short_term|medium_term|long_term"
        }}
    ]
}}

Be data-driven. Reference specific data values in your analysis.
"""


class MacroAnalystAgent(BaseAnalysisAgent):
    """Analyzes macroeconomic data for portfolio impact and positioning."""

    @property
    def agent_type(self) -> str:
        return "macro_analyst"

    @property
    def description(self) -> str:
        return "Analyzes macroeconomic indicators (GDP, CPI, rates, yields) for portfolio positioning"

    async def analyze(self, context: dict[str, Any]) -> AgentOutput:
        """
        Analyze macro data against user's portfolio.

        Expected context:
        - symbols: list[str] — portfolio symbols
        - macro_events: list[dict] — recent DataEvents (type=macro)
        - model: str — LLM model (default: gemini-2.0-flash)
        """
        symbols = context.get("symbols", [])
        macro_events = context.get("macro_events", [])
        model = context.get("model", "gemini-2.0-flash")

        if not macro_events:
            return AgentOutput(
                agent_type=self.agent_type,
                summary="No macroeconomic data available for analysis.",
                overall_confidence=1.0,
                overall_signal=SignalType.NEUTRAL,
            )

        # Format macro data points
        macro_items_text = "\n".join(
            f"[{i}] {ev.get('headline', 'N/A')}\n"
            f"    Details: {(ev.get('body', '') or '')[:500]}\n"
            f"    Published: {ev.get('publishedAt', 'N/A')}"
            for i, ev in enumerate(macro_events)
        )

        prompt = MACRO_ANALYSIS_PROMPT.format(
            symbols=", ".join(symbols) if symbols else "Not specified (analyze market-wide)",
            macro_data=macro_items_text,
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
                metadata={"economic_regime": result.get("economic_regime", "unknown")},
            ))

        recommendations = []
        for r in result.get("recommendations", []):
            recommendations.append(Recommendation(
                action=ActionType(r.get("action", "no_action")),
                symbol=r.get("symbol", ""),
                reasoning=r.get("reasoning", ""),
                confidence=r.get("confidence", 0.5),
                urgency=ImpactLevel(r.get("urgency", "low")),
                time_horizon=r.get("time_horizon", "medium_term"),
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
macro_analyst = MacroAnalystAgent()
