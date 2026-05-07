/**
 * Ephemeral free port picker, loopback only.
 *
 * Why not the `get-port` npm package? It's a single-call helper but has no way
 * to "reserve" a port — there's a race between picking and binding. We bind
 * directly with a server, capture the OS-assigned port, then close. The same
 * race exists but is small (~ms); avoiding the dependency keeps the bundle
 * surface narrow.
 */

import net from 'node:net';

export async function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen({ port: 0, host: '127.0.0.1' }, () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        srv.close();
        reject(new Error('Failed to pick free port'));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}

export async function waitForTcp(host: string, port: number, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await tryConnect(host, port)) return;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
}

async function tryConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    let done = false;
    const cleanup = (ok: boolean) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.once('connect', () => cleanup(true));
    sock.once('error', () => cleanup(false));
    sock.setTimeout(750, () => cleanup(false));
  });
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
