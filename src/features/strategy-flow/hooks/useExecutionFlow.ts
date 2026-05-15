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
import { computeKernel } from '../runtime/computeKernel';
import { createEvalContext, evaluateNode, type EvalContext, type NodeEvalResult } from '../runtime/browserInterpreter';

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
 * Determine branching for IF / Switch / Condition nodes using the real
 * evaluation result. For condition nodes (output: boolean), traverse all
 * edges from the `output` handle (downstream nodes use the value). For
 * if/ifElse/switch (multi-output control), traverse only the matching
 * source handle.
 */
function selectBranch(
  node: StrategyFlowNode,
  outEdges: { edge: StrategyFlowEdge; target: string }[],
  result: NodeEvalResult,
): { takenEdges: typeof outEdges; skippedEdges: typeof outEdges; takenBranch: string | null } {
  const controlType = (node.data as Record<string, unknown>)?.controlType as string | undefined;

  if (outEdges.length === 0) return { takenEdges: [], skippedEdges: [], takenBranch: null };

  // if / ifElse / switch — branch on result.branch (then/else or case-N).
  if (controlType === 'if' || controlType === 'ifElse' || controlType === 'switch') {
    const taken: typeof outEdges = [];
    const skipped: typeof outEdges = [];
    for (const e of outEdges) {
      const handle = e.edge.sourceHandle || 'output';
      if (handle === result.branch) taken.push(e);
      else skipped.push(e);
    }
    // If we matched nothing (graph mismatch), fall through to all edges.
    if (taken.length === 0) return { takenEdges: outEdges, skippedEdges: [], takenBranch: result.branch ?? null };
    return { takenEdges: taken, skippedEdges: skipped, takenBranch: result.branch ?? null };
  }

  // Condition node — if the boolean output is false, downstream actions
  // shouldn't fire. Skip outgoing edges when result is falsy.
  if (node.type === 'condition') {
    if (result.value === false) {
      return { takenEdges: [], skippedEdges: outEdges, takenBranch: 'false' };
    }
    return { takenEdges: outEdges, skippedEdges: [], takenBranch: 'true' };
  }

  // Default: traverse all outgoing edges.
  return { takenEdges: outEdges, skippedEdges: [], takenBranch: null };
}

/**
 * Run a node through the browser interpreter and reshape the result for
 * the canvas overlay (input/output records). Real values flow through —
 * no random numbers.
 */
function runNodeReal(
  node: StrategyFlowNode,
  ctx: EvalContext,
  edges: StrategyFlowEdge[],
): {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  items: number;
  result: NodeEvalResult;
  waitMs: number | null;
} {
  const type = node.type || 'unknown';

  // Gather actual input values from connected upstream outputs.
  const input: Record<string, unknown> = {};
  for (const e of edges) {
    if (e.target !== node.id) continue;
    const v = ctx.outputs.get(`${e.source}:${e.sourceHandle || 'output'}`);
    if (v !== undefined) input[e.targetHandle || 'in'] = v;
  }

  const result = evaluateNode(node, ctx, edges);

  // Durable Wait: extract wait time from control node config.
  let waitMs: number | null = null;
  if (type === 'control') {
    const controlType = (node.data as Record<string, unknown>)?.controlType as string;
    if (controlType === 'wait' || controlType === 'waitUntil') {
      const waitSeconds = (node.data as Record<string, unknown>)?.waitSeconds as number ?? 1;
      waitMs = Math.min(Math.max(0.1, waitSeconds) * 1000, 30_000);
    }
  }

  return {
    input,
    output: {
      ...result.handles,
      value: result.value,
      display: result.display,
    },
    items: 1,
    result,
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
  edges: StrategyFlowEdge[],
  nodeMap: Map<string, StrategyFlowNode>,
  exec: ReturnType<typeof useExecutionStore.getState>,
  ctx: EvalContext,
  signal: AbortSignal,
): Promise<void> {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);

  const node = nodeMap.get(nodeId);
  if (!node) return;

  // Skip pinned nodes — use frozen output
  if (exec.nodeStates[nodeId]?.isPinned) {
    return;
  }

  exec.setNodeRunning(nodeId);

  const { waitMs, input, output, items, result } = runNodeReal(node, ctx, edges);

  if (waitMs !== null) {
    exec.setNodeWaiting(nodeId);
    const resumeAt = Date.now() + waitMs;
    const key = `wait-resume-${nodeId}`;
    localStorage.setItem(key, String(resumeAt));
    await sleep(waitMs, signal);
    localStorage.removeItem(key);
  } else {
    await sleep(NODE_EXECUTE_MS, signal);
  }

  const outEdges = adjacency.get(nodeId) || [];
  const { takenEdges, skippedEdges, takenBranch } = selectBranch(node, outEdges, result);

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

    await traverseV1(target, visited, adjacency, edges, nodeMap, exec, ctx, signal);
  }
}

/**
 * BFS traversal (legacy v0 — interleaved branches).
 */
async function traverseV0(
  roots: string[],
  visited: Set<string>,
  adjacency: Map<string, { edge: StrategyFlowEdge; target: string }[]>,
  edges: StrategyFlowEdge[],
  nodeMap: Map<string, StrategyFlowNode>,
  exec: ReturnType<typeof useExecutionStore.getState>,
  ctx: EvalContext,
  signal: AbortSignal,
): Promise<void> {
  const queue: string[] = [...roots];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) continue;

    if (exec.nodeStates[nodeId]?.isPinned) continue;

    exec.setNodeRunning(nodeId);

    const { waitMs, input, output, items, result } = runNodeReal(node, ctx, edges);

    if (waitMs !== null) {
      exec.setNodeWaiting(nodeId);
      const resumeAt = Date.now() + waitMs;
      localStorage.setItem(`wait-resume-${nodeId}`, String(resumeAt));
      await sleep(waitMs, signal);
      localStorage.removeItem(`wait-resume-${nodeId}`);
    } else {
      await sleep(NODE_EXECUTE_MS, signal);
    }

    const outEdges = adjacency.get(nodeId) || [];
    const { takenEdges, skippedEdges, takenBranch } = selectBranch(node, outEdges, result);

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

    // Ensure the WASM-shaped compute kernel is initialized before we start.
    await computeKernel.init();

    const { adjacency, roots } = buildGraph(nodes, edges);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const visited = new Set<string>();

    // Build a shared evaluation context for this run. Pull the strategy
    // ticker from the Start node (or first data source) so synthetic
    // candles match what the user configured.
    const startNode = nodes.find((n) => (n.data as any)?.triggerType === 'startTrigger');
    const dataSourceNode = nodes.find((n) => n.type === 'dataSource');
    const ticker =
      ((startNode?.data as any)?.tickers?.[0] as string) ||
      ((dataSourceNode?.data as any)?.symbol as string) ||
      'SPY';
    const ctx = createEvalContext(ticker);

    let finalPhase: 'completed' | 'error' = 'completed';

    try {
      if (executionOrder === 'v1') {
        // v1: DFS — run one branch fully before starting next
        for (const root of roots) {
          await traverseV1(root, visited, adjacency, edges, nodeMap, exec, ctx, signal);
        }
      } else {
        // v0: BFS — interleaved branches (legacy)
        await traverseV0(roots, visited, adjacency, edges, nodeMap, exec, ctx, signal);
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
