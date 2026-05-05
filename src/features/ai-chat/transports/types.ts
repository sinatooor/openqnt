/**
 * Transport interface — all modes implement this contract.
 *
 * The panel UI knows only UnifiedEvent. Each transport wraps a backend
 * (SSE / fetch / WebSocket) and emits events through the same shape.
 */

import type { ChatMode, PageContext, SkillId, UnifiedEvent } from '../types';

export interface SendOptions {
  message: string;
  history: { role: string; content: string }[];
  pageContext: PageContext | null;
  skillSystemPrompt?: string | null;
  // Strategy/Code mode use these:
  currentNodes?: any[];
  currentEdges?: any[];
  codeLanguage?: 'pinescript' | 'python' | 'mql5' | 'nautilus';
  // Boss mode uses these:
  symbols?: string[];
}

export interface Transport {
  mode: ChatMode;
  send(opts: SendOptions, onEvent: (e: UnifiedEvent) => void): { cancel: () => void };
}
