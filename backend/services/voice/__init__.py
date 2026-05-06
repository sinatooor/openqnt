"""Voice services — realtime AI calls bridged across Twilio, browser WebRTC, iOS, and SIP.

All transports plug into a single `GeminiLiveSession` so prompts, tools, and
transcript handling are shared. See `/Users/sina/.claude/plans/build-this-realtime-api-fancy-graham.md`.
"""

from .audio_bridge import (
    ulaw_to_pcm16,
    pcm16_to_ulaw,
    resample_pcm16,
    PCM16_GEMINI_IN_RATE,
    PCM16_GEMINI_OUT_RATE,
    ULAW_RATE,
)

__all__ = [
    "ulaw_to_pcm16",
    "pcm16_to_ulaw",
    "resample_pcm16",
    "PCM16_GEMINI_IN_RATE",
    "PCM16_GEMINI_OUT_RATE",
    "ULAW_RATE",
]
