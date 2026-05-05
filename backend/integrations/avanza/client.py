"""
AvanzaClient — typed wrapper over the `_api` endpoints from §4 of the
reference. Read-only methods work anonymously when no auth is provided;
account/private and trading methods require an `AvanzaAuth` instance.

Trading writes are guarded twice:
  - constructor flag `enable_trading` (off by default)
  - per-call `confirm=True` argument (the router sets this only when the
    request body explicitly opts in)
Both must be true for a write to reach the network.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

from .auth import AvanzaAuth, AvanzaAuthError, AVANZA_BASE, USER_AGENT

logger = logging.getLogger(__name__)


# Map our short instrument-type aliases to Avanza's lowercase URL segment.
_INSTRUMENT_TYPES = {
    "stock", "fund", "bond", "option", "future-forward", "certificate",
    "warrant", "exchange-traded-fund", "index", "premium-bond",
    "subscription-option", "equity-linked-bond", "convertible",
}

# Per-IP rate budget. Avanza is undocumented; reference suggests <1 req/s.
_REQUEST_GAP_SEC = float(os.getenv("AVANZA_MIN_REQUEST_GAP", "0.4"))


class AvanzaTradingDisabled(RuntimeError):
    pass


class AvanzaClient:
    def __init__(
        self,
        auth: Optional[AvanzaAuth] = None,
        anon_client: Optional[httpx.AsyncClient] = None,
        enable_trading: Optional[bool] = None,
    ) -> None:
        self._auth = auth
        self._owned_anon = anon_client is None
        self._anon = anon_client or httpx.AsyncClient(
            base_url=AVANZA_BASE,
            timeout=httpx.Timeout(15.0, connect=8.0),
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
        if enable_trading is None:
            enable_trading = os.getenv("AVANZA_TRADING_ENABLED", "false").lower() in {"1", "true", "yes"}
        self._enable_trading = bool(enable_trading)
        self._req_lock = asyncio.Lock()
        self._last_req_at = 0.0

    async def aclose(self) -> None:
        if self._owned_anon:
            await self._anon.aclose()
        if self._auth:
            await self._auth.aclose()

    # ------------------------------------------------------------------
    # internal request helpers
    # ------------------------------------------------------------------

    async def _throttle(self) -> None:
        async with self._req_lock:
            now = asyncio.get_event_loop().time()
            wait = (self._last_req_at + _REQUEST_GAP_SEC) - now
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_req_at = asyncio.get_event_loop().time()

    async def _get_anon(self, path: str, params: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        await self._throttle()
        r = await self._anon.get(path, params=params)
        return _json_or_raise(r, path)

    async def _post_anon(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        await self._throttle()
        r = await self._anon.post(path, json=body)
        return _json_or_raise(r, path)

    async def _get_auth(self, path: str, params: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        if not self._auth:
            raise AvanzaAuthError("auth required for this endpoint")
        await self._throttle()
        r = await self._auth.request("GET", path, params=params)
        return _json_or_raise(r, path)

    async def _post_auth(self, path: str, body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self._auth:
            raise AvanzaAuthError("auth required for this endpoint")
        await self._throttle()
        r = await self._auth.request("POST", path, json_body=body)
        return _json_or_raise(r, path)

    async def _delete_auth(self, path: str) -> Dict[str, Any]:
        if not self._auth:
            raise AvanzaAuthError("auth required for this endpoint")
        await self._throttle()
        r = await self._auth.request("DELETE", path)
        return _json_or_raise(r, path)

    def _trade_guard(self, confirm: bool) -> None:
        if not self._enable_trading:
            raise AvanzaTradingDisabled(
                "Trading is disabled. Set AVANZA_TRADING_ENABLED=true to opt in."
            )
        if not confirm:
            raise AvanzaTradingDisabled(
                "Trading writes require explicit confirm=True from the caller."
            )

    # ------------------------------------------------------------------
    # §4.1 market data — instrument info (anonymous)
    # ------------------------------------------------------------------

    async def market_guide(self, instrument_type: str, orderbook_id: str) -> Dict[str, Any]:
        instrument_type = _validate_instrument_type(instrument_type)
        return await self._get_anon(f"/_api/market-guide/{instrument_type}/{orderbook_id}")

    async def market_guide_details(self, instrument_type: str, orderbook_id: str) -> Dict[str, Any]:
        instrument_type = _validate_instrument_type(instrument_type)
        return await self._get_anon(
            f"/_api/market-guide/{instrument_type}/{orderbook_id}/details"
        )

    async def etf_screener_data(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_anon(
            f"/_api/market-etf-screener/etf-screener-additional-data/{orderbook_id}"
        )

    async def fund_guide(self, fund_id: str) -> Dict[str, Any]:
        return await self._get_anon(f"/_api/fund-guide/guide/{fund_id}")

    # ------------------------------------------------------------------
    # §4.2 price/chart (anonymous)
    # ------------------------------------------------------------------

    async def price_chart(
        self,
        orderbook_id: str,
        time_period: str = "one_year",
        resolution: Optional[str] = None,
    ) -> Dict[str, Any]:
        params: Dict[str, str] = {"timePeriod": time_period}
        if resolution:
            params["resolution"] = resolution
        return await self._get_anon(f"/_api/price-chart/stock/{orderbook_id}", params=params)

    # ------------------------------------------------------------------
    # §4.3 order book / live quote (anonymous)
    # ------------------------------------------------------------------

    async def order_book(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_anon(f"/_api/order-book/{orderbook_id}")

    async def market_data(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_anon(f"/_api/market-data/{orderbook_id}")

    # ------------------------------------------------------------------
    # §4.4 fundamentals (cookie/auth required)
    # ------------------------------------------------------------------

    async def key_ratios(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_auth(
            f"/_api/market-stock-analysis/analysis/{orderbook_id}"
        )

    # ------------------------------------------------------------------
    # §4.5 news / forum
    # ------------------------------------------------------------------

    async def news(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_anon(f"/_api/market-news/orderbook/{orderbook_id}")

    async def forum_posts(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_anon(f"/_api/forum-api/forum/orderbooks/{orderbook_id}")

    # ------------------------------------------------------------------
    # §4.6 search
    # ------------------------------------------------------------------

    async def search(
        self,
        query: str,
        instrument_types: Optional[List[str]] = None,
        size: int = 10,
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            "query": query,
            "pagination": {"from": 0, "size": size},
        }
        if instrument_types:
            body["searchFilter"] = {"types": [t.upper() for t in instrument_types]}
        return await self._post_anon("/_api/search/filtered-search", body)

    # ------------------------------------------------------------------
    # §4.7 inspiration lists (anonymous)
    # ------------------------------------------------------------------

    async def inspiration_lists(self) -> Dict[str, Any]:
        return await self._get_anon("/_api/marketing/inspiration-lists/")

    async def inspiration_list(self, list_id: str) -> Dict[str, Any]:
        return await self._get_anon(f"/_api/marketing/inspiration-lists/{list_id}")

    # ------------------------------------------------------------------
    # §4.8 account / portfolio (auth required)
    # ------------------------------------------------------------------

    async def account_overview(self) -> Dict[str, Any]:
        return await self._get_auth("/_api/account-overview/overview/categorizedAccounts")

    async def positions(self) -> Dict[str, Any]:
        return await self._get_auth("/_api/positions")

    async def performance_chart(
        self,
        scrambled_account_ids: List[str],
        time_period: str = "one_year",
    ) -> Dict[str, Any]:
        return await self._post_auth(
            "/_api/performance-chart-api/account-performance-chart",
            {"scrambledAccountIds": scrambled_account_ids, "timePeriod": time_period},
        )

    async def credit_info(self, kind: str = "credited") -> Dict[str, Any]:
        if kind not in ("credited", "uncredited"):
            raise ValueError("kind must be 'credited' or 'uncredited'")
        return await self._get_auth(f"/_api/account-credit/credit-info/{kind}")

    async def watchlists(self) -> Dict[str, Any]:
        return await self._get_auth("/_api/usercontent/watchlist")

    async def add_to_watchlist(self, watchlist_id: str, instrument_id: str) -> Dict[str, Any]:
        return await self._post_auth(
            f"/_api/usercontent/watchlist/{watchlist_id}/orderbooks/{instrument_id}",
        )

    async def remove_from_watchlist(self, watchlist_id: str, instrument_id: str) -> Dict[str, Any]:
        return await self._delete_auth(
            f"/_api/usercontent/watchlist/{watchlist_id}/orderbooks/{instrument_id}",
        )

    async def insights_development(
        self, account_ids: List[str], time_period: str = "one_year"
    ) -> Dict[str, Any]:
        return await self._post_auth(
            "/_api/insights-development",
            {"accountIds": account_ids, "timePeriod": time_period},
        )

    async def transactions(
        self,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        isin: Optional[str] = None,
        transaction_types: Optional[List[str]] = None,
        max_elements: int = 1000,
    ) -> Dict[str, Any]:
        params: Dict[str, str] = {"maxElements": str(max_elements)}
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date
        if isin:
            params["isin"] = isin
        if transaction_types:
            params["transactionTypes"] = ",".join(transaction_types)
        return await self._get_auth(
            "/_api/account-transactions/transactions/details", params=params
        )

    async def customer_offers(self) -> Dict[str, Any]:
        return await self._get_auth("/_api/customer-offer-api/offers")

    async def get_price_alert(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_auth(f"/_api/price-alert/{orderbook_id}")

    # ------------------------------------------------------------------
    # §4.9 trading (auth + enable_trading + confirm)
    # ------------------------------------------------------------------

    async def place_order(self, order: Dict[str, Any], confirm: bool) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._post_auth("/_api/trading-critical/rest/order/new", order)

    async def edit_order(self, order: Dict[str, Any], confirm: bool) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._post_auth("/_api/trading-critical/rest/order/edit", order)

    async def cancel_order(self, payload: Dict[str, Any], confirm: bool) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._post_auth("/_api/trading-critical/rest/order/delete", payload)

    async def get_order(self, order_id: str) -> Dict[str, Any]:
        return await self._get_auth(f"/_api/trading-critical/rest/order/{order_id}")

    async def buy_fund(self, payload: Dict[str, Any], confirm: bool) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._post_auth("/_api/trading-critical/rest/order/fund/buy", payload)

    async def sell_fund(self, payload: Dict[str, Any], confirm: bool) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._post_auth("/_api/trading-critical/rest/order/fund/sell", payload)

    async def list_stoploss(self) -> Dict[str, Any]:
        return await self._get_auth("/_api/trading-critical/rest/stoploss")

    async def place_stoploss(self, payload: Dict[str, Any], confirm: bool) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._post_auth("/_api/trading-critical/rest/stoploss", payload)

    async def cancel_stoploss(self, account_id: str, stoploss_id: str, confirm: bool) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._delete_auth(
            f"/_api/trading-critical/rest/stoploss/{account_id}/{stoploss_id}"
        )

    async def set_price_alert(
        self, orderbook_id: str, payload: Dict[str, Any], confirm: bool
    ) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._post_auth(f"/_api/price-alert/{orderbook_id}", payload)

    async def delete_price_alert(self, orderbook_id: str, confirm: bool) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._delete_auth(f"/_api/price-alert/{orderbook_id}")


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _validate_instrument_type(t: str) -> str:
    t = (t or "").strip().lower()
    if t not in _INSTRUMENT_TYPES:
        raise ValueError(
            f"unknown instrument_type '{t}'; expected one of {sorted(_INSTRUMENT_TYPES)}"
        )
    return t


def _json_or_raise(r: httpx.Response, path: str) -> Dict[str, Any]:
    if r.status_code in (401, 403):
        raise AvanzaAuthError(f"{r.status_code} on {path}")
    if r.status_code >= 400:
        raise httpx.HTTPStatusError(
            f"avanza {path} -> {r.status_code}: {r.text[:200]}", request=r.request, response=r
        )
    if not r.content:
        return {}
    try:
        data = r.json()
        return data if isinstance(data, dict) else {"data": data}
    except Exception as e:
        raise RuntimeError(f"avanza {path}: invalid JSON ({e})") from e
