/**
 * useChatTransport — the orchestrating hook.
 *
 * Reads the current mode + skill + page context, dispatches to the right
 * transport, and pushes UnifiedEvents into aiChatStore via a single reducer.
 *
 * Strategy mode also drops generated nodes into useStrategyFlowStore on
 * "Add to Canvas" — but that wiring lives in the StrategyNodesCard.
 */

import { useCallback, useRef } from 'react';
import { useStrategyFlowStore } from '@/features/strategy-flow/store/strategyFlowStore';
import { useAiChatStore, ensureActiveSession, getSessionHistoryForApi } from '../state/aiChatStore';
import { usePanelStore } from '../state/panelStore';
import { usePageContextStore } from '../state/pageContextStore';
import { getSkill } from '../skills/registry';
import { getMode } from './modeRegistry';
import type { UnifiedEvent } from '../types';

export function useChatTransport() {
  const cancelRef = useRef<{ cancel: () => void } | null>(null);

  const send = useCallback(async (message: string) => {
    const { mode, skillId } = usePanelStore.getState();
    const pageContext = usePageContextStore.getState().context;
    const skill = getSkill(skillId);

    // Ensure we have an active session
    const sessionId = ensureActiveSession({
      mode,
      skillId,
      pageContextSnapshot: pageContext ?? undefined,
    });

    const store = useAiChatStore.getState();
    const session = store.sessions.find((s) => s.id === sessionId);

    // Insert mode_change / skill_change dividers if the user switched
    // mid-thread. We compare to the most recent message's mode/skill, falling
    // back to the session's primary fields if there are no messages yet.
    const items = store.items[sessionId] ?? [];
    let lastMode = session?.primaryMode ?? mode;
    let lastSkill: typeof skillId = session?.skillId ?? null;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.role === 'divider') continue;
      if (it.mode) lastMode = it.mode;
      if (it.skillId !== undefined) lastSkill = it.skillId;
      break;
    }
    if (items.length > 0 && lastMode !== mode) {
      store.addModeChange(sessionId, lastMode, mode);
    }
    if (items.length > 0 && lastSkill !== skillId) {
      store.addSkillChange(sessionId, lastSkill, skillId);
    }

    // Add user message
    store.addUserMessage(sessionId, message, mode, skillId);

    // Add streaming assistant message
    const assistantId = store.addAssistantMessage(sessionId, mode, skillId);

    // Build history (last 20 messages, text-only)
    const history = getSessionHistoryForApi(sessionId, 20);

    // Strategy/Code need current canvas state
    const flow = useStrategyFlowStore.getState();

    const descriptor = getMode(mode);
    const { cancel } = descriptor.transport.send(
      {
        message,
        history,
        pageContext,
        skillSystemPrompt: skill?.systemPrompt ?? null,
        currentNodes: flow.nodes,
        currentEdges: flow.edges,
        codeLanguage: 'pinescript',
      },
      (event: UnifiedEvent) => handleEvent(sessionId, assistantId, event),
    );

    cancelRef.current = { cancel };
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current?.cancel();
    cancelRef.current = null;
  }, []);

  return { send, cancel };
}

function handleEvent(sessionId: string, assistantId: string, event: UnifiedEvent) {
  const store = useAiChatStore.getState();

  switch (event.kind) {
    case 'text_delta':
      store.appendToMessage(sessionId, assistantId, event.text);
      break;

    case 'tool_call':
      store.addToolCall(sessionId, assistantId, {
        id: `${event.tool}-${Date.now()}`,
        tool: event.tool,
        args: event.args,
        status: 'pending',
      });
      break;

    case 'tool_result':
      store.updateToolCall(sessionId, assistantId, event.tool, {
        status: event.success ? 'done' : 'error',
        result: event.result,
      });
      break;

    case 'card':
      // Special handling for streaming strategy nodes (Ask mode)
      if (event.cardType === 'strategy_node_partial') {
        const p = event.payload as { node: any };
        store.addStrategyNode(sessionId, assistantId, p.node);
        break;
      }
      if (event.cardType === 'strategy_edges_partial') {
        const p = event.payload as { edges: any[] };
        store.setStrategyEdges(sessionId, assistantId, p.edges);
        break;
      }
      // Strategy mode (fetch) emits a complete strategy_nodes card
      if (event.cardType === 'strategy_nodes') {
        const p = event.payload as { nodes: any[]; edges: any[] };
        store.setStrategyData(sessionId, assistantId, p.nodes, p.edges ?? []);
      }
      // Boss mode emits a boss_subtree card
      if (event.cardType === 'boss_subtree') {
        const p = event.payload as { runId: string };
        store.setBossRunId(sessionId, assistantId, p.runId);
      }
      // Generic cards (code_block, plot, table, navigation_action, etc.)
      store.addCard(sessionId, assistantId, {
        id: event.cardId,
        cardType: event.cardType,
        payload: event.payload,
        createdAt: Date.now(),
      });
      // Navigation actions also recorded for AskMode legacy
      if (event.cardType === 'navigation_action') {
        const p = event.payload as { action: string; data: any };
        store.addAction(sessionId, assistantId, { action: p.action, data: p.data });
      }
      break;

    case 'mode_change':
    case 'skill_change':
      // These are inserted directly via panelStore listeners, not via transport
      break;

    case 'done':
      store.finalizeMessage(sessionId, assistantId);
      break;

    case 'error':
      store.appendToMessage(sessionId, assistantId, `\n\n*Error: ${event.message}*`);
      store.finalizeMessage(sessionId, assistantId);
      break;
  }
}
