/**
 * AI Chat Store - Zustand store for the global AI assistant chat.
 * Persists messages across page navigations.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ── Types ────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallEvent[];
  actions?: ActionEvent[];
  strategyNodes?: any[];
  strategyEdges?: any[];
  isStreaming?: boolean;
}

export interface ToolCallEvent {
  tool: string;
  args: Record<string, any>;
  result?: Record<string, any>;
  status: 'calling' | 'done' | 'error';
}

export interface ActionEvent {
  action: string;
  data: Record<string, any>;
}

interface AiChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStreamingId: string | null;

  // Actions
  addUserMessage: (content: string) => string;
  addAssistantMessage: () => string;
  appendToMessage: (id: string, content: string) => void;
  addToolCall: (messageId: string, toolCall: ToolCallEvent) => void;
  updateToolCall: (messageId: string, toolName: string, update: Partial<ToolCallEvent>) => void;
  addAction: (messageId: string, action: ActionEvent) => void;
  setStrategyData: (messageId: string, nodes: any[], edges: any[]) => void;
  addStrategyNode: (messageId: string, node: any) => void;
  setStrategyEdges: (messageId: string, edges: any[]) => void;
  finalizeMessage: (id: string) => void;
  setStreaming: (streaming: boolean) => void;
  clearMessages: () => void;
}

// ── Helper ───────────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ── Store ────────────────────────────────────────────────────

export const useAiChatStore = create<AiChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      isStreaming: false,
      currentStreamingId: null,

      addUserMessage: (content: string) => {
        const id = genId();
        set((s) => ({
          messages: [
            ...s.messages,
            {
              id,
              role: 'user',
              content,
              timestamp: Date.now(),
            },
          ],
        }));
        return id;
      },

      addAssistantMessage: () => {
        const id = genId();
        set((s) => ({
          messages: [
            ...s.messages,
            {
              id,
              role: 'assistant',
              content: '',
              timestamp: Date.now(),
              toolCalls: [],
              actions: [],
              strategyNodes: [],
              strategyEdges: [],
              isStreaming: true,
            },
          ],
          isStreaming: true,
          currentStreamingId: id,
        }));
        return id;
      },

      appendToMessage: (id, content) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, content: m.content + content } : m
          ),
        }));
      },

      addToolCall: (messageId, toolCall) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId
              ? { ...m, toolCalls: [...(m.toolCalls || []), toolCall] }
              : m
          ),
        }));
      },

      updateToolCall: (messageId, toolName, update) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  toolCalls: (m.toolCalls || []).map((tc) =>
                    tc.tool === toolName ? { ...tc, ...update } : tc
                  ),
                }
              : m
          ),
        }));
      },

      addAction: (messageId, action) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId
              ? { ...m, actions: [...(m.actions || []), action] }
              : m
          ),
        }));
      },

      setStrategyData: (messageId, nodes, edges) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId
              ? { ...m, strategyNodes: nodes, strategyEdges: edges }
              : m
          ),
        }));
      },

      addStrategyNode: (messageId, node) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId
              ? { ...m, strategyNodes: [...(m.strategyNodes || []), node] }
              : m
          ),
        }));
      },

      setStrategyEdges: (messageId, edges) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, strategyEdges: edges } : m
          ),
        }));
      },

      finalizeMessage: (id) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, isStreaming: false } : m
          ),
          isStreaming: false,
          currentStreamingId: null,
        }));
      },

      setStreaming: (streaming) => set({ isStreaming: streaming }),

      clearMessages: () =>
        set({ messages: [], isStreaming: false, currentStreamingId: null }),
    }),
    {
      name: 'fyer-ai-chat',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        // Only persist messages (not streaming state)
        messages: state.messages.map((m) => ({ ...m, isStreaming: false })),
      }),
    }
  )
);
