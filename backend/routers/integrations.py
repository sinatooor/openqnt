"""
Backend REST routes that drive the Settings UI's Avanza connection card,
the per-user portfolio sync flow, and (gated by AVANZA_TRADING_ENABLED) the
trading endpoints.

Single-user-friendly: the FastAPI backend doesn't enforce auth itself, so
we identify accounts by an `X-Account-Key` header, falling back to
"default" when absent. The orchestrator at port 3000 is expected to set
the header to the authenticated user-id when proxying.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from integrations.avanza.auth import AvanzaAuth, AvanzaAuthError
from integrations.avanza.client import AvanzaClient, AvanzaTradingDisabled
from integrations.avanza.manager import get_manager
from integrations.avanza.normalize import (
    positions_from_avanza,
    watchlists_from_avanza,
)
from integrations.avanza.storage import get_storage
from integrations.ibkr.manager import get_ibkr_manager
from integrations.ibkr.storage import get_ibkr_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

DEFAULT_ACCOUNT_KEY = "default"


def _account_key(x_account_key: Optional[str]) -> str:
    return (x_account_key or DEFAULT_ACCOUNT_KEY).strip() or DEFAULT_ACCOUNT_KEY


def _trading_enabled() -> bool:
    return os.getenv("AVANZA_TRADING_ENABLED", "false").lower() in {"1", "true", "yes"}


# ---------------------------------------------------------------------------
# Pydantic request/response models
# ---------------------------------------------------------------------------

class AvanzaConnectRequest(BaseModel):
    username: str
    password: str
    totpSecret: str = Field(..., alias="totpSecret")

    class Config:
        populate_by_name = True


class AvanzaStatusResponse(BaseModel):
    connected: bool
    connectedAt: Optional[str] = None
    lastSyncAt: Optional[str] = None
    error: Optional[str] = None
    accounts: List[Dict[str, Any]] = []
    tradingEnabled: bool = False


class AvanzaSyncResponse(BaseModel):
    positions: int
    watchlists: int
    transactions: int
    syncedAt: str


class OrderRequest(BaseModel):
    accountId: str
    orderbookId: str
    side: str  # BUY or SELL
    price: float
    volume: float
    validUntil: Optional[str] = None
    confirmed: bool = False
    orderType: Optional[str] = None
    openVolume: Optional[float] = None


class FundOrderRequest(BaseModel):
    accountId: str
    orderbookId: str
    amount: Optional[float] = None
    sharesPercent: Optional[float] = None
    confirmed: bool = False


class StopLossRequest(BaseModel):
    payload: Dict[str, Any]
    confirmed: bool = False


class PriceAlertRequest(BaseModel):
    payload: Dict[str, Any]
    confirmed: bool = False


# ---------------------------------------------------------------------------
# Connect / status / disconnect
# ---------------------------------------------------------------------------

@router.post("/avanza/connect", response_model=AvanzaStatusResponse)
async def connect_avanza(
    body: AvanzaConnectRequest,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> AvanzaStatusResponse:
    account_key = _account_key(x_account_key)
    storage = get_storage()
    manager = get_manager()

    # Trial-login first so we surface bad credentials immediately.
    try:
        auth = AvanzaAuth(
            username=body.username,
            password=body.password,
            totp_secret=body.totpSecret,
        )
        await auth.session()
    except AvanzaAuthError as e:
        raise HTTPException(401, f"Avanza login failed: {e}")
    except Exception as e:
        raise HTTPException(502, f"Avanza connection error: {e}")
    finally:
        try:
            await auth.aclose()  # type: ignore[possibly-undefined]
        except Exception:
            pass

    storage.store_credentials(
        account_key,
        {
            "username": body.username,
            "password": body.password,
            "totp_secret": body.totpSecret,
        },
    )
    await manager.reset(account_key)
    return await _build_status(account_key)


@router.post("/avanza/disconnect")
async def disconnect_avanza(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    storage = get_storage()
    manager = get_manager()
    storage.delete_credentials(account_key)
    await manager.reset(account_key)
    return {"ok": True}


@router.get("/avanza/status", response_model=AvanzaStatusResponse)
async def status_avanza(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> AvanzaStatusResponse:
    account_key = _account_key(x_account_key)
    return await _build_status(account_key)


async def _build_status(account_key: str) -> AvanzaStatusResponse:
    storage = get_storage()
    row = storage.status_row(account_key)
    accounts: List[Dict[str, Any]] = []
    if row:
        try:
            client = await get_manager().authed_client(account_key)
            # New API: /_api/account-overview/accounts/list returns a flat list
            acc_list = await client.accounts_list()
            for acc in (acc_list if isinstance(acc_list, list) else []):
                name_raw = acc.get("name")
                if isinstance(name_raw, dict):
                    name = name_raw.get("userDefinedName") or name_raw.get("defaultName") or str(acc.get("id") or "")
                else:
                    name = str(name_raw or acc.get("id") or "")
                accounts.append({
                    "id": str(acc.get("id") or ""),
                    "urlParameterId": str(acc.get("urlParameterId") or ""),
                    "name": name,
                    "type": acc.get("accountType") or acc.get("type"),
                    "totalValue": None,
                    "currency": "SEK",
                })
        except Exception as e:
            logger.warning("avanza status failed: %s", e)
    return AvanzaStatusResponse(
        connected=row is not None,
        connectedAt=row["connected_at"] if row else None,
        lastSyncAt=row["last_sync_at"] if row else None,
        error=row["last_error"] if row else None,
        accounts=accounts,
        tradingEnabled=_trading_enabled(),
    )


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------

@router.post("/avanza/sync", response_model=AvanzaSyncResponse)
async def sync_avanza(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> AvanzaSyncResponse:
    account_key = _account_key(x_account_key)
    storage = get_storage()
    if not storage.load_credentials(account_key):
        raise HTTPException(404, "Avanza is not connected for this account")
    client = await get_manager().authed_client(account_key)

    positions_payload: Any = {}
    watchlists_payload: Any = []
    transactions_payload: Any = []
    try:
        # Fetch sequentially — Avanza drops connections on burst requests
        positions_payload = await client.positions()
        watchlists_payload = await client.watchlists()
        transactions_payload = await client.transactions()
    except AvanzaAuthError as e:
        storage.mark_sync(account_key, error=str(e))
        raise HTTPException(401, f"Avanza session invalid: {e}")
    except Exception as e:
        storage.mark_sync(account_key, error=str(e))
        raise HTTPException(502, f"Avanza sync failed: {e}")

    positions = positions_from_avanza(positions_payload)
    watchlists = watchlists_from_avanza(watchlists_payload)
    transactions = _normalize_transactions(transactions_payload)

    storage.replace_positions(account_key, positions)
    storage.replace_watchlists(account_key, watchlists)
    storage.upsert_transactions(account_key, transactions)
    storage.mark_sync(account_key, error=None)

    now = datetime.now(timezone.utc).isoformat()
    return AvanzaSyncResponse(
        positions=len(positions),
        watchlists=len(watchlists),
        transactions=len(transactions),
        syncedAt=now,
    )


def _normalize_transactions(payload: Any) -> List[Dict[str, Any]]:
    # New API returns a flat list; old API returned a dict with a "transactions" key
    if isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        items = payload.get("transactions") or payload.get("items") or []
    else:
        items = []

    out: List[Dict[str, Any]] = []
    for t in items:
        if not isinstance(t, dict):
            continue
        ob = t.get("orderbook") or {}
        # New dividend format uses isin as a stable identifier; old used id/transactionId
        txid = str(
            t.get("id") or t.get("transactionId")
            or f"{t.get('accountId','')}-{t.get('isin','')}-{t.get('date','')}"
            or ""
        )
        out.append({
            "transaction_id": txid,
            "account_id": str(t.get("accountId") or t.get("encryptedAccountId") or ""),
            "orderbook_id": str(ob.get("id") or t.get("orderbookId") or ""),
            "type": t.get("type") or t.get("transactionType") or "DIVIDEND",
            "amount": _num(t.get("amountInSek") or t.get("totalAmount") or t.get("amount")),
            "currency": t.get("transactionCurrency") or t.get("currency") or "SEK",
            "executed_at": t.get("date") or t.get("transactionDate") or t.get("verificationDate"),
            "raw": t,
        })
    return [r for r in out if r["transaction_id"]]


# ---------------------------------------------------------------------------
# Read endpoints
# ---------------------------------------------------------------------------

@router.get("/avanza/positions")
async def get_positions(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
    refresh: bool = False,
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    storage = get_storage()
    if refresh and storage.load_credentials(account_key):
        try:
            await sync_avanza(x_account_key)  # type: ignore[arg-type]
        except HTTPException:
            pass
    rows = storage.list_positions(account_key)
    return {"positions": [_position_view(r) for r in rows]}


def _position_view(row: Dict[str, Any]) -> Dict[str, Any]:
    quantity = row.get("quantity") or 0
    avg = row.get("average_price")
    last = row.get("last_price")
    unrealized = (
        (last - avg) * quantity if (avg is not None and last is not None and quantity) else None
    )
    pct = ((last - avg) / avg * 100) if (avg and last) else None
    return {
        "accountId": row.get("account_id"),
        "orderbookId": row.get("orderbook_id"),
        "symbol": row.get("symbol"),
        "name": row.get("name"),
        "quantity": quantity,
        "averagePrice": avg,
        "lastPrice": last,
        "marketValue": row.get("market_value"),
        "currency": row.get("currency"),
        "unrealizedPnl": unrealized,
        "unrealizedPnlPercent": pct,
    }


# ---------------------------------------------------------------------------
# Performance / chart data (Portfolio Value Over Time, totals, key ratios)
# ---------------------------------------------------------------------------

async def _account_param_ids(account_key: str) -> List[str]:
    """Returns the list of urlParameterIds for all known accounts."""
    client = await get_manager().authed_client(account_key)
    acc_list = await client.accounts_list()
    return [
        str(a.get("urlParameterId"))
        for a in (acc_list if isinstance(acc_list, list) else [])
        if a.get("urlParameterId")
    ]


@router.get("/avanza/performance/chart")
async def get_performance_chart(
    timePeriod: str = "ONE_YEAR",
    accountId: Optional[str] = None,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    """
    Portfolio value over time across all accounts (or a single account).
    timePeriod: ONE_WEEK | ONE_MONTH | THREE_MONTHS | THIS_YEAR | ONE_YEAR | THREE_YEARS | ALL_TIME
    Returns a simplified series the frontend can plot directly:
      { points: [{timestamp, totalValue, performance}], timePeriod, from, to }
    """
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    ids = [accountId] if accountId else await _account_param_ids(account_key)
    if not ids:
        return {"points": [], "timePeriod": timePeriod, "from": None, "to": None}

    try:
        raw = await client.performance_chart(ids, time_period=timePeriod)
    except AvanzaAuthError as e:
        raise HTTPException(401, str(e))

    value_series = raw.get("valueSeries") or []
    absolute_series = raw.get("absoluteSeries") or []
    interval = raw.get("interval") or {}

    points: List[Dict[str, Any]] = []
    for i, p in enumerate(value_series):
        if not isinstance(p, dict):
            continue
        perf = p.get("performance") or {}
        abs_perf = (absolute_series[i].get("performance") if i < len(absolute_series) and isinstance(absolute_series[i], dict) else {}) or {}
        points.append({
            "timestamp": p.get("timestamp"),
            "totalValue": _num(perf.get("value")),
            "performance": _num(abs_perf.get("value")),
        })

    return {
        "points": points,
        "timePeriod": raw.get("timePeriod") or timePeriod,
        "from": interval.get("from"),
        "to": interval.get("to"),
        "currency": "SEK",
    }


@router.get("/avanza/performance/totals")
async def get_performance_totals(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    ids = await _account_param_ids(account_key)
    if not ids:
        return {}
    try:
        return await client.performance_totals(ids)
    except AvanzaAuthError as e:
        raise HTTPException(401, str(e))


@router.get("/avanza/performance/keyratios")
async def get_performance_keyratios(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    ids = await _account_param_ids(account_key)
    if not ids:
        return {}
    try:
        return await client.performance_keyratios(ids)
    except AvanzaAuthError as e:
        raise HTTPException(401, str(e))


@router.get("/avanza/dividends/upcoming")
async def get_upcoming_dividends(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Any:
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    try:
        return await client.upcoming_dividends()
    except AvanzaAuthError as e:
        raise HTTPException(401, str(e))


@router.get("/avanza/calendar")
async def get_calendar(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Any:
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    try:
        return await client.customer_calendar()
    except AvanzaAuthError as e:
        raise HTTPException(401, str(e))


@router.get("/avanza/quote/{orderbook_id}")
async def get_stock_quote(
    orderbook_id: str,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    try:
        return await client.stock_quote(orderbook_id)
    except AvanzaAuthError as e:
        raise HTTPException(401, str(e))


@router.get("/avanza/index/{index_id}")
async def get_market_index(
    index_id: str,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    return await client.market_index(index_id)


# ---------------------------------------------------------------------------
# Market overview / per-stock detail / per-account / notes / watchlist quotes
# ---------------------------------------------------------------------------

@router.get("/avanza/market-overview")
async def get_market_overview(
    country_code: str = "SE",
    marketplaces: str = "SE.XSTO",
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    """Returns gainers + losers + index overviews in one call."""
    account_key = _account_key(x_account_key)
    storage = get_storage()
    client_factory = (
        get_manager().authed_client if storage.load_credentials(account_key)
        else get_manager().anon_client
    )
    client = await client_factory(account_key) if storage.load_credentials(account_key) else await get_manager().anon_client()
    gainers, losers, overviews = await asyncio.gather(
        client.market_overview_gainers(country_code=country_code, marketplaces=marketplaces),
        client.market_overview_losers(country_code=country_code, marketplaces=marketplaces),
        client.market_overviews(),
        return_exceptions=True,
    )
    def _safe(o: Any) -> Any:
        if isinstance(o, Exception):
            return {"error": str(o)}
        return o
    return {
        "gainers": _safe(gainers),
        "losers": _safe(losers),
        "overviews": _safe(overviews),
    }


@router.get("/avanza/stock/{orderbook_id}")
async def get_stock_detail(
    orderbook_id: str,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    """
    Merged per-stock detail: quote + details + orderdepth + trades + (optional) user note.
    Each sub-call is best-effort — partial failures still return the rest.
    """
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)

    async def _safe(coro):
        try:
            return await coro
        except Exception as e:
            return {"error": str(e)}

    quote, details, orderdepth, trades, note = await asyncio.gather(
        _safe(client.stock_quote(orderbook_id)),
        _safe(client.market_guide_details("stock", orderbook_id)),
        _safe(client.stock_orderdepth(orderbook_id)),
        _safe(client.stock_trades(orderbook_id)),
        _safe(client.user_note(orderbook_id)),
    )
    # Also fetch the top-level market-guide entry for instrument metadata
    info = await _safe(client.market_guide("stock", orderbook_id))
    return {
        "orderbookId": orderbook_id,
        "info": info,
        "quote": quote,
        "details": details,
        "orderdepth": orderdepth,
        "trades": trades,
        "note": note,
    }


@router.get("/avanza/account/{url_param_id}")
async def get_account_detail(
    url_param_id: str,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    """Per-account drill-down: overview + positions + per-account performance."""
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)

    async def _safe(coro):
        try:
            return await coro
        except Exception as e:
            return {"error": str(e)}

    overview, positions, totals = await asyncio.gather(
        _safe(client.account_overview_for(url_param_id)),
        _safe(client.positions_for_account(url_param_id)),
        _safe(client.performance_totals([url_param_id])),
    )
    return {
        "urlParameterId": url_param_id,
        "overview": overview,
        "positions": positions,
        "totals": totals,
    }


@router.post("/avanza/watchlist/quotes")
async def get_watchlist_quotes(
    body: Dict[str, Any],
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Any:
    watchlist_id = str(body.get("watchlistId") or body.get("watchlist_id") or "")
    orderbook_ids = body.get("orderbookIds") or body.get("orderbook_ids") or []
    if not watchlist_id or not orderbook_ids:
        raise HTTPException(400, "watchlistId and orderbookIds are required")
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    return await client.watchlist_data(
        watchlist_id=watchlist_id,
        orderbook_ids=[str(x) for x in orderbook_ids],
        data_points=body.get("dataPoints"),
    )


@router.get("/avanza/notes/all")
async def get_all_notes(
    query: Optional[str] = None,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Any:
    """List all orderbooks that have user notes, optionally filtered by query."""
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    if query:
        return await client.user_notes_search(query)
    return await client.user_notes_available_orderbooks()


@router.get("/avanza/notes/{orderbook_id}")
async def get_note_for(
    orderbook_id: str,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Any:
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    return await client.user_note(orderbook_id)


@router.get("/avanza/watchlists")
async def get_watchlists(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    return {"watchlists": get_storage().list_watchlists(account_key)}


@router.post("/avanza/watchlist/{watchlist_id}/add")
async def add_to_watchlist(
    watchlist_id: str,
    body: Dict[str, Any],
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    orderbook_id = str(body.get("orderbookId") or "")
    if not orderbook_id:
        raise HTTPException(400, "orderbookId required")
    client = await get_manager().authed_client(account_key)
    try:
        result = await client.add_to_watchlist(watchlist_id, orderbook_id)
    except AvanzaAuthError as e:
        raise HTTPException(401, str(e))
    return {"ok": True, "result": result}


@router.post("/avanza/watchlist/{watchlist_id}/remove")
async def remove_from_watchlist(
    watchlist_id: str,
    body: Dict[str, Any],
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    orderbook_id = str(body.get("orderbookId") or "")
    if not orderbook_id:
        raise HTTPException(400, "orderbookId required")
    client = await get_manager().authed_client(account_key)
    try:
        result = await client.remove_from_watchlist(watchlist_id, orderbook_id)
    except AvanzaAuthError as e:
        raise HTTPException(401, str(e))
    return {"ok": True, "result": result}


@router.get("/avanza/transactions")
async def get_transactions(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    isin: Optional[str] = None,
    types: Optional[str] = None,
    limit: int = 200,
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    transaction_types = [t.strip() for t in types.split(",")] if types else None
    try:
        payload = await client.transactions(
            from_date=from_date,
            to_date=to_date,
            isin=isin,
            transaction_types=transaction_types,
            max_elements=limit,
        )
    except AvanzaAuthError as e:
        raise HTTPException(401, str(e))
    return payload


# ---------------------------------------------------------------------------
# Trading writes (gated)
# ---------------------------------------------------------------------------

def _require_confirmed(flag: bool) -> None:
    if not flag:
        raise HTTPException(400, "set 'confirmed': true to send a trade write")


@router.post("/avanza/orders")
async def place_order(
    body: OrderRequest,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    _require_confirmed(body.confirmed)
    account_key = _account_key(x_account_key)
    storage = get_storage()
    client = await get_manager().authed_client(account_key)

    payload = {
        "accountId": body.accountId,
        "orderbookId": body.orderbookId,
        "side": body.side.upper(),
        "price": body.price,
        "volume": body.volume,
    }
    if body.validUntil:
        payload["validUntil"] = body.validUntil
    if body.orderType:
        payload["orderType"] = body.orderType
    if body.openVolume is not None:
        payload["openVolume"] = body.openVolume

    try:
        result = await client.place_order(payload, confirm=True)
        storage.append_audit(account_key, "place_order", body.orderbookId, payload, result, "ok")
        return {"ok": True, "result": result}
    except AvanzaTradingDisabled as e:
        storage.append_audit(account_key, "place_order", body.orderbookId, payload, None, "disabled")
        raise HTTPException(409, str(e))
    except (AvanzaAuthError, httpx.HTTPStatusError) as e:
        storage.append_audit(account_key, "place_order", body.orderbookId, payload, None, "error")
        raise HTTPException(502, str(e))


@router.patch("/avanza/orders/{order_id}")
async def edit_order(
    order_id: str,
    body: Dict[str, Any],
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    _require_confirmed(bool(body.get("confirmed")))
    account_key = _account_key(x_account_key)
    storage = get_storage()
    client = await get_manager().authed_client(account_key)
    payload = {**body, "orderId": order_id}
    payload.pop("confirmed", None)
    try:
        result = await client.edit_order(payload, confirm=True)
        storage.append_audit(account_key, "edit_order", payload.get("orderbookId"), payload, result, "ok")
        return {"ok": True, "result": result}
    except AvanzaTradingDisabled as e:
        raise HTTPException(409, str(e))
    except (AvanzaAuthError, httpx.HTTPStatusError) as e:
        raise HTTPException(502, str(e))


@router.delete("/avanza/orders/{order_id}")
async def cancel_order(
    order_id: str,
    accountId: str,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    storage = get_storage()
    client = await get_manager().authed_client(account_key)
    payload = {"orderId": order_id, "accountId": accountId}
    try:
        result = await client.cancel_order(payload, confirm=True)
        storage.append_audit(account_key, "cancel_order", None, payload, result, "ok")
        return {"ok": True, "result": result}
    except AvanzaTradingDisabled as e:
        raise HTTPException(409, str(e))
    except (AvanzaAuthError, httpx.HTTPStatusError) as e:
        raise HTTPException(502, str(e))


@router.post("/avanza/funds/buy")
async def buy_fund(
    body: FundOrderRequest,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    _require_confirmed(body.confirmed)
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    payload = {
        "accountId": body.accountId,
        "orderbookId": body.orderbookId,
    }
    if body.amount is not None:
        payload["amount"] = body.amount
    if body.sharesPercent is not None:
        payload["sharesPercent"] = body.sharesPercent
    try:
        return {"ok": True, "result": await client.buy_fund(payload, confirm=True)}
    except AvanzaTradingDisabled as e:
        raise HTTPException(409, str(e))


@router.post("/avanza/funds/sell")
async def sell_fund(
    body: FundOrderRequest,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    _require_confirmed(body.confirmed)
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    payload = {
        "accountId": body.accountId,
        "orderbookId": body.orderbookId,
    }
    if body.amount is not None:
        payload["amount"] = body.amount
    if body.sharesPercent is not None:
        payload["sharesPercent"] = body.sharesPercent
    try:
        return {"ok": True, "result": await client.sell_fund(payload, confirm=True)}
    except AvanzaTradingDisabled as e:
        raise HTTPException(409, str(e))


@router.get("/avanza/stoploss")
async def list_stoploss(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    return await client.list_stoploss()


@router.post("/avanza/stoploss")
async def place_stoploss(
    body: StopLossRequest,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    _require_confirmed(body.confirmed)
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    try:
        return {"ok": True, "result": await client.place_stoploss(body.payload, confirm=True)}
    except AvanzaTradingDisabled as e:
        raise HTTPException(409, str(e))


@router.delete("/avanza/stoploss/{account_id}/{stoploss_id}")
async def cancel_stoploss(
    account_id: str,
    stoploss_id: str,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    try:
        return {"ok": True, "result": await client.cancel_stoploss(account_id, stoploss_id, confirm=True)}
    except AvanzaTradingDisabled as e:
        raise HTTPException(409, str(e))


@router.get("/avanza/price-alerts/{orderbook_id}")
async def get_price_alert(
    orderbook_id: str,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    return await client.get_price_alert(orderbook_id)


@router.post("/avanza/price-alerts/{orderbook_id}")
async def set_price_alert(
    orderbook_id: str,
    body: PriceAlertRequest,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    _require_confirmed(body.confirmed)
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    try:
        return {"ok": True, "result": await client.set_price_alert(orderbook_id, body.payload, confirm=True)}
    except AvanzaTradingDisabled as e:
        raise HTTPException(409, str(e))


@router.delete("/avanza/price-alerts/{orderbook_id}")
async def delete_price_alert(
    orderbook_id: str,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    client = await get_manager().authed_client(account_key)
    try:
        return {"ok": True, "result": await client.delete_price_alert(orderbook_id, confirm=True)}
    except AvanzaTradingDisabled as e:
        raise HTTPException(409, str(e))


# ---------------------------------------------------------------------------
# Push WebSocket — fan out Avanza CometD events to the browser
# ---------------------------------------------------------------------------

@router.websocket("/avanza/ws/quotes")
async def quotes_ws(
    websocket: WebSocket,
    orderbook_ids: str,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
):
    """
    Forwards live `/quotes/{id}` events from Avanza's push channel to the
    browser. The orderbook_ids query param is a comma-separated list.
    """
    await websocket.accept()
    account_key = _account_key(x_account_key)
    storage = get_storage()
    if not storage.load_credentials(account_key):
        await websocket.send_json({"error": "Avanza not connected"})
        await websocket.close()
        return

    if os.getenv("AVANZA_PUSH_ENABLED", "false").lower() not in {"1", "true", "yes"}:
        await websocket.send_json({"error": "AVANZA_PUSH_ENABLED is false"})
        await websocket.close()
        return

    try:
        from integrations.avanza.push import AvanzaPushClient
        from integrations.avanza.auth import AvanzaAuth

        creds = storage.load_credentials(account_key)
        if not creds:
            await websocket.send_json({"error": "Avanza credentials missing"})
            await websocket.close()
            return

        auth = AvanzaAuth(
            username=creds["username"],
            password=creds["password"],
            totp_secret=creds["totp_secret"],
        )
        push = AvanzaPushClient(auth)
        await push.connect()
        for ob in [x.strip() for x in orderbook_ids.split(",") if x.strip()]:
            await push.subscribe(f"/quotes/{ob}")

        async for msg in push.stream():
            try:
                await websocket.send_json(msg)
            except WebSocketDisconnect:
                break
            except Exception:
                continue
    except Exception as e:
        logger.warning("avanza push fanout failed: %s", e)
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _num(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ===========================================================================
# IBKR (Interactive Brokers) integration — parallel to Avanza
# ===========================================================================
#
# Wraps `backend/execution/ibkr_broker.py::IBKRBroker` (the production-ready
# ibapi wrapper used by /api/execution/* for trading) in the same HTTP shape
# as Avanza, so the Portfolio page / AI chat / strategy builder can treat
# both brokers uniformly.
#
# These endpoints work even when TWS is offline — `connect` returns 503
# with a clear message, and `status` reports {connected: false} without
# raising. The frontend renders a "Start TWS" empty state in that case.

class IbkrConnectRequest(BaseModel):
    host: str = "127.0.0.1"
    port: int = 7497   # TWS paper default
    clientId: int = Field(default=42, alias="clientId")
    accountId: Optional[str] = Field(default=None, alias="accountId")

    class Config:
        populate_by_name = True


class IbkrStatusResponse(BaseModel):
    connected: bool
    connectedAt: Optional[str] = None
    lastSyncAt: Optional[str] = None
    error: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    clientId: Optional[int] = None
    accountId: Optional[str] = None


@router.post("/ibkr/connect", response_model=IbkrStatusResponse)
async def connect_ibkr(
    body: IbkrConnectRequest,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> IbkrStatusResponse:
    account_key = _account_key(x_account_key)
    manager = get_ibkr_manager()
    try:
        await manager.connect(
            host=body.host,
            port=body.port,
            client_id=body.clientId,
            account_key=account_key,
        )
    except RuntimeError as e:
        # Surface as 503 — service unavailable rather than 500 (server bug)
        raise HTTPException(503, str(e))
    return await _ibkr_build_status(account_key)


@router.post("/ibkr/disconnect")
async def disconnect_ibkr(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    await get_ibkr_manager().disconnect(account_key)
    return {"ok": True}


@router.get("/ibkr/status", response_model=IbkrStatusResponse)
async def status_ibkr(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> IbkrStatusResponse:
    account_key = _account_key(x_account_key)
    # Try a best-effort reconnect from stored creds so a backend restart
    # doesn't force the user to re-click Connect.
    await get_ibkr_manager().ensure_connected_from_storage(account_key)
    return await _ibkr_build_status(account_key)


async def _ibkr_build_status(account_key: str) -> IbkrStatusResponse:
    storage = get_ibkr_storage()
    manager = get_ibkr_manager()
    row = storage.status_row(account_key)
    creds = storage.load_credentials(account_key) or {}
    return IbkrStatusResponse(
        connected=manager.is_connected(),
        connectedAt=row["connected_at"] if row else None,
        lastSyncAt=row["last_sync_at"] if row else None,
        error=row["last_error"] if row else None,
        host=str(creds.get("host")) if creds else None,
        port=int(creds["port"]) if creds.get("port") else None,
        clientId=int(creds["clientId"]) if creds.get("clientId") else None,
        accountId=row["last_account_id"] if row and row.get("last_account_id") else None,
    )


@router.post("/ibkr/sync")
async def sync_ibkr(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    """
    Forces a fresh account snapshot from TWS. Used by the Sync button.
    Returns counts so the UI can show a toast.
    """
    account_key = _account_key(x_account_key)
    manager = get_ibkr_manager()
    storage = get_ibkr_storage()
    if not manager.is_connected():
        if not await manager.ensure_connected_from_storage(account_key):
            raise HTTPException(503, "IBKR is not connected. Start TWS and connect first.")
    try:
        snap = await manager.get_account()
    except Exception as e:
        storage.mark_sync(account_key, error=str(e))
        raise HTTPException(502, f"IBKR sync failed: {e}")
    storage.mark_sync(account_key, error=None)
    now = datetime.now(timezone.utc).isoformat()
    return {
        "positions": len(snap.positions),
        "equity": snap.equity,
        "syncedAt": now,
    }


@router.get("/ibkr/positions")
async def get_ibkr_positions(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    manager = get_ibkr_manager()
    if not manager.is_connected():
        if not await manager.ensure_connected_from_storage(account_key):
            return {"positions": [], "connected": False}
    try:
        snap = await manager.get_account()
    except Exception as e:
        raise HTTPException(502, f"IBKR positions failed: {e}")
    return {
        "positions": [p.to_dict() for p in snap.positions],
        "connected": True,
        "asOf": snap.as_of,
    }


@router.get("/ibkr/account")
async def get_ibkr_account(
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    manager = get_ibkr_manager()
    if not manager.is_connected():
        if not await manager.ensure_connected_from_storage(account_key):
            return {
                "connected": False,
                "cash": 0.0,
                "equity": 0.0,
                "buying_power": 0.0,
                "unrealised_pnl": 0.0,
                "realised_pnl": 0.0,
                "positions": [],
                "broker": "ibkr",
            }
    try:
        snap = await manager.get_account()
    except Exception as e:
        raise HTTPException(502, f"IBKR account failed: {e}")
    return {**snap.to_dict(), "connected": True}


@router.get("/ibkr/quote/{symbol}")
async def get_ibkr_quote(
    symbol: str,
    x_account_key: Optional[str] = Header(default=None, alias="X-Account-Key"),
) -> Dict[str, Any]:
    account_key = _account_key(x_account_key)
    manager = get_ibkr_manager()
    if not manager.is_connected():
        if not await manager.ensure_connected_from_storage(account_key):
            raise HTTPException(503, "IBKR is not connected")
    price = await manager.quote(symbol)
    return {"symbol": symbol.upper(), "last": price}
