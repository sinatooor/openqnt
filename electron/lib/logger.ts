/**
 * Process-wide logger.
 *
 * - Per-service file under userData/logs/<name>.log (plain text, line-delimited
 *   so users can `tail -f` it). Pino was considered but its JSON format is
 *   awkward to read alongside child-process stdout. We keep it simple.
 * - In-memory ring buffer (last 1000 lines, all services interleaved with a
 *   tag prefix) for the splash diagnostics panel.
 */

import fs from 'node:fs';
import path from 'node:path';
import { paths } from './paths';

const RING_CAPACITY = 1000;
const ring: string[] = [];
const fileMap = new Map<string, string>();
const subscribers = new Set<(line: string) => void>();

function fileFor(service: string): string {
  let p = fileMap.get(service);
  if (!p) {
    p = path.join(paths().logsDir, `${service}.log`);
    fileMap.set(service, p);
  }
  return p;
}

function pushRing(tagged: string): void {
  ring.push(tagged);
  if (ring.length > RING_CAPACITY) ring.shift();
  for (const sub of subscribers) {
    try {
      sub(tagged);
    } catch {
      // swallow — a bad subscriber must not break logging
    }
  }
}

export function log(service: string, line: string): void {
  // Strip ANSI codes — they'd confuse the splash plain-text panel.
  const clean = line.replace(/\x1b\[[0-9;]*m/g, '').trimEnd();
  if (!clean) return;
  const ts = new Date().toISOString();
  const tagged = `[${ts}] [${service}] ${clean}`;
  // appendFileSync because the supervisor can SIGKILL children mid-write
  // and we MUST persist crash diagnostics; buffered streams lose tails.
  try { fs.appendFileSync(fileFor(service), tagged + '\n'); } catch {}
  pushRing(tagged);
}

export function logError(service: string, err: unknown): void {
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
  log(service, `ERROR: ${msg}`);
}

export function attachStream(service: string, stream: NodeJS.ReadableStream | null | undefined): void {
  if (!stream) return;
  let buf = '';
  stream.on('data', (chunk: Buffer | string) => {
    buf += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() ?? '';
    for (const l of lines) log(service, l);
  });
  stream.on('end', () => {
    if (buf) log(service, buf);
  });
}

export function subscribe(cb: (line: string) => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function snapshot(limit = 200): string[] {
  return ring.slice(-limit);
}

export function closeAll(): void {
  fileMap.clear();
}
