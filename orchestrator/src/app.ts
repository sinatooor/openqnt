import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { apiLimiter } from './api/middleware/rateLimit.js';
import healthRouter from './api/routes/health.js';
import authRouter from './api/routes/auth.js';
import strategiesRouter from './api/routes/strategies.js';
import strategyActionsRouter from './api/routes/strategyActions.js';
import agentRouter from './api/routes/agent.js';

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

    // ── Routes ────────────────────────────────────────────────
    app.use('/', healthRouter);
    app.use('/api/auth', authRouter);
    app.use('/api/strategies', strategiesRouter);
    app.use('/api/strategies', strategyActionsRouter); // compile, validate, deploy, pause, backtest
    app.use('/api/agent', agentRouter);
    // app.use('/api/executions', executionsRouter);
    // app.use('/api/credentials', credentialsRouter);
    // app.use('/api/portfolio', portfolioRouter);
    // app.use('/api/notifications', notificationsRouter);
    // app.use('/api/webhooks', webhooksRouter);
    // app.use('/api/ai', aiRouter);

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
