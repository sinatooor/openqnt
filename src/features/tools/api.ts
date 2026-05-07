import { apiBase } from '@/lib/runtimeConfig';
/**
 * Thin client for /api/tools/* — Phase G sandbox + dynamic tool registry.
 */

const API_BASE =
  apiBase();

export interface StaticToolMeta {
  name: string;
  description: string;
}

export interface DynamicToolMeta {
  name: string;
  description: string;
  signature: string;
  created_at: number;
  updated_at: number;
  source_path: string;
  inputs: Array<{ name: string; annotation: string }>;
  return_annotation: string | null;
}

export interface ToolsListResponse {
  static: StaticToolMeta[];
  dynamic: DynamicToolMeta[];
}

export interface SandboxFile {
  name: string;
  size_bytes: number;
  is_plot: boolean;
  content_b64: string | null;
}

export interface SandboxResult {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  timed_out: boolean;
  files_out: SandboxFile[];
  plots: SandboxFile[];
  error?: string | null;
}

export interface CreateToolResponse {
  ok: boolean;
  meta?: DynamicToolMeta;
  errors?: string[];
}

export interface CallToolResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
  stdout?: string;
  duration_ms?: number;
}

export async function listTools(): Promise<ToolsListResponse> {
  const r = await fetch(`${API_BASE}/api/tools`);
  if (!r.ok) throw new Error(`tools: ${r.status}`);
  return (await r.json()) as ToolsListResponse;
}

export async function getDynamicSource(name: string): Promise<{ meta: DynamicToolMeta; source: string }> {
  const r = await fetch(`${API_BASE}/api/tools/dynamic/${encodeURIComponent(name)}`);
  if (!r.ok) throw new Error(`dynamic/${name}: ${r.status}`);
  return await r.json();
}

export async function executeSandbox(code: string, timeoutS = 8): Promise<SandboxResult> {
  const r = await fetch(`${API_BASE}/api/tools/sandbox/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, timeout_s: timeoutS }),
  });
  if (!r.ok) throw new Error(`sandbox: ${r.status}`);
  return (await r.json()) as SandboxResult;
}

export async function createDynamicTool(
  name: string,
  code: string,
  description: string,
): Promise<CreateToolResponse> {
  const r = await fetch(`${API_BASE}/api/tools/dynamic`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, code, description }),
  });
  if (!r.ok) throw new Error(`create: ${r.status}`);
  return (await r.json()) as CreateToolResponse;
}

export async function callDynamicTool(
  name: string,
  kwargs: Record<string, unknown>,
  timeoutS = 8,
): Promise<CallToolResponse> {
  const r = await fetch(`${API_BASE}/api/tools/dynamic/${encodeURIComponent(name)}/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kwargs, timeout_s: timeoutS }),
  });
  if (!r.ok) throw new Error(`call: ${r.status}`);
  return (await r.json()) as CallToolResponse;
}

export async function deleteDynamicTool(name: string): Promise<void> {
  const r = await fetch(`${API_BASE}/api/tools/dynamic/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error(`delete: ${r.status}`);
}
