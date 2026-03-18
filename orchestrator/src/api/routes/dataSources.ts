import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { DataIngestionService } from '../../services/dataIngestionService.js';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// All data source routes require authentication
router.use(authMiddleware);

// ── Schemas ─────────────────────────────────────────────────

const createSourceSchema = z.object({
    type: z.enum([
        'news', 'earnings', 'filing', 'macro', 'insider', 'congress',
        'whale_13f', 'social', 'analyst', 'options', 'crypto_whale', 'custom',
    ]),
    name: z.string().min(1).max(200),
    config: z.record(z.any()),
    scheduleSeconds: z.number().min(60).max(86400).optional(), // 1 min to 24 hours
});

const updateSourceSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    config: z.record(z.any()).optional(),
    scheduleSeconds: z.number().min(60).max(86400).optional(),
    enabled: z.boolean().optional(),
});

// ── Routes ──────────────────────────────────────────────────

/** GET /api/data-sources — list user's configured data sources */
router.get('/', async (req: Request, res: Response) => {
    try {
        const sources = await DataIngestionService.listSources(req.user!.userId);
        res.json({ sources });
    } catch (error) {
        logger.error({ error }, 'Failed to list data sources');
        res.status(500).json({ error: 'Failed to list data sources' });
    }
});

/** POST /api/data-sources — create a new data source + schedule worker */
router.post('/', async (req: Request, res: Response) => {
    try {
        const parsed = createSourceSchema.parse(req.body);

        const source = await DataIngestionService.registerSource({
            userId: req.user!.userId,
            type: parsed.type,
            name: parsed.name,
            config: parsed.config,
            scheduleSeconds: parsed.scheduleSeconds,
        });

        res.status(201).json({ source });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            res.status(400).json({ error: 'Validation error', details: error.errors });
            return;
        }
        logger.error({ error }, 'Failed to create data source');
        res.status(500).json({ error: 'Failed to create data source' });
    }
});

/** GET /api/data-sources/:id — get a single data source */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const source = await DataIngestionService.getSource(req.params.id);

        if (!source || source.userId !== req.user!.userId) {
            res.status(404).json({ error: 'Data source not found' });
            return;
        }

        res.json({ source });
    } catch (error) {
        logger.error({ error }, 'Failed to get data source');
        res.status(500).json({ error: 'Failed to get data source' });
    }
});

/** PATCH /api/data-sources/:id — update config, schedule, or toggle */
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const parsed = updateSourceSchema.parse(req.body);

        // Verify ownership
        const existing = await DataIngestionService.getSource(req.params.id);
        if (!existing || existing.userId !== req.user!.userId) {
            res.status(404).json({ error: 'Data source not found' });
            return;
        }

        // Handle enable/disable toggle
        if (parsed.enabled !== undefined) {
            const source = await DataIngestionService.toggleSource(req.params.id, parsed.enabled);
            res.json({ source });
            return;
        }

        // Handle other updates via Prisma directly
        const updateData: any = {};
        if (parsed.name) updateData.name = parsed.name;
        if (parsed.config) updateData.config = parsed.config;
        if (parsed.scheduleSeconds) updateData.scheduleSeconds = parsed.scheduleSeconds;

        const source = await prisma.dataSource.update({
            where: { id: req.params.id },
            data: updateData,
        });

        res.json({ source });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            res.status(400).json({ error: 'Validation error', details: error.errors });
            return;
        }
        logger.error({ error }, 'Failed to update data source');
        res.status(500).json({ error: 'Failed to update data source' });
    }
});

/** DELETE /api/data-sources/:id — remove source + cancel worker */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const existing = await DataIngestionService.getSource(req.params.id);
        if (!existing || existing.userId !== req.user!.userId) {
            res.status(404).json({ error: 'Data source not found' });
            return;
        }

        await DataIngestionService.removeSource(req.params.id);
        res.json({ message: 'Data source removed' });
    } catch (error) {
        logger.error({ error }, 'Failed to delete data source');
        res.status(500).json({ error: 'Failed to delete data source' });
    }
});

/** POST /api/data-sources/:id/trigger — manually trigger a fetch now */
router.post('/:id/trigger', async (req: Request, res: Response) => {
    try {
        const existing = await DataIngestionService.getSource(req.params.id);
        if (!existing || existing.userId !== req.user!.userId) {
            res.status(404).json({ error: 'Data source not found' });
            return;
        }

        await DataIngestionService.triggerFetch(req.params.id);
        res.json({ message: 'Fetch triggered', sourceId: req.params.id });
    } catch (error) {
        logger.error({ error }, 'Failed to trigger fetch');
        res.status(500).json({ error: 'Failed to trigger fetch' });
    }
});

export default router;
