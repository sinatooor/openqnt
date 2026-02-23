/**
 * Portfolio tracking API routes.
 * Manages portfolios, positions, and broker sync status.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authMiddleware);

// ── Schemas ─────────────────────────────────────────────────

const createPortfolioSchema = z.object({
    brokerName: z.enum(['alpaca', 'ig', 'ibkr', 'nordnet', 'paper']),
    accountId: z.string().optional(),
    credentialAlias: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

const updatePositionSchema = z.object({
    symbol: z.string().min(1),
    side: z.enum(['long', 'short']),
    quantity: z.number().min(0),
    avgEntryPrice: z.number().min(0),
    currentPrice: z.number().optional(),
});

// ── Routes ──────────────────────────────────────────────────

/** GET /api/portfolio — list user portfolios */
router.get('/', async (req: Request, res: Response) => {
    try {
        const portfolios = await prisma.portfolio.findMany({
            where: { userId: req.user!.userId },
            include: {
                positions: {
                    orderBy: { symbol: 'asc' },
                },
            },
        });

        res.json({ portfolios });
    } catch (error) {
        logger.error({ error }, 'Failed to list portfolios');
        res.status(500).json({ error: 'Failed to list portfolios' });
    }
});

/** POST /api/portfolio — create portfolio */
router.post('/', validate(createPortfolioSchema), async (req: Request, res: Response) => {
    try {
        const portfolio = await prisma.portfolio.create({
            data: {
                userId: req.user!.userId,
                ...req.body,
            },
        });

        logger.info({ portfolioId: portfolio.id, broker: portfolio.brokerName }, 'Portfolio created');
        res.status(201).json({ portfolio });
    } catch (error) {
        logger.error({ error }, 'Failed to create portfolio');
        res.status(500).json({ error: 'Failed to create portfolio' });
    }
});

/** GET /api/portfolio/:id — get portfolio with positions */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const portfolio = await prisma.portfolio.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
            include: {
                positions: { orderBy: { symbol: 'asc' } },
            },
        });

        if (!portfolio) {
            res.status(404).json({ error: 'Portfolio not found' });
            return;
        }

        // Calculate derived fields
        const totalUnrealizedPnl = (portfolio.positions as any[]).reduce((sum: number, p: any) => sum + p.unrealizedPnl, 0);
        const totalRealizedPnl = (portfolio.positions as any[]).reduce((sum: number, p: any) => sum + p.realizedPnl, 0);
        const positionCount = portfolio.positions.length;

        res.json({
            portfolio,
            summary: {
                totalUnrealizedPnl,
                totalRealizedPnl,
                positionCount,
                totalPnl: totalUnrealizedPnl + totalRealizedPnl,
            },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to get portfolio');
        res.status(500).json({ error: 'Failed to get portfolio' });
    }
});

/** PUT /api/portfolio/:id/sync — trigger broker sync */
router.put('/:id/sync', async (req: Request, res: Response) => {
    try {
        const portfolio = await prisma.portfolio.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });

        if (!portfolio) {
            res.status(404).json({ error: 'Portfolio not found' });
            return;
        }

        // TODO: Call broker API via compute service to sync positions
        // For now, just update the lastSyncedAt timestamp
        await prisma.portfolio.update({
            where: { id: portfolio.id },
            data: { lastSyncedAt: new Date() },
        });

        logger.info({ portfolioId: portfolio.id }, 'Portfolio sync triggered');
        res.json({ message: 'Sync triggered', lastSyncedAt: new Date() });
    } catch (error) {
        logger.error({ error }, 'Failed to sync portfolio');
        res.status(500).json({ error: 'Failed to sync portfolio' });
    }
});

/** POST /api/portfolio/:id/positions — add/update position */
router.post('/:id/positions', validate(updatePositionSchema), async (req: Request, res: Response) => {
    try {
        const portfolio = await prisma.portfolio.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });

        if (!portfolio) {
            res.status(404).json({ error: 'Portfolio not found' });
            return;
        }

        const { symbol, side, quantity, avgEntryPrice, currentPrice } = req.body;

        const position = await prisma.portfolioPosition.upsert({
            where: {
                id: `${portfolio.id}-${symbol}`, // Composite key workaround
            },
            create: {
                portfolioId: portfolio.id,
                symbol,
                side,
                quantity,
                avgEntryPrice,
                currentPrice: currentPrice ?? avgEntryPrice,
                openedAt: new Date(),
            },
            update: {
                quantity,
                avgEntryPrice,
                currentPrice: currentPrice ?? avgEntryPrice,
                side,
            },
        });

        res.json({ position });
    } catch (error) {
        logger.error({ error }, 'Failed to update position');
        res.status(500).json({ error: 'Failed to update position' });
    }
});

/** DELETE /api/portfolio/:id — delete portfolio */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const portfolio = await prisma.portfolio.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });

        if (!portfolio) {
            res.status(404).json({ error: 'Portfolio not found' });
            return;
        }

        await prisma.portfolio.delete({ where: { id: portfolio.id } });
        logger.info({ portfolioId: portfolio.id }, 'Portfolio deleted');
        res.json({ message: 'Portfolio deleted' });
    } catch (error) {
        logger.error({ error }, 'Failed to delete portfolio');
        res.status(500).json({ error: 'Failed to delete portfolio' });
    }
});

export default router;
