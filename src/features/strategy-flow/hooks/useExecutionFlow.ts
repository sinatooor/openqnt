/**
 * useExecutionFlow - Orchestrates the visual execution trace across the canvas.
 *
 * When triggered it:
 *  1. Performs a topological sort of the graph starting from trigger/root nodes
 *  2. Walks through nodes one-by-one with configurable delays
 *  3. Updates the executionStore so nodes & edges animate in real-time
 *  4. Handles branching (IF/Switch) by only activating the taken path
 *  5. Supports pause / stop
 *
 * This is a *visual simulation* of execution, not a real backend execution.
 * In production mode the backend pushes updates via WebSocket and this hook
 * would be replaced by a listener that calls the same store methods.
 */

import { useCallback, useRef } from 'react';
import { useStrategyFlowStore } from '../store/strategyFlowStore';
import { useExecutionStore } from '../store/executionStore';
import type { StrategyFlowNode, StrategyFlowEdge } from '../types';

// Configurable timing (ms)
const EDGE_ANIMATE_MS = 400;   // How long an edge "runs" before the next node starts
const NODE_EXECUTE_MS = 600;   // Simulated node processing time
const SETTLE_MS = 200;         // Small pause after node finishes before moving on

// Helper: sleep that can be cancelled
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

/**
 * Build an adjacency list and find root nodes (no incoming edges).
 */
function buildGraph(nodes: StrategyFlowNode[], edges: StrategyFlowEdge[]) {
  const adjacency = new Map<string, { edge: StrategyFlowEdge; target: string }[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    const list = adjacency.get(edge.source);
    if (list) list.push({ edge, target: edge.target });
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Root nodes: trigger nodes first, then any node with 0 in-degree
  const roots: string[] = [];
  const triggerTypes = new Set(['trigger']);

  // Prioritize trigger nodes
  for (const node of nodes) {
    if (triggerTypes.has(node.type || '') && (inDegree.get(node.id) || 0) === 0) {
      roots.push(node.id);
    }
  }

  // Then any other node with 0 in-degree (if no triggers exist)
  for (const node of nodes) {
    if ((inDegree.get(node.id) || 0) === 0 && !roots.includes(node.id)) {
      roots.push(node.id);
    }
  }

  return { adjacency, inDegree, roots };
}

/**
 * Simulate what branch an IF/Switch node takes.
 * In a real scenario this would come from backend execution data.
 * For the visual simulation we randomly pick a branch or default to the first.
 */
function simulateBranch(
  node: StrategyFlowNode,
  outEdges: { edge: StrategyFlowEdge; target: string }[],
): { takenEdges: typeof outEdges; skippedEdges: typeof outEdges; takenBranch: string | null } {
  const controlType = (node.data as Record<string, unknown>)?.controlType as string | undefined;
  const conditionType = (node.data as Record<string, unknown>)?.conditionType as string | undefined;

  // Only branch for control/condition nodes with multiple outputs
  if (outEdges.length <= 1 || (!controlType && !conditionType)) {
    return { takenEdges: outEdges, skippedEdges: [], takenBranch: null };
  }

  // IF / IF-ELSE nodes: pick one branch
  if (controlType === 'if' || controlType === 'ifElse' || conditionType) {
    // Group by sourceHandle
    const byHandle = new Map<string, typeof outEdges>();
    for (const e of outEdges) {
      const handle = e.edge.sourceHandle || 'default';
      if (!byHandle.has(handle)) byHandle.set(handle, []);
      byHandle.get(handle)!.push(e);
    }

    const handles = Array.from(byHandle.keys());
    // Simulate: randomly pick true or first handle
    const takenHandle = handles[Math.random() > 0.5 ? 0 : Math.min(1, handles.length - 1)];

    const taken: typeof outEdges = [];
    const skipped: typeof outEdges = [];

    for (const [handle, edges] of byHandle) {
      if (handle === takenHandle) {
        taken.push(...edges);
      } else {
        skipped.push(...edges);
      }
    }

    return { takenEdges: taken, skippedEdges: skipped, takenBranch: takenHandle };
  }

  return { takenEdges: outEdges, skippedEdges: [], takenBranch: null };
}

/**
 * Simulate node execution result.
 * Returns mock input/output data for the execution data panel.
 */
function simulateNodeExecution(node: StrategyFlowNode): {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  items: number;
  shouldError: boolean;
} {
  const label = node.data.label;
  const type = node.type || 'unknown';

  // ~5% chance of error for demo purposes
  const shouldError = Math.random() < 0.05;

  const items = type === 'trigger' ? 1 : Math.floor(Math.random() * 10) + 1;

  return {
    input: {
      source: 'upstream',
      timestamp: new Date().toISOString(),
      type,
    },
    output: {
      result: shouldError ? null : `${label} output`,
      items,
      value: shouldError ? null : +(Math.random() * 100).toFixed(2),
      signal: type === 'condition' ? (Math.random() > 0.5 ? 'true' : 'false') : undefined,
    },
    items,
    shouldError,
  };
}

// =============================================================================
// HOOK
// =============================================================================

export function useExecutionFlow() {
  const abortRef = useRef<AbortController | null>(null);

  const startExecution = useCallback(async () => {
    // Abort any previous run
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    const { nodes, edges } = useStrategyFlowStore.getState();
    const exec = useExecutionStore.getState();

    if (nodes.length === 0) return;

    // Start
    exec.startExecution();
    useStrategyFlowStore.getState().setIsRunning(true);

    const { adjacency, roots } = buildGraph(nodes, edges);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // BFS / topological traversal
    const queue: string[] = [...roots];
    const visited = new Set<string>();

    try {
      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        const node = nodeMap.get(nodeId);
        if (!node) continue;

        // 1. Mark node as running
        exec.setNodeRunning(nodeId);

        // 2. Simulate execution delay
        await sleep(NODE_EXECUTE_MS + Math.random() * 400, signal);

        // 3. Simulate result
        const { input, output, items, shouldError } = simulateNodeExecution(node);

        if (shouldError) {
          exec.setNodeError(nodeId, `Simulated error in ${node.data.label}`);
          // Don't continue down this branch
          continue;
        }

        // 4. Determine branching
        const outEdges = adjacency.get(nodeId) || [];
        const { takenEdges, skippedEdges, takenBranch } = simulateBranch(node, outEdges);

        // 5. Mark node as success
        exec.setNodeSuccess(nodeId, output, input, items, takenBranch);

        // 6. Mark skipped edges' target nodes as skipped
        for (const { edge, target } of skippedEdges) {
          exec.setNodeSkipped(target);
          visited.add(target);
        }

        // 7. Animate taken edges and queue their targets
        for (const { edge, target } of takenEdges) {
          // Show edge as "running" (pulse animation)
          exec.setEdgeRunning(edge.id);
          await sleep(EDGE_ANIMATE_MS, signal);

          // Mark edge as completed
          exec.clearEdgeRunning(edge.id);
          exec.setEdgeActive(edge.id, items);

          await sleep(SETTLE_MS, signal);

          // Queue the target node (if not already visited)
          if (!visited.has(target)) {
            queue.push(target);
          }
        }
      }

      // Execution complete
      exec.completeExecution();
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // User stopped execution
        exec.completeExecution();
      } else {
        throw e;
      }
    } finally {
      useStrategyFlowStore.getState().setIsRunning(false);
    }
  }, []);

  const stopExecution = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const resetExecution = useCallback(() => {
    abortRef.current?.abort();
    useExecutionStore.getState().resetExecution();
    useStrategyFlowStore.getState().setIsRunning(false);
  }, []);

  return { startExecution, stopExecution, resetExecution };
}
