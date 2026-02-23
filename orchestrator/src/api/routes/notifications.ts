/**
 * Notification API routes.
 * List, read, and manage user notifications.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

/** GET /api/notifications — list user notifications */
router.get('/', async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const unreadOnly = req.query.unread === 'true';

        const where = {
            userId: req.user!.userId,
            ...(unreadOnly ? { read: false } : {}),
        };

        const [notifications, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { sentAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.notification.count({ where }),
            prisma.notification.count({ where: { userId: req.user!.userId, read: false } }),
        ]);

        res.json({
            notifications,
            unreadCount,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to list notifications');
        res.status(500).json({ error: 'Failed to list notifications' });
    }
});

/** PUT /api/notifications/:id/read — mark as read */
router.put('/:id/read', async (req: Request, res: Response) => {
    try {
        const notification = await prisma.notification.updateMany({
            where: { id: req.params.id, userId: req.user!.userId },
            data: { read: true, readAt: new Date() },
        });

        if (notification.count === 0) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }

        res.json({ message: 'Marked as read' });
    } catch (error) {
        logger.error({ error }, 'Failed to mark notification');
        res.status(500).json({ error: 'Failed' });
    }
});

/** PUT /api/notifications/read-all — mark all as read */
router.put('/read-all', async (_req: Request, res: Response) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: _req.user!.userId, read: false },
            data: { read: true, readAt: new Date() },
        });
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        logger.error({ error }, 'Failed to mark all read');
        res.status(500).json({ error: 'Failed' });
    }
});

export default router;
