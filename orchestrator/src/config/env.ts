import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),

    // Database
    DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/strategyflow'),

    // Redis
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // JWT
    JWT_SECRET: z.string().default('dev-jwt-secret-change-in-production'),
    JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret-change-in-production'),
    JWT_ACCESS_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),

    // Credential Vault
    ENCRYPTION_KEY: z.string().default('dev-encryption-key-32-chars-long!'),

    // Python Compute Service
    COMPUTE_SERVICE_URL: z.string().default('http://localhost:8000'),

    // Logging
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    // CORS
    FRONTEND_URL: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error('❌ Invalid environment variables:', result.error.flatten().fieldErrors);
        process.exit(1);
    }
    return result.data;
}

export const env = loadEnv();
