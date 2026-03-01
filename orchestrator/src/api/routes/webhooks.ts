/**
 * Webhook handler routes.
 * Receives external webhooks (TradingView, custom) and HITL approval callbacks.
 *
 * TradingView integration:
 *   - URL: POST /api/webhooks/:strategyId
 *   - Body: JSON with at minimum { "symbol", "action", "price" }
 *   - Optional HMAC: x-webhook-signature header (sha256=<hex>)
 *   - If HMAC secret not configured on strategy, signature check is skipped.
 */

import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { executeStrategy } from '../../services/executionService.js';

const router = Router();

/**
 * Map common TradingView alert fields to a normalized payload.
 * TradingView sends: { symbol, action (buy/sell), price, time, strategy, ... }
 * We also support: { ticker, close, open, high, low, volume, contracts, position_size, ... }
 */
function normalizeTradingViewPayload(body: Record<string, any>): {
    symbol: string;
    action: string;
    price: number;
    bar: { timestamp: string; open: number; high: number; low: number; close: number; volume: number; symbol: string };
    extra: Record<string, any>;
} {
    const symbol = body.symbol ?? body.ticker ?? body.SYMBOL ?? 'UNKNOWN';
    const price = Number(body.price ?? body.close ?? body.last ?? 0);
    const action = (body.action ?? body.order ?? body.side ?? '').toLowerCase();

    const bar = {
        timestamp: body.time ?? body.timestamp ?? new Date().toISOString(),
        open: Number(body.open ?? price),
        high: Number(body.high ?? price),
        low: Number(body.low ?? price),
        close: price,
        volume: Number(body.volume ?? 0),
        symbol,
    };

    const knownKeys = new Set(['symbol', 'ticker', 'SYMBOL', 'price', 'close', 'last', 'action', 'order', 'side', 'time', 'timestamp', 'open', 'high', 'low', 'volume']);
    const extra: Record<string, any> = {};
    for (const [k, v] of Object.entries(body)) {
        if (!knownKeys.has(k)) extra[k] = v;
    }

    return { symbol, action, price, bar, extra };
}

/** POST /api/webhooks/:strategyId — external webhook trigger */
router.post('/:strategyId', async (req: Request, res: Response) => {
    try {
        const { strategyId } = req.params;

        const strategy = await prisma.strategy.findFirst({
            where: { id: strategyId, status: 'active' },
        });

        if (!strategy) {
            res.status(404).json({ error: 'Strategy not found or not active' });
            return;
        }

        // Optional HMAC signature verification
        // Only enforced if the strategy has a webhookSecret configured.
        // TradingView does not natively send HMAC, so this is opt-in.
        const signature = req.headers['x-webhook-signature'] as string | undefined;
        const settings = (strategy.settings ?? {}) as Record<string, any>;
        const secret = settings.webhookSecret as string | undefined;

        if (secret) {
            if (!signature) {
                logger.warn({ strategyId }, 'Webhook secret configured but no signature sent');
                res.status(401).json({ error: 'Missing x-webhook-signature header' });
                return;
            }
            const expected = crypto
                .createHmac('sha256', secret)
                .update(JSON.stringify(req.body))
                .digest('hex');
            if (signature !== `sha256=${expected}` && signature !== expected) {
                logger.warn({ strategyId }, 'Webhook signature mismatch');
                res.status(401).json({ error: 'Invalid signature' });
                return;
            }
        }

        const { symbol, action, price, bar, extra } = normalizeTradingViewPayload(req.body);

        logger.info(
            { strategyId, symbol, action, price, source: req.headers['user-agent'] },
            'Webhook received'
        );

        const result = await executeStrategy({
            strategyId,
            userId: strategy.userId,
            triggerType: 'webhook',
            triggerData: {
                body: req.body,
                normalized: { symbol, action, price, extra },
                source: req.headers['user-agent'],
            },
            bar,
            history: [bar],
            barIndex: 0,
        });

        res.json({
            message: 'Webhook processed',
            executionRunId: result.executionRunId,
            symbol,
            action,
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
