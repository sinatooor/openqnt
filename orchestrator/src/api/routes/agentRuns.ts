import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { AgentService } from '../../services/agentService.js';
import { DataIngestionService } from '../../services/dataIngestionService.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// All agent run routes require authentication
router.use(authMiddleware);

// ── Schemas ─────────────────────────────────────────────────

const triggerRunSchema = z.object({
    agentType: z.string().min(1),
    context: z.record(z.any()).default({}),
    model: z.string().optional(),
});

const scheduleAgentSchema = z.object({
    agentType: z.string().min(1),
    context: z.record(z.any()).default({}),
    intervalSeconds: z.number().min(60).max(86400),  // 1 min to 24 hours
    model: z.string().optional(),
});

const listRunsSchema = z.object({
    agentType: z.string().optional(),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
    limit: z.coerce.number().min(1).max(200).default(50),
    offset: z.coerce.number().min(0).default(0),
});

// ── Routes ──────────────────────────────────────────────────

/** POST /api/agent-runs/trigger — manually trigger an agent run */
router.post('/trigger', async (req: Request, res: Response) => {
    try {
        const parsed = triggerRunSchema.parse(req.body);

        // Auto-populate context with user's portfolio symbols and recent events
        const context = { ...parsed.context };

        // If no symbols provided, fetch from user's portfolio
        if (!context.symbols) {
            try {
                const { prisma } = await import('../../config/database.js');
                const portfolios = await prisma.portfolio.findMany({
                    where: { userId: req.user!.userId },
                    include: { positions: { select: { symbol: true } } },
                });
                context.symbols = portfolios.flatMap(p => p.positions.map(pos => pos.symbol));
            } catch { /* ok, symbols are optional */ }
        }

        // Auto-fetch relevant data events based on agent type
        if (parsed.agentType === 'news_analyst' && !context.news_events) {
            const events = await DataIngestionService.getEvents({ type: 'news', limit: 30 });
            context.news_events = events.events;
        } else if (parsed.agentType === 'macro_analyst' && !context.macro_events) {
            const events = await DataIngestionService.getEvents({ type: 'macro', limit: 30 });
            context.macro_events = events.events;
        } else if (parsed.agentType === 'social_monitor' && !context.social_events) {
            const events = await DataIngestionService.getEvents({ type: 'social', limit: 30 });
            context.social_events = events.events;
        }

        const runId = await AgentService.triggerRun({
            agentType: parsed.agentType,
            userId: req.user!.userId,
            triggerType: 'manual',
            context,
            model: parsed.model,
        });

        res.status(202).json({ runId, message: 'Agent run triggered' });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            res.status(400).json({ error: 'Validation error', details: error.errors });
            return;
        }
        logger.error({ error }, 'Failed to trigger agent run');
        res.status(500).json({ error: 'Failed to trigger agent run' });
    }
});

/** POST /api/agent-runs/schedule — schedule a recurring agent run */
router.post('/schedule', async (req: Request, res: Response) => {
    try {
        const parsed = scheduleAgentSchema.parse(req.body);

        await AgentService.scheduleAgent({
            userId: req.user!.userId,
            agentType: parsed.agentType,
            context: parsed.context,
            intervalSeconds: parsed.intervalSeconds,
            model: parsed.model,
        });

        res.json({
            message: `Agent ${parsed.agentType} scheduled every ${parsed.intervalSeconds}s`,
            agentType: parsed.agentType,
            intervalSeconds: parsed.intervalSeconds,
        });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            res.status(400).json({ error: 'Validation error', details: error.errors });
            return;
        }
        logger.error({ error }, 'Failed to schedule agent');
        res.status(500).json({ error: 'Failed to schedule agent' });
    }
});

/** DELETE /api/agent-runs/schedule/:agentType — unschedule an agent */
router.delete('/schedule/:agentType', async (req: Request, res: Response) => {
    try {
        await AgentService.unscheduleAgent(req.user!.userId, req.params.agentType);
        res.json({ message: `Agent ${req.params.agentType} unscheduled` });
    } catch (error) {
        logger.error({ error }, 'Failed to unschedule agent');
        res.status(500).json({ error: 'Failed to unschedule agent' });
    }
});

/** GET /api/agent-runs — list agent runs */
router.get('/', async (req: Request, res: Response) => {
    try {
        const filter = listRunsSchema.parse(req.query);
        const result = await AgentService.listRuns({
            userId: req.user!.userId,
            ...filter,
        });
        res.json(result);
    } catch (error: any) {
        if (error.name === 'ZodError') {
            res.status(400).json({ error: 'Validation error', details: error.errors });
            return;
        }
        logger.error({ error }, 'Failed to list agent runs');
        res.status(500).json({ error: 'Failed to list agent runs' });
    }
});

/** GET /api/agent-runs/:id — get a single agent run with output */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const run = await AgentService.getRun(req.params.id);

        if (!run || run.userId !== req.user!.userId) {
            res.status(404).json({ error: 'Agent run not found' });
            return;
        }

        res.json({ run });
    } catch (error) {
        logger.error({ error }, 'Failed to get agent run');
        res.status(500).json({ error: 'Failed to get agent run' });
    }
});

/** GET /api/agent-runs/types — list available agent types */
router.get('/types/available', async (_req: Request, res: Response) => {
    try {
        const agents = await AgentService.getAvailableAgents();
        res.json({ agents });
    } catch (error) {
        logger.error({ error }, 'Failed to get agent types');
        res.status(500).json({ error: 'Failed to get agent types' });
    }
});

export default router;
