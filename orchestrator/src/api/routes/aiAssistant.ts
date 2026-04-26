import { Router, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/ai-assistant/chat/stream
 * Proxies SSE chat stream to the Python compute service so the frontend
 * can consistently use the orchestrator as its control-plane entrypoint.
 */
router.post('/chat/stream', async (req: Request, res: Response) => {
    const controller = new AbortController();
    req.on('close', () => controller.abort());

    try {
        const upstream = await fetch(`${env.COMPUTE_SERVICE_URL}/api/ai-assistant/chat/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body ?? {}),
            signal: controller.signal,
        });

        if (!upstream.ok) {
            const text = await upstream.text();
            logger.warn({ status: upstream.status, text }, 'AI assistant upstream returned error');
            res.status(upstream.status).json({
                error: 'AI assistant request failed',
                detail: text,
            });
            return;
        }

        res.status(200);
        res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = upstream.body?.getReader();
        if (!reader) {
            res.end();
            return;
        }

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) res.write(Buffer.from(value));
        }

        res.end();
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            return;
        }

        logger.error({ error }, 'AI assistant stream proxy failed');
        if (!res.headersSent) {
            res.status(502).json({
                error: 'AI assistant stream unavailable',
            });
            return;
        }
        res.end();
    }
});

export default router;
