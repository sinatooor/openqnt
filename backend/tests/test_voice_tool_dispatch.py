"""Tool dispatcher unit tests — risk tiers + verbal-confirm flow."""

from __future__ import annotations

import asyncio
import sys
import pathlib

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.voice import tool_dispatch as td


def _spec(name: str, risk: str, fn=None):
    return td.ToolSpec(
        name=name,
        description="t",
        parameters={"type": "object", "properties": {}, "required": []},
        risk=risk,
        fn=fn or (lambda **kw: {"ok": True, "echo": kw}),
    )


@pytest.mark.asyncio
async def test_read_tier_executes_immediately():
    ctx = td.DispatchContext(user_id="u", call_id="c", voice_trading_enabled=False)
    res = await td.dispatch(_spec("get_x", "read"), {"q": 1}, ctx)
    assert res == {"ok": True, "echo": {"q": 1}}


@pytest.mark.asyncio
async def test_block_tier_refuses():
    ctx = td.DispatchContext(user_id="u", call_id="c")
    res = await td.dispatch(_spec("dangerous", "block"), {}, ctx)
    assert "error" in res


@pytest.mark.asyncio
async def test_confirm_tier_requires_voice_trading_flag():
    ctx = td.DispatchContext(user_id="u", call_id="c", voice_trading_enabled=False)
    res = await td.dispatch(_spec("place_order", "confirm"), {"sym": "AAPL"}, ctx)
    assert "error" in res
    assert "Voice trading is disabled" in res["error"]


@pytest.mark.asyncio
async def test_confirm_tier_two_phase_flow():
    """First call → needs_confirmation. Second call after confirmation → executes."""
    ctx = td.DispatchContext(user_id="u", call_id="c", voice_trading_enabled=True)
    spec = _spec("place_order", "confirm")
    res1 = await td.dispatch(spec, {"sym": "AAPL", "qty": 1}, ctx)
    assert res1.get("needs_confirmation") is True
    assert ctx.pending_confirmations  # not empty

    # Simulate: user said "yes"
    cleared = td.note_user_text_for_confirmation("yes", ctx)
    assert cleared is True

    # Second tool call with same args — now executes
    res2 = await td.dispatch(spec, {"sym": "AAPL", "qty": 1}, ctx)
    assert res2.get("ok") is True
    assert not ctx.pending_confirmations


@pytest.mark.asyncio
async def test_unrelated_user_speech_does_not_clear_confirmation():
    ctx = td.DispatchContext(user_id="u", call_id="c", voice_trading_enabled=True)
    spec = _spec("place_order", "confirm")
    await td.dispatch(spec, {"sym": "AAPL"}, ctx)
    assert td.note_user_text_for_confirmation("what's the weather?", ctx) is False
    assert ctx.pending_confirmations  # still pending


@pytest.mark.asyncio
async def test_audit_log_captures_each_call():
    ctx = td.DispatchContext(user_id="u", call_id="c", voice_trading_enabled=False)
    await td.dispatch(_spec("a", "read"), {}, ctx)
    await td.dispatch(_spec("b", "block"), {}, ctx)
    statuses = [e["status"] for e in ctx.audit_log]
    assert "ok" in statuses
    assert "blocked" in statuses
