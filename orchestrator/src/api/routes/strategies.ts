import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// All strategy routes require authentication
router.use(authMiddleware);

// ── Schemas ─────────────────────────────────────────────────

const createStrategySchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    nodes: z.array(z.any()).default([]),
    edges: z.array(z.any()).default([]),
    settings: z.record(z.any()).optional(),
});

const updateStrategySchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    nodes: z.array(z.any()).optional(),
    edges: z.array(z.any()).optional(),
    settings: z.record(z.any()).optional(),
    changeDescription: z.string().max(500).optional(),
});

const listQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
});

// ── Routes ──────────────────────────────────────────────────

/** GET /api/strategies — list user's strategies */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { page, limit, status } = listQuerySchema.parse(req.query);
        const skip = (page - 1) * limit;

        const where = {
            userId: req.user!.userId,
            ...(status ? { status } : { status: { not: 'archived' as const } }),
        };

        const [strategies, total] = await Promise.all([
            prisma.strategy.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    status: true,
                    currentVersion: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.strategy.count({ where }),
        ]);

        res.json({
            strategies,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to list strategies');
        res.status(500).json({ error: 'Failed to list strategies' });
    }
});

/** POST /api/strategies — create new strategy */
router.post('/', validate(createStrategySchema), async (req: Request, res: Response) => {
    try {
        const { name, description, nodes, edges, settings } = req.body;

        const strategy = await prisma.strategy.create({
            data: {
                userId: req.user!.userId,
                name,
                description,
                nodes,
                edges,
                settings,
            },
        });

        // Create initial version
        await prisma.strategyVersion.create({
            data: {
                strategyId: strategy.id,
                versionNumber: 1,
                nodesSnapshot: nodes,
                edgesSnapshot: edges,
                settingsSnapshot: settings,
                changeDescription: 'Initial version',
            },
        });

        logger.info({ strategyId: strategy.id, userId: req.user!.userId }, 'Strategy created');
        res.status(201).json({ strategy });
    } catch (error) {
        logger.error({ error }, 'Failed to create strategy');
        res.status(500).json({ error: 'Failed to create strategy' });
    }
});

/** GET /api/strategies/:id — get strategy with full nodes/edges */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const strategy = await prisma.strategy.findFirst({
            where: {
                id: req.params.id,
                userId: req.user!.userId,
            },
        });

        if (!strategy) {
            res.status(404).json({ error: 'Strategy not found' });
            return;
        }

        res.json({ strategy });
    } catch (error) {
        logger.error({ error }, 'Failed to get strategy');
        res.status(500).json({ error: 'Failed to get strategy' });
    }
});

/** PUT /api/strategies/:id — update strategy (auto-creates version) */
router.put('/:id', validate(updateStrategySchema), async (req: Request, res: Response) => {
    try {
        const existing = await prisma.strategy.findFirst({
            where: {
                id: req.params.id,
                userId: req.user!.userId,
            },
        });

        if (!existing) {
            res.status(404).json({ error: 'Strategy not found' });
            return;
        }

        const { changeDescription, ...updateData } = req.body;
        const newVersion = existing.currentVersion + 1;

        // Use transaction to update strategy and create version atomically
        const [strategy] = await prisma.$transaction([
            prisma.strategy.update({
                where: { id: req.params.id },
                data: {
                    ...updateData,
                    currentVersion: newVersion,
                },
            }),
            prisma.strategyVersion.create({
                data: {
                    strategyId: req.params.id,
                    versionNumber: newVersion,
                    nodesSnapshot: updateData.nodes ?? existing.nodes,
                    edgesSnapshot: updateData.edges ?? existing.edges,
                    settingsSnapshot: updateData.settings ?? existing.settings,
                    changeDescription: changeDescription ?? `Version ${newVersion}`,
                },
            }),
        ]);

        logger.info({ strategyId: strategy.id, version: newVersion }, 'Strategy updated');
        res.json({ strategy });
    } catch (error) {
        logger.error({ error }, 'Failed to update strategy');
        res.status(500).json({ error: 'Failed to update strategy' });
    }
});

/** DELETE /api/strategies/:id — soft-delete (archive) */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const existing = await prisma.strategy.findFirst({
            where: {
                id: req.params.id,
                userId: req.user!.userId,
            },
        });

        if (!existing) {
            res.status(404).json({ error: 'Strategy not found' });
            return;
        }

        await prisma.strategy.update({
            where: { id: req.params.id },
            data: { status: 'archived' },
        });

        logger.info({ strategyId: req.params.id }, 'Strategy archived');
        res.json({ message: 'Strategy archived' });
    } catch (error) {
        logger.error({ error }, 'Failed to delete strategy');
        res.status(500).json({ error: 'Failed to delete strategy' });
    }
});

/** GET /api/strategies/:id/versions — get version history */
router.get('/:id/versions', async (req: Request, res: Response) => {
    try {
        // Verify ownership
        const strategy = await prisma.strategy.findFirst({
            where: {
                id: req.params.id,
                userId: req.user!.userId,
            },
        });

        if (!strategy) {
            res.status(404).json({ error: 'Strategy not found' });
            return;
        }

        const versions = await prisma.strategyVersion.findMany({
            where: { strategyId: req.params.id },
            select: {
                id: true,
                versionNumber: true,
                changeDescription: true,
                createdAt: true,
            },
            orderBy: { versionNumber: 'desc' },
        });

        res.json({ versions });
    } catch (error) {
        logger.error({ error }, 'Failed to get versions');
        res.status(500).json({ error: 'Failed to get versions' });
    }
});

export default router;
