/**
 * Headless builder runner.
 *
 * Runs the strategy builder agent end-to-end with a MOCK PythonBridge so we
 * don't need the Python backend running. The catalog comes straight from the
 * bundled JSON cache (which the live backend also serves). Validate / verify
 * return success with no errors — we're testing prompt + tool calling
 * behaviour, not the validator.
 *
 * Usage:
 *   bun run scripts/headless-builder.ts "build an RSI strategy"
 *
 * Outputs:
 *   - Every tool call as a one-line JSON event
 *   - The final draft (nodes + edges + summary)
 *   - A diagnostic block highlighting common smells (extra nodes, label-as-id, etc.)
 */

import { loadEnvFiles } from '../src/env-bootstrap';
loadEnvFiles();

// Force Anthropic Sonnet for these tests. Override any user-shell setting.
process.env.STRATEGY_AI_PROVIDER = 'anthropic';
if (!process.env.STRATEGY_AI_MODEL) process.env.STRATEGY_AI_MODEL = 'claude-sonnet-4-6';

import path from 'node:path';
import fs from 'node:fs/promises';
import { runBuilder } from '../src/builder/loop';
import { resolveModel } from '../src/builder/model';
import type { PythonBridge, CatalogNode, CatalogResponse, DryRunResponse, VerifyMockResponse } from '../src/python-bridge';
import type { StrategyDraft } from '../src/types/strategy-draft';
import type { BuilderEvent } from '../src/builder/tools';

// ── Mock Python bridge ──────────────────────────────────────────────────────

class MockPythonBridge implements Pick<PythonBridge, 'getCatalog' | 'validateDryRun' | 'verifyMock'> {
  constructor(private readonly catalog: Record<string, CatalogNode[]>) {}

  async getCatalog(): Promise<CatalogResponse> {
    const total = Object.values(this.catalog).reduce((s, a) => s + a.length, 0);
    return { catalog: this.catalog, totalNodeTypes: total, version: 'mock' };
  }
  async validateDryRun(_draft: StrategyDraft): Promise<DryRunResponse> {
    return { valid: true, errors: [], warnings: [], failureSignature: '', structuredErrors: [] };
  }
  async verifyMock(_draft: StrategyDraft): Promise<VerifyMockResponse> {
    return {
      compiles: true,
      valid: true,
      errors: [],
      warnings: [],
      failureSignature: '',
      compiledCodeSize: 0,
      nodeCoverage: {},
    };
  }
}

// ── Catalog loader ──────────────────────────────────────────────────────────

const CATALOG_PATH = path.resolve(
  import.meta.dir,
  '../../../backend/strategy_flow/node_catalog_cache.json',
);

async function loadCatalog(): Promise<Record<string, CatalogNode[]>> {
  const raw = await fs.readFile(CATALOG_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  // The cache is keyed by nodeType (action, indicator, ...). Coerce to the
  // catalog response shape the bridge expects.
  if (parsed && typeof parsed === 'object' && parsed.catalog) return parsed.catalog;
  return parsed as Record<string, CatalogNode[]>;
}

// ── Run ─────────────────────────────────────────────────────────────────────

const prompt = process.argv.slice(2).join(' ').trim() || 'build an RSI strategy';
const log = (...args: unknown[]) => console.log(...args);

const main = async () => {
  log('━━━ Headless Builder Test ━━━');
  log(`Prompt: ${prompt}`);
  const catalog = await loadCatalog();
  const bridge = new MockPythonBridge(catalog) as unknown as PythonBridge;
  const { model, provider, modelId } = resolveModel();
  log(`Model: ${provider}/${modelId}`);
  log('---');

  const events: BuilderEvent[] = [];
  const onEvent = (e: BuilderEvent) => {
    events.push(e);
    // Compact one-line log per event
    let summary = '';
    switch (e.kind) {
      case 'node_added':
        summary = `+ node ${e.node.id} :: ${e.node.type}/${(e.node.data.indicatorType || e.node.data.conditionType || e.node.data.actionType || e.node.data.triggerType || e.node.data.controlType || e.node.data.mathType || '')}`;
        break;
      case 'edge_added':
        summary = `+ edge ${e.edge.source}.${e.edge.sourceHandle ?? '?'} → ${e.edge.target}.${e.edge.targetHandle ?? '?'}`;
        break;
      case 'node_deleted': summary = `- node ${e.nodeId}`; break;
      case 'edge_deleted': summary = `- edge ${e.edgeId}`; break;
      case 'node_updated': summary = `~ node ${e.nodeId} patch=${JSON.stringify(e.patch)}`; break;
      case 'validation_attempt': summary = `validate: valid=${e.result.valid} errors=${e.result.errors.length}`; break;
      case 'verification_result': summary = `verify: compiles=${e.result.compiles}`; break;
      case 'submit': summary = `SUBMIT: ${e.summary}`; break;
      case 'failure_signature_repeat': summary = `loop-guard fired: ${e.signature} (x${e.count})`; break;
    }
    log(`[${e.kind}] ${summary}`);
  };

  const result = await runBuilder(
    { message: prompt },
    { bridge, model, onEvent },
  );

  log('---');
  log('━━━ Final draft ━━━');
  log(`Nodes (${result.draft.nodes.length}):`);
  for (const n of result.draft.nodes) {
    const sub = (n.data as any).indicatorType ?? (n.data as any).conditionType ?? (n.data as any).actionType ?? (n.data as any).triggerType ?? (n.data as any).controlType ?? (n.data as any).mathType ?? (n.data as any).provider ?? '';
    log(`  ${n.id} :: ${n.type}/${sub} data=${JSON.stringify(n.data).slice(0, 120)}`);
  }
  log(`Edges (${result.draft.edges.length}):`);
  for (const e of result.draft.edges) {
    log(`  ${e.id} :: ${e.source}.${e.sourceHandle ?? '∅'} → ${e.target}.${e.targetHandle ?? '∅'}`);
  }
  log(`Summary: ${result.summary}`);
  log(`Validate count: ${result.validateCount}  blockedByLoopGuard=${result.blockedByLoopGuard}`);

  // ── Diagnostics ────────────────────────────────────────────────────────
  log('---');
  log('━━━ Diagnostics ━━━');
  const findings: string[] = [];
  // Flag duplicate INDICATORS with identical params (the original bug had
  // 3 RSI(14) nodes — pure waste). Don't flag actions: long vs short orders
  // are intentionally duplicated.
  const indicatorKey = (n: any) => `${n.data.indicatorType ?? n.type}#${JSON.stringify(n.data.params ?? {})}`;
  const indicatorGroups = new Map<string, string[]>();
  for (const n of result.draft.nodes) {
    if (n.type !== 'indicator') continue;
    const k = indicatorKey(n);
    indicatorGroups.set(k, [...(indicatorGroups.get(k) ?? []), n.id]);
  }
  for (const [key, ids] of indicatorGroups) {
    if (ids.length > 1) findings.push(`Duplicate indicator (same params): ${key.split('#')[0]} → ${ids.join(', ')}`);
  }
  const hasShortAction = result.draft.nodes.some((n) => n.type === 'action' && (n.data as any).direction === 'short');
  const hasLongAction = result.draft.nodes.some((n) => n.type === 'action' && (n.data as any).direction === 'long');
  if (hasShortAction && !/short|sell|both|hedge/i.test(prompt)) {
    findings.push('Short order present but user did not ask for one.');
  }
  const hasStopOrTP = result.draft.nodes.some((n) => n.type === 'action' && ((n.data as any).actionType === 'stopLoss' || (n.data as any).actionType === 'takeProfit' || (n.data as any).actionType === 'trailingStop'));
  if (hasStopOrTP && !/stop|loss|profit|risk|tp|sl|trail/i.test(prompt)) {
    findings.push('Stop-loss / take-profit present but user did not ask for one.');
  }
  const hasRiskOverlay = result.draft.nodes.some((n) => n.type === 'risk');
  if (hasRiskOverlay && !/risk|drawdown|kelly|sizing|position size/i.test(prompt)) {
    findings.push('Risk overlay node present but user did not ask for one.');
  }
  const hasTrigger = result.draft.nodes.some((n) => n.type === 'trigger');
  if (!hasTrigger) findings.push('No trigger node — strategy will not run.');
  const hasDataSource = result.draft.nodes.some((n) => n.type === 'dataSource');
  if (!hasDataSource) findings.push('No data source node — indicators have no candles to compute from.');

  // Check label-as-handle-id smell on edges
  for (const e of result.draft.edges) {
    if (e.sourceHandle && /\s/.test(e.sourceHandle)) findings.push(`Edge ${e.id} sourceHandle "${e.sourceHandle}" looks like a label, not a handle id.`);
    if (e.targetHandle && /\s/.test(e.targetHandle)) findings.push(`Edge ${e.id} targetHandle "${e.targetHandle}" looks like a label, not a handle id.`);
  }

  if (findings.length === 0) {
    log('✓ No smells detected.');
  } else {
    for (const f of findings) log(`  ⚠ ${f}`);
  }
  log('');
  log(`Node count: ${result.draft.nodes.length}  Edge count: ${result.draft.edges.length}`);
  log(`Issues: ${findings.length}`);
};

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
