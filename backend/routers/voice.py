"""Voice router — REST endpoints + WS bridges for AI realtime calls.

Endpoints:
  POST /api/voice/call               start an AI-initiated call (any transport)
  POST /api/voice/twiml              TwiML returned to Twilio when user answers
  WS   /api/voice/twilio-stream      Twilio Media Stream → Gemini bridge
  POST /api/voice/status             Twilio status callback (call lifecycle)

  POST /api/voice/web-session        mint config for in-browser WebRTC session
  WS   /api/voice/browser-stream     fallback WS audio bridge for browser path

  POST /api/voice/devices/ios/pair-init   start QR pairing (in-app)
  POST /api/voice/devices/ios/pair-claim  consume pairing token from iOS app
  POST /api/voice/devices/ios/register    save VoIP push token from iOS app
  WS   /api/voice/ios-signal              WebRTC signaling for iOS clients
  WS   /api/voice/ios-stream              audio bridge for iOS WebRTC

  GET  /api/voice/calls              list user's call history
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse, Response
from pydantic import BaseModel, Field

from services import voice_db
from services.voice import (
    audio_bridge,
    voice_call as voice_orch,
)
from services.voice.gemini_live import (
    GEMINI_INPUT_RATE,
    GEMINI_OUTPUT_RATE,
    GeminiLiveConfig,
    GeminiLiveSession,
    ToolDeclaration,
)
from services.voice.tool_dispatch import (
    DispatchContext,
    note_user_text,
    build_default_registry,
    clear_pending_confirmations,
    dispatch,
    note_user_text_for_confirmation,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])

# Build the tool registry once at module load — voice calls reuse it.
_REGISTRY = build_default_registry()


# ─────────────────────────────────────────────────────────────────────────
# Request models
# ─────────────────────────────────────────────────────────────────────────

class StartCallRequest(BaseModel):
    user_id: str
    opening_message: str = Field(..., description="What the AI should open the call with")
    transport: str = Field("twilio", description="twilio | browser_webrtc | ios_webrtc")
    trigger_source: str = Field("manual", description="node | agent | user | manual")
    allowed_tools: Optional[List[str]] = None
    voice: str = "Aoede"
    user_phone_override: Optional[str] = None  # only honored if profile lacks one


class StartCallResponse(BaseModel):
    call_id: str
    transport: str
    twilio_call_sid: Optional[str] = None
    web_join_url: Optional[str] = None


class IosPairInitRequest(BaseModel):
    user_id: str


class IosPairClaimRequest(BaseModel):
    pairing_token: str
    voip_push_token: str
    apns_environment: str = "production"


class IosRegisterRequest(BaseModel):
    user_id: str
    voip_push_token: str
    apns_environment: str = "production"


# ─────────────────────────────────────────────────────────────────────────
# REST: start a call
# ─────────────────────────────────────────────────────────────────────────

@router.post("/call", response_model=StartCallResponse)
async def start_call(req: StartCallRequest):
    profile = voice_db.get_user_voice_profile(req.user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="user not found")
    user_phone = req.user_phone_override or profile.get("phone_number")

    if req.transport == "twilio" and not user_phone:
        raise HTTPException(
            status_code=400,
            detail="user has no phone_number on file; set one in Profile or pass user_phone_override",
        )

    try:
        result = voice_orch.initiate_call(
            user_id=req.user_id,
            user_name=profile.get("name") or profile.get("email") or "trader",
            user_phone=user_phone,
            voice_trading_enabled=bool(profile.get("voice_trading_enabled")),
            opening_message=req.opening_message,
            transport=req.transport,  # type: ignore[arg-type]
            trigger_source=req.trigger_source,  # type: ignore[arg-type]
            allowed_tools=req.allowed_tools,
            voice=req.voice,
        )
    except Exception as e:
        logger.exception("initiate_call failed")
        raise HTTPException(status_code=500, detail=str(e))

    if req.transport == "browser_webrtc":
        # frontend will join via /web-session lookup, then open WS
        result["web_join_url"] = f"/api/voice/browser-stream?call_id={result['call_id']}"

    return StartCallResponse(**result)


# ─────────────────────────────────────────────────────────────────────────
# Twilio TwiML — instructs Twilio to open a Media Stream to our WS endpoint
# ─────────────────────────────────────────────────────────────────────────

@router.post("/twiml")
async def twiml_response(request: Request):
    call_id = request.query_params.get("call_id")
    if not call_id:
        return PlainTextResponse(
            "<?xml version='1.0' encoding='UTF-8'?><Response><Say>Missing call id.</Say></Response>",
            media_type="application/xml",
            status_code=400,
        )
    public_url = os.getenv("PUBLIC_BACKEND_URL", "").rstrip("/")
    # Twilio requires wss://; convert https→wss / http→ws
    ws_base = public_url.replace("https://", "wss://").replace("http://", "ws://")
    stream_url = f"{ws_base}/api/voice/twilio-stream"
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="{stream_url}">
      <Parameter name="call_id" value="{call_id}" />
    </Stream>
  </Connect>
</Response>"""
    return Response(content=twiml, media_type="application/xml")


@router.post("/status")
async def twilio_status_callback(request: Request):
    form = await request.form()
    sid = form.get("CallSid")
    status = form.get("CallStatus")
    duration = form.get("CallDuration")
    logger.info("Twilio status: sid=%s status=%s duration=%s", sid, status, duration)
    if status == "completed" and sid:
        # Best-effort: try to find the matching voice_calls row
        try:
            import sqlite3
            import local_database
            conn = sqlite3.connect(local_database.DB_NAME)
            row = conn.execute(
                "SELECT id FROM voice_calls WHERE twilio_call_sid = ?", (sid,)
            ).fetchone()
            if row:
                voice_orch.finalize_call(
                    call_id=row[0],
                    duration_s=float(duration) if duration else None,
                )
            conn.close()
        except Exception:
            logger.exception("status callback: failed to finalize")
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────
# Twilio Media Stream WebSocket — the heart of the v1 path
# ─────────────────────────────────────────────────────────────────────────

@router.websocket("/twilio-stream")
async def twilio_media_stream(ws: WebSocket):
    await ws.accept()
    call_id: Optional[str] = None
    stream_sid: Optional[str] = None
    bridge_task: Optional[asyncio.Task] = None
    try:
        # The first messages from Twilio: connected → start
        async for raw in ws.iter_text():
            msg = json.loads(raw)
            event = msg.get("event")
            if event == "connected":
                continue
            if event == "start":
                stream_sid = msg["start"]["streamSid"]
                params = msg["start"].get("customParameters") or {}
                call_id = params.get("call_id")
                if not call_id:
                    logger.warning("twilio-stream: no call_id in customParameters")
                    await ws.close(code=4400)
                    return
                pending = voice_orch.claim_pending_call(call_id)
                if not pending:
                    logger.warning("twilio-stream: unknown call_id %s", call_id)
                    await ws.close(code=4404)
                    return
                bridge_task = asyncio.create_task(
                    _run_bridge(ws, pending, stream_sid, twilio=True)
                )
                # The remaining frames (media/stop) are read by _run_bridge directly
                # via the same ws — we hand off control here.
                await bridge_task
                return
    except WebSocketDisconnect:
        logger.info("twilio-stream: client disconnected (call_id=%s)", call_id)
    except Exception:
        logger.exception("twilio-stream: error")
    finally:
        if bridge_task and not bridge_task.done():
            bridge_task.cancel()


# ─────────────────────────────────────────────────────────────────────────
# Browser-side audio bridge (fallback for browsers that prefer WS over WebRTC)
# ─────────────────────────────────────────────────────────────────────────

@router.websocket("/browser-stream")
async def browser_stream(ws: WebSocket):
    await ws.accept()
    call_id = ws.query_params.get("call_id")
    if not call_id:
        await ws.close(code=4400)
        return
    pending = voice_orch.claim_pending_call(call_id)
    if not pending:
        await ws.close(code=4404)
        return
    try:
        await _run_bridge(ws, pending, stream_sid=None, twilio=False)
    except WebSocketDisconnect:
        pass


# ─────────────────────────────────────────────────────────────────────────
# Browser WebRTC session config (for client → Gemini direct WebRTC)
# ─────────────────────────────────────────────────────────────────────────

class WebSessionRequest(BaseModel):
    user_id: str
    opening_message: str = "Quick check-in."


@router.post("/web-session")
async def mint_web_session(req: WebSessionRequest):
    """Returns a non-secret config the browser uses to start a call.

    Note: we don't expose the GEMINI_API_KEY to the browser. Instead, we
    initiate a server-managed bridge: the browser opens a WS to
    /browser-stream, and our backend talks to Gemini.
    """
    profile = voice_db.get_user_voice_profile(req.user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="user not found")
    res = voice_orch.initiate_call(
        user_id=req.user_id,
        user_name=profile.get("name") or "trader",
        user_phone=None,
        voice_trading_enabled=bool(profile.get("voice_trading_enabled")),
        opening_message=req.opening_message,
        transport="browser_webrtc",
        trigger_source="user",
    )
    return {
        "call_id": res["call_id"],
        "ws_url": f"/api/voice/browser-stream?call_id={res['call_id']}",
        "input_rate": GEMINI_INPUT_RATE,
        "output_rate": GEMINI_OUTPUT_RATE,
    }


# ─────────────────────────────────────────────────────────────────────────
# iOS pairing + signaling
# ─────────────────────────────────────────────────────────────────────────

@router.post("/devices/ios/pair-init")
async def ios_pair_init(req: IosPairInitRequest):
    token = uuid.uuid4().hex
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    voice_db.create_pairing_token(token, req.user_id, expires)
    return {"pairing_token": token, "expires_at": expires}


@router.post("/devices/ios/pair-claim")
async def ios_pair_claim(req: IosPairClaimRequest):
    rec = voice_db.consume_pairing_token(req.pairing_token)
    if not rec:
        raise HTTPException(status_code=400, detail="invalid or already-consumed token")
    if datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="pairing token expired")
    voice_db.upsert_ios_device(
        voip_push_token=req.voip_push_token,
        user_id=rec["user_id"],
        apns_environment=req.apns_environment,
    )
    return {"ok": True, "user_id": rec["user_id"]}


@router.post("/devices/ios/register")
async def ios_register(req: IosRegisterRequest):
    voice_db.upsert_ios_device(
        voip_push_token=req.voip_push_token,
        user_id=req.user_id,
        apns_environment=req.apns_environment,
    )
    return {"ok": True}


@router.websocket("/ios-stream")
async def ios_stream(ws: WebSocket):
    """iOS app connects here after answering the CallKit ring.
    Frames are PCM16 little-endian @ 16 kHz mono, chunked as binary frames.
    Outbound from us: PCM16 @ 24 kHz binary frames (the iOS client downsamples).
    """
    await ws.accept()
    call_id = ws.query_params.get("call_id")
    if not call_id:
        await ws.close(code=4400)
        return
    pending = voice_orch.claim_pending_call(call_id)
    if not pending:
        await ws.close(code=4404)
        return
    try:
        await _run_bridge(ws, pending, stream_sid=None, twilio=False, ios=True)
    except WebSocketDisconnect:
        pass


# ─────────────────────────────────────────────────────────────────────────
# History
# ─────────────────────────────────────────────────────────────────────────

@router.get("/calls")
async def list_calls(user_id: str, limit: int = 50):
    return {"calls": voice_db.list_voice_calls(user_id, limit=limit)}


# ─────────────────────────────────────────────────────────────────────────
# Profile — phone number + voice trading toggle (read/write)
# ─────────────────────────────────────────────────────────────────────────

class VoiceProfileResponse(BaseModel):
    user_id: str
    phone_number: Optional[str] = None
    voice_trading_enabled: bool = False
    ios_devices: int = 0


class UpdatePhoneRequest(BaseModel):
    user_id: str
    phone_number: Optional[str] = None  # E.164, or None to clear


class UpdateVoiceTradingRequest(BaseModel):
    user_id: str
    enabled: bool


class UpdateVoicePassphraseRequest(BaseModel):
    user_id: str
    passphrase: Optional[str] = None  # None or "" clears the gate


@router.get("/profile/{user_id}", response_model=VoiceProfileResponse)
async def get_voice_profile(user_id: str):
    profile = voice_db.get_user_voice_profile(user_id)
    if not profile:
        return VoiceProfileResponse(
            user_id=user_id,
            phone_number=None,
            voice_trading_enabled=False,
            ios_devices=0,
        )
    devices = voice_db.list_ios_devices(user_id)
    return VoiceProfileResponse(
        user_id=user_id,
        phone_number=profile.get("phone_number"),
        voice_trading_enabled=bool(profile.get("voice_trading_enabled")),
        ios_devices=len(devices),
    )


@router.post("/profile/phone")
async def update_phone(req: UpdatePhoneRequest):
    if req.phone_number:
        try:
            import phonenumbers  # type: ignore
            parsed = phonenumbers.parse(req.phone_number, None)
            if not phonenumbers.is_valid_number(parsed):
                raise HTTPException(status_code=400, detail="invalid phone number")
            normalized = phonenumbers.format_number(
                parsed, phonenumbers.PhoneNumberFormat.E164
            )
        except HTTPException:
            raise
        except Exception:
            # If phonenumbers isn't installed, accept as-is (frontend validates)
            normalized = req.phone_number
    else:
        normalized = None
    voice_db.update_user_phone(req.user_id, normalized)
    return {"ok": True, "phone_number": normalized}


@router.post("/profile/voice-trading")
async def update_voice_trading(req: UpdateVoiceTradingRequest):
    voice_db.set_voice_trading_enabled(req.user_id, req.enabled)
    return {"ok": True, "voice_trading_enabled": req.enabled}


@router.post("/profile/voice-passphrase")
async def update_voice_passphrase(req: UpdateVoicePassphraseRequest):
    """Set or clear the user's voice passphrase. Gates `risk='confirm'`
    tools during a call when set; empty/null disables the gate (back-compat)."""
    voice_db.set_voice_passphrase(req.user_id, req.passphrase)
    has = bool((req.passphrase or "").strip())
    return {"ok": True, "voice_passphrase_set": has}


# ─────────────────────────────────────────────────────────────────────────
# Bridge implementation — shared across transports
# ─────────────────────────────────────────────────────────────────────────

async def _run_bridge(
    ws: WebSocket,
    pending: voice_orch.PendingCall,
    stream_sid: Optional[str],
    twilio: bool,
    ios: bool = False,
) -> None:
    """Bidirectional pump: transport WS ↔ GeminiLiveSession.

    Twilio path: input is base64 μ-law 8 kHz; output is base64 μ-law 8 kHz.
    Browser/iOS path: input/output are raw PCM16 binary frames (the client
    handles its own resampling).
    """
    # Filter the registry down to allowed tools for this call. When the
    # caller didn't restrict tools (`allowed_tools` empty/None), default to
    # the full registry — that's what enables "ask anything in chat-style
    # during a call". Trade-mutating tools are still gated by the
    # passphrase + verbal-confirm flow in `tool_dispatch.dispatch()`.
    if pending.allowed_tools:
        allowed = set(pending.allowed_tools)
        declarations: List[ToolDeclaration] = [
            ToolDeclaration(name=spec.name, description=spec.description, parameters=spec.parameters)
            for spec in _REGISTRY.declarations()
            if spec.name in allowed
        ]
    else:
        declarations = [
            ToolDeclaration(name=spec.name, description=spec.description, parameters=spec.parameters)
            for spec in _REGISTRY.declarations()
        ]

    cfg = GeminiLiveConfig(
        system_instruction=pending.system_instruction,
        voice=pending.voice,
        tools=declarations,
    )

    profile = voice_db.get_user_voice_profile(pending.user_id) or {}
    dctx = DispatchContext(
        user_id=pending.user_id,
        call_id=pending.call_id,
        voice_trading_enabled=bool(profile.get("voice_trading_enabled")),
        voice_passphrase=profile.get("voice_passphrase") or None,
    )

    voice_orch.write_transcript_event(pending.call_id, {"type": "session_open", "transport": pending.transport})
    started = time.time()
    error: Optional[str] = None

    try:
        async with GeminiLiveSession(cfg) as session:
            # Send the opening message as a "user" turn so the model speaks first.
            await session.send_text(
                f"(System trigger — open the call now with: \"{pending.opening_message}\")"
            )

            inbound_state_key = (id(session), 0, GEMINI_INPUT_RATE)  # for ratecv state
            outbound_state_key = (id(session), 1, 8000)

            async def pump_inbound():
                """Transport → Gemini."""
                try:
                    if twilio:
                        async for raw in ws.iter_text():
                            msg = json.loads(raw)
                            ev = msg.get("event")
                            if ev == "media":
                                payload_b64 = msg["media"]["payload"]
                                ulaw = base64.b64decode(payload_b64)
                                pcm8k = audio_bridge.ulaw_to_pcm16(ulaw)
                                pcm16k = audio_bridge.resample_pcm16(
                                    pcm8k, 8000, GEMINI_INPUT_RATE,
                                    state_key=inbound_state_key,
                                )
                                await session.send_audio_chunk(pcm16k)
                            elif ev == "mark":
                                continue
                            elif ev == "stop":
                                return
                    else:
                        # Binary PCM16 frames
                        while True:
                            frame = await ws.receive_bytes()
                            if not frame:
                                continue
                            await session.send_audio_chunk(frame)
                except WebSocketDisconnect:
                    pass
                except Exception:
                    logger.exception("pump_inbound crashed")

            async def pump_outbound():
                """Gemini → Transport. Also dispatches tool calls."""
                try:
                    async for ev in session.events():
                        et = ev["type"]
                        if et == "audio":
                            pcm24k = ev["pcm24k"]
                            if twilio:
                                # 24k PCM → 8k → μ-law → base64
                                pcm8k = audio_bridge.resample_pcm16(
                                    pcm24k, GEMINI_OUTPUT_RATE, 8000,
                                    state_key=outbound_state_key,
                                )
                                ulaw = audio_bridge.pcm16_to_ulaw(pcm8k)
                                await ws.send_text(json.dumps({
                                    "event": "media",
                                    "streamSid": stream_sid,
                                    "media": {"payload": base64.b64encode(ulaw).decode()},
                                }))
                            else:
                                await ws.send_bytes(pcm24k)

                        elif et == "transcript":
                            voice_orch.write_transcript_event(pending.call_id, ev)
                            if ev["role"] == "user":
                                cleared = note_user_text(ev.get("text", ""), dctx)
                                if cleared == "passphrase_satisfied":
                                    voice_orch.write_transcript_event(
                                        pending.call_id,
                                        {"type": "passphrase_satisfied"},
                                    )
                                elif cleared == "confirmation_satisfied":
                                    voice_orch.write_transcript_event(
                                        pending.call_id,
                                        {"type": "confirmation_received"},
                                    )

                        elif et == "interrupt":
                            voice_orch.write_transcript_event(pending.call_id, ev)
                            if twilio and stream_sid:
                                # Tell Twilio to drop queued audio (barge-in)
                                await ws.send_text(json.dumps({
                                    "event": "clear", "streamSid": stream_sid,
                                }))
                            else:
                                # Browser/iOS clients can interpret an empty frame as flush
                                pass

                        elif et == "tool_call":
                            voice_orch.write_transcript_event(pending.call_id, ev)
                            spec = _REGISTRY.get(ev["name"])
                            if spec is None or spec.name not in allowed:
                                await session.send_tool_response(
                                    ev["id"], ev["name"],
                                    {"error": f"tool '{ev['name']}' not authorized for voice"},
                                )
                                continue
                            result = await dispatch(spec, ev.get("args", {}), dctx)
                            voice_orch.write_transcript_event(
                                pending.call_id,
                                {"type": "tool_result", "name": ev["name"], "id": ev["id"], "result": result},
                            )
                            await session.send_tool_response(ev["id"], ev["name"], result)

                        elif et == "turn_complete":
                            voice_orch.write_transcript_event(pending.call_id, ev)

                        elif et == "error":
                            voice_orch.write_transcript_event(pending.call_id, ev)
                            return
                except WebSocketDisconnect:
                    pass
                except Exception:
                    logger.exception("pump_outbound crashed")

            inbound = asyncio.create_task(pump_inbound())
            outbound = asyncio.create_task(pump_outbound())
            done, pending_tasks = await asyncio.wait(
                {inbound, outbound}, return_when=asyncio.FIRST_COMPLETED,
            )
            for t in pending_tasks:
                t.cancel()
    except Exception as e:
        error = str(e)
        logger.exception("bridge failed")
    finally:
        clear_pending_confirmations(dctx)
        duration = time.time() - started
        voice_orch.write_transcript_event(
            pending.call_id,
            {"type": "session_close", "duration_s": duration, "error": error,
             "audit": dctx.audit_log[-20:]},
        )
        voice_orch.finalize_call(pending.call_id, duration_s=duration, error=error)
        try:
            await ws.close()
        except Exception:
            pass
