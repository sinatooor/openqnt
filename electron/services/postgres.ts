/**
 * Embedded Postgres lifecycle.
 *
 * On first launch (no PG_VERSION in pgdata): run initdb, write a minimal
 * postgresql.conf, start, then create the `openqnt` database via
 * postgres single-user mode (since the embedded-postgres tarball ships
 * neither `psql` nor `createdb`). On subsequent launches just start.
 *
 * Readiness check: TCP connect on the chosen port (no `pg_isready` either).
 *
 * Trust auth + 127.0.0.1 + ephemeral port = safe for a single-user desktop.
 */

import { ChildProcess, execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { paths } from '../lib/paths';
import { attachStream, log } from '../lib/logger';
import { pickFreePort, sleep } from './ports';

const execFileAsync = promisify(execFile);

export interface PostgresHandle {
  port: number;
  databaseUrl: string;
  proc: ChildProcess;
}

const PG_USER = 'openqnt';
const PG_DB = 'openqnt';

function pgBin(name: 'initdb' | 'postgres' | 'pg_ctl'): string {
  return path.join(paths().postgresBinDir, name);
}

function libDir(): string {
  // <postgresBinDir>/../lib
  return path.resolve(paths().postgresBinDir, '..', 'lib');
}

function shareDir(): string {
  return path.resolve(paths().postgresBinDir, '..', 'share');
}

/** TCP-level liveness probe on the postgres listener. */
async function tcpReady(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: '127.0.0.1', port });
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.on('connect', () => finish(true));
    sock.on('error', () => finish(false));
    sock.setTimeout(750, () => finish(false));
  });
}

async function waitReady(port: number, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await tcpReady(port)) return;
    await sleep(200);
  }
  throw new Error(`Postgres did not become ready on :${port}`);
}

/** initdb if pgdata doesn't yet have a PG_VERSION file. */
async function initdbIfNeeded(dataDir: string): Promise<void> {
  if (fs.existsSync(path.join(dataDir, 'PG_VERSION'))) return;
  log('postgres', `Initializing pgdata at ${dataDir}…`);
  fs.mkdirSync(dataDir, { recursive: true });
  const env = { ...process.env, LC_ALL: 'C', PGSHAREDIR: shareDir() };
  await execFileAsync(
    pgBin('initdb'),
    ['-D', dataDir, '-U', PG_USER, '-A', 'trust', '-E', 'UTF8'],
    { env },
  );
}

function writeConfig(dataDir: string, port: number): void {
  const conf = [
    `port = ${port}`,
    `listen_addresses = '127.0.0.1'`,
    `unix_socket_directories = ''`,
    `shared_buffers = 64MB`,
    `max_connections = 50`,
    `log_destination = 'stderr'`,
    `logging_collector = off`,
    `log_statement = 'none'`,
    `fsync = on`,
    // Tell postgres where to find timezone files we shipped under share/.
    `timezone = 'UTC'`,
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(dataDir, 'postgresql.conf'), conf, 'utf8');
}

/**
 * Create the openqnt DB if it doesn't exist. Uses postgres single-user mode
 * because the embedded-postgres package doesn't include `createdb` or `psql`.
 *
 * Single-user mode requires the postgres listener to be STOPPED. Caller
 * arranges that — we run this between initdb and the long-running spawn.
 */
async function createDatabaseSingleUser(dataDir: string): Promise<void> {
  // First check whether the DB already exists — if so, skip. We do that by
  // listing pg_database via single-user mode.
  const env = {
    ...process.env,
    LC_ALL: 'C',
    PGSHAREDIR: shareDir(),
    DYLD_LIBRARY_PATH: [libDir(), process.env.DYLD_LIBRARY_PATH ?? ''].filter(Boolean).join(':'),
  };
  const probe = await runSingleUser(dataDir, "SELECT datname FROM pg_database;", env);
  if (probe.includes(PG_DB)) {
    log('postgres', `Database "${PG_DB}" already exists`);
    return;
  }
  log('postgres', `Creating database "${PG_DB}" via single-user mode`);
  await runSingleUser(dataDir, `CREATE DATABASE ${PG_DB} OWNER ${PG_USER};`, env);
}

/** Run a SQL string via `postgres --single` against the bootstrap DB. */
function runSingleUser(dataDir: string, sql: string, env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      pgBin('postgres'),
      ['--single', '-D', dataDir, '-E', 'postgres'],
      { env, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let out = '';
    let err = '';
    proc.stdout?.on('data', (c) => { out += c.toString(); });
    proc.stderr?.on('data', (c) => { err += c.toString(); });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0 || code === null) resolve(out + err);
      else reject(new Error(`postgres --single exited ${code}: ${err}`));
    });
    proc.stdin?.write(sql + '\n');
    proc.stdin?.end();
  });
}

export async function startPostgres(): Promise<PostgresHandle> {
  const port = await pickFreePort();
  const dataDir = paths().pgDataDir;

  await initdbIfNeeded(dataDir);
  writeConfig(dataDir, port);
  await createDatabaseSingleUser(dataDir);

  log('postgres', `Starting on 127.0.0.1:${port}`);
  const env = {
    ...process.env,
    LC_ALL: 'C',
    PGSHAREDIR: shareDir(),
    DYLD_LIBRARY_PATH: [libDir(), process.env.DYLD_LIBRARY_PATH ?? ''].filter(Boolean).join(':'),
  };
  const proc = spawn(pgBin('postgres'), ['-D', dataDir], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  attachStream('postgres', proc.stdout);
  attachStream('postgres', proc.stderr);
  proc.on('exit', (code, sig) => log('postgres', `exited code=${code} signal=${sig}`));

  await waitReady(port);

  return {
    port,
    databaseUrl: `postgresql://${PG_USER}@127.0.0.1:${port}/${PG_DB}?schema=public`,
    proc,
  };
}

export async function stopPostgres(handle: PostgresHandle): Promise<void> {
  if (handle.proc.exitCode !== null) return;
  // Polite SIGTERM gives postgres time to checkpoint and write shutdown.
  handle.proc.kill('SIGTERM');
  for (let i = 0; i < 80; i++) {
    if (handle.proc.exitCode !== null) return;
    await sleep(100);
  }
  handle.proc.kill('SIGKILL');
}
