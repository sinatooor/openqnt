import { apiBase } from '@/lib/runtimeConfig';
/**
 * Thin client for /api/improvement/* — Phase I self-improvement loop.
 */

const API_BASE =
  apiBase();

export interface ImprovementSeed {
  symbol: string;
  start: string;
  end: string;
  interval?: string;
  initial_cash?: number;
  commission?: number;
  strategy: string;
  params: Record<string, any>;
  code?: string;
}

export interface StartImprovementRequest {
  seed: ImprovementSeed;
  n_iters?: number;
  fanout?: number;
  objective?: string;
  validation_start?: string;
  validation_end?: string;
  budget_s?: number;
}

export interface ImprovementNode {
  id: string;
  parent_id: string | null;
  depth: number;
  iteration: number;
  spec: Record<string, any>;
  metrics: Record<string, number>;
  score: number | null;
  status: 'pending' | 'success' | 'error' | 'skipped';
  error: string | null;
  created_at: string;
  completed_at: string | null;
  tag: string;
}

export interface ImprovementSummary {
  run_id: string;
  objective: string;
  n_iters_run: number;
  seed_score: number;
  best_score: number;
  best_params: Record<string, any>;
  in_sample_metrics: Record<string, number>;
  validation_metrics: Record<string, number> | null;
  duration_s: number;
  nodes: ImprovementNode[];
}

export interface ImprovementRunResponse {
  run_id: string;
  meta: any;
  nodes: ImprovementNode[];
  status: string;
  summary: ImprovementSummary | null;
}

export async function startImprovement(req: StartImprovementRequest): Promise<{ run_id: string }> {
  const r = await fetch(`${API_BASE}/api/improvement/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!r.ok) throw new Error(`start: ${r.status}`);
  return await r.json();
}

export async function getImprovementRun(runId: string): Promise<ImprovementRunResponse> {
  const r = await fetch(`${API_BASE}/api/improvement/runs/${encodeURIComponent(runId)}`);
  if (!r.ok) throw new Error(`run: ${r.status}`);
  return await r.json();
}

export interface ImprovementWsEvent {
  ts: string;
  kind: 'node_added' | 'node_updated' | 'run_finalised' | 'run_complete' | 'error';
  node?: ImprovementNode;
  best_node_id?: string;
  status?: string;
  summary?: ImprovementSummary;
  message?: string;
}

export function openImprovementWs(
  runId: string,
  onEvent: (e: ImprovementWsEvent) => void,
): WebSocket {
  const wsBase = API_BASE.replace(/^http/i, 'ws');
  const ws = new WebSocket(`${wsBase}/api/improvement/ws/${encodeURIComponent(runId)}`);
  ws.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data));
    } catch {
      /* ignore */
    }
  };
  return ws;
}
