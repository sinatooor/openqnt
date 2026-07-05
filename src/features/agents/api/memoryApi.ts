/**
 * memoryApi — typed client for the copilot brain's REST surface
 * (`backend/routers/memory.py`, FastAPI on :8000).
 *
 * Same conventions as `features/backtest/api.ts`: raw fetch over `apiBase()`,
 * throw on !ok with the backend's `detail` message when present.
 */

import { apiBase } from '@/lib/runtimeConfig';

const BASE = () => `${apiBase()}/api/memory`;

export interface MemoryFileMeta {
  /** Canonical name, e.g. "soul.md" or "assets/AAPL.md". */
  name: string;
  /** Human title, e.g. "Soul (personality)" or "Asset · AAPL". */
  title: string;
  /** false → human-only (the agent never edits it, e.g. soul.md). */
  agent_writable: boolean;
  /** true → reset-to-default is available. */
  has_default: boolean;
  /** Size on disk in bytes. */
  size: number;
}

async function throwHttpError(r: Response, fallback: string): Promise<never> {
  let detail = fallback;
  try {
    const body = (await r.json()) as { detail?: string };
    if (body?.detail) detail = body.detail;
  } catch {
    /* non-JSON error body — keep fallback */
  }
  throw new Error(detail);
}

export async function listMemoryFiles(): Promise<MemoryFileMeta[]> {
  const r = await fetch(`${BASE()}/files`);
  if (!r.ok) await throwHttpError(r, `Failed to list memory files (${r.status})`);
  const body = (await r.json()) as { files: MemoryFileMeta[] };
  return body.files;
}

export async function readMemoryFile(name: string): Promise<{ name: string; content: string }> {
  const r = await fetch(`${BASE()}/file?name=${encodeURIComponent(name)}`);
  if (!r.ok) await throwHttpError(r, `Failed to read ${name} (${r.status})`);
  return (await r.json()) as { name: string; content: string };
}

export async function writeMemoryFile(
  name: string,
  content: string
): Promise<{ name: string; content: string }> {
  const r = await fetch(`${BASE()}/file`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content }),
  });
  if (!r.ok) await throwHttpError(r, `Failed to save ${name} (${r.status})`);
  // The backend enforces a hard size cap — `content` here is what actually
  // landed on disk, which may differ from the draft that was sent.
  return (await r.json()) as { name: string; content: string };
}

export async function resetMemoryFile(name: string): Promise<{ name: string; content: string }> {
  const r = await fetch(`${BASE()}/file/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) await throwHttpError(r, `Failed to reset ${name} (${r.status})`);
  return (await r.json()) as { name: string; content: string };
}

export async function createAssetFile(ticker: string): Promise<{ name: string; content: string }> {
  const r = await fetch(`${BASE()}/asset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker }),
  });
  if (!r.ok) await throwHttpError(r, `Failed to create asset ${ticker} (${r.status})`);
  return (await r.json()) as { name: string; content: string };
}
