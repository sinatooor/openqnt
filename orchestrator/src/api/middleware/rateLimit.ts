import rateLimit from 'express-rate-limit';

// In the bundled desktop app there's exactly one local user and the limiter's
// abuse-prevention purpose disappears — meanwhile the supervisor's own
// /api/health poll alone burns 240+ requests/min, exhausting the public default
// in seconds. OPENQWNT_DESKTOP_MODE is injected by the Electron supervisor
// (matching the env-var name the FastAPI backend already honors).
const DESKTOP = process.env.OPENQWNT_DESKTOP_MODE === 'true';

/** General API rate limiter — 100 requests per 15 minutes per IP (10000 in desktop) */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: DESKTOP ? 10_000 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || req.path === '/api/health',
    message: { error: 'Too many requests, please try again later.' },
});

/** Auth endpoints rate limiter — 5 attempts per minute per IP (1000 in desktop) */
export const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: DESKTOP ? 1_000 : 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later.' },
});
