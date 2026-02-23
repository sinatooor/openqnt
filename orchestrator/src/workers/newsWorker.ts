import { Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { NewsService } from '../services/newsService.js';
import { prisma } from '../config/database.js';
import { executeStrategy } from '../services/executionService.js';

export interface NewsJobData {
    feedUrls: string[];
}

export const newsWorker = new Worker<NewsJobData>(
    'news',
    async (job: Job<NewsJobData>) => {
        logger.info({ jobId: job.id, feeds: job.data.feedUrls }, 'Processing news polling job');

        for (const url of job.data.feedUrls) {
            const articles = await NewsService.fetchFeed(url, 5); // Fetch top 5 latest
            if (articles.length === 0) continue;

            const strategies = await prisma.strategy.findMany({
                where: { status: 'active' }
            });

            for (const strategy of strategies) {
                const nodes = (strategy.nodes as any[]) ?? [];
                const triggers = nodes.filter(n => n.type === 'trigger' && n.data?.triggerType === 'news');

                if (triggers.length === 0) continue;

                // For each trigger matching this feed (or generic news), trigger an execution per article
                for (const article of articles) {
                    try {
                        await executeStrategy({
                            strategyId: strategy.id,
                            userId: strategy.userId,
                            triggerType: 'news',
                            triggerData: article,
                            bar: {
                                timestamp: new Date().toISOString(),
                                open: 0, high: 0, low: 0, close: 0, volume: 0, symbol: 'UNKNOWN'
                            },
                            history: [],
                            barIndex: 0
                        });
                    } catch (error) {
                        logger.error({ error, strategyId: strategy.id }, 'Failed to trigger strategy on news');
                    }
                }
            }
        }
    },
    {
        connection: getRedis() as any,
        concurrency: 1, // Avoid spamming API requests initially
    }
);

newsWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'News polling job completed');
});

newsWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'News polling job failed');
});
