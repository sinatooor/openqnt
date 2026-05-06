"""
Earnings calendar router.

Production path: hit Polygon, FMP, or yfinance for forward earnings dates,
consensus EPS, and ATM-straddle implied moves. This stub returns an empty
list so the UI renders cleanly before the real fetcher is wired.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/earnings", tags=["earnings"])


def _stub_events(symbols: list[str]) -> list[dict[str, Any]]:
    """No upcoming reports until the real fetcher is wired."""
    return []


@router.get("/upcoming")
async def upcoming(symbols: str = Query("", description="Comma-separated tickers")) -> dict[str, Any]:
    """
    Forward earnings reports for the requested symbols, next 14 days.

    The frontend supplies the symbols list (typically the user's holdings) so
    we can keep the response small and personalized.
    """
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    events = _stub_events(syms)
    return {
        "events": events,
        "horizon_days": 14,
        "as_of": datetime.utcnow().isoformat(),
        "source": "stub",
    }


@router.get("/transcripts/{symbol}")
async def transcripts(symbol: str) -> dict[str, Any]:
    """
    Recent earnings call transcripts for a symbol.

    Plug a vendor here (e.g. Polygon's earnings transcripts endpoint) and
    return a sorted list with quarter, date, summary, and full text URLs.
    """
    return {
        "symbol": symbol.upper(),
        "transcripts": [],
        "source": "stub",
    }
