import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { AgentAlertService } from '../../services/agentAlertService.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// All alert rule routes require authentication
router.use(authMiddleware);

// ── Schemas ─────────────────────────────────────────────────

const createRuleSchema = z.object({
    name: z.string().min(1).max(200),
    agentType: z.string().min(1),
    symbols: z.array(z.string()).default([]),
    conditions: z.object({
        minImpact: z.enum(['none', 'low', 'medium', 'high', 'critical']).optional(),
        minConfidence: z.number().min(0).max(1).optional(),
        signals: z.array(z.string()).optional(),
        actions: z.array(z.string()).optional(),
        keywords: z.array(z.string()).optional(),
    }),
    channel: z.enum(['in_app', 'push', 'email', 'telegram', 'slack', 'sms']).default('in_app'),
    cooldownMinutes: z.number().min(1).max(1440).default(60),
});

// ── Routes ──────────────────────────────────────────────────

/** POST /api/alert-rules — create a new alert rule */
router.post('/', async (req: Request, res: Response) => {
    try {
        const parsed = createRuleSchema.parse(req.body);
        const rule = await AgentAlertService.createRule(req.user!.userId, parsed);
        res.status(201).json({ rule });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            res.status(400).json({ error: 'Validation error', details: error.errors });
            return;
        }
        logger.error({ error }, 'Failed to create alert rule');
        res.status(500).json({ error: 'Failed to create alert rule' });
    }
});

/** GET /api/alert-rules — list all alert rules for user */
router.get('/', async (req: Request, res: Response) => {
    try {
        const rules = await AgentAlertService.listRules(req.user!.userId);
        res.json({ rules });
    } catch (error) {
        logger.error({ error }, 'Failed to list alert rules');
        res.status(500).json({ error: 'Failed to list alert rules' });
    }
});

/** PATCH /api/alert-rules/:id/toggle — enable/disable a rule */
router.patch('/:id/toggle', async (req: Request, res: Response) => {
    try {
        const rule = await AgentAlertService.toggleRule(req.params.id, req.user!.userId);
        if (!rule) {
            res.status(404).json({ error: 'Alert rule not found' });
            return;
        }
        res.json({ rule });
    } catch (error) {
        logger.error({ error }, 'Failed to toggle alert rule');
        res.status(500).json({ error: 'Failed to toggle alert rule' });
    }
});

/** DELETE /api/alert-rules/:id — delete a rule */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await AgentAlertService.deleteRule(req.params.id, req.user!.userId);
        res.json({ message: 'Alert rule deleted' });
    } catch (error) {
        logger.error({ error }, 'Failed to delete alert rule');
        res.status(500).json({ error: 'Failed to delete alert rule' });
    }
});

export default router;
