/**
 * Internal notification dispatch — Python ↔ Node orchestrator bridge.
 *
 * Mounted BEFORE the user-facing `notificationsRouter` so its public path
 * (`/api/notifications/dispatch`) isn't shadowed by `authMiddleware`.
 *
 * Gate: shared-secret header `X-Internal-Token` matched against
 * `env.INTERNAL_API_TOKEN`. If the env var is unset we keep the route
 * mounted but reject every request — fail closed.
 *
 * Caller: `backend/adk_agents/tools/notification_tools.py:send_notification`.
 */

import { Router, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { notificationQueue } from '../../services/notificationService.js';

const router = Router();

interface DispatchBody {
    userId: string;
    channel: string;
    title?: string;
    body: string;
    executionRunId?: string;
    metadata?: Record<string, any>;
    telegram?: { chatId: string; parseMode?: 'MarkdownV2' | 'HTML' };
    attachments?: Array<{
        kind: 'photo' | 'document';
        path?: string;
        /** Base64-encoded file content (for non-shared-FS deployments). */
        bufferBase64?: string;
        filename?: string;
        caption?: string;
    }>;
}

router.post('/dispatch', async (req: Request, res: Response) => {
    const expected = env.INTERNAL_API_TOKEN;
    if (!expected) {
        res.status(503).json({ error: 'INTERNAL_API_TOKEN not configured' });
        return;
    }
    const provided = req.header('X-Internal-Token');
    if (provided !== expected) {
        res.status(401).json({ error: 'invalid internal token' });
        return;
    }

    const body = req.body as DispatchBody;
    if (!body?.userId || !body?.channel || typeof body?.body !== 'string') {
        res.status(400).json({ error: 'userId, channel, body are required' });
        return;
    }

    try {
        await notificationQueue.add('internal-dispatch', {
            userId: body.userId,
            executionRunId: body.executionRunId,
            channel: body.channel.toLowerCase(),
            type: 'alert',
            title: body.title ?? 'Notification',
            body: body.body,
            metadata: body.metadata,
            telegram: body.telegram,
            attachments: body.attachments?.map((a) => ({
                kind: a.kind,
                path: a.path,
                buffer: a.bufferBase64 ? Buffer.from(a.bufferBase64, 'base64') : undefined,
                filename: a.filename,
                caption: a.caption,
            })),
        });
        res.json({ ok: true });
    } catch (err) {
        logger.error({ err }, 'internal dispatch failed');
        res.status(500).json({ error: 'enqueue failed' });
    }
});

export default router;
