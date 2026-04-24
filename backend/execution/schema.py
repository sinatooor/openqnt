"""Execution dataclasses — broker-agnostic, JSON-friendly."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"


class OrderStatus(str, Enum):
    PENDING = "pending"
    REJECTED = "rejected"
    FILLED = "filled"
    PARTIAL = "partial"
    CANCELLED = "cancelled"


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Order:
    id: str
    symbol: str
    side: OrderSide
    qty: float
    type: OrderType = OrderType.MARKET
    limit_price: Optional[float] = None
    status: OrderStatus = OrderStatus.PENDING
    submitted_at: str = field(default_factory=_utc_iso)
    filled_at: Optional[str] = None
    fill_price: Optional[float] = None
    fill_qty: float = 0.0
    broker: str = "paper"
    rejected_reason: Optional[str] = None
    risk_decision: Optional[dict[str, Any]] = None
    """If the gate produced anything noteworthy (warnings, adjusted_qty),
    it lands here for forensics."""

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["side"] = self.side.value
        d["type"] = self.type.value
        d["status"] = self.status.value
        return d


@dataclass
class Fill:
    order_id: str
    symbol: str
    side: OrderSide
    qty: float
    price: float
    ts: str = field(default_factory=_utc_iso)
    commission: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["side"] = self.side.value
        return d


@dataclass
class Position:
    symbol: str
    qty: float            # signed: positive long, negative short
    avg_price: float
    last_price: float = 0.0
    unrealised_pnl: float = 0.0
    realised_pnl: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AccountSnapshot:
    cash: float
    equity: float
    buying_power: float
    realised_pnl: float
    unrealised_pnl: float
    positions: list[Position] = field(default_factory=list)
    broker: str = "paper"
    as_of: str = field(default_factory=_utc_iso)

    def to_dict(self) -> dict[str, Any]:
        return {
            "cash": self.cash,
            "equity": self.equity,
            "buying_power": self.buying_power,
            "realised_pnl": self.realised_pnl,
            "unrealised_pnl": self.unrealised_pnl,
            "positions": [p.to_dict() for p in self.positions],
            "broker": self.broker,
            "as_of": self.as_of,
        }
