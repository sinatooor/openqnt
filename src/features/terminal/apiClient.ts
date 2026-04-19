/**
 * Terminal data API client
 * =========================
 *
 * Thin HTTP wrapper around the backend /api/terminal/* endpoints. Every
 * terminal tool (HDS, DES, GIP, SPLC, WEI) tries the backend first and
 * gracefully falls back to its deterministic mock generator when the
 * backend is unreachable, rate-limited, or returns an error.
 *
 * The frontend never throws to the user because of upstream issues — it
 * surfaces a `source` tag instead so the UI can show "live" vs "mock".
 */

const BACKEND_URL =
  (import.meta.env?.VITE_BACKEND_URL as string | undefined) ||
  "http://localhost:8000";

/** How long we wait before giving up on a backend call (ms). */
const DEFAULT_TIMEOUT_MS = 10_000;

export interface TerminalApiResponse<T> {
  source: "yfinance" | "yfinance+fmp" | "mock" | "unknown";
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
  const qs = params
    ? "?" +
      Object.entries(params)
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
