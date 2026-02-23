/**
 * Execution history API routes.
 * Provides paginated execution run listing, run details, and per-node logs.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// ── Schemas ─────────────────────────────────────────────────

const listQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    strategyId: z.string().uuid().optional(),
    status: z.enum(['running', 'success', 'error', 'skipped', 'cancelled']).optional(),
});

// ── Routes ──────────────────────────────────────────────────

/** GET /api/executions — list execution runs */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { page, limit, strategyId, status } = listQuerySchema.parse(req.query);
        const skip = (page - 1) * limit;

        const where = {
            userId: req.user!.userId,
            ...(strategyId ? { strategyId } : {}),
            ...(status ? { status } : {}),
        };

        const [runs, total] = await Promise.all([
            prisma.executionRun.findMany({
                where,
                select: {
                    id: true,
                    strategyId: true,
                    triggerType: true,
                    status: true,
                    durationMs: true,
                    nodesExecuted: true,
                    nodesSkipped: true,
                    nodesErrored: true,
                    pythonDelegations: true,
                    summary: true,
                    startedAt: true,
                    finishedAt: true,
                    strategy: { select: { name: true } },
                },
                orderBy: { startedAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.executionRun.count({ where }),
        ]);

        res.json({
            runs,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to list executions');
        res.status(500).json({ error: 'Failed to list executions' });
    }
});

/** GET /api/executions/:id — get full execution run with node logs */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const run = await prisma.executionRun.findFirst({
            where: {
                id: req.params.id,
                userId: req.user!.userId,
            },
            include: {
                strategy: { select: { name: true, id: true } },
                nodeLogs: {
                    orderBy: { executionOrder: 'asc' },
                },
            },
        });

        if (!run) {
            res.status(404).json({ error: 'Execution run not found' });
            return;
        }

        res.json({ run });
    } catch (error) {
        logger.error({ error }, 'Failed to get execution');
        res.status(500).json({ error: 'Failed to get execution' });
    }
});

/** GET /api/executions/:id/nodes — get per-node logs only */
router.get('/:id/nodes', async (req: Request, res: Response) => {
    try {
        // Verify ownership
        const run = await prisma.executionRun.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });
        if (!run) {
            res.status(404).json({ error: 'Execution run not found' });
            return;
        }

        const nodeLogs = await prisma.executionNodeLog.findMany({
            where: { executionRunId: req.params.id },
            orderBy: { executionOrder: 'asc' },
        });

        res.json({ nodeLogs });
    } catch (error) {
        logger.error({ error }, 'Failed to get node logs');
        res.status(500).json({ error: 'Failed to get node logs' });
    }
});

/** GET /api/executions/stats/summary — aggregate stats */
router.get('/stats/summary', async (req: Request, res: Response) => {
    try {
        const [totalRuns, successRuns, errorRuns] = await Promise.all([
            prisma.executionRun.count({ where: { userId: req.user!.userId } }),
            prisma.executionRun.count({ where: { userId: req.user!.userId, status: 'success' } }),
            prisma.executionRun.count({ where: { userId: req.user!.userId, status: 'error' } }),
        ]);

        res.json({
            stats: {
                totalRuns,
                successRuns,
                errorRuns,
                successRate: totalRuns > 0 ? (successRuns / totalRuns * 100).toFixed(1) : '0.0',
            },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to get stats');
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

export default router;
