import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
    level: env.LOG_LEVEL,
    transport:
        env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'HH:MM:ss.l',
                    ignore: 'pid,hostname',
                },
            }
            : undefined,
    serializers: {
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
    },
    base: {
        service: 'orchestrator',
    },
});
