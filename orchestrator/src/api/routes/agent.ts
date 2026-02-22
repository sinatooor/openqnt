/**
 * Agent configuration routes.
 * Manages heartbeat settings, operational mode, trading guardrails.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { removeStrategy } from '../../workers/heartbeat.js';

const router = Router();
router.use(authMiddleware);

// ── Schemas ─────────────────────────────────────────────────

const updateConfigSchema = z.object({
    operationalMode: z.enum(['advisory', 'hitl', 'autonomous', 'simulation']).optional(),
    heartbeatIntervalSeconds: z.number().min(60).max(86400).optional(),
    activeHours: z.record(z.any()).optional(),
    preCheckRules: z.record(z.any()).optional(),
    maxSingleTradeValue: z.number().min(0).optional(),
    maxDailySpend: z.number().min(0).optional(),
    maxPositionConcentrationPct: z.number().min(0).max(100).optional(),
});

// ── Routes ──────────────────────────────────────────────────

/** GET /api/agent/config */
router.get('/config', async (req: Request, res: Response) => {
    try {
        let config = await prisma.agentConfig.findUnique({
            where: { userId: req.user!.userId },
        });

        if (!config) {
            config = await prisma.agentConfig.create({
                data: { userId: req.user!.userId },
            });
        }

        res.json({ config });
    } catch (error) {
        logger.error({ error }, 'Failed to get agent config');
        res.status(500).json({ error: 'Failed to get agent config' });
    }
});

/** PUT /api/agent/config */
router.put('/config', validate(updateConfigSchema), async (req: Request, res: Response) => {
    try {
        const config = await prisma.agentConfig.upsert({
            where: { userId: req.user!.userId },
            update: req.body,
            create: { userId: req.user!.userId, ...req.body },
        });

        logger.info({ userId: req.user!.userId }, 'Agent config updated');
        res.json({ config });
    } catch (error) {
        logger.error({ error }, 'Failed to update agent config');
        res.status(500).json({ error: 'Failed to update agent config' });
    }
});

/** POST /api/agent/kill — emergency kill switch */
router.post('/kill', async (req: Request, res: Response) => {
    try {
        // Set emergency kill flag
        await prisma.agentConfig.upsert({
            where: { userId: req.user!.userId },
            update: { emergencyKill: true },
            create: { userId: req.user!.userId, emergencyKill: true },
        });

        // Remove all active heartbeat jobs for this user
        const activeStrategies = await prisma.strategy.findMany({
            where: { userId: req.user!.userId, status: 'active' },
        });

        for (const strategy of activeStrategies) {
            await removeStrategy(strategy.id);
            await prisma.strategy.update({
                where: { id: strategy.id },
                data: { status: 'paused' },
            });
        }

        logger.warn(
            { userId: req.user!.userId, strategiesPaused: activeStrategies.length },
            '🚨 EMERGENCY KILL activated'
        );

        res.json({
            message: 'Emergency kill activated',
            strategiesPaused: activeStrategies.length,
        });
    } catch (error) {
        logger.error({ error }, 'Kill switch failed');
        res.status(500).json({ error: 'Kill switch failed' });
    }
});

export default router;
