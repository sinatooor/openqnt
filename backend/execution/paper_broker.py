"""
PaperBroker — in-process paper-trading broker.

Fills market orders immediately at the most recent close pulled from
the canonical bar loader (`backtest.data.load_bars`); limit orders fill
when (BUY: price ≤ limit, SELL: price ≥ limit) on the same call. P&L
is tracked per position with a running average cost basis so realised
gains on partial closes match what a real broker would report.

This is the default broker so the Phase H exit criterion runs without
external creds. The same `Broker` interface is implemented by
`AlpacaBroker`, which slots in when `ALPACA_API_KEY`/`ALPACA_API_SECRET`
are set (see [alpaca_broker.py](alpaca_broker.py)).
"""
from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

from .schema import (
    AccountSnapshot,
    Fill,
    Order,
    OrderSide,
    OrderStatus,
    OrderType,
    Position,
)


def _last_close(symbol: str) -> Optional[float]:
    """Best-effort live-ish quote: most recent daily close for `symbol`.

    Lazy-imported so PaperBroker keeps working when the data deps are
    missing (tests can also pass an explicit `quote_fn`).
    """
    try:
        from backtest.data import load_bars  # canonical loader
        from datetime import timedelta

        end = datetime.now(timezone.utc).date()
        start = end - timedelta(days=14)
        bars = load_bars(symbol, start.isoformat(), end.isoformat(), "1d")
        if bars is None or bars.empty:
            return None
        return float(bars["Close"].iloc[-1])
    except Exception:
        return None


class PaperBroker:
    """Thread-safe paper broker. One instance per backend process."""

    name = "paper"

    def __init__(self, initial_cash: float = 100_000.0, commission: float = 0.0,
                 quote_fn=None) -> None:
        self._cash = initial_cash
        self._initial_cash = initial_cash
        self._commission = commission
        self._positions: dict[str, Position] = {}
        self._realised_pnl = 0.0
        self._quote_fn = quote_fn or _last_close
        self._lock = threading.Lock()

    # ── quotes ────────────────────────────────────────────────

    def quote(self, symbol: str) -> Optional[float]:
        return self._quote_fn(symbol)

    # ── orders ────────────────────────────────────────────────

    def place_order(
        self,
        symbol: str,
        side: OrderSide,
        qty: float,
        type: OrderType = OrderType.MARKET,
        limit_price: Optional[float] = None,
    ) -> Order:
        order = Order(
            id=f"po_{uuid.uuid4().hex[:10]}",
            symbol=symbol.upper(),
            side=side,
            qty=qty,
            type=type,
            limit_price=limit_price,
            broker=self.name,
        )

        px = self.quote(symbol)
        if px is None or px <= 0:
            order.status = OrderStatus.REJECTED
            order.rejected_reason = f"no quote available for {symbol}"
            return order

        # Limit acceptance check.
        if type == OrderType.LIMIT:
            assert limit_price is not None
            if side == OrderSide.BUY and px > limit_price:
                order.status = OrderStatus.PENDING  # would rest on book
                return order
            if side == OrderSide.SELL and px < limit_price:
                order.status = OrderStatus.PENDING
                return order
            px = limit_price

        with self._lock:
            cost = px * qty
            commission = abs(cost) * self._commission

            if side == OrderSide.BUY:
                if self._cash < cost + commission:
                    order.status = OrderStatus.REJECTED
                    order.rejected_reason = (
                        f"insufficient cash: have {self._cash:.2f}, need {(cost + commission):.2f}"
                    )
                    return order
                self._cash -= cost + commission
                self._buy_into_position(symbol, qty, px)
            else:  # SELL
                self._sell_from_position(symbol, qty, px)
                self._cash += cost - commission

            order.status = OrderStatus.FILLED
            order.fill_price = px
            order.fill_qty = qty
            order.filled_at = datetime.now(timezone.utc).isoformat()

        return order

    # ── account / positions ────────────────────────────────────

    def get_account(self) -> AccountSnapshot:
        with self._lock:
            unreal = 0.0
            positions: list[Position] = []
            for sym, p in self._positions.items():
                last = self.quote(sym) or p.last_price or p.avg_price
                p.last_price = last
                p.unrealised_pnl = (last - p.avg_price) * p.qty
                unreal += p.unrealised_pnl
                positions.append(
                    Position(
                        symbol=sym,
                        qty=p.qty,
                        avg_price=p.avg_price,
                        last_price=last,
                        unrealised_pnl=p.unrealised_pnl,
                        realised_pnl=p.realised_pnl,
                    )
                )
            equity = self._cash + sum(p.qty * p.last_price for p in positions)
            return AccountSnapshot(
                cash=self._cash,
                equity=equity,
                buying_power=max(0.0, self._cash),
                realised_pnl=self._realised_pnl,
                unrealised_pnl=unreal,
                positions=positions,
                broker=self.name,
            )

    def close_all(self) -> list[Order]:
        """Used by the kill-switch path."""
        closed: list[Order] = []
        with self._lock:
            symbols = list(self._positions.keys())
        for sym in symbols:
            p = self._positions.get(sym)
            if not p or p.qty == 0:
                continue
            side = OrderSide.SELL if p.qty > 0 else OrderSide.BUY
            closed.append(self.place_order(sym, side, abs(p.qty), OrderType.MARKET))
        return closed

    # ── internals ─────────────────────────────────────────────

    def _buy_into_position(self, symbol: str, qty: float, px: float) -> None:
        p = self._positions.get(symbol)
        if p is None or p.qty == 0:
            self._positions[symbol] = Position(symbol=symbol, qty=qty, avg_price=px,
                                               last_price=px)
            return
        if p.qty > 0:
            new_qty = p.qty + qty
            p.avg_price = (p.avg_price * p.qty + px * qty) / new_qty
            p.qty = new_qty
        else:
            # Buying into a short — covers shorts first, then flips long.
            cover = min(qty, -p.qty)
            self._realised_pnl += (p.avg_price - px) * cover
            p.realised_pnl += (p.avg_price - px) * cover
            p.qty += cover
            remaining = qty - cover
            if remaining > 0:
                p.qty = remaining
                p.avg_price = px

    def _sell_from_position(self, symbol: str, qty: float, px: float) -> None:
        p = self._positions.get(symbol)
        if p is None or p.qty == 0:
            self._positions[symbol] = Position(symbol=symbol, qty=-qty, avg_price=px,
                                               last_price=px)
            return
        if p.qty > 0:
            close = min(qty, p.qty)
            self._realised_pnl += (px - p.avg_price) * close
            p.realised_pnl += (px - p.avg_price) * close
            p.qty -= close
            remaining = qty - close
            if remaining > 0:
                p.qty = -remaining
                p.avg_price = px
        else:
            new_qty = p.qty - qty
            p.avg_price = (p.avg_price * (-p.qty) + px * qty) / (-new_qty)
            p.qty = new_qty
