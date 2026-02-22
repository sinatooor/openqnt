/**
 * Compile and validate API routes.
 * These are added to the strategies router for flow compilation.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { compileFlowStrategy, validateFlowStrategy } from '../../engine/compiler.js';
import { deployStrategy, removeStrategy } from '../../workers/heartbeat.js';

const router = Router();
router.use(authMiddleware);

/** POST /api/strategies/:id/compile — compile flow graph */
router.post('/:id/compile', async (req: Request, res: Response) => {
    try {
        const strategy = await prisma.strategy.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });

        if (!strategy) {
            res.status(404).json({ error: 'Strategy not found' });
            return;
        }

        const nodes = strategy.nodes as any[];
        const edges = strategy.edges as any[];
        const settings = (strategy.settings as Record<string, any>) ?? {};

        const result = compileFlowStrategy(nodes, edges, { ...settings, name: strategy.name });

        logger.info(
            {
                strategyId: strategy.id,
                isValid: result.validation.isValid,
                nodeCount: nodes.length,
            },
            'Strategy compiled'
        );

        res.json(result);
    } catch (error) {
        logger.error({ error }, 'Compilation failed');
        res.status(500).json({ error: 'Compilation failed' });
    }
});

/** POST /api/strategies/:id/validate — validate flow graph */
router.post('/:id/validate', async (req: Request, res: Response) => {
    try {
        const strategy = await prisma.strategy.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });

        if (!strategy) {
            res.status(404).json({ error: 'Strategy not found' });
            return;
        }

        const nodes = strategy.nodes as any[];
        const edges = strategy.edges as any[];
        const settings = (strategy.settings as Record<string, any>) ?? {};

        const result = validateFlowStrategy(nodes, edges, settings);

        res.json(result);
    } catch (error) {
        logger.error({ error }, 'Validation failed');
        res.status(500).json({ error: 'Validation failed' });
    }
});

/** POST /api/strategies/:id/deploy — activate for heartbeat monitoring */
router.post('/:id/deploy', async (req: Request, res: Response) => {
    try {
        const strategy = await prisma.strategy.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });

        if (!strategy) {
            res.status(404).json({ error: 'Strategy not found' });
            return;
        }

        // Get user's agent config for heartbeat interval
        const agentConfig = await prisma.agentConfig.findUnique({
            where: { userId: req.user!.userId },
        });

        const intervalSeconds = agentConfig?.heartbeatIntervalSeconds ?? 300;

        // Deploy to BullMQ
        await deployStrategy({
            strategyId: strategy.id,
            userId: req.user!.userId,
            intervalSeconds,
        });

        // Update strategy status
        await prisma.strategy.update({
            where: { id: strategy.id },
            data: { status: 'active' },
        });

        logger.info({ strategyId: strategy.id, intervalSeconds }, 'Strategy deployed');
        res.json({ message: 'Strategy deployed', intervalSeconds });
    } catch (error) {
        logger.error({ error }, 'Deploy failed');
        res.status(500).json({ error: 'Deploy failed' });
    }
});

/** POST /api/strategies/:id/pause — pause heartbeat */
router.post('/:id/pause', async (req: Request, res: Response) => {
    try {
        const strategy = await prisma.strategy.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });

        if (!strategy) {
            res.status(404).json({ error: 'Strategy not found' });
            return;
        }

        await removeStrategy(strategy.id);

        await prisma.strategy.update({
            where: { id: strategy.id },
            data: { status: 'paused' },
        });

        logger.info({ strategyId: strategy.id }, 'Strategy paused');
        res.json({ message: 'Strategy paused' });
    } catch (error) {
        logger.error({ error }, 'Pause failed');
        res.status(500).json({ error: 'Pause failed' });
    }
});

/** POST /api/strategies/:id/backtest — trigger backtest via Python compute */
router.post('/:id/backtest', async (req: Request, res: Response) => {
    try {
        const strategy = await prisma.strategy.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });

        if (!strategy) {
            res.status(404).json({ error: 'Strategy not found' });
            return;
        }

        // For now, return a placeholder. Full implementation in Phase 3.
        res.json({
            message: 'Backtest queued',
            strategyId: strategy.id,
            status: 'pending',
        });
    } catch (error) {
        logger.error({ error }, 'Backtest submission failed');
        res.status(500).json({ error: 'Backtest submission failed' });
    }
});

export default router;
