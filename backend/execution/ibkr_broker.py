"""
IBKRBroker — TWS / IB Gateway broker via the official `ibapi` package.

Default ports (set IB_PORT to override):
  7497  TWS Paper           (← project default)
  7496  TWS Live
  4002  IB Gateway Paper
  4001  IB Gateway Live

The class implements the same `Broker` protocol as `PaperBroker` and
`AlpacaBroker`, so `ExecutionRunner` doesn't know which one it's
holding. ibapi is asynchronous (every response is a callback into
`EWrapper`); this module wraps it in a thread + threading.Event handles
so the public methods are blocking and return plain dataclasses.

Usage from the runner side stays the same:

    broker = IBKRBroker()
    broker.connect()                       # explicit, fails fast on no TWS
    broker.place_order("AAPL", BUY, 5)     # → Order

Connection is *lazy* — the broker tries to connect on the first
quote/order/account call; subsequent calls reuse the same TCP socket.
Disconnect on shutdown via `broker.disconnect()` (the router calls
this on FastAPI shutdown).

Threat model: paper trading on a developer box, single-process. Not
designed for multi-tenant live deployment.
"""
from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from ibapi.client import EClient
from ibapi.contract import Contract
from ibapi.order import Order as IBOrder
from ibapi.wrapper import EWrapper

from .schema import (
    AccountSnapshot,
    Order,
    OrderSide,
    OrderStatus,
    OrderType,
    Position,
)

logger = logging.getLogger(__name__)

DEFAULT_HOST = os.getenv("IB_HOST", "127.0.0.1")
DEFAULT_PORT = int(os.getenv("IB_PORT", "7497"))   # TWS Paper
DEFAULT_CLIENT_ID = int(os.getenv("IB_CLIENT_ID", "42"))


def _stock_contract(symbol: str, exchange: str = "SMART", currency: str = "USD") -> Contract:
    c = Contract()
    c.symbol = symbol.upper()
    c.secType = "STK"
    c.exchange = exchange
    c.currency = currency
    return c


def _option_contract(
    symbol: str,
    expiry: str,
    strike: float,
    right: str,
    exchange: str = "SMART",
    currency: str = "USD",
    multiplier: str = "100",
) -> Contract:
    """
    Build an IBKR Contract for an equity option.

    Args:
        symbol:    Underlying ticker (e.g. "AAPL")
        expiry:    YYYYMMDD format (e.g. "20260619")
        strike:    Strike price (e.g. 150.0)
        right:     "C" / "CALL" / "P" / "PUT"
        exchange:  Defaults to SMART (lets IB pick the venue)
        currency:  Defaults to USD
        multiplier: Defaults to "100" (standard US listed options)
    """
    r = right.upper()
    if r in ("CALL", "C"):
        r = "C"
    elif r in ("PUT", "P"):
        r = "P"
    else:
        raise ValueError(f"option right must be C/P or CALL/PUT, got '{right}'")
    if len(expiry) != 8 or not expiry.isdigit():
        raise ValueError(f"expiry must be YYYYMMDD, got '{expiry}'")

    c = Contract()
    c.symbol = symbol.upper()
    c.secType = "OPT"
    c.exchange = exchange
    c.currency = currency
    c.lastTradeDateOrContractMonth = expiry
    c.strike = float(strike)
    c.right = r
    c.multiplier = multiplier
    return c


# ── EWrapper implementation ─────────────────────────────────


class _IBApp(EWrapper, EClient):
    """All ibapi callbacks land here. Wakes up the matching Event so the
    blocking facade method below can return."""

    def __init__(self) -> None:
        EClient.__init__(self, self)

        # Account state.
        self._account_lock = threading.Lock()
        self.account_values: dict[str, str] = {}
        self.positions: dict[str, dict] = {}    # symbol -> {qty, avg_cost}
        self._account_ready = threading.Event()
        self._positions_ready = threading.Event()

        # Quotes.
        self._quote_locks: dict[int, threading.Event] = {}
        self._quote_results: dict[int, float | None] = {}

        # Orders.
        self._order_lock = threading.Lock()
        self._next_order_id: int | None = None
        self._order_ready = threading.Event()
        self._order_status: dict[int, dict] = {}      # orderId -> latest status
        self._order_done: dict[int, threading.Event] = {}

        # Connection state.
        self._connect_done = threading.Event()
        self._connect_error: str | None = None
        self.next_req_id = 1000

        # Contract details (used to resolve underlying conId for option chain).
        self._contract_details: dict[int, list[dict]] = {}
        self._contract_details_done: dict[int, threading.Event] = {}

        # Option chain (reqSecDefOptParams).
        # Each request accumulates {exchange, expirations, strikes, multiplier}.
        self._option_params: dict[int, list[dict]] = {}
        self._option_params_done: dict[int, threading.Event] = {}

    # ── connection ────────────────────────────────────────

    def nextValidId(self, orderId: int):  # noqa: N802 (ibapi style)
        with self._order_lock:
            self._next_order_id = orderId
        self._order_ready.set()
        self._connect_done.set()

    def error(self, reqId, errorCode, errorString, advancedOrderRejectJson=""):  # noqa: N802,N803
        # 21xx: data farm connection state, ignore. 502: TWS not running.
        # 504: not connected. 1100/1101/1102: connectivity events.
        if errorCode in {2104, 2106, 2158, 2107, 2103, 2108, 2105}:
            return
        if errorCode in {502, 504} and not self._connect_done.is_set():
            self._connect_error = f"[{errorCode}] {errorString}"
            self._connect_done.set()
        if reqId in self._quote_locks:
            self._quote_results[reqId] = None
            self._quote_locks[reqId].set()
        if reqId in self._order_done:
            self._order_status.setdefault(reqId, {})["error"] = (
                f"[{errorCode}] {errorString}"
            )
            self._order_done[reqId].set()
        # Always log so the developer sees what TWS rejected.
        logger.warning("ib error reqId=%s code=%s msg=%s", reqId, errorCode, errorString)

    # ── quotes (snapshot via tickPrice) ───────────────────

    def tickPrice(self, reqId, tickType, price, attrib):  # noqa: N802,N803
        # 4 = LAST, 9 = CLOSE, 1 = BID, 2 = ASK
        if reqId not in self._quote_locks:
            return
        if tickType in (4, 9, 1, 2) and price > 0:
            existing = self._quote_results.get(reqId)
            # Prefer LAST (4); fall back to CLOSE (9), then mid of BID/ASK.
            if tickType == 4 or existing in (None, 0):
                self._quote_results[reqId] = float(price)
                self._quote_locks[reqId].set()

    def tickSnapshotEnd(self, reqId):  # noqa: N802,N803
        if reqId in self._quote_locks:
            self._quote_locks[reqId].set()

    # ── contract details (used to resolve conId for option chain) ──

    def contractDetails(self, reqId, contractDetails):  # noqa: N802,N803
        if reqId not in self._contract_details_done:
            return
        c = contractDetails.contract
        self._contract_details.setdefault(reqId, []).append({
            "conId": c.conId,
            "symbol": c.symbol,
            "secType": c.secType,
            "exchange": c.exchange,
            "primaryExchange": c.primaryExchange,
            "currency": c.currency,
            "marketName": getattr(contractDetails, "marketName", None),
            "longName": getattr(contractDetails, "longName", None),
        })

    def contractDetailsEnd(self, reqId):  # noqa: N802,N803
        ev = self._contract_details_done.get(reqId)
        if ev:
            ev.set()

    # ── option chain (reqSecDefOptParams) ─────────────────

    def securityDefinitionOptionParameter(  # noqa: N802
        self, reqId, exchange, underlyingConId, tradingClass, multiplier, expirations, strikes,
    ):
        if reqId not in self._option_params_done:
            return
        self._option_params.setdefault(reqId, []).append({
            "exchange": exchange,
            "underlyingConId": int(underlyingConId),
            "tradingClass": tradingClass,
            "multiplier": multiplier,
            "expirations": sorted(list(expirations)),
            "strikes": sorted(list(strikes)),
        })

    def securityDefinitionOptionParameterEnd(self, reqId):  # noqa: N802
        ev = self._option_params_done.get(reqId)
        if ev:
            ev.set()

    # ── account / positions ───────────────────────────────

    def updateAccountValue(self, key, value, currency, accountName):  # noqa: N802,N803
        with self._account_lock:
            self.account_values[key] = value

    def position(self, account, contract, position, avgCost):  # noqa: N803
        with self._account_lock:
            sym = contract.symbol.upper()
            self.positions[sym] = {
                "qty": float(position),
                "avg_cost": float(avgCost),
            }

    def positionEnd(self):  # noqa: N802
        self._positions_ready.set()

    def accountDownloadEnd(self, accountName):  # noqa: N802,N803
        self._account_ready.set()

    # ── orders ────────────────────────────────────────────

    def orderStatus(self, orderId, status, filled, remaining,  # noqa: N802,N803
                    avgFillPrice, permId, parentId, lastFillPrice,
                    clientId, whyHeld, mktCapPrice):
        self._order_status[orderId] = {
            "status": status,
            "filled": float(filled),
            "remaining": float(remaining),
            "avg_fill_price": float(avgFillPrice or 0.0),
        }
        if status in {"Filled", "Cancelled", "Inactive", "ApiCancelled"}:
            ev = self._order_done.get(orderId)
            if ev:
                ev.set()


# ── facade — what the runner uses ────────────────────────────


class IBKRBroker:
    name = "ibkr"

    def __init__(
        self,
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
        client_id: int = DEFAULT_CLIENT_ID,
    ) -> None:
        self.host = host
        self.port = port
        self.client_id = client_id
        self._app: Optional[_IBApp] = None
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

    # ── lifecycle ─────────────────────────────────────────

    def _ensure_connected(self) -> None:
        with self._lock:
            if self._app is not None and self._app.isConnected():
                return
            app = _IBApp()
            app.connect(self.host, self.port, clientId=self.client_id)
            t = threading.Thread(target=app.run, daemon=True,
                                 name=f"ibapi-{self.client_id}")
            t.start()
            # Wait for nextValidId() (TWS handshake completion) or an error.
            ok = app._connect_done.wait(timeout=8.0)
            if not ok:
                app.disconnect()
                raise RuntimeError(
                    f"timeout connecting to TWS at {self.host}:{self.port}"
                )
            if app._connect_error or app._next_order_id is None:
                app.disconnect()
                raise RuntimeError(
                    app._connect_error or "TWS handshake failed (no nextValidId)"
                )
            # Subscribe to the default account so positions stream in.
            app.reqAccountUpdates(True, "")
            self._app = app
            self._thread = t

    def connect(self) -> None:
        self._ensure_connected()

    def disconnect(self) -> None:
        with self._lock:
            if self._app is None:
                return
            try:
                self._app.reqAccountUpdates(False, "")
            except Exception:
                pass
            try:
                self._app.disconnect()
            except Exception:
                pass
            self._app = None

    # ── quote ─────────────────────────────────────────────

    def quote(self, symbol: str) -> Optional[float]:
        try:
            self._ensure_connected()
        except Exception as e:
            logger.warning("ibkr quote(%s) — connect failed: %s", symbol, e)
            return None
        app = self._app
        assert app is not None

        req_id = app.next_req_id
        app.next_req_id += 1
        ev = threading.Event()
        app._quote_locks[req_id] = ev
        app._quote_results[req_id] = None
        try:
            # snapshot=True → one-shot, then tickSnapshotEnd.
            app.reqMktData(req_id, _stock_contract(symbol),
                           "", True, False, [])
            ev.wait(timeout=4.0)
            return app._quote_results.get(req_id)
        finally:
            try:
                app.cancelMktData(req_id)
            except Exception:
                pass
            app._quote_locks.pop(req_id, None)
            app._quote_results.pop(req_id, None)

    # ── orders ────────────────────────────────────────────

    def place_order(
        self,
        symbol: str,
        side: OrderSide,
        qty: float,
        type: OrderType = OrderType.MARKET,
        limit_price: Optional[float] = None,
        *,
        contract: Optional[Contract] = None,
    ) -> Order:
        """
        Place an order. By default builds a STK contract from `symbol`.
        Pass `contract=` to override (e.g. an OPT contract from
        `_option_contract()` for an options trade). The Order.symbol field
        will reflect a human-readable description.
        """
        order = Order(
            id=f"ib_{uuid.uuid4().hex[:10]}",
            symbol=symbol.upper(),
            side=side,
            qty=qty,
            type=type,
            limit_price=limit_price,
            broker=self.name,
        )
        try:
            self._ensure_connected()
        except Exception as e:
            order.status = OrderStatus.REJECTED
            order.rejected_reason = f"TWS unreachable: {e}"
            return order

        app = self._app
        assert app is not None
        with app._order_lock:
            if app._next_order_id is None:
                order.status = OrderStatus.REJECTED
                order.rejected_reason = "no nextValidId from TWS"
                return order
            ib_order_id = app._next_order_id
            app._next_order_id += 1

        ib = IBOrder()
        ib.action = "BUY" if side == OrderSide.BUY else "SELL"
        ib.totalQuantity = qty
        ib.orderType = "LMT" if type == OrderType.LIMIT else "MKT"
        if type == OrderType.LIMIT and limit_price is not None:
            ib.lmtPrice = float(limit_price)
        # Suppress IB's risk checks that block bare orders without
        # explicit "transmit" confirmation. eTradeOnly + firmQuoteOnly
        # are deprecated in newer ibapi but harmless if set.
        ib.eTradeOnly = False
        ib.firmQuoteOnly = False
        ib.transmit = True

        ev = threading.Event()
        app._order_done[ib_order_id] = ev

        ib_contract = contract if contract is not None else _stock_contract(symbol)
        try:
            app.placeOrder(ib_order_id, ib_contract, ib)
            ev.wait(timeout=10.0)
            status = app._order_status.get(ib_order_id, {})
            err = status.get("error")
            if err:
                order.status = OrderStatus.REJECTED
                order.rejected_reason = err
                return order
            ib_status = (status.get("status") or "").lower()
            if ib_status == "filled":
                order.status = OrderStatus.FILLED
                order.fill_price = status.get("avg_fill_price") or 0.0
                order.fill_qty = status.get("filled") or qty
                order.filled_at = datetime.now(timezone.utc).isoformat()
            elif ib_status in {"cancelled", "apicancelled", "inactive"}:
                order.status = OrderStatus.REJECTED
                order.rejected_reason = ib_status
            else:
                # Submitted / PreSubmitted etc. – leave pending so the UI
                # can show the in-flight state.
                order.status = OrderStatus.PENDING
                order.id = f"ib_{ib_order_id}"
            return order
        finally:
            app._order_done.pop(ib_order_id, None)

    # ── options ───────────────────────────────────────────

    def place_option_order(
        self,
        symbol: str,
        expiry: str,
        strike: float,
        right: str,
        side: OrderSide,
        qty: float,
        type: OrderType = OrderType.MARKET,
        limit_price: Optional[float] = None,
        exchange: str = "SMART",
        currency: str = "USD",
    ) -> Order:
        """
        Place an options order. The Order.symbol carries an OCC-style
        description so the audit log / UI shows what was bought.
        """
        contract = _option_contract(symbol, expiry, strike, right,
                                    exchange=exchange, currency=currency)
        # Build a human-readable symbol: "AAPL 20260619 C 150"
        right_letter = "C" if right.upper() in ("C", "CALL") else "P"
        display = f"{symbol.upper()} {expiry} {right_letter} {strike:g}"
        return self.place_order(
            symbol=display,
            side=side,
            qty=qty,
            type=type,
            limit_price=limit_price,
            contract=contract,
        )

    def option_chain(self, symbol: str, exchange: str = "SMART") -> dict:
        """
        Discover available expirations + strikes for an equity's options.
        Two-step IBKR flow:
          1. reqContractDetails on the STK → resolve underlying conId
          2. reqSecDefOptParams using that conId → expirations / strikes
        Returns: {
            "underlyingConId": int,
            "underlyingSymbol": str,
            "params": [{ exchange, expirations, strikes, multiplier, ... }],
        }
        Raises RuntimeError on timeout or if symbol is unknown.
        """
        self._ensure_connected()
        app = self._app
        assert app is not None

        # ── Step 1: resolve conId ──
        req_id_a = app.next_req_id
        app.next_req_id += 1
        ev_a = threading.Event()
        app._contract_details_done[req_id_a] = ev_a
        app._contract_details[req_id_a] = []
        try:
            app.reqContractDetails(req_id_a, _stock_contract(symbol, exchange=exchange))
            ev_a.wait(timeout=8.0)
            details = list(app._contract_details.get(req_id_a, []))
        finally:
            app._contract_details_done.pop(req_id_a, None)
            app._contract_details.pop(req_id_a, None)

        if not details:
            raise RuntimeError(f"No contract details for symbol '{symbol}' (timeout or unknown ticker)")
        # Prefer the row whose primaryExchange matches NYSE/NASDAQ/ARCA etc.
        chosen = next((d for d in details if d.get("primaryExchange")), details[0])
        underlying_con_id = int(chosen["conId"])

        # ── Step 2: option params ──
        req_id_b = app.next_req_id
        app.next_req_id += 1
        ev_b = threading.Event()
        app._option_params_done[req_id_b] = ev_b
        app._option_params[req_id_b] = []
        try:
            app.reqSecDefOptParams(
                req_id_b,
                symbol.upper(),
                "",            # futFopExchange — empty for non-FOP
                "STK",         # underlyingSecType
                underlying_con_id,
            )
            ev_b.wait(timeout=10.0)
            params = list(app._option_params.get(req_id_b, []))
        finally:
            app._option_params_done.pop(req_id_b, None)
            app._option_params.pop(req_id_b, None)

        return {
            "underlyingConId": underlying_con_id,
            "underlyingSymbol": symbol.upper(),
            "longName": chosen.get("longName"),
            "params": params,
        }

    # ── account ───────────────────────────────────────────

    def get_account(self) -> AccountSnapshot:
        try:
            self._ensure_connected()
        except Exception:
            return AccountSnapshot(cash=0.0, equity=0.0, buying_power=0.0,
                                   realised_pnl=0.0, unrealised_pnl=0.0,
                                   broker=self.name)
        app = self._app
        assert app is not None

        # Refresh positions snapshot (positionEnd() fires after the last row).
        app._positions_ready.clear()
        app.reqPositions()
        app._positions_ready.wait(timeout=4.0)
        try:
            app.cancelPositions()
        except Exception:
            pass

        with app._account_lock:
            av = dict(app.account_values)
            poss_dict = dict(app.positions)

        def _f(k: str, default: float = 0.0) -> float:
            try:
                return float(av.get(k, default))
            except Exception:
                return default

        # IBKR keys are surprisingly verbose. Defaults match what TWS exposes
        # under "AvailableFunds", "NetLiquidation", etc.
        cash = _f("AvailableFunds-S") or _f("AvailableFunds") or _f("TotalCashValue")
        equity = _f("NetLiquidation-S") or _f("NetLiquidation")
        buying_power = _f("BuyingPower")
        unreal = _f("UnrealizedPnL")
        real = _f("RealizedPnL")

        positions: list[Position] = []
        for sym, p in poss_dict.items():
            if p["qty"] == 0:
                continue
            last = self.quote(sym) or p["avg_cost"]
            positions.append(Position(
                symbol=sym,
                qty=p["qty"],
                avg_price=p["avg_cost"],
                last_price=last,
                unrealised_pnl=(last - p["avg_cost"]) * p["qty"],
                realised_pnl=0.0,  # IBKR reports realised at the account level
            ))

        return AccountSnapshot(
            cash=cash,
            equity=equity,
            buying_power=buying_power,
            realised_pnl=real,
            unrealised_pnl=unreal,
            positions=positions,
            broker=self.name,
        )

    def close_all(self) -> list[Order]:
        snap = self.get_account()
        closed: list[Order] = []
        for p in snap.positions:
            if p.qty == 0:
                continue
            side = OrderSide.SELL if p.qty > 0 else OrderSide.BUY
            closed.append(self.place_order(p.symbol, side, abs(p.qty),
                                           OrderType.MARKET))
        return closed


# Quick check helper used by the router for its broker selector.
def ibkr_creds_present() -> bool:
    """IBKR doesn't have an API key — the gateway has to be reachable.
    The router uses this name only when `EXECUTION_BROKER=ibkr` is set
    explicitly; otherwise we can't tell from env whether TWS is running."""
    return os.getenv("EXECUTION_BROKER", "").lower() == "ibkr"
