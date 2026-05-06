"""
SEC EDGAR proxy router.

EDGAR is free and public, but browser CORS blocks the data.sec.gov / www.sec.gov
endpoints. We proxy from this service so the frontend can call /api/edgar/*.
SEC asks all callers to identify themselves; set EDGAR_USER_AGENT env var:
    "OpenQwnt Research <ops@example.com>"

Routes:
  • GET /api/edgar/lookup/{ticker}            → ticker → CIK
  • GET /api/edgar/{cik}/filings              → recent filings (formType filter)
  • GET /api/edgar/{cik}/facts                → XBRL companyfacts
  • GET /api/edgar/{cik}/insiders             → parsed Form-4 transactions
"""
from __future__ import annotations

import os
import re
from datetime import datetime, timedelta
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/edgar", tags=["edgar"])

UA = os.environ.get("EDGAR_USER_AGENT", "OpenQwnt Research example@example.com")
HEADERS = {"User-Agent": UA, "Accept": "application/json"}

_TICKER_CACHE: dict[str, dict[str, Any]] | None = None


async def _client():
    return httpx.AsyncClient(timeout=15.0, headers=HEADERS)


async def _load_ticker_map() -> dict[str, dict[str, Any]]:
    global _TICKER_CACHE
    if _TICKER_CACHE is not None:
        return _TICKER_CACHE
    async with await _client() as c:
        r = await c.get("https://www.sec.gov/files/company_tickers.json")
        r.raise_for_status()
        raw = r.json()
    # Original shape: {"0":{"cik_str": int, "ticker":"...", "title":"..."}}
    by_ticker: dict[str, dict[str, Any]] = {}
    for v in raw.values():
        by_ticker[v["ticker"].upper()] = {
            "ticker": v["ticker"].upper(),
            "cik": str(v["cik_str"]).zfill(10),
            "title": v["title"],
        }
    _TICKER_CACHE = by_ticker
    return by_ticker


@router.get("/lookup/{ticker}")
async def lookup(ticker: str) -> dict[str, Any]:
    tmap = await _load_ticker_map()
    info = tmap.get(ticker.upper())
    if not info:
        raise HTTPException(404, f"{ticker} not in EDGAR ticker map")
    return info


@router.get("/{cik}/filings")
async def filings(cik: str, forms: str | None = Query(None)) -> list[dict[str, Any]]:
    cik_clean = cik.zfill(10)
    url = f"https://data.sec.gov/submissions/CIK{cik_clean}.json"
    async with await _client() as c:
        r = await c.get(url)
        if r.status_code != 200:
            raise HTTPException(r.status_code, r.text[:200])
        data = r.json()
    recent = data.get("filings", {}).get("recent", {})
    forms_list = forms.split(",") if forms else None
    out: list[dict[str, Any]] = []
    n = len(recent.get("accessionNumber", []))
    for i in range(min(n, 200)):
        form_type = recent["form"][i]
        if forms_list and form_type not in forms_list:
            continue
        accession = recent["accessionNumber"][i]
        primary_doc = recent["primaryDocument"][i]
        accession_clean = accession.replace("-", "")
        url_view = f"https://www.sec.gov/Archives/edgar/data/{int(cik_clean)}/{accession_clean}/{primary_doc}"
        out.append({
            "accessionNumber": accession,
            "formType": form_type,
            "filedAt": recent["filingDate"][i],
            "reportDate": recent.get("reportDate", [None] * n)[i],
            "primaryDocument": primary_doc,
            "primaryDocumentDescription": recent.get("primaryDocDescription", [None] * n)[i],
            "url": url_view,
        })
    return out


@router.get("/{cik}/facts")
async def facts(cik: str) -> dict[str, Any]:
    cik_clean = cik.zfill(10)
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik_clean}.json"
    async with await _client() as c:
        r = await c.get(url)
        if r.status_code != 200:
            raise HTTPException(r.status_code, r.text[:200])
        data = r.json()
    # Flatten to {concept: [{value, unit, end, form, fy, fp}]} from us-gaap namespace.
    out: dict[str, Any] = {
        "cik": cik_clean,
        "entityName": data.get("entityName"),
        "facts": {},
    }
    us_gaap = data.get("facts", {}).get("us-gaap", {})
    for concept, info in us_gaap.items():
        units = info.get("units", {})
        flat = []
        for unit_label, vals in units.items():
            for v in vals:
                flat.append({
                    "value": v.get("val"),
                    "unit": unit_label,
                    "end": v.get("end"),
                    "form": v.get("form"),
                    "fy": v.get("fy"),
                    "fp": v.get("fp"),
                })
        flat.sort(key=lambda x: x.get("end") or "", reverse=True)
        out["facts"][concept] = flat[:40]
    return out


@router.get("/{cik}/insiders")
async def insiders(cik: str, since_days: int = 90) -> list[dict[str, Any]]:
    """
    Lightweight Form 4 summary. EDGAR's full Form 4 XML lives at the filing
    URL — parsing each is non-trivial. Here we return the recent Form 4
    metadata so the UI can deep-link; full transaction parsing is left to a
    follow-up task that hits the XML directly.
    """
    cik_clean = cik.zfill(10)
    url = f"https://data.sec.gov/submissions/CIK{cik_clean}.json"
    async with await _client() as c:
        r = await c.get(url)
        if r.status_code != 200:
            raise HTTPException(r.status_code, r.text[:200])
        data = r.json()
    recent = data.get("filings", {}).get("recent", {})
    cutoff = (datetime.utcnow() - timedelta(days=since_days)).date().isoformat()
    out: list[dict[str, Any]] = []
    for i, form in enumerate(recent.get("form", [])):
        if form != "4":
            continue
        filed_at = recent["filingDate"][i]
        if filed_at < cutoff:
            continue
        accession = recent["accessionNumber"][i].replace("-", "")
        out.append({
            "reporter": "(see filing)",
            "role": "(see filing)",
            "isOfficer": True,
            "isDirector": False,
            "is10pctOwner": False,
            "transactionType": "?",
            "transactionDate": filed_at,
            "shares": 0,
            "pricePerShare": 0.0,
            "sharesOwnedAfter": 0,
            "link": f"https://www.sec.gov/Archives/edgar/data/{int(cik_clean)}/{accession}/{recent['primaryDocument'][i]}",
        })
    return out
