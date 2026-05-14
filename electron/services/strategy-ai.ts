/**
 * Strategy AI sidecar lifecycle — runs the n8n-inspired Builder agent in a
 * separate Bun-compiled binary so the Python backend can fan its
 * `build_strategy` tool calls out to a focused agent loop with its own
 * validate→fix cycle, prompt caching, and streaming SSE.
 *
 * In dev mode the user runs `bun --watch src/index.ts` from services/strategy-ai/
 * themselves; this module skips spawning and just returns the conventional
 * :3050 URL. In packaged builds we spawn `resources/strategy-ai-<arch>`
 * (single-file binary produced by bun build --compile).
 *
 * If the binary is missing or fails to start, the supervisor soft-fails:
 * the chat falls back to the in-process AI generator (legacy path) so the
 * desktop app stays usable.
 */

import { ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import { paths, isDev } from '../lib/paths';
import { attachStream, log } from '../lib/logger';
import { pollUntilHealthy } from './health';
import { sleep } from './ports';
import { getSecretsForBackend } from '../lib/secrets';

export interface StrategyAiHandle {
  /** 0 when the sidecar is unavailable (dev fallback URL still useful). */
  port: number;
  baseUrl: string;
  proc: ChildProcess | null;
  available: boolean;
}

interface StrategyAiOptions {
  pythonBaseUrl: string;
  /**
   * Pre-allocated port. The supervisor allocates this BEFORE spawning Python
   * so it can wire `STRATEGY_AI_URL=http://127.0.0.1:<port>` into Python's env
   * upfront. The sidecar only needs to bind to it when it boots a moment later.
   */
  port: number;
}

export async function startStrategyAi(opts: StrategyAiOptions): Promise<StrategyAiHandle> {
  // Dev: assume the user is running `bun run dev` in services/strategy-ai/.
  if (isDev()) {
    return {
      port: 3050,
      baseUrl: 'http://127.0.0.1:3050',
      proc: null,
      available: true,
    };
  }

  const p = paths();
  if (!fs.existsSync(p.strategyAiBinary)) {
    log('strategy-ai', `Binary missing at ${p.strategyAiBinary} — Builder agent unavailable; chat will use legacy generator.`);
    return {
      port: 0,
      baseUrl: 'http://127.0.0.1:0',
      proc: null,
      available: false,
    };
  }

  // We pull the user's Anthropic key (and Google as fallback) out of the
  // safeStorage-encrypted secrets store the same way python.ts does. The
  // sidecar's `env-bootstrap.ts` looks for backend/.env which doesn't exist
  // in packaged builds, so explicit env passing is what wires it up.
  const userKeys = getSecretsForBackend();
  const passthrough: Record<string, string> = {};
  for (const k of ['ANTHROPIC_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY']) {
    if (userKeys[k]) passthrough[k] = userKeys[k];
  }

  const port = opts.port;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...passthrough,
    STRATEGY_AI_PORT: String(port),
    STRATEGY_PY_URL: opts.pythonBaseUrl,
    // Default to Sonnet 4.6 (see services/strategy-ai/src/builder/model.ts —
    // @ai-sdk/anthropic@1.x sets a default temperature that Opus 4.7 rejects).
    STRATEGY_AI_PROVIDER: process.env.STRATEGY_AI_PROVIDER ?? 'anthropic',
  };

  log('strategy-ai', `Spawning ${p.strategyAiBinary} on :${port}`);
  const proc = spawn(p.strategyAiBinary, [], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  attachStream('strategy-ai', proc.stdout);
  attachStream('strategy-ai', proc.stderr);
  proc.on('exit', (code, sig) => log('strategy-ai', `exited code=${code} signal=${sig}`));

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await pollUntilHealthy(`${baseUrl}/health`, { timeoutMs: 20_000, intervalMs: 500 });
  } catch (err) {
    log('strategy-ai', `Health check failed: ${(err as Error).message} — Builder agent will be unavailable; chat falls back to legacy.`);
    return { port: 0, baseUrl: 'http://127.0.0.1:0', proc, available: false };
  }

  return { port, baseUrl, proc, available: true };
}

export async function stopStrategyAi(handle: StrategyAiHandle): Promise<void> {
  if (!handle.proc || handle.proc.exitCode !== null) return;
  handle.proc.kill('SIGTERM');
  for (let i = 0; i < 50; i++) {
    if (handle.proc.exitCode !== null) return;
    await sleep(100);
  }
  handle.proc.kill('SIGKILL');
}
