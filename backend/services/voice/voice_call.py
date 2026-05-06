"""Transport-agnostic voice call orchestrator.

`initiate_call(...)` is the single entry point used by:
  - Strategy Flow `phoneCall` action node
  - The `call_user` ADK tool (chat agents)
  - REST /api/voice/call (manual triggers, iOS app)

It writes a `voice_calls` row, optionally starts a Twilio outbound call
pointing at our public TwiML endpoint, and returns the call_id. The actual
audio + Gemini bridging happens later when Twilio (or a browser/iOS client)
opens a WebSocket to the bridge endpoint with this call_id.

Pending-call state (system prompt, allowed tools, opening message) is held
in memory keyed by call_id so the WS handler can pick it up.
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

logger = logging.getLogger(__name__)

Transport = Literal["twilio", "browser_webrtc", "ios_webrtc", "sip"]
TriggerSource = Literal["node", "agent", "user", "manual"]

PUBLIC_BACKEND_URL = os.getenv("PUBLIC_BACKEND_URL", "")  # e.g. https://abc.ngrok.app


@dataclass
class PendingCall:
    call_id: str
    user_id: str
    transport: Transport
    trigger_source: TriggerSource
    opening_message: str
    system_instruction: str
    allowed_tools: List[str]
    voice: str = "Aoede"
    created_at: float = field(default_factory=time.time)
    twilio_call_sid: Optional[str] = None
    started_at: Optional[float] = None
    ended_at: Optional[float] = None
    transcript_path: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)


# In-memory store of calls awaiting their bridge WebSocket. Cleared on connect.
_pending: Dict[str, PendingCall] = {}


def _transcript_path(call_id: str) -> Path:
    base = Path(os.getenv("VOICE_TRANSCRIPTS_DIR", "voice_transcripts"))
    base.mkdir(parents=True, exist_ok=True)
    return base / f"{call_id}.jsonl"


def _build_system_instruction(
    user_name: str,
    opening_message: str,
    allowed_tool_names: List[str],
    voice_trading_enabled: bool,
) -> str:
    confirm_block = (
        "When you call a tool tagged 'requires confirmation' (place_order, "
        "close_position, pause/resume strategy), you MUST first read the action "
        "back verbatim — symbol, side, quantity, price — and ask the user to say "
        "'yes' or 'confirm'. Only after they say yes, call the tool again with "
        "identical arguments. If the user says 'no' or anything else, do not call "
        "the tool again and acknowledge."
        if voice_trading_enabled
        else "Trade-execution tools are disabled for this user. If they ask you to "
             "place or modify orders, tell them they need to enable 'Voice trading' "
             "in their profile."
    )
    return (
        f"You are OpenQnt, an AI quant assistant calling {user_name}. "
        f"You speak conversationally — short sentences, plain English, no "
        f"markdown. Numbers should be spoken naturally ('twelve thousand four "
        f"hundred dollars', not '$12,400').\n\n"
        f"This call was initiated because: {opening_message}\n\n"
        f"Open by greeting the user and stating that reason in one sentence.\n\n"
        f"Available tools: {', '.join(allowed_tool_names) or '(none)'}.\n\n"
        f"{confirm_block}\n\n"
        f"If the user wants to end the call, acknowledge and stop talking — "
        f"do not call any tools afterward."
    )


def initiate_call(
    *,
    user_id: str,
    user_name: str,
    user_phone: Optional[str],
    voice_trading_enabled: bool,
    opening_message: str,
    transport: Transport,
    trigger_source: TriggerSource,
    allowed_tools: Optional[List[str]] = None,
    voice: str = "Aoede",
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a pending call and (for twilio) trigger the outbound dial.

    Returns: {call_id, transport, twilio_call_sid?, browser_session_url?}
    """
    call_id = uuid.uuid4().hex
    if allowed_tools is None:
        # Default to read-only tools — caller must opt into confirm-tier ones
        allowed_tools = [
            "get_positions", "get_account_info", "get_market_price",
            "search_market_news", "calculate_portfolio_beta",
        ]

    system_instruction = _build_system_instruction(
        user_name=user_name,
        opening_message=opening_message,
        allowed_tool_names=allowed_tools,
        voice_trading_enabled=voice_trading_enabled,
    )

    pending = PendingCall(
        call_id=call_id,
        user_id=user_id,
        transport=transport,
        trigger_source=trigger_source,
        opening_message=opening_message,
        system_instruction=system_instruction,
        allowed_tools=allowed_tools,
        voice=voice,
        extra=extra or {},
    )

    response: Dict[str, Any] = {"call_id": call_id, "transport": transport}

    if transport == "twilio":
        if not user_phone:
            raise ValueError("user_phone required for twilio transport")
        if not PUBLIC_BACKEND_URL:
            raise RuntimeError("PUBLIC_BACKEND_URL must be set so Twilio can reach the TwiML endpoint")
        sid = _start_twilio_call(call_id, user_phone)
        pending.twilio_call_sid = sid
        response["twilio_call_sid"] = sid
    elif transport == "ios_webrtc":
        # Ring all paired iOS devices via APNs. The actual audio bridge happens
        # later when the user taps "Answer" and the app opens /api/voice/ios-stream.
        push_results = _send_ios_voip_push(call_id, user_id, opening_message)
        response["ios_push_results"] = push_results
        if not any(r.get("ok") for r in push_results):
            response["warning"] = "no iOS devices reached — pair the OpenQnt app first"

    _pending[call_id] = pending

    # Persist a row immediately (started_at = None until the WS connects)
    try:
        from .. import voice_db  # type: ignore
        voice_db.create_voice_call(
            call_id=call_id,
            user_id=user_id,
            transport=transport,
            trigger_source=trigger_source,
            twilio_call_sid=pending.twilio_call_sid,
            transcript_path=str(_transcript_path(call_id)),
        )
    except Exception:
        logger.exception("voice_db not yet available — skipping persistence")

    return response


def _send_ios_voip_push(call_id: str, user_id: str, opening_message: str) -> List[Dict[str, Any]]:
    """Synchronously fire a VoIP push (best-effort)."""
    import asyncio

    ws_path = f"/api/voice/ios-stream?call_id={call_id}"
    base = PUBLIC_BACKEND_URL.replace("https://", "wss://").replace("http://", "ws://").rstrip("/")
    ws_url = f"{base}{ws_path}" if base else ws_path

    try:
        from .apns_voip import ring_user_devices

        async def _run():
            return await ring_user_devices(
                user_id=user_id,
                call_id=call_id,
                opening_message=opening_message,
                ws_url=ws_url,
            )

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        if loop.is_running():
            # Schedule and return immediately — caller proceeds; results land later
            asyncio.create_task(_run())
            return [{"scheduled": True}]
        return loop.run_until_complete(_run())
    except Exception as e:
        logger.exception("VoIP push failed")
        return [{"error": str(e)}]


def _start_twilio_call(call_id: str, to_phone: str) -> str:
    from twilio.rest import Client

    sid = os.environ["TWILIO_ACCOUNT_SID"]
    token = os.environ["TWILIO_AUTH_TOKEN"]
    from_phone = os.environ["TWILIO_PHONE_NUMBER"]

    twiml_url = f"{PUBLIC_BACKEND_URL.rstrip('/')}/api/voice/twiml?call_id={call_id}"
    status_url = f"{PUBLIC_BACKEND_URL.rstrip('/')}/api/voice/status"

    client = Client(sid, token)
    call = client.calls.create(
        to=to_phone,
        from_=from_phone,
        url=twiml_url,
        status_callback=status_url,
        status_callback_event=["initiated", "ringing", "answered", "completed"],
        status_callback_method="POST",
    )
    logger.info("Twilio call placed: sid=%s call_id=%s", call.sid, call_id)
    return call.sid


def claim_pending_call(call_id: str) -> Optional[PendingCall]:
    """Pop the pending call when the bridge WebSocket connects."""
    p = _pending.pop(call_id, None)
    if p is not None:
        p.started_at = time.time()
    return p


def peek_pending_call(call_id: str) -> Optional[PendingCall]:
    return _pending.get(call_id)


def write_transcript_event(call_id: str, event: Dict[str, Any]) -> None:
    """Append a JSONL event to the call transcript."""
    try:
        path = _transcript_path(call_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a") as f:
            f.write(json.dumps({"ts": time.time(), **event}, default=str) + "\n")
    except Exception:
        logger.exception("Failed to write transcript event for %s", call_id)


def finalize_call(
    call_id: str,
    duration_s: Optional[float] = None,
    error: Optional[str] = None,
) -> None:
    try:
        from .. import voice_db  # type: ignore
        voice_db.finalize_voice_call(
            call_id=call_id,
            ended_at=time.time(),
            duration_s=duration_s,
            error=error,
        )
    except Exception:
        logger.exception("finalize_call: voice_db missing or failed")
