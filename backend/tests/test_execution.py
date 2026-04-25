"""
Phase H exit-criterion tests.

Covers:
  - PaperBroker fills + P&L bookkeeping (BUY → SELL → realised PnL).
  - RiskGate rejects on each rule (qty cap, notional cap, panic, halt).
  - ExecutionRunner journals every order (allowed + rejected).
  - Kill-switch closes positions and blocks new orders until cleared.
  - End-to-end: simulate the Phase E template signal → submit → see in
    journal + account snapshot.

PaperBroker is given a `quote_fn` that returns deterministic prices so
the tests don't depend on yfinance.

Run:  pytest backend/tests/test_execution.py -q
"""
from __future__ import annotations

import json
import shutil

import pytest

from execution import (
    ExecutionRunner,
    IBKRBroker,
    OrderSide,
    OrderStatus,
    OrderType,
    PaperBroker,
    PanicService,
    RiskConfig,
    RiskGate,
)
from execution.runner import JOURNAL_ROOT


@pytest.fixture(autouse=True)
def _clean_journal_and_panic():
    """Wipe journal + panic between tests so state doesn't leak."""
    PanicService.clear()
    if JOURNAL_ROOT.exists():
        shutil.rmtree(JOURNAL_ROOT)
    yield
    PanicService.clear()
    if JOURNAL_ROOT.exists():
        shutil.rmtree(JOURNAL_ROOT)


def _quote_fn(prices: dict[str, float]):
    return lambda sym: prices.get(sym.upper())


def _runner(broker: PaperBroker | None = None,
            gate: RiskGate | None = None,
            session: str = "test") -> ExecutionRunner:
    broker = broker or PaperBroker(initial_cash=100_000.0,
                                   quote_fn=_quote_fn({"SPY": 500.0, "AAPL": 200.0}))
    gate = gate or RiskGate(RiskConfig(initial_equity=100_000.0))
    return ExecutionRunner(broker=broker, gate=gate, session_id=session)


# ── PaperBroker basics ───────────────────────────────────────


def test_paper_broker_buy_then_sell_realises_pnl():
    quotes = {"SPY": 500.0}
    broker = PaperBroker(initial_cash=10_000.0, quote_fn=lambda s: quotes[s])
    o1 = broker.place_order("SPY", OrderSide.BUY, 10)
    assert o1.status == OrderStatus.FILLED
    assert o1.fill_price == 500.0
    snap = broker.get_account()
    assert snap.cash == pytest.approx(10_000.0 - 5_000.0)
    assert any(p.symbol == "SPY" and p.qty == 10 for p in snap.positions)

    quotes["SPY"] = 520.0
    o2 = broker.place_order("SPY", OrderSide.SELL, 10)
    assert o2.status == OrderStatus.FILLED
    snap = broker.get_account()
    # Realised: 10 * (520 - 500) = 200
    assert snap.realised_pnl == pytest.approx(200.0)
    assert all(p.qty == 0 for p in snap.positions)


def test_paper_broker_rejects_when_no_cash():
    broker = PaperBroker(initial_cash=10.0, quote_fn=lambda s: 100.0)
    o = broker.place_order("SPY", OrderSide.BUY, 5)
    assert o.status == OrderStatus.REJECTED
    assert "insufficient cash" in (o.rejected_reason or "")


# ── RiskGate ────────────────────────────────────────────────


def test_gate_blocks_when_qty_above_cap():
    gate = RiskGate(RiskConfig(max_order_qty=5, initial_equity=100_000.0))
    runner = _runner(gate=gate)
    o = runner.submit_signal("SPY", OrderSide.BUY, qty=10)
    assert o.status == OrderStatus.REJECTED
    assert "max_order_qty" in (o.rejected_reason or "")


def test_gate_blocks_when_notional_above_cap():
    gate = RiskGate(RiskConfig(max_position_notional=2_000, initial_equity=100_000.0))
    runner = _runner(gate=gate)
    # 10 SPY @ 500 = 5_000 > 2_000 cap
    o = runner.submit_signal("SPY", OrderSide.BUY, qty=10)
    assert o.status == OrderStatus.REJECTED
    assert "notional" in (o.rejected_reason or "")


def test_gate_halts_on_drawdown_breach():
    # Initial equity 100k; cap 1%. Drop equity to 90k → should halt next call.
    quotes = {"SPY": 500.0}
    broker = PaperBroker(initial_cash=100_000.0, quote_fn=lambda s: quotes[s])
    gate = RiskGate(RiskConfig(max_drawdown_pct=1.0, initial_equity=100_000.0))
    runner = ExecutionRunner(broker=broker, gate=gate, session_id="dd")

    # Buy 10, mark price down → equity falls.
    runner.submit_signal("SPY", OrderSide.BUY, qty=10)
    quotes["SPY"] = 100.0  # equity ≈ 100k - 5k cash + 10*100 = 96k → -4% DD
    snap = broker.get_account()
    gate.update_equity(snap.equity)
    assert gate.is_halted()

    blocked = runner.submit_signal("SPY", OrderSide.BUY, qty=1)
    assert blocked.status == OrderStatus.REJECTED
    assert "drawdown" in (blocked.rejected_reason or "")


# ── Panic switch + journal ──────────────────────────────────


def test_panic_blocks_orders_until_cleared():
    runner = _runner()
    PanicService.engage("test")
    o = runner.submit_signal("SPY", OrderSide.BUY, qty=1)
    assert o.status == OrderStatus.REJECTED
    assert "panic" in (o.rejected_reason or "").lower()
    PanicService.clear()
    runner.gate.reset_halt()
    ok = runner.submit_signal("SPY", OrderSide.BUY, qty=1)
    assert ok.status == OrderStatus.FILLED


def test_kill_switch_closes_positions_and_engages_panic():
    runner = _runner()
    runner.submit_signal("SPY", OrderSide.BUY, qty=4)
    snap_before = runner.broker.get_account()
    assert any(p.symbol == "SPY" and p.qty == 4 for p in snap_before.positions)

    out = runner.kill_switch(reason="ui-test")
    assert out["panic"]["active"] is True
    snap_after = runner.broker.get_account()
    assert all(p.qty == 0 for p in snap_after.positions)


def test_journal_writes_every_attempt():
    runner = _runner(session="journal-test")
    runner.submit_signal("SPY", OrderSide.BUY, qty=2)              # filled
    runner.submit_signal("SPY", OrderSide.BUY, qty=99_999)         # rejected (qty cap)

    journal_path = JOURNAL_ROOT / "journal-test" / "orders.jsonl"
    rows = [json.loads(ln) for ln in journal_path.read_text().splitlines() if ln.strip()]
    assert len(rows) == 2
    assert rows[0]["status"] == OrderStatus.FILLED.value
    assert rows[1]["status"] == OrderStatus.REJECTED.value


# ── End-to-end exit criterion ───────────────────────────────


def test_ibkr_broker_constructs_without_tws_running():
    """Importing + instantiating IBKRBroker must not require TWS.
    Connection is lazy and the *first* call would raise — but
    construction alone has to be safe so the router can keep PaperBroker
    as a fallback when EXECUTION_BROKER=ibkr is set but TWS is offline.
    """
    b = IBKRBroker(host="127.0.0.1", port=7497, client_id=99)
    assert b.name == "ibkr"
    assert b.port == 7497
    # quote() must return None instead of raising when TWS isn't there.
    assert b.quote("AAPL") is None


def test_exit_criterion_template_signal_to_paper_fill():
    """Phase H exit criterion (paper variant):
    template signal → runner.submit → broker fills → journal row →
    account snapshot reflects the position. Exactly the path the
    Execution viewer page surfaces.
    """
    runner = _runner(session="exit-test")
    o = runner.submit_signal("SPY", OrderSide.BUY, qty=5)
    assert o.status == OrderStatus.FILLED
    assert o.fill_price == 500.0
    assert o.broker == "paper"

    journal = runner.list_orders()
    assert len(journal) == 1
    assert journal[0]["status"] == OrderStatus.FILLED.value

    snap = runner.broker.get_account()
    spy = next(p for p in snap.positions if p.symbol == "SPY")
    assert spy.qty == 5
    assert snap.cash == pytest.approx(100_000.0 - 5 * 500.0)
