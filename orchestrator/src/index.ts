import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { setupWebSocket } from './api/websocket.js';
import { startHeartbeatWorker, type HeartbeatJobData } from './workers/heartbeat.js';
import './workers/notificationWorker.js';
import './workers/newsWorker.js';
import { executeStrategy } from './services/executionService.js';
import type { Bar } from './engine/interpreter.js';

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
        const now = new Date();
        const bar: Bar = {
            timestamp: now.toISOString(),
            open: 0,
            high: 0,
            low: 0,
            close: 0,
            volume: 0,
            symbol: 'UNKNOWN',
        };

        await executeStrategy({
            strategyId,
            userId,
            triggerType: 'heartbeat',
            bar,
            history: [],
            barIndex: 0,
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
