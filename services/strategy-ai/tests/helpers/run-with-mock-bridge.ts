/**
 * Shared test helper — runs the Builder agent against a mock PythonBridge so
 * tests don't need a live Python backend. The catalog comes from the
 * committed `backend/strategy_flow/node_catalog_cache.json`; validate/verify
 * are no-ops returning success.
 *
 * `summariseDraft()` reduces the agent's output to a stable shape signature
 * (counts + sorted type lists + edge topology) for snapshot comparison —
 * tolerant of node id naming, edge id randomness, position values, and the
 * agent's wording in the summary.
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFiles } from '../../src/env-bootstrap';
import { resolveModel } from '../../src/builder/model';
import { runBuilder, type BuilderRunResult } from '../../src/builder/loop';
import type {
  PythonBridge,
  CatalogNode,
  CatalogResponse,
  DryRunResponse,
  VerifyMockResponse,
} from '../../src/python-bridge';
import type { StrategyDraft } from '../../src/types/strategy-draft';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, '../../../../backend/strategy_flow/node_catalog_cache.json');

let _envLoaded = false;
const ensureEnv = () => {
  if (_envLoaded) return;
  loadEnvFiles();
  process.env.STRATEGY_AI_PROVIDER = 'anthropic';
  if (!process.env.STRATEGY_AI_MODEL) process.env.STRATEGY_AI_MODEL = 'claude-sonnet-4-6';
  _envLoaded = true;
};

let _catalogCache: Record<string, CatalogNode[]> | undefined;
const loadCatalog = async (): Promise<Record<string, CatalogNode[]>> => {
  if (_catalogCache) return _catalogCache;
  const raw = await readFile(CATALOG_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  _catalogCache = (parsed && parsed.catalog) ? parsed.catalog : parsed;
  return _catalogCache!;
};

class MockPythonBridge implements Pick<PythonBridge, 'getCatalog' | 'validateDryRun' | 'verifyMock'> {
  constructor(private readonly catalog: Record<string, CatalogNode[]>) {}
  async getCatalog(): Promise<CatalogResponse> {
    const total = Object.values(this.catalog).reduce((s, a) => s + a.length, 0);
    return { catalog: this.catalog, totalNodeTypes: total, version: 'mock' };
  }
  async validateDryRun(_d: StrategyDraft): Promise<DryRunResponse> {
    return { valid: true, errors: [], warnings: [], failureSignature: '', structuredErrors: [] };
  }
  async verifyMock(_d: StrategyDraft): Promise<VerifyMockResponse> {
    return { compiles: true, valid: true, errors: [], warnings: [], failureSignature: '', compiledCodeSize: 0, nodeCoverage: {} };
  }
}

export const runWithMockBridge = async (prompt: string): Promise<BuilderRunResult> => {
  ensureEnv();
  const catalog = await loadCatalog();
  const bridge = new MockPythonBridge(catalog) as unknown as PythonBridge;
  const { model } = resolveModel();
  return runBuilder({ message: prompt }, { bridge, model });
};

// ── Snapshot shape ──────────────────────────────────────────────────────────

const subTypeOf = (data: Record<string, unknown>): string => {
  const keys = [
    'indicatorType', 'conditionType', 'actionType', 'triggerType',
    'controlType', 'mathType', 'riskType', 'variableType',
    'environmentType', 'tradeInfoType', 'llmType', 'integrationType',
    'pineType', 'agentType', 'provider',
  ];
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v) return v;
  }
  return '';
};

export interface DraftSnapshot {
  /** Number of nodes in the draft. */
  nodeCount: number;
  /** Number of edges in the draft. */
  edgeCount: number;
  /** Sorted list of "nodeType/subType" tuples — id-agnostic. */
  nodeShapes: string[];
  /**
   * Sorted edge topology by node-shape (not id). Each entry is
   * "sourceShape.sourceHandle → targetShape.targetHandle".
   * Tolerant of node id naming; strict about which-kind-connects-to-which.
   */
  edgeShapes: string[];
}

export const summariseDraft = (draft: StrategyDraft): DraftSnapshot => {
  const nodeShape = (id: string) => {
    const n = draft.nodes.find((x) => x.id === id);
    if (!n) return `MISSING/${id}`;
    return `${n.type ?? ''}/${subTypeOf(n.data ?? {})}`;
  };
  const nodeShapes = draft.nodes.map((n) => `${n.type ?? ''}/${subTypeOf(n.data ?? {})}`).sort();
  const edgeShapes = draft.edges
    .map((e) => `${nodeShape(e.source)}.${e.sourceHandle ?? ''} → ${nodeShape(e.target)}.${e.targetHandle ?? ''}`)
    .sort();
  return {
    nodeCount: draft.nodes.length,
    edgeCount: draft.edges.length,
    nodeShapes,
    edgeShapes,
  };
};
