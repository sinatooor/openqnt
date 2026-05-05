/**
 * WebSocket transport for Boss mode.
 *
 * Dispatches a /api/boss/run, then opens a WebSocket to /api/boss/ws/{run_id}
 * and forwards events to the message stream.
 *
 * Boss runs spawn a BossSubtreeCard whose payload is just { runId } — the
 * BossRunTree component subscribes to its own WS for the live tree state.
 * We *also* surface high-level events (plan, synthesis, message) as text
 * deltas so the user sees progress in the message bubble too.
 */

import type { Transport, SendOptions } from './types';
import type { UnifiedEvent } from '../types';

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:8000';

const wsBase = (http: string) => http.replace(/^http/i, 'ws');

const authHeaders = (): Record<string, string> => {
  try {
    const auth = JSON.parse(localStorage.getItem('strategyflow-auth') || '{}');
    if (auth?.state?.accessToken) return { Authorization: `Bearer ${auth.state.accessToken}` };
  } catch {/* ignore */}
  return {};
};

export const bossTransport: Transport = {
  mode: 'boss',
  send(opts: SendOptions, onEvent) {
    const controller = new AbortController();
    let ws: WebSocket | null = null;
    let cancelled = false;

    (async () => {
      try {
        onEvent({ kind: 'text_delta', text: 'Dispatching multi-agent run…\n' });

        // Extract symbols from the message if not provided explicitly
        const inferredSymbols =
          opts.symbols && opts.symbols.length > 0
            ? opts.symbols
            : extractTickers(opts.message) || ['SPY'];

        const res = await fetch(`${BACKEND_URL}/api/boss/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            objective: opts.message,
            symbols: inferredSymbols,
            page_context: opts.pageContext ?? undefined,
            system_prompt: opts.skillSystemPrompt ?? undefined,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          onEvent({ kind: 'error', message: `HTTP ${res.status}: ${await res.text()}` });
          onEvent({ kind: 'done' });
          return;
        }

        const body = (await res.json()) as { run_id: string };
        const runId = body.run_id;

        // Card immediately so user sees the live tree
        onEvent({
          kind: 'card',
          cardType: 'boss_subtree',
          cardId: runId,
          payload: { runId },
        });

        if (cancelled) return;

        ws = new WebSocket(`${wsBase(BACKEND_URL)}/api/boss/ws/${runId}`);

        ws.onmessage = (ev) => {
          try {
            const e = JSON.parse(ev.data);
            switch (e.kind) {
              case 'plan':
                if (e.plan?.rationale) {
                  onEvent({ kind: 'text_delta', text: `\n**Plan:** ${e.plan.rationale}\n` });
                }
                break;
              case 'synthesis':
                if (e.synthesis?.summary) {
                  onEvent({ kind: 'text_delta', text: `\n**Synthesis:** ${e.synthesis.summary}\n` });
                }
                break;
              case 'message':
                if (e.text) onEvent({ kind: 'text_delta', text: `\n${e.text}` });
                break;
              case 'error':
                onEvent({ kind: 'error', message: e.text ?? 'Boss error' });
                break;
              case 'end':
                onEvent({ kind: 'done' });
                ws?.close();
                break;
            }
          } catch {/* ignore malformed */}
        };

        ws.onerror = () => {
          onEvent({ kind: 'error', message: 'Boss WebSocket error' });
        };

        ws.onclose = () => {
          onEvent({ kind: 'done' });
        };
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          onEvent({ kind: 'done' });
          return;
        }
        onEvent({ kind: 'error', message: err?.message ?? 'Boss run failed' });
        onEvent({ kind: 'done' });
      }
    })();

    return {
      cancel: () => {
        cancelled = true;
        controller.abort();
        ws?.close();
      },
    };
  },
};

// Extract tickers like SPY, AAPL, BRK.B from a free-text message
function extractTickers(text: string): string[] | null {
  const matches = text.match(/\b[A-Z]{1,5}(?:\.[A-Z])?\b/g);
  if (!matches) return null;
  // Filter out common English words that look like tickers
  const blacklist = new Set([
    'I', 'A', 'AN', 'IS', 'AT', 'OF', 'IT', 'BE', 'WHY',
    'THE', 'AND', 'FOR', 'YOU', 'AI', 'OR', 'ON', 'IN',
    'TO', 'WITH', 'BUT', 'NOT', 'WHAT', 'HOW', 'WHEN',
  ]);
  const filtered = matches.filter((m) => !blacklist.has(m));
  return filtered.length > 0 ? filtered : null;
}
