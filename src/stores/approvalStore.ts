/**
 * Approval queue — orders submitted by agents/strategies that require human
 * sign-off before being routed to the broker.
 *
 * This is a thin client-side queue; in production the backend writes to the
 * same conceptual queue and pushes WebSocket events to refresh the UI.
 *
 * Models the ApprovalStatus enum already declared in orchestrator/prisma/schema.prisma.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { OrderType, TimeInForce } from '@/features/execution-viewer/api';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'auto_approved';

export type ApprovalSource = 'agent' | 'strategy' | 'rebalance' | 'manual';

export interface PendingOrder {
  /** Local ID; backend may issue its own and replace this on submit. */
  id: string;
  /** Who/what proposed the trade. */
  source: ApprovalSource;
  /** Free-form name of the agent/strategy/rebalance plan. */
  proposedBy: string;
  /** Why this was proposed — shown in the queue and persisted in the audit log. */
  rationale: string;
  /** Account scope. */
  accountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  type: OrderType;
  limit_price?: number | null;
  stop_price?: number | null;
  tif?: TimeInForce | null;
  /** Estimated notional in account currency, for risk-gate sorting. */
  estimatedNotional: number;
  status: ApprovalStatus;
  createdAt: number;
  /** Approval expiry — auto-rejects when reached. */
  expiresAt?: number;
  /** Set when approved/rejected. */
  decidedAt?: number;
  decidedBy?: string;
  decisionNote?: string;
  /** Set after the broker accepts the approved order. */
  brokerOrderId?: string;
}

export interface ApprovalRule {
  id: string;
  /** Notional under which orders are auto-approved (USD-equivalent). */
  autoApproveBelowNotional?: number;
  /** Symbols that ALWAYS require human review regardless of notional. */
  requireReviewSymbols?: string[];
  /** Sources allowed to skip review (e.g. "manual" already represents human intent). */
  autoApproveSources?: ApprovalSource[];
}

interface ApprovalState {
  queue: PendingOrder[];
  rules: ApprovalRule;
  // ─── Actions ─────────────────────
  enqueue: (
    p: Omit<PendingOrder, 'id' | 'status' | 'createdAt'>
  ) => PendingOrder;
  approve: (id: string, by: string, note?: string) => void;
  reject: (id: string, by: string, note?: string) => void;
  setBrokerOrderId: (id: string, brokerOrderId: string) => void;
  expirePending: () => void;
  clearDecided: () => void;
  setRules: (rules: ApprovalRule) => void;
  // ─── Getters ─────────────────────
  pending: () => PendingOrder[];
  decided: () => PendingOrder[];
  pendingCount: () => number;
}

const DEFAULT_RULES: ApprovalRule = {
  id: 'default',
  autoApproveBelowNotional: 0, // disabled by default — institutional users dial in
  autoApproveSources: ['manual'],
  requireReviewSymbols: [],
};

function shouldAutoApprove(p: Omit<PendingOrder, 'id' | 'status' | 'createdAt'>, rules: ApprovalRule): boolean {
  if (rules.requireReviewSymbols?.includes(p.symbol)) return false;
  if (rules.autoApproveSources?.includes(p.source)) return true;
  if (typeof rules.autoApproveBelowNotional === 'number' && rules.autoApproveBelowNotional > 0) {
    return p.estimatedNotional <= rules.autoApproveBelowNotional;
  }
  return false;
}

export const useApprovalStore = create<ApprovalState>()(
  persist(
    (set, get) => ({
      queue: [],
      rules: DEFAULT_RULES,

      enqueue: (p) => {
        const now = Date.now();
        const id = `appr-${now}-${Math.random().toString(36).slice(2, 8)}`;
        const status: ApprovalStatus = shouldAutoApprove(p, get().rules) ? 'auto_approved' : 'pending';
        const order: PendingOrder = {
          ...p,
          id,
          status,
          createdAt: now,
          decidedAt: status === 'auto_approved' ? now : undefined,
          decidedBy: status === 'auto_approved' ? 'rule:auto' : undefined,
        };
        set((s) => ({ queue: [...s.queue, order] }));
        return order;
      },

      approve: (id, by, note) =>
        set((s) => ({
          queue: s.queue.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: 'approved',
                  decidedAt: Date.now(),
                  decidedBy: by,
                  decisionNote: note,
                }
              : o
          ),
        })),

      reject: (id, by, note) =>
        set((s) => ({
          queue: s.queue.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: 'rejected',
                  decidedAt: Date.now(),
                  decidedBy: by,
                  decisionNote: note,
                }
              : o
          ),
        })),

      setBrokerOrderId: (id, brokerOrderId) =>
        set((s) => ({
          queue: s.queue.map((o) => (o.id === id ? { ...o, brokerOrderId } : o)),
        })),

      expirePending: () => {
        const now = Date.now();
        set((s) => ({
          queue: s.queue.map((o) =>
            o.status === 'pending' && o.expiresAt && o.expiresAt < now
              ? { ...o, status: 'expired', decidedAt: now, decidedBy: 'rule:expired' }
              : o
          ),
        }));
      },

      clearDecided: () =>
        set((s) => ({ queue: s.queue.filter((o) => o.status === 'pending') })),

      setRules: (rules) => set({ rules }),

      pending: () => get().queue.filter((o) => o.status === 'pending'),
      decided: () => get().queue.filter((o) => o.status !== 'pending'),
      pendingCount: () => get().queue.filter((o) => o.status === 'pending').length,
    }),
    {
      name: 'openqwnt-approvals',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useApprovalStore;
