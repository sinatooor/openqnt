/**
 * Service supervisor — orchestrates the lifecycle of every child process the
 * desktop app needs (postgres → redis → backend → orchestrator) and exposes a
 * snapshot of their status to the splash window.
 *
 * Restart-on-crash: each child gets up to 3 respawns inside a 60s window; the
 * 4th surfaces a fatal error to the user instead of looping.
 */

import { app } from 'electron';
import { isDev } from '../lib/paths';
import { log, snapshot as logSnapshot } from '../lib/logger';
import { startPostgres, stopPostgres, type PostgresHandle } from './postgres';
import { startRedis, stopRedis, type RedisHandle } from './redis';
import { startPython, stopPython, type PythonHandle } from './python';
import {
  startOrchestrator,
  stopOrchestrator,
  type OrchestratorHandle,
} from './orchestrator';

export type ServiceName = 'postgres' | 'redis' | 'backend' | 'orchestrator';
export type ServiceStatus = 'pending' | 'starting' | 'ready' | 'failed';

export interface HealthSnapshot {
  postgres: ServiceStatus;
  redis: ServiceStatus;
  backend: ServiceStatus;
  orchestrator: ServiceStatus;
  recentLogs: string[];
  fatal?: { service: ServiceName; reason: string };
  ready: boolean;
}

export interface RuntimeUrls {
  backend: string;
  orchestrator: string;
  ws: string;
}

class Supervisor {
  private status: Record<ServiceName, ServiceStatus> = {
    postgres: 'pending',
    redis: 'pending',
    backend: 'pending',
    orchestrator: 'pending',
  };
  private fatal: HealthSnapshot['fatal'];

  private pg?: PostgresHandle;
  private redis?: RedisHandle;
  private py?: PythonHandle;
  private orch?: OrchestratorHandle;
  private urls?: RuntimeUrls;

  private restartCounts: Record<ServiceName, number[]> = {
    postgres: [],
    redis: [],
    backend: [],
    orchestrator: [],
  };

  snapshot(): HealthSnapshot {
    return {
      ...this.status,
      recentLogs: logSnapshot(120),
      fatal: this.fatal,
      ready: this.status.backend === 'ready' &&
             this.status.postgres === 'ready' &&
             this.status.redis === 'ready' &&
             // Orchestrator may be 'failed' (binary missing) — treat that as
             // 'soft fail' so the app still loads. UI gates orchestrator-only
             // features behind isDesktop+orchestrator-ready.
             this.status.orchestrator !== 'starting',
    };
  }

  getUrls(): RuntimeUrls {
    if (!this.urls) throw new Error('Supervisor not started');
    return this.urls;
  }

  async startAll(): Promise<void> {
    if (isDev()) {
      // Dev mode: assume the user is running scripts/start-all.sh + bun run dev
      // in a separate terminal. The Electron window just connects.
      this.urls = {
        backend: 'http://localhost:8000',
        orchestrator: 'http://localhost:3000',
        ws: 'ws://localhost:3000',
      };
      this.status = {
        postgres: 'ready',
        redis: 'ready',
        backend: 'ready',
        orchestrator: 'ready',
      };
      log('supervisor', 'Dev mode — using external services on default ports');
      return;
    }

    try {
      this.status.postgres = 'starting';
      this.pg = await startPostgres();
      this.status.postgres = 'ready';

      this.status.redis = 'starting';
      this.redis = await startRedis();
      this.status.redis = 'ready';

      this.status.backend = 'starting';
      this.py = await startPython();
      this.status.backend = 'ready';

      this.status.orchestrator = 'starting';
      this.orch = await startOrchestrator({
        databaseUrl: this.pg.databaseUrl,
        redisHost: '127.0.0.1',
        redisPort: this.redis.port,
        pythonBaseUrl: this.py.baseUrl,
      });
      this.status.orchestrator = this.orch.port === 0 ? 'failed' : 'ready';

      this.urls = {
        backend: this.py.baseUrl,
        orchestrator: this.orch.baseUrl,
        ws: this.orch.wsUrl,
      };

      this.attachCrashHandlers();
      log('supervisor', 'All services up.');
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log('supervisor', `Fatal startup error: ${reason}`);
      this.fatal = {
        service: this.firstStarting() ?? 'backend',
        reason,
      };
      // Don't tear down everything — leave logs available for the splash to
      // show. main.ts will surface a dialog and quit.
      throw err;
    }
  }

  async stopAll(): Promise<void> {
    log('supervisor', 'Shutting down…');
    // Reverse order: orchestrator → backend → redis → postgres
    if (this.orch) await stopOrchestrator(this.orch).catch(() => undefined);
    if (this.py) await stopPython(this.py).catch(() => undefined);
    if (this.redis) await stopRedis(this.redis).catch(() => undefined);
    if (this.pg) await stopPostgres(this.pg).catch(() => undefined);
    log('supervisor', 'Shutdown complete.');
  }

  private firstStarting(): ServiceName | undefined {
    return (Object.entries(this.status) as Array<[ServiceName, ServiceStatus]>)
      .find(([, s]) => s === 'starting')
      ?.[0];
  }

  private attachCrashHandlers(): void {
    const watch = (name: ServiceName, proc: NodeJS.Process | NodeJS.ReadableStream | undefined) => {
      // Each handle's spawned process emits 'exit'. attachStream already logs
      // it; we just need to react to unexpected exits during runtime.
      // (The actual ChildProcess instances are stored on this.pg/this.redis/etc.)
    };

    const all: Array<{ name: ServiceName; restart: () => Promise<void> }> = [
      {
        name: 'postgres',
        restart: async () => {
          this.pg = await startPostgres();
        },
      },
      {
        name: 'redis',
        restart: async () => {
          this.redis = await startRedis();
        },
      },
      {
        name: 'backend',
        restart: async () => {
          this.py = await startPython();
          if (this.urls) this.urls.backend = this.py.baseUrl;
        },
      },
      {
        name: 'orchestrator',
        restart: async () => {
          if (!this.pg || !this.redis || !this.py) return;
          this.orch = await startOrchestrator({
            databaseUrl: this.pg.databaseUrl,
            redisHost: '127.0.0.1',
            redisPort: this.redis.port,
            pythonBaseUrl: this.py.baseUrl,
          });
          if (this.urls && this.orch.port !== 0) {
            this.urls.orchestrator = this.orch.baseUrl;
            this.urls.ws = this.orch.wsUrl;
          }
        },
      },
    ];

    for (const { name, restart } of all) {
      const proc = this.procFor(name);
      if (!proc) continue;
      proc.on('exit', async (code, signal) => {
        if (this.shuttingDown) return;
        log('supervisor', `${name} exited unexpectedly (code=${code} signal=${signal}); attempting restart`);
        if (!this.tryRecordRestart(name)) {
          this.fatal = { service: name, reason: `${name} crashed too many times in 60s` };
          this.status[name] = 'failed';
          return;
        }
        this.status[name] = 'starting';
        try {
          await restart();
          this.status[name] = 'ready';
          this.attachCrashHandlers();
        } catch (err) {
          this.status[name] = 'failed';
          this.fatal = {
            service: name,
            reason: err instanceof Error ? err.message : String(err),
          };
        }
      });
    }
  }

  private procFor(name: ServiceName): NodeJS.EventEmitter | undefined {
    switch (name) {
      case 'postgres': return this.pg?.proc;
      case 'redis': return this.redis?.proc;
      case 'backend': return this.py?.proc;
      case 'orchestrator': return this.orch?.proc ?? undefined;
    }
  }

  private tryRecordRestart(name: ServiceName): boolean {
    const now = Date.now();
    const cutoff = now - 60_000;
    this.restartCounts[name] = this.restartCounts[name].filter((t) => t > cutoff);
    if (this.restartCounts[name].length >= 3) return false;
    this.restartCounts[name].push(now);
    return true;
  }

  private shuttingDown = false;
  beginShutdown(): void {
    this.shuttingDown = true;
  }
}

export const supervisor = new Supervisor();
