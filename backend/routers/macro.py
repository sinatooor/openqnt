"""
Macro snapshot router — feeds the MacroPanel widget.

Production path: pull from FRED via fredapi (api key required), Treasury for
2y/10y, EIA for oil, gold/btc from existing market-data fetchers. This stub
returns sensible last-known values so the panel renders something during
development; replace `_load_*` helpers with the real fetchers.
"""
from __future__ import annotations

import os
from datetime import datetime, date, timedelta
from typing import Any
from fastapi import APIRouter

router = APIRouter(prefix="/api/macro", tags=["macro"])


def _tile(series: str, label: str, value: float | None, change: float | None, unit: str, as_of: date | None) -> dict[str, Any]:
    return {
        "series": series,
        "label": label,
        "value": value,
        "change": change,
        "unit": unit,
        "asOf": as_of.isoformat() if as_of else None,
    }


def _load_fred() -> list[dict[str, Any]] | None:
    """Optional FRED hydration; returns None when fredapi is unavailable."""
    api_key = os.environ.get("FRED_API_KEY")
    if not api_key:
        return None
    try:
        from fredapi import Fred  # type: ignore
    except ImportError:
        return None
    fred = Fred(api_key=api_key)
    today = date.today()

    def latest(series_id: str, multiplier: float = 1.0) -> tuple[float | None, float | None, date | None]:
        try:
            s = fred.get_series(series_id).dropna()
            if s.empty:
                return None, None, None
            v = float(s.iloc[-1]) * multiplier
            prev = float(s.iloc[-2]) * multiplier if len(s) > 1 else None
            change = (v - prev) if prev is not None else None
            return v, change, s.index[-1].date()
        except Exception:
            return None, None, None

    fed, fed_chg, fed_dt = latest("DFF")
    cpi, cpi_chg, cpi_dt = latest("CPIAUCSL")  # raw level, see below
    core_cpi, core_chg, core_dt = latest("CPILFESL")
    une, une_chg, une_dt = latest("UNRATE")
    gdp, gdp_chg, gdp_dt = latest("A191RL1Q225SBEA")  # real GDP YoY
    us10y, us10y_chg, us10y_dt = latest("DGS10")
    us2y, us2y_chg, us2y_dt = latest("DGS2")
    dxy, dxy_chg, dxy_dt = latest("DTWEXBGS")
    oil, oil_chg, oil_dt = latest("DCOILWTICO")
    gold, gold_chg, gold_dt = latest("GOLDAMGBD228NLBM")

    # Compute YoY for raw CPI series
    def yoy(series_id: str) -> tuple[float | None, float | None, date | None]:
        try:
            s = fred.get_series(series_id).dropna()
            if len(s) < 13:
                return None, None, None
            yoy_now = (float(s.iloc[-1]) / float(s.iloc[-13]) - 1) * 100
            yoy_prev = (float(s.iloc[-2]) / float(s.iloc[-14]) - 1) * 100 if len(s) > 14 else None
            change = (yoy_now - yoy_prev) if yoy_prev is not None else None
            return yoy_now, change, s.index[-1].date()
        except Exception:
            return None, None, None

    cpi_yoy, cpi_yoy_chg, cpi_yoy_dt = yoy("CPIAUCSL")
    core_cpi_yoy, core_cpi_yoy_chg, core_cpi_yoy_dt = yoy("CPILFESL")

    # 2s10s spread in bps
    curve = (us10y * 100 - us2y * 100) if (us10y is not None and us2y is not None) else None

    return [
        _tile("fed_funds", "Fed Funds", fed, fed_chg, "%", fed_dt),
        _tile("us10y", "US 10y", us10y, us10y_chg, "%", us10y_dt),
        _tile("us2y", "US 2y", us2y, us2y_chg, "%", us2y_dt),
        _tile("curve_2s10s", "2s10s", curve, None, "bps", us10y_dt),
        _tile("cpi_yoy", "CPI YoY", cpi_yoy, cpi_yoy_chg, "%", cpi_yoy_dt),
        _tile("core_cpi_yoy", "Core CPI YoY", core_cpi_yoy, core_cpi_yoy_chg, "%", core_cpi_yoy_dt),
        _tile("unemployment", "Unemployment", une, une_chg, "%", une_dt),
        _tile("real_gdp_yoy", "Real GDP YoY", gdp, gdp_chg, "%", gdp_dt),
        _tile("dxy", "DXY", dxy, dxy_chg, "", dxy_dt),
        _tile("oil_wti", "WTI Crude", oil, oil_chg, "$/bbl", oil_dt),
        _tile("gold_xau", "Gold", gold, gold_chg, "$/oz", gold_dt),
        _tile("btc", "BTC", None, None, "$", None),  # TODO: hook BTC fetcher
    ]


@router.get("/snapshot")
async def macro_snapshot():
    """Return the morning-glance macro tiles."""
    tiles = _load_fred()
    if tiles is None:
        # Stub fallback so the UI renders before FRED_API_KEY is wired.
        tiles = [
            _tile("fed_funds", "Fed Funds", None, None, "%", None),
            _tile("us10y", "US 10y", None, None, "%", None),
            _tile("us2y", "US 2y", None, None, "%", None),
            _tile("curve_2s10s", "2s10s", None, None, "bps", None),
            _tile("cpi_yoy", "CPI YoY", None, None, "%", None),
            _tile("core_cpi_yoy", "Core CPI YoY", None, None, "%", None),
            _tile("unemployment", "Unemployment", None, None, "%", None),
            _tile("real_gdp_yoy", "Real GDP YoY", None, None, "%", None),
            _tile("dxy", "DXY", None, None, "", None),
            _tile("oil_wti", "WTI Crude", None, None, "$/bbl", None),
            _tile("gold_xau", "Gold", None, None, "$/oz", None),
            _tile("btc", "BTC", None, None, "$", None),
        ]
    return {
        "tiles": tiles,
        "as_of": datetime.utcnow().isoformat(),
        "source": "FRED+stub" if any(t["value"] is not None for t in tiles) else "stub",
    }
