/**
 * Builder agent tools.
 *
 * Each tool mutates the working-copy `StrategyDraft` (ReactFlow JSON shape) or
 * calls the Python backend for validate/verify/catalog. Zod schemas double as
 * runtime parameter validation and as the parameter spec sent to the LLM
 * provider via the Vercel AI SDK.
 *
 * Submit terminates the run by returning the final draft from `runBuilder()`.
 */

import { z } from 'zod';
import { tool } from 'ai';
import {
  type StrategyDraft,
  type StrategyDraftNode,
  type StrategyDraftEdge,
  START_NODE_ID,
  findNode,
  findEdge,
  newId,
} from '../types/strategy-draft';
import type { PythonBridge, CatalogNode, DryRunResponse, VerifyMockResponse } from '../python-bridge';

/**
 * The handle topology the LLM uses when calling connect(). Served by the
 * Python `/catalog` endpoint as an embedded `handles` field on each node,
 * sourced from the frontend's `getHandleConfigs` via
 * `scripts/extract-handle-configs.ts`. Single source of truth = frontend.
 */
export interface HandleConfig {
  id: string;
  type: 'target' | 'source';
  position: 'left' | 'right';
  label: string;
  dataType?: string;
}

// ── State held across tool calls within a single agent run ──────────────────

export interface BuilderState {
  draft: StrategyDraft;
  /** failureSignature -> times seen. Used by the loop guard. */
  seenFailures: Map<string, number>;
  /** validate() call count this run. Budgeted by the loop. */
  validateCount: number;
  /** Final draft if the agent called submit(). Terminates the loop. */
  submitted?: { draft: StrategyDraft; summary: string };
  /** Optional event emitter for streaming tool-call telemetry to the UI. */
  onEvent?: (event: BuilderEvent) => void;
}

export type BuilderEvent =
  | { kind: 'node_added'; node: StrategyDraftNode }
  | { kind: 'node_updated'; nodeId: string; patch: Record<string, unknown> }
  | { kind: 'node_deleted'; nodeId: string }
  | { kind: 'edge_added'; edge: StrategyDraftEdge }
  | { kind: 'edge_deleted'; edgeId: string }
  | { kind: 'validation_attempt'; result: DryRunResponse }
  | { kind: 'verification_result'; result: VerifyMockResponse }
  | { kind: 'failure_signature_repeat'; signature: string; count: number }
  | { kind: 'submit'; summary: string };

const emit = (state: BuilderState, e: BuilderEvent) => state.onEvent?.(e);

// ── Catalog cache shared across tools in one run ───────────────────────────

/** A catalog node enriched with the real handle topology the canvas uses. */
export type EnrichedCatalogNode = CatalogNode & {
  /**
   * Authoritative handle list (id, type, position, label, dataType).
   * `id` is the value the LLM should pass to `connect()` as
   * sourceHandle / targetHandle.
   */
  handles: HandleConfig[];
};

export interface CatalogIndex {
  /** flat type -> EnrichedCatalogNode lookup */
  byType: Map<string, EnrichedCatalogNode>;
  /** raw response for full-listing tools (enriched too) */
  raw: Record<string, EnrichedCatalogNode[]>;
}

/**
 * Adopt the server-provided `handles` field on each catalog node. The Python
 * `/catalog` endpoint embeds it (sourced from the frontend's
 * `getHandleConfigs` via `scripts/extract-handle-configs.ts`). If the server
 * omits the field — e.g. talking to an older backend — we fall back to an
 * empty array and let `connect()` auto-fill handles. We deliberately do NOT
 * recompute handles here; one source of truth on the backend.
 */
const adoptHandles = (n: CatalogNode): EnrichedCatalogNode => ({
  ...n,
  handles: Array.isArray((n as { handles?: HandleConfig[] }).handles)
    ? ((n as { handles: HandleConfig[] }).handles)
    : [],
});

export const buildCatalogIndex = (raw: Record<string, CatalogNode[]>): CatalogIndex => {
  const enrichedRaw: Record<string, EnrichedCatalogNode[]> = {};
  const byType = new Map<string, EnrichedCatalogNode>();
  for (const [cat, arr] of Object.entries(raw)) {
    enrichedRaw[cat] = [];
    for (const n of arr) {
      const enriched = adoptHandles(n);
      enrichedRaw[cat]!.push(enriched);
      byType.set(n.type, enriched);
    }
  }
  return { byType, raw: enrichedRaw };
};

// ── Tool definitions ───────────────────────────────────────────────────────

export const createBuilderTools = (
  state: BuilderState,
  catalog: CatalogIndex,
  bridge: PythonBridge,
) => ({
  lookup_node_schema: tool({
    description:
      'Return the full schema for a catalog node type — including `handles` (the authoritative handle ids the canvas uses for connect()), `defaultData`, and metadata. Call this BEFORE adding any node whose handle topology you are not sure of. The handle `id` field is what you pass as `sourceHandle` / `targetHandle` in connect() — labels are display-only.',
    parameters: z.object({
      type: z.string().describe('Node type to look up, e.g. "rsi", "order", "switch", "expression", "conditionTrigger".'),
    }),
    execute: async ({ type }) => {
      const node = catalog.byType.get(type);
      if (!node) return { error: `unknown node type: ${type}`, similar: suggest(type, catalog) };
      // Project a minimal, LLM-friendly shape that emphasises handles + defaultData.
      return {
        type: node.type,
        nodeType: node.nodeType,
        label: node.label,
        description: node.description,
        category: node.category,
        defaultData: node.defaultData,
        handles: {
          inputs: node.handles.filter((h) => h.type === 'target').map((h) => ({ id: h.id, label: h.label, dataType: h.dataType })),
          outputs: node.handles.filter((h) => h.type === 'source').map((h) => ({ id: h.id, label: h.label, dataType: h.dataType })),
        },
      };
    },
  }),

  list_node_types: tool({
    description:
      'List available node types, optionally filtered by category (action, indicator, condition, control, math, integration, trigger, dataSource, ...). Use for discovery when the right node type is unclear. Use this BEFORE inventing a node type that may not exist.',
    parameters: z.object({
      category: z.string().optional().describe('Optional category filter (e.g. "indicator", "trigger", "dataSource").'),
    }),
    execute: async ({ category }) => {
      if (category) {
        return (catalog.raw[category] ?? []).map((n) => ({ type: n.type, label: n.label, description: n.description }));
      }
      return Object.fromEntries(
        Object.entries(catalog.raw).map(([k, v]) => [k, v.map((n) => n.type)]),
      );
    },
  }),

  add_node: tool({
    description:
      'Add a new node to the draft. The catalog is the source of truth for default params — pass `params` only for fields the user explicitly mentioned. The Start node (type "startTrigger", id "start") is managed by the UI; do not add it.',
    parameters: z.object({
      type: z.string().describe('Catalog node type (e.g. "rsi", "order").'),
      params: z.record(z.unknown()).optional().describe('Param overrides. Merged onto catalog defaultData.'),
      id: z.string().optional().describe('Optional explicit id. If omitted, a deterministic id is generated.'),
    }),
    execute: async ({ type, params, id }) => {
      if (type === 'startTrigger') {
        return { error: 'Start node is managed by the UI. Do not add it via tools.' };
      }
      const def = catalog.byType.get(type);
      if (!def) return { error: `unknown node type: ${type}` };
      const nodeId = id ?? newId(type, state.draft);
      if (findNode(state.draft, nodeId)) return { error: `id already exists: ${nodeId}` };
      const node: StrategyDraftNode = {
        id: nodeId,
        type: def.nodeType,
        position: { x: 0, y: 0 },
        data: {
          label: def.label,
          description: def.description,
          ...(def.defaultData ?? {}),
          ...(params ?? {}),
        },
      };
      state.draft.nodes.push(node);
      emit(state, { kind: 'node_added', node });
      return { ok: true, id: nodeId };
    },
  }),

  update_node: tool({
    description: 'Patch an existing node\'s data fields. Use for parameter changes; do not change the node type.',
    parameters: z.object({
      id: z.string(),
      patch: z.record(z.unknown()).describe('Shallow merge into the node\'s data object.'),
    }),
    execute: async ({ id, patch }) => {
      const node = findNode(state.draft, id);
      if (!node) return { error: `no such node: ${id}` };
      if (id === START_NODE_ID) {
        return { error: 'Start node properties are user-managed; do not edit via tools.' };
      }
      Object.assign(node.data, patch);
      emit(state, { kind: 'node_updated', nodeId: id, patch });
      return { ok: true };
    },
  }),

  delete_node: tool({
    description: 'Remove a node and all edges that touch it. Refuses to delete the Start node.',
    parameters: z.object({ id: z.string() }),
    execute: async ({ id }) => {
      if (id === START_NODE_ID) return { error: 'Start node cannot be deleted.' };
      const idx = state.draft.nodes.findIndex((n) => n.id === id);
      if (idx < 0) return { error: `no such node: ${id}` };
      state.draft.nodes.splice(idx, 1);
      const before = state.draft.edges.length;
      state.draft.edges = state.draft.edges.filter((e) => e.source !== id && e.target !== id);
      emit(state, { kind: 'node_deleted', nodeId: id });
      return { ok: true, edgesRemoved: before - state.draft.edges.length };
    },
  }),

  connect: tool({
    description:
      'Add an edge from source.outputHandle to target.inputHandle. If handles are omitted, the canvas auto-fills with the only/default handle.',
    parameters: z.object({
      source: z.string(),
      target: z.string(),
      sourceHandle: z.string().optional(),
      targetHandle: z.string().optional(),
    }),
    execute: async ({ source, target, sourceHandle, targetHandle }) => {
      if (!findNode(state.draft, source)) return { error: `no source node: ${source}` };
      if (!findNode(state.draft, target)) return { error: `no target node: ${target}` };
      const edgeId = `edge-${state.draft.edges.length + 1}-${Math.random().toString(36).slice(2, 6)}`;
      const edge: StrategyDraftEdge = { id: edgeId, source, target, sourceHandle, targetHandle, type: 'bezier' };
      state.draft.edges.push(edge);
      emit(state, { kind: 'edge_added', edge });
      return { ok: true, id: edgeId };
    },
  }),

  disconnect: tool({
    description: 'Remove an edge by id.',
    parameters: z.object({ edgeId: z.string() }),
    execute: async ({ edgeId }) => {
      if (!findEdge(state.draft, edgeId)) return { error: `no such edge: ${edgeId}` };
      state.draft.edges = state.draft.edges.filter((e) => e.id !== edgeId);
      emit(state, { kind: 'edge_deleted', edgeId });
      return { ok: true };
    },
  }),

  validate: tool({
    description:
      'Run the Python dry-run validator on the current draft. Returns errors, warnings, and a deterministic `failureSignature`. The same signature appearing twice in a row means your last fix did not change the failure — escalate to the user instead of looping.',
    parameters: z.object({}),
    execute: async () => {
      state.validateCount++;
      const result = await bridge.validateDryRun(state.draft);
      const sig = result.failureSignature;
      if (sig) {
        const count = (state.seenFailures.get(sig) ?? 0) + 1;
        state.seenFailures.set(sig, count);
        if (count >= 2) {
          emit(state, { kind: 'failure_signature_repeat', signature: sig, count });
        }
      }
      emit(state, { kind: 'validation_attempt', result });
      return result;
    },
  }),

  verify: tool({
    description:
      'Compile-check the draft via the Python verify-mock endpoint (no real backtest, no data fetch). Run this once after `validate` passes, before `submit`.',
    parameters: z.object({}),
    execute: async () => {
      const result = await bridge.verifyMock(state.draft);
      emit(state, { kind: 'verification_result', result });
      return result;
    },
  }),

  submit: tool({
    description:
      'Finalize the strategy. Pass a one-line summary of what was built or changed for the user-visible completion message. Terminates the agent run.',
    parameters: z.object({
      summary: z.string().describe('Short, factual one-liner (no narration, no marketing copy).'),
    }),
    execute: async ({ summary }) => {
      state.submitted = { draft: state.draft, summary };
      emit(state, { kind: 'submit', summary });
      return { ok: true };
    },
  }),

  ask_user: tool({
    description:
      'Pause and ask the user a specific question. Use when blocked by missing context (e.g. portfolio not set, ticker not in Start scope, conflicting user requirements) or when the failure-signature loop guard fires.',
    parameters: z.object({
      question: z.string(),
      reason: z.string().optional().describe('Why you need the answer (one short sentence).'),
    }),
    execute: async ({ question, reason }) => ({ asked: true, question, reason: reason ?? null }),
  }),

  list_integrations: tool({
    description:
      'List configured external API providers (FMP, Finnhub, Polygon, FRED, NewsAPI, ...) with their available endpoint names and whether the env key is set. Call this BEFORE adding an apiDataSource node so you know which provider + endpoint to pick. Source: backend/data_providers/manifest.json.',
    parameters: z.object({}),
    execute: async () => {
      const { providers } = await bridge.listDataProviders();
      return providers.map((p) => ({
        id: p.id,
        name: p.name,
        hasKey: p.hasKey,
        endpoints: p.endpoints,
      }));
    },
  }),

  lookup_integration: tool({
    description:
      'Return the full spec for one external API endpoint: URL, method, param names + types + required flags, auth style, output shape. Call this BEFORE configuring an apiDataSource node so you pass the right param names. Source: backend/data_providers/manifest.json.',
    parameters: z.object({
      provider: z.string().describe('Provider id from list_integrations (e.g. "fmp", "finnhub").'),
      endpoint: z.string().describe('Endpoint id under that provider (e.g. "senate-trading").'),
    }),
    execute: async ({ provider, endpoint }) => {
      try {
        return await bridge.lookupDataEndpoint(provider, endpoint);
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
  }),
});

// ── Helpers ────────────────────────────────────────────────────────────────

const suggest = (query: string, catalog: CatalogIndex): string[] => {
  const q = query.toLowerCase();
  const matches: Array<{ score: number; type: string }> = [];
  for (const [type] of catalog.byType) {
    const t = type.toLowerCase();
    let score = 0;
    if (t === q) score += 100;
    if (t.startsWith(q)) score += 30;
    if (t.includes(q)) score += 10;
    if (score > 0) matches.push({ score, type });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 5).map((m) => m.type);
};
