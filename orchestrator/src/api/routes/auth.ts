import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { authMiddleware, type JwtPayload } from '../middleware/auth.js';

const router = Router();

// ── Schemas ─────────────────────────────────────────────────

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    name: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

// ── Helpers ─────────────────────────────────────────────────

function generateTokens(payload: JwtPayload) {
    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_ACCESS_EXPIRY as any,
    });
    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
        expiresIn: env.JWT_REFRESH_EXPIRY as any,
    });
    return { accessToken, refreshToken };
}

// ── Routes ──────────────────────────────────────────────────

/** POST /api/auth/register */
router.post('/register', authLimiter, validate(registerSchema), async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            res.status(409).json({ error: 'Email already registered' });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: { email, passwordHash, name },
        });

        // Create default agent config
        await prisma.agentConfig.create({
            data: { userId: user.id },
        });

        const tokens = generateTokens({ userId: user.id, email: user.email });

        logger.info({ userId: user.id }, 'User registered');
        res.status(201).json({
            user: { id: user.id, email: user.email, name: user.name },
            ...tokens,
        });
    } catch (error) {
        logger.error({ error }, 'Registration failed');
        res.status(500).json({ error: 'Registration failed' });
    }
});

/** POST /api/auth/login */
router.post('/login', authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const tokens = generateTokens({ userId: user.id, email: user.email });

        logger.info({ userId: user.id }, 'User logged in');
        res.json({
            user: { id: user.id, email: user.email, name: user.name },
            ...tokens,
        });
    } catch (error) {
        logger.error({ error }, 'Login failed');
        res.status(500).json({ error: 'Login failed' });
    }
});

/** POST /api/auth/refresh */
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            res.status(400).json({ error: 'Refresh token required' });
            return;
        }

        const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtPayload;

        // Verify user still exists
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }

        const tokens = generateTokens({ userId: user.id, email: user.email });

        res.json(tokens);
    } catch (error) {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});

/** POST /api/auth/logout */
router.post('/logout', authMiddleware, async (_req: Request, res: Response) => {
    // In a production system, we'd add the refresh token to a blacklist in Redis.
    // For now, the client simply discards the token.
    res.json({ message: 'Logged out successfully' });
});

/** GET /api/auth/me — get current user */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: { id: true, email: true, name: true, subscriptionTier: true, createdAt: true },
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

export default router;
