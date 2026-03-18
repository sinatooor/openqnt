import { createHash } from 'node:crypto';
import { Queue } from 'bullmq';
import type { DataSourceType, DataEventImpact } from '@prisma/client';
import { prisma } from '../config/database.js';
import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import type { RawEvent } from './fetchers/index.js';

// ─── Queue Setup ──────────────────────────────────────────────

const QUEUE_NAME = 'data-ingestion';

let ingestionQueue: Queue | null = null;

function getQueue(): Queue {
    if (!ingestionQueue) {
        ingestionQueue = new Queue(QUEUE_NAME, {
            connection: getRedis() as any,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: { count: 100 },
                removeOnFail: { count: 50 },
            },
        });
    }
    return ingestionQueue;
}

// ─── Content Hash ─────────────────────────────────────────────

export function generateContentHash(type: string, url?: string, headline?: string): string {
    const input = `${type}:${url ?? ''}:${headline ?? ''}`;
    return createHash('sha256').update(input).digest('hex');
}

// ─── Job Data Interface ───────────────────────────────────────

export interface IngestionJobData {
    sourceId: string;
    type: DataSourceType;
}

// ─── Data Source Management ───────────────────────────────────

export class DataIngestionService {
    /**
     * Create a new data source and schedule its ingestion worker.
     */
    static async registerSource(params: {
        userId: string;
        type: DataSourceType;
        name: string;
        config: Record<string, unknown>;
        scheduleSeconds?: number;
    }) {
        const { userId, type, name, config, scheduleSeconds = 3600 } = params;

        const source = await prisma.dataSource.create({
            data: { userId, type, name, config: config as any, scheduleSeconds },
        });

        // Schedule the repeatable job
        await this.scheduleJob(source.id, type, scheduleSeconds);

        logger.info({ sourceId: source.id, type, scheduleSeconds }, 'Data source registered');
        return source;
    }

    /**
     * Remove a data source and cancel its scheduled job.
     */
    static async removeSource(sourceId: string) {
        const source = await prisma.dataSource.findUnique({ where: { id: sourceId } });
        if (!source) throw new Error(`Data source ${sourceId} not found`);

        // Remove the repeatable job
        await this.removeJob(sourceId);

        // Delete the source (cascade will handle data events via SetNull)
        await prisma.dataSource.delete({ where: { id: sourceId } });

        logger.info({ sourceId }, 'Data source removed');
    }

    /**
     * Enable or disable a data source.
     */
    static async toggleSource(sourceId: string, enabled: boolean) {
        const source = await prisma.dataSource.update({
            where: { id: sourceId },
            data: { enabled },
        });

        if (enabled) {
            await this.scheduleJob(source.id, source.type, source.scheduleSeconds);
        } else {
            await this.removeJob(sourceId);
        }

        logger.info({ sourceId, enabled }, 'Data source toggled');
        return source;
    }

    /**
     * List all data sources for a user.
     */
    static async listSources(userId: string) {
        return prisma.dataSource.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get a single data source by ID.
     */
    static async getSource(sourceId: string) {
        return prisma.dataSource.findUnique({ where: { id: sourceId } });
    }

    /**
     * Trigger a one-off manual fetch for a data source.
     */
    static async triggerFetch(sourceId: string) {
        const source = await prisma.dataSource.findUnique({ where: { id: sourceId } });
        if (!source) throw new Error(`Data source ${sourceId} not found`);

        const queue = getQueue();
        await queue.add(`manual-${sourceId}`, {
            sourceId: source.id,
            type: source.type,
        } satisfies IngestionJobData);

        logger.info({ sourceId }, 'Manual fetch triggered');
    }

    // ─── Event Storage ─────────────────────────────────────────

    /**
     * Store a raw event, deduplicated by content hash.
     * Returns the created/existing DataEvent.
     */
    static async storeEvent(params: {
        dataSourceId?: string;
        type: DataSourceType;
        event: RawEvent;
    }) {
        const { dataSourceId, type, event } = params;
        const contentHash = generateContentHash(type, event.url, event.headline);

        try {
            const dataEvent = await prisma.dataEvent.upsert({
                where: { type_contentHash: { type, contentHash } },
                create: {
                    dataSourceId,
                    type,
                    headline: event.headline,
                    body: event.body,
                    url: event.url,
                    symbol: event.symbol,
                    publishedAt: event.publishedAt,
                    metadata: event.metadata as any,
                    contentHash,
                },
                update: {}, // Don't update existing — dedup behavior
            });

            return dataEvent;
        } catch (error) {
            // Unique constraint violations are expected for dedup — log and continue
            logger.debug({ contentHash, type, headline: event.headline }, 'Duplicate event skipped');
            return null;
        }
    }

    /**
     * Batch store multiple events, returning the count of new events stored.
     */
    static async storeEvents(params: {
        dataSourceId?: string;
        type: DataSourceType;
        events: RawEvent[];
    }): Promise<{ stored: number; skipped: number }> {
        let stored = 0;
        let skipped = 0;

        for (const event of params.events) {
            const result = await this.storeEvent({
                dataSourceId: params.dataSourceId,
                type: params.type,
                event,
            });
            if (result) stored++;
            else skipped++;
        }

        return { stored, skipped };
    }

    // ─── Event Querying ────────────────────────────────────────

    /**
     * Query data events with filters.
     */
    static async getEvents(filter: {
        type?: DataSourceType;
        symbol?: string;
        from?: Date;
        to?: Date;
        impact?: DataEventImpact;
        limit?: number;
        offset?: number;
    }) {
        const { type, symbol, from, to, impact, limit = 50, offset = 0 } = filter;

        const where: any = {};
        if (type) where.type = type;
        if (symbol) where.symbol = symbol;
        if (impact) where.impact = impact;
        if (from || to) {
            where.publishedAt = {};
            if (from) where.publishedAt.gte = from;
            if (to) where.publishedAt.lte = to;
        }

        const [events, total] = await Promise.all([
            prisma.dataEvent.findMany({
                where,
                orderBy: { ingestedAt: 'desc' },
                take: limit,
                skip: offset,
                include: { dataSource: { select: { name: true, type: true } } },
            }),
            prisma.dataEvent.count({ where }),
        ]);

        return { events, total, limit, offset };
    }

    /**
     * Get a single event by ID with evidence links.
     */
    static async getEvent(eventId: string) {
        return prisma.dataEvent.findUnique({
            where: { id: eventId },
            include: {
                dataSource: { select: { name: true, type: true } },
                evidenceLinks: true,
            },
        });
    }

    /**
     * Delete a data event.
     */
    static async deleteEvent(eventId: string) {
        return prisma.dataEvent.delete({ where: { id: eventId } });
    }

    // ─── Job Scheduling ────────────────────────────────────────

    private static async scheduleJob(sourceId: string, type: DataSourceType, intervalSeconds: number) {
        const queue = getQueue();
        const jobKey = `ingestion-${sourceId}`;

        // Remove existing job first (idempotent)
        try {
            await queue.removeRepeatableByKey(jobKey);
        } catch {
            // Job might not exist yet — that's fine
        }

        await queue.add(
            jobKey,
            { sourceId, type } satisfies IngestionJobData,
            {
                repeat: {
                    every: intervalSeconds * 1000,
                },
                jobId: jobKey,
            }
        );

        logger.debug({ sourceId, intervalSeconds }, 'Ingestion job scheduled');
    }

    private static async removeJob(sourceId: string) {
        const queue = getQueue();
        const jobKey = `ingestion-${sourceId}`;

        try {
            await queue.removeRepeatableByKey(jobKey);
            logger.debug({ sourceId }, 'Ingestion job removed');
        } catch {
            logger.debug({ sourceId }, 'No ingestion job to remove');
        }
    }
}
