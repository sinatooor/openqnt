/**
 * Token estimation for the Claude-style context-fill indicator.
 *
 * Uses a simple char/4 heuristic — accurate enough for a UI ring without
 * adding a tokenizer dependency. We can swap in `js-tiktoken` later if needed.
 */

import type { SessionItem, ChatMessage } from '../types';

export const MAX_CONTEXT_TOKENS = 200_000;
export const CONTEXT_WARN_THRESHOLD = 0.9;

export function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateMessageTokens(msg: ChatMessage): number {
  let total = estimateTokens(msg.content);
  if (msg.toolCalls) {
    for (const tc of msg.toolCalls) {
      total += estimateTokens(tc.tool);
      total += estimateTokens(JSON.stringify(tc.args ?? {}));
      if (tc.result) total += estimateTokens(JSON.stringify(tc.result));
    }
  }
  if (msg.cards) {
    for (const c of msg.cards) total += estimateTokens(JSON.stringify(c.payload ?? {}));
  }
  if (msg.strategyNodes) total += estimateTokens(JSON.stringify(msg.strategyNodes));
  if (msg.strategyEdges) total += estimateTokens(JSON.stringify(msg.strategyEdges));
  if (msg.actions) total += estimateTokens(JSON.stringify(msg.actions));
  return total;
}

export function computeSessionTokens(items: SessionItem[]): number {
  let total = 0;
  for (const item of items) {
    if (item.role === 'divider') continue;
    total += estimateMessageTokens(item);
  }
  return total;
}

export function getContextStatus(tokens: number): 'green' | 'amber' | 'red' {
  const ratio = tokens / MAX_CONTEXT_TOKENS;
  if (ratio < 0.6) return 'green';
  if (ratio < CONTEXT_WARN_THRESHOLD) return 'amber';
  return 'red';
}
