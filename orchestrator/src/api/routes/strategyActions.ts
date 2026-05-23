/**
 * Compile and validate API routes.
 * These are added to the strategies router for flow compilation.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { compileFlowStrategy, validateFlowStrategy } from '../../engine/compiler.js';
import {
    deployStrategy,
    removeStrategy,
    extractScheduleFromNodes,
    type HeartbeatJobData,
} from '../../workers/heartbeat.js';
import { env } from '../../config/env.js';

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

        // Get user's agent config for heartbeat interval (fallback when the
        // strategy has no `cronTrigger`/`heartbeatTrigger` node).
        const agentConfig = await prisma.agentConfig.findUnique({
            where: { userId: req.user!.userId },
        });
        const fallbackInterval = agentConfig?.heartbeatIntervalSeconds ?? 300;

        // Prefer the schedule declared on the strategy's trigger nodes.
        const schedule = extractScheduleFromNodes(strategy.nodes as unknown);

        let jobData: HeartbeatJobData;
        if (schedule?.kind === 'cron' && schedule.cronExpression) {
            // Validate the cron expression so we 400 instead of silently
            // queueing something BullMQ will reject.
            try {
                // cron-parser is a transitive dep of BullMQ.
                const cronParser = await import('cron-parser');
                cronParser.parseExpression(schedule.cronExpression, {
                    tz: schedule.timezone,
                });
            } catch (err) {
                res.status(400).json({
                    error: `invalid cronExpression: ${(err as Error).message}`,
                });
                return;
            }
            jobData = {
                strategyId: strategy.id,
                userId: req.user!.userId,
                triggerKind: 'cron',
                cronExpression: schedule.cronExpression,
                timezone: schedule.timezone,
                intervalSeconds: 0,
            };
        } else if (schedule?.kind === 'heartbeat' && schedule.intervalSeconds) {
            jobData = {
                strategyId: strategy.id,
                userId: req.user!.userId,
                triggerKind: 'heartbeat',
                intervalSeconds: schedule.intervalSeconds,
            };
        } else {
            jobData = {
                strategyId: strategy.id,
                userId: req.user!.userId,
                triggerKind: 'heartbeat',
                intervalSeconds: fallbackInterval,
            };
        }

        await deployStrategy(jobData);

        await prisma.strategy.update({
            where: { id: strategy.id },
            data: { status: 'active' },
        });

        logger.info(
            { strategyId: strategy.id, schedule: jobData },
            'Strategy deployed'
        );
        res.json({
            message: 'Strategy deployed',
            triggerKind: jobData.triggerKind,
            cronExpression: jobData.cronExpression,
            timezone: jobData.timezone,
            intervalSeconds: jobData.intervalSeconds,
        });
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

        const backtestPayload = {
            ...req.body,
            workspaceXml: req.body.workspaceXml || '<xml></xml>', // Fallback for ReactFlow 
            strategyId: strategy.id
        };

        logger.info({ strategyId: strategy.id }, 'Proxying backtest request to Python compute service');

        const response = await fetch(`${env.COMPUTE_SERVICE_URL}/backtest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(backtestPayload)
        });

        if (!response.ok) {
            throw new Error(`Python compute returned ${response.status}`);
        }

        const result = await response.json() as any;

        if (!result.success) {
            throw new Error(result.error ?? 'Backtest failed in Python engine');
        }

        // Persist BacktestResult
        const backtestResult = await prisma.backtestResult.create({
            data: {
                strategyId: strategy.id,
                userId: req.user!.userId,
                engine: req.body.engine ?? 'backtesting.py',
                parameters: {
                    symbol: result.symbol,
                    startDate: result.start_date,
                    endDate: result.end_date,
                    initialBalance: result.initial_balance
                },
                metrics: result.metrics,
                equityCurve: result.equity_curve,
                tradeLog: result.trades,
            }
        });

        res.json({
            message: 'Backtest completed',
            backtestId: backtestResult.id,
            result: result
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Backtest submission failed');
        res.status(500).json({ error: 'Backtest submission failed' });
    }
});

export default router;
