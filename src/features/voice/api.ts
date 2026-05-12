import { apiBase } from '@/lib/runtimeConfig';
/**
 * Voice subsystem API client — talks to FastAPI `/api/voice/*`.
 *
 * Exposes profile (phone + voice-trading toggle), call initiation, history,
 * and the in-browser WebRTC web-session minting endpoint. Used by the
 * profile modal, the OpenQnt FAB voice button, and the browser voice hook.
 */

const API_BASE =
    apiBase();

export interface VoiceProfile {
    user_id: string;
    phone_number: string | null;
    voice_trading_enabled: boolean;
    ios_devices: number;
}

export interface VoiceCall {
    id: string;
    user_id: string;
    started_at: string;
    ended_at: string | null;
    duration_s: number | null;
    transport: 'twilio' | 'browser_webrtc' | 'ios_webrtc' | 'sip';
    trigger_source: 'node' | 'agent' | 'user' | 'manual';
    twilio_call_sid: string | null;
    transcript_path: string | null;
    cost_cents: number | null;
    error: string | null;
}

export interface StartCallParams {
    user_id: string;
    opening_message: string;
    transport?: 'twilio' | 'browser_webrtc' | 'ios_webrtc';
    trigger_source?: 'node' | 'agent' | 'user' | 'manual';
    allowed_tools?: string[];
    voice?: string;
    user_phone_override?: string;
}

export interface StartCallResult {
    call_id: string;
    transport: string;
    twilio_call_sid?: string;
    web_join_url?: string;
}

export interface WebSessionResult {
    call_id: string;
    ws_url: string;
    input_rate: number;
    output_rate: number;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
        ...init,
    });
    if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail || detail?.message || `voice api ${res.status}`);
    }
    return (await res.json()) as T;
}

/**
 * Fetch a voice profile. The backend returns 404 when no profile row exists
 * yet (e.g. fresh / unauthenticated users like "local-user") — that's
 * expected, not an error. Return `null` so the UI can render an empty
 * "no profile yet — set a phone number" state instead of a toast.
 */
async function getProfileSafe(userId: string): Promise<VoiceProfile | null> {
    const base = apiBase();
    const res = await fetch(`${base}/api/voice/profile/${encodeURIComponent(userId)}`, {
        headers: { 'Content-Type': 'application/json' },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail || detail?.message || `voice api ${res.status}`);
    }
    return (await res.json()) as VoiceProfile;
}

export const voiceApi = {
    getProfile: getProfileSafe,

    updatePhone: (userId: string, phone: string | null) =>
        req<{ ok: boolean; phone_number: string | null }>(`/api/voice/profile/phone`, {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, phone_number: phone }),
        }),

    setVoiceTradingEnabled: (userId: string, enabled: boolean) =>
        req<{ ok: boolean; voice_trading_enabled: boolean }>(`/api/voice/profile/voice-trading`, {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, enabled }),
        }),

    startCall: (params: StartCallParams) =>
        req<StartCallResult>(`/api/voice/call`, {
            method: 'POST',
            body: JSON.stringify(params),
        }),

    listCalls: (userId: string, limit = 50) =>
        req<{ calls: VoiceCall[] }>(
            `/api/voice/calls?user_id=${encodeURIComponent(userId)}&limit=${limit}`,
        ),

    mintWebSession: (userId: string, openingMessage: string) =>
        req<WebSessionResult>(`/api/voice/web-session`, {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, opening_message: openingMessage }),
        }),

    pairIosInit: (userId: string) =>
        req<{ pairing_token: string; expires_at: string }>(`/api/voice/devices/ios/pair-init`, {
            method: 'POST',
            body: JSON.stringify({ user_id: userId }),
        }),
};

/** Convert ws_url path → fully-qualified ws://... URL using the backend base. */
export function resolveWsUrl(path: string): string {
    const wsBase = API_BASE.replace(/^http/, 'ws');
    return `${wsBase}${path}`;
}
