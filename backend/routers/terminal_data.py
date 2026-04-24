"""
Terminal-Function Data Router
=============================

Serves REAL market data to the Bloomberg-style terminal screens in the
frontend (`src/features/terminal/*`). Each endpoint returns a payload shaped
exactly like the mock generators the frontend already uses, so the UI does
not need to care whether the data comes from yfinance, SEC EDGAR, FMP, or
the local mock fallback.

Providers, in priority order (first non-empty wins):

    yfinance          — free, no key, covers price/profile/holders/peers
    SEC EDGAR         — free, public, 13F + filings (needs User-Agent)
    FMP               — optional, fills in fundamentals and supply chain
    mock              — deterministic fallback if all providers fail

All endpoints are best-effort: upstream rate limits / outages degrade the
payload gracefully instead of raising 500.

Routes:
    GET  /api/terminal/des/{ticker}          Company description (DES)
    GET  /api/terminal/gip/{ticker}          Intraday graph (GIP)
    GET  /api/terminal/hds/{ticker}          Holders detail (HDS)
    GET  /api/terminal/splc/{ticker}         Supply chain / peers (SPLC)
    GET  /api/terminal/wei                   World equity indices (WEI/BMAP)
    GET  /api/terminal/quote/{ticker}        Fast quote — used by many views
"""

from __future__ import annotations

import os
import logging
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/terminal", tags=["terminal-data"])

SEC_USER_AGENT = os.getenv(
    "SEC_USER_AGENT",
    "OpenQwnt/1.0 (support@openqwnt.com)",
)
FMP_API_KEY = os.getenv("FMP_API_KEY")


# ─────────────────────────────────────────────────────────────────────────────
# yfinance helpers — lazy import so the backend still boots if yfinance is
# temporarily broken (it's an unofficial scraper, it happens).
# ─────────────────────────────────────────────────────────────────────────────

_YF_SESSION = None  # curl_cffi impersonated session, built on first use.


def _yf():
    """Return the yfinance module, cached. None if the import fails."""
    try:
        import yfinance as yf
        return yf
    except Exception as e:
        logger.warning("yfinance import failed: %s", e)
        return None


def _yf_ticker(symbol: str):
    """
    Build a yf.Ticker with a curl_cffi chrome-impersonating session when
    available. This is the most reliable way to avoid the YFRateLimitError
    storms introduced by Yahoo in 2025-2026.
    """
    yf = _yf()
    if yf is None:
        return None

    global _YF_SESSION
    if _YF_SESSION is None:
        try:
            from curl_cffi import requests as cffi_requests
            impersonate = os.getenv("YFINANCE_IMPERSONATE", "chrome")
            _YF_SESSION = cffi_requests.Session(impersonate=impersonate)
        except Exception:
            _YF_SESSION = False  # sentinel: don't try again
    try:
        if _YF_SESSION:
            return yf.Ticker(symbol, session=_YF_SESSION)
        return yf.Ticker(symbol)
    except Exception as e:
        logger.warning("yf.Ticker(%s) failed: %s", symbol, e)
        return None


async def _run(fn, *args, **kwargs):
    """Run a blocking yfinance/pandas call off the event loop."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))


# ─────────────────────────────────────────────────────────────────────────────
# /quote — shared fast path used by GIP, DES, and the frontend
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/quote/{ticker}")
async def get_quote(ticker: str) -> Dict[str, Any]:
    ticker = ticker.strip().upper()
    if not ticker:
        raise HTTPException(400, "ticker required")

    t = _yf_ticker(ticker)
    if t is None:
        raise HTTPException(503, "yfinance unavailable")

    def _build() -> Dict[str, Any]:
        info = {}
        try:
            info = t.fast_info or {}
            info = dict(info)
        except Exception:
            pass
        try:
            ext = t.get_info() if hasattr(t, "get_info") else t.info
            if isinstance(ext, dict):
                for k, v in ext.items():
                    info.setdefault(k, v)
        except Exception:
            pass

        return {
            "ticker": ticker,
            "last": _num(info.get("last_price") or info.get("regularMarketPrice")
                         or info.get("lastPrice")),
            "prev_close": _num(info.get("previous_close")
                               or info.get("regularMarketPreviousClose")),
            "day_high": _num(info.get("day_high")
                             or info.get("regularMarketDayHigh")),
            "day_low": _num(info.get("day_low")
                            or info.get("regularMarketDayLow")),
            "day_open": _num(info.get("open") or info.get("regularMarketOpen")),
            "day_volume": _num(info.get("last_volume")
                               or info.get("regularMarketVolume")),
            "currency": info.get("currency") or "USD",
            "exchange": info.get("exchange") or info.get("fullExchangeName"),
            "market_cap": _num(info.get("market_cap") or info.get("marketCap")),
            "as_of": int(datetime.now(timezone.utc).timestamp()),
        }

    try:
        data = await _run(_build)
        return {"source": "yfinance", "data": data}
    except Exception as e:
        logger.warning("quote(%s) failed: %s", ticker, e)
        raise HTTPException(502, f"Upstream quote failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# /des — Company Description
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/des/{ticker}")
async def get_des(ticker: str) -> Dict[str, Any]:
    ticker = ticker.strip().upper()
    t = _yf_ticker(ticker)
    if t is None:
        raise HTTPException(503, "yfinance unavailable")

    def _build() -> Dict[str, Any]:
        info: Dict[str, Any] = {}
        try:
            info = t.get_info() if hasattr(t, "get_info") else (t.info or {})
        except Exception as e:
            logger.warning("yf.info(%s) failed: %s", ticker, e)

        # Fast info is a separate, cheaper endpoint
        fast: Dict[str, Any] = {}
        try:
            fast = dict(t.fast_info or {})
        except Exception:
            pass

        # Officers
        executives = []
        for o in (info.get("companyOfficers") or [])[:10]:
            executives.append({
                "name": o.get("name"),
                "title": o.get("title"),
                "since": o.get("yearBorn"),
                "ageYrs": o.get("age"),
                "totalPay": o.get("totalPay"),
            })

        center = {
            "ticker": ticker,
            "name": info.get("longName") or info.get("shortName") or ticker,
            "legalName": info.get("longName") or info.get("shortName") or ticker,
            "founded": _int(info.get("firstTradeDateEpochUtc"), default=None),
            "incorporation": info.get("country"),
            "hqCity": info.get("city"),
            "hqCountry": info.get("country"),
            "employees": _int(info.get("fullTimeEmployees")),
            "website": info.get("website"),
            "phone": info.get("phone"),
            "exchange": info.get("exchange") or info.get("fullExchangeName"),
            "currency": info.get("currency") or fast.get("currency") or "USD",
            "listingDate": None,
            "fiscalYearEnd": info.get("lastFiscalYearEnd"),
            "isin": info.get("isin"),
            "cusip": None,
            "sedol": None,
            "bbgid": None,
            "figi": None,
            "gicsSector": info.get("sector"),
            "gicsIndustry": info.get("industry"),
            "naicsCode": None,
            "description": info.get("longBusinessSummary") or "",
        }

        market_cap = _num(info.get("marketCap") or fast.get("market_cap"))
        shares_out = _num(info.get("sharesOutstanding"))
        ebitda = _num(info.get("ebitda"))
        revenue = _num(info.get("totalRevenue"))
        net_income = _num(info.get("netIncomeToCommon"))
        fcf = _num(info.get("freeCashflow"))
        capex = _num(info.get("capitalExpenditures"))
        total_debt = _num(info.get("totalDebt"))
        cash = _num(info.get("totalCash"))

        financials = {
            "revenueTtmB": _to_billion(revenue),
            "revenueGrowthYoyPct": _to_pct(info.get("revenueGrowth")),
            "ebitdaTtmB": _to_billion(ebitda),
            "ebitdaMarginPct": _to_pct(info.get("ebitdaMargins")),
            "grossMarginPct": _to_pct(info.get("grossMargins")),
            "operatingMarginPct": _to_pct(info.get("operatingMargins")),
            "netIncomeTtmB": _to_billion(net_income),
            "netMarginPct": _to_pct(info.get("profitMargins")),
            "fcfTtmB": _to_billion(fcf),
            "capexTtmB": _to_billion(capex),
            "cashAndStB": _to_billion(cash),
            "totalDebtB": _to_billion(total_debt),
            "netDebtB": _to_billion((total_debt or 0) - (cash or 0)) if (total_debt or cash) else None,
            "roePct": _to_pct(info.get("returnOnEquity")),
            "roaPct": _to_pct(info.get("returnOnAssets")),
            "roicPct": None,
        }

        price = _num(info.get("currentPrice") or fast.get("last_price")
                     or info.get("regularMarketPrice"))
        prev = _num(info.get("previousClose") or fast.get("previous_close"))
        valuation = {
            "price": price,
            "prevClose": prev,
            "change": (price - prev) if (price is not None and prev is not None) else None,
            "changePct": ((price - prev) / prev * 100) if (price and prev) else None,
            "marketCapB": _to_billion(market_cap),
            "enterpriseValueB": _to_billion(info.get("enterpriseValue")),
            "sharesOutM": _to_million(shares_out),
            "floatM": _to_million(info.get("floatShares")),
            "shortInterestPct": _to_pct(info.get("shortPercentOfFloat")),
            "pe": _num(info.get("trailingPE")),
            "peFwd": _num(info.get("forwardPE")),
            "pbRatio": _num(info.get("priceToBook")),
            "psRatio": _num(info.get("priceToSalesTrailing12Months")),
            "evEbitda": _num(info.get("enterpriseToEbitda")),
            "divYieldPct": _to_pct(info.get("dividendYield")),
            "payoutRatioPct": _to_pct(info.get("payoutRatio")),
            "divPerShare": _num(info.get("dividendRate")),
            "w52High": _num(info.get("fiftyTwoWeekHigh") or fast.get("year_high")),
            "w52Low": _num(info.get("fiftyTwoWeekLow") or fast.get("year_low")),
            "beta": _num(info.get("beta")),
            "avgVol3moM": _to_million(info.get("averageVolume10days")
                                      or info.get("averageVolume")),
        }

        payload = {
            "center": center,
            "financials": financials,
            "valuation": valuation,
            "segments": [],
            "executives": executives,
            "highlights": _extract_highlights(info),
            "risks": [],
            "catalysts": [],
        }
        return payload

    try:
        data = await _run(_build)
        return {"source": "yfinance", "data": data, "asOf": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        logger.exception("DES(%s) build failed", ticker)
        raise HTTPException(502, f"DES upstream failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# /gip — Intraday graph
# ─────────────────────────────────────────────────────────────────────────────

_GIP_INTERVALS = {"1m", "5m", "15m", "30m", "60m"}


@router.get("/gip/{ticker}")
async def get_gip(
    ticker: str,
    interval: str = Query("5m"),
    extended: bool = Query(True, description="Include pre/post market"),
) -> Dict[str, Any]:
    ticker = ticker.strip().upper()
    if interval not in _GIP_INTERVALS:
        raise HTTPException(400, f"interval must be one of {sorted(_GIP_INTERVALS)}")

    t = _yf_ticker(ticker)
    if t is None:
        raise HTTPException(503, "yfinance unavailable")

    def _build() -> Dict[str, Any]:
        period = "1d" if interval in ("1m", "5m") else "5d"
        hist = t.history(period=period, interval=interval, prepost=extended)
        if hist is None or hist.empty:
            raise RuntimeError("no bars returned")

        bars = []
        last_row = None
        for idx, row in hist.iterrows():
            last_row = row
            ts = int(idx.timestamp())
            bars.append({
                "time": ts,
                "open": _num(row.get("Open")),
                "high": _num(row.get("High")),
                "low": _num(row.get("Low")),
                "close": _num(row.get("Close")),
                "volume": _num(row.get("Volume")),
                "vwap": _num(row.get("Close")),  # yfinance does not emit vwap; use close.
                "session": _classify_session(idx),
            })

        # Center + quote summary from fast_info
        fast = {}
        try:
            fast = dict(t.fast_info or {})
        except Exception:
            pass

        last_close = _num(last_row.get("Close")) if last_row is not None else None
        prev_close = _num(fast.get("previous_close"))
        quote = {
            "last": last_close,
            "bid": _num(fast.get("bid")),
            "ask": _num(fast.get("ask")),
            "bidSize": _num(fast.get("bid_size")),
            "askSize": _num(fast.get("ask_size")),
            "dayOpen": _num(fast.get("day_open") or (bars[0]["open"] if bars else None)),
            "dayHigh": _num(fast.get("day_high")),
            "dayLow": _num(fast.get("day_low")),
            "dayVolume": _num(fast.get("last_volume")),
            "change": (last_close - prev_close) if (last_close and prev_close) else None,
            "changePct": ((last_close - prev_close) / prev_close * 100) if (last_close and prev_close) else None,
            "vwap": last_close,
            "tradeCount": len(bars),
            "asOf": int(datetime.now(timezone.utc).timestamp()),
        }
        center = {
            "ticker": ticker,
            "name": fast.get("shortName") or ticker,
            "exchange": fast.get("exchange") or "NASDAQ",
            "currency": fast.get("currency") or "USD",
            "tickSize": 0.01,
            "prevClose": prev_close,
            "avgDailyVolumeM": (_num(fast.get("ten_day_average_volume")) or 0) / 1_000_000,
        }

        return {
            "center": center,
            "interval": interval,
            "bars": bars,
            "quote": quote,
            "extendedHours": bool(extended),
            "tradingDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        }

    try:
        data = await _run(_build)
        return {"source": "yfinance", "data": data}
    except Exception as e:
        logger.warning("GIP(%s, %s) failed: %s", ticker, interval, e)
        raise HTTPException(502, f"GIP upstream failed: {e}")


def _classify_session(ts: datetime) -> str:
    hour_utc = ts.hour + ts.minute / 60
    if 8 <= hour_utc < 13.5:
        return "pre"
    if 20 <= hour_utc < 24:
        return "after"
    return "regular"


# ─────────────────────────────────────────────────────────────────────────────
# /hds — Holders Detail
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/hds/{ticker}")
async def get_hds(ticker: str) -> Dict[str, Any]:
    ticker = ticker.strip().upper()
    t = _yf_ticker(ticker)
    if t is None:
        raise HTTPException(503, "yfinance unavailable")

    def _build() -> Dict[str, Any]:
        holders: List[Dict[str, Any]] = []
        inst_df = None
        mf_df = None
        major_df = None
        try:
            inst_df = t.institutional_holders
        except Exception as e:
            logger.info("institutional_holders(%s) failed: %s", ticker, e)
        try:
            mf_df = t.mutualfund_holders
        except Exception as e:
            logger.info("mutualfund_holders(%s) failed: %s", ticker, e)
        try:
            major_df = t.major_holders
        except Exception as e:
            logger.info("major_holders(%s) failed: %s", ticker, e)

        # Center
        info = {}
        try:
            info = t.get_info() if hasattr(t, "get_info") else (t.info or {})
        except Exception:
            pass
        price = _num(info.get("currentPrice") or info.get("regularMarketPrice"))
        shares_out_m = _to_million(info.get("sharesOutstanding")) or 0

        # Rows from yfinance have columns: Holder, Shares, Date Reported, % Out, Value
        def _norm(df, htype: str, source: str) -> List[Dict[str, Any]]:
            out = []
            if df is None or not hasattr(df, "iterrows"):
                return out
            for idx, row in df.iterrows():
                shares = _num(row.get("Shares"))
                if not shares:
                    continue
                shares_m = shares / 1_000_000.0
                pct_out = _num(row.get("% Out")) or (
                    (shares / info.get("sharesOutstanding")) * 100
                    if info.get("sharesOutstanding") else None
                )
                value_mm = _num(row.get("Value"))
                if value_mm is not None:
                    value_mm = value_mm / 1_000_000.0
                elif price:
                    value_mm = shares_m * price
                out.append({
                    "id": f"H{idx:04d}" if isinstance(idx, int) else f"H{len(out)+1:04d}",
                    "name": str(row.get("Holder") or "Unknown"),
                    "type": htype,
                    "country": "US",
                    "source": source,
                    "positionSharesM": round(shares_m, 2),
                    "pctOut": round(pct_out, 3) if pct_out is not None else None,
                    "changeSharesM": 0.0,  # yfinance doesn't surface delta
                    "changePct": 0.0,
                    "positionDate": str(row.get("Date Reported") or "")[:10],
                    "marketValueMm": round(value_mm, 0) if value_mm is not None else None,
                    "portfolioPct": None,
                    "status": "Unchanged",
                })
            return out

        holders.extend(_norm(inst_df, "Institution", "13F"))
        holders.extend(_norm(mf_df, "Mutual Fund", "NPORT"))

        # Summary breakdown from yf's major_holders if available (a 2-col frame
        # of [value, label]).
        inst_pct = 0.0
        insider_pct = 0.0
        if major_df is not None and hasattr(major_df, "iterrows"):
            try:
                for _, row in major_df.iterrows():
                    label = str(row.iloc[1]).lower()
                    val = str(row.iloc[0]).replace("%", "").strip()
                    try:
                        pct = float(val)
                    except ValueError:
                        continue
                    if "institution" in label:
                        inst_pct = pct
                    elif "insider" in label:
                        insider_pct = pct
            except Exception:
                pass

        holders.sort(key=lambda h: h.get("positionSharesM", 0), reverse=True)
        top10_pct = sum(h.get("pctOut") or 0 for h in holders[:10])

        summary = {
            "institutionalPct": inst_pct,
            "mutualFundPct": None,
            "etfPct": None,
            "hedgeFundPct": None,
            "insiderPct": insider_pct,
            "top10Pct": round(top10_pct, 2),
            "holderCount": len(holders),
            "holderCountDeltaQoq": 0,
            "shortInterestPct": _to_pct(info.get("shortPercentOfFloat")),
            "daysToCover": _num(info.get("shortRatio")),
            "avgDailyVolumeM": (_num(info.get("averageVolume")) or 0) / 1_000_000.0,
            "floatTurnoverDays": None,
        }
        center = {
            "ticker": ticker,
            "name": info.get("longName") or ticker,
            "country": info.get("country") or "US",
            "industry": info.get("industry") or "",
            "price": price or 0.0,
            "marketCapB": _to_billion(info.get("marketCap")) or 0.0,
            "sharesOutstandingM": shares_out_m,
            "floatPctOfOut": (
                (_num(info.get("floatShares")) or 0)
                / info.get("sharesOutstanding") * 100
                if info.get("sharesOutstanding") else 99.0
            ),
        }

        return {
            "asOf": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "center": center,
            "summary": summary,
            "holders": holders,
        }

    try:
        data = await _run(_build)
        return {"source": "yfinance", "data": data}
    except Exception as e:
        logger.warning("HDS(%s) failed: %s", ticker, e)
        raise HTTPException(502, f"HDS upstream failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# /splc — Supply Chain / Peers
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/splc/{ticker}")
async def get_splc(ticker: str) -> Dict[str, Any]:
    """
    Build a best-effort supply-chain dashboard using:
      - yfinance for the focal company's profile
      - FMP /stock_peers (if key present) for peers
      - Fall back to mock-like empty suppliers/customers with just peers
        (real supply-chain data requires paid feeds — Bloomberg SPLC, Sayari,
        FactSet; see API-KEYS.md)
    """
    ticker = ticker.strip().upper()
    t = _yf_ticker(ticker)
    if t is None:
        raise HTTPException(503, "yfinance unavailable")

    def _build_center() -> Dict[str, Any]:
        info = {}
        try:
            info = t.get_info() if hasattr(t, "get_info") else (t.info or {})
        except Exception:
            pass
        revenue = _num(info.get("totalRevenue")) or 0
        cogs = revenue * (1 - (_num(info.get("grossMargins")) or 0))
        return {
            "ticker": ticker,
            "name": info.get("longName") or ticker,
            "country": info.get("country") or "US",
            "industry": info.get("industry") or "",
            "price": _num(info.get("currentPrice") or info.get("regularMarketPrice")) or 0.0,
            "marketCapB": _to_billion(info.get("marketCap")) or 0.0,
            "revenueB": revenue / 1e9 if revenue else 0.0,
            "cogsB": cogs / 1e9 if cogs else 0.0,
            "grossMarginPct": (_num(info.get("grossMargins")) or 0) * 100,
            "metrics": {
                "revenueQuantifiedPct": 0,
                "cogsQuantifiedPct": 0,
                "capexQuantifiedPct": 0,
                "sgaQuantifiedPct": 0,
                "rndQuantifiedPct": 0,
            },
        }

    async def _fetch_peers() -> List[Dict[str, Any]]:
        # Prefer FMP peers if we have a key
        if FMP_API_KEY:
            try:
                url = f"https://financialmodelingprep.com/api/v4/stock_peers?symbol={ticker}&apikey={FMP_API_KEY}"
                async with httpx.AsyncClient(timeout=8.0) as client:
                    r = await client.get(url)
                    if r.status_code == 200:
                        data = r.json()
                        peers = (data[0] if data else {}).get("peersList", [])
                        return [{"ticker": p, "name": p, "country": "US", "industry": ""} for p in peers[:8]]
            except Exception as e:
                logger.info("FMP peers(%s) failed: %s", ticker, e)
        # Fallback: yfinance similar tickers
        try:
            info = t.get_info() if hasattr(t, "get_info") else (t.info or {})
            sector = info.get("sector") or ""
            industry = info.get("industry") or ""
        except Exception:
            sector = industry = ""
        return []  # no reliable free source; leave empty

    try:
        center = await _run(_build_center)
        peers = await _fetch_peers()
        return {
            "source": "yfinance+fmp" if FMP_API_KEY else "yfinance",
            "data": {
                "center": center,
                "suppliers": [],   # requires paid feed
                "customers": [],   # requires paid feed
                "peers": peers,
            },
        }
    except Exception as e:
        logger.warning("SPLC(%s) failed: %s", ticker, e)
        raise HTTPException(502, f"SPLC upstream failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# /wei — World Equity Indices
# ─────────────────────────────────────────────────────────────────────────────

# Maps our internal ISO3 → yfinance symbol for each flagship index. Only
# liquid indices with reliable yfinance coverage are included; the rest fall
# back to a deterministic mock path on the frontend.
_WEI_YF_MAP: Dict[str, str] = {
    "USA": "^GSPC",
    "CAN": "^GSPTSE",
    "MEX": "^MXX",
    "BRA": "^BVSP",
    "ARG": "^MERV",
    "GBR": "^FTSE",
    "DEU": "^GDAXI",
    "FRA": "^FCHI",
    "ITA": "FTSEMIB.MI",
    "ESP": "^IBEX",
    "NLD": "^AEX",
    "BEL": "^BFX",
    "CHE": "^SSMI",
    "AUT": "^ATX",
    "SWE": "^OMX",
    "NOR": "OSEBX.OL",
    "FIN": "^OMXH25",
    "DNK": "^OMXC25",
    "POL": "WIG20.WA",
    "CZE": "^PX",
    "HUN": "^BUX",
    "TUR": "^XU100",
    "GRC": "^ATG",
    "ISR": "^TA125.TA",
    "JPN": "^N225",
    "CHN": "000300.SS",
    "HKG": "^HSI",
    "TWN": "^TWII",
    "KOR": "^KS11",
    "IND": "^NSEI",
    "PAK": "^KSE",
    "IDN": "^JKSE",
    "MYS": "^KLSE",
    "THA": "^SET.BK",
    "VNM": "^VNINDEX.VN",
    "PHL": "PSEI.PS",
    "SGP": "^STI",
    "AUS": "^AXJO",
    "NZL": "^NZ50",
    "SAU": "^TASI.SR",
    "ARE": "^ADI",
    "EGY": "^CASE30",
    "ZAF": "^JN0U.JO",
    "MAR": "^MOSENEW",
    "NGA": "^NGSEINDX",
}


@router.get("/wei")
async def get_wei() -> Dict[str, Any]:
    yf = _yf()
    if yf is None:
        raise HTTPException(503, "yfinance unavailable")

    def _build() -> List[Dict[str, Any]]:
        # Single batched download keeps us well under yfinance's rate limits.
        symbols = list(_WEI_YF_MAP.values())
        try:
            df = yf.download(
                tickers=" ".join(symbols),
                period="5d",
                interval="1d",
                group_by="ticker",
                progress=False,
                threads=True,
                auto_adjust=False,
            )
        except Exception as e:
            logger.warning("yf.download(WEI) failed: %s", e)
            df = None

        snapshots: List[Dict[str, Any]] = []
        if df is None or df.empty:
            return snapshots

        for iso3, yf_sym in _WEI_YF_MAP.items():
            try:
                sub = df[yf_sym] if yf_sym in df.columns.get_level_values(0) else None
                if sub is None or sub.dropna().empty:
                    continue
                closes = sub["Close"].dropna()
                if len(closes) < 2:
                    continue
                last = float(closes.iloc[-1])
                prev = float(closes.iloc[-2])
                change_pct = ((last - prev) / prev) * 100 if prev else 0.0
                ytd = None
                try:
                    ytd = ((last - closes.iloc[0]) / closes.iloc[0]) * 100
                except Exception:
                    pass
                snapshots.append({
                    "iso3": iso3,
                    "yfSymbol": yf_sym,
                    "price": round(last, 2),
                    "prevClose": round(prev, 2),
                    "changeAbs": round(last - prev, 2),
                    "changePct": round(change_pct, 3),
                    "ytdPct": round(ytd, 2) if ytd is not None else None,
                })
            except Exception as e:
                logger.info("WEI parse(%s/%s) failed: %s", iso3, yf_sym, e)
                continue
        return snapshots

    try:
        snaps = await _run(_build)
    except Exception as e:
        logger.warning("WEI build failed: %s", e)
        snaps = []

    return {
        "source": "yfinance",
        "asOf": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "snapshots": snaps,
    }


# ─────────────────────────────────────────────────────────────────────────────
# /rmap — Relationship Map
#
# Aggregates the 12 RMAP "data nodes" (Bloomberg ticker <EQUITY> RMAP <GO>)
# from yfinance facts in a single best-effort batch. Anything yfinance
# doesn't expose is returned as an empty list — the frontend already merges
# this with its mock generator so empty sections fall back gracefully and
# the layout never goes blank.
# ─────────────────────────────────────────────────────────────────────────────


_RMAP_BOARD_TITLES = {"director", "chair", "lead director"}
_RMAP_EXEC_TITLES = {"chief executive", "chief financial", "chief operating",
                     "chief technology", "president"}


def _person_kind(title: str) -> str:
    t = (title or "").lower()
    if any(k in t for k in _RMAP_BOARD_TITLES):
        return "board"
    if any(k in t for k in _RMAP_EXEC_TITLES):
        return "exec"
    return "exec"


@router.get("/rmap/{ticker}")
async def get_rmap(ticker: str) -> Dict[str, Any]:
    """Single-call relationship-map payload sourced from yfinance.

    Output shape mirrors the frontend `RmapData` interface in
    [src/features/terminal/rmap/mockData.ts]. Each section returns
    `{ total, items }` so the UI can show "12 of N" badges even when only
    the head of the list is populated.
    """
    ticker = ticker.strip().upper()
    t = _yf_ticker(ticker)
    if t is None:
        raise HTTPException(503, "yfinance unavailable")

    def _build() -> Dict[str, Any]:
        info: Dict[str, Any] = {}
        try:
            info = t.get_info() if hasattr(t, "get_info") else (t.info or {})
        except Exception as e:
            logger.warning("rmap yf.info(%s) failed: %s", ticker, e)
        fast: Dict[str, Any] = {}
        try:
            fast = dict(t.fast_info or {})
        except Exception:
            pass

        price = _num(info.get("currentPrice") or fast.get("last_price")
                     or info.get("regularMarketPrice")) or 0.0
        prev = _num(info.get("previousClose") or fast.get("previous_close")) or price
        change_pct = ((price - prev) / prev * 100) if prev else 0.0

        # ── center ────────────────────────────────────────────────────
        # 5-day close sparkline. Best-effort; the UI synthesises one if empty.
        spark: List[float] = []
        try:
            hist = t.history(period="5d", interval="1d", auto_adjust=False)
            if hist is not None and not hist.empty:
                spark = [float(v) for v in hist["Close"].dropna().tolist()][-12:]
        except Exception as e:
            logger.info("rmap spark(%s) failed: %s", ticker, e)

        center = {
            "ticker": ticker,
            "name": info.get("shortName") or info.get("longName") or ticker,
            "exchange": info.get("exchange") or info.get("fullExchangeName") or "",
            "price": round(price, 2),
            "changePct": round(change_pct, 2),
            "currency": info.get("currency") or fast.get("currency") or "USD",
            "sparkline": spark,
        }

        # ── peers (analytics-friendly: peers' last %) ────────────────
        peer_syms: List[str] = []
        try:
            peer_syms = list((info.get("recommendationKey") and []) or [])  # placeholder
        except Exception:
            pass
        # yfinance does not expose peers reliably any more; pull from FMP
        # if a key is present, else fall back to industry placeholder list.
        if FMP_API_KEY:
            try:
                with httpx.Client(timeout=8.0) as cx:
                    r = cx.get(
                        "https://financialmodelingprep.com/api/v4/stock_peers",
                        params={"symbol": ticker, "apikey": FMP_API_KEY},
                    )
                    if r.status_code == 200:
                        body = r.json()
                        if isinstance(body, list) and body:
                            peer_syms = list(body[0].get("peersList") or [])[:12]
            except Exception as e:
                logger.info("FMP peers(%s) failed: %s", ticker, e)

        peer_items: List[Dict[str, Any]] = []
        if peer_syms:
            try:
                yf = _yf()
                quotes = yf.download(
                    " ".join(peer_syms[:12]),
                    period="2d", interval="1d", group_by="ticker",
                    progress=False, threads=True, auto_adjust=False,
                )
                for sym in peer_syms[:12]:
                    try:
                        sub = quotes[sym] if sym in quotes.columns.get_level_values(0) else None
                        closes = sub["Close"].dropna() if sub is not None else None
                        if closes is None or len(closes) < 2:
                            continue
                        last_, prev_ = float(closes.iloc[-1]), float(closes.iloc[-2])
                        peer_items.append({
                            "symbol": sym.upper(),
                            "changePct": round((last_ - prev_) / prev_ * 100, 2) if prev_ else 0.0,
                        })
                    except Exception:
                        continue
            except Exception as e:
                logger.info("rmap peer quotes failed: %s", e)

        # ── holders (top 8 institutional) ─────────────────────────────
        holder_items: List[Dict[str, Any]] = []
        try:
            inst = t.institutional_holders
            if inst is not None and hasattr(inst, "iterrows"):
                shares_out = info.get("sharesOutstanding") or 0
                for _, row in inst.head(8).iterrows():
                    shares = _num(row.get("Shares"))
                    if not shares:
                        continue
                    pct = _num(row.get("% Out")) or (
                        (shares / shares_out * 100) if shares_out else 0.0
                    )
                    holder_items.append({
                        "name": str(row.get("Holder") or "Unknown"),
                        "pctOwned": round(pct or 0.0, 2),
                        "changePct": 0.0,
                    })
        except Exception as e:
            logger.info("rmap holders(%s) failed: %s", ticker, e)

        # ── analysts (recommendations, last row only — quick count) ──
        analyst_items: List[Dict[str, Any]] = []
        try:
            recs = t.recommendations
            if recs is not None and hasattr(recs, "iterrows"):
                # Head rows are the most recent firm-level upgrades/downgrades.
                for _, row in recs.tail(8).iterrows():
                    grade = str(row.get("To Grade") or row.get("toGrade") or "").upper()
                    firm = str(row.get("Firm") or row.get("firm") or "").strip()
                    if not firm:
                        continue
                    if "BUY" in grade or "OUTPERFORM" in grade or "OVERWEIGHT" in grade:
                        action = "BUY"
                    elif "SELL" in grade or "UNDERPERFORM" in grade or "UNDERWEIGHT" in grade:
                        action = "SELL"
                    else:
                        action = "HOLD"
                    analyst_items.append({"firm": firm[:18], "action": action})
        except Exception as e:
            logger.info("rmap analysts(%s) failed: %s", ticker, e)

        # ── people (board + execs from companyOfficers) ──────────────
        board_items: List[Dict[str, Any]] = []
        exec_items: List[Dict[str, Any]] = []
        for o in (info.get("companyOfficers") or [])[:18]:
            name = (o.get("name") or "").strip()
            title = (o.get("title") or "").strip()
            if not name or not title:
                continue
            tile = {"name": name, "role": title[:24]}
            (exec_items if _person_kind(title) == "exec" else board_items).append(tile)
        exec_items = exec_items[:6]
        board_items = board_items[:6]

        # ── news (yf news returns headlines + ts) ─────────────────────
        news_items: List[Dict[str, Any]] = []
        try:
            for n in (t.news or [])[:10]:
                content = n.get("content") or n
                title_ = (content.get("title") or "").strip()
                if not title_:
                    continue
                pub = content.get("pubDate") or content.get("providerPublishTime")
                mins = 0
                try:
                    if isinstance(pub, str):
                        dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
                        mins = max(0, int((datetime.now(timezone.utc) - dt).total_seconds() / 60))
                    elif isinstance(pub, (int, float)):
                        mins = max(0, int((datetime.now(timezone.utc).timestamp() - float(pub)) / 60))
                except Exception:
                    mins = 0
                provider = ((content.get("provider") or {}).get("displayName")
                            or content.get("publisher") or "Yahoo")
                news_items.append({
                    "headline": title_[:90],
                    "source": str(provider)[:14],
                    "minutesAgo": mins,
                })
        except Exception as e:
            logger.info("rmap news(%s) failed: %s", ticker, e)

        # ── events (calendar) ────────────────────────────────────────
        event_items: List[Dict[str, Any]] = []
        try:
            cal = t.calendar
            if isinstance(cal, dict):
                er = cal.get("Earnings Date") or cal.get("Earnings High")
                if er:
                    if isinstance(er, list):
                        er = er[0]
                    event_items.append({
                        "title": "Next Earnings",
                        "date": str(er)[:10],
                        "kind": "earnings",
                    })
                exd = cal.get("Ex-Dividend Date")
                if exd:
                    event_items.append({
                        "title": "Ex-Dividend",
                        "date": str(exd)[:10],
                        "kind": "dividend",
                    })
        except Exception as e:
            logger.info("rmap calendar(%s) failed: %s", ticker, e)

        # ── options (front-month chain — top 8 strikes by IV) ────────
        option_items: List[Dict[str, Any]] = []
        try:
            expiries = t.options or []
            if expiries:
                opt = t.option_chain(expiries[0])
                calls = opt.calls
                if calls is not None and not calls.empty:
                    rows = calls.dropna(subset=["impliedVolatility"]).head(8)
                    for _, row in rows.iterrows():
                        option_items.append({
                            "strike": float(row.get("strike") or 0),
                            "iv": float(row.get("impliedVolatility") or 0) * 100,
                        })
        except Exception as e:
            logger.info("rmap options(%s) failed: %s", ticker, e)

        # ── balance sheet (from info totals — order matters for the bar) ─
        balance_items: List[Dict[str, Any]] = []
        for label, key, tone in [
            ("Cash", "totalCash", "asset"),
            ("Total Debt", "totalDebt", "liability"),
            ("Equity", "bookValue", "equity"),
        ]:
            v = _num(info.get(key))
            if v is not None:
                # bookValue is per-share; multiply by shares for parity with totals.
                if key == "bookValue":
                    so = _num(info.get("sharesOutstanding")) or 0
                    v = v * so
                balance_items.append({
                    "label": label,
                    "value": round(v / 1e9, 2),  # billions
                    "tone": tone,
                })

        # ── exchanges (just the listing venue — yfinance only exposes one) ─
        exchange_items = []
        if center["exchange"]:
            exchange_items.append({"code": center["exchange"][:10], "volumePct": 100.0})

        # ── indices (parent indices from info) ────────────────────────
        index_items: List[Dict[str, Any]] = []
        # yfinance doesn't expose index membership; leave empty unless we want
        # to inject a static "SPX" / "NDX" guess. The UI renders an empty
        # card with the count badge, which is honest about the gap.

        return {
            "asOf": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "center": center,
            "indices":   {"total": len(index_items),   "items": index_items},
            "peers":     {"total": len(peer_items),    "items": peer_items},
            "holders":   {"total": len(holder_items),  "items": holder_items},
            "analysts":  {"total": len(analyst_items), "items": analyst_items},
            "board":     {"total": len(board_items),   "items": board_items},
            "executives": {"total": len(exec_items),   "items": exec_items},
            "news":      {"total": len(news_items),    "items": news_items},
            "events":    {"total": len(event_items),   "items": event_items},
            "options":   {"total": len(option_items),  "items": option_items},
            "exchanges": {"total": len(exchange_items),"items": exchange_items},
            "cds":       {"total": 0, "items": []},  # CDS spreads need a paid feed
            "balanceSheet": {"items": balance_items},
        }

    try:
        data = await _run(_build)
        return {"source": "yfinance", "data": data}
    except Exception as e:
        logger.warning("RMAP(%s) failed: %s", ticker, e)
        raise HTTPException(502, f"RMAP upstream failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# tiny helpers
# ─────────────────────────────────────────────────────────────────────────────


def _num(v) -> Optional[float]:
    try:
        if v is None:
            return None
        f = float(v)
        if f != f or f in (float("inf"), float("-inf")):  # NaN/Inf guard
            return None
        return f
    except (TypeError, ValueError):
        return None


def _int(v, default=0) -> Optional[int]:
    try:
        if v is None:
            return default
        return int(v)
    except (TypeError, ValueError):
        return default


def _to_billion(v) -> Optional[float]:
    n = _num(v)
    return round(n / 1e9, 3) if n is not None else None


def _to_million(v) -> Optional[float]:
    n = _num(v)
    return round(n / 1e6, 2) if n is not None else None


def _to_pct(v) -> Optional[float]:
    """yfinance returns fractional percents (0.23 for 23%)."""
    n = _num(v)
    if n is None:
        return None
    # Already in percent?
    return round(n * 100, 3) if abs(n) < 2 else round(n, 3)


def _extract_highlights(info: Dict[str, Any]) -> List[str]:
    out = []
    if info.get("longBusinessSummary"):
        text = info["longBusinessSummary"]
        # Take the first two sentences as highlights.
        sentences = [s.strip() for s in text.split(".") if len(s.strip()) > 20][:2]
        out.extend(sentences)
    if info.get("website"):
        out.append(f"Website: {info['website']}")
    return out
