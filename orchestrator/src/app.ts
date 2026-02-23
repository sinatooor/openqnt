import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { apiLimiter } from './api/middleware/rateLimit.js';
import healthRouter from './api/routes/health.js';
import authRouter from './api/routes/auth.js';
import strategiesRouter from './api/routes/strategies.js';
import strategyActionsRouter from './api/routes/strategyActions.js';
import agentRouter from './api/routes/agent.js';
import executionsRouter from './api/routes/executions.js';
import credentialsRouter from './api/routes/credentials.js';
import notificationsRouter from './api/routes/notifications.js';
import portfolioRouter from './api/routes/portfolio.js';
import aiRouter from './api/routes/ai.js';
import webhooksRouter from './api/routes/webhooks.js';
import { getHeartbeatQueue } from './workers/heartbeat.js';

export function createApp() {
    const app = express();

    // ── Security ──────────────────────────────────────────────
    app.use(helmet());
    app.use(
        cors({
            origin: env.FRONTEND_URL,
            credentials: true,
        })
    );

    // ── Parsing ───────────────────────────────────────────────
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // ── Rate Limiting ─────────────────────────────────────────
    app.use('/api/', apiLimiter);

    // ── Request Logging ───────────────────────────────────────
    app.use((req: Request, _res: Response, next: NextFunction) => {
        logger.info({ method: req.method, url: req.url }, 'incoming request');
        next();
    });

    // ── Bull Board (BullMQ Monitoring Dashboard) ──────────────
    try {
        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/admin/queues');
        const heartbeatQueue = getHeartbeatQueue();
        if (heartbeatQueue) {
            createBullBoard({
                queues: [new BullMQAdapter(heartbeatQueue)],
                serverAdapter,
            });
        }
        app.use('/admin/queues', serverAdapter.getRouter());
        logger.info('Bull Board dashboard available at /admin/queues');
    } catch (err) {
        logger.warn({ err }, 'Bull Board setup skipped (queue may not be initialized yet)');
    }

    // ── Routes ────────────────────────────────────────────────
    app.use('/', healthRouter);
    app.use('/api/auth', authRouter);
    app.use('/api/strategies', strategiesRouter);
    app.use('/api/strategies', strategyActionsRouter); // compile, validate, deploy, pause, backtest
    app.use('/api/agent', agentRouter);
    app.use('/api/executions', executionsRouter);
    app.use('/api/credentials', credentialsRouter);
    app.use('/api/notifications', notificationsRouter);
    app.use('/api/portfolio', portfolioRouter);
    app.use('/api/ai', aiRouter);
    app.use('/api/webhooks', webhooksRouter);

    // ── Error Handler ─────────────────────────────────────────
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
        logger.error({ err }, 'Unhandled error');
        res.status(500).json({
            error: 'Internal server error',
            ...(env.NODE_ENV === 'development' ? { message: err.message } : {}),
        });
    });

    return app;
}

