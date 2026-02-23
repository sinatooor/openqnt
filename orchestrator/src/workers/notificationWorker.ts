import { Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { NotificationService, DispatchOptions } from '../services/notificationService.js';

export const notificationWorker = new Worker<DispatchOptions>(
    'notifications',
    async (job: Job<DispatchOptions>) => {
        logger.info({ jobId: job.id, channel: job.data.channel }, 'Processing notification job');

        const success = await NotificationService.dispatch(job.data);

        if (!success) {
            throw new Error(`Failed to dispatch notification via ${job.data.channel}`);
        }
    },
    {
        connection: getRedis() as any,
        concurrency: 5, // Process up to 5 notifications concurrently
    }
);

notificationWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Notification job completed');
});

notificationWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Notification job failed');
});
