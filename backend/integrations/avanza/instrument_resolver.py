"""
Resolve a free-form ticker / ISIN / Avanza orderbookId to a usable Avanza
identifier. Caches successful lookups in `avanza_instruments` so the same
ticker doesn't burn a search request every page load.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, Optional

from .client import AvanzaClient
from .storage import AvanzaStorage, get_storage

logger = logging.getLogger(__name__)

_ISIN_RE = re.compile(r"^[A-Z]{2}[A-Z0-9]{9}\d$")
_DIGITS_RE = re.compile(r"^\d+$")


class InstrumentResolver:
    def __init__(
        self,
        client: AvanzaClient,
        storage: Optional[AvanzaStorage] = None,
    ) -> None:
        self._client = client
        self._storage = storage or get_storage()

    async def resolve(
        self,
        identifier: str,
        instrument_type: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        if not identifier:
            return None
        key = identifier.strip().upper()

        cache_key = f"{instrument_type or 'any'}:{key}"
        cached = self._storage.get_cached_instrument(cache_key)
        if cached and cached.get("orderbookId"):
            return cached

        # If the user passed a numeric orderBookId straight, validate it via
        # market-guide rather than search.
        if _DIGITS_RE.match(key):
            if instrument_type:
                try:
                    payload = await self._client.market_guide(instrument_type, key)
                    if payload:
                        result = _shape_from_market_guide(key, instrument_type, payload)
                        self._storage.cache_instrument(cache_key, result)
                        return result
                except Exception as e:
                    logger.debug("market_guide direct lookup failed for %s: %s", key, e)
            return {
                "orderbookId": key,
                "instrumentType": instrument_type,
                "name": key,
            }

        types = [instrument_type.upper()] if instrument_type else None
        try:
            search_payload = await self._client.search(key, instrument_types=types, size=5)
        except Exception as e:
            logger.warning("avanza search failed for %s: %s", key, e)
            return None

        # Avanza's search response shape varies between endpoints / API versions.
        # Collect hits from every shape we've seen in captures:
        hits: list = []
        hits.extend(search_payload.get("hits") or [])
        hits.extend(search_payload.get("data") or [])
        for group in search_payload.get("resultGroups", []) or []:
            hits.extend(group.get("hits", []) or [])
        for group in search_payload.get("subResultGroups", []) or []:
            hits.extend(group.get("hits", []) or [])
        for k in ("instruments", "orderbooks", "stocks"):
            section = search_payload.get(k)
            if isinstance(section, list):
                hits.extend(section)
        # Also peek into nested top-hit lists
        for h in list(hits):
            if isinstance(h, dict) and "topHits" in h and isinstance(h["topHits"], list):
                hits.extend(h["topHits"])
        if not hits:
            return None

        # Prefer exact ticker match, then ISIN, then first hit
        ticker_match = next(
            (h for h in hits if (h.get("tickerSymbol") or "").upper() == key),
            None,
        )
        isin_match = next(
            (h for h in hits if (h.get("isin") or "").upper() == key),
            None,
        )
        chosen = ticker_match or isin_match or hits[0]
        result = {
            "orderbookId": str(chosen.get("orderbookId") or chosen.get("id") or ""),
            "instrumentType": (chosen.get("instrumentType") or chosen.get("type") or "").lower(),
            "name": chosen.get("name"),
            "tickerSymbol": chosen.get("tickerSymbol"),
            "isin": chosen.get("isin"),
            "currency": chosen.get("currency"),
            "flagCode": chosen.get("flagCode"),
            "lastPrice": chosen.get("lastPrice"),
        }
        if result["orderbookId"]:
            self._storage.cache_instrument(cache_key, result)
            return result
        return None


def _shape_from_market_guide(
    orderbook_id: str, instrument_type: str, payload: Dict[str, Any]
) -> Dict[str, Any]:
    base = payload.get("instrumentInfo") or payload.get("listing") or payload
    return {
        "orderbookId": orderbook_id,
        "instrumentType": instrument_type,
        "name": payload.get("name") or base.get("name"),
        "tickerSymbol": payload.get("tickerSymbol") or base.get("tickerSymbol"),
        "isin": payload.get("isin") or base.get("isin"),
        "currency": payload.get("currency") or base.get("currency"),
    }
