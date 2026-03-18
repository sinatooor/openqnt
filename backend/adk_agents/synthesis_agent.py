"""
Synthesis Agent — The final decision-maker that combines all agent outputs.

This agent:
1. Takes outputs from news, macro, social, technical, and insider agents
2. Weighs evidence across all sources
3. Produces a unified portfolio action plan
4. Ranks recommendations by urgency and confidence

This is the "final agent" from the user's requirement: "a final agent that
gets all the information, technical like RSI and SMA, news, social media post,
and decides what to buy, sell or do"
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


SYNTHESIS_PROMPT = """You are a senior portfolio strategist. You receive research from multiple specialized analysts and must synthesize their findings into a coherent, actionable investment plan.

PORTFOLIO SYMBOLS: {symbols}

## ANALYST REPORTS:

{agent_reports}

## YOUR TASK:

Synthesize all analyst inputs into a UNIFIED portfolio action plan:

1. **Cross-Reference**: Where do multiple analysts agree or disagree?
2. **Weight Evidence**: News + Macro alignment = higher confidence. Contradictions = lower confidence.
3. **Risk Assessment**: What is the overall risk level right now?
4. **Action Priority**: What should the user do FIRST, SECOND, THIRD?

IMPORTANT RULES:
- A signal from ONE source is weak. Signals from MULTIPLE sources are strong.
- If macro is bearish but news is bullish on a stock, explain the tension.
- Social media signals from political leaders override normal social signals.
- Technical oversold conditions combined with positive news = strong buy signals.
- If no actionable signal exists, recommend HOLD or MONITOR — don't force a trade.

Respond in this exact JSON format:
{{
    "summary": "2-3 sentence executive summary of the market situation and what to do",
    "overall_signal": "bullish|bearish|neutral",
    "overall_confidence": 0.0-1.0,
    "risk_level": "none|low|medium|high|critical",
    "market_regime": "risk_on|risk_off|transition|uncertain",
    "findings": [
        {{
            "title": "Cross-analyst finding",
            "description": "Synthesized analysis with evidence from multiple sources",
            "signal": "bullish|bearish|neutral|risk|opportunity",
            "impact": "none|low|medium|high|critical",
            "confidence": 0.0-1.0,
            "symbols": ["AAPL"],
            "supporting_agents": ["news_analyst", "macro_analyst"]
        }}
    ],
    "action_plan": [
        {{
            "priority": 1,
            "action": "buy|sell|hold|monitor|hedge|increase_position|reduce_position|no_action",
            "symbol": "AAPL",
            "reasoning": "Multi-source reasoning",
            "confidence": 0.0-1.0,
            "urgency": "none|low|medium|high|critical",
            "time_horizon": "immediate|short_term|medium_term|long_term",
            "supporting_agents": ["news_analyst", "technical"]
        }}
    ]
}}
"""


class SynthesisAgent(BaseAnalysisAgent):
    """Combines all analyst outputs into a unified portfolio action plan."""

    @property
    def agent_type(self) -> str:
        return "synthesis"

    @property
    def description(self) -> str:
        return "Synthesizes outputs from all other agents into a unified investment decision"

    async def analyze(self, context: dict[str, Any]) -> AgentOutput:
        """
        Synthesize multiple agent outputs into a unified action plan.

        Expected context:
        - symbols: list[str] — portfolio symbols
        - agent_outputs: list[dict] — AgentOutput dicts from other agents
        - model: str — LLM model (default: gemini-2.0-flash)
        """
        symbols = context.get("symbols", [])
        agent_outputs = context.get("agent_outputs", [])
        model = context.get("model", "gemini-2.0-flash")

        if not agent_outputs:
            return AgentOutput(
                agent_type=self.agent_type,
                summary="No analyst reports to synthesize.",
                overall_confidence=1.0,
                overall_signal=SignalType.NEUTRAL,
            )

        # Format agent reports for the prompt
        reports_text = ""
        for i, output in enumerate(agent_outputs):
            agent_type = output.get("agent_type", f"agent_{i}")
            summary = output.get("summary", "No summary")
            signal = output.get("overall_signal", "neutral")
            confidence = output.get("overall_confidence", 0.5)

            reports_text += f"\n### {agent_type.upper()} (Signal: {signal}, Confidence: {confidence})\n"
            reports_text += f"Summary: {summary}\n"

            findings = output.get("findings", [])
            if findings:
                reports_text += "Key Findings:\n"
                for f in findings[:5]:  # Cap at 5 findings per agent
                    reports_text += f"  - [{f.get('signal', 'N/A')}] {f.get('title', 'N/A')}: {f.get('description', 'N/A')[:200]}\n"

            recommendations = output.get("recommendations", [])
            if recommendations:
                reports_text += "Recommendations:\n"
                for r in recommendations[:5]:
                    reports_text += f"  - {r.get('action', 'N/A')} {r.get('symbol', 'N/A')}: {r.get('reasoning', 'N/A')[:150]}\n"

        prompt = SYNTHESIS_PROMPT.format(
            symbols=", ".join(symbols) if symbols else "Not specified",
            agent_reports=reports_text,
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
                metadata={
                    "supporting_agents": f.get("supporting_agents", []),
                    "risk_level": result.get("risk_level", "unknown"),
                    "market_regime": result.get("market_regime", "unknown"),
                },
            ))

        # Convert action plan to recommendations
        recommendations = []
        for r in result.get("action_plan", []):
            recommendations.append(Recommendation(
                action=ActionType(r.get("action", "no_action")),
                symbol=r.get("symbol", ""),
                reasoning=r.get("reasoning", ""),
                confidence=r.get("confidence", 0.5),
                urgency=ImpactLevel(r.get("urgency", "low")),
                time_horizon=r.get("time_horizon", "short_term"),
                metadata={
                    "priority": r.get("priority", 99),
                    "supporting_agents": r.get("supporting_agents", []),
                },
            ))

        # Sort by priority
        recommendations.sort(key=lambda r: r.metadata.get("priority", 99))

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
synthesis_agent = SynthesisAgent()
