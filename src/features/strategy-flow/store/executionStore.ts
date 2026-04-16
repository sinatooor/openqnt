/**
 * Execution Store - Manages per-node execution state for the n8n-style
 * live execution visualization on the strategy flow canvas.
 *
 * Separated from strategyFlowStore to keep execution concerns isolated
 * and avoid polluting the persisted canvas state.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

// =============================================================================
// TYPES
// =============================================================================

export type NodeExecutionStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'error'
  | 'skipped'
  | 'waiting';

export interface NodeExecutionData {
  status: NodeExecutionStatus;
  inputData: Record<string, unknown> | null;
  outputData: Record<string, unknown> | null;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  durationMs: number | null;
  itemsProcessed: number;
  /** For IF/Switch nodes, which branch was taken (handle id) */
  takenBranch: string | null;
  /** Data pinning: frozen output that won't be re-run */
  isPinned: boolean;
  pinnedAt: number | null;
}

export interface EdgeExecutionData {
  /** Whether data flowed through this edge */
  active: boolean;
  /** Whether this edge is on the currently-executing path */
  running: boolean;
  /** Items that passed through */
  itemCount: number;
}

export type ExecutionPhase = 'idle' | 'running' | 'paused' | 'completed' | 'error';

// =============================================================================
// STORE STATE
// =============================================================================

interface ExecutionState {
  /** Overall execution phase */
  phase: ExecutionPhase;
  /** Per-node execution data keyed by node id */
  nodeStates: Record<string, NodeExecutionData>;
  /** Per-edge execution data keyed by edge id */
  edgeStates: Record<string, EdgeExecutionData>;
  /** Ordered list of node ids as they were executed */
  executionOrder: string[];
  /** The node currently being executed */
  activeNodeId: string | null;
  /** Timestamp when execution started */
  executionStartedAt: number | null;
  /** Timestamp when execution finished */
  executionFinishedAt: number | null;
}

interface ExecutionActions {
  // Lifecycle
  startExecution: () => void;
  completeExecution: () => void;
  resetExecution: () => void;

  // Per-node updates (called by the execution orchestrator)
  setNodeRunning: (nodeId: string) => void;
  setNodeSuccess: (
    nodeId: string,
    output: Record<string, unknown>,
    input: Record<string, unknown>,
    itemsProcessed?: number,
    takenBranch?: string | null,
  ) => void;
  setNodeError: (nodeId: string, error: string) => void;
  setNodeSkipped: (nodeId: string) => void;
  setNodeWaiting: (nodeId: string) => void;

  // Edge updates
  setEdgeActive: (edgeId: string, itemCount?: number) => void;
  setEdgeRunning: (edgeId: string) => void;
  clearEdgeRunning: (edgeId: string) => void;

  // Pinning
  pinNode: (nodeId: string) => void;
  unpinNode: (nodeId: string) => void;
  isPinned: (nodeId: string) => boolean;
}

// =============================================================================
// DEFAULTS
// =============================================================================

const defaultNodeState: NodeExecutionData = {
  status: 'idle',
  inputData: null,
  outputData: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  itemsProcessed: 0,
  takenBranch: null,
  isPinned: false,
  pinnedAt: null,
};

const defaultEdgeState: EdgeExecutionData = {
  active: false,
  running: false,
  itemCount: 0,
};

const initialState: ExecutionState = {
  phase: 'idle',
  nodeStates: {},
  edgeStates: {},
  executionOrder: [],
  activeNodeId: null,
  executionStartedAt: null,
  executionFinishedAt: null,
};

// =============================================================================
// STORE
// =============================================================================

export const useExecutionStore = create<ExecutionState & ExecutionActions>()(
  (set, get) => ({
    ...initialState,

    startExecution: () => {
      // Preserve pinned nodes across execution runs — their frozen output
      // should survive so traversal can skip them.
      const prev = get().nodeStates;
      const pinned: Record<string, NodeExecutionData> = {};
      for (const [id, ns] of Object.entries(prev)) {
        if (ns.isPinned) pinned[id] = ns;
      }

      set({
        phase: 'running',
        nodeStates: pinned,
        edgeStates: {},
        executionOrder: [],
        activeNodeId: null,
        executionStartedAt: Date.now(),
        executionFinishedAt: null,
      });
    },

    completeExecution: () => {
      set({
        phase: 'completed',
        activeNodeId: null,
        executionFinishedAt: Date.now(),
      });
    },

    resetExecution: () => {
      set({ ...initialState });
    },

    // -----------------------------------------------------------------------
    // Node state transitions
    // -----------------------------------------------------------------------

    setNodeRunning: (nodeId) => {
      set((state) => ({
        activeNodeId: nodeId,
        nodeStates: {
          ...state.nodeStates,
          [nodeId]: {
            ...defaultNodeState,
            status: 'running',
            startedAt: Date.now(),
          },
        },
      }));
    },

    setNodeSuccess: (nodeId, output, input, itemsProcessed = 1, takenBranch = null) => {
      const now = Date.now();
      set((state) => {
        const prev = state.nodeStates[nodeId] || defaultNodeState;
        return {
          nodeStates: {
            ...state.nodeStates,
            [nodeId]: {
              ...prev,
              status: 'success',
              outputData: output,
              inputData: input,
              finishedAt: now,
              durationMs: prev.startedAt ? now - prev.startedAt : 0,
              itemsProcessed,
              takenBranch,
            },
          },
          executionOrder: [...state.executionOrder, nodeId],
        };
      });
    },

    setNodeError: (nodeId, error) => {
      const now = Date.now();
      set((state) => {
        const prev = state.nodeStates[nodeId] || defaultNodeState;
        return {
          phase: 'error',
          nodeStates: {
            ...state.nodeStates,
            [nodeId]: {
              ...prev,
              status: 'error',
              error,
              finishedAt: now,
              durationMs: prev.startedAt ? now - prev.startedAt : 0,
            },
          },
          executionOrder: [...state.executionOrder, nodeId],
        };
      });
    },

    setNodeSkipped: (nodeId) => {
      set((state) => ({
        nodeStates: {
          ...state.nodeStates,
          [nodeId]: {
            ...defaultNodeState,
            status: 'skipped',
          },
        },
      }));
    },

    setNodeWaiting: (nodeId) => {
      set((state) => ({
        activeNodeId: nodeId,
        nodeStates: {
          ...state.nodeStates,
          [nodeId]: {
            ...(state.nodeStates[nodeId] || defaultNodeState),
            status: 'waiting',
          },
        },
      }));
    },

    // -----------------------------------------------------------------------
    // Edge state transitions
    // -----------------------------------------------------------------------

    setEdgeActive: (edgeId, itemCount = 1) => {
      set((state) => ({
        edgeStates: {
          ...state.edgeStates,
          [edgeId]: { active: true, running: false, itemCount },
        },
      }));
    },

    setEdgeRunning: (edgeId) => {
      set((state) => ({
        edgeStates: {
          ...state.edgeStates,
          [edgeId]: {
            ...(state.edgeStates[edgeId] || defaultEdgeState),
            running: true,
          },
        },
      }));
    },

    clearEdgeRunning: (edgeId) => {
      set((state) => ({
        edgeStates: {
          ...state.edgeStates,
          [edgeId]: {
            ...(state.edgeStates[edgeId] || defaultEdgeState),
            running: false,
          },
        },
      }));
    },

    // -----------------------------------------------------------------------
    // Pinning
    // -----------------------------------------------------------------------

    pinNode: (nodeId) => {
      set((state) => {
        const existing = state.nodeStates[nodeId] || defaultNodeState;
        return {
          nodeStates: {
            ...state.nodeStates,
            [nodeId]: {
              ...existing,
              isPinned: true,
              pinnedAt: Date.now(),
            },
          },
        };
      });
    },

    unpinNode: (nodeId) => {
      set((state) => {
        const existing = state.nodeStates[nodeId] || defaultNodeState;
        return {
          nodeStates: {
            ...state.nodeStates,
            [nodeId]: {
              ...existing,
              isPinned: false,
              pinnedAt: null,
            },
          },
        };
      });
    },

    isPinned: (nodeId) => {
      return !!(get().nodeStates[nodeId]?.isPinned);
    },
  }),
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectNodeExecution = (nodeId: string) =>
  (state: ExecutionState) => state.nodeStates[nodeId] || defaultNodeState;

export const selectEdgeExecution = (edgeId: string) =>
  (state: ExecutionState) => state.edgeStates[edgeId] || defaultEdgeState;

export const selectExecutionPhase = (state: ExecutionState) => state.phase;

export const useExecutionStoreShallow = <T>(
  selector: (state: ExecutionState & ExecutionActions) => T,
): T => {
  return useExecutionStore(useShallow(selector));
};
