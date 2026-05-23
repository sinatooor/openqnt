/**
 * BullMQ Heartbeat Worker
 * Fires at configured intervals per active strategy.
 * Loads the strategy, runs pre-checks, and triggers flow evaluation.
 */

import { Queue, Worker, type Job } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

// ─── Queue Names ─────────────────────────────────────────────

export const HEARTBEAT_QUEUE = 'heartbeat';
export const NOTIFICATION_QUEUE = 'notifications';
export const BACKTEST_QUEUE = 'backtest';

// ─── Queue Factory ───────────────────────────────────────────

const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue {
    if (!queues.has(name)) {
        const queue = new Queue(name, {
            connection: getRedis() as any,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: { count: 1000 },
                removeOnFail: { count: 5000 },
            },
        });
        queues.set(name, queue);
    }
    return queues.get(name)!;
}

// ─── Job Data Types ──────────────────────────────────────────

export interface HeartbeatJobData {
    strategyId: string;
    userId: string;
    /** Used only when triggerKind === 'heartbeat'. Ignored for 'cron'. */
    intervalSeconds: number;
    /** 'cron' fires on a cron pattern; 'heartbeat' on a fixed interval. */
    triggerKind?: 'heartbeat' | 'cron';
    /** Required when triggerKind === 'cron'. Standard 5-field cron (BullMQ
     *  uses node-cron syntax) e.g. "0 16 * * *". */
    cronExpression?: string;
    /** IANA timezone (e.g. "America/New_York"). Optional; defaults to UTC. */
    timezone?: string;
}

/** A schedule extracted from a strategy's trigger nodes. The deploy path
 *  uses this to decide how to queue the BullMQ repeatable. */
export interface ExtractedSchedule {
    kind: 'cron' | 'heartbeat';
    cronExpression?: string;
    timezone?: string;
    intervalSeconds?: number;
}

/**
 * Walk a strategy's nodes and return the first schedule we can act on.
 *
 *   Precedence: `cronTrigger` > `heartbeatTrigger` > caller's fallback.
 *
 * The fallback path (returning `null`) lets the deploy route fill in the
 * global `AgentConfig.heartbeatIntervalSeconds` so legacy strategies
 * keep working without a trigger node.
 */
export function extractScheduleFromNodes(nodes: unknown): ExtractedSchedule | null {
    if (!Array.isArray(nodes)) return null;
    // Prefer cron.
    for (const n of nodes as Array<any>) {
        const t = n?.data?.triggerType ?? n?.type;
        if (t === 'cronTrigger') {
            const expr = String(n?.data?.cronExpression ?? '').trim();
            if (!expr) continue;
            return {
                kind: 'cron',
                cronExpression: expr,
                timezone: n?.data?.timezone || undefined,
            };
        }
    }
    for (const n of nodes as Array<any>) {
        const t = n?.data?.triggerType ?? n?.type;
        if (t === 'heartbeatTrigger') {
            const mins = Number(n?.data?.intervalMinutes ?? 0);
            if (!Number.isFinite(mins) || mins <= 0) continue;
            return { kind: 'heartbeat', intervalSeconds: Math.round(mins * 60) };
        }
    }
    return null;
}

export interface NotificationJobData {
    userId: string;
    channel: string;
    type: string;
    title: string;
    body: string;
    metadata?: Record<string, any>;
    executionRunId?: string;
}

export interface BacktestJobData {
    strategyId: string;
    userId: string;
    engine: string;
    parameters: Record<string, any>;
}

// ─── Heartbeat Worker ────────────────────────────────────────

let heartbeatWorker: Worker | null = null;

export function startHeartbeatWorker(
    processor: (job: Job<HeartbeatJobData>) => Promise<void>
): Worker {
    if (heartbeatWorker) return heartbeatWorker;

    heartbeatWorker = new Worker<HeartbeatJobData>(
        HEARTBEAT_QUEUE,
        processor,
        {
            connection: getRedis() as any,
            concurrency: 5,
            limiter: { max: 10, duration: 1000 },
        }
    );

    heartbeatWorker.on('completed', (job) => {
        logger.info({ jobId: job.id, strategyId: job.data.strategyId }, 'Heartbeat completed');
    });

    heartbeatWorker.on('failed', (job, err) => {
        logger.error(
            { jobId: job?.id, strategyId: job?.data.strategyId, err },
            'Heartbeat failed'
        );
    });

    logger.info('Heartbeat worker started');
    return heartbeatWorker;
}

// ─── Deploy / Pause Strategy ─────────────────────────────────

export async function deployStrategy(data: HeartbeatJobData): Promise<string> {
    const queue = getQueue(HEARTBEAT_QUEUE);
    const jobId = `heartbeat:${data.strategyId}`;

    // Remove existing repeatable job for this strategy
    await removeStrategy(data.strategyId);

    const kind = data.triggerKind ?? 'heartbeat';
    // BullMQ accepts `pattern` (5-field cron) for cron, `every` (ms) for interval.
    const repeat: Record<string, any> =
        kind === 'cron' && data.cronExpression
            ? { pattern: data.cronExpression, ...(data.timezone ? { tz: data.timezone } : {}) }
            : { every: data.intervalSeconds * 1000 };

    await queue.add('heartbeat', data, { repeat, jobId });

    logger.info(
        {
            strategyId: data.strategyId,
            triggerKind: kind,
            cronExpression: data.cronExpression,
            timezone: data.timezone,
            intervalSeconds: data.intervalSeconds,
        },
        'Strategy deployed to heartbeat'
    );

    return jobId;
}

export async function removeStrategy(strategyId: string): Promise<void> {
    const queue = getQueue(HEARTBEAT_QUEUE);

    // Get all repeatable jobs and remove the one for this strategy
    const repeatableJobs = await queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
        if (job.id === `heartbeat:${strategyId}`) {
            await queue.removeRepeatableByKey(job.key);
            logger.info({ strategyId }, 'Strategy removed from heartbeat');
        }
    }
}

// ─── Cleanup ─────────────────────────────────────────────────

export async function closeQueues(): Promise<void> {
    if (heartbeatWorker) {
        await heartbeatWorker.close();
        heartbeatWorker = null;
    }
    for (const queue of queues.values()) {
        await queue.close();
    }
    queues.clear();
    logger.info('All queues closed');
}

// ─── Queue Accessors (for Bull Board) ────────────────────────

export function getHeartbeatQueue(): Queue | null {
    try {
        return getQueue(HEARTBEAT_QUEUE);
    } catch {
        return null;
    }
}

