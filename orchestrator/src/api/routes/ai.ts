/**
 * AI advisory and analysis routes.
 * Delegates to Python compute service for LLM-powered analysis.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { runAIAnalysis, checkComputeHealth } from '../../services/computeClient.js';

const router = Router();
router.use(authMiddleware);

// ── Schemas ─────────────────────────────────────────────────

const analyzeSchema = z.object({
    strategyId: z.string().uuid().optional(),
    agentType: z.enum(['trading', 'research', 'sentiment']),
    context: z.record(z.any()).optional(),
    prompt: z.string().max(5000).optional(),
});

// ── Routes ──────────────────────────────────────────────────

/** POST /api/ai/analyze — trigger AI analysis */
router.post('/analyze', validate(analyzeSchema), async (req: Request, res: Response) => {
    try {
        const { strategyId, agentType, context } = req.body;

        // Build analysis context
        const analysisContext: Record<string, any> = {
            userId: req.user!.userId,
            agentType,
            ...context,
        };

        // Add strategy context if provided
        if (strategyId) {
            const strategy = await prisma.strategy.findFirst({
                where: { id: strategyId, userId: req.user!.userId },
            });
            if (strategy) {
                analysisContext.strategy = {
                    name: strategy.name,
                    nodes: strategy.nodes,
                    edges: strategy.edges,
                    settings: strategy.settings,
                };
            }
        }

        // Add recent execution history for context
        const recentRuns = await prisma.executionRun.findMany({
            where: { userId: req.user!.userId },
            orderBy: { startedAt: 'desc' },
            take: 5,
            select: {
                status: true,
                triggerType: true,
                summary: true,
                startedAt: true,
                strategy: { select: { name: true } },
            },
        });
        analysisContext.recentExecutions = recentRuns;

        // Delegate to Python compute service
        try {
            const result = await runAIAnalysis({
                context: analysisContext,
                agentType,
            });

            res.json({
                analysis: result.data,
                durationMs: result.durationMs,
                agentType,
            });
        } catch (computeError: any) {
            // Fallback response if compute service is unavailable
            logger.warn({ error: computeError.message }, 'Compute service unavailable, returning fallback');
            res.json({
                analysis: {
                    analysis: 'AI analysis currently unavailable. The compute service is offline.',
                    confidence: 0,
                    reasoning: 'Compute service connection failed.',
                },
                durationMs: 0,
                agentType,
                fallback: true,
            });
        }
    } catch (error) {
        logger.error({ error }, 'AI analysis failed');
        res.status(500).json({ error: 'AI analysis failed' });
    }
});

/** GET /api/ai/health — check compute service health */
router.get('/health', async (_req: Request, res: Response) => {
    try {
        const healthy = await checkComputeHealth();
        res.json({
            computeService: healthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        res.json({ computeService: 'unhealthy', timestamp: new Date().toISOString() });
    }
});

export default router;
