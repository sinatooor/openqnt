"""Gemini Live API wrapper — one session per voice call.

Uses the `google-genai` SDK's Live API (`client.aio.live.connect`). The session
exposes async iterators for sending input audio + receiving model audio,
function-call requests, and turn boundaries.

Caller responsibilities:
  - feed PCM16 16 kHz audio with `send_audio_chunk(pcm)`
  - consume `events()` async generator: yields dicts shaped like
        {"type": "audio", "pcm24k": bytes}
        {"type": "tool_call", "id": str, "name": str, "args": dict}
        {"type": "transcript", "role": "user"|"model", "text": str}
        {"type": "interrupt"}            # user is barging in
        {"type": "turn_complete"}
  - send tool results with `send_tool_response(id, result)`
  - close with `await session.close()`
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Awaitable, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

GEMINI_LIVE_MODEL = os.getenv("GEMINI_LIVE_MODEL", "gemini-3.1-flash-live-preview")
GEMINI_INPUT_RATE = 16000
GEMINI_OUTPUT_RATE = 24000


@dataclass
class ToolDeclaration:
    name: str
    description: str
    parameters: Dict[str, Any]  # JSON Schema


# Gemini Live's function-declaration schema accepts only a strict subset of
# JSON Schema. Keys outside this set make the setup message fail with
# `1007 invalid frame payload data` and the call drops. Documented allowed
# keys: type, properties, required, items, enum, description, format, nullable.
# Notably **not** allowed: additionalProperties, default, exclusiveMinimum,
# exclusiveMaximum, $ref, $schema, oneOf, anyOf, patternProperties, etc.
_GEMINI_ALLOWED_KEYS = {
    "type", "properties", "required", "items", "enum",
    "description", "format", "nullable",
    "minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems",
}


def _sanitize_for_gemini(schema: Any) -> Any:
    """Recursively strip JSON-schema keys Gemini Live rejects.

    Without this, a single tool with `additionalProperties` (or `default`,
    `oneOf`, etc.) takes down the entire voice session at setup time.

    `properties` is a dict whose KEYS are property names (arbitrary), not
    schema keywords — its values are themselves schemas. Same for the
    `definitions`/`$defs`-style maps. Recurse into the values, keep the
    keys as-is.
    """
    if isinstance(schema, dict):
        out: Dict[str, Any] = {}
        for k, v in schema.items():
            if k not in _GEMINI_ALLOWED_KEYS:
                continue
            if k == "properties" and isinstance(v, dict):
                # Property names are arbitrary user keys — preserve them,
                # recurse only into the per-property schemas.
                out[k] = {pname: _sanitize_for_gemini(pschema) for pname, pschema in v.items()}
            else:
                out[k] = _sanitize_for_gemini(v)
        return out
    if isinstance(schema, list):
        return [_sanitize_for_gemini(x) for x in schema]
    return schema


@dataclass
class GeminiLiveConfig:
    system_instruction: str
    voice: str = "Aoede"  # Charon, Kore, Fenrir, Aoede, Puck
    tools: List[ToolDeclaration] = field(default_factory=list)
    enable_input_transcription: bool = True
    enable_output_transcription: bool = True


class GeminiLiveSession:
    """Wraps `google.genai.Client.aio.live.connect()` for the duration of a call."""

    def __init__(self, config: GeminiLiveConfig, api_key: Optional[str] = None) -> None:
        self.config = config
        self._api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not self._api_key:
            raise RuntimeError("GEMINI_API_KEY/GOOGLE_API_KEY not set")
        self._session = None
        self._client = None
        self._cm = None
        self._closed = False
        self._tool_results_q: asyncio.Queue = asyncio.Queue()

    async def __aenter__(self) -> "GeminiLiveSession":
        from google import genai
        from google.genai import types

        self._client = genai.Client(api_key=self._api_key)

        live_config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=types.Content(parts=[types.Part(text=self.config.system_instruction)]),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=self.config.voice)
                )
            ),
        )
        if self.config.tools:
            live_config.tools = [
                types.Tool(
                    function_declarations=[
                        types.FunctionDeclaration(
                            name=t.name,
                            description=t.description,
                            parameters=_sanitize_for_gemini(t.parameters),
                        )
                        for t in self.config.tools
                    ]
                )
            ]
        if self.config.enable_input_transcription:
            live_config.input_audio_transcription = types.AudioTranscriptionConfig()
        if self.config.enable_output_transcription:
            live_config.output_audio_transcription = types.AudioTranscriptionConfig()

        self._cm = self._client.aio.live.connect(model=GEMINI_LIVE_MODEL, config=live_config)
        self._session = await self._cm.__aenter__()
        logger.info("Gemini Live session opened (model=%s, voice=%s)", GEMINI_LIVE_MODEL, self.config.voice)
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.close()

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        try:
            if self._cm is not None:
                await self._cm.__aexit__(None, None, None)
        except Exception:
            logger.exception("Error closing Gemini Live session")

    async def send_audio_chunk(self, pcm16k: bytes) -> None:
        """Send a chunk of PCM16 mono 16 kHz audio to Gemini."""
        if self._session is None or self._closed:
            return
        from google.genai import types

        await self._session.send_realtime_input(
            audio=types.Blob(data=pcm16k, mime_type=f"audio/pcm;rate={GEMINI_INPUT_RATE}")
        )

    async def send_tool_response(self, call_id: str, name: str, result: Any) -> None:
        """Reply to a function_call from Gemini."""
        if self._session is None or self._closed:
            return
        from google.genai import types

        response_payload = result if isinstance(result, dict) else {"result": result}
        await self._session.send_tool_response(
            function_responses=[
                types.FunctionResponse(id=call_id, name=name, response=response_payload)
            ]
        )

    async def send_text(self, text: str) -> None:
        """Inject a system/user text turn (e.g. opening message, side messages)."""
        if self._session is None or self._closed:
            return
        from google.genai import types

        await self._session.send_client_content(
            turns=types.Content(role="user", parts=[types.Part(text=text)]),
            turn_complete=True,
        )

    async def events(self) -> AsyncIterator[Dict[str, Any]]:
        """Async iterator over normalized session events.

        `session.receive()` in google-genai 1.60+ yields ONE complete model
        turn and then ends — so for a continuous conversation we wrap it in
        an outer loop that calls receive() again after each turn ends.
        Without this, the bridge tears down right after the opening message.
        """
        if self._session is None:
            return
        try:
            while True:
                got_any = False
                async for response in self._session.receive():
                    got_any = True
                    async for ev in self._normalize_response(response):
                        yield ev
                # If receive() returned immediately without yielding anything,
                # the session is closed; bail out instead of spinning.
                if not got_any:
                    break
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Gemini Live receive loop crashed")
            yield {"type": "error", "message": "session_terminated"}

    async def _normalize_response(self, response: Any) -> AsyncIterator[Dict[str, Any]]:
        # Server content (audio + transcripts)
        sc = getattr(response, "server_content", None)
        if sc is not None:
            mt = getattr(sc, "model_turn", None)
            if mt is not None:
                for part in getattr(mt, "parts", []) or []:
                    inline = getattr(part, "inline_data", None)
                    if inline is not None and getattr(inline, "data", None):
                        yield {"type": "audio", "pcm24k": inline.data}
            inp_t = getattr(sc, "input_transcription", None)
            if inp_t is not None and getattr(inp_t, "text", None):
                yield {"type": "transcript", "role": "user", "text": inp_t.text}
            out_t = getattr(sc, "output_transcription", None)
            if out_t is not None and getattr(out_t, "text", None):
                yield {"type": "transcript", "role": "model", "text": out_t.text}
            if getattr(sc, "interrupted", False):
                yield {"type": "interrupt"}
            if getattr(sc, "turn_complete", False):
                yield {"type": "turn_complete"}

        # Tool calls
        tc = getattr(response, "tool_call", None)
        if tc is not None:
            for fc in getattr(tc, "function_calls", []) or []:
                yield {
                    "type": "tool_call",
                    "id": getattr(fc, "id", None) or fc.name,
                    "name": fc.name,
                    "args": dict(getattr(fc, "args", {}) or {}),
                }

        # Cancelled tool calls (model decided to skip)
        tcc = getattr(response, "tool_call_cancellation", None)
        if tcc is not None:
            for cid in getattr(tcc, "ids", []) or []:
                yield {"type": "tool_call_cancelled", "id": cid}


@asynccontextmanager
async def open_gemini_session(config: GeminiLiveConfig, api_key: Optional[str] = None):
    sess = GeminiLiveSession(config, api_key)
    async with sess:
        yield sess
