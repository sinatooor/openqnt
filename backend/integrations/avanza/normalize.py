"""
Translate Avanza `_api` payloads into the same JSON shapes the Terminal
backend already serves. Every function here is best-effort: when a field
is missing in the source we leave the destination field as None so the
existing fallback chain can fill it from a different provider.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# DES — Company description
# ---------------------------------------------------------------------------

def des_from_avanza(
    ticker: str,
    market_guide: Dict[str, Any],
    details: Optional[Dict[str, Any]] = None,
    key_ratios: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Project Avanza market-guide / details / key-ratios into the DES shape."""
    info = market_guide or {}
    listing = info.get("listing") or {}
    quote = info.get("quote") or {}
    company = (details or {}).get("company") or {}
    description = (
        (details or {}).get("companyDescription")
        or company.get("description")
        or ""
    )

    center = {
        "ticker": ticker,
        "name": info.get("name") or company.get("name") or ticker,
        "legalName": info.get("name") or company.get("name") or ticker,
        "founded": company.get("foundedYear"),
        "incorporation": info.get("country") or company.get("country"),
        "hqCity": company.get("city"),
        "hqCountry": company.get("country") or info.get("country"),
        "employees": company.get("employees"),
        "website": company.get("homePage") or company.get("website"),
        "phone": company.get("phone"),
        "exchange": listing.get("marketPlace") or info.get("marketplace"),
        "currency": listing.get("currency") or info.get("currency"),
        "listingDate": company.get("listingDate"),
        "fiscalYearEnd": company.get("fiscalYearEnd"),
        "isin": info.get("isin"),
        "cusip": None,
        "sedol": None,
        "bbgid": None,
        "figi": None,
        "gicsSector": info.get("sector") or company.get("sector"),
        "gicsIndustry": info.get("subSector") or info.get("industry") or company.get("industry"),
        "naicsCode": None,
        "description": description,
    }

    last_price = _num(quote.get("last") or info.get("lastPrice"))
    prev_close = _num(info.get("previousClosingPrice") or quote.get("previousClose"))
    indicators = info.get("keyIndicators") or {}

    valuation = {
        "price": last_price,
        "prevClose": prev_close,
        "change": (
            (last_price - prev_close) if (last_price is not None and prev_close is not None) else None
        ),
        "changePct": ((last_price - prev_close) / prev_close * 100) if (last_price and prev_close) else None,
        "marketCapB": _to_billion(indicators.get("marketCapital") or info.get("marketCapital")),
        "enterpriseValueB": None,
        "sharesOutM": _to_million(indicators.get("numberOfSharesIssued")),
        "floatM": None,
        "shortInterestPct": None,
        "pe": _num(indicators.get("priceEarningsRatio")),
        "peFwd": None,
        "pbRatio": _num(indicators.get("priceBookRatio")),
        "psRatio": None,
        "evEbitda": None,
        "divYieldPct": _num(indicators.get("directYield")),
        "payoutRatioPct": None,
        "divPerShare": _num(indicators.get("dividend")),
        "w52High": _num(info.get("fiftyTwoWeekHigh") or indicators.get("fiftyTwoWeekHigh")),
        "w52Low": _num(info.get("fiftyTwoWeekLow") or indicators.get("fiftyTwoWeekLow")),
        "beta": _num(indicators.get("beta")),
    }

    financials = _financials_from_key_ratios(key_ratios)

    return {
        "source": "avanza",
        "data": {
            "center": center,
            "executives": _executives_from_details(details),
            "financials": financials,
            "valuation": valuation,
            "highlights": [],
            "segments": [],
        },
    }


# ---------------------------------------------------------------------------
# GIP — intraday chart (or daily)
# ---------------------------------------------------------------------------

def gip_from_price_chart(
    ticker: str,
    chart: Dict[str, Any],
) -> Dict[str, Any]:
    ohlc = chart.get("ohlc") or []
    bars = []
    for row in ohlc:
        ts = row.get("timestamp")
        if ts is None:
            continue
        bars.append({
            "t": int(ts // 1000) if ts > 1e12 else int(ts),
            "o": _num(row.get("open")),
            "h": _num(row.get("high")),
            "l": _num(row.get("low")),
            "c": _num(row.get("close")),
            "v": _num(row.get("totalVolumeTraded")),
        })
    return {
        "source": "avanza",
        "data": {
            "ticker": ticker,
            "interval": chart.get("metadata", {}).get("resolution", {}).get("chartResolution"),
            "bars": bars,
            "previousClose": _num(chart.get("previousClosingPrice")),
            "from": chart.get("from"),
            "to": chart.get("to"),
        },
    }


# ---------------------------------------------------------------------------
# News
# ---------------------------------------------------------------------------

def news_from_avanza(orderbook_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    items = payload.get("items") or payload.get("articles") or []
    out: List[Dict[str, Any]] = []
    for item in items[:50]:
        out.append({
            "id": item.get("id") or item.get("articleId"),
            "headline": item.get("headline") or item.get("title"),
            "summary": item.get("summary") or item.get("preamble"),
            "source": item.get("source") or "AVANZA",
            "timestamp": item.get("timestamp") or item.get("publishedDate"),
            "url": item.get("url") or item.get("articleUrl"),
        })
    return {
        "source": "avanza",
        "data": {"orderbookId": orderbook_id, "items": out},
    }


# ---------------------------------------------------------------------------
# Watchlists
# ---------------------------------------------------------------------------

def watchlists_from_avanza(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, dict):
        lists = payload.get("watchlists") or payload.get("data") or []
    elif isinstance(payload, list):
        lists = payload
    else:
        lists = []
    out: List[Dict[str, Any]] = []
    for w in lists:
        if not isinstance(w, dict):
            continue
        out.append({
            "id": str(w.get("id") or w.get("watchlistId") or ""),
            "name": w.get("name") or "Watchlist",
            "orderbook_ids": [str(x) for x in (w.get("orderbookIds") or w.get("orderbooks") or [])],
        })
    return out


# ---------------------------------------------------------------------------
# Positions
# ---------------------------------------------------------------------------

def positions_from_avanza(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    sources: List[Dict[str, Any]] = []
    if isinstance(payload, dict):
        # Newer endpoint groups by instrumentType
        for group in payload.get("instrumentPositions", []) or []:
            for p in group.get("positions", []) or []:
                sources.append(p)
        # Or flat list under 'positions'
        for p in payload.get("positions", []) or []:
            sources.append(p)
        # Or grouped categorisation under 'withOrderbook'
        for p in payload.get("withOrderbook", []) or []:
            sources.append(p)

    for p in sources:
        ob = p.get("orderbook") or {}
        rows.append({
            "account_id": str(p.get("accountId") or p.get("account", {}).get("id") or ""),
            "orderbook_id": str(ob.get("id") or p.get("orderbookId") or ""),
            "symbol": ob.get("tickerSymbol") or p.get("tickerSymbol"),
            "name": ob.get("name") or p.get("name"),
            "quantity": _num(p.get("volume") or p.get("quantity")),
            "average_price": _num(p.get("averageAcquiredPrice") or p.get("averagePrice")),
            "last_price": _num(p.get("lastPrice") or ob.get("lastPrice")),
            "market_value": _num(p.get("value") or p.get("marketValue")),
            "currency": ob.get("currency") or p.get("currency"),
            "raw": p,
        })
    return rows


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _financials_from_key_ratios(kr: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not kr:
        return {
            "revenueTtmB": None, "revenueGrowthYoyPct": None,
            "ebitdaTtmB": None, "ebitdaMarginPct": None,
            "grossMarginPct": None, "operatingMarginPct": None,
            "netIncomeTtmB": None, "netMarginPct": None,
            "fcfTtmB": None, "capexTtmB": None,
            "cashAndStB": None, "totalDebtB": None, "netDebtB": None,
            "roePct": None, "roaPct": None, "roicPct": None,
        }
    by_year = kr.get("companyFinancialsByYear") or {}
    rd = kr.get("dividendsByYear") or {}
    ratios = kr.get("companyKeyRatiosByYear") or {}

    return {
        "revenueTtmB": _latest_value_billion(by_year.get("sales")),
        "revenueGrowthYoyPct": None,
        "ebitdaTtmB": _latest_value_billion(by_year.get("ebitda")),
        "ebitdaMarginPct": _latest_value(by_year.get("ebitdaMargin")),
        "grossMarginPct": _latest_value(by_year.get("grossMargin")),
        "operatingMarginPct": _latest_value(by_year.get("operatingMargin")),
        "netIncomeTtmB": _latest_value_billion(by_year.get("netProfit")),
        "netMarginPct": _latest_value(by_year.get("profitMargin")),
        "fcfTtmB": _latest_value_billion(by_year.get("freeCashFlow")),
        "capexTtmB": _latest_value_billion(by_year.get("capex")),
        "cashAndStB": None,
        "totalDebtB": _latest_value_billion(by_year.get("totalLiabilities")),
        "netDebtB": _latest_value_billion(by_year.get("netDebt")),
        "roePct": _latest_value(ratios.get("returnOnEquityRatio")),
        "roaPct": _latest_value(ratios.get("returnOnAssetsRatio")),
        "roicPct": None,
        "dividendPayoutRatioPct": _latest_value(rd.get("dividendPayoutRatio")),
    }


def _executives_from_details(details: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not details:
        return []
    board = details.get("boardMembers") or []
    out: List[Dict[str, Any]] = []
    for m in board[:10]:
        out.append({
            "name": m.get("name"),
            "title": m.get("title") or m.get("role"),
            "since": m.get("memberSince"),
            "ageYrs": m.get("age"),
            "totalPay": None,
        })
    return out


def _latest_value(series: Any) -> Optional[float]:
    if not isinstance(series, list) or not series:
        return None
    actual = [x for x in series if isinstance(x, dict) and not x.get("onlyEstimate")]
    candidates = actual or series
    last = candidates[-1]
    if not isinstance(last, dict):
        return None
    return _num(last.get("value")) if last.get("value") is not None else _num(last.get("estimate"))


def _latest_value_billion(series: Any) -> Optional[float]:
    v = _latest_value(series)
    return _to_billion(v)


def _num(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _to_billion(v: Any) -> Optional[float]:
    n = _num(v)
    return None if n is None else n / 1_000_000_000


def _to_million(v: Any) -> Optional[float]:
    n = _num(v)
    return None if n is None else n / 1_000_000
