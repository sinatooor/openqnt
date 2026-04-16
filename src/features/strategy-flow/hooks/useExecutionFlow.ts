/**
 * useExecutionFlow - Orchestrates the visual execution trace across the canvas.
 *
 * Features added over the original:
 *  - Execution order: v1 (one branch fully before next) vs v0 (legacy BFS interleaved)
 *  - Pinned node skipping: if a node is pinned its frozen output is reused, not re-run
 *  - Execution history: every completed run is persisted to executionHistoryStore
 *  - Durable Wait: Wait/WaitUntil nodes pause for their configured duration, tracked
 *    via localStorage so a page refresh can resume the countdown
 *  - History recording: startHistoryEntry / finalizeHistoryEntry wired in
 */

import { useCallback, useRef } from 'react';
import { useStrategyFlowStore } from '../store/strategyFlowStore';
import { useExecutionStore } from '../store/executionStore';
import { startHistoryEntry, finalizeHistoryEntry } from '../store/executionHistoryStore';
import type { StrategyFlowNode, StrategyFlowEdge } from '../types';

// ---------------------------------------------------------------------------
// Configurable timing (ms)
// ---------------------------------------------------------------------------

const EDGE_ANIMATE_MS = 400;
const NODE_EXECUTE_MS = 600;
const SETTLE_MS = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

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

  // Root nodes: trigger nodes first, then any with 0 in-degree
  const roots: string[] = [];
  for (const node of nodes) {
    if (node.type === 'trigger' && (inDegree.get(node.id) || 0) === 0) {
      roots.push(node.id);
    }
  }
  for (const node of nodes) {
    if ((inDegree.get(node.id) || 0) === 0 && !roots.includes(node.id)) {
      roots.push(node.id);
    }
  }

  return { adjacency, inDegree, roots };
}

/**
 * Determine branching for IF/Switch/Condition nodes.
 * Returns which edges to traverse and which to skip.
 */
function simulateBranch(
  node: StrategyFlowNode,
  outEdges: { edge: StrategyFlowEdge; target: string }[],
): { takenEdges: typeof outEdges; skippedEdges: typeof outEdges; takenBranch: string | null } {
  const controlType = (node.data as Record<string, unknown>)?.controlType as string | undefined;
  const conditionType = (node.data as Record<string, unknown>)?.conditionType as string | undefined;

  if (outEdges.length <= 1 || (!controlType && !conditionType)) {
    return { takenEdges: outEdges, skippedEdges: [], takenBranch: null };
  }

  if (controlType === 'if' || controlType === 'ifElse' || conditionType) {
    const byHandle = new Map<string, typeof outEdges>();
    for (const e of outEdges) {
      const handle = e.edge.sourceHandle || 'default';
      if (!byHandle.has(handle)) byHandle.set(handle, []);
      byHandle.get(handle)!.push(e);
    }
    const handles = Array.from(byHandle.keys());
    const takenHandle = handles[Math.random() > 0.5 ? 0 : Math.min(1, handles.length - 1)];

    const taken: typeof outEdges = [];
    const skipped: typeof outEdges = [];
    for (const [handle, edges] of byHandle) {
      (handle === takenHandle ? taken : skipped).push(...edges);
    }
    return { takenEdges: taken, skippedEdges: skipped, takenBranch: takenHandle };
  }

  return { takenEdges: outEdges, skippedEdges: [], takenBranch: null };
}

function simulateNodeExecution(node: StrategyFlowNode): {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  items: number;
  shouldError: boolean;
  waitMs: number | null;
} {
  const label = node.data.label;
  const type = node.type || 'unknown';
  const shouldError = Math.random() < 0.05;
  const items = type === 'trigger' ? 1 : Math.floor(Math.random() * 10) + 1;

  // Durable Wait: extract wait time from control node
  let waitMs: number | null = null;
  if (type === 'control') {
    const controlType = (node.data as Record<string, unknown>)?.controlType as string;
    if (controlType === 'wait' || controlType === 'waitUntil') {
      const waitSeconds = (node.data as Record<string, unknown>)?.waitSeconds as number ?? 1;
      waitMs = Math.min(waitSeconds * 1000, 30_000); // Cap at 30s for simulation
    }
  }

  return {
    input: { source: 'upstream', timestamp: new Date().toISOString(), type },
    output: {
      result: shouldError ? null : `${label} output`,
      items,
      value: shouldError ? null : +(Math.random() * 100).toFixed(2),
      signal: type === 'condition' ? (Math.random() > 0.5 ? 'true' : 'false') : undefined,
    },
    items,
    shouldError,
    waitMs,
  };
}

// ---------------------------------------------------------------------------
// Core traversal
// ---------------------------------------------------------------------------

/**
 * Execute a single node and its downstream graph.
 * v1 mode: depth-first (one branch fully before another).
 * v0 mode: breadth-first (interleaved branches).
 */
async function traverseV1(
  nodeId: string,
  visited: Set<string>,
  adjacency: Map<string, { edge: StrategyFlowEdge; target: string }[]>,
  nodeMap: Map<string, StrategyFlowNode>,
  exec: ReturnType<typeof useExecutionStore.getState>,
  signal: AbortSignal,
): Promise<void> {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);

  const node = nodeMap.get(nodeId);
  if (!node) return;

  // Skip pinned nodes — use frozen output
  if (exec.nodeStates[nodeId]?.isPinned) {
    // Keep existing state, just mark as success with pin notation
    return;
  }

  // Handle durable Wait node
  const { waitMs, shouldError, input, output, items } = simulateNodeExecution(node);

  exec.setNodeRunning(nodeId);

  if (waitMs !== null) {
    exec.setNodeWaiting(nodeId);
    // Persist resume time for durable wait
    const resumeAt = Date.now() + waitMs;
    const key = `wait-resume-${nodeId}`;
    localStorage.setItem(key, String(resumeAt));
    await sleep(waitMs, signal);
    localStorage.removeItem(key);
  } else {
    await sleep(NODE_EXECUTE_MS + Math.random() * 400, signal);
  }

  if (shouldError) {
    exec.setNodeError(nodeId, `Simulated error in ${node.data.label}`);
    return;
  }

  const outEdges = adjacency.get(nodeId) || [];
  const { takenEdges, skippedEdges, takenBranch } = simulateBranch(node, outEdges);

  exec.setNodeSuccess(nodeId, output, input, items, takenBranch);

  // Mark skipped
  for (const { target } of skippedEdges) {
    exec.setNodeSkipped(target);
    visited.add(target);
  }

  // Animate edges then recurse (DFS — one branch fully before next)
  for (const { edge, target } of takenEdges) {
    exec.setEdgeRunning(edge.id);
    await sleep(EDGE_ANIMATE_MS, signal);
    exec.clearEdgeRunning(edge.id);
    exec.setEdgeActive(edge.id, items);
    await sleep(SETTLE_MS, signal);

    await traverseV1(target, visited, adjacency, nodeMap, exec, signal);
  }
}

/**
 * BFS traversal (legacy v0 — interleaved branches).
 */
async function traverseV0(
  roots: string[],
  visited: Set<string>,
  adjacency: Map<string, { edge: StrategyFlowEdge; target: string }[]>,
  nodeMap: Map<string, StrategyFlowNode>,
  exec: ReturnType<typeof useExecutionStore.getState>,
  signal: AbortSignal,
): Promise<void> {
  const queue: string[] = [...roots];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) continue;

    // Skip pinned
    if (exec.nodeStates[nodeId]?.isPinned) continue;

    const { waitMs, shouldError, input, output, items } = simulateNodeExecution(node);

    exec.setNodeRunning(nodeId);

    if (waitMs !== null) {
      exec.setNodeWaiting(nodeId);
      const resumeAt = Date.now() + waitMs;
      localStorage.setItem(`wait-resume-${nodeId}`, String(resumeAt));
      await sleep(waitMs, signal);
      localStorage.removeItem(`wait-resume-${nodeId}`);
    } else {
      await sleep(NODE_EXECUTE_MS + Math.random() * 400, signal);
    }

    if (shouldError) {
      exec.setNodeError(nodeId, `Simulated error in ${node.data.label}`);
      continue;
    }

    const outEdges = adjacency.get(nodeId) || [];
    const { takenEdges, skippedEdges, takenBranch } = simulateBranch(node, outEdges);

    exec.setNodeSuccess(nodeId, output, input, items, takenBranch);

    for (const { target } of skippedEdges) {
      exec.setNodeSkipped(target);
      visited.add(target);
    }

    for (const { edge, target } of takenEdges) {
      exec.setEdgeRunning(edge.id);
      await sleep(EDGE_ANIMATE_MS, signal);
      exec.clearEdgeRunning(edge.id);
      exec.setEdgeActive(edge.id, items);
      await sleep(SETTLE_MS, signal);

      if (!visited.has(target)) queue.push(target);
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useExecutionFlow() {
  const abortRef = useRef<AbortController | null>(null);

  const startExecution = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    const {
      nodes,
      edges,
      workflowId,
      strategyName,
      executionOrder,
    } = useStrategyFlowStore.getState();
    const exec = useExecutionStore.getState();

    if (nodes.length === 0) return;

    // Find trigger node id (for history)
    const triggerNode = nodes.find((n) => n.type === 'trigger');

    // Start history entry
    const historyId = workflowId
      ? startHistoryEntry(workflowId, strategyName, executionOrder, triggerNode?.id ?? null)
      : null;

    exec.startExecution();
    useStrategyFlowStore.getState().setIsRunning(true);

    const { adjacency, roots } = buildGraph(nodes, edges);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const visited = new Set<string>();

    let finalPhase: 'completed' | 'error' = 'completed';

    try {
      if (executionOrder === 'v1') {
        // v1: DFS — run one branch fully before starting next
        for (const root of roots) {
          await traverseV1(root, visited, adjacency, nodeMap, exec, signal);
        }
      } else {
        // v0: BFS — interleaved branches (legacy)
        await traverseV0(roots, visited, adjacency, nodeMap, exec, signal);
      }

      exec.completeExecution();
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        exec.completeExecution();
      } else {
        finalPhase = 'error';
        throw e;
      }
    } finally {
      useStrategyFlowStore.getState().setIsRunning(false);

      // Persist history
      if (historyId) {
        const finalExec = useExecutionStore.getState();
        finalizeHistoryEntry(
          historyId,
          finalExec.nodeStates,
          finalExec.executionOrder,
          finalPhase,
        );
      }
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
