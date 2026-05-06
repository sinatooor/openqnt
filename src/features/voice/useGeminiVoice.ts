/**
 * useGeminiVoice — in-browser realtime voice with the OpenQnt AI.
 *
 * For v2 we use a server-bridged path (browser ↔ FastAPI WS ↔ Gemini Live)
 * rather than browser↔Gemini directly. This means:
 *   • we never expose GEMINI_API_KEY to the client
 *   • all transports share the same `services/voice` bridge code on the
 *     backend (one tool dispatcher, one transcript pipeline, one audit log)
 *   • cost is identical — the audio still hits Gemini, just via our box
 *
 * The hook captures mic with AudioWorklet → PCM16 16 kHz, ships it as
 * binary WebSocket frames, receives PCM16 24 kHz frames back and plays
 * them through an AudioBufferSourceNode queue.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveWsUrl, voiceApi } from './api';

export type VoiceCallStatus =
    | 'idle'
    | 'requesting_mic'
    | 'connecting'
    | 'live'
    | 'closing'
    | 'closed'
    | 'error';

export interface UseGeminiVoiceArgs {
    userId: string | null;
    /** Spoken on call open — also drives the AI's first sentence. */
    openingMessage?: string;
}

export interface UseGeminiVoice {
    status: VoiceCallStatus;
    error: string | null;
    callId: string | null;
    speakingLevel: number;     // 0-1, smoothed mic input level
    isSpeaking: boolean;       // AI is currently emitting audio
    start: () => Promise<void>;
    stop: () => Promise<void>;
    mute: (m: boolean) => void;
    muted: boolean;
}

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;

/* ───────────────────── Mic AudioWorklet (PCM16 framer) ───────────────────── */
const WORKLET_SRC = `
class PCMFramer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = 320;          // 20 ms @ 16 kHz after downsampling
    this.buffer = new Float32Array(0);
    this.inRate = sampleRate;       // host hardware rate
    this.outRate = ${INPUT_RATE};
    this._ratio = this.inRate / this.outRate;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    // Append to buffer
    const merged = new Float32Array(this.buffer.length + input.length);
    merged.set(this.buffer, 0);
    merged.set(input, this.buffer.length);
    // Naive linear-rate downsampler
    const outLen = Math.floor(merged.length / this._ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const src = i * this._ratio;
      const lo = Math.floor(src);
      const hi = Math.min(lo + 1, merged.length - 1);
      const f = src - lo;
      out[i] = merged[lo] * (1 - f) + merged[hi] * f;
    }
    // Stash leftover samples for the next call
    const consumed = Math.floor(outLen * this._ratio);
    this.buffer = merged.slice(consumed);
    // Convert to Int16 PCM and ship in 20 ms chunks
    let off = 0;
    while (off + this.frameSize <= out.length) {
      const slice = out.subarray(off, off + this.frameSize);
      const pcm = new Int16Array(slice.length);
      let level = 0;
      for (let i = 0; i < slice.length; i++) {
        const s = Math.max(-1, Math.min(1, slice[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        level += Math.abs(s);
      }
      level /= slice.length;
      this.port.postMessage({ pcm: pcm.buffer, level }, [pcm.buffer]);
      off += this.frameSize;
    }
    return true;
  }
}
registerProcessor('pcm-framer', PCMFramer);
`;

export function useGeminiVoice({ userId, openingMessage = 'Quick check-in.' }: UseGeminiVoiceArgs): UseGeminiVoice {
    const [status, setStatus] = useState<VoiceCallStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [callId, setCallId] = useState<string | null>(null);
    const [speakingLevel, setSpeakingLevel] = useState(0);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [muted, setMutedState] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const playheadRef = useRef<number>(0);    // scheduling cursor for output
    const speakingTimerRef = useRef<number | null>(null);
    const mutedRef = useRef(false);

    const cleanup = useCallback(() => {
        if (speakingTimerRef.current) {
            window.clearTimeout(speakingTimerRef.current);
            speakingTimerRef.current = null;
        }
        try { workletNodeRef.current?.disconnect(); } catch { /* noop */ }
        workletNodeRef.current = null;
        try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
        streamRef.current = null;
        try { wsRef.current?.close(); } catch { /* noop */ }
        wsRef.current = null;
        try { ctxRef.current?.close(); } catch { /* noop */ }
        ctxRef.current = null;
        playheadRef.current = 0;
        setSpeakingLevel(0);
        setIsSpeaking(false);
    }, []);

    useEffect(() => () => cleanup(), [cleanup]);

    const playPcm24k = useCallback((pcm: ArrayBuffer) => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        const view = new Int16Array(pcm);
        if (view.length === 0) return;
        const buf = ctx.createBuffer(1, view.length, OUTPUT_RATE);
        const channel = buf.getChannelData(0);
        for (let i = 0; i < view.length; i++) channel[i] = view[i] / 0x8000;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        const now = ctx.currentTime;
        const startAt = Math.max(now, playheadRef.current);
        src.start(startAt);
        playheadRef.current = startAt + buf.duration;
        setIsSpeaking(true);
        if (speakingTimerRef.current) window.clearTimeout(speakingTimerRef.current);
        speakingTimerRef.current = window.setTimeout(
            () => setIsSpeaking(false),
            (buf.duration + 0.1) * 1000,
        );
    }, []);

    const start = useCallback(async () => {
        if (!userId) {
            setError('Not signed in');
            setStatus('error');
            return;
        }
        if (status === 'live' || status === 'connecting') return;
        setError(null);
        setStatus('requesting_mic');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
            });
            streamRef.current = stream;

            const ctx = new AudioContext();
            ctxRef.current = ctx;
            const blob = new Blob([WORKLET_SRC], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            try {
                await ctx.audioWorklet.addModule(url);
            } finally {
                URL.revokeObjectURL(url);
            }

            setStatus('connecting');
            const session = await voiceApi.mintWebSession(userId, openingMessage);
            setCallId(session.call_id);

            const ws = new WebSocket(resolveWsUrl(session.ws_url));
            ws.binaryType = 'arraybuffer';
            wsRef.current = ws;

            await new Promise<void>((resolve, reject) => {
                ws.addEventListener('open', () => resolve(), { once: true });
                ws.addEventListener('error', (e) => reject(e), { once: true });
            });

            ws.addEventListener('message', (ev) => {
                if (ev.data instanceof ArrayBuffer) {
                    playPcm24k(ev.data);
                }
            });
            ws.addEventListener('close', () => {
                setStatus('closed');
                cleanup();
            });

            const source = ctx.createMediaStreamSource(stream);
            const node = new AudioWorkletNode(ctx, 'pcm-framer');
            workletNodeRef.current = node;
            node.port.onmessage = (ev: MessageEvent) => {
                const { pcm, level } = ev.data as { pcm: ArrayBuffer; level: number };
                setSpeakingLevel(level);
                if (mutedRef.current) return;
                if (ws.readyState === WebSocket.OPEN) ws.send(pcm);
            };
            source.connect(node);
            // Don't connect node→destination to avoid mic loopback
            setStatus('live');
        } catch (e: any) {
            setError(e?.message || String(e));
            setStatus('error');
            cleanup();
        }
    }, [userId, openingMessage, status, playPcm24k, cleanup]);

    const stop = useCallback(async () => {
        setStatus('closing');
        cleanup();
        setStatus('closed');
    }, [cleanup]);

    const mute = useCallback((m: boolean) => {
        mutedRef.current = m;
        setMutedState(m);
    }, []);

    return { status, error, callId, speakingLevel, isSpeaking, start, stop, mute, muted };
}
