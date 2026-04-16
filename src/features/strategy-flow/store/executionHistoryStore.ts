/**
 * ExecutionHistoryStore - Persists a log of past execution runs per workflow.
 *
 * Each time a workflow finishes executing (success, error, or manual stop),
 * the execution result is appended here. Users can browse the list and
 * "replay" a past run — which loads the frozen node/edge states back into
 * executionStore so they can inspect input/output data for every node.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { NodeExecutionData, ExecutionPhase } from './executionStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const MAX_ENTRIES_PER_WORKFLOW = 50;

const generateId = () =>
  `run-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

export interface ExecutionHistoryEntry {
  id: string;
  /** Workflow that was run */
  workflowId: string;
  workflowName: string;
  /** Timestamps */
  startedAt: number;
  finishedAt: number | null;
  /** Final phase */
  phase: ExecutionPhase;
  durationMs: number | null;
  /** Snapshot of every node's execution state */
  nodeStates: Record<string, NodeExecutionData>;
  /** Ordered list of executed node IDs */
  executionOrder: string[];
  /** How many nodes succeeded / errored */
  successCount: number;
  errorCount: number;
  skippedCount: number;
  /** The trigger node id that fired this run (if any) */
  triggerNodeId: string | null;
  /** Execution order mode used for this run */
  executionOrderMode: 'v0' | 'v1';
}

// ---------------------------------------------------------------------------
// Store state & actions
// ---------------------------------------------------------------------------

interface ExecutionHistoryState {
  entries: ExecutionHistoryEntry[];
}

interface ExecutionHistoryActions {
  /** Append a new completed run (returns the new entry id) */
  addEntry: (entry: Omit<ExecutionHistoryEntry, 'id'>) => string;
  /** Update an in-progress entry (e.g. set finishedAt after completion) */
  updateEntry: (id: string, updates: Partial<ExecutionHistoryEntry>) => void;
  /** Remove a single entry */
  deleteEntry: (id: string) => void;
  /** Clear all history, or only entries for a specific workflow */
  clearHistory: (workflowId?: string) => void;
  /** Returns entries for a specific workflow, newest-first */
  getEntriesForWorkflow: (workflowId: string) => ExecutionHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useExecutionHistoryStore = create<
  ExecutionHistoryState & ExecutionHistoryActions
>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (entry) => {
        const id = generateId();
        set((s) => {
          const next = [{ ...entry, id }, ...s.entries];
          // Cap: keep at most MAX per workflow + global cap of 500
          const byWf = new Map<string, number>();
          const pruned: ExecutionHistoryEntry[] = [];
          for (const e of next) {
            const count = byWf.get(e.workflowId) ?? 0;
            if (count < MAX_ENTRIES_PER_WORKFLOW) {
              pruned.push(e);
              byWf.set(e.workflowId, count + 1);
            }
          }
          return { entries: pruned.slice(0, 500) };
        });
        return id;
      },

      updateEntry: (id, updates) => {
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id ? { ...e, ...updates } : e,
          ),
        }));
      },

      deleteEntry: (id) => {
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
      },

      clearHistory: (workflowId) => {
        if (workflowId) {
          set((s) => ({
            entries: s.entries.filter((e) => e.workflowId !== workflowId),
          }));
        } else {
          set({ entries: [] });
        }
      },

      getEntriesForWorkflow: (workflowId) =>
        get().entries.filter((e) => e.workflowId === workflowId),
    }),
    {
      name: 'execution-history-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// ---------------------------------------------------------------------------
// Helpers called by useExecutionFlow
// ---------------------------------------------------------------------------

/**
 * Start recording a new run. Returns the entry id so it can be updated later.
 */
export function startHistoryEntry(
  workflowId: string,
  workflowName: string,
  executionOrderMode: 'v0' | 'v1',
  triggerNodeId: string | null,
): string {
  return useExecutionHistoryStore.getState().addEntry({
    workflowId,
    workflowName,
    startedAt: Date.now(),
    finishedAt: null,
    phase: 'running',
    durationMs: null,
    nodeStates: {},
    executionOrder: [],
    successCount: 0,
    errorCount: 0,
    skippedCount: 0,
    triggerNodeId,
    executionOrderMode,
  });
}

/**
 * Finalise the entry after execution completes.
 */
export function finalizeHistoryEntry(
  entryId: string,
  nodeStates: Record<string, NodeExecutionData>,
  executionOrder: string[],
  phase: ExecutionPhase,
): void {
  const finishedAt = Date.now();
  const entry = useExecutionHistoryStore.getState().entries.find((e) => e.id === entryId);
  const durationMs = entry ? finishedAt - entry.startedAt : null;

  const values = Object.values(nodeStates);
  const successCount = values.filter((n) => n.status === 'success').length;
  const errorCount = values.filter((n) => n.status === 'error').length;
  const skippedCount = values.filter((n) => n.status === 'skipped').length;

  useExecutionHistoryStore.getState().updateEntry(entryId, {
    finishedAt,
    phase,
    durationMs,
    nodeStates: { ...nodeStates },
    executionOrder: [...executionOrder],
    successCount,
    errorCount,
    skippedCount,
  });
}
