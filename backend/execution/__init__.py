"""
Phase H execution path — broker-agnostic.

Public surface:

    from execution import (
        Order, Fill, Position, AccountSnapshot,
        PaperBroker, AlpacaBroker,
        RiskGate, RiskConfig, RiskDecision,
        ExecutionRunner,
        PanicService,
    )

`ExecutionRunner.submit_signal(symbol, side, qty, ctx?)` is the one
verb the rest of the system calls. Every order goes through `RiskGate`
before reaching the broker; every fill is appended to the on-disk
journal under `agents/_execution/<run_id>/orders.jsonl`.

`PaperBroker` is the in-process fallback so the execution path runs
without external creds (Phase H ships gated on broker creds — paper
keeps the exit criterion proveable on a developer box).
"""
from .schema import (
    AccountSnapshot,
    Fill,
    Order,
    OrderSide,
    OrderStatus,
    OrderType,
    Position,
)
from .panic import PanicService
from .paper_broker import PaperBroker
from .alpaca_broker import AlpacaBroker
from .ibkr_broker import IBKRBroker
from .avanza_broker import AvanzaBroker
from .risk_gate import RiskConfig, RiskDecision, RiskGate
from .runner import ExecutionRunner

__all__ = [
    "AccountSnapshot",
    "AlpacaBroker",
    "AvanzaBroker",
    "ExecutionRunner",
    "Fill",
    "IBKRBroker",
    "Order",
    "OrderSide",
    "OrderStatus",
    "OrderType",
    "PanicService",
    "PaperBroker",
    "Position",
    "RiskConfig",
    "RiskDecision",
    "RiskGate",
]
