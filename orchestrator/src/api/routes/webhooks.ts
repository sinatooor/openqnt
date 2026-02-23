/**
 * Webhook handler routes.
 * Receives external webhooks (TradingView, custom) and HITL approval callbacks.
 */

import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { executeStrategy } from '../../services/executionService.js';

const router = Router();

/** POST /api/webhooks/:strategyId — external webhook trigger */
router.post('/:strategyId', async (req: Request, res: Response) => {
    try {
        const { strategyId } = req.params;

        // Verify strategy exists and is active
        const strategy = await prisma.strategy.findFirst({
            where: { id: strategyId, status: 'active' },
        });

        if (!strategy) {
            res.status(404).json({ error: 'Strategy not found or not active' });
            return;
        }

        // Optional HMAC signature verification
        const signature = req.headers['x-webhook-signature'] as string;
        if (signature && strategy.settings) {
            const settings = strategy.settings as Record<string, any>;
            const secret = settings.webhookSecret;
            if (secret) {
                const expected = crypto
                    .createHmac('sha256', secret)
                    .update(JSON.stringify(req.body))
                    .digest('hex');
                if (signature !== `sha256=${expected}`) {
                    logger.warn({ strategyId }, 'Webhook signature mismatch');
                    res.status(401).json({ error: 'Invalid signature' });
                    return;
                }
            }
        }

        logger.info(
            { strategyId, source: req.headers['user-agent'], bodyKeys: Object.keys(req.body) },
            'Webhook received'
        );

        // Build a synthetic bar from webhook data (or defaults)
        const bar = {
            timestamp: new Date().toISOString(),
            open: req.body.open ?? req.body.price ?? 0,
            high: req.body.high ?? req.body.price ?? 0,
            low: req.body.low ?? req.body.price ?? 0,
            close: req.body.close ?? req.body.price ?? 0,
            volume: req.body.volume ?? 0,
            symbol: req.body.symbol ?? req.body.ticker ?? 'UNKNOWN',
        };

        // Fire the execution asynchronously
        const result = await executeStrategy({
            strategyId,
            userId: strategy.userId,
            triggerType: 'webhook',
            triggerData: { body: req.body, headers: req.headers },
            bar,
            history: [bar],
            barIndex: 0,
        });

        res.json({
            message: 'Webhook processed',
            executionRunId: result.executionRunId,
            orderIntents: result.result.orderIntents.length,
        });
    } catch (error) {
        logger.error({ error }, 'Webhook processing failed');
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/** POST /api/webhooks/hitl/:executionId — HITL approval/rejection */
router.post('/hitl/:executionId', async (req: Request, res: Response) => {
    try {
        const { executionId } = req.params;
        const { action, userId } = req.body; // action: 'approve' | 'reject'

        const run = await prisma.executionRun.findFirst({
            where: { id: executionId, userId },
        });

        if (!run) {
            res.status(404).json({ error: 'Execution run not found' });
            return;
        }

        if (action === 'approve') {
            // TODO: Execute the pending orders from this run
            await prisma.executionRun.update({
                where: { id: executionId },
                data: { status: 'success', summary: { ...(run.summary as any), hitlApproved: true } },
            });
            logger.info({ executionId }, 'HITL approved');
        } else {
            await prisma.executionRun.update({
                where: { id: executionId },
                data: { status: 'cancelled', summary: { ...(run.summary as any), hitlRejected: true } },
            });
            logger.info({ executionId }, 'HITL rejected');
        }

        res.json({ message: `Execution ${action}d`, executionId });
    } catch (error) {
        logger.error({ error }, 'HITL callback failed');
        res.status(500).json({ error: 'HITL callback failed' });
    }
});

export default router;
