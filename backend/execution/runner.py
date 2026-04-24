"""
ExecutionRunner — the verb that connects {signal → gate → broker → journal}.

Public surface:

    runner = ExecutionRunner(broker=PaperBroker(), gate=RiskGate())
    order  = runner.submit_signal("SPY", OrderSide.BUY, qty=10)

Every order (allowed or rejected) is appended to
`agents/_execution/<session>/orders.jsonl` so the Execution viewer + an
audit trail share a single source of truth. When given an
`AgentRunContext`, the runner also emits `tool_call("execution.submit",
…)` / `tool_result(…)` so live order submission shows up in the agent
stream.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, Protocol

from .panic import PanicService
from .risk_gate import RiskDecision, RiskGate
from .schema import (
    AccountSnapshot,
    Order,
    OrderSide,
    OrderStatus,
    OrderType,
)


JOURNAL_ROOT = Path(__file__).resolve().parents[2] / "agents" / "_execution"


class Broker(Protocol):
    name: str

    def quote(self, symbol: str) -> Optional[float]: ...

    def place_order(
        self, symbol: str, side: OrderSide, qty: float,
        type: OrderType = ..., limit_price: Optional[float] = ...,
    ) -> Order: ...

    def get_account(self) -> AccountSnapshot: ...

    def close_all(self) -> list[Order]: ...


class ExecutionRunner:
    def __init__(
        self,
        broker: Broker,
        gate: RiskGate,
        session_id: str = "default",
    ) -> None:
        self.broker = broker
        self.gate = gate
        self.session_id = session_id
        self._dir = JOURNAL_ROOT / session_id
        self._dir.mkdir(parents=True, exist_ok=True)
        self._journal = self._dir / "orders.jsonl"

    # ── public ────────────────────────────────────────────────

    def submit_signal(
        self,
        symbol: str,
        side: OrderSide,
        qty: float,
        order_type: OrderType = OrderType.MARKET,
        limit_price: Optional[float] = None,
        ctx: Any = None,
    ) -> Order:
        """Take a strategy signal, gate it, route to the broker, journal it."""
        # Build a synthetic Order so the gate has something to evaluate
        # before we actually submit. The broker re-stamps fields on submit.
        probe = Order(
            id="pending", symbol=symbol.upper(), side=side, qty=qty,
            type=order_type, limit_price=limit_price, broker=self.broker.name,
        )
        account = self.broker.get_account()
        price_estimate = self.broker.quote(symbol)
        decision = self.gate.evaluate(probe, account, price_estimate=price_estimate)

        ctx_handle = self._open_ctx(ctx, "execution.submit", {
            "symbol": symbol.upper(), "side": side.value, "qty": qty,
            "type": order_type.value, "limit_price": limit_price,
            "broker": self.broker.name,
        })
        try:
            if not decision.allowed:
                rejected = Order(
                    id=probe.id, symbol=probe.symbol, side=side, qty=qty,
                    type=order_type, limit_price=limit_price,
                    status=OrderStatus.REJECTED,
                    rejected_reason=decision.reason,
                    broker=self.broker.name,
                    risk_decision=decision.to_dict(),
                )
                self._journal_order(rejected)
                _close_ctx(ctx_handle, f"REJECTED: {decision.reason}", status="error")
                return rejected

            order = self.broker.place_order(
                symbol=symbol, side=side, qty=qty,
                type=order_type, limit_price=limit_price,
            )
            order.risk_decision = decision.to_dict()

            # Update gate's equity bookkeeping after the fill.
            if order.status == OrderStatus.FILLED:
                fresh = self.broker.get_account()
                self.gate.update_equity(fresh.equity)

            self._journal_order(order)
            _close_ctx(ctx_handle, self._fill_summary(order),
                       status="success" if order.status == OrderStatus.FILLED
                       else "error" if order.status == OrderStatus.REJECTED
                       else "success")
            return order
        except Exception as e:  # noqa: BLE001
            err = Order(
                id=probe.id, symbol=probe.symbol, side=side, qty=qty,
                type=order_type, limit_price=limit_price,
                status=OrderStatus.REJECTED,
                rejected_reason=f"{type(e).__name__}: {e}",
                broker=self.broker.name,
            )
            self._journal_order(err)
            _close_ctx(ctx_handle, f"ERROR: {e}", status="error")
            raise

    def list_orders(self, limit: int = 200) -> list[dict[str, Any]]:
        if not self._journal.exists():
            return []
        rows = [json.loads(ln) for ln in self._journal.read_text().splitlines() if ln.strip()]
        return rows[-limit:][::-1]

    def kill_switch(self, reason: str = "ui-engaged") -> dict[str, Any]:
        """Engage panic + close all positions on the broker."""
        PanicService.engage(reason)
        closed = self.broker.close_all()
        for o in closed:
            self._journal_order(o)
        return {
            "panic": PanicService.status(),
            "closed": [o.to_dict() for o in closed],
        }

    # ── internals ─────────────────────────────────────────────

    def _journal_order(self, order: Order) -> None:
        line = json.dumps({
            **order.to_dict(),
            "session_id": self.session_id,
            "journaled_at": datetime.now(timezone.utc).isoformat(),
        })
        with self._journal.open("a") as f:
            f.write(line + "\n")

    def _fill_summary(self, order: Order) -> str:
        if order.status == OrderStatus.FILLED:
            return (f"{order.side.value} {order.qty} {order.symbol} @ "
                    f"{order.fill_price:.2f}")
        if order.status == OrderStatus.REJECTED:
            return f"REJECTED · {order.rejected_reason}"
        return f"{order.status.value}"

    def _open_ctx(self, ctx: Any, name: str, payload: dict) -> Any:
        if ctx is None:
            return None
        cm = ctx.tool_call(name, payload)
        return cm.__enter__(), cm  # (handle, manager) — we close manually


def _close_ctx(handle_pair, output: str, status: str = "success") -> None:
    if handle_pair is None:
        return
    handle, manager = handle_pair
    try:
        handle.result(output, status=status)
    except Exception:
        pass
    try:
        manager.__exit__(None, None, None)
    except Exception:
        pass
