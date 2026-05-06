/**
 * Audit store — append-only journal of every consequential action.
 *
 * Captures who/what did what, when, with what intent, and the resulting
 * state delta. Sized to live in localStorage for now (last N events) with
 * a `flushToBackend` hook for production use.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AuditCategory =
  | 'trade'        // buy / sell on a holding
  | 'order'        // order submission / approval / cancel
  | 'portfolio'    // add/edit/remove holding, import, export
  | 'account'      // create / archive / rename account
  | 'agent'        // agent dispatched, completed, halted
  | 'risk'         // risk limit triggered, panic, kill-switch
  | 'config';      // settings change (cost-basis method, theme, etc.)

export interface AuditEvent {
  id: string;
  category: AuditCategory;
  /** Short imperative summary, e.g., "Sold 80 AAPL". */
  summary: string;
  /** Free-form rationale or note. */
  note?: string;
  /** Who performed it: 'user', 'agent:<name>', 'strategy:<name>', 'rule:<name>'. */
  actor: string;
  /** Optional account scope. */
  accountId?: string;
  /** Arbitrary structured payload (params, before/after snapshots). */
  data?: Record<string, unknown>;
  /** ms epoch. */
  ts: number;
}

interface AuditState {
  events: AuditEvent[];
  /** Hard cap; oldest events are dropped on overflow. */
  maxEvents: number;

  log: (e: Omit<AuditEvent, 'id' | 'ts'>) => AuditEvent;
  clear: () => void;
  setMax: (max: number) => void;

  byCategory: (cat: AuditCategory) => AuditEvent[];
  recent: (n?: number) => AuditEvent[];
}

export const useAuditStore = create<AuditState>()(
  persist(
    (set, get) => ({
      events: [],
      maxEvents: 1000,

      log: (e) => {
        const ts = Date.now();
        const id = `evt-${ts}-${Math.random().toString(36).slice(2, 8)}`;
        const entry: AuditEvent = { ...e, id, ts };
        set((s) => {
          const next = [...s.events, entry];
          if (next.length > s.maxEvents) next.splice(0, next.length - s.maxEvents);
          return { events: next };
        });
        return entry;
      },

      clear: () => set({ events: [] }),
      setMax: (max) => set({ maxEvents: Math.max(50, max) }),

      byCategory: (cat) => get().events.filter((e) => e.category === cat),
      recent: (n = 50) => [...get().events].slice(-n).reverse(),
    }),
    {
      name: 'openqwnt-audit',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useAuditStore;
