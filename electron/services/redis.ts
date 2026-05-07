/**
 * Embedded redis-server.
 *
 * Bound to 127.0.0.1 on an ephemeral port. No persistence (`--save ""`,
 * `--appendonly no`) — BullMQ jobs in this app are ephemeral; durability
 * lives in Postgres.
 */

import { ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import { paths } from '../lib/paths';
import { attachStream, log } from '../lib/logger';
import { pickFreePort, sleep } from './ports';

export interface RedisHandle {
  port: number;
  proc: ChildProcess;
}

async function ping(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: '127.0.0.1', port });
    let buf = '';
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.on('connect', () => sock.write('*1\r\n$4\r\nPING\r\n'));
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      if (buf.includes('+PONG')) finish(true);
    });
    sock.on('error', () => finish(false));
    sock.setTimeout(750, () => finish(false));
  });
}

async function waitPong(port: number, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await ping(port)) return;
    await sleep(120);
  }
  throw new Error(`Redis did not respond to PING on :${port}`);
}

export async function startRedis(): Promise<RedisHandle> {
  const port = await pickFreePort();
  const p = paths();
  fs.mkdirSync(p.redisDir, { recursive: true });

  log('redis', `Starting on 127.0.0.1:${port}`);
  const proc = spawn(
    p.redisBin,
    [
      '--port', String(port),
      '--bind', '127.0.0.1',
      '--protected-mode', 'yes',
      '--save', '',
      '--appendonly', 'no',
      '--dir', p.redisDir,
      '--loglevel', 'notice',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  attachStream('redis', proc.stdout);
  attachStream('redis', proc.stderr);
  proc.on('exit', (code, sig) => log('redis', `exited code=${code} signal=${sig}`));

  await waitPong(port);
  return { port, proc };
}

export async function stopRedis(handle: RedisHandle): Promise<void> {
  if (handle.proc.exitCode !== null) return;
  handle.proc.kill('SIGTERM');
  for (let i = 0; i < 30; i++) {
    if (handle.proc.exitCode !== null) return;
    await sleep(100);
  }
  handle.proc.kill('SIGKILL');
}
