/**
 * Typed HTTP client to the Python backend.
 *
 * The Python FastAPI service at `backend/strategy_flow/router.py` is the
 * source of truth for the node catalog and the only validator. The Builder
 * agent calls these three endpoints in its validate→fix loop:
 *
 *   GET  /api/strategy-flow/catalog
 *   POST /api/strategy-flow/validate-dry-run  -> failureSignature for loop guard
 *   POST /api/strategy-flow/verify-mock       -> final pre-submit compile check
 */

import type { StrategyDraft } from './types/strategy-draft';

export interface CatalogNode {
  type: string;
  nodeType: string;
  label: string;
  description?: string;
  category: string;
  inputs?: Array<string | { id: string; label?: string; dataType?: string; required?: boolean }>;
  outputs?: Array<string | { id: string; label?: string; dataType?: string }>;
  defaultData?: Record<string, unknown>;
  params?: Array<{ id: string; label?: string; type?: string; default?: unknown; options?: unknown[] }>;
  connections?: { canConnectTo?: string[]; canReceiveFrom?: string[] };
  /**
   * Authoritative handle topology — embedded by the Python `/catalog`
   * endpoint from `backend/strategy_flow/handle_configs.json` (extracted
   * from the frontend's `getHandleConfigs` via
   * `scripts/extract-handle-configs.ts`).
   */
  handles?: Array<{
    id: string;
    type: 'target' | 'source';
    position: 'left' | 'right';
    label: string;
    dataType?: string;
  }>;
}

export interface CatalogResponse {
  /** Grouped by node category (action, indicator, ...). Each value is an array of CatalogNode. */
  catalog: Record<string, CatalogNode[]>;
  totalNodeTypes: number;
  version: string;
}

export interface DryRunResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Stable 16-char hash. Same logical failure → same signature → agent loop-guard fires. */
  failureSignature: string;
  structuredErrors: Array<{ errorClass: string; nodeId: string; paramPath: string }>;
}

export interface VerifyMockResponse {
  compiles: boolean;
  valid: boolean;
  errors: string[];
  warnings: string[];
  failureSignature: string;
  compiledCodeSize: number;
  nodeCoverage: Record<string, string>;
}

export class PythonBridge {
  constructor(private readonly baseUrl: string = process.env.STRATEGY_PY_URL ?? 'http://127.0.0.1:8000') {}

  async getCatalog(): Promise<CatalogResponse> {
    const r = await fetch(`${this.baseUrl}/api/strategy-flow/catalog`);
    if (!r.ok) throw new Error(`catalog: ${r.status} ${await r.text()}`);
    return (await r.json()) as CatalogResponse;
  }

  async validateDryRun(draft: StrategyDraft): Promise<DryRunResponse> {
    const r = await fetch(`${this.baseUrl}/api/strategy-flow/validate-dry-run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nodes: draft.nodes,
        edges: draft.edges,
        settings: draft.settings ?? null,
      }),
    });
    if (!r.ok) throw new Error(`validate-dry-run: ${r.status} ${await r.text()}`);
    return (await r.json()) as DryRunResponse;
  }

  async verifyMock(draft: StrategyDraft): Promise<VerifyMockResponse> {
    const r = await fetch(`${this.baseUrl}/api/strategy-flow/verify-mock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nodes: draft.nodes,
        edges: draft.edges,
        settings: draft.settings ?? null,
      }),
    });
    if (!r.ok) throw new Error(`verify-mock: ${r.status} ${await r.text()}`);
    return (await r.json()) as VerifyMockResponse;
  }
}
