import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { setupWebSocket } from './api/websocket.js';
import { startHeartbeatWorker, type HeartbeatJobData } from './workers/heartbeat.js';
import './workers/notificationWorker.js';
import './workers/dataIngestionWorker.js';
import './workers/agentRunWorker.js';
import { executeStrategy } from './services/executionService.js';
import { prisma } from './config/database.js';
import type { Bar } from './engine/interpreter.js';

/**
 * Desktop builds bundle a freshly-initialized Postgres with no schema. On the
 * first launch we materialize the schema by running the creation SQL produced
 * at bundle time by `prisma migrate diff --from-empty`. Idempotent: a probe
 * for any one Prisma-managed table short-circuits if the schema is already
 * there.
 */
async function ensureDesktopSchema(): Promise<void> {
    if (process.env.OPENQWNT_DESKTOP_MODE !== 'true') return;
    try {
        // Probe — if the users table exists the schema has already been
        // applied. Prisma maps `User` model → "users" via @@map.
        await prisma.$queryRawUnsafe('SELECT 1 FROM "users" LIMIT 1');
        logger.info('Desktop schema already present; skipping bootstrap.');
        return;
    } catch {
        // continue → apply schema
    }

    let DESKTOP_SCHEMA_SQL = '';
    try {
        const mod = await import('./services/desktopSchema.js');
        DESKTOP_SCHEMA_SQL = mod.DESKTOP_SCHEMA_SQL;
    } catch {
        logger.warn('desktopSchema.js not bundled — DB-backed routes will fail until migrations run');
        return;
    }

    if (!DESKTOP_SCHEMA_SQL.trim()) return;

    logger.info('Desktop mode: bootstrapping embedded Postgres schema…');
    // Postgres prepared statements (which Prisma uses under $executeRawUnsafe)
    // reject multi-statement strings, so split each DDL statement out and run
    // it separately. The Prisma-emitted SQL terminates each statement with
    // `;\n` and never has unquoted `;` mid-statement.
    const stmts = DESKTOP_SCHEMA_SQL
        .split(/;[ \t]*\n/)
        .map((s) => s.trim())
        // drop pure-comment chunks left over after splitting
        .filter((s) => s.length > 0 && !/^(--[^\n]*\n*)+$/.test(s));
    let applied = 0;
    let skipped = 0;
    for (const stmt of stmts) {
        try {
            await prisma.$executeRawUnsafe(stmt);
            applied++;
        } catch (err) {
            const msg = (err as Error).message || '';
            // "already exists" is benign on the second pass.
            if (msg.includes('already exists')) {
                skipped++;
            } else {
                logger.warn({ err: msg, stmt: stmt.slice(0, 120) }, 'DDL statement failed (continuing)');
            }
        }
    }
    logger.info({ applied, skipped, total: stmts.length }, 'Desktop schema bootstrap complete.');
}

await ensureDesktopSchema().catch((e) => logger.error({ err: e }, 'desktop schema bootstrap failed'));

const app = createApp();

const server = app.listen(env.PORT, () => {
    logger.info(
        {
            port: env.PORT,
            env: env.NODE_ENV,
        },
        `🚀 StrategyFlow Orchestrator listening on port ${env.PORT}`
    );
});

setupWebSocket(server);

async function heartbeatProcessor(job: { data: HeartbeatJobData }) {
    const { strategyId, userId } = job.data;
    logger.info({ strategyId }, 'Heartbeat tick');

    try {
        // Execute strategy without providing bar/history
        // executionService will fetch the necessary market data based on strategy settings
        await executeStrategy({
            strategyId,
            userId,
            triggerType: 'heartbeat',
        });
    } catch (error) {
        logger.error({ strategyId, error }, 'Heartbeat execution failed');
    }
}

startHeartbeatWorker(heartbeatProcessor);

const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
