"""
Fundamentals Agent — Analyzes company financial health and valuation.

This agent:
1. Fetches company financial data (ratios, growth, profitability, balance sheet)
2. Compares against sector peers
3. Uses LLM to assess overall financial health
4. Produces a financial health score and actionable recommendations

Addresses Task Tree Phase 2.2.3: Fundamentals Agent
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


ANALYSIS_PROMPT = """You are an expert fundamental equity analyst. Analyze the following financial data for the given companies and assess their financial health.

SYMBOLS TO ANALYZE: {symbols}

FINANCIAL DATA:
{financial_data}

For each company, evaluate:
1. **Profitability**: ROE, ROA, profit margins, operating efficiency
2. **Growth**: Revenue growth, earnings growth, book value growth
3. **Balance Sheet Health**: Debt/Equity, current ratio, interest coverage
4. **Valuation**: P/E, P/B, PEG ratio, EV/EBITDA vs. peers
5. **Cash Flow**: Free cash flow yield, operating cash flow trends
6. **Red Flags**: Declining margins, rising debt, negative FCF, accounting concerns

Respond in this exact JSON format:
{{
    "summary": "Overall assessment of the companies analyzed",
    "overall_signal": "bullish|bearish|neutral",
    "overall_confidence": 0.0-1.0,
    "findings": [
        {{
            "title": "Financial health headline",
            "description": "Detailed analysis with specific numbers",
            "signal": "bullish|bearish|neutral|risk|opportunity",
            "impact": "none|low|medium|high|critical",
            "confidence": 0.0-1.0,
            "symbols": ["AAPL"],
            "category": "profitability|growth|balance_sheet|valuation|cash_flow|red_flag"
        }}
    ],
    "recommendations": [
        {{
            "action": "buy|sell|hold|monitor|increase_position|reduce_position|no_action",
            "symbol": "AAPL",
            "reasoning": "Justification based on fundamentals",
            "confidence": 0.0-1.0,
            "urgency": "none|low|medium|high|critical",
            "time_horizon": "immediate|short_term|medium_term|long_term"
        }}
    ],
    "health_scores": [
        {{
            "symbol": "AAPL",
            "score": 0.0-1.0,
            "grade": "A|B|C|D|F",
            "strengths": ["Strong FCF", "Low debt"],
            "weaknesses": ["Slowing growth"],
            "peer_rank": "top_quartile|above_average|average|below_average|bottom_quartile"
        }}
    ]
}}

Be specific with numbers. Reference actual financial metrics in your analysis.
If data is limited, note this and adjust confidence accordingly.
"""


class FundamentalsAgent(BaseAnalysisAgent):
    """Analyzes company fundamentals and produces financial health assessments."""

    @property
    def agent_type(self) -> str:
        return "fundamentals_analyst"

    @property
    def description(self) -> str:
        return "Analyzes company financial health: ratios, growth, profitability, balance sheet, and peer comparison"

    async def analyze(self, context: dict[str, Any]) -> AgentOutput:
        """
        Analyze company fundamentals.

        Expected context:
        - symbols: list[str] — stock symbols to analyze
        - financial_data: dict — pre-fetched financial data (optional)
        - model: str — LLM model to use (default: gemini-2.5-flash)
        """
        symbols = context.get("symbols", [])
        model = context.get("model", "gemini-2.5-flash")
        financial_data = context.get("financial_data", {})

        if not symbols:
            return AgentOutput(
                agent_type=self.agent_type,
                summary="No symbols provided for fundamental analysis.",
                overall_confidence=1.0,
                overall_signal=SignalType.NEUTRAL,
            )

        # If no financial data provided, try to fetch it
        if not financial_data:
            financial_data = await self._fetch_financial_data(symbols)

        # Format financial data for the prompt
        financial_text = self._format_financial_data(symbols, financial_data)

        prompt = ANALYSIS_PROMPT.format(
            symbols=", ".join(symbols),
            financial_data=financial_text,
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
                metadata={"category": f.get("category", "general")},
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

    async def _fetch_financial_data(self, symbols: list[str]) -> dict:
        """Fetch financial data from FMP or similar API."""
        import os
        import httpx

        fmp_key = os.getenv("FMP_API_KEY", "")
        data = {}

        if not fmp_key:
            # Return placeholder structure
            for symbol in symbols:
                data[symbol] = {"note": "No FMP API key configured — using limited data"}
            return data

        async with httpx.AsyncClient(timeout=30) as client:
            for symbol in symbols:
                try:
                    # Fetch key financial ratios
                    ratios_resp = await client.get(
                        f"https://financialmodelingprep.com/api/v3/ratios/{symbol}",
                        params={"apikey": fmp_key, "limit": 4},
                    )
                    ratios = ratios_resp.json() if ratios_resp.status_code == 200 else []

                    # Fetch company profile
                    profile_resp = await client.get(
                        f"https://financialmodelingprep.com/api/v3/profile/{symbol}",
                        params={"apikey": fmp_key},
                    )
                    profile = profile_resp.json() if profile_resp.status_code == 200 else []

                    # Fetch income statement
                    income_resp = await client.get(
                        f"https://financialmodelingprep.com/api/v3/income-statement/{symbol}",
                        params={"apikey": fmp_key, "limit": 4},
                    )
                    income = income_resp.json() if income_resp.status_code == 200 else []

                    # Fetch balance sheet
                    balance_resp = await client.get(
                        f"https://financialmodelingprep.com/api/v3/balance-sheet-statement/{symbol}",
                        params={"apikey": fmp_key, "limit": 4},
                    )
                    balance = balance_resp.json() if balance_resp.status_code == 200 else []

                    data[symbol] = {
                        "profile": profile[0] if profile else {},
                        "ratios": ratios[:4] if ratios else [],
                        "income_statements": income[:4] if income else [],
                        "balance_sheets": balance[:4] if balance else [],
                    }
                except Exception as e:
                    data[symbol] = {"error": str(e)}

        return data

    def _format_financial_data(self, symbols: list[str], data: dict) -> str:
        """Format financial data into a readable text block for the LLM."""
        sections = []

        for symbol in symbols:
            symbol_data = data.get(symbol, {})

            if "error" in symbol_data:
                sections.append(f"\n=== {symbol} ===\nData fetch error: {symbol_data['error']}")
                continue

            if "note" in symbol_data:
                sections.append(f"\n=== {symbol} ===\n{symbol_data['note']}")
                continue

            lines = [f"\n=== {symbol} ==="]

            # Profile
            profile = symbol_data.get("profile", {})
            if profile:
                lines.append(f"Company: {profile.get('companyName', 'N/A')}")
                lines.append(f"Sector: {profile.get('sector', 'N/A')} | Industry: {profile.get('industry', 'N/A')}")
                lines.append(f"Market Cap: ${profile.get('mktCap', 0):,.0f}")
                lines.append(f"Price: ${profile.get('price', 0):.2f} | Beta: {profile.get('beta', 'N/A')}")
                lines.append(f"P/E: {profile.get('pe', 'N/A')} | Div Yield: {profile.get('lastDiv', 'N/A')}")

            # Key ratios (most recent)
            ratios = symbol_data.get("ratios", [])
            if ratios:
                r = ratios[0]
                lines.append(f"\nKey Ratios (Latest):")
                lines.append(f"  ROE: {r.get('returnOnEquity', 'N/A')}")
                lines.append(f"  ROA: {r.get('returnOnAssets', 'N/A')}")
                lines.append(f"  Gross Margin: {r.get('grossProfitMargin', 'N/A')}")
                lines.append(f"  Operating Margin: {r.get('operatingProfitMargin', 'N/A')}")
                lines.append(f"  Net Margin: {r.get('netProfitMargin', 'N/A')}")
                lines.append(f"  Debt/Equity: {r.get('debtEquityRatio', 'N/A')}")
                lines.append(f"  Current Ratio: {r.get('currentRatio', 'N/A')}")
                lines.append(f"  P/E: {r.get('priceEarningsRatio', 'N/A')}")
                lines.append(f"  P/B: {r.get('priceToBookRatio', 'N/A')}")
                lines.append(f"  EV/EBITDA: {r.get('enterpriseValueMultiple', 'N/A')}")
                lines.append(f"  FCF Yield: {r.get('freeCashFlowYield', 'N/A')}")

            # Revenue/earnings trend
            income = symbol_data.get("income_statements", [])
            if income:
                lines.append(f"\nRevenue Trend (last {len(income)} years):")
                for stmt in income:
                    lines.append(
                        f"  {stmt.get('date', 'N/A')}: "
                        f"Revenue ${stmt.get('revenue', 0):,.0f} | "
                        f"Net Income ${stmt.get('netIncome', 0):,.0f} | "
                        f"EPS {stmt.get('eps', 'N/A')}"
                    )

            sections.append("\n".join(lines))

        return "\n".join(sections) if sections else "No financial data available."


# Singleton instance
fundamentals_analyst = FundamentalsAgent()
