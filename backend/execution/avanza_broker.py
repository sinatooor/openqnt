"""
AvanzaBroker — execution adapter for Avanza (Swedish broker, undocumented `_api`).

Implements the same sync `Broker` protocol as `PaperBroker`, `IBKRBroker`,
`AlpacaBroker`. The underlying `AvanzaClient` is async (httpx), so this
class owns a private event loop running in a daemon thread and bridges
each Broker call through `asyncio.run_coroutine_threadsafe(...).result()`.

Why a dedicated loop instead of `asyncio.run(...)` per call:
  - AvanzaClient is stateful (httpx async session, TOTP-derived session
    cookies, throttle clock). `asyncio.run()` drops the loop after every
    call → the singleton `httpx.AsyncClient` (bound to the previous loop)
    becomes unusable, and the session cookies / X-SecurityToken would
    need to be re-issued on every order.
  - `loop.run_until_complete()` can't be called from inside FastAPI's
    own running loop.

Trading is gated twice (same as `routers/integrations.py`):
  - env `AVANZA_TRADING_ENABLED=true` (the client checks this)
  - `confirm=True` on every write (this broker passes it)

Symbol semantics for v1: the Order node's `symbol` field is expected to
hold the Avanza orderbookId directly. v2 will reuse the resolver from
`backend/strategy_flow/backtrader_engine.py:_fetch_data_avanza`.
"""
from __future__ import annotations

import asyncio
import logging
import os
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from .schema import (
    AccountSnapshot,
    Order,
    OrderSide,
    OrderStatus,
    OrderType,
    Position,
)

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = float(os.getenv("AVANZA_BROKER_TIMEOUT", "20.0"))


class AvanzaBroker:
    name = "avanza"

    def __init__(self, account_key: str = "default") -> None:
        self._account_key = account_key
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._loop_thread: Optional[threading.Thread] = None
        self._client = None  # type: ignore[assignment]   # AvanzaClient (async)
        self._default_account_id: Optional[str] = os.getenv("AVANZA_DEFAULT_ACCOUNT_ID")
        self._lock = threading.Lock()

    # ── async/sync bridge ────────────────────────────────────────

    def _ensure_loop(self) -> asyncio.AbstractEventLoop:
        with self._lock:
            if self._loop is not None and not self._loop.is_closed():
                return self._loop
            loop = asyncio.new_event_loop()
            t = threading.Thread(
                target=loop.run_forever, daemon=True, name="avanza-loop"
            )
            t.start()
            self._loop = loop
            self._loop_thread = t
            return loop

    def _run(self, coro, timeout: float = _DEFAULT_TIMEOUT) -> Any:
        loop = self._ensure_loop()
        fut = asyncio.run_coroutine_threadsafe(coro, loop)
        return fut.result(timeout=timeout)

    # ── auth / client ────────────────────────────────────────────

    def _ensure_authenticated(self):
        if self._client is not None:
            return self._client
        from integrations.avanza.manager import get_manager

        self._client = self._run(
            get_manager().authed_client(self._account_key), timeout=15.0
        )
        return self._client

    # ── account-id resolution ────────────────────────────────────

    def _resolve_account_id(self) -> str:
        if self._default_account_id:
            return self._default_account_id
        # Walk account_overview() and pick the first non-fund equity account.
        overview = self._run(self._ensure_authenticated().account_overview())
        # Avanza returns a `categorizedAccounts` list of category groups.
        for cat in overview.get("categorizedAccounts") or overview.get("categories") or []:
            for acc in cat.get("accounts") or []:
                acc_id = (
                    acc.get("accountId")
                    or acc.get("id")
                    or acc.get("urlParameterId")
                )
                if acc_id:
                    self._default_account_id = str(acc_id)
                    return self._default_account_id
        raise RuntimeError("No Avanza account_id found in account_overview()")

    # ── Broker Protocol — quote ─────────────────────────────────

    def quote(self, symbol: str) -> Optional[float]:
        try:
            client = self._ensure_authenticated()
            md = self._run(client.market_data(symbol))
        except Exception as e:
            logger.warning("avanza quote(%s) failed: %s", symbol, e)
            return None
        for key in ("lastPrice", "closingPrice", "highestPrice", "lowestPrice"):
            v = md.get(key)
            if isinstance(v, dict):
                v = v.get("value")
            if isinstance(v, (int, float)) and v > 0:
                return float(v)
        return None

    # ── Broker Protocol — place_order ───────────────────────────

    def place_order(
        self,
        symbol: str,
        side: OrderSide,
        qty: float,
        type: OrderType = OrderType.MARKET,
        limit_price: Optional[float] = None,
    ) -> Order:
        order = Order(
            id=f"av_{uuid.uuid4().hex[:10]}",
            symbol=str(symbol),
            side=side,
            qty=qty,
            type=type,
            limit_price=limit_price,
            broker=self.name,
        )

        from integrations.avanza.client import AvanzaTradingDisabled

        try:
            client = self._ensure_authenticated()
            account_id = self._resolve_account_id()
        except Exception as e:
            order.status = OrderStatus.REJECTED
            order.rejected_reason = f"Avanza auth/account failed: {e}"
            self._audit(order, payload=None, response=None, status="error")
            return order

        # Determine order price. Avanza requires a numeric price even for
        # market-style sweeps; we use the last quote when no limit_price.
        price = limit_price
        if price is None:
            price = self.quote(symbol)
        if price is None or price <= 0:
            order.status = OrderStatus.REJECTED
            order.rejected_reason = "could not resolve price (no quote, no limit_price)"
            self._audit(order, payload=None, response=None, status="error")
            return order

        valid_until = (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
        payload: Dict[str, Any] = {
            "accountId": account_id,
            "orderbookId": str(symbol),
            "side": "BUY" if side == OrderSide.BUY else "SELL",
            "price": float(price),
            "volume": float(qty),
            "validUntil": valid_until,
        }
        if type == OrderType.LIMIT:
            payload["orderType"] = "LIMIT"

        try:
            result = self._run(client.place_order(payload, confirm=True))
        except AvanzaTradingDisabled as e:
            order.status = OrderStatus.REJECTED
            order.rejected_reason = f"trading disabled: {e}"
            self._audit(order, payload=payload, response=None, status="disabled")
            return order
        except Exception as e:
            order.status = OrderStatus.REJECTED
            order.rejected_reason = f"Avanza place_order failed: {e}"
            self._audit(order, payload=payload, response=None, status="error")
            return order

        # Avanza is async-fill: the response carries an orderId; status is
        # not "filled" yet. Leave as PENDING; the UI/runner can poll.
        order_id = (
            result.get("orderId")
            or result.get("orderRequestStatus", {}).get("orderId")
            or order.id
        )
        order.id = f"av_{order_id}"
        order.status = OrderStatus.PENDING
        self._audit(order, payload=payload, response=result, status="ok")
        return order

    # ── Broker Protocol — get_account ───────────────────────────

    def get_account(self) -> AccountSnapshot:
        empty = AccountSnapshot(
            cash=0.0, equity=0.0, buying_power=0.0,
            realised_pnl=0.0, unrealised_pnl=0.0, broker=self.name,
        )
        try:
            client = self._ensure_authenticated()
            overview = self._run(client.account_overview())
            positions_resp = self._run(client.positions())
        except Exception as e:
            logger.warning("avanza get_account failed: %s", e)
            return empty

        cash = 0.0
        equity = 0.0
        unreal = 0.0
        for cat in overview.get("categorizedAccounts") or overview.get("categories") or []:
            for acc in cat.get("accounts") or []:
                tv = acc.get("totalValue") or {}
                bv = acc.get("buyingPower") or {}
                cash += _num(bv.get("value") if isinstance(bv, dict) else bv)
                equity += _num(tv.get("value") if isinstance(tv, dict) else tv)
                unreal += _num(acc.get("totalProfit", {}).get("value") if isinstance(acc.get("totalProfit"), dict) else acc.get("totalProfit"))

        positions: list[Position] = []
        # `positions_resp` shape: {withOrderbook: [...], withoutOrderbook: [...], cashPositions: [...]}
        for raw in (positions_resp.get("withOrderbook") or []):
            ob = raw.get("orderbook") or {}
            qty = _num(raw.get("volume"))
            if qty == 0:
                continue
            avg_price = _num(raw.get("averageAcquiredPrice", {}).get("value") if isinstance(raw.get("averageAcquiredPrice"), dict) else raw.get("averageAcquiredPrice"))
            last_price = _num(ob.get("lastPrice", {}).get("value") if isinstance(ob.get("lastPrice"), dict) else ob.get("lastPrice"))
            positions.append(Position(
                symbol=str(ob.get("id") or raw.get("orderbookId") or ""),
                qty=qty,
                avg_price=avg_price,
                last_price=last_price,
                unrealised_pnl=(last_price - avg_price) * qty if last_price and avg_price else 0.0,
                realised_pnl=0.0,
            ))

        return AccountSnapshot(
            cash=cash,
            equity=equity,
            buying_power=cash,
            realised_pnl=0.0,
            unrealised_pnl=unreal,
            positions=positions,
            broker=self.name,
        )

    # ── Broker Protocol — close_all ─────────────────────────────

    def close_all(self) -> list[Order]:
        snap = self.get_account()
        closed: list[Order] = []
        for p in snap.positions:
            if p.qty == 0:
                continue
            side = OrderSide.SELL if p.qty > 0 else OrderSide.BUY
            closed.append(self.place_order(
                p.symbol, side, abs(p.qty), OrderType.MARKET,
            ))
        return closed

    def disconnect(self) -> None:
        with self._lock:
            loop = self._loop
            self._loop = None
        if loop is not None and not loop.is_closed():
            loop.call_soon_threadsafe(loop.stop)

    # ── audit log ────────────────────────────────────────────────

    def _audit(
        self,
        order: Order,
        payload: Optional[Dict[str, Any]],
        response: Optional[Dict[str, Any]],
        status: str,
    ) -> None:
        try:
            from integrations.avanza.storage import get_storage
            get_storage().append_audit(
                account_key=self._account_key,
                action="place_order",
                orderbook_id=order.symbol,
                payload=payload,
                response=response,
                status=status,
            )
        except Exception as e:
            logger.warning("avanza audit append failed: %s", e)


def _num(v: Any) -> float:
    """Coerce Avanza's mixed numeric/string/dict values to float."""
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, dict):
        return _num(v.get("value"))
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def avanza_creds_present(account_key: str = "default") -> bool:
    """Mirror `ibkr_creds_present()` — true if either env creds or stored
    encrypted credentials exist for this account_key. Does NOT verify the
    credentials are valid (that happens lazily on first call)."""
    if os.getenv("AVANZA_USER") and os.getenv("AVANZA_PASS") and os.getenv("AVANZA_TOTP_SECRET"):
        return True
    try:
        from integrations.avanza.storage import get_storage
        return get_storage().load_credentials(account_key) is not None
    except Exception:
        return False
