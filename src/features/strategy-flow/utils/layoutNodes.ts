/**
 * Topological Sort + Layered Layout for Strategy Flow Nodes
 *
 * Produces a clean left-to-right DAG layout:
 * 1. Topologically sorts nodes using edges (Kahn's algorithm)
 * 2. Assigns each node to the deepest layer reachable from sources
 * 3. Positions nodes per-layer with even vertical spacing, no overlaps
 */

// ── Constants ────────────────────────────────────────────────

const LAYER_GAP_X = 260;   // horizontal gap between layers
const NODE_GAP_Y  = 160;   // vertical gap between nodes in a layer
const ORIGIN_X    = 80;    // left margin
const ORIGIN_Y    = 80;    // top margin
const NODE_WIDTH  = 200;   // approximate node width for centering
const NODE_HEIGHT = 80;    // approximate node height

// Fallback layer order when a node has no edges
const TYPE_LAYER_HINT: Record<string, number> = {
  environment: 0,
  indicator:   0,
  llm:         0,
  trigger:     0,
  math:        1,
  variable:    1,
  tradeInfo:   1,
  condition:   2,
  control:     3,
  risk:        3,
  pineScript:  3,
  action:      4,
  integration: 4,
  portfolio:   4,
};

// ── Types ────────────────────────────────────────────────────

interface MinimalNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data?: any;
  [key: string]: any;
}

interface MinimalEdge {
  id?: string;
  source: string;
  target: string;
  [key: string]: any;
}

// ── Topological Sort (Kahn's Algorithm) ──────────────────────

function topoSort(nodeIds: string[], edges: MinimalEdge[]): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    if (inDegree.has(edge.source) && inDegree.has(edge.target)) {
      adjacency.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  }

  // Start with all sources (in-degree 0)
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const neighbor of adjacency.get(node) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  // Append any remaining nodes (cycles or disconnected)
  for (const id of nodeIds) {
    if (!sorted.includes(id)) sorted.push(id);
  }

  return sorted;
}

// ── Layer Assignment (longest-path from sources) ─────────────

function assignLayers(
  nodeIds: string[],
  edges: MinimalEdge[],
  nodeMap: Map<string, MinimalNode>,
): Map<string, number> {
  const layer = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of nodeIds) {
    adjacency.set(id, []);
    inDegree.set(id, 0);
  }

  for (const edge of edges) {
    if (adjacency.has(edge.source) && inDegree.has(edge.target)) {
      adjacency.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  }

  // BFS longest-path: process in topological order
  const sorted = topoSort(nodeIds, edges);

  // Initialize layers: sources get layer 0, others get -1
  for (const id of nodeIds) {
    if ((inDegree.get(id) || 0) === 0) {
      // Use type hint for disconnected nodes
      const node = nodeMap.get(id);
      const typeHint = TYPE_LAYER_HINT[node?.type || ''] ?? 0;
      layer.set(id, typeHint);
    } else {
      layer.set(id, -1);
    }
  }

  // Forward pass: each node's layer = max(predecessors' layer) + 1
  for (const id of sorted) {
    const currentLayer = layer.get(id) ?? 0;
    for (const neighbor of adjacency.get(id) || []) {
      const existing = layer.get(neighbor) ?? -1;
      layer.set(neighbor, Math.max(existing, currentLayer + 1));
    }
  }

  // Handle any nodes that never got a layer (disconnected, no edges)
  for (const id of nodeIds) {
    if ((layer.get(id) ?? -1) < 0) {
      const node = nodeMap.get(id);
      layer.set(id, TYPE_LAYER_HINT[node?.type || ''] ?? 0);
    }
  }

  return layer;
}

// ── Main Layout Function ─────────────────────────────────────

/**
 * Topologically sort and layout nodes in a clean left-to-right DAG.
 *
 * Returns new node objects with updated `position` fields.
 * Edges are returned unchanged.
 */
export function layoutStrategyNodes<
  N extends MinimalNode = MinimalNode,
  E extends MinimalEdge = MinimalEdge,
>(
  nodes: N[],
  edges: E[],
): { nodes: N[]; edges: E[] } {
  if (nodes.length === 0) return { nodes, edges };
  if (nodes.length === 1) {
    return {
      nodes: [{ ...nodes[0], position: { x: ORIGIN_X, y: ORIGIN_Y } }],
      edges,
    };
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const nodeIds = nodes.map((n) => n.id);

  // 1. Assign layers via longest-path
  const layerMap = assignLayers(nodeIds, edges, nodeMap);

  // 2. Group nodes by layer
  const layerGroups = new Map<number, string[]>();
  for (const id of nodeIds) {
    const l = layerMap.get(id) ?? 0;
    if (!layerGroups.has(l)) layerGroups.set(l, []);
    layerGroups.get(l)!.push(id);
  }

  // 3. Sort layers numerically
  const sortedLayers = Array.from(layerGroups.keys()).sort((a, b) => a - b);

  // 4. Within each layer, sort nodes by type priority then label for consistency
  const typePriority: Record<string, number> = {
    environment: 0,
    indicator: 1,
    trigger: 2,
    llm: 3,
    math: 4,
    variable: 5,
    tradeInfo: 6,
    condition: 7,
    control: 8,
    risk: 9,
    action: 10,
    integration: 11,
    pineScript: 12,
    portfolio: 13,
  };

  for (const [, group] of layerGroups) {
    group.sort((a, b) => {
      const na = nodeMap.get(a)!;
      const nb = nodeMap.get(b)!;
      const pa = typePriority[na.type || ''] ?? 50;
      const pb = typePriority[nb.type || ''] ?? 50;
      if (pa !== pb) return pa - pb;
      const la = na.data?.label || na.id;
      const lb = nb.data?.label || nb.id;
      return la.localeCompare(lb);
    });
  }

  // 5. Compute max layer height for vertical centering
  const maxGroupSize = Math.max(...Array.from(layerGroups.values()).map((g) => g.length));
  const totalHeight = (maxGroupSize - 1) * NODE_GAP_Y;

  // 6. Assign positions
  const positionMap = new Map<string, { x: number; y: number }>();

  // Re-index layers to 0..n for compact x positioning
  const layerIndex = new Map<number, number>();
  sortedLayers.forEach((l, i) => layerIndex.set(l, i));

  for (const l of sortedLayers) {
    const group = layerGroups.get(l)!;
    const col = layerIndex.get(l)!;
    const x = ORIGIN_X + col * LAYER_GAP_X;

    // Center this group vertically relative to the tallest layer
    const groupHeight = (group.length - 1) * NODE_GAP_Y;
    const startY = ORIGIN_Y + (totalHeight - groupHeight) / 2;

    for (let i = 0; i < group.length; i++) {
      positionMap.set(group[i], {
        x,
        y: startY + i * NODE_GAP_Y,
      });
    }
  }

  // 7. Build output with topological order preserved
  const sorted = topoSort(nodeIds, edges);
  const layoutNodes = sorted.map((id) => {
    const original = nodeMap.get(id)!;
    const pos = positionMap.get(id) || { x: ORIGIN_X, y: ORIGIN_Y };
    return { ...original, position: pos };
  });

  return { nodes: layoutNodes, edges };
}
