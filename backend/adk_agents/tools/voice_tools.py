"""Voice tools — let chat agents place an outbound AI voice call.

The chat agent calls `call_user(...)`. We resolve the user via env var
OPENQNT_AGENT_USER_ID (set per-run by the agent runner), look up phone /
voice-trading flags, and trigger the voice orchestrator to place a Twilio
call. The call is handled by `services.voice` once the user picks up.

For iOS-paired users, set transport='ios_webrtc' to ring the app instead.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

DEFAULT_VOICE_READ_TOOLS = [
    "get_positions", "get_account_info", "get_market_price",
    "search_market_news", "calculate_portfolio_beta",
]
DEFAULT_VOICE_TRADE_TOOLS = ["place_order", "close_position"]


def _current_user_id() -> Optional[str]:
    return os.getenv("OPENQNT_AGENT_USER_ID") or os.getenv("OPENQNT_DEFAULT_USER_ID")


def call_user(
    reason: str,
    transport: str = "twilio",
    include_trade_tools: bool = False,
    voice: str = "Aoede",
    user_phone: Optional[str] = None,
) -> str:
    """Place a realtime AI voice call to the current user.

    Args:
        reason: One-sentence "why we're calling" — becomes the AI's opening line.
        transport: 'twilio' (default — rings the user's cell) or 'ios_webrtc' (rings paired iOS app).
        include_trade_tools: Set True if the user might need to place orders mid-call.
            Trade tools always require verbal confirmation regardless of this flag.
        voice: Gemini voice name (Aoede, Charon, Kore, Fenrir, Puck).
        user_phone: Override the stored phone number (E.164). Optional.

    Returns:
        A short status string suitable to read back to the agent.
    """
    user_id = _current_user_id()
    if not user_id:
        return "ERROR: no user context — set OPENQNT_AGENT_USER_ID before calling this tool."

    try:
        from services import voice_db
        from services.voice import voice_call as voice_orch
    except Exception as e:
        return f"ERROR: voice subsystem not available: {e}"

    profile = voice_db.get_user_voice_profile(user_id)
    if not profile:
        return f"ERROR: user {user_id} not found"
    phone = user_phone or profile.get("phone_number")
    if transport == "twilio" and not phone:
        return "ERROR: user has no phone number on file. Suggest they add one in Profile."

    allowed = list(DEFAULT_VOICE_READ_TOOLS)
    if include_trade_tools:
        allowed.extend(DEFAULT_VOICE_TRADE_TOOLS)

    try:
        result = voice_orch.initiate_call(
            user_id=user_id,
            user_name=profile.get("name") or "trader",
            user_phone=phone,
            voice_trading_enabled=bool(profile.get("voice_trading_enabled")),
            opening_message=reason,
            transport=transport,  # type: ignore[arg-type]
            trigger_source="agent",
            allowed_tools=allowed,
            voice=voice,
        )
    except Exception as e:
        logger.exception("call_user failed")
        return f"ERROR: failed to start call: {e}"

    sid = result.get("twilio_call_sid")
    return (
        f"Calling {phone or 'user'} now (call_id={result['call_id']}"
        + (f", twilio_sid={sid}" if sid else "")
        + ")."
    )


__all__ = ["call_user"]
