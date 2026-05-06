# Linphone + Asterisk (v3 SIP power-user path)

This is the optional, last-to-ship transport. Use it when you want a $0/min
"open OpenQnt line" reachable from a SIP softphone (Linphone) on phone or
desktop. Ship `v1` (Twilio), `v2` (browser WebRTC), and `v4` (iOS app) first.

## Topology

```
Linphone client  ───SIP/RTP───▶  Asterisk (Docker, this repo's compose)
                                   │
                            (Stasis app: openqnt-voice)
                                   │
                                   ▼
                  External Media (RTP, slin16, UDP 40000)
                                   │
                                   ▼
       backend/services/voice/ari_bridge.py  ◀──audio──▶  Gemini Live API
```

## One-time setup

1. **Bring up the voice profile in Compose:**
   ```bash
   docker compose -f docker-compose.full.yml --profile voice up -d coturn asterisk
   ```
2. **Edit `infra/asterisk/etc/pjsip.conf`** — set a real password for the
   `openqnt-auth` block before exposing 5060 to the internet.
3. **Edit `infra/asterisk/etc/ari.conf`** — set a real password for the
   `[openqnt]` ARI user.
4. **Set backend env:**
   ```
   ASTERISK_ARI_URL=http://asterisk:8088/ari
   ASTERISK_ARI_USER=openqnt
   ASTERISK_ARI_PASSWORD=<your-password>
   ASTERISK_EXT_MEDIA_HOST=<host-where-backend-runs>
   ASTERISK_EXT_MEDIA_PORT=40000
   ```

## Configure Linphone

- Account → SIP Account
- Username: `openqnt`
- Domain: `<your-asterisk-host>` (e.g. `192.168.1.10` for LAN, or your VPS IP)
- Password: from `pjsip.conf`
- Transport: UDP (or TCP if you need NAT-friendlier behavior)

## Triggering a SIP call from OpenQnt

The voice orchestrator exposes `transport='sip'` once `ari_bridge.run_sip_call`
is implemented. Plumbing exists for everything else; v3 is just filling that
function in. The integration points are:

- `backend/services/voice/ari_bridge.py` — finish `run_sip_call`
- `backend/services/voice/voice_call.py` — add a `transport == 'sip'` branch
  in `initiate_call` that calls `ari_bridge.run_sip_call`
- `backend/routers/voice.py` `/call` endpoint — accept `transport='sip'`
- (Optional) `src/features/strategy-flow/catalog/nodes/actionNodes.ts` —
  surface the SIP option in the phoneCall node `transport` enum

## Why this is v3

- ARI WebSocket + RTP plumbing is real engineering (NAT, packet loss, jitter)
- Saves about $0.013/min vs Twilio — small relative to LLM costs
- Most users don't want to install a SIP softphone
