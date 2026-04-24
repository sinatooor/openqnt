"""
AlpacaBroker — thin REST shim for Alpaca paper / live.

Activated when both `ALPACA_API_KEY` and `ALPACA_API_SECRET` are
present in env. Falls back to `PaperBroker` otherwise so the rest of
the execution path is testable without external creds (Phase H is
explicitly gated on creds in PLAN.md).

API base auto-selected from the key prefix: keys starting with `PK`
hit `paper-api.alpaca.markets`, anything else hits the live endpoint.

The set of methods is deliberately the same as `PaperBroker`'s — the
runner doesn't know which one it's holding.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from .schema import (
    AccountSnapshot,
    Order,
    OrderSide,
    OrderStatus,
    OrderType,
    Position,
)

PAPER_URL = "https://paper-api.alpaca.markets"
LIVE_URL = "https://api.alpaca.markets"
DATA_URL = "https://data.alpaca.markets/v2"


def alpaca_creds_present() -> bool:
    return bool(os.getenv("ALPACA_API_KEY") and os.getenv("ALPACA_API_SECRET"))


class AlpacaBroker:
    name = "alpaca"

    def __init__(self, paper: Optional[bool] = None, timeout: float = 8.0) -> None:
        api_key = os.getenv("ALPACA_API_KEY", "")
        api_secret = os.getenv("ALPACA_API_SECRET", "")
        if not api_key or not api_secret:
            raise RuntimeError(
                "AlpacaBroker requires ALPACA_API_KEY + ALPACA_API_SECRET in env"
            )
        self._headers = {
            "APCA-API-KEY-ID": api_key,
            "APCA-API-SECRET-KEY": api_secret,
            "Content-Type": "application/json",
        }
        # paper=True/False overrides, otherwise infer from key prefix.
        if paper is None:
            paper = api_key.startswith("PK")
        self._base = PAPER_URL if paper else LIVE_URL
        self._timeout = timeout

    # ── HTTP helpers ──────────────────────────────────────────

    def _get(self, path: str, params: dict | None = None) -> Any:
        with httpx.Client(timeout=self._timeout) as cx:
            r = cx.get(self._base + path, headers=self._headers, params=params)
            r.raise_for_status()
            return r.json()

    def _post(self, path: str, body: dict) -> Any:
        with httpx.Client(timeout=self._timeout) as cx:
            r = cx.post(self._base + path, headers=self._headers, json=body)
            r.raise_for_status()
            return r.json()

    # ── quotes ────────────────────────────────────────────────

    def quote(self, symbol: str) -> Optional[float]:
        try:
            with httpx.Client(timeout=self._timeout) as cx:
                r = cx.get(
                    f"{DATA_URL}/stocks/{symbol.upper()}/snapshot",
                    headers=self._headers,
                )
                r.raise_for_status()
                snap = r.json()
                # Prefer last trade, fall back to minute bar close.
                last = (snap.get("latestTrade") or {}).get("p")
                if last is None:
                    last = (snap.get("minuteBar") or {}).get("c")
                return float(last) if last is not None else None
        except Exception:
            return None

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
            id=f"al_{uuid.uuid4().hex[:10]}",
            symbol=symbol.upper(),
            side=side,
            qty=qty,
            type=type,
            limit_price=limit_price,
            broker=self.name,
        )
        body: dict[str, Any] = {
            "symbol": symbol.upper(),
            "qty": str(qty),
            "side": side.value,
            "type": type.value,
            "time_in_force": "day",
        }
        if type == OrderType.LIMIT and limit_price is not None:
            body["limit_price"] = str(limit_price)
        try:
            resp = self._post("/v2/orders", body)
            order.id = resp.get("id", order.id)
            status = (resp.get("status") or "pending").lower()
            order.status = (
                OrderStatus.FILLED if status in {"filled"}
                else OrderStatus.PARTIAL if status in {"partially_filled"}
                else OrderStatus.REJECTED if status in {"rejected", "canceled", "expired"}
                else OrderStatus.PENDING
            )
            if resp.get("filled_avg_price"):
                order.fill_price = float(resp["filled_avg_price"])
                order.fill_qty = float(resp.get("filled_qty") or 0.0)
                order.filled_at = resp.get("filled_at") or datetime.now(timezone.utc).isoformat()
        except Exception as e:
            order.status = OrderStatus.REJECTED
            order.rejected_reason = str(e)[:200]
        return order

    # ── account / positions ────────────────────────────────────

    def get_account(self) -> AccountSnapshot:
        try:
            acct = self._get("/v2/account")
            poss = self._get("/v2/positions")
        except Exception:
            return AccountSnapshot(cash=0.0, equity=0.0, buying_power=0.0,
                                   realised_pnl=0.0, unrealised_pnl=0.0,
                                   broker=self.name)
        positions: list[Position] = []
        unreal = 0.0
        real = 0.0
        for p in poss or []:
            qty = float(p.get("qty") or 0.0)
            if (p.get("side") or "long") == "short":
                qty = -abs(qty)
            avg = float(p.get("avg_entry_price") or 0.0)
            last = float(p.get("current_price") or avg)
            upl = float(p.get("unrealized_pl") or (last - avg) * qty)
            rpl = float(p.get("realized_pl") or 0.0)
            unreal += upl
            real += rpl
            positions.append(Position(
                symbol=p["symbol"], qty=qty, avg_price=avg, last_price=last,
                unrealised_pnl=upl, realised_pnl=rpl,
            ))
        return AccountSnapshot(
            cash=float(acct.get("cash") or 0.0),
            equity=float(acct.get("equity") or 0.0),
            buying_power=float(acct.get("buying_power") or 0.0),
            realised_pnl=real,
            unrealised_pnl=unreal,
            positions=positions,
            broker=self.name,
        )

    def close_all(self) -> list[Order]:
        try:
            self._post("/v2/positions", {"cancel_orders": True})
        except Exception:
            return []
        return []
