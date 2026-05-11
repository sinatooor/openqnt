/**
 * Typed renderer-side wrapper around the Electron preload's `keys` API.
 *
 * The actual implementation lives in `electron/preload.ts`. In a web build,
 * `window.electronAPI.keys` is undefined and `keysAvailable()` returns false —
 * callers should gate their UI on that.
 *
 * See `electron/lib/secrets.ts` for the encryption details (safeStorage,
 * encrypted blob under `<userData>/secrets.json.enc`).
 */

export interface MaskedSecret {
  key: string;
  masked: string;
  updatedAt: string;
}

export interface ParsedEnvRow {
  key: string;
  value: string;
  masked: string;
}

interface ElectronKeysAPI {
  pickEnvFile(): Promise<string | null>;
  parseEnvFile(filePath: string): Promise<ParsedEnvRow[]>;
  list(): Promise<MaskedSecret[]>;
  save(key: string, value: string): Promise<void>;
  saveMany(entries: Array<{ key: string; value: string }>): Promise<void>;
  delete(key: string): Promise<void>;
  reveal(key: string): Promise<string | undefined>;
}

interface ElectronAPIShape {
  isDesktop?: boolean;
  keys?: ElectronKeysAPI;
  relaunch?(): Promise<void>;
}

function api(): ElectronAPIShape | undefined {
  return (globalThis as unknown as { electronAPI?: ElectronAPIShape }).electronAPI;
}

export function isDesktopApp(): boolean {
  return Boolean(api()?.isDesktop);
}

export function keysAvailable(): boolean {
  return Boolean(api()?.keys);
}

export function keysApi(): ElectronKeysAPI {
  const k = api()?.keys;
  if (!k) {
    throw new Error(
      'Encrypted key storage is only available in the desktop app. ' +
      'In the browser, set keys in backend/.env.',
    );
  }
  return k;
}

export async function relaunchApp(): Promise<void> {
  const fn = api()?.relaunch;
  if (!fn) return;
  await fn();
}
