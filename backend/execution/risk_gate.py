"""
RiskGate — every order goes through here before reaching the broker.

Six rules, in evaluation order. The gate stops at the first hard
violation; soft warnings accumulate.

  1. Panic switch active        → REJECT
  2. Trading halted (drawdown)  → REJECT
  3. Order qty > max_order_qty  → REJECT (hard cap)
  4. New net position notional > max_position_notional  → REJECT
  5. Daily loss > max_daily_loss_pct                     → halt + REJECT
  6. Drawdown vs peak > max_drawdown_pct                 → halt + REJECT

`evaluate(order, account_snapshot)` returns a `RiskDecision`.
The runner calls `record_fill(price, qty, side)` after a successful fill
so the gate can update its peak / daily loss tracking.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Optional

from .panic import PanicService
from .schema import AccountSnapshot, Order, OrderSide


@dataclass
class RiskConfig:
    max_order_qty: float = 1_000.0
    max_position_notional: float = 50_000.0
    max_drawdown_pct: float = 20.0
    max_daily_loss_pct: float = 5.0
    """Both percentages are versus the configured `initial_equity`."""
    initial_equity: float = 100_000.0


@dataclass
class RiskDecision:
    allowed: bool
    reason: Optional[str] = None
    warnings: list[str] = field(default_factory=list)
    rules_checked: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "allowed": self.allowed,
            "reason": self.reason,
            "warnings": self.warnings,
            "rules_checked": self.rules_checked,
        }


class RiskGate:
    def __init__(self, config: RiskConfig | None = None) -> None:
        self.config = config or RiskConfig()
        self._peak_equity = self.config.initial_equity
        self._day_open_equity = self.config.initial_equity
        self._day_open_date: date = datetime.now(timezone.utc).date()
        self._halted = False
        self._halt_reason: Optional[str] = None

    # ── public ────────────────────────────────────────────────

    def is_halted(self) -> bool:
        return self._halted

    def halt_reason(self) -> Optional[str]:
        return self._halt_reason

    def reset_halt(self) -> None:
        self._halted = False
        self._halt_reason = None

    def update_equity(self, equity: float) -> None:
        """Trigger peak + drawdown bookkeeping. Called by the runner
        after each fill so `evaluate()` is using fresh state."""
        # Roll the daily anchor at UTC midnight.
        today = datetime.now(timezone.utc).date()
        if today != self._day_open_date:
            self._day_open_date = today
            self._day_open_equity = equity

        if equity > self._peak_equity:
            self._peak_equity = equity

        # Drawdown halt.
        dd = self._drawdown_pct(equity)
        if dd > self.config.max_drawdown_pct:
            self._halted = True
            self._halt_reason = (
                f"max-drawdown breach: {dd:.2f}% > {self.config.max_drawdown_pct:.2f}%"
            )
            return
        # Daily loss halt.
        dl = self._daily_loss_pct(equity)
        if dl > self.config.max_daily_loss_pct:
            self._halted = True
            self._halt_reason = (
                f"max-daily-loss breach: {dl:.2f}% > {self.config.max_daily_loss_pct:.2f}%"
            )

    def evaluate(self, order: Order, account: AccountSnapshot,
                 price_estimate: Optional[float] = None) -> RiskDecision:
        decision = RiskDecision(allowed=True, rules_checked=[])

        # 1. Panic
        decision.rules_checked.append("panic")
        if PanicService.is_active():
            return RiskDecision(
                allowed=False,
                reason="panic switch is engaged",
                rules_checked=decision.rules_checked,
            )

        # 2. Trading halt
        decision.rules_checked.append("halt")
        if self._halted:
            return RiskDecision(
                allowed=False,
                reason=self._halt_reason or "trading halted",
                rules_checked=decision.rules_checked,
            )

        # 3. Order qty cap
        decision.rules_checked.append("max_order_qty")
        if abs(order.qty) > self.config.max_order_qty:
            return RiskDecision(
                allowed=False,
                reason=f"order qty {order.qty} > max_order_qty {self.config.max_order_qty}",
                rules_checked=decision.rules_checked,
            )

        # 4. Net position notional cap
        decision.rules_checked.append("max_position_notional")
        px = price_estimate or _last_price_for(order.symbol, account) or 0.0
        if px <= 0:
            decision.warnings.append("no price estimate; notional check skipped")
        else:
            existing_qty = _existing_qty(order.symbol, account)
            net_qty = existing_qty + (order.qty if order.side == OrderSide.BUY else -order.qty)
            notional = abs(net_qty * px)
            if notional > self.config.max_position_notional:
                return RiskDecision(
                    allowed=False,
                    reason=(
                        f"would push {order.symbol} notional to ${notional:,.0f}, "
                        f"cap is ${self.config.max_position_notional:,.0f}"
                    ),
                    rules_checked=decision.rules_checked,
                )

        # 5/6. Drawdown + daily loss (already encoded in halt state via
        # update_equity, but recheck cheaply against the freshest snapshot).
        decision.rules_checked.append("drawdown")
        dd = self._drawdown_pct(account.equity)
        if dd > self.config.max_drawdown_pct:
            self._halted = True
            self._halt_reason = f"max-drawdown breach: {dd:.2f}%"
            return RiskDecision(allowed=False, reason=self._halt_reason,
                                rules_checked=decision.rules_checked)

        decision.rules_checked.append("daily_loss")
        dl = self._daily_loss_pct(account.equity)
        if dl > self.config.max_daily_loss_pct:
            self._halted = True
            self._halt_reason = f"max-daily-loss breach: {dl:.2f}%"
            return RiskDecision(allowed=False, reason=self._halt_reason,
                                rules_checked=decision.rules_checked)

        return decision

    # ── internals ─────────────────────────────────────────────

    def _drawdown_pct(self, equity: float) -> float:
        if self._peak_equity <= 0:
            return 0.0
        return max(0.0, (self._peak_equity - equity) / self._peak_equity * 100)

    def _daily_loss_pct(self, equity: float) -> float:
        if self._day_open_equity <= 0:
            return 0.0
        return max(0.0, (self._day_open_equity - equity) / self._day_open_equity * 100)


def _existing_qty(symbol: str, account: AccountSnapshot) -> float:
    sym = symbol.upper()
    for p in account.positions:
        if p.symbol.upper() == sym:
            return p.qty
    return 0.0


def _last_price_for(symbol: str, account: AccountSnapshot) -> Optional[float]:
    sym = symbol.upper()
    for p in account.positions:
        if p.symbol.upper() == sym and p.last_price > 0:
            return p.last_price
    return None
