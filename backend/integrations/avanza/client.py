"""
AvanzaClient — typed wrapper over the current `_api` endpoints.

Endpoint map updated from browser traffic capture (2026-05-23):
  OLD (broken)                              NEW (working)
  /_api/positions                       →  /_api/position-data/positions
  /_api/usercontent/watchlist           →  /_api/watchlist/watchlist
  /_api/account-transactions/…          →  /_api/transactions/dividends
  account id (numeric)                  →  urlParameterId (encrypted)

Trading writes are double-gated:
  - constructor flag `enable_trading` (off by default)
  - per-call `confirm=True` argument
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

from .auth import AvanzaAuth, AvanzaAuthError, AVANZA_BASE, _BROWSER_HEADERS

logger = logging.getLogger(__name__)

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
            http2=True,
            timeout=httpx.Timeout(20.0, connect=8.0),
            headers=_BROWSER_HEADERS,
            follow_redirects=True,
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
    # internal helpers
    # ------------------------------------------------------------------

    async def _throttle(self) -> None:
        async with self._req_lock:
            now = asyncio.get_event_loop().time()
            wait = (self._last_req_at + _REQUEST_GAP_SEC) - now
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_req_at = asyncio.get_event_loop().time()

    async def _get_anon(self, path: str, params: Optional[Dict[str, str]] = None) -> Any:
        await self._throttle()
        r = await self._anon.get(path, params=params)
        return _parse(r, path)

    async def _get_auth(self, path: str, params: Optional[Dict[str, str]] = None) -> Any:
        if not self._auth:
            raise AvanzaAuthError("auth required for this endpoint")
        await self._throttle()
        r = await self._auth.request("GET", path, params=params)
        return _parse(r, path)

    async def _post_auth(self, path: str, body: Optional[Dict[str, Any]] = None) -> Any:
        if not self._auth:
            raise AvanzaAuthError("auth required for this endpoint")
        await self._throttle()
        r = await self._auth.request("POST", path, json_body=body)
        return _parse(r, path)

    async def _delete_auth(self, path: str) -> Any:
        if not self._auth:
            raise AvanzaAuthError("auth required for this endpoint")
        await self._throttle()
        r = await self._auth.request("DELETE", path)
        return _parse(r, path)

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
    # Account / portfolio (auth required)
    # ------------------------------------------------------------------

    async def accounts_list(self) -> List[Dict[str, Any]]:
        """Returns list with id, name, accountType, urlParameterId per account."""
        result = await self._get_auth("/_api/account-overview/accounts/list")
        return result if isinstance(result, list) else result.get("data", [])

    async def account_overview(self) -> Dict[str, Any]:
        """Portfolio summary with categories, accounts, and loans."""
        return await self._get_auth("/_api/account-overview/overview/categorizedAccounts")

    async def positions(self) -> Dict[str, Any]:
        """All positions across all accounts."""
        return await self._get_auth("/_api/position-data/positions")

    async def positions_for_account(self, url_param_id: str) -> Dict[str, Any]:
        """Positions for a single account identified by its urlParameterId."""
        return await self._get_auth(f"/_api/position-data/positions/{url_param_id}")

    async def watchlists(self) -> List[Dict[str, Any]]:
        result = await self._get_auth("/_api/watchlist/watchlist")
        return result if isinstance(result, list) else result.get("data", [])

    async def add_to_watchlist(self, watchlist_id: str, orderbook_id: str) -> Dict[str, Any]:
        return await self._post_auth(
            f"/_api/watchlist/{watchlist_id}/orderbooks/{orderbook_id}"
        )

    async def remove_from_watchlist(self, watchlist_id: str, orderbook_id: str) -> Dict[str, Any]:
        return await self._delete_auth(
            f"/_api/watchlist/{watchlist_id}/orderbooks/{orderbook_id}"
        )

    async def transactions(
        self,
        account_url_param_id: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        max_elements: int = 200,
    ) -> Any:
        """
        Transaction history. Pass account_url_param_id for a single account,
        or omit for all accounts.
        """
        if account_url_param_id:
            path = f"/_api/account-transactions/transactions/details"
            params: Dict[str, str] = {"maxElements": str(max_elements)}
            if from_date:
                params["from"] = from_date
            if to_date:
                params["to"] = to_date
            return await self._get_auth(path, params=params)
        # Fall back to the dividends / all-transactions feed
        return await self._get_auth("/_api/transactions/dividends")

    # ------------------------------------------------------------------
    # Market data — anonymous
    # ------------------------------------------------------------------

    async def market_guide(self, instrument_type: str, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_anon(f"/_api/market-guide/{instrument_type}/{orderbook_id}")

    async def market_guide_details(self, instrument_type: str, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_anon(f"/_api/market-guide/{instrument_type}/{orderbook_id}/details")

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

    async def order_book(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_anon(f"/_api/order-book/{orderbook_id}")

    async def market_data(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_anon(f"/_api/market-data/{orderbook_id}")

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
        if not self._auth:
            await self._throttle()
            r = await self._anon.post("/_api/search/filtered-search", json=body)
            return _parse(r, "/_api/search/filtered-search")
        return await self._post_auth("/_api/search/filtered-search", body)

    async def news(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_anon(f"/_api/market-news/orderbook/{orderbook_id}")

    async def key_ratios(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_auth(f"/_api/market-stock-analysis/analysis/{orderbook_id}")

    async def get_price_alert(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_auth(f"/_api/alert/alerts")

    async def performance_chart(
        self,
        account_url_param_ids: List[str],
        time_period: str = "ONE_YEAR",
    ) -> Dict[str, Any]:
        """
        Portfolio value / performance over time across one or more accounts.
        timePeriod values seen in browser traffic:
          ONE_WEEK, ONE_MONTH, THREE_MONTHS, THIS_YEAR, ONE_YEAR, THREE_YEARS, ALL_TIME
        Returns: { valueSeries, absoluteSeries, relativeSeries, interval, ... }
        Each series is a list of { performance: {value, unit, ...}, timestamp }.
        """
        return await self._post_auth(
            "/_api/account-performance/overview/chart/accounts/timeperiod",
            {"scrambledAccountIds": account_url_param_ids, "timePeriod": time_period},
        )

    async def performance_totals(
        self,
        account_url_param_ids: List[str],
    ) -> Dict[str, Any]:
        """
        Current portfolio totals: totalValue, buyingPower, totalDevelopment (over multiple periods).
        Request body is a plain JSON array of account urlParameterIds.
        """
        return await self._post_auth(
            "/_api/account-performance/overview/total-values",
            account_url_param_ids,  # type: ignore[arg-type]
        )

    async def performance_keyratios(
        self,
        account_url_param_ids: List[str],
    ) -> Dict[str, Any]:
        """Sharpe ratio, std deviation, CAGR for the given accounts."""
        return await self._post_auth(
            "/_api/account-performance/overview/keyratios",
            account_url_param_ids,  # type: ignore[arg-type]
        )

    async def upcoming_dividends(self) -> Any:
        return await self._get_auth("/_api/account-company-events/dividends/upcoming")

    async def customer_calendar(self) -> Any:
        return await self._get_auth("/_api/customer-calendar/")

    async def transactions_list(
        self,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        max_elements: int = 1000,
    ) -> Dict[str, Any]:
        params: Dict[str, str] = {
            "maxElements": str(max_elements),
            "includeResult": "false",
        }
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date
        return await self._get_auth("/_api/transactions/list", params=params)

    async def stock_quote(self, orderbook_id: str) -> Dict[str, Any]:
        """Live-ish quote for a single instrument."""
        return await self._get_auth(f"/_api/market-guide/stock/{orderbook_id}/quote")

    async def market_index(self, index_id: str) -> Dict[str, Any]:
        """OMX, S&P 500 etc. by orderbook id."""
        return await self._get_anon(f"/_api/market-index/{index_id}")

    async def watchlist_data(
        self,
        watchlist_id: str,
        orderbook_ids: List[str],
        data_points: Optional[List[str]] = None,
    ) -> Any:
        """Fetch live quotes for all items in a watchlist."""
        body = {
            "watchListId": watchlist_id,
            "orderbookIds": orderbook_ids,
            "orderbookDataPoints": data_points or [
                "LAST_PRICE", "CHANGE", "CHANGE_PERCENTAGE",
                "BUY_PRICE", "SELL_PRICE", "HIGHEST_PRICE", "LOWEST_PRICE",
                "VOLUME_TRADED", "INSTRUMENT_TYPE",
            ],
        }
        return await self._post_auth("/_api/watchlist/data/by-id", body)

    async def user_note(self, orderbook_id: str) -> Any:
        return await self._get_auth(f"/_api/user-note/?orderbookId={orderbook_id}")

    async def user_notes_search(self, query: str) -> Any:
        return await self._get_auth(f"/_api/user-note/search?query={query}")

    async def user_notes_available_orderbooks(self) -> Any:
        """List of orderbooks that have user notes attached."""
        return await self._get_auth("/_api/user-note/available-orderbooks")

    async def market_overview_gainers(
        self,
        country_code: str = "SE",
        marketplaces: str = "SE.XSTO",
    ) -> Dict[str, Any]:
        params = {"countryCode": country_code, "marketplaces": marketplaces}
        return await self._get_anon("/_api/market-overview/data/gainers", params=params)

    async def market_overview_losers(
        self,
        country_code: str = "SE",
        marketplaces: str = "SE.XSTO",
    ) -> Dict[str, Any]:
        params = {"countryCode": country_code, "marketplaces": marketplaces}
        return await self._get_anon("/_api/market-overview/data/losers", params=params)

    async def market_overviews(self) -> Any:
        """High-level configured overviews (indexes by region)."""
        return await self._get_anon("/_api/market-overview/overviews")

    async def account_overview_for(self, url_param_id: str) -> Dict[str, Any]:
        """Single-account detail: balance, totalValue, performance breakdown."""
        return await self._get_auth(f"/_api/account-overview/overview/account/{url_param_id}")

    async def stock_orderdepth(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_auth(f"/_api/market-guide/stock/{orderbook_id}/orderdepth")

    async def stock_trades(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_auth(f"/_api/market-guide/stock/{orderbook_id}/trades")

    async def stock_holdings(self, orderbook_id: str) -> Dict[str, Any]:
        return await self._get_auth(f"/_api/market-guide/stock/{orderbook_id}/holdings")

    # ------------------------------------------------------------------
    # Trading (auth + enable_trading + confirm)
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

    async def buy_fund(self, payload: Dict[str, Any], confirm: bool) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._post_auth("/_api/trading-critical/rest/order/fund/buy", payload)

    async def sell_fund(self, payload: Dict[str, Any], confirm: bool) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._post_auth("/_api/trading-critical/rest/order/fund/sell", payload)

    async def list_stoploss(self) -> Dict[str, Any]:
        return await self._get_auth("/_api/trading/stoploss/")

    async def place_stoploss(self, payload: Dict[str, Any], confirm: bool) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._post_auth("/_api/trading-critical/rest/stoploss", payload)

    async def cancel_stoploss(self, account_id: str, stoploss_id: str, confirm: bool) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._delete_auth(
            f"/_api/trading-critical/rest/stoploss/{account_id}/{stoploss_id}"
        )

    async def set_price_alert(self, orderbook_id: str, payload: Dict[str, Any], confirm: bool) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._post_auth(f"/_api/price-alert/{orderbook_id}", payload)

    async def delete_price_alert(self, orderbook_id: str, confirm: bool) -> Dict[str, Any]:
        self._trade_guard(confirm)
        return await self._delete_auth(f"/_api/price-alert/{orderbook_id}")


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _parse(r: httpx.Response, path: str) -> Any:
    if r.status_code in (401, 403):
        raise AvanzaAuthError(f"{r.status_code} on {path}")
    if r.status_code >= 400:
        raise httpx.HTTPStatusError(
            f"avanza {path} -> {r.status_code}: {r.text[:200]}",
            request=r.request,
            response=r,
        )
    if not r.content:
        return {}
    try:
        return r.json()
    except Exception as e:
        raise RuntimeError(f"avanza {path}: invalid JSON ({e})") from e
