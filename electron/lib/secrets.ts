/**
 * Encrypted secret storage for user-managed API keys.
 *
 * Keys are written to `<userData>/secrets.json.enc`, encrypted with
 * Electron's `safeStorage` (macOS Keychain / Windows DPAPI). Plaintext keys
 * never touch disk and never leave the main process except:
 *   - via `revealSecret()` for a single key, in response to an explicit
 *     "click to reveal" action in the renderer
 *   - via `getSecretsForBackend()`, injected into the Python child's env
 *     on spawn
 *
 * Anything else (`list`, `parseEnvFile`) returns *masked* values only.
 */
import { safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { paths } from './paths';
import { log } from './logger';

interface SecretEntry {
  value: string;
  updatedAt: string;
}

type SecretsBlob = Record<string, SecretEntry>;

export interface MaskedSecret {
  key: string;
  masked: string;
  updatedAt: string;
}

export interface ParsedEnvRow {
  key: string;
  value: string; // plaintext — preview UI is responsible for masking display
  masked: string;
}

function secretsPath(): string {
  return path.join(paths().userDataRoot, 'secrets.json.enc');
}

function maskValue(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '••';
  return '••••••' + value.slice(-4);
}

function ensureEncryption(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'OS-level encryption is not available. On Linux, install a keychain ' +
      '(gnome-keyring / kwallet). On macOS/Windows this should never happen.',
    );
  }
}

function readSecrets(): SecretsBlob {
  const p = secretsPath();
  if (!fs.existsSync(p)) return {};
  try {
    ensureEncryption();
    const buf = fs.readFileSync(p);
    const plain = safeStorage.decryptString(buf);
    const parsed = JSON.parse(plain);
    return typeof parsed === 'object' && parsed !== null ? (parsed as SecretsBlob) : {};
  } catch (err) {
    // Corrupted or undecryptable (e.g. keychain identity changed). Move aside
    // and start fresh — better than refusing to launch.
    const msg = err instanceof Error ? err.message : String(err);
    log('secrets', `Failed to read secrets (${msg}); moving to .corrupt`);
    try {
      fs.renameSync(p, p + '.corrupt-' + Date.now());
    } catch {
      /* best effort */
    }
    return {};
  }
}

function writeSecrets(secrets: SecretsBlob): void {
  ensureEncryption();
  const encrypted = safeStorage.encryptString(JSON.stringify(secrets));
  fs.mkdirSync(path.dirname(secretsPath()), { recursive: true });
  fs.writeFileSync(secretsPath(), encrypted, { mode: 0o600 });
}

// ── Public API ─────────────────────────────────────────────────────────────

export function listSecrets(): MaskedSecret[] {
  const secrets = readSecrets();
  return Object.entries(secrets)
    .map(([key, entry]) => ({
      key,
      masked: maskValue(entry.value),
      updatedAt: entry.updatedAt,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function saveSecret(key: string, value: string): void {
  if (!key) throw new Error('Key name is required');
  const secrets = readSecrets();
  secrets[key] = { value, updatedAt: new Date().toISOString() };
  writeSecrets(secrets);
}

export function saveManySecrets(entries: Array<{ key: string; value: string }>): void {
  const secrets = readSecrets();
  const now = new Date().toISOString();
  for (const { key, value } of entries) {
    if (!key) continue;
    secrets[key] = { value, updatedAt: now };
  }
  writeSecrets(secrets);
}

export function deleteSecret(key: string): void {
  const secrets = readSecrets();
  if (!(key in secrets)) return;
  delete secrets[key];
  writeSecrets(secrets);
}

export function revealSecret(key: string): string | undefined {
  return readSecrets()[key]?.value;
}

/**
 * Plaintext map of every saved key. Used by `electron/services/python.ts` to
 * inject the keys into the Python child's process env on spawn. Never call
 * from anywhere else.
 */
export function getSecretsForBackend(): Record<string, string> {
  const secrets = readSecrets();
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(secrets)) {
    out[key] = entry.value;
  }
  return out;
}

/**
 * Parse a .env file. Strips comments and surrounding quotes. Returns
 * plaintext values — caller is responsible for masking on display.
 */
export function parseEnvFile(filePath: string): ParsedEnvRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rows: ParsedEnvRow[] = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    // Strip inline trailing comments (e.g. `KEY=value # note`)
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const hashIdx = value.indexOf(' #');
      if (hashIdx !== -1) value = value.slice(0, hashIdx).trim();
    }
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!key) continue;
    rows.push({ key, value, masked: maskValue(value) });
  }
  return rows;
}
