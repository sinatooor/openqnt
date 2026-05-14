/**
 * FastAPI backend lifecycle.
 *
 * Spawns the bundled CPython 3.12 (or, in dev, the local conda env) running
 * `uvicorn main:app --host 127.0.0.1 --port <ephemeral>`. OPENQWNT_DATA_DIR
 * points the backend at the writable userData directory so it doesn't try to
 * write into the read-only resources tree.
 */

import { ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { paths, isDev } from '../lib/paths';
import { attachStream, log } from '../lib/logger';
import { pollUntilHealthy } from './health';
import { pickFreePort, sleep } from './ports';
import { getSecretsForBackend } from '../lib/secrets';

export interface PythonHandle {
  port: number;
  baseUrl: string;
  proc: ChildProcess;
}

function buildEnv(opts: PythonStartOptions = {}): NodeJS.ProcessEnv {
  const p = paths();
  // User-managed API keys (decrypted on demand from the safeStorage-encrypted
  // secrets store). These OVERRIDE anything inherited via process.env so a
  // user-entered key always wins over a stale shell var.
  const userKeys = isDev() ? {} : getSecretsForBackend();
  const keyCount = Object.keys(userKeys).length;
  if (keyCount > 0) {
    log('backend', `Injecting ${keyCount} user-managed API keys into backend env`);
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...userKeys,
    OPENQWNT_DATA_DIR: p.userDataRoot,
    OPENQWNT_DESKTOP_MODE: 'true',
    SENTENCE_TRANSFORMERS_HOME: p.modelsDir,
    HF_HOME: p.modelsDir,
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONUNBUFFERED: '1',
  };

  // Wire the strategy-ai sidecar URL into Python's env so its chat endpoint
  // (ai_assistant.py) forwards build_strategy calls through the SSE bridge.
  // The supervisor pre-allocates the sidecar's port and passes the URL in
  // here BEFORE the sidecar actually binds — that's fine because Python only
  // opens the connection at agent-run time, by which point the sidecar is up.
  // If no URL is provided (sidecar binary missing on disk), keep the legacy
  // in-process AI generator as the chat's build_strategy path.
  if (opts.strategyAiUrl) {
    env.STRATEGY_AI_URL = opts.strategyAiUrl;
    env.AI_BUILDER_VIA_SIDECAR = 'true';
  } else {
    env.AI_BUILDER_VIA_SIDECAR = 'false';
  }

  if (!isDev()) {
    // In packaged builds, prepend our bundled site-packages to PYTHONPATH so the
    // standalone CPython picks them up before any system-installed packages.
    env.PYTHONPATH = [p.pythonLibs, env.PYTHONPATH ?? '']
      .filter(Boolean)
      .join(path.delimiter);
  }
  return env;
}

export interface PythonStartOptions {
  /** URL the chat should forward build_strategy calls to. Undefined when the
   * strategy-ai sidecar binary is missing — Python then uses the legacy path. */
  strategyAiUrl?: string;
}

export async function startPython(opts: PythonStartOptions = {}): Promise<PythonHandle> {
  const p = paths();
  if (!fs.existsSync(p.pythonBin)) {
    throw new Error(
      `Python interpreter not found at ${p.pythonBin}. ` +
      `Run \`bun run electron:bundle-python\` (packaged) or set up the conda env (dev).`,
    );
  }

  const port = await pickFreePort();
  const env = buildEnv(opts);

  log('backend', `Spawning uvicorn on 127.0.0.1:${port} (cwd=${p.backendDir})`);
  const proc = spawn(
    p.pythonBin,
    [
      '-m', 'uvicorn',
      'main:app',
      '--host', '127.0.0.1',
      '--port', String(port),
      '--no-access-log',
      '--log-level', 'info',
    ],
    {
      cwd: p.backendDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  attachStream('backend', proc.stdout);
  attachStream('backend', proc.stderr);
  proc.on('exit', (code, sig) => log('backend', `exited code=${code} signal=${sig}`));

  // /health responds quickly once the FastAPI startup events have run; the
  // first `init_db()` + Gemini-config print can take a couple seconds.
  const baseUrl = `http://127.0.0.1:${port}`;
  await pollUntilHealthy(`${baseUrl}/health`, { timeoutMs: 60_000, intervalMs: 250 });

  return { port, baseUrl, proc };
}

export async function stopPython(handle: PythonHandle): Promise<void> {
  if (handle.proc.exitCode !== null) return;
  handle.proc.kill('SIGTERM');
  for (let i = 0; i < 50; i++) {
    if (handle.proc.exitCode !== null) return;
    await sleep(100);
  }
  handle.proc.kill('SIGKILL');
}
