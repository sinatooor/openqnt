import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface JwtPayload {
    userId: string;
    email: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

// Bundled desktop builds: there's a single local user; auth is enforced at the
// OS level. Same shortcut applies in plain dev so the frontend can hit API
// routes without first walking through a real login flow against a backend
// that hasn't been wired up yet.
const SKIP_AUTH =
    process.env.OPENQWNT_DESKTOP_MODE === 'true' ||
    process.env.NODE_ENV === 'development';
const LOCAL_USER: JwtPayload = { userId: 'local-user', email: 'you@openqnt.local' };

/**
 * JWT authentication middleware.
 * Verifies the Bearer token and attaches `req.user`.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (SKIP_AUTH) {
        req.user = LOCAL_USER;
        next();
        return;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
        req.user = decoded;
        next();
    } catch (error) {
        logger.debug({ error }, 'JWT verification failed');
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
