/**
 * Terminal data API client
 * =========================
 *
 * Thin HTTP wrapper around the backend /api/terminal/* endpoints. Every
 * terminal tool (HDS, DES, GIP, SPLC, WEI) tries the backend first and
 * gracefully falls back to its deterministic mock generator when the
 * backend is unreachable, rate-limited, or returns an error.
 *
 * Every request automatically appends the user-selected market-data source
 * (`?source=auto|yfinance|avanza|fmp`) read from `dataSourceStore`. The
 * backend honours that hint; when `auto` the existing fallback chain runs.
 *
 * The frontend never throws to the user because of upstream issues — it
 * surfaces a `source` tag instead so the UI can show "live" vs "mock".
 */

import { getActiveDataSource } from '@/stores/dataSourceStore';

import { apiBase } from '@/lib/runtimeConfig';
const BACKEND_URL =
  apiBase();

/** How long we wait before giving up on a backend call (ms). */
const DEFAULT_TIMEOUT_MS = 10_000;

export interface TerminalApiResponse<T> {
  source: "yfinance" | "yfinance+fmp" | "avanza" | "mock" | "unknown";
  data: T;
  /** Populated only when the frontend falls back; never surfaced to agents. */
  reason?: string;
}

/**
 * Fetch JSON from the backend terminal-data API with a timeout. Resolves to
 * `null` on any network / HTTP / JSON error so callers can decide to use
 * their mock generator instead of bubbling the error up.
 */
export async function terminalApiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  signal?: AbortSignal,
): Promise<T | null> {
  const merged: Record<string, string | number | boolean | undefined> = {
    ...(params ?? {}),
  };
  if (merged.source === undefined) {
    const active = getActiveDataSource();
    if (active && active !== 'auto') merged.source = active;
  }
  const qs = Object.keys(merged).length
    ? "?" +
      Object.entries(merged)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const url = `${BACKEND_URL}${path}${qs}`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), DEFAULT_TIMEOUT_MS);
  const combined = signal
    ? new AbortController()
    : ac; // outer caller's abort is merged below
  if (signal) {
    signal.addEventListener("abort", () => combined.abort(), { once: true });
    ac.signal.addEventListener("abort", () => combined.abort(), { once: true });
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: combined.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const TERMINAL_BACKEND_URL = BACKEND_URL;
