/**
 * Runtime configuration for backend / orchestrator / WebSocket URLs.
 *
 * Why this exists: `import.meta.env.VITE_BACKEND_URL` is inlined at Vite build
 * time, so a packaged Electron build can't pick a free port at runtime and have
 * the renderer use it. The Electron preload exposes `window.electronAPI` with
 * the live URLs (set via `additionalArguments` so they're synchronous at module
 * load time — many features call `apiBase()` while still importing).
 *
 * Resolution order, per call:
 *   1. `window.electronAPI.<x>Url`  (desktop runtime — Electron-injected)
 *   2. `import.meta.env.VITE_<X>_URL` (dev / web build — Vite-inlined)
 *   3. Hardcoded localhost fallback (last resort, dev convenience)
 *
 * Do NOT read `import.meta.env.VITE_*_URL` directly anywhere else in the
 * codebase. The ESLint rule in `eslint.config.js` enforces this.
 */

type ElectronAPI = {
  backendUrl?: string;
  orchestratorUrl?: string;
  wsUrl?: string;
  isDesktop?: boolean;
};

const electron = (): ElectronAPI | undefined =>
  (globalThis as unknown as { electronAPI?: ElectronAPI }).electronAPI;

const stripTrailingSlash = (s: string): string => s.replace(/\/$/, '');

const env = (key: 'VITE_BACKEND_URL' | 'VITE_ORCHESTRATOR_URL' | 'VITE_WS_URL'): string | undefined => {
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return meta?.[key];
};

export const isDesktop = (): boolean => Boolean(electron()?.isDesktop);

export const apiBase = (): string =>
  stripTrailingSlash(electron()?.backendUrl ?? env('VITE_BACKEND_URL') ?? 'http://localhost:8000');

export const orchestratorBase = (): string =>
  stripTrailingSlash(electron()?.orchestratorUrl ?? env('VITE_ORCHESTRATOR_URL') ?? 'http://localhost:3000');

export const wsBase = (): string => {
  // wsUrl falls through to orchestratorUrl (same host, ws scheme) when only
  // the HTTP URL is known — common in Electron where one orchestrator process
  // serves both HTTP and Socket.IO on the same port.
  const explicit = electron()?.wsUrl ?? env('VITE_WS_URL');
  if (explicit) return stripTrailingSlash(explicit);
  const orch = orchestratorBase();
  return orch.replace(/^http/, 'ws');
};
