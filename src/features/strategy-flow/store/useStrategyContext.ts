/**
 * useStrategyContext — read/write view over the Start node's data.
 *
 * The Start node IS the source of truth for portfolio / tickers / capital /
 * mode. This hook is a thin selector + updater so the chip and modal can read
 * and edit those fields without touching ReactFlow plumbing directly.
 *
 * If you need to read the values, prefer `useStrategyContext(s => s.tickers)`
 * style selectors — they re-render only on the slice you read.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  useStrategyFlowStore,
  selectUpdateNodeData,
  selectAddNode,
  START_NODE_ID,
  START_NODE_POSITION,
} from './strategyFlowStore';
import type { TriggerNodeData, StrategyRunMode } from '../types';
import { START_NODE } from '../catalog/nodes/startNode';

export interface StrategyContextValue {
  portfolio: string;
  tickers: string[];
  capital: number;
  mode: StrategyRunMode;
  childTriggerType: string;
  /** True once a Start node exists on the canvas. */
  hasContext: boolean;
}

const EMPTY_CONTEXT: StrategyContextValue = {
  portfolio: '',
  tickers: [],
  capital: 10000,
  mode: 'paper',
  childTriggerType: 'manualTrigger',
  hasContext: false,
};

/**
 * Read the Strategy Context from the Start node, or `EMPTY_CONTEXT` if none yet.
 *
 * Uses `useShallow` so the returned object is shallow-compared between renders —
 * the selector builds a fresh object every call, but React only re-renders when
 * one of the fields actually changes.
 */
export const useStrategyContext = (): StrategyContextValue => {
  return useStrategyFlowStore(
    useShallow((state) => {
      const node = state.nodes.find((n) => n.id === START_NODE_ID);
      if (!node) return EMPTY_CONTEXT;
      const data = node.data as TriggerNodeData;
      return {
        portfolio: data.portfolio ?? '',
        tickers: data.tickers ?? [],
        capital: data.capital ?? 10000,
        mode: data.mode ?? 'paper',
        childTriggerType: data.childTriggerType ?? 'manualTrigger',
        hasContext: true,
      };
    }),
  );
};

/**
 * Mutate the Strategy Context. Creates the Start node on first call if it
 * doesn't exist yet (which is what the first-run modal needs).
 */
export const useStrategyContextActions = () => {
  const updateNodeData = useStrategyFlowStore(selectUpdateNodeData);
  const addNode = useStrategyFlowStore(selectAddNode);

  const ensureStartNode = useCallback(
    (initial: Partial<StrategyContextValue> = {}) => {
      const existing = useStrategyFlowStore.getState().nodes.find((n) => n.id === START_NODE_ID);
      if (existing) return;
      // addNode is special-cased in the store: catalog items whose `type` is
      // 'startTrigger' get id=START_NODE_ID and pinned position.
      addNode(START_NODE, START_NODE_POSITION);
      // Apply initial overrides after creation.
      if (Object.keys(initial).length > 0) {
        updateNodeData(START_NODE_ID, initial as Partial<TriggerNodeData>);
      }
    },
    [addNode, updateNodeData],
  );

  const updateContext = useCallback(
    (patch: Partial<StrategyContextValue>) => {
      ensureStartNode();
      updateNodeData(START_NODE_ID, patch as Partial<TriggerNodeData>);
    },
    [ensureStartNode, updateNodeData],
  );

  return { ensureStartNode, updateContext };
};
