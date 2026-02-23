/**
 * Execution Store (Zustand)
 * Manages execution history, live execution state, and node logs.
 */

import { create } from 'zustand';
import { api } from '../services/api';
import { getAuthHeaders } from './authStore';

interface ExecutionRun {
    id: string;
    strategyId: string;
    triggerType: string;
    status: string;
    durationMs: number | null;
    nodesExecuted: number;
    nodesSkipped: number;
    nodesErrored: number;
    pythonDelegations: number;
    summary: any;
    startedAt: string;
    finishedAt: string | null;
    strategy?: { name: string };
}

interface NodeLog {
    id: string;
    nodeId: string;
    nodeType: string;
    status: string;
    inputData: any;
    outputData: any;
    errorMessage: string | null;
    durationMs: number;
    executionOrder: number;
}

interface ExecutionState {
    runs: ExecutionRun[];
    currentRun: (ExecutionRun & { nodeLogs: NodeLog[] }) | null;
    pagination: { page: number; limit: number; total: number; totalPages: number };
    isLoading: boolean;
    error: string | null;

    // Live execution tracking
    liveExecution: {
        runId: string | null;
        nodeUpdates: Map<string, { status: string; outputData: any; durationMs: number }>;
    };

    // Actions
    fetchRuns: (params?: { page?: number; strategyId?: string; status?: string }) => Promise<void>;
    fetchRunDetail: (runId: string) => Promise<void>;
    updateLiveNode: (nodeId: string, update: { status: string; outputData: any; durationMs: number }) => void;
    startLiveExecution: (runId: string) => void;
    endLiveExecution: () => void;
    clearError: () => void;
}

export const useExecutionStore = create<ExecutionState>()((set, get) => ({
    runs: [],
    currentRun: null,
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    isLoading: false,
    error: null,
    liveExecution: { runId: null, nodeUpdates: new Map() },

    fetchRuns: async (params = {}) => {
        set({ isLoading: true, error: null });
        try {
            const query = new URLSearchParams();
            if (params.page) query.set('page', String(params.page));
            if (params.strategyId) query.set('strategyId', params.strategyId);
            if (params.status) query.set('status', params.status);

            const data = await api.get<any>(`/api/executions?${query}`, {
                headers: getAuthHeaders(),
            });
            set({
                runs: data.runs,
                pagination: data.pagination,
                isLoading: false,
            });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    fetchRunDetail: async (runId: string) => {
        set({ isLoading: true, error: null });
        try {
            const data = await api.get<any>(`/api/executions/${runId}`, {
                headers: getAuthHeaders(),
            });
            set({ currentRun: data.run, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    updateLiveNode: (nodeId, update) => {
        const { liveExecution } = get();
        const newMap = new Map(liveExecution.nodeUpdates);
        newMap.set(nodeId, update);
        set({ liveExecution: { ...liveExecution, nodeUpdates: newMap } });
    },

    startLiveExecution: (runId: string) => {
        set({ liveExecution: { runId, nodeUpdates: new Map() } });
    },

    endLiveExecution: () => {
        set({ liveExecution: { runId: null, nodeUpdates: new Map() } });
    },

    clearError: () => set({ error: null }),
}));
