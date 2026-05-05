/**
 * aiChatStore — the unified conversation store.
 *
 * - One store contains all sessions across all modes (Ask/Strategy/Code/Boss)
 * - Each session carries a primary mode + skill, but messages within can mix
 *   modes via mode_change/skill_change divider items
 * - Heavy state (strategy node positions, boss tree state) lives in the
 *   mode-native stores; this store only keeps the conversation envelope
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ChatMessage,
  ChatMode,
  DividerMessage,
  PageContext,
  Session,
  SessionItem,
  SkillId,
  StoredAction,
  StoredCard,
  StoredToolCall,
} from '../types';
import { computeSessionTokens } from './contextWindow';

const genId = (): string =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

interface AiChatState {
  sessions: Session[];
  activeSessionId: string | null;
  // sessionId → ordered list of messages + dividers
  items: Record<string, SessionItem[]>;
  // Per-session streaming state
  streamingMessageId: Record<string, string | null>;

  // ── Session lifecycle ───────────────────────────────────────
  createSession: (opts: {
    mode: ChatMode;
    skillId?: SkillId | null;
    title?: string;
    pageContextSnapshot?: PageContext;
  }) => string;
  setActiveSession: (id: string | null) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  clearAll: () => void;

  // ── Message operations ──────────────────────────────────────
  addUserMessage: (sessionId: string, content: string, mode: ChatMode, skillId: SkillId | null) => string;
  addAssistantMessage: (sessionId: string, mode: ChatMode, skillId: SkillId | null) => string;
  appendToMessage: (sessionId: string, msgId: string, text: string) => void;
  setMessageContent: (sessionId: string, msgId: string, content: string) => void;
  finalizeMessage: (sessionId: string, msgId: string) => void;

  // ── Inline annotations ──────────────────────────────────────
  addToolCall: (sessionId: string, msgId: string, tc: StoredToolCall) => void;
  updateToolCall: (sessionId: string, msgId: string, tool: string, patch: Partial<StoredToolCall>) => void;
  addAction: (sessionId: string, msgId: string, action: StoredAction) => void;
  addCard: (sessionId: string, msgId: string, card: StoredCard) => void;
  setStrategyData: (sessionId: string, msgId: string, nodes: any[], edges: any[]) => void;
  addStrategyNode: (sessionId: string, msgId: string, node: any) => void;
  setStrategyEdges: (sessionId: string, msgId: string, edges: any[]) => void;
  setBossRunId: (sessionId: string, msgId: string, runId: string) => void;

  // ── Dividers ────────────────────────────────────────────────
  addModeChange: (sessionId: string, from: ChatMode, to: ChatMode) => void;
  addSkillChange: (sessionId: string, from: SkillId | null, to: SkillId | null) => void;

  // ── Selectors ───────────────────────────────────────────────
  getActiveSession: () => Session | null;
  getSessionItems: (id: string) => SessionItem[];
  getActiveItems: () => SessionItem[];
}

const recomputeTokens = (sessions: Session[], itemsBySession: Record<string, SessionItem[]>, sessionId: string) =>
  sessions.map((s) =>
    s.id === sessionId ? { ...s, tokenCount: computeSessionTokens(itemsBySession[sessionId] ?? []) } : s,
  );

const updateMessage = (
  state: AiChatState,
  sessionId: string,
  msgId: string,
  patch: (msg: ChatMessage) => ChatMessage,
): Partial<AiChatState> => {
  const items = state.items[sessionId] ?? [];
  const next = items.map((it) =>
    it.role !== 'divider' && it.id === msgId ? patch(it) : it,
  );
  const itemsBySession = { ...state.items, [sessionId]: next };
  return {
    items: itemsBySession,
    sessions: recomputeTokens(state.sessions, itemsBySession, sessionId).map((s) =>
      s.id === sessionId ? { ...s, lastMessageAt: Date.now() } : s,
    ),
  };
};

export const useAiChatStore = create<AiChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      items: {},
      streamingMessageId: {},

      createSession: ({ mode, skillId = null, title, pageContextSnapshot }) => {
        const id = genId();
        const now = Date.now();
        const session: Session = {
          id,
          title: title ?? defaultTitle(mode, pageContextSnapshot),
          primaryMode: mode,
          skillId,
          createdAt: now,
          lastMessageAt: now,
          tokenCount: 0,
          pageContextSnapshot,
        };
        set((s) => ({
          sessions: [session, ...s.sessions],
          activeSessionId: id,
          items: { ...s.items, [id]: [] },
        }));
        return id;
      },

      setActiveSession: (id) => set({ activeSessionId: id }),

      deleteSession: (id) =>
        set((s) => {
          const { [id]: _omit, ...restItems } = s.items;
          const restSessions = s.sessions.filter((x) => x.id !== id);
          return {
            sessions: restSessions,
            items: restItems,
            activeSessionId:
              s.activeSessionId === id ? (restSessions[0]?.id ?? null) : s.activeSessionId,
          };
        }),

      renameSession: (id, title) =>
        set((s) => ({
          sessions: s.sessions.map((x) => (x.id === id ? { ...x, title } : x)),
        })),

      clearAll: () =>
        set({ sessions: [], activeSessionId: null, items: {}, streamingMessageId: {} }),

      addUserMessage: (sessionId, content, mode, skillId) => {
        const id = genId();
        const msg: ChatMessage = {
          id,
          role: 'user',
          content,
          timestamp: Date.now(),
          mode,
          skillId,
        };
        set((s) => {
          const list = [...(s.items[sessionId] ?? []), msg];
          const itemsBySession = { ...s.items, [sessionId]: list };
          return {
            items: itemsBySession,
            sessions: recomputeTokens(s.sessions, itemsBySession, sessionId).map((x) =>
              x.id === sessionId ? { ...x, lastMessageAt: msg.timestamp } : x,
            ),
          };
        });
        return id;
      },

      addAssistantMessage: (sessionId, mode, skillId) => {
        const id = genId();
        const msg: ChatMessage = {
          id,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          mode,
          skillId,
          toolCalls: [],
          actions: [],
          cards: [],
          isStreaming: true,
        };
        set((s) => ({
          items: { ...s.items, [sessionId]: [...(s.items[sessionId] ?? []), msg] },
          streamingMessageId: { ...s.streamingMessageId, [sessionId]: id },
        }));
        return id;
      },

      appendToMessage: (sessionId, msgId, text) =>
        set((s) =>
          updateMessage(s, sessionId, msgId, (m) => ({ ...m, content: m.content + text })),
        ),

      setMessageContent: (sessionId, msgId, content) =>
        set((s) => updateMessage(s, sessionId, msgId, (m) => ({ ...m, content }))),

      finalizeMessage: (sessionId, msgId) =>
        set((s) => ({
          ...updateMessage(s, sessionId, msgId, (m) => ({ ...m, isStreaming: false })),
          streamingMessageId: { ...s.streamingMessageId, [sessionId]: null },
        })),

      addToolCall: (sessionId, msgId, tc) =>
        set((s) =>
          updateMessage(s, sessionId, msgId, (m) => ({
            ...m,
            toolCalls: [...(m.toolCalls ?? []), tc],
          })),
        ),

      updateToolCall: (sessionId, msgId, tool, patch) =>
        set((s) =>
          updateMessage(s, sessionId, msgId, (m) => ({
            ...m,
            toolCalls: (m.toolCalls ?? []).map((tc) =>
              tc.tool === tool ? { ...tc, ...patch } : tc,
            ),
          })),
        ),

      addAction: (sessionId, msgId, action) =>
        set((s) =>
          updateMessage(s, sessionId, msgId, (m) => ({
            ...m,
            actions: [...(m.actions ?? []), action],
          })),
        ),

      addCard: (sessionId, msgId, card) =>
        set((s) =>
          updateMessage(s, sessionId, msgId, (m) => ({
            ...m,
            cards: [...(m.cards ?? []), card],
          })),
        ),

      setStrategyData: (sessionId, msgId, nodes, edges) =>
        set((s) =>
          updateMessage(s, sessionId, msgId, (m) => ({
            ...m,
            strategyNodes: nodes,
            strategyEdges: edges,
          })),
        ),

      addStrategyNode: (sessionId, msgId, node) =>
        set((s) =>
          updateMessage(s, sessionId, msgId, (m) => ({
            ...m,
            strategyNodes: [...(m.strategyNodes ?? []), node],
          })),
        ),

      setStrategyEdges: (sessionId, msgId, edges) =>
        set((s) =>
          updateMessage(s, sessionId, msgId, (m) => ({ ...m, strategyEdges: edges })),
        ),

      setBossRunId: (sessionId, msgId, runId) =>
        set((s) => updateMessage(s, sessionId, msgId, (m) => ({ ...m, bossRunId: runId }))),

      addModeChange: (sessionId, from, to) => {
        const divider: DividerMessage = {
          id: genId(),
          role: 'divider',
          kind: 'mode_change',
          from,
          to,
          timestamp: Date.now(),
        };
        set((s) => ({
          items: { ...s.items, [sessionId]: [...(s.items[sessionId] ?? []), divider] },
        }));
      },

      addSkillChange: (sessionId, from, to) => {
        const divider: DividerMessage = {
          id: genId(),
          role: 'divider',
          kind: 'skill_change',
          from,
          to,
          timestamp: Date.now(),
        };
        set((s) => ({
          items: { ...s.items, [sessionId]: [...(s.items[sessionId] ?? []), divider] },
        }));
      },

      // Selectors
      getActiveSession: () => {
        const s = get();
        return s.sessions.find((x) => x.id === s.activeSessionId) ?? null;
      },
      getSessionItems: (id) => get().items[id] ?? [],
      getActiveItems: () => {
        const s = get();
        if (!s.activeSessionId) return [];
        return s.items[s.activeSessionId] ?? [];
      },
    }),
    {
      name: 'fyer-ai-chat-v2',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        items: Object.fromEntries(
          Object.entries(state.items).map(([id, list]) => [
            id,
            list.map((it) =>
              it.role !== 'divider' ? { ...it, isStreaming: false } : it,
            ),
          ]),
        ),
      }),
    },
  ),
);

function defaultTitle(mode: ChatMode, ctx?: PageContext): string {
  const modeLabel = {
    ask: 'New chat',
    strategy: 'Strategy build',
    code: 'Code generation',
    boss: 'Boss run',
  }[mode];
  if (ctx?.primaryEntity?.label) return `${modeLabel} · ${ctx.primaryEntity.label}`;
  if (ctx?.primaryEntity?.id) return `${modeLabel} · ${ctx.primaryEntity.id}`;
  return modeLabel;
}

// ── Helpers used by transports ───────────────────────────────

export function ensureActiveSession(opts: {
  mode: 'ask' | 'strategy' | 'code' | 'boss';
  skillId: SkillId | null;
  pageContextSnapshot?: PageContext;
}): string {
  const s = useAiChatStore.getState();
  if (s.activeSessionId && s.sessions.find((x) => x.id === s.activeSessionId)) {
    return s.activeSessionId;
  }
  return s.createSession(opts);
}

export function getSessionHistoryForApi(
  sessionId: string,
  limit = 20,
): { role: string; content: string }[] {
  const items = useAiChatStore.getState().items[sessionId] ?? [];
  const messages = items.filter(
    (it): it is ChatMessage => it.role !== 'divider' && Boolean((it as ChatMessage).content),
  );
  return messages.slice(-limit).map((m) => ({ role: m.role, content: m.content }));
}
