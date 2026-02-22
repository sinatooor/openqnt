import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
    if (!redisInstance) {
        redisInstance = new Redis({
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            password: env.REDIS_PASSWORD,
            maxRetriesPerRequest: null, // Required for BullMQ
            retryStrategy(times: number) {
                const delay = Math.min(times * 200, 5000);
                logger.warn({ attempt: times, delay }, 'Redis reconnecting...');
                return delay;
            },
        });

        redisInstance.on('connect', () => {
            logger.info('Redis connected');
        });

        redisInstance.on('error', (err) => {
            logger.error({ err }, 'Redis connection error');
        });
    }

    return redisInstance;
}

export async function closeRedis(): Promise<void> {
    if (redisInstance) {
        await redisInstance.quit();
        redisInstance = null;
        logger.info('Redis disconnected');
    }
}
