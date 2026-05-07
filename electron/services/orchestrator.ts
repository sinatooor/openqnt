/**
 * Bun-compiled orchestrator lifecycle.
 *
 * In dev mode, this is the locally-running `bun --watch src/index.ts` you
 * start yourself; the supervisor skips spawning it and just records URLs.
 *
 * In packaged builds, we spawn the single-file binary produced by
 * `bun build --compile`. JWT secret is generated once and persisted to
 * userData/config.json so JWT-stamped sessions survive app restarts.
 */

import { ChildProcess, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { paths, isDev } from '../lib/paths';
import { attachStream, log } from '../lib/logger';
import { pollUntilHealthy } from './health';
import { pickFreePort, sleep } from './ports';

export interface OrchestratorHandle {
  port: number;
  baseUrl: string;
  wsUrl: string;
  proc: ChildProcess | null; // null when running in dev (out-of-process)
}

interface OrchestratorOptions {
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
  pythonBaseUrl: string;
}

function getOrCreateJwtSecret(): { jwt: string; refresh: string; encryption: string } {
  const file = paths().configFile;
  if (fs.existsSync(file)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (cfg.jwt && cfg.refresh && cfg.encryption) return cfg;
    } catch {
      // fall through and regenerate
    }
  }
  const cfg = {
    jwt: crypto.randomBytes(48).toString('hex'),
    refresh: crypto.randomBytes(48).toString('hex'),
    encryption: crypto.randomBytes(32).toString('hex'),
  };
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8');
  fs.chmodSync(file, 0o600);
  return cfg;
}

export async function startOrchestrator(opts: OrchestratorOptions): Promise<OrchestratorHandle> {
  // Dev: assume the user is running `bun run dev` in orchestrator/ — point at
  // the conventional :3000.
  if (isDev()) {
    return {
      port: 3000,
      baseUrl: 'http://localhost:3000',
      wsUrl: 'ws://localhost:3000',
      proc: null,
    };
  }

  const p = paths();
  if (!fs.existsSync(p.orchestratorBinary)) {
    log('orchestrator', `Binary missing at ${p.orchestratorBinary} — orchestrator features will be unavailable.`);
    // Soft-fail: many users don't need orchestrator-only features. Return a
    // dummy handle so the supervisor can continue.
    return {
      port: 0,
      baseUrl: 'http://127.0.0.1:0',
      wsUrl: 'ws://127.0.0.1:0',
      proc: null,
    };
  }

  const port = await pickFreePort();
  const secrets = getOrCreateJwtSecret();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'production',
    OPENQWNT_DESKTOP_MODE: 'true',
    DATABASE_URL: opts.databaseUrl,
    REDIS_HOST: opts.redisHost,
    REDIS_PORT: String(opts.redisPort),
    JWT_SECRET: secrets.jwt,
    JWT_REFRESH_SECRET: secrets.refresh,
    ENCRYPTION_KEY: secrets.encryption,
    JWT_ACCESS_EXPIRY: '7d',
    JWT_REFRESH_EXPIRY: '30d',
    FRONTEND_URL: 'app://localhost',
    COMPUTE_SERVICE_URL: opts.pythonBaseUrl,
    LOG_LEVEL: 'info',
  };

  log('orchestrator', `Spawning ${p.orchestratorBinary} on :${port}`);
  const proc = spawn(p.orchestratorBinary, [], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  attachStream('orchestrator', proc.stdout);
  attachStream('orchestrator', proc.stderr);
  proc.on('exit', (code, sig) => log('orchestrator', `exited code=${code} signal=${sig}`));

  const baseUrl = `http://127.0.0.1:${port}`;
  // Orchestrator exposes /health (NOT /api/health — that route 404s).
  try {
    await pollUntilHealthy(`${baseUrl}/health`, { timeoutMs: 30_000, intervalMs: 500 });
  } catch (err) {
    log('orchestrator', `Health check failed: ${(err as Error).message} — features depending on orchestrator will degrade.`);
  }

  return {
    port,
    baseUrl,
    wsUrl: `ws://127.0.0.1:${port}`,
    proc,
  };
}

export async function stopOrchestrator(handle: OrchestratorHandle): Promise<void> {
  if (!handle.proc || handle.proc.exitCode !== null) return;
  handle.proc.kill('SIGTERM');
  for (let i = 0; i < 50; i++) {
    if (handle.proc.exitCode !== null) return;
    await sleep(100);
  }
  handle.proc.kill('SIGKILL');
}
