/**
 * HTTP health-check helpers shared by supervisor and splash.
 */

import { sleep } from './ports';

export async function checkHttp(url: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function pollUntilHealthy(
  url: string,
  options: { timeoutMs?: number; intervalMs?: number; onAttempt?: (ok: boolean) => void } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const intervalMs = options.intervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await checkHttp(url);
    options.onAttempt?.(ok);
    if (ok) return;
    await sleep(intervalMs);
  }
  throw new Error(`Health check timed out: ${url}`);
}
