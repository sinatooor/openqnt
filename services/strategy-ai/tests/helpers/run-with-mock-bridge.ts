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
  DataProvidersResponse,
  DryRunResponse,
  EndpointSpec,
  VerifyMockResponse,
} from '../../src/python-bridge';
import type { StrategyDraft } from '../../src/types/strategy-draft';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, '../../../../backend/strategy_flow/node_catalog_cache.json');
const MANIFEST_PATH = resolve(__dirname, '../../../../backend/data_providers/manifest.json');

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

interface ManifestProvider {
  name: string;
  envKey?: string;
  baseUrl?: string;
  docsUrl?: string;
  authStyle?: string;
  authParam?: string;
  endpoints?: Record<string, {
    path: string;
    method?: string;
    params?: Record<string, unknown>;
    output?: Record<string, unknown>;
    description?: string;
  }>;
}

let _manifestCache: { providers: Record<string, ManifestProvider> } | undefined;
const loadManifest = async () => {
  if (_manifestCache) return _manifestCache;
  const raw = await readFile(MANIFEST_PATH, 'utf8');
  _manifestCache = JSON.parse(raw) as typeof _manifestCache;
  return _manifestCache!;
};

class MockPythonBridge implements Pick<PythonBridge, 'getCatalog' | 'validateDryRun' | 'verifyMock' | 'listDataProviders' | 'lookupDataEndpoint'> {
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
  async listDataProviders(): Promise<DataProvidersResponse> {
    const m = await loadManifest();
    const providers = Object.entries(m.providers).map(([id, p]) => ({
      id,
      name: p.name ?? id,
      envKey: p.envKey ?? null,
      hasKey: true, // tests assume keys present so the agent doesn't filter providers out
      baseUrl: p.baseUrl ?? '',
      docsUrl: p.docsUrl,
      endpoints: Object.keys(p.endpoints ?? {}).sort(),
    }));
    return { providers };
  }
  async lookupDataEndpoint(provider: string, endpoint: string): Promise<EndpointSpec> {
    const m = await loadManifest();
    const p = m.providers[provider];
    if (!p) throw new Error(`unknown provider: ${provider}`);
    const spec = p.endpoints?.[endpoint];
    if (!spec) throw new Error(`unknown endpoint ${endpoint} for ${provider}`);
    return {
      provider,
      endpoint,
      name: p.name ?? provider,
      baseUrl: p.baseUrl ?? '',
      docsUrl: p.docsUrl,
      envKey: p.envKey ?? null,
      hasKey: true,
      authStyle: p.authStyle,
      authParam: p.authParam,
      method: spec.method ?? 'GET',
      path: spec.path,
      params: (spec.params ?? {}) as Record<string, never>,
      output: (spec.output ?? {}) as Record<string, unknown>,
      description: spec.description,
    };
  }
}

export const runWithMockBridge = async (prompt: string): Promise<BuilderRunResult> => {
  ensureEnv();
  const catalog = await loadCatalog();
  const bridge = new MockPythonBridge(catalog) as unknown as PythonBridge;
  const { model } = resolveModel();
  return runBuilder({ message: prompt }, { bridge, model });
};

/**
 * Multi-turn helper: runs `prompts` sequentially, threading the previous
 * turn's draft + summary into the next turn's `initialDraft` and `history`.
 * Mirrors what the frontend does after Fix A — the chat composer passes
 * `currentNodes/Edges` from the canvas store and `history` from the chat
 * store. Snapshots the FINAL draft.
 */
export const runWithMockBridgeMultiTurn = async (
  prompts: string[],
): Promise<BuilderRunResult> => {
  ensureEnv();
  const catalog = await loadCatalog();
  const bridge = new MockPythonBridge(catalog) as unknown as PythonBridge;
  const { model } = resolveModel();

  let draft: BuilderRunResult['draft'] | undefined;
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let lastResult: BuilderRunResult | undefined;

  for (const prompt of prompts) {
    const result = await runBuilder(
      { message: prompt, initialDraft: draft, history },
      { bridge, model },
    );
    // Append this turn to history for the next iteration.
    history = [
      ...history,
      { role: 'user', content: prompt },
      { role: 'assistant', content: result.summary || 'ok' },
    ];
    draft = result.draft;
    lastResult = result;
  }
  if (!lastResult) throw new Error('runWithMockBridgeMultiTurn: no prompts');
  return lastResult;
};

// ── Snapshot shape ──────────────────────────────────────────────────────────

const subTypeOf = (data: Record<string, unknown>): string => {
  const keys = [
    'indicatorType', 'conditionType', 'actionType', 'triggerType',
    'controlType', 'mathType', 'riskType', 'variableType',
    'environmentType', 'tradeInfoType', 'llmType', 'integrationType',
    'pineType', 'agentType', 'dataSourceType', 'provider',
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
