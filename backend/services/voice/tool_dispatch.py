"""Mid-call tool dispatcher with risk tiers.

Three tiers:
  - read    → execute immediately, return result to Gemini
  - confirm → require `voice_trading_enabled=1` AND verbal confirmation
              (the dispatcher returns a synthetic "needs_confirmation" result
              and tracks pending confirms; Gemini's prompt instructs it to
              read the action back and wait for the user to say "yes" or
              "confirm" before re-issuing the call)
  - block   → never available in voice (dispatcher raises before calling)

The actual ADK tool functions live in `backend/adk_agents/tools/`. This
module just *adapts* them: maps Gemini function-call names → callables,
extracts the call user_id from session context, and writes audit rows.
"""

from __future__ import annotations

import asyncio
import inspect
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional, Set

logger = logging.getLogger(__name__)

ToolFn = Callable[..., Any]


@dataclass
class ToolSpec:
    name: str
    description: str
    parameters: Dict[str, Any]  # JSON Schema
    risk: str  # "read" | "confirm" | "block"
    fn: ToolFn


@dataclass
class DispatchContext:
    user_id: str
    call_id: str
    voice_trading_enabled: bool = False
    pending_confirmations: Set[str] = field(default_factory=set)
    audit_log: List[Dict[str, Any]] = field(default_factory=list)


class ToolRegistry:
    """Holds the full set of tools available to voice. Build once at startup."""

    def __init__(self) -> None:
        self._tools: Dict[str, ToolSpec] = {}

    def register(self, spec: ToolSpec) -> None:
        self._tools[spec.name] = spec

    def get(self, name: str) -> Optional[ToolSpec]:
        return self._tools.get(name)

    def declarations(self) -> List[ToolSpec]:
        return list(self._tools.values())

    def names(self) -> List[str]:
        return sorted(self._tools.keys())


def _confirmation_token_in_text(text: str) -> bool:
    if not text:
        return False
    t = text.lower().strip().rstrip(".!?")
    return t in {
        "yes", "yes.", "yep", "confirm", "confirmed", "do it", "go ahead",
        "ok", "okay", "sure", "affirmative", "approved", "proceed",
    }


async def dispatch(
    spec: ToolSpec,
    args: Dict[str, Any],
    ctx: DispatchContext,
) -> Dict[str, Any]:
    """Run a tool subject to its risk tier. Returns the JSON-serializable result."""
    audit_entry: Dict[str, Any] = {
        "ts": time.time(),
        "tool": spec.name,
        "risk": spec.risk,
        "args": args,
        "user_id": ctx.user_id,
        "call_id": ctx.call_id,
    }

    try:
        if spec.risk == "block":
            audit_entry["status"] = "blocked"
            return {"error": f"Tool '{spec.name}' is not available during voice calls."}

        if spec.risk == "confirm":
            if not ctx.voice_trading_enabled:
                audit_entry["status"] = "rejected_disabled"
                return {
                    "error": "Voice trading is disabled for this user.",
                    "hint": "Tell the user to enable 'Voice trading' in Profile → Settings.",
                }
            confirm_key = f"{spec.name}:{_stable_args_key(args)}"
            if confirm_key not in ctx.pending_confirmations:
                ctx.pending_confirmations.add(confirm_key)
                audit_entry["status"] = "needs_confirmation"
                return {
                    "needs_confirmation": True,
                    "instruction": (
                        "Read the action back to the user verbatim and ask them "
                        "to say 'yes' or 'confirm' to proceed. Then call this "
                        "tool again with the exact same arguments."
                    ),
                }
            ctx.pending_confirmations.discard(confirm_key)

        # Execute. Async or sync.
        if inspect.iscoroutinefunction(spec.fn):
            result = await spec.fn(**args)
        else:
            result = await asyncio.to_thread(spec.fn, **args)

        audit_entry["status"] = "ok"
        if not isinstance(result, dict):
            result = {"result": result}
        return result

    except TypeError as e:
        audit_entry["status"] = "bad_args"
        audit_entry["error"] = str(e)
        return {"error": f"bad arguments: {e}"}
    except Exception as e:
        logger.exception("Tool %s crashed", spec.name)
        audit_entry["status"] = "error"
        audit_entry["error"] = str(e)
        return {"error": str(e)}
    finally:
        ctx.audit_log.append(audit_entry)


def note_user_text_for_confirmation(text: str, ctx: DispatchContext) -> bool:
    """Call when user transcript arrives. Returns True if it cleared a pending
    confirm — the model should then re-issue the previously-blocked tool call.
    """
    if not ctx.pending_confirmations:
        return False
    if _confirmation_token_in_text(text):
        return True
    return False


def clear_pending_confirmations(ctx: DispatchContext) -> None:
    ctx.pending_confirmations.clear()


def _stable_args_key(args: Dict[str, Any]) -> str:
    import json

    try:
        return json.dumps(args, sort_keys=True, default=str)
    except Exception:
        return repr(args)


# ───────────────────────── Default registry ─────────────────────────────
# Wire ADK tools into a voice registry. Imports are best-effort: if an ADK
# tool is missing on a particular checkout, voice still works with the
# remaining ones.

def build_default_registry() -> ToolRegistry:
    reg = ToolRegistry()

    # ─── Read tier ──────────────────────────────────────────────────────
    try:
        from adk_agents.tools.broker_tools import (
            get_positions, get_account_info, get_market_price,
        )
        reg.register(ToolSpec(
            name="get_positions",
            description="Return the user's current open positions across all linked brokers.",
            parameters={"type": "object", "properties": {}, "required": []},
            risk="read", fn=get_positions,
        ))
        reg.register(ToolSpec(
            name="get_account_info",
            description="Return account cash, equity, buying power.",
            parameters={"type": "object", "properties": {}, "required": []},
            risk="read", fn=get_account_info,
        ))
        reg.register(ToolSpec(
            name="get_market_price",
            description="Get the current market price for a ticker symbol.",
            parameters={
                "type": "object",
                "properties": {"symbol": {"type": "string", "description": "e.g. AAPL"}},
                "required": ["symbol"],
            },
            risk="read", fn=get_market_price,
        ))
    except Exception as e:  # pragma: no cover
        logger.warning("voice: broker_tools not available (%s)", e)

    try:
        from adk_agents.tools.search_tools import search_market_news
        reg.register(ToolSpec(
            name="search_market_news",
            description="Search recent market news for a topic or ticker.",
            parameters={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "limit": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
            risk="read", fn=search_market_news,
        ))
    except Exception as e:  # pragma: no cover
        logger.warning("voice: search_tools not available (%s)", e)

    try:
        from adk_agents.tools.portfolio_tools import calculate_portfolio_beta
        reg.register(ToolSpec(
            name="calculate_portfolio_beta",
            description="Compute weighted beta of a portfolio against a benchmark.",
            parameters={
                "type": "object",
                "properties": {
                    "holdings": {
                        "type": "object",
                        "additionalProperties": {"type": "number"},
                        "description": "Symbol → weight, weights summing to ~1.0",
                    },
                    "benchmark": {"type": "string", "default": "SPY"},
                },
                "required": ["holdings"],
            },
            risk="read", fn=calculate_portfolio_beta,
        ))
    except Exception as e:  # pragma: no cover
        logger.warning("voice: portfolio_tools not available (%s)", e)

    # ─── Confirm tier ───────────────────────────────────────────────────
    try:
        from adk_agents.tools.broker_tools import execute_trade, close_position
        reg.register(ToolSpec(
            name="place_order",
            description="Place a market or limit order. Requires verbal confirmation.",
            parameters={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "side": {"type": "string", "enum": ["buy", "sell"]},
                    "quantity": {"type": "number"},
                    "order_type": {"type": "string", "enum": ["market", "limit"], "default": "market"},
                    "limit_price": {"type": "number"},
                },
                "required": ["symbol", "side", "quantity"],
            },
            risk="confirm", fn=execute_trade,
        ))
        reg.register(ToolSpec(
            name="close_position",
            description="Flatten an open position. Requires verbal confirmation.",
            parameters={
                "type": "object",
                "properties": {"symbol": {"type": "string"}},
                "required": ["symbol"],
            },
            risk="confirm", fn=close_position,
        ))
    except Exception as e:  # pragma: no cover
        logger.warning("voice: broker mutate tools not available (%s)", e)

    return reg
