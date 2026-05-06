"""Asterisk ARI bridge — v3 SIP power-user path.

Workflow:
  1. Backend originates a call via ARI `channels.originate(endpoint=PJSIP/openqnt, app='openqnt-voice', ...)`
  2. Asterisk's dialplan executes Stasis(openqnt-voice), giving us control
     of the channel
  3. We add the channel to a bridge and start an External Media channel
     pointing at our local UDP server. Asterisk now sends RTP (μ-law/SLIN)
     to us and we send RTP back.
  4. We decode/encode RTP, run audio through `audio_bridge`, and pump it
     in/out of `GeminiLiveSession`.

This is more involved than Twilio Media Streams (which gives base64 frames
over WebSocket), but unlocks free SIP-to-SIP calls for users with Linphone
registered to the Asterisk PBX.

Ship this AFTER v1/v2/v4 are stable — it's the most infra and the smallest
incremental payoff (saves ~$0.013/min per call vs Twilio).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import struct
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

ARI_URL = os.getenv("ASTERISK_ARI_URL", "http://localhost:8088/ari")
ARI_USER = os.getenv("ASTERISK_ARI_USER", "openqnt")
ARI_PASS = os.getenv("ASTERISK_ARI_PASSWORD", "change-me-in-production")
ARI_APP = os.getenv("ASTERISK_ARI_APP", "openqnt-voice")
EXTERNAL_MEDIA_HOST = os.getenv("ASTERISK_EXT_MEDIA_HOST", "127.0.0.1")
EXTERNAL_MEDIA_PORT = int(os.getenv("ASTERISK_EXT_MEDIA_PORT", "40000"))


@dataclass
class SipCallHandle:
    call_id: str
    channel_id: str
    bridge_id: str
    extmedia_channel_id: str
    rtp_local_port: int


class AsteriskAriClient:
    """Tiny ARI HTTP/WebSocket client. Lazy-imports `aiohttp`."""

    def __init__(self) -> None:
        self._session = None
        self._ws = None

    async def __aenter__(self) -> "AsteriskAriClient":
        import aiohttp

        self._session = aiohttp.ClientSession(auth=aiohttp.BasicAuth(ARI_USER, ARI_PASS))
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self._ws and not self._ws.closed:
            await self._ws.close()
        if self._session:
            await self._session.close()

    async def originate(self, endpoint: str, caller_id: str = "OpenQnt AI") -> str:
        """Originate a SIP call via PJSIP/<extension> into our Stasis app."""
        url = f"{ARI_URL}/channels"
        params = {
            "endpoint": endpoint,
            "app": ARI_APP,
            "callerId": caller_id,
        }
        async with self._session.post(url, params=params) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data["id"]

    async def create_bridge(self, kind: str = "mixing") -> str:
        url = f"{ARI_URL}/bridges"
        async with self._session.post(url, params={"type": kind}) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data["id"]

    async def add_to_bridge(self, bridge_id: str, channel_id: str) -> None:
        url = f"{ARI_URL}/bridges/{bridge_id}/addChannel"
        async with self._session.post(url, params={"channel": channel_id}) as resp:
            resp.raise_for_status()

    async def start_external_media(
        self, *, app: str, host: str, port: int, fmt: str = "slin16"
    ) -> str:
        """Tell Asterisk to send/receive RTP to a UDP socket we control."""
        url = f"{ARI_URL}/channels/externalMedia"
        params = {
            "app": app,
            "external_host": f"{host}:{port}",
            "format": fmt,    # slin16 = signed-linear 16-bit PCM @ 16 kHz
            "encapsulation": "rtp",
            "transport": "udp",
            "connection_type": "client",
            "direction": "both",
        }
        async with self._session.post(url, params=params) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data["id"]

    async def hangup(self, channel_id: str) -> None:
        url = f"{ARI_URL}/channels/{channel_id}"
        async with self._session.delete(url) as resp:
            if resp.status not in (200, 204, 404):
                resp.raise_for_status()


class _RtpUdpServer(asyncio.DatagramProtocol):
    """Minimal RTP receiver for the External Media path.

    Asterisk sends slin16 in 20 ms RTP frames (640 bytes payload @ 16 kHz).
    We strip the 12-byte RTP header, hand off the PCM16 payload, and reply
    with our own RTP packets containing model audio.
    """

    def __init__(self, on_pcm16: "asyncio.Queue[bytes]") -> None:
        self.transport: Optional[asyncio.DatagramTransport] = None
        self._on_pcm16 = on_pcm16
        self._peer: Optional[tuple[str, int]] = None
        self._seq = 0
        self._timestamp = 0
        self._ssrc = uuid.uuid4().int & 0xFFFFFFFF

    def connection_made(self, transport: asyncio.BaseTransport) -> None:
        self.transport = transport  # type: ignore[assignment]

    def datagram_received(self, data: bytes, addr: tuple[str, int]) -> None:
        if len(data) < 12:
            return
        self._peer = addr
        # Strip RTP header (12 bytes; assume no extensions/csrc for simplicity)
        payload = data[12:]
        try:
            self._on_pcm16.put_nowait(payload)
        except asyncio.QueueFull:
            pass  # drop if Gemini side is too slow

    def send_pcm16(self, pcm: bytes) -> None:
        if not self.transport or not self._peer:
            return
        # Slice into 20 ms frames (320 samples = 640 bytes)
        FRAME = 640
        for i in range(0, len(pcm), FRAME):
            chunk = pcm[i : i + FRAME]
            if not chunk:
                break
            header = struct.pack(
                ">BBHII",
                0x80,                    # V=2, P=0, X=0, CC=0
                10 & 0x7F,               # marker=0, PT=10 (L16/16000)
                self._seq & 0xFFFF,
                self._timestamp & 0xFFFFFFFF,
                self._ssrc,
            )
            self.transport.sendto(header + chunk, self._peer)
            self._seq += 1
            self._timestamp += len(chunk) // 2  # samples


async def run_sip_call(
    *,
    target_endpoint: str,
    pending,                          # voice_call.PendingCall
    voice_router_dispatch,             # async fn(spec, args, ctx) → result
) -> None:
    """End-to-end: originate SIP call → bridge → ExternalMedia ↔ Gemini.

    Wiring this into the voice router is a v3 task; left as a function so
    the v3 work is "implement run_sip_call called from voice.start_call
    when transport='sip'".
    """
    from .gemini_live import GeminiLiveConfig, GeminiLiveSession, ToolDeclaration  # noqa: F401
    from . import audio_bridge  # noqa: F401

    raise NotImplementedError(
        "v3: wire up Asterisk ARI bridge — see docs/voice/linphone-setup.md"
    )
