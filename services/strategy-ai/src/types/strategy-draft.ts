/**
 * StrategyDraft — the working copy the Builder agent edits.
 *
 * Identical shape to what `useStrategyFlowStore` consumes in the frontend:
 * `{ nodes: ReactFlowNode[], edges: ReactFlowEdge[], settings }`. No XML, no
 * Blockly workspace, no DSL transpile step. `submit()` returns this object
 * verbatim and Python forwards it to the canvas as SSE events.
 *
 * IMPORTANT: keep this in sync with
 * `src/features/strategy-flow/types.ts:StrategyFlowNode`.
 */

export interface StrategyDraftNode {
  /** Stable id. The Start node is always `"start"`; others use a unique slug. */
  id: string;
  /** Top-level node type (matches React Flow `nodeType` keys: indicator, trigger, ...). */
  type: string;
  /** Canvas position. `{x: 0, y: 0}` is the default; the layout engine repositions on save. */
  position: { x: number; y: number };
  /**
   * Node payload. Always includes `label` and `description`; remaining keys depend
   * on the node sub-type (e.g. `indicatorType: 'rsi'`, `params: { period: 14 }`).
   */
  data: Record<string, unknown>;
  /** React Flow flags — used for the Start node to pin / lock it. */
  deletable?: boolean;
  draggable?: boolean;
}

export interface StrategyDraftEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  animated?: boolean;
  style?: Record<string, unknown>;
}

export interface StrategyDraftSettings {
  name?: string;
  description?: string;
  allowCycles?: boolean;
  /** Mirrors the Strategy Context Start node when present. Source of truth: the Start node itself. */
  context?: {
    portfolio?: string;
    tickers?: string[];
    capital?: number;
    mode?: 'paper' | 'live' | 'backtest';
  };
}

export interface StrategyDraft {
  nodes: StrategyDraftNode[];
  edges: StrategyDraftEdge[];
  settings: StrategyDraftSettings;
}

export const EMPTY_DRAFT: StrategyDraft = {
  nodes: [],
  edges: [],
  settings: {},
};

/** Stable id used for the Strategy Context Start node. */
export const START_NODE_ID = 'start';

/** Helpers — keep the draft mutations centralized so we never violate invariants. */

export const findNode = (draft: StrategyDraft, id: string): StrategyDraftNode | undefined =>
  draft.nodes.find((n) => n.id === id);

export const findEdge = (draft: StrategyDraft, id: string): StrategyDraftEdge | undefined =>
  draft.edges.find((e) => e.id === id);

/** Generates a short, stable-ish id from a type and a counter. */
export const newId = (type: string, draft: StrategyDraft): string => {
  let i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = `${type}-${i}`;
    if (!findNode(draft, candidate)) return candidate;
    i++;
  }
};
