/**
 * Shared types for the unified AI chat system.
 *
 * Modes are transports/capabilities (Ask=SSE, Strategy=fetch, Code=fetch, Boss=WS).
 * Skills are personas (system-prompt swaps), orthogonal to modes.
 */

// ── Modes ────────────────────────────────────────────────────

export type ChatMode = 'ask' | 'strategy' | 'code' | 'boss';

export const CHAT_MODES: ChatMode[] = ['ask', 'strategy', 'code', 'boss'];

// ── Skills ───────────────────────────────────────────────────

export type SkillId =
  | 'quant'
  | 'market-researcher'
  | 'wealth-advisor'
  | 'portfolio-manager'
  | 'sales-trader'
  | 'risk-quant'
  | 'macro-strategist'
  | 'trading-coach';

// ── Page context ─────────────────────────────────────────────

export type PageContext = {
  page: string;
  primaryEntity?: {
    type: 'symbol' | 'strategy' | 'execution' | 'portfolio';
    id: string;
    label?: string;
  };
  visibleData?: { kind: string; snapshot: unknown };
  selection?: unknown;
  permissions?: { canExecuteOrders?: boolean };
};

// ── Unified event stream ─────────────────────────────────────

export type ToolStatus = 'pending' | 'pending_approval' | 'done' | 'error' | 'rejected';

export type UnifiedEvent =
  | { kind: 'text_delta'; text: string }
  | {
      kind: 'tool_call';
      tool: string;
      args: Record<string, any>;
      status: ToolStatus;
      /** Set on sensitive tools that require explicit user approval. */
      needsApproval?: boolean;
      /** Server-generated id; pass back to /approve when accepting/rejecting. */
      toolCallId?: string;
    }
  | { kind: 'tool_result'; tool: string; result: Record<string, any>; success: boolean }
  | { kind: 'card'; cardType: string; cardId: string; payload: unknown }
  | { kind: 'mode_change'; from: ChatMode; to: ChatMode; at: number }
  | { kind: 'skill_change'; from: SkillId | null; to: SkillId | null; at: number }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

// ── Stored card (in messages) ────────────────────────────────

export interface StoredCard {
  id: string;
  cardType: string;
  payload: any;
  createdAt: number;
}

// ── Tool call event (stored) ─────────────────────────────────

export interface StoredToolCall {
  id: string;
  tool: string;
  args: Record<string, any>;
  status: ToolStatus;
  result?: Record<string, any>;
  /** Server-generated id for sensitive tools, used by the approval card. */
  toolCallId?: string;
  /** True when the agent is awaiting user accept/reject. */
  needsApproval?: boolean;
}

// ── Action event (stored) ────────────────────────────────────

export interface StoredAction {
  action: string;
  data: Record<string, any>;
}

// ── Chat message (stored) ────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  // Per-mode bias info — tracks which mode/skill produced the assistant turn
  mode?: ChatMode;
  skillId?: SkillId | null;
  // Inline annotations
  toolCalls?: StoredToolCall[];
  actions?: StoredAction[];
  cards?: StoredCard[];
  // Strategy-mode legacy (preserved for AskMode → StrategyNodesCard)
  strategyNodes?: any[];
  strategyEdges?: any[];
  // Boss-mode reference (live tree state lives in agentMonitorStore)
  bossRunId?: string;
  // Runtime
  isStreaming?: boolean;
}

// Synthetic divider events stored as messages (no role) so they sort chronologically
export interface DividerMessage {
  id: string;
  role: 'divider';
  kind: 'mode_change' | 'skill_change';
  from: string | null;
  to: string | null;
  timestamp: number;
}

export type SessionItem = ChatMessage | DividerMessage;

// ── Session ──────────────────────────────────────────────────

export interface Session {
  id: string;
  title: string;
  primaryMode: ChatMode;
  skillId: SkillId | null;
  createdAt: number;
  lastMessageAt: number;
  tokenCount: number;
  pageContextSnapshot?: PageContext;
}
