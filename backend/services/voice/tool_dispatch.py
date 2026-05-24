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
import json
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
    # When set, `risk="confirm"` tools require the user to speak the
    # passphrase before the verbal "yes" gate runs. Empty/None disables it
    # for back-compat. Plain text by design — Gemini Live STT delivers
    # transcribed speech and we need a fuzzy match.
    voice_passphrase: Optional[str] = None
    passphrase_satisfied: bool = False
    pending_passphrase: Set[str] = field(default_factory=set)


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

    def names_for_risk(self, *risks: str) -> List[str]:
        """Tool names matching any of the given risk tiers ("read"/"confirm"/"block")."""
        allowed = set(risks)
        return sorted(name for name, spec in self._tools.items() if spec.risk in allowed)


_CONFIRMATION_TOKENS = (
    "yes", "yep", "yeah", "confirm", "confirmed", "do it", "go ahead",
    "okay", "affirmative", "approved", "proceed",
)


def _confirmation_token_in_text(text: str) -> bool:
    """True if any confirmation phrase appears as a whole word/phrase in the
    transcript. "yes, do it" and "okay, proceed" should both count; "yesterday"
    and "approximately" should not.
    """
    if not text:
        return False
    import re
    normalized = re.sub(r"[^\w\s]", " ", text.lower())
    normalized = f" {re.sub(r'\s+', ' ', normalized).strip()} "
    for token in _CONFIRMATION_TOKENS:
        if f" {token} " in normalized:
            return True
    # Bare "ok"/"sure" — handled separately so we don't false-positive on
    # words like "okra" or "surely". Require they appear as standalone words.
    for short in ("ok", "sure"):
        if re.search(rf"\b{short}\b", normalized):
            return True
    return False


def _normalize_passphrase(s: Optional[str]) -> str:
    """Casefold + collapse whitespace + strip punctuation for fuzzy match."""
    if not s:
        return ""
    import re
    cleaned = re.sub(r"[^\w\s]", "", s, flags=re.UNICODE).casefold()
    return re.sub(r"\s+", " ", cleaned).strip()


def _passphrase_in_text(transcript: str, passphrase: Optional[str]) -> bool:
    """True if the normalized passphrase appears as a contiguous substring
    of the normalized transcript. Gives the user some slack on punctuation
    and capitalization without allowing trivial leaks."""
    needle = _normalize_passphrase(passphrase)
    if not needle:
        return False
    haystack = _normalize_passphrase(transcript)
    return needle in haystack


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
            # Stage 1: voice passphrase (only if user has one configured).
            if ctx.voice_passphrase and not ctx.passphrase_satisfied:
                ctx.pending_passphrase.add(confirm_key)
                audit_entry["status"] = "needs_passphrase"
                return {
                    "needs_passphrase": True,
                    "instruction": (
                        "Before this action can proceed, ask the user to say "
                        "their voice passphrase out loud. Do NOT say the "
                        "passphrase yourself. After they say it, call this "
                        "tool again with the exact same arguments."
                    ),
                }
            # Stage 2: verbal confirmation ("yes / confirm").
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
            ctx.pending_passphrase.discard(confirm_key)

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


def note_user_text(text: str, ctx: DispatchContext) -> str:
    """Call when user transcript arrives. Returns:
      - "passphrase_satisfied" — the user just spoke the configured passphrase
      - "confirmation_satisfied" — the user said "yes/confirm"; the model
        should re-issue the previously-blocked tool call
      - "" — neither

    Order: passphrase first, then confirm. A single utterance like
    "alpha bravo charlie yes" satisfies both in one shot."""
    cleared_phrase = False
    if ctx.voice_passphrase and not ctx.passphrase_satisfied and ctx.pending_passphrase:
        if _passphrase_in_text(text, ctx.voice_passphrase):
            ctx.passphrase_satisfied = True
            ctx.pending_passphrase.clear()
            cleared_phrase = True
    if ctx.pending_confirmations and _confirmation_token_in_text(text):
        return "confirmation_satisfied"
    return "passphrase_satisfied" if cleared_phrase else ""


# Back-compat shim — older call sites use the historical name and just want
# a bool ("did anything clear?"). The new logic above is a superset.
def note_user_text_for_confirmation(text: str, ctx: DispatchContext) -> bool:
    return bool(note_user_text(text, ctx))


def clear_pending_confirmations(ctx: DispatchContext) -> None:
    ctx.pending_confirmations.clear()
    ctx.pending_passphrase.clear()
    ctx.passphrase_satisfied = False


def _stable_args_key(args: Dict[str, Any]) -> str:
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

    # ─── Read tier — Avanza + IBKR live data ────────────────────────────
    # Same managers the chat agent uses; no HTTP hop, in-process.

    try:
        from integrations.avanza.manager import get_manager as _avz_mgr
        from integrations.avanza.storage import get_storage as _avz_storage
        from integrations.avanza.normalize import positions_from_avanza
        from integrations.ibkr.manager import get_ibkr_manager

        async def _get_portfolio_summary(broker: str = "all") -> Dict[str, Any]:
            """Returns live Avanza + IBKR portfolio (or one of them)."""
            broker = (broker or "all").lower()
            if broker not in ("all", "avanza", "ibkr"):
                return {
                    "success": False,
                    "error": f"Unknown broker '{broker}'. Use 'all', 'avanza', or 'ibkr'.",
                }
            out: Dict[str, Any] = {"broker": broker}

            if broker in ("all", "avanza"):
                try:
                    if not _avz_storage().load_credentials("default"):
                        out["avanza"] = {"connected": False, "message": "Avanza not connected"}
                    else:
                        c = await _avz_mgr().authed_client("default")
                        acc = await c.accounts_list()
                        ids = [str(a.get("urlParameterId")) for a in (acc or []) if a.get("urlParameterId")]
                        positions = positions_from_avanza(await c.positions())
                        positions.sort(key=lambda p: p.get("market_value") or 0, reverse=True)
                        top = [
                            {"name": p.get("name"), "qty": p.get("quantity"),
                             "marketValueSek": p.get("market_value"),
                             "currency": p.get("currency")}
                            for p in positions[:8]
                        ]
                        totals = await c.performance_totals(ids) if ids else {}
                        out["avanza"] = {
                            "connected": True, "currency": "SEK",
                            "totalValueSek": ((totals.get("totalValue") or {}).get("totalValue") or {}).get("value"),
                            "positionsCount": len(positions),
                            "topPositions": top,
                        }
                except Exception as ex:
                    out["avanza"] = {"connected": False, "error": str(ex)}

            if broker in ("all", "ibkr"):
                try:
                    mgr = get_ibkr_manager()
                    if not mgr.is_connected():
                        if not await mgr.ensure_connected_from_storage("default"):
                            out["ibkr"] = {"connected": False, "message": "IBKR not connected — start TWS"}
                        else:
                            snap = await mgr.get_account()
                            out["ibkr"] = _snap_to_dict(snap)
                    else:
                        snap = await mgr.get_account()
                        out["ibkr"] = _snap_to_dict(snap)
                except Exception as ex:
                    out["ibkr"] = {"connected": False, "error": str(ex)}
            return out

        def _snap_to_dict(snap) -> Dict[str, Any]:
            top = sorted(
                [p for p in snap.positions if p.qty != 0],
                key=lambda p: abs(p.qty * p.last_price),
                reverse=True,
            )[:8]
            return {
                "connected": True, "currency": "USD",
                "equity": snap.equity, "cash": snap.cash, "buyingPower": snap.buying_power,
                "unrealisedPnl": snap.unrealised_pnl,
                "positionsCount": len(snap.positions),
                "topPositions": [
                    {"symbol": p.symbol, "qty": p.qty,
                     "avgPrice": p.avg_price, "lastPrice": p.last_price}
                    for p in top
                ],
            }

        reg.register(ToolSpec(
            name="get_portfolio_summary",
            description=(
                "Live portfolio across the user's connected brokers (Avanza in SEK, "
                "IBKR in USD). Default returns BOTH side-by-side. Use whenever the "
                "user asks about their portfolio, positions, holdings, or balance."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "broker": {"type": "string", "enum": ["all", "avanza", "ibkr"]},
                },
                "required": [],
            },
            risk="read", fn=_get_portfolio_summary,
        ))

        # Friendly aliases — the LLM might ask either name.
        async def _get_positions() -> Dict[str, Any]:
            return await _get_portfolio_summary("all")
        reg.register(ToolSpec(
            name="get_positions",
            description="Alias of get_portfolio_summary — returns live positions across all connected brokers.",
            parameters={"type": "object", "properties": {}, "required": []},
            risk="read", fn=_get_positions,
        ))

        async def _get_account_info() -> Dict[str, Any]:
            return await _get_portfolio_summary("all")
        reg.register(ToolSpec(
            name="get_account_info",
            description="Live account cash, equity, and buying power across all connected brokers.",
            parameters={"type": "object", "properties": {}, "required": []},
            risk="read", fn=_get_account_info,
        ))

        async def _get_ibkr_account() -> Dict[str, Any]:
            return await _get_portfolio_summary("ibkr")
        reg.register(ToolSpec(
            name="get_ibkr_account",
            description="IBKR account snapshot — equity (USD), cash, buying power, and open positions.",
            parameters={"type": "object", "properties": {}, "required": []},
            risk="read", fn=_get_ibkr_account,
        ))

    except Exception as e:  # pragma: no cover
        logger.warning("voice: portfolio adapters not available (%s)", e)

    # get_stock_quote — Avanza search → quote
    try:
        from integrations.avanza.manager import get_manager as _avz_mgr2
        from integrations.avanza.instrument_resolver import InstrumentResolver

        async def _get_stock_quote(symbol: str) -> Dict[str, Any]:
            try:
                client = await _avz_mgr2().authed_client("default")
                resolver = InstrumentResolver(client)
                resolved = await resolver.resolve(symbol)
                if not resolved or not resolved.get("orderbookId"):
                    return {"success": False, "error": f"Could not resolve symbol '{symbol}'"}
                q = await client.stock_quote(resolved["orderbookId"])
                return {
                    "success": True,
                    "symbol": symbol.upper(),
                    "name": resolved.get("name"),
                    "last": q.get("last"),
                    "buy": q.get("buy"),
                    "sell": q.get("sell"),
                    "changePercent": q.get("changePercent"),
                    "currency": resolved.get("currency"),
                }
            except Exception as ex:
                return {"success": False, "error": str(ex)}

        reg.register(ToolSpec(
            name="get_stock_quote",
            description=(
                "Get a live stock quote (last, buy, sell, change %) for any symbol or "
                "company name. Resolves via Avanza search — works for 'Apple', 'AAPL', "
                "'Investor B', etc."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "Ticker or company name"},
                },
                "required": ["symbol"],
            },
            risk="read", fn=_get_stock_quote,
        ))

        # Kept the old name as alias for backward LLM familiarity.
        reg.register(ToolSpec(
            name="get_market_price",
            description="Alias of get_stock_quote.",
            parameters={
                "type": "object",
                "properties": {"symbol": {"type": "string"}},
                "required": ["symbol"],
            },
            risk="read", fn=_get_stock_quote,
        ))
    except Exception as e:  # pragma: no cover
        logger.warning("voice: stock-quote adapter not available (%s)", e)

    # get_market_index — OMX30 / SPX / NDX / DJI
    try:
        from integrations.avanza.manager import get_manager as _avz_mgr3
        _INDEX_MAP = {
            "OMX30": "19002", "OMX": "19002", "OMXS30": "19002",
            "SPX": "19000", "S&P 500": "19000", "SP500": "19000",
            "NDX": "18981", "NASDAQ": "18981", "NASDAQ 100": "18981",
            "DJI": "18983", "DOW": "18983", "DOW JONES": "18983",
        }

        async def _get_market_index(name: str) -> Dict[str, Any]:
            key = (name or "").strip().upper()
            ob_id = _INDEX_MAP.get(key)
            if not ob_id:
                return {"success": False, "error": f"Unknown index '{name}'. Supported: OMX30, SPX, NDX, DJI."}
            try:
                c = await _avz_mgr3().anon_client()
                r = await c.market_index(ob_id)
                q = r.get("quote") or {}
                return {
                    "success": True,
                    "name": r.get("name"),
                    "last": q.get("last"),
                    "changePercent": q.get("changePercent"),
                    "change": q.get("change"),
                }
            except Exception as ex:
                return {"success": False, "error": str(ex)}

        reg.register(ToolSpec(
            name="get_market_index",
            description="Live index quote (OMX30, S&P 500, Nasdaq 100, Dow Jones).",
            parameters={
                "type": "object",
                "properties": {"name": {"type": "string", "description": "Index name"}},
                "required": ["name"],
            },
            risk="read", fn=_get_market_index,
        ))
    except Exception as e:  # pragma: no cover
        logger.warning("voice: market-index adapter not available (%s)", e)

    # get_market_news — Avanza per-stock news after resolving symbol
    try:
        from integrations.avanza.manager import get_manager as _avz_mgr4
        from integrations.avanza.instrument_resolver import InstrumentResolver as _Resolver2

        async def _get_market_news(symbol: str) -> Dict[str, Any]:
            try:
                client = await _avz_mgr4().authed_client("default")
                resolver = _Resolver2(client)
                resolved = await resolver.resolve(symbol)
                if not resolved or not resolved.get("orderbookId"):
                    return {"success": False, "error": f"Could not resolve symbol '{symbol}'"}
                payload = await client.news(resolved["orderbookId"])
                items = (payload.get("items") or payload.get("articles") or [])[:10]
                return {
                    "success": True,
                    "symbol": symbol.upper(),
                    "name": resolved.get("name"),
                    "count": len(items),
                    "items": [
                        {
                            "headline": it.get("headline") or it.get("title"),
                            "summary": (it.get("summary") or it.get("preamble") or "")[:200],
                            "source": it.get("source"),
                            "timestamp": it.get("timestamp") or it.get("publishedDate"),
                        }
                        for it in items
                    ],
                }
            except Exception as ex:
                return {"success": False, "error": str(ex)}

        reg.register(ToolSpec(
            name="get_market_news",
            description="Recent news headlines for a stock symbol or company name (via Avanza).",
            parameters={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "Ticker or company name"},
                },
                "required": ["symbol"],
            },
            risk="read", fn=_get_market_news,
        ))
        async def _search_market_news(query: str) -> Dict[str, Any]:
            return await _get_market_news(query)

        reg.register(ToolSpec(
            name="search_market_news",
            description="Alias of get_market_news.",
            parameters={
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
            risk="read",
            fn=_search_market_news,
        ))
    except Exception as e:  # pragma: no cover
        logger.warning("voice: market-news adapter not available (%s)", e)

    # get_upcoming_dividends — list across user's positions
    try:
        from integrations.avanza.manager import get_manager as _avz_mgr5

        async def _get_upcoming_dividends() -> Dict[str, Any]:
            try:
                c = await _avz_mgr5().authed_client("default")
                payload = await c.upcoming_dividends()
                items = payload if isinstance(payload, list) else (payload or {}).get("items", [])
                items = sorted(items, key=lambda d: d.get("date", ""))[:15]
                total_sek = sum(d.get("amountInSek") or 0 for d in items)
                return {
                    "success": True,
                    "count": len(items),
                    "totalSek": total_sek,
                    "items": [
                        {
                            "instrument": d.get("instrumentName"),
                            "date": d.get("date"),
                            "amountInSek": d.get("amountInSek"),
                            "status": d.get("status"),
                        }
                        for d in items
                    ],
                }
            except Exception as ex:
                return {"success": False, "error": str(ex)}

        reg.register(ToolSpec(
            name="get_upcoming_dividends",
            description="Upcoming dividend payments across the user's Avanza positions.",
            parameters={"type": "object", "properties": {}, "required": []},
            risk="read", fn=_get_upcoming_dividends,
        ))
    except Exception as e:  # pragma: no cover
        logger.warning("voice: dividends adapter not available (%s)", e)

    # ─── Confirm tier — live broker trades ──────────────────────────────
    # Routes to the executionService via /api/execution/signal so we go
    # through the SAME path as strategy-generated orders (risk gate +
    # broker selector). Defaults to paper for safety.
    try:
        import httpx

        async def _place_order(
            symbol: str,
            side: str,
            quantity: float,
            order_type: str = "market",
            limit_price: Optional[float] = None,
            broker: str = "paper",
        ) -> Dict[str, Any]:
            payload = {
                "symbol": symbol.upper(),
                "side": side.lower(),
                "qty": float(quantity),
                "type": order_type.lower(),
            }
            if limit_price is not None:
                payload["limit_price"] = float(limit_price)
            url = f"http://localhost:8000/api/execution/signal?broker={broker}"
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.post(url, json=payload)
                if r.status_code >= 400:
                    return {"success": False, "error": f"HTTP {r.status_code}: {r.text[:200]}"}
                return {"success": True, "order": r.json()}

        reg.register(ToolSpec(
            name="place_order",
            description=(
                "Place a real broker order. The user must speak the voice passphrase "
                "verbally before this runs. Default broker is 'paper' for safety; "
                "ask the user explicitly before using 'avanza' or 'ibkr'."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "side": {"type": "string", "enum": ["buy", "sell"]},
                    "quantity": {"type": "number"},
                    "order_type": {"type": "string", "enum": ["market", "limit"]},
                    "limit_price": {"type": "number"},
                    "broker": {"type": "string", "enum": ["paper", "avanza", "ibkr", "alpaca"]},
                },
                "required": ["symbol", "side", "quantity"],
            },
            risk="confirm", fn=_place_order,
        ))
    except Exception as e:  # pragma: no cover
        logger.warning("voice: place_order adapter not available (%s)", e)

    # ─── Widen the surface for "ask anything in chat-style during a call" ──
    #
    # These adapters wrap chat-grade tools so Gemini Live can run them
    # mid-call. Order matters: keep all as read-tier; only mutating tools
    # should be `risk="confirm"`.

    # send_notification — emit Telegram/Slack/SMS via the orchestrator.
    try:
        from adk_agents.tools.notification_tools import send_notification

        def _send_notification_adapter(
            channel: str = "telegram",
            body: str = "",
            title: Optional[str] = None,
            attachment_path: Optional[str] = None,
            attachment_kind: str = "photo",
        ) -> Dict[str, Any]:
            return send_notification(
                channel=channel,
                body=body,
                title=title,
                attachment_path=attachment_path,
                attachment_kind=attachment_kind,
            )

        reg.register(ToolSpec(
            name="send_notification",
            description=(
                "Push a notification to the user via Telegram / Slack / SMS / email. "
                "Use this to deliver charts, research summaries, or follow-ups after the call. "
                "Pass attachment_path for a Monte Carlo plot or PDF."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "channel": {"type": "string", "enum": ["telegram", "slack", "sms", "email"], "description": "Notification channel (default: telegram)"},
                    "body": {"type": "string"},
                    "title": {"type": "string"},
                    "attachment_path": {"type": "string", "description": "Absolute file path to attach"},
                    "attachment_kind": {"type": "string", "enum": ["photo", "document"], "description": "Attachment kind (default: photo)"},
                },
                "required": ["body"],
            },
            risk="read", fn=_send_notification_adapter,
        ))
    except Exception as e:  # pragma: no cover
        logger.warning("voice: notification_tools not available (%s)", e)

    # run_monte_carlo — call the MCPT router in-process (no HTTP hop).
    try:
        from routers.mcpt import run_mcpt, McptRequest
        import base64 as _b64
        import tempfile as _tempfile
        import uuid as _uuid
        from pathlib import Path as _Path

        async def _run_monte_carlo_adapter(
            symbol: str,
            start_date: str,
            end_date: str,
            timeframe: str = "1d",
            permutations: int = 1000,
        ) -> Dict[str, Any]:
            req = McptRequest(
                symbol=symbol,
                start_date=start_date,
                end_date=end_date,
                timeframe=timeframe,
                permutations=permutations,
            )
            resp = await run_mcpt(req)
            payload: Dict[str, Any] = resp.dict() if hasattr(resp, "dict") else dict(resp)

            # The MCPT router returns plotImage as `data:image/png;base64,…`,
            # but send_notification wants a file path. Decode the base64 to a
            # tmp file once here so the next voice turn can attach it directly.
            plot_data_url = payload.pop("plotImage", None)
            if isinstance(plot_data_url, str) and plot_data_url.startswith("data:image/"):
                try:
                    header, b64data = plot_data_url.split(",", 1)
                    ext = "png" if "png" in header else "jpg"
                    tmp_dir = _Path(_tempfile.gettempdir()) / "openqwnt_plots"
                    tmp_dir.mkdir(parents=True, exist_ok=True)
                    plot_path = tmp_dir / f"mcpt_{symbol}_{_uuid.uuid4().hex[:8]}.{ext}"
                    plot_path.write_bytes(_b64.b64decode(b64data))
                    payload["plot_path"] = str(plot_path)
                except Exception as _e:
                    logger.warning("mcpt plot decode failed: %s", _e)
            return payload

        reg.register(ToolSpec(
            name="run_monte_carlo",
            description=(
                "Run a Monte Carlo permutation test on a symbol. Returns p-value, "
                "robustness stats, and a `plot_path` (absolute file path) you can "
                "pass directly to send_notification's attachment_path to deliver "
                "the chart to Telegram."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "start_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "end_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "timeframe": {"type": "string", "description": "Bar timeframe (default: 1d)"},
                    "permutations": {"type": "integer", "description": "Number of permutations (default: 1000)"},
                },
                "required": ["symbol", "start_date", "end_date"],
            },
            risk="read", fn=_run_monte_carlo_adapter,
        ))
    except Exception as e:  # pragma: no cover
        logger.warning("voice: mcpt router not available (%s)", e)

    # (get_market_news / search_market_news are registered higher up by the
    # Avanza-backed adapter; the old legacy search_tools fallback is dropped.)

    # ─── Cross-agent: Gemini → Anthropic (Claude) delegation ────────────
    # When the user asks for deep multi-step research mid-call ("dig into
    # NVDA earnings impact on my portfolio"), Gemini Live can hand off to
    # the Claude chat agent which has stronger long-form reasoning, more
    # tools (build_strategy, run_backtest, etc.), and can chain calls.
    # We do this in-process by streaming /api/ai-assistant/chat/stream and
    # collecting the final text. The two agents share the SAME data
    # sources (Avanza/IBKR managers, agent_runs db) so Claude reads the
    # same live portfolio Gemini does.
    try:
        import httpx as _httpx

        async def _delegate_to_chat_agent(prompt: str, timeout_s: float = 60.0) -> Dict[str, Any]:
            """Send `prompt` to the Anthropic-backed chat agent and return
            the assistant's final answer as plain text.

            The chat stream emits text_delta + tool_call/tool_result events;
            we accumulate the text_deltas and surface a compact transcript of
            any tools Claude ran (so Gemini can mention them when reading the
            answer aloud)."""
            url = "http://localhost:8000/api/ai-assistant/chat/stream"
            body = {"message": prompt, "history": []}
            accumulated_text = ""
            tools_used: list = []
            try:
                async with _httpx.AsyncClient(timeout=timeout_s) as client:
                    async with client.stream("POST", url, json=body) as resp:
                        if resp.status_code >= 400:
                            return {"success": False, "error": f"HTTP {resp.status_code}: {await resp.aread()!r}"}
                        async for raw_line in resp.aiter_lines():
                            line = (raw_line or "").strip()
                            if not line.startswith("data:"):
                                continue
                            payload = line[5:].strip()
                            try:
                                ev = json.loads(payload)
                            except Exception:
                                continue
                            t = ev.get("type")
                            if t == "text_delta":
                                accumulated_text += ev.get("content", "")
                            elif t == "tool_call":
                                tools_used.append(ev.get("tool"))
                            elif t == "done":
                                break
                            elif t == "error":
                                return {"success": False, "error": ev.get("message", "agent error")}
                return {
                    "success": True,
                    "answer": accumulated_text.strip() or "(Claude returned no text — only tool output)",
                    "tools_used": tools_used,
                }
            except Exception as ex:
                return {"success": False, "error": str(ex)}

        reg.register(ToolSpec(
            name="delegate_to_chat_agent",
            description=(
                "Hand a complex / multi-step research question to the Claude "
                "chat agent. Use this for deep reasoning tasks — strategy "
                "building, multi-tool research, backtest interpretation, "
                "anything where Claude's longer reasoning beats your real-time "
                "voice answer. The result comes back as a text answer you can "
                "read aloud or pass to send_notification. Both agents share "
                "the same Avanza/IBKR live data."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "The full research question, e.g. 'Compare my Avanza Apple position to the QQQ trend over the last 90 days and tell me if I should hedge'",
                    },
                },
                "required": ["prompt"],
            },
            risk="read", fn=_delegate_to_chat_agent,
        ))
    except Exception as e:  # pragma: no cover
        logger.warning("voice: delegate_to_chat_agent not available (%s)", e)

    return reg
