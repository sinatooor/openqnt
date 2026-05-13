/**
 * SSE transport for Ask mode — wraps api.streamAiChat.
 *
 * Reuses the recovery logic added in commit fd668ae (synthesizes done+error
 * if the stream drops mid-response).
 */

import { api, type AiChatEvent } from '@/services/api';
import type { Transport, SendOptions } from './types';
import type { UnifiedEvent } from '../types';

export const sseTransport: Transport = {
  mode: 'ask',
  send({ message, history, pageContext, skillSystemPrompt }: SendOptions, onEvent) {
    const context: Record<string, any> = {};
    if (pageContext) context.page_context = pageContext;
    if (skillSystemPrompt) context.system_prompt = skillSystemPrompt;

    const { cancel } = api.streamAiChat(
      message,
      history,
      Object.keys(context).length > 0 ? context : undefined,
      (event: AiChatEvent) => onEvent(adaptEvent(event)),
    );
    return { cancel };
  },
};

function adaptEvent(event: AiChatEvent): UnifiedEvent {
  switch (event.type) {
    case 'text_delta':
      return { kind: 'text_delta', text: event.content };
    case 'tool_call':
      return { kind: 'tool_call', tool: event.tool, args: event.args, status: 'pending' };
    case 'tool_result':
      return {
        kind: 'tool_result',
        tool: event.tool,
        result: event.result,
        success: event.result?.success !== false,
      };
    case 'strategy_node':
      return {
        kind: 'card',
        cardType: 'strategy_node_partial',
        cardId: `node-${event.index}`,
        payload: { node: event.node, index: event.index, total: event.total },
      };
    case 'strategy_edges':
      return {
        kind: 'card',
        cardType: 'strategy_edges_partial',
        cardId: 'edges',
        payload: { edges: event.edges },
      };
    case 'action':
      return {
        kind: 'card',
        cardType: 'navigation_action',
        cardId: `act-${Math.random().toString(36).slice(2, 8)}`,
        payload: { action: event.action, data: event.data },
      };
    case 'builder_event':
      // Coalesce all builder_event sub-kinds into one card per message so the
      // UI shows a single live "Builder status" panel that updates in place.
      return {
        kind: 'card',
        cardType: 'builder_status',
        cardId: 'builder',
        payload: event,
      };
    case 'done':
      return { kind: 'done' };
    case 'error':
      return { kind: 'error', message: event.message };
  }
}
