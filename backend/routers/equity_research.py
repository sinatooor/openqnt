"""
Equity research — DCF valuation, fundamentals snapshot, and ad-hoc case
study generation.

Endpoints
- POST /equity-research/dcf
    Two-stage growth DCF. Pure math, no external data, deterministic.
    Returns intrinsic value, NPV breakdown, terminal value, and a
    discount-rate × terminal-growth sensitivity matrix.

- POST /equity-research/fundamentals
    Snapshot of headline fundamentals for a ticker, sourced from yfinance.
    No LLM call — just a structured view of the publicly available data.

- POST /equity-research/case
    LLM-written equity research note (bull / bear / base) for a ticker,
    grounded in the fundamentals payload above. Uses whichever provider
    is configured as PRIMARY_LLM in main.py.

The bigger ADK FundamentalsAgent at backend/adk_agents/fundamentals_agent.py
is intentionally NOT wired up here — it's a multi-step LLM workflow that
deserves its own thin client. This router serves the "give me numbers
fast" use case the Research page needs.
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any, AsyncIterator, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


router = APIRouter(prefix="/equity-research", tags=["equity-research"])


# ─────────────────────────────────────────────────────────────────────────────
# DCF — deterministic two-stage growth model
# ─────────────────────────────────────────────────────────────────────────────

class DcfRequest(BaseModel):
    ticker: str = Field(..., description="Ticker symbol, for labelling only.")
    fcf_base: float = Field(..., description="Latest annual free cash flow (USD).")
    growth_y1_5: float = Field(0.10, description="Stage-1 FCF growth rate (years 1–5), e.g. 0.10 = 10%.")
    growth_y6_10: float = Field(0.05, description="Stage-2 FCF growth rate (years 6–10).")
    terminal_growth: float = Field(0.025, description="Perpetual growth past year 10 (Gordon).")
    discount_rate: float = Field(0.09, description="WACC / required rate of return.")
    shares_out: float = Field(..., description="Diluted shares outstanding.")
    net_debt: float = Field(0.0, description="Total debt minus cash. Subtracted from enterprise value.")


class DcfYearlyRow(BaseModel):
    year: int
    fcf: float
    pv: float


class DcfResponse(BaseModel):
    ticker: str
    intrinsic_value_per_share: float
    enterprise_value: float
    equity_value: float
    npv_explicit: float
    terminal_value: float
    terminal_value_pv: float
    yearly: List[DcfYearlyRow]
    sensitivity: Dict[str, Any]
    inputs: Dict[str, Any]
    summary: str


def _two_stage_dcf(
    fcf_base: float,
    g1: float,
    g2: float,
    g_terminal: float,
    discount: float,
    shares_out: float,
    net_debt: float,
) -> Dict[str, Any]:
    """Return the components of a two-stage DCF."""
    if discount <= g_terminal:
        raise HTTPException(
            status_code=400,
            detail="Discount rate must exceed terminal growth rate for the Gordon model to converge.",
        )

    yearly: List[Dict[str, float]] = []
    fcf = fcf_base
    npv_explicit = 0.0
    for year in range(1, 11):
        growth = g1 if year <= 5 else g2
        fcf = fcf * (1.0 + growth)
        pv = fcf / ((1.0 + discount) ** year)
        npv_explicit += pv
        yearly.append({"year": year, "fcf": fcf, "pv": pv})

    # Terminal value at end of year 10, discounted back to today.
    fcf_year11 = fcf * (1.0 + g_terminal)
    terminal_value = fcf_year11 / (discount - g_terminal)
    terminal_value_pv = terminal_value / ((1.0 + discount) ** 10)

    enterprise_value = npv_explicit + terminal_value_pv
    equity_value = enterprise_value - net_debt
    per_share = equity_value / shares_out if shares_out > 0 else 0.0

    return {
        "yearly": yearly,
        "npv_explicit": npv_explicit,
        "terminal_value": terminal_value,
        "terminal_value_pv": terminal_value_pv,
        "enterprise_value": enterprise_value,
        "equity_value": equity_value,
        "intrinsic_value_per_share": per_share,
    }


def _sensitivity_grid(req: DcfRequest) -> Dict[str, Any]:
    """5×5 grid varying discount rate and terminal growth around the request."""
    discount_steps = [req.discount_rate + d for d in (-0.02, -0.01, 0.0, 0.01, 0.02)]
    terminal_steps = [req.terminal_growth + d for d in (-0.01, -0.005, 0.0, 0.005, 0.01)]
    rows: List[List[float]] = []
    for d in discount_steps:
        row: List[float] = []
        for tg in terminal_steps:
            if d <= tg:
                row.append(float("nan"))
                continue
            try:
                r = _two_stage_dcf(
                    req.fcf_base, req.growth_y1_5, req.growth_y6_10,
                    tg, d, req.shares_out, req.net_debt,
                )
                row.append(r["intrinsic_value_per_share"])
            except HTTPException:
                row.append(float("nan"))
        rows.append(row)
    return {
        "discount_rates": discount_steps,
        "terminal_growths": terminal_steps,
        "values": rows,
    }


@router.post("/dcf", response_model=DcfResponse)
async def dcf(req: DcfRequest) -> DcfResponse:
    if req.fcf_base <= 0:
        raise HTTPException(400, "fcf_base must be positive.")
    if req.shares_out <= 0:
        raise HTTPException(400, "shares_out must be positive.")

    core = _two_stage_dcf(
        req.fcf_base, req.growth_y1_5, req.growth_y6_10,
        req.terminal_growth, req.discount_rate, req.shares_out, req.net_debt,
    )
    sens = _sensitivity_grid(req)

    summary = (
        f"At a {req.discount_rate * 100:.1f}% discount rate and {req.terminal_growth * 100:.2f}% "
        f"terminal growth, {req.ticker} has an intrinsic value of "
        f"${core['intrinsic_value_per_share']:.2f}/share. "
        f"Terminal value accounts for {(core['terminal_value_pv'] / core['enterprise_value']) * 100:.0f}% "
        f"of enterprise value."
    )

    return DcfResponse(
        ticker=req.ticker.upper(),
        intrinsic_value_per_share=core["intrinsic_value_per_share"],
        enterprise_value=core["enterprise_value"],
        equity_value=core["equity_value"],
        npv_explicit=core["npv_explicit"],
        terminal_value=core["terminal_value"],
        terminal_value_pv=core["terminal_value_pv"],
        yearly=[DcfYearlyRow(**r) for r in core["yearly"]],
        sensitivity=sens,
        inputs=req.model_dump(),
        summary=summary,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Fundamentals snapshot — yfinance pass-through
# ─────────────────────────────────────────────────────────────────────────────

class FundamentalsRequest(BaseModel):
    ticker: str


def _yfinance():
    """Lazy import — yfinance is heavy and may be absent in some envs."""
    try:
        import yfinance as yf
        return yf
    except Exception:
        return None


@router.post("/fundamentals")
async def fundamentals(req: FundamentalsRequest) -> Dict[str, Any]:
    yf = _yfinance()
    if yf is None:
        raise HTTPException(503, "yfinance unavailable")

    t = req.ticker.upper().strip()
    if not t:
        raise HTTPException(400, "Ticker is required")

    try:
        tk = yf.Ticker(t)
        info = tk.info or {}
    except Exception as e:
        raise HTTPException(502, f"yfinance fetch failed: {e}")

    def _g(*keys, default=None):
        for k in keys:
            v = info.get(k)
            if v is not None:
                return v
        return default

    return {
        "ticker": t,
        "name": _g("longName", "shortName"),
        "sector": _g("sector"),
        "industry": _g("industry"),
        "price": _g("currentPrice", "regularMarketPrice"),
        "market_cap": _g("marketCap"),
        "enterprise_value": _g("enterpriseValue"),
        "shares_outstanding": _g("sharesOutstanding"),
        "valuation": {
            "pe_trailing": _g("trailingPE"),
            "pe_forward": _g("forwardPE"),
            "peg": _g("pegRatio"),
            "price_to_book": _g("priceToBook"),
            "price_to_sales_ttm": _g("priceToSalesTrailing12Months"),
            "ev_to_ebitda": _g("enterpriseToEbitda"),
            "ev_to_revenue": _g("enterpriseToRevenue"),
        },
        "profitability": {
            "profit_margin": _g("profitMargins"),
            "operating_margin": _g("operatingMargins"),
            "gross_margin": _g("grossMargins"),
            "roe": _g("returnOnEquity"),
            "roa": _g("returnOnAssets"),
        },
        "growth": {
            "revenue_growth": _g("revenueGrowth"),
            "earnings_growth": _g("earningsGrowth"),
            "earnings_quarterly_growth": _g("earningsQuarterlyGrowth"),
        },
        "balance_sheet": {
            "total_cash": _g("totalCash"),
            "total_debt": _g("totalDebt"),
            "debt_to_equity": _g("debtToEquity"),
            "current_ratio": _g("currentRatio"),
            "quick_ratio": _g("quickRatio"),
            "book_value": _g("bookValue"),
        },
        "cash_flow": {
            "operating_cashflow": _g("operatingCashflow"),
            "free_cashflow": _g("freeCashflow"),
        },
        "dividend": {
            "yield": _g("dividendYield"),
            "rate": _g("dividendRate"),
            "payout_ratio": _g("payoutRatio"),
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Equity research case — LLM-written bull/bear/base, grounded in fundamentals
# ─────────────────────────────────────────────────────────────────────────────

class CaseRequest(BaseModel):
    ticker: str
    extra_prompt: Optional[str] = Field(
        None,
        description="Optional user-supplied focus (e.g. 'focus on AI exposure').",
    )


CASE_SYSTEM_PROMPT = (
    "You are a senior equity research analyst writing for an institutional "
    "audience. You read like an experienced PM — concise, opinionated, "
    "specific with numbers. You do not hedge with disclaimers. You do not "
    "say 'do your own research' or 'consult a financial advisor'. You "
    "structure every note the same way: Bull case, Bear case, Base case, "
    "Catalysts to watch."
)


def _build_case_prompt(
    ticker: str,
    f: Dict[str, Any],
    extra: Optional[str],
) -> str:
    name = f.get("name") or ticker
    val = f.get("valuation", {}) or {}
    prof = f.get("profitability", {}) or {}
    growth = f.get("growth", {}) or {}
    bs = f.get("balance_sheet", {}) or {}
    cf = f.get("cash_flow", {}) or {}
    div = f.get("dividend", {}) or {}

    def fmt(v: Any, suffix: str = "") -> str:
        return f"{v}{suffix}" if v is not None else "n/a"

    body = [
        f"Write an equity research note for {name} ({ticker.upper()}).",
        "",
        "## Snapshot",
        f"- Sector: {f.get('sector') or 'n/a'} · Industry: {f.get('industry') or 'n/a'}",
        f"- Price: {fmt(f.get('price'))} · Market cap: {fmt(f.get('market_cap'))}",
        f"- Enterprise value: {fmt(f.get('enterprise_value'))} · Shares out: {fmt(f.get('shares_outstanding'))}",
        "",
        "## Valuation",
        f"- P/E trailing: {fmt(val.get('pe_trailing'))} · P/E forward: {fmt(val.get('pe_forward'))} · PEG: {fmt(val.get('peg'))}",
        f"- P/B: {fmt(val.get('price_to_book'))} · P/S (TTM): {fmt(val.get('price_to_sales_ttm'))}",
        f"- EV/EBITDA: {fmt(val.get('ev_to_ebitda'))} · EV/Revenue: {fmt(val.get('ev_to_revenue'))}",
        "",
        "## Profitability",
        f"- Gross margin: {fmt(prof.get('gross_margin'))} · Operating margin: {fmt(prof.get('operating_margin'))} · Net margin: {fmt(prof.get('profit_margin'))}",
        f"- ROE: {fmt(prof.get('roe'))} · ROA: {fmt(prof.get('roa'))}",
        "",
        "## Growth",
        f"- Revenue growth: {fmt(growth.get('revenue_growth'))} · Earnings growth: {fmt(growth.get('earnings_growth'))} · Q EPS growth: {fmt(growth.get('earnings_quarterly_growth'))}",
        "",
        "## Balance sheet & cash flow",
        f"- Cash: {fmt(bs.get('total_cash'))} · Debt: {fmt(bs.get('total_debt'))} · D/E: {fmt(bs.get('debt_to_equity'))}",
        f"- Current ratio: {fmt(bs.get('current_ratio'))} · Quick ratio: {fmt(bs.get('quick_ratio'))} · Book value: {fmt(bs.get('book_value'))}",
        f"- Operating CF: {fmt(cf.get('operating_cashflow'))} · Free CF: {fmt(cf.get('free_cashflow'))}",
        f"- Dividend yield: {fmt(div.get('yield'))} · Payout ratio: {fmt(div.get('payout_ratio'))}",
    ]
    if extra:
        body += ["", f"## User focus", extra]

    body += [
        "",
        "Now write the note. Use markdown with exactly these four H2 sections in this order:",
        "## Bull case",
        "## Bear case",
        "## Base case",
        "## Catalysts to watch",
        "",
        "Be specific. Reference the numbers above. 2–3 paragraphs per section for bull/bear; "
        "1–2 for base; 4–6 bullet points for catalysts.",
    ]
    return "\n".join(body)


async def _generate_case_text(prompt: str) -> str:
    """Call the configured LLM (PRIMARY_LLM in main.py) for a case note.

    Lazy-imports from main.py to avoid a circular module-load cycle — by the
    time this function executes, main.py has finished initialising.
    """
    # main.py exposes call_gemini / call_deepseek / PRIMARY_LLM.
    from main import call_gemini, call_deepseek, PRIMARY_LLM  # type: ignore

    messages = [
        {"role": "system", "content": CASE_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]
    try:
        if PRIMARY_LLM == "gemini":
            return await call_gemini(messages, temperature=0.4)
        return await call_deepseek(messages, temperature=0.4)
    except HTTPException as e:
        # Surface provider config errors verbatim ("ANTHROPIC_API_KEY not
        # configured", etc.) so the frontend can show actionable copy.
        raise e
    except Exception as e:
        raise HTTPException(502, f"LLM call failed: {e}")


@router.post("/case")
async def case(req: CaseRequest) -> Dict[str, Any]:
    """
    Non-streaming equity research note. Returns the full LLM text in a single
    response. Use `/case/stream` for SSE-style token-by-token rendering.
    """
    f = await fundamentals(FundamentalsRequest(ticker=req.ticker))
    name = f.get("name") or req.ticker.upper()
    prompt = _build_case_prompt(req.ticker, f, req.extra_prompt)
    text = await _generate_case_text(prompt)
    return {
        "ticker": req.ticker.upper(),
        "name": name,
        "text": text,
        "prompt": prompt,
        "fundamentals": f,
    }


@router.post("/case/stream")
async def case_stream(req: CaseRequest) -> StreamingResponse:
    """
    Server-Sent Events stream of an LLM-written research note.

    Event format (`data: <json>\\n\\n`):
      - {type: 'meta', ticker, name, fundamentals}  — once, before deltas
      - {type: 'delta', content: '<text chunk>'}    — repeated
      - {type: 'done'}                              — once, at the end
      - {type: 'error', message: '...'}             — on failure

    The chunking is *pseudo*-streaming today: we call the LLM non-streaming,
    then chunk the result for the typewriter feel. Switching to real
    token-level streaming requires provider-specific changes
    (`generate_content_stream` for Gemini, `stream: true` for DeepSeek) and
    can land in a follow-up without changing this SSE event shape.
    """
    # Fetch fundamentals first so the meta event has data even if the LLM
    # call later fails — the frontend can still show the snapshot table.
    f = await fundamentals(FundamentalsRequest(ticker=req.ticker))
    name = f.get("name") or req.ticker.upper()
    prompt = _build_case_prompt(req.ticker, f, req.extra_prompt)

    async def event_stream() -> AsyncIterator[str]:
        # Meta first so the client can render the header / fundamentals
        # table while it waits for the LLM.
        yield (
            "data: " + json.dumps({
                "type": "meta",
                "ticker": req.ticker.upper(),
                "name": name,
                "fundamentals": f,
                "prompt": prompt,
            }) + "\n\n"
        )

        try:
            text = await _generate_case_text(prompt)
        except HTTPException as e:
            yield (
                "data: " + json.dumps({
                    "type": "error",
                    "message": e.detail if isinstance(e.detail, str) else str(e.detail),
                }) + "\n\n"
            )
            return
        except Exception as e:
            yield "data: " + json.dumps({"type": "error", "message": str(e)}) + "\n\n"
            return

        # Pseudo-stream the full text in small chunks for a typewriter feel.
        # ~16 chars at 20ms ≈ ~50 chars/s, smooth without burning the loop.
        chunk_size = 16
        for i in range(0, len(text), chunk_size):
            yield (
                "data: "
                + json.dumps({"type": "delta", "content": text[i : i + chunk_size]})
                + "\n\n"
            )
            await asyncio.sleep(0.02)

        yield "data: " + json.dumps({"type": "done"}) + "\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable nginx response buffering
        },
    )
