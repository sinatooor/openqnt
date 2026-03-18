import { Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../config/database.js';
import { getFetcher, type RawEvent } from '../services/fetchers/index.js';
import { DataIngestionService, type IngestionJobData } from '../services/dataIngestionService.js';

// ─── Data Ingestion Worker ────────────────────────────────────
// Generic BullMQ worker that handles ALL data source types.
// It looks up the source config, dispatches to the correct fetcher,
// then stores the events via DataIngestionService.

export const dataIngestionWorker = new Worker<IngestionJobData>(
    'data-ingestion',
    async (job: Job<IngestionJobData>) => {
        const { sourceId, type } = job.data;
        const logCtx = { jobId: job.id, sourceId, type };

        logger.info(logCtx, 'Processing data ingestion job');

        // 1. Load the data source config
        const source = await prisma.dataSource.findUnique({ where: { id: sourceId } });
        if (!source) {
            logger.warn(logCtx, 'Data source not found — skipping');
            return { skipped: true, reason: 'source_not_found' };
        }

        if (!source.enabled) {
            logger.debug(logCtx, 'Data source is disabled — skipping');
            return { skipped: true, reason: 'source_disabled' };
        }

        // 2. Get the fetcher for this source type
        const fetcher = getFetcher(type);
        if (!fetcher) {
            const msg = `No fetcher registered for type: ${type}`;
            logger.error(logCtx, msg);
            await prisma.dataSource.update({
                where: { id: sourceId },
                data: { lastError: msg },
            });
            return { skipped: true, reason: 'no_fetcher' };
        }

        // 3. Fetch data
        let events: RawEvent[];
        try {
            events = await fetcher(source);
        } catch (error: any) {
            const errMsg = error.message ?? 'Unknown fetch error';
            logger.error({ ...logCtx, error: errMsg }, 'Fetcher failed');

            await prisma.dataSource.update({
                where: { id: sourceId },
                data: {
                    lastError: errMsg,
                    lastFetchedAt: new Date(),
                },
            });
            throw error; // Let BullMQ handle retries
        }

        // 4. Store events (with dedup)
        const result = await DataIngestionService.storeEvents({
            dataSourceId: sourceId,
            type,
            events,
        });

        // 5. Update source metadata
        await prisma.dataSource.update({
            where: { id: sourceId },
            data: {
                lastFetchedAt: new Date(),
                lastError: null, // Clear any previous error
            },
        });

        logger.info(
            { ...logCtx, fetched: events.length, stored: result.stored, skipped: result.skipped },
            'Data ingestion job completed'
        );

        return {
            fetched: events.length,
            stored: result.stored,
            skipped: result.skipped,
        };
    },
    {
        connection: getRedis() as any,
        concurrency: 3, // Process up to 3 source fetches in parallel
    }
);

dataIngestionWorker.on('completed', (job, result) => {
    logger.debug({ jobId: job.id, result }, 'Ingestion job completed');
});

dataIngestionWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Ingestion job failed');
});

dataIngestionWorker.on('error', (err) => {
    logger.error({ error: err.message }, 'Ingestion worker error');
});
