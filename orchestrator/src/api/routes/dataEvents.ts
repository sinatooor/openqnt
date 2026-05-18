import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { DataIngestionService } from '../../services/dataIngestionService.js';
import { PortfolioEventMatcher } from '../../services/portfolioEventMatcher.js';
import { logger } from '../../utils/logger.js';

const router = Router();
function isDbUnavailable(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientInitializationError) return true;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return ['P1001', 'P1002', 'P2021'].includes(error.code);
    }
    const message = (error as { message?: string } | null)?.message;
    if (!message) return false;
    return /connect|ECONNREFUSED|does not exist|no such table/i.test(message);
}


// All data event routes require authentication
router.use(authMiddleware);

// ── Schemas ─────────────────────────────────────────────────

const listEventsSchema = z.object({
    type: z.enum([
        'news', 'earnings', 'filing', 'macro', 'insider', 'congress',
        'whale_13f', 'social', 'analyst', 'options', 'crypto_whale', 'custom',
    ]).optional(),
    symbol: z.string().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    impact: z.enum(['none', 'low', 'medium', 'high', 'critical']).optional(),
    limit: z.coerce.number().min(1).max(200).default(50),
    offset: z.coerce.number().min(0).default(0),
});

const portfolioEventsSchema = z.object({
    types: z.string().optional(), // Comma-separated list of types
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().min(1).max(200).default(50),
    offset: z.coerce.number().min(0).default(0),
});

// ── Routes ──────────────────────────────────────────────────

/** GET /api/data-events — list events with filters */
router.get('/', async (req: Request, res: Response) => {
    try {
        const filter = listEventsSchema.parse(req.query);
        const result = await DataIngestionService.getEvents(filter);
        res.json(result);
    } catch (error: any) {
        if (isDbUnavailable(error)) {
            const fallback = listEventsSchema.parse(req.query);
            res.json({ events: [], total: 0, limit: fallback.limit, offset: fallback.offset, warning: 'data-events unavailable' });
            return;
        }
        if (error.name === 'ZodError') {
            res.status(400).json({ error: 'Validation error', details: error.errors });
            return;
        }
        logger.error({ error }, 'Failed to list data events');
        res.status(500).json({ error: 'Failed to list data events' });
    }
});

/** GET /api/data-events/portfolio — events matching current user's portfolio */
router.get('/portfolio', async (req: Request, res: Response) => {
    try {
        const params = portfolioEventsSchema.parse(req.query);

        const types = params.types
            ? (params.types.split(',') as any[])
            : undefined;

        const result = await PortfolioEventMatcher.getPortfolioEvents({
            userId: req.user!.userId,
            types,
            from: params.from,
            to: params.to,
            limit: params.limit,
            offset: params.offset,
        });

        res.json(result);
    } catch (error: any) {
        if (isDbUnavailable(error)) {
            const fallback = portfolioEventsSchema.parse(req.query);
            res.json({ events: [], total: 0, portfolioSymbols: [], limit: fallback.limit, offset: fallback.offset, warning: 'portfolio events unavailable' });
            return;
        }
        if (error.name === 'ZodError') {
            res.status(400).json({ error: 'Validation error', details: error.errors });
            return;
        }
        logger.error({ error }, 'Failed to get portfolio events');
        res.status(500).json({ error: 'Failed to get portfolio events' });
    }
});

/** GET /api/data-events/:id — single event with evidence links */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const event = await DataIngestionService.getEvent(req.params.id);

        if (!event) {
            res.status(404).json({ error: 'Data event not found' });
            return;
        }

        res.json({ event });
    } catch (error) {
        logger.error({ error }, 'Failed to get data event');
        res.status(500).json({ error: 'Failed to get data event' });
    }
});

/** DELETE /api/data-events/:id — delete an event */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await DataIngestionService.deleteEvent(req.params.id);
        res.json({ message: 'Data event deleted' });
    } catch (error) {
        logger.error({ error }, 'Failed to delete data event');
        res.status(500).json({ error: 'Failed to delete data event' });
    }
});

export default router;
