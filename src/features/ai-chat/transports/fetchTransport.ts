/**
 * Fetch transport for Strategy + Code modes.
 *
 * Wraps /api/strategy-flow/{generate,chat} which today are non-streaming.
 * Synthesizes UnifiedEvents around the fetch:
 *   - emits status text_delta during the wait
 *   - emits a single `card` event with the result
 *   - emits done
 *
 * When backend SSE lands (follow-up ticket), this driver gets replaced with
 * one that consumes real events.
 */

import type { Transport, SendOptions } from './types';
import type { UnifiedEvent } from '../types';

import { apiBase } from '@/lib/runtimeConfig';
const BACKEND_URL =
  apiBase() || 'http://localhost:8000';

const authHeaders = (): Record<string, string> => {
  try {
    const auth = JSON.parse(localStorage.getItem('strategyflow-auth') || '{}');
    if (auth?.state?.accessToken) return { Authorization: `Bearer ${auth.state.accessToken}` };
  } catch {/* ignore */}
  return {};
};

// ── Strategy mode ─────────────────────────────────────────────

export const strategyTransport: Transport = {
  mode: 'strategy',
  send(opts, onEvent) {
    const controller = new AbortController();

    (async () => {
      try {
        onEvent({ kind: 'text_delta', text: 'Generating strategy nodes…\n' });

        const response = await fetch(`${BACKEND_URL}/api/strategy-flow/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            message: opts.message,
            currentNodes: opts.currentNodes && opts.currentNodes.length > 0 ? opts.currentNodes : null,
            currentEdges: opts.currentEdges && opts.currentEdges.length > 0 ? opts.currentEdges : null,
            mode: 'tool-calling',
            page_context: opts.pageContext ?? undefined,
            system_prompt: opts.skillSystemPrompt ?? undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          onEvent({ kind: 'error', message: `HTTP ${response.status}` });
          onEvent({ kind: 'done' });
          return;
        }

        const data = await response.json();

        if (data.success && data.nodes?.length > 0) {
          onEvent({
            kind: 'card',
            cardType: 'strategy_nodes',
            cardId: `strategy-${Date.now()}`,
            payload: {
              nodes: data.nodes,
              edges: data.edges ?? [],
              message: data.message ?? `Generated ${data.nodes.length} nodes.`,
              wasRationalized: data.wasRationalized,
              autoFixed: data.autoFixed,
            },
          });
          if (data.message) {
            onEvent({ kind: 'text_delta', text: `\n${data.message}` });
          }
        } else {
          const errMsg = data.errors?.join?.(', ') || 'Could not generate strategy';
          onEvent({ kind: 'text_delta', text: `\nI couldn't generate that strategy. ${errMsg}` });
        }

        onEvent({ kind: 'done' });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          onEvent({ kind: 'done' });
          return;
        }
        onEvent({ kind: 'error', message: err?.message ?? 'Strategy generation failed' });
        onEvent({ kind: 'done' });
      }
    })();

    return { cancel: () => controller.abort() };
  },
};

// ── Code mode ─────────────────────────────────────────────────

export const codeTransport: Transport = {
  mode: 'code',
  send(opts, onEvent) {
    const controller = new AbortController();
    const lang = opts.codeLanguage ?? 'pinescript';
    const langLabel =
      lang === 'pinescript' ? 'Pine Script v5' : lang.toUpperCase();

    (async () => {
      try {
        onEvent({ kind: 'text_delta', text: `Generating ${langLabel} code…\n` });

        const response = await fetch(`${BACKEND_URL}/api/strategy-flow/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            message: `Generate ${langLabel} code for: ${opts.message}`,
            currentNodes: opts.currentNodes ?? [],
            currentEdges: opts.currentEdges ?? [],
            codeMode: true,
            targetLanguage: lang,
            page_context: opts.pageContext ?? undefined,
            system_prompt: opts.skillSystemPrompt ?? undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          onEvent({ kind: 'error', message: `HTTP ${response.status}` });
          onEvent({ kind: 'done' });
          return;
        }

        const data = await response.json();
        const responseText: string = data.response ?? '';

        const codeBlockMatch = responseText.match(/```(?:\w+)?\n([\s\S]*?)```/);
        const extractedCode = codeBlockMatch ? codeBlockMatch[1].trim() : null;

        // Strip the code block from prose, render it as a card
        const prose = codeBlockMatch
          ? responseText.replace(codeBlockMatch[0], '').trim()
          : responseText;

        if (prose) onEvent({ kind: 'text_delta', text: `\n${prose}` });

        if (extractedCode) {
          onEvent({
            kind: 'card',
            cardType: 'code_block',
            cardId: `code-${Date.now()}`,
            payload: { language: lang, code: extractedCode },
          });
        }

        onEvent({ kind: 'done' });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          onEvent({ kind: 'done' });
          return;
        }
        onEvent({ kind: 'error', message: err?.message ?? 'Code generation failed' });
        onEvent({ kind: 'done' });
      }
    })();

    return { cancel: () => controller.abort() };
  },
};
