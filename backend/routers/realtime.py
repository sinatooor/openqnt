"""
Realtime / public-API proxies that feed the BMAP terminal map and other
live-data UIs. Centralising them here keeps API keys server-side and lets
us add request-level caching with one decorator.

Each endpoint returns a GeoJSON FeatureCollection so the frontend can drop
the response straight into a Mapbox source.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/realtime", tags=["realtime"])


USGS_USER_AGENT = os.getenv("USGS_USER_AGENT", "OpenQwnt/1.0")
NOAA_USER_AGENT = os.getenv(
    "NOAA_USER_AGENT", "OpenQwnt/1.0 (support@openqwnt.com)"
)
EIA_API_KEY = os.getenv("EIA_API_KEY")
OPENAQ_API_KEY = os.getenv("OPENAQ_API_KEY")
AISSTREAM_API_KEY = os.getenv("AISSTREAM_API_KEY")
OPENSKY_USERNAME = os.getenv("OPENSKY_USERNAME")
OPENSKY_PASSWORD = os.getenv("OPENSKY_PASSWORD")


# In-memory cache: { (kind, key) -> (expires_at, payload) }
_CACHE: Dict[str, tuple[float, Any]] = {}


def _cached(key: str, ttl: int):
    def deco(fn):
        async def wrapper(*args, **kwargs):
            now = time.time()
            entry = _CACHE.get(key)
            if entry and entry[0] > now:
                return entry[1]
            result = await fn(*args, **kwargs)
            _CACHE[key] = (now + ttl, result)
            return result

        return wrapper

    return deco


# ---------------------------------------------------------------------------
# USGS earthquakes
# ---------------------------------------------------------------------------

@router.get("/usgs/earthquakes")
async def usgs_earthquakes(
    magnitude: float = Query(2.5, description="2.5 | 4.5 | significant"),
) -> Dict[str, Any]:
    bucket = "significant" if magnitude >= 6 else f"{magnitude}_day"
    cache_key = f"usgs:{bucket}"
    cached = _CACHE.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1]

    url = f"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{bucket}.geojson"
    async with httpx.AsyncClient(timeout=10) as c:
        try:
            r = await c.get(url, headers={"User-Agent": USGS_USER_AGENT})
            r.raise_for_status()
            payload = r.json()
        except Exception as e:
            raise HTTPException(502, f"USGS feed failed: {e}")

    _CACHE[cache_key] = (time.time() + 5 * 60, payload)
    return payload


# ---------------------------------------------------------------------------
# NOAA NWS active alerts
# ---------------------------------------------------------------------------

@router.get("/noaa/alerts")
async def noaa_alerts(
    severity: Optional[str] = Query(None, description="Extreme|Severe|Moderate|Minor"),
    area: Optional[str] = Query(None),
) -> Dict[str, Any]:
    params: Dict[str, str] = {"status": "actual", "message_type": "alert"}
    if severity:
        params["severity"] = severity
    if area:
        params["area"] = area

    cache_key = f"noaa:{severity or 'all'}:{area or 'all'}"
    cached = _CACHE.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1]

    async with httpx.AsyncClient(timeout=15) as c:
        try:
            r = await c.get(
                "https://api.weather.gov/alerts/active",
                params=params,
                headers={"User-Agent": NOAA_USER_AGENT, "Accept": "application/geo+json"},
            )
            r.raise_for_status()
            payload = r.json()
        except Exception as e:
            raise HTTPException(502, f"NOAA feed failed: {e}")

    _CACHE[cache_key] = (time.time() + 5 * 60, payload)
    return payload


# ---------------------------------------------------------------------------
# OpenSky flights
# ---------------------------------------------------------------------------

@router.get("/opensky/states")
async def opensky_states(
    lamin: Optional[float] = Query(None),
    lamax: Optional[float] = Query(None),
    lomin: Optional[float] = Query(None),
    lomax: Optional[float] = Query(None),
) -> Dict[str, Any]:
    params: Dict[str, str] = {}
    if lamin is not None: params["lamin"] = str(lamin)
    if lamax is not None: params["lamax"] = str(lamax)
    if lomin is not None: params["lomin"] = str(lomin)
    if lomax is not None: params["lomax"] = str(lomax)

    cache_key = f"opensky:{lamin}:{lamax}:{lomin}:{lomax}"
    cached = _CACHE.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1]

    auth = None
    if OPENSKY_USERNAME and OPENSKY_PASSWORD:
        auth = (OPENSKY_USERNAME, OPENSKY_PASSWORD)

    async with httpx.AsyncClient(timeout=20, auth=auth) as c:
        try:
            r = await c.get("https://opensky-network.org/api/states/all", params=params)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            raise HTTPException(502, f"OpenSky feed failed: {e}")

    states = data.get("states") or []
    features: List[Dict[str, Any]] = []
    for s in states:
        if len(s) < 8:
            continue
        icao24, callsign, country, _t1, _t2, lon, lat, alt = s[:8]
        velocity = s[9] if len(s) > 9 else None
        heading = s[10] if len(s) > 10 else None
        if lat is None or lon is None:
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "icao24": icao24,
                "callsign": (callsign or "").strip(),
                "country": country,
                "altitude": alt,
                "velocity": velocity,
                "heading": heading,
            },
        })

    payload = {"type": "FeatureCollection", "features": features, "fetchedAt": int(time.time())}
    _CACHE[cache_key] = (time.time() + 60, payload)
    return payload


# ---------------------------------------------------------------------------
# EIA — US power-plant operating capacity
# ---------------------------------------------------------------------------

@router.get("/eia/plants")
async def eia_plants(limit: int = Query(2000, ge=1, le=5000)) -> Dict[str, Any]:
    if not EIA_API_KEY:
        raise HTTPException(503, "EIA_API_KEY not configured")

    cache_key = f"eia:plants:{limit}"
    cached = _CACHE.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1]

    url = "https://api.eia.gov/v2/electricity/operating-generator-capacity/data"
    params = {
        "api_key": EIA_API_KEY,
        "frequency": "monthly",
        "data[0]": "nameplate-capacity-mw",
        "facets[status][]": "OP",
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": str(limit),
    }
    async with httpx.AsyncClient(timeout=30) as c:
        try:
            r = await c.get(url, params=params)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            raise HTTPException(502, f"EIA feed failed: {e}")

    rows = data.get("response", {}).get("data", [])
    features: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        plant = row.get("plantid") or row.get("plantId")
        if not plant or plant in seen:
            continue
        lat = _coerce_float(row.get("latitude"))
        lon = _coerce_float(row.get("longitude"))
        if lat is None or lon is None:
            continue
        seen.add(plant)
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "plantId": plant,
                "name": row.get("plantName"),
                "state": row.get("state"),
                "fuel": row.get("technology") or row.get("primeMoverCode"),
                "capacityMw": _coerce_float(row.get("nameplate-capacity-mw")),
                "period": row.get("period"),
            },
        })

    payload = {"type": "FeatureCollection", "features": features, "fetchedAt": int(time.time())}
    _CACHE[cache_key] = (time.time() + 60 * 60, payload)
    return payload


@router.get("/eia/spot")
async def eia_spot(series: str = Query("RWTC", description="WTI=RWTC, Brent=RBRTE")) -> Dict[str, Any]:
    if not EIA_API_KEY:
        raise HTTPException(503, "EIA_API_KEY not configured")
    cache_key = f"eia:spot:{series}"
    cached = _CACHE.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1]
    url = "https://api.eia.gov/v2/petroleum/pri/spt/data"
    params = {
        "api_key": EIA_API_KEY,
        "data[0]": "value",
        "facets[series][]": series,
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": "60",
    }
    async with httpx.AsyncClient(timeout=15) as c:
        try:
            r = await c.get(url, params=params)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            raise HTTPException(502, f"EIA spot failed: {e}")
    payload = data.get("response", {}).get("data", [])
    _CACHE[cache_key] = (time.time() + 30 * 60, payload)
    return payload


# ---------------------------------------------------------------------------
# OpenAQ — air quality
# ---------------------------------------------------------------------------

@router.get("/openaq/locations")
async def openaq_locations(
    parameter: str = Query("pm25", description="pm25|pm10|no2|o3|so2|co"),
    limit: int = Query(1000, ge=1, le=10000),
) -> Dict[str, Any]:
    if not OPENAQ_API_KEY:
        raise HTTPException(503, "OPENAQ_API_KEY not configured")

    cache_key = f"openaq:loc:{parameter}:{limit}"
    cached = _CACHE.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1]

    url = "https://api.openaq.org/v3/locations"
    params = {"limit": str(limit), "parameters_id": parameter}
    headers = {"X-API-Key": OPENAQ_API_KEY, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=30) as c:
        try:
            r = await c.get(url, params=params, headers=headers)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            raise HTTPException(502, f"OpenAQ feed failed: {e}")

    features: List[Dict[str, Any]] = []
    for row in data.get("results", []):
        coords = (row.get("coordinates") or {})
        lat = coords.get("latitude")
        lon = coords.get("longitude")
        if lat is None or lon is None:
            continue
        latest_value: Optional[float] = None
        for sensor in row.get("sensors") or []:
            v = (sensor.get("latest") or {}).get("value")
            if isinstance(v, (int, float)):
                latest_value = float(v)
                break
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "id": row.get("id"),
                "name": row.get("name"),
                "country": (row.get("country") or {}).get("code"),
                "parameter": parameter,
                "value": latest_value,
            },
        })

    payload = {"type": "FeatureCollection", "features": features, "fetchedAt": int(time.time())}
    _CACHE[cache_key] = (time.time() + 30 * 60, payload)
    return payload


# ---------------------------------------------------------------------------
# AISStream live vessel positions (WebSocket fan-out)
# ---------------------------------------------------------------------------

@router.websocket("/aisstream/ws")
async def aisstream_ws(
    websocket: WebSocket,
    bbox: Optional[str] = Query(None, description="lat1,lon1,lat2,lon2"),
):
    """
    Browser <-> backend <-> wss://stream.aisstream.io/v0/stream
    The browser connects here; we forward filtered position reports.
    """
    await websocket.accept()
    if not AISSTREAM_API_KEY:
        await websocket.send_json({"error": "AISSTREAM_API_KEY not configured"})
        await websocket.close()
        return

    try:
        import websockets  # noqa: WPS433
    except ImportError:
        await websocket.send_json({"error": "websockets package not installed"})
        await websocket.close()
        return

    bounding_boxes: List[List[List[float]]]
    if bbox:
        try:
            lat1, lon1, lat2, lon2 = [float(x) for x in bbox.split(",")]
            bounding_boxes = [[[lat1, lon1], [lat2, lon2]]]
        except Exception:
            bounding_boxes = [[[-90, -180], [90, 180]]]
    else:
        bounding_boxes = [[[-90, -180], [90, 180]]]

    subscribe = {
        "APIKey": AISSTREAM_API_KEY,
        "BoundingBoxes": bounding_boxes,
        "FilterMessageTypes": ["PositionReport", "ShipStaticData"],
    }

    upstream = None
    try:
        upstream = await websockets.connect("wss://stream.aisstream.io/v0/stream")
        await upstream.send(_safe_json(subscribe))

        async def _client_to_close():
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                if upstream:
                    await upstream.close()

        task = asyncio.create_task(_client_to_close())

        async for raw in upstream:
            try:
                if isinstance(raw, bytes):
                    raw = raw.decode("utf-8", errors="ignore")
                await websocket.send_text(raw)
            except WebSocketDisconnect:
                break
            except Exception:
                continue
        task.cancel()
    except Exception as e:
        logger.warning("aisstream proxy failed: %s", e)
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass
    finally:
        if upstream:
            try:
                await upstream.close()
            except Exception:
                pass
        try:
            await websocket.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _coerce_float(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def _safe_json(obj: Dict[str, Any]) -> str:
    import json
    return json.dumps(obj)
