import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

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

// Graceful shutdown
const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
