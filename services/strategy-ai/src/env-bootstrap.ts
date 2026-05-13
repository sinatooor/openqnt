/**
 * Load environment variables from the backend's `.env` so the sidecar inherits
 * the same `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` the Python backend already
 * uses. Skips any key that's already set so explicit env-vars win.
 *
 * Searched (first match wins):
 *   1. `process.env.STRATEGY_AI_ENV_FILE` (explicit override)
 *   2. `<repo>/services/strategy-ai/.env`
 *   3. `<repo>/backend/.env`
 *   4. `<repo>/.env`
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const findRepoRoot = (start: string): string => {
  let cur = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(cur, 'package.json')) && existsSync(join(cur, '.git'))) return cur;
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return start;
};

const parseEnvFile = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip matching surrounding quotes.
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
};

const tryLoad = (path: string): number => {
  if (!existsSync(path)) return 0;
  let count = 0;
  const parsed = parseEnvFile(readFileSync(path, 'utf8'));
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) {
      process.env[k] = v;
      count++;
    }
  }
  return count;
};

export const loadEnvFiles = (): void => {
  const here = new URL('.', import.meta.url).pathname;
  const repoRoot = findRepoRoot(here);
  const candidates: string[] = [];
  if (process.env.STRATEGY_AI_ENV_FILE) candidates.push(process.env.STRATEGY_AI_ENV_FILE);
  candidates.push(
    join(repoRoot, 'services/strategy-ai/.env'),
    join(repoRoot, 'backend/.env'),
    join(repoRoot, '.env'),
  );
  let loaded = 0;
  for (const p of candidates) {
    loaded += tryLoad(p);
    if (loaded > 0) break; // first hit wins
  }
};
