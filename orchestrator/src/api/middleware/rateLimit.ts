import rateLimit from 'express-rate-limit';

/** General API rate limiter — 100 requests per 15 minutes per IP */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

/** Auth endpoints rate limiter — 5 attempts per minute per IP */
export const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later.' },
});
