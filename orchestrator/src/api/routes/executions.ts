/**
 * Execution history API routes.
 * Provides paginated execution run listing, run details, and per-node logs.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { executeStrategy } from '../../services/executionService.js';
import { emitExecutionStarted, emitExecutionCompleted } from '../websocket.js';

const router = Router();
router.use(authMiddleware);

// ── Schemas ─────────────────────────────────────────────────

const listQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    strategyId: z.string().uuid().optional(),
    status: z.enum(['running', 'success', 'error', 'skipped', 'cancelled', 'pending_approval']).optional(),
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

/** POST /api/strategies/:id/execute — manually trigger strategy execution */
router.post('/strategies/:id/execute', async (req: Request, res: Response) => {
    try {
        const strategy = await prisma.strategy.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });

        if (!strategy) {
            res.status(404).json({ error: 'Strategy not found' });
            return;
        }

        // Emit execution started event
        emitExecutionStarted(req.user!.userId, strategy.id, 'pending');

        // Execute asynchronously so we can return the run ID immediately
        const resultPromise = executeStrategy({
            strategyId: strategy.id,
            userId: req.user!.userId,
            triggerType: 'manual',
            triggerData: req.body.triggerData,
        });

        // Wait for execution to complete (strategy runs are typically fast, <30s)
        const result = await resultPromise;

        // Emit completion event
        emitExecutionCompleted(req.user!.userId, strategy.id, {
            executionRunId: result.executionRunId,
            status: result.result.nodesErrored > 0 ? 'error' : 'success',
            durationMs: 0,
            orderIntents: result.result.orderIntents.length,
        });

        res.status(201).json({
            executionRunId: result.executionRunId,
            preChecksPassed: result.preChecksPassed,
            preCheckFailures: result.preCheckFailures,
            nodesExecuted: result.result.nodesExecuted,
            nodesErrored: result.result.nodesErrored,
            orderIntents: result.result.orderIntents.length,
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Manual execution failed');
        res.status(500).json({ error: error.message || 'Execution failed' });
    }
});

/** POST /api/executions/:id/replay — re-run a past execution with same or modified params */
router.post('/:id/replay', async (req: Request, res: Response) => {
    try {
        // Load the original execution run
        const originalRun = await prisma.executionRun.findFirst({
            where: {
                id: req.params.id,
                userId: req.user!.userId,
            },
            include: {
                strategy: { select: { id: true, name: true, nodes: true, edges: true } },
            },
        });

        if (!originalRun) {
            res.status(404).json({ error: 'Execution run not found' });
            return;
        }

        // Create a new execution run marked as a replay
        const replayRun = await prisma.executionRun.create({
            data: {
                userId: req.user!.userId,
                strategyId: originalRun.strategyId,
                triggerType: 'replay',
                status: 'running',
                startedAt: new Date(),
                triggerData: {
                    replayOf: originalRun.id,
                    originalTriggerType: originalRun.triggerType,
                    originalStartedAt: originalRun.startedAt,
                    ...(req.body.overrides ?? {}),
                },
            },
        });

        logger.info({ replayRunId: replayRun.id, originalRunId: originalRun.id }, 'Replay execution created');

        res.status(201).json({
            run: replayRun,
            message: 'Replay execution created and queued',
        });
    } catch (error) {
        logger.error({ error }, 'Failed to create replay execution');
        res.status(500).json({ error: 'Failed to create replay execution' });
    }
});

export default router;
