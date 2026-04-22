"""
Technical Analysis Agent — Monitors RSI, SMA, MACD on real market data.

Fetches its own price data via yfinance, computes indicators with TA-Lib,
saves an annotated chart to the run dir, then asks the LLM for an opinion.

Emits the following stream events when called with an AgentRunContext:
  status   "Fetching price data for AAPL, MSFT…"
  thought  "AAPL RSI=27 — clearly oversold."
  tool_call/tool_result   for each data fetch
  artifact "rsi_chart.png" (saved under runs/<run_id>/plots/)
  message  Final structured conclusion.
"""

from __future__ import annotations

import io
import json
import os
from typing import Any, Optional

import numpy as np
import pandas as pd
import yfinance as yf

from .base_agent import (
    BaseAnalysisAgent,
    AgentOutput,
    Finding,
    Recommendation,
    SignalType,
    ImpactLevel,
    ActionType,
)


TECHNICAL_PROMPT = """You are an expert technical analyst. Analyze the following indicator data for the user's portfolio and produce actionable signals.

PORTFOLIO SYMBOLS: {symbols}

TECHNICAL DATA:
{technical_data}

USER THRESHOLDS:
{thresholds}

ANALYSIS RULES:
- RSI<30 oversold (potential buy), RSI>70 overbought (potential sell).
- Price > SMA200 = bullish trend, price < SMA200 = bearish trend.
- SMA50 crossing above SMA200 = golden cross (bullish), below = death cross (bearish).
- MACD histogram turning positive = bullish momentum, negative = bearish.

Respond strictly in this JSON format:
{{
  "summary": "2-3 sentence portfolio overview",
  "overall_signal": "bullish|bearish|neutral",
  "overall_confidence": 0.0-1.0,
  "findings": [
    {{
      "title": "...",
      "description": "...",
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
      "reasoning": "...",
      "confidence": 0.0-1.0,
      "urgency": "none|low|medium|high|critical",
      "time_horizon": "immediate|short_term|medium_term|long_term"
    }}
  ]
}}

Only emit findings for signals that are real. No noise.
"""


def _try_talib():
    try:
        import talib  # noqa: F401
        return True
    except Exception:
        return False


def _rsi(closes: pd.Series, period: int = 14) -> pd.Series:
    if _try_talib():
        import talib
        return pd.Series(talib.RSI(closes.values, timeperiod=period), index=closes.index)
    delta = closes.diff()
    gain = delta.where(delta > 0, 0.0).rolling(period).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - 100 / (1 + rs)


def _sma(closes: pd.Series, period: int) -> pd.Series:
    return closes.rolling(period).mean()


def _macd(closes: pd.Series) -> tuple[pd.Series, pd.Series, pd.Series]:
    if _try_talib():
        import talib
        m, s, h = talib.MACD(closes.values, fastperiod=12, slowperiod=26, signalperiod=9)
        idx = closes.index
        return pd.Series(m, index=idx), pd.Series(s, index=idx), pd.Series(h, index=idx)
    ema12 = closes.ewm(span=12, adjust=False).mean()
    ema26 = closes.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    return macd, signal, macd - signal


class TechnicalAnalysisAgent(BaseAnalysisAgent):
    """Monitors RSI, SMA, MACD on the symbols supplied in `context['symbols']`.

    Auto-fetches OHLCV via yfinance when no `technical_data` is pre-supplied.
    """

    @property
    def agent_type(self) -> str:
        return "technical_analyst"

    @property
    def description(self) -> str:
        return "Monitors RSI, SMA, MACD, and other technical indicators for portfolio symbols"

    # ── data fetching ────────────────────────────────────────────

    def _fetch_indicators(self, symbol: str, period: str = "6mo", interval: str = "1d") -> dict[str, Any] | None:
        try:
            df = yf.Ticker(symbol).history(period=period, interval=interval)
        except Exception:
            return None
        if df is None or df.empty:
            return None
        closes = df["Close"]
        if len(closes) < 50:
            return None
        rsi = _rsi(closes, 14)
        sma50 = _sma(closes, 50)
        sma200 = _sma(closes, 200) if len(closes) >= 200 else pd.Series([np.nan] * len(closes), index=closes.index)
        macd, signal, hist = _macd(closes)

        last = -1
        return {
            "_df": df,
            "_closes": closes,
            "_rsi": rsi,
            "_sma50": sma50,
            "_sma200": sma200,
            "_macd": macd,
            "_macd_signal": signal,
            "_macd_hist": hist,
            "rsi_14": float(rsi.iloc[last]) if not np.isnan(rsi.iloc[last]) else None,
            "sma_50": float(sma50.iloc[last]) if not np.isnan(sma50.iloc[last]) else None,
            "sma_200": float(sma200.iloc[last]) if not np.isnan(sma200.iloc[last]) else None,
            "close": float(closes.iloc[last]),
            "macd_hist": float(hist.iloc[last]) if not np.isnan(hist.iloc[last]) else None,
            "vs_sma50_pct": (float(closes.iloc[last] / sma50.iloc[last] - 1) * 100) if not np.isnan(sma50.iloc[last]) else None,
            "vs_sma200_pct": (float(closes.iloc[last] / sma200.iloc[last] - 1) * 100) if not np.isnan(sma200.iloc[last]) else None,
        }

    def _save_chart(self, ctx, symbol: str, ind: dict[str, Any]) -> None:
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
        except Exception:
            return
        closes = ind["_closes"]
        rsi = ind["_rsi"]
        sma50 = ind["_sma50"]
        sma200 = ind["_sma200"]

        fig, (ax1, ax2) = plt.subplots(
            2, 1, figsize=(10, 6), sharex=True, gridspec_kw={"height_ratios": [3, 1]}
        )
        ax1.plot(closes.index, closes.values, label="Close", color="#0ea5e9", lw=1.2)
        ax1.plot(sma50.index, sma50.values, label="SMA50", color="#a78bfa", lw=1.0)
        if sma200.notna().any():
            ax1.plot(sma200.index, sma200.values, label="SMA200", color="#f97316", lw=1.0)
        ax1.set_title(f"{symbol} — Price + SMA")
        ax1.legend(loc="upper left", fontsize=8)
        ax1.grid(alpha=0.2)

        ax2.plot(rsi.index, rsi.values, color="#22c55e", lw=1.0)
        ax2.axhline(70, color="#ef4444", lw=0.5, ls="--")
        ax2.axhline(30, color="#22c55e", lw=0.5, ls="--")
        ax2.set_ylim(0, 100)
        ax2.set_ylabel("RSI(14)")
        ax2.grid(alpha=0.2)
        fig.tight_layout()

        ctx.save_plot(fig, f"{symbol}_technical.png", caption=f"{symbol} price/SMA + RSI(14)")
        plt.close(fig)

    # ── analyze ──────────────────────────────────────────────────

    async def analyze(self, context: dict[str, Any], ctx: Optional[Any] = None) -> AgentOutput:
        symbols: list[str] = list(context.get("symbols") or [])
        thresholds: dict[str, Any] = context.get("thresholds") or {}
        model = context.get("model", "gemini-2.5-flash")
        pre_supplied = context.get("technical_data") or {}

        if not symbols and not pre_supplied:
            if ctx:
                ctx.status("No symbols supplied — nothing to do.")
            return AgentOutput(
                agent_type=self.agent_type,
                summary="No symbols supplied. Pass `symbols: [...]` in the context.",
                overall_confidence=0.0,
                overall_signal=SignalType.NEUTRAL,
            )

        # ── 1. Fetch indicators per symbol ──────────────────────
        if ctx:
            ctx.status(f"Fetching daily bars + computing RSI/SMA/MACD for {len(symbols)} symbol(s).")

        technical_data: dict[str, dict[str, Any]] = {}
        for sym in symbols:
            if sym in pre_supplied:
                technical_data[sym] = pre_supplied[sym]
                if ctx:
                    ctx.thought(f"Using pre-supplied technical data for {sym}.")
                continue

            ind: dict[str, Any] | None = None
            if ctx:
                with ctx.tool_call("market_data.history", {"symbol": sym, "period": "6mo", "interval": "1d"}) as h:
                    ind = self._fetch_indicators(sym)
                    if ind is None:
                        h.result(f"No data for {sym}", status="error")
                    else:
                        h.result(
                            f"{len(ind['_closes'])} bars · close={ind['close']:.2f} · RSI={ind['rsi_14']:.1f} "
                            f"· vs SMA50={ind['vs_sma50_pct']:+.2f}%"
                        )
            else:
                ind = self._fetch_indicators(sym)

            if ind is None:
                continue
            technical_data[sym] = ind

            # Save a chart artifact.
            if ctx:
                self._save_chart(ctx, sym, ind)

            # In-line reasoning for the user to read on the timeline.
            if ctx:
                rsi_v = ind["rsi_14"] or 0.0
                if rsi_v < 30:
                    ctx.thought(f"{sym} RSI={rsi_v:.1f} — oversold, watch for a bounce.")
                elif rsi_v > 70:
                    ctx.thought(f"{sym} RSI={rsi_v:.1f} — overbought, mean-reversion risk.")
                else:
                    ctx.thought(f"{sym} RSI={rsi_v:.1f} — neutral zone.")

        if not technical_data:
            if ctx:
                ctx.error_event("Could not fetch indicator data for any symbol.")
            return AgentOutput(
                agent_type=self.agent_type,
                summary="Failed to fetch indicator data for any symbol. Check ticker validity / network.",
                overall_confidence=0.0,
                overall_signal=SignalType.NEUTRAL,
                error="data_fetch_failed",
            )

        # ── 2. Persist a tidy data artifact ────────────────────
        if ctx:
            slim = {sym: {k: v for k, v in d.items() if not k.startswith("_")} for sym, d in technical_data.items()}
            ctx.save_json("indicators.json", slim, caption="Computed indicator snapshot per symbol")

        # ── 3. Ask the LLM for a structured opinion ────────────
        from google import genai

        tech_text = ""
        for sym, data in technical_data.items():
            tech_text += f"\n{sym}:\n"
            for k, v in data.items():
                if k.startswith("_"):
                    continue
                if isinstance(v, float):
                    tech_text += f"  {k}: {v:.4f}\n"
                else:
                    tech_text += f"  {k}: {v}\n"

        threshold_text = "Default thresholds (RSI: buy<30, sell>70)"
        if thresholds:
            threshold_text = "\n".join(f"  {k}: {v}" for k, v in thresholds.items())

        prompt = TECHNICAL_PROMPT.format(
            symbols=", ".join(symbols),
            technical_data=tech_text,
            thresholds=threshold_text,
        )

        if ctx:
            ctx.status(f"Calling LLM ({model}) for synthesis…")

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            err = "GEMINI_API_KEY not set in env (backend/.env). Cannot synthesize."
            if ctx:
                ctx.error_event(err)
            return AgentOutput(
                agent_type=self.agent_type,
                summary=err,
                error="no_llm_key",
            )

        client = genai.Client(api_key=api_key)
        if ctx:
            with ctx.tool_call("llm.generate", {"model": model, "prompt_chars": len(prompt)}) as h:
                response = await client.aio.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=genai.types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.2,
                    ),
                )
                tokens = 0
                if response.usage_metadata:
                    tokens = (response.usage_metadata.prompt_token_count or 0) + (
                        response.usage_metadata.candidates_token_count or 0
                    )
                ctx.add_tokens(tokens)
                h.result(f"{tokens} tokens · {len(response.text or '')} chars")
        else:
            response = await client.aio.models.generate_content(
                model=model,
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    response_mime_type="application/json", temperature=0.2,
                ),
            )

        try:
            result = json.loads(response.text or "{}")
        except json.JSONDecodeError:
            err = f"LLM did not return valid JSON: {(response.text or '')[:300]}"
            if ctx:
                ctx.error_event(err)
            return AgentOutput(agent_type=self.agent_type, error=err)

        # ── 4. Map LLM JSON → AgentOutput ──────────────────────
        findings = []
        for f in result.get("findings", []) or []:
            try:
                findings.append(Finding(
                    title=f.get("title", ""),
                    description=f.get("description", ""),
                    signal=SignalType(f.get("signal", "neutral")),
                    impact=ImpactLevel(f.get("impact", "none")),
                    confidence=float(f.get("confidence", 0.5)),
                    symbols=f.get("symbols", []),
                    metadata={"indicator": f.get("indicator", "unknown")},
                ))
            except Exception:
                continue

        recommendations = []
        for r in result.get("recommendations", []) or []:
            try:
                recommendations.append(Recommendation(
                    action=ActionType(r.get("action", "no_action")),
                    symbol=r.get("symbol", ""),
                    reasoning=r.get("reasoning", ""),
                    confidence=float(r.get("confidence", 0.5)),
                    urgency=ImpactLevel(r.get("urgency", "low")),
                    time_horizon=r.get("time_horizon", "short_term"),
                ))
            except Exception:
                continue

        summary = result.get("summary", "")
        signal = SignalType(result.get("overall_signal", "neutral"))
        confidence = float(result.get("overall_confidence", 0.5))

        if ctx:
            ctx.message(f"**Conclusion:** {signal.value.upper()} (confidence {confidence:.0%}). {summary}")

        return AgentOutput(
            agent_type=self.agent_type,
            findings=findings,
            recommendations=recommendations,
            summary=summary,
            overall_confidence=confidence,
            overall_signal=signal,
            tokens_used=ctx.tokens if ctx else 0,
        )


# Singleton
technical_analyst = TechnicalAnalysisAgent()
