/**
 * useExecutionReplay hook — loads execution data and provides step-through replay.
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import type { NodeExecutionData } from '../features/execution-viewer/ExecutionCanvas';

interface ExecutionReplayState {
    isLoading: boolean;
    error: string | null;
    nodes: any[];
    edges: any[];
    nodeExecutions: NodeExecutionData[];
    currentStep: number;
    totalSteps: number;
    isPlaying: boolean;
    totalDurationMs: number;
}

export function useExecutionReplay(executionId: string | null) {
    const [state, setState] = useState<ExecutionReplayState>({
        isLoading: false,
        error: null,
        nodes: [],
        edges: [],
        nodeExecutions: [],
        currentStep: 0,
        totalSteps: 0,
        isPlaying: false,
        totalDurationMs: 0,
    });

    // Load execution data
    useEffect(() => {
        if (!executionId) return;
        loadExecution(executionId);
    }, [executionId]);

    const loadExecution = async (id: string) => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const data = await api.getExecution(id);
            const run = data.run;
            const nodeLogs: NodeExecutionData[] = (run.nodeLogs ?? []).map((log: any) => ({
                nodeId: log.nodeId,
                nodeType: log.nodeType,
                status: log.status,
                inputData: log.inputData,
                outputData: log.outputData,
                durationMs: log.durationMs,
                executionOrder: log.executionOrder,
                errorMessage: log.errorMessage,
            }));

            // Load the strategy's nodes/edges
            let nodes: any[] = [];
            let edges: any[] = [];
            if (run.strategyId) {
                try {
                    const strategy = await api.getStrategy(run.strategyId);
                    nodes = strategy.strategy?.nodes ?? [];
                    edges = strategy.strategy?.edges ?? [];
                } catch {
                    // Strategy may no longer exist
                }
            }

            setState({
                isLoading: false,
                error: null,
                nodes,
                edges,
                nodeExecutions: nodeLogs,
                currentStep: nodeLogs.length, // Show all by default
                totalSteps: nodeLogs.length,
                isPlaying: false,
                totalDurationMs: run.durationMs ?? 0,
            });
        } catch (error: any) {
            setState((s) => ({ ...s, isLoading: false, error: error.message }));
        }
    };

    // Step controls
    const stepForward = useCallback(() => {
        setState((s) => ({
            ...s,
            currentStep: Math.min(s.currentStep + 1, s.totalSteps),
        }));
    }, []);

    const stepBackward = useCallback(() => {
        setState((s) => ({
            ...s,
            currentStep: Math.max(s.currentStep - 1, 0),
        }));
    }, []);

    const jumpToStep = useCallback((step: number) => {
        setState((s) => ({
            ...s,
            currentStep: Math.max(0, Math.min(step, s.totalSteps)),
        }));
    }, []);

    const play = useCallback(() => {
        setState((s) => ({ ...s, isPlaying: true, currentStep: 0 }));
    }, []);

    const pause = useCallback(() => {
        setState((s) => ({ ...s, isPlaying: false }));
    }, []);

    // Auto-play effect
    useEffect(() => {
        if (!state.isPlaying || state.currentStep >= state.totalSteps) {
            if (state.isPlaying) setState((s) => ({ ...s, isPlaying: false }));
            return;
        }
        const timer = setTimeout(() => {
            setState((s) => ({ ...s, currentStep: s.currentStep + 1 }));
        }, 500);
        return () => clearTimeout(timer);
    }, [state.isPlaying, state.currentStep, state.totalSteps]);

    // Visible executions based on current step
    const visibleExecutions = state.nodeExecutions.slice(0, state.currentStep);

    return {
        ...state,
        visibleExecutions,
        stepForward,
        stepBackward,
        jumpToStep,
        play,
        pause,
    };
}
