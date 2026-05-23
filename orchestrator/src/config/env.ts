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

    // Shared token between Python backend and Node orchestrator for
    // server-to-server calls (e.g. POST /api/notifications/dispatch).
    INTERNAL_API_TOKEN: z.string().optional(),

    // Notifications
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_DEFAULT_CHAT_ID: z.string().optional(),
    SLACK_BOT_TOKEN: z.string().optional(),
    SLACK_DEFAULT_CHANNEL: z.string().optional(),
    DISCORD_BOT_WEBHOOK_URL: z.string().optional(),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_PHONE_NUMBER: z.string().optional(),
    SENDGRID_API_KEY: z.string().optional(),
    EMAIL_FROM_ADDRESS: z.string().default('noreply@strategyflow.app'),

    // External Market-Data APIs (all optional; yfinance in the Python
    // compute layer covers the baseline without any key).
    FMP_API_KEY: z.string().optional(),
    ALPHA_VANTAGE_API_KEY: z.string().optional(),
    FINNHUB_API_KEY: z.string().optional(),
    POLYGON_API_KEY: z.string().optional(),
    FRED_API_KEY: z.string().optional(),
    NEWSAPI_KEY: z.string().optional(),

    // Research / scraping connectors
    FIRECRAWL_API_KEY: z.string().optional(),
    PERPLEXITY_API_KEY: z.string().optional(),
    TAVILY_API_KEY: z.string().optional(),
    BRAVE_SEARCH_API_KEY: z.string().optional(),
    GOOGLE_CSE_API_KEY: z.string().optional(),
    GOOGLE_CSE_ID: z.string().optional(),
    TRADINGVIEW_WEBHOOK_SECRET: z.string().optional(),

    // LLM providers — orchestrator can call them directly for lightweight
    // helpers that don't warrant the Python trip.
    GEMINI_API_KEY: z.string().optional(),
    DEEPSEEK_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),

    // Broker APIs (optional; each broker also has its own env block in the
    // Python backend — these are only needed if the orchestrator itself
    // talks to the broker directly).
    IG_API_KEY: z.string().optional(),
    IG_USERNAME: z.string().optional(),
    IG_PASSWORD: z.string().optional(),
    IG_ACCOUNT_TYPE: z.string().default('DEMO'),
    ALPACA_API_KEY: z.string().optional(),
    ALPACA_API_SECRET: z.string().optional(),
    ALPACA_BASE_URL: z.string().default('https://paper-api.alpaca.markets'),
    BINANCE_API_KEY: z.string().optional(),
    BINANCE_API_SECRET: z.string().optional(),
    NORDNET_API_KEY: z.string().optional(),
    NORDNET_PRIVATE_KEY: z.string().optional(),
    IBKR_GATEWAY_URL: z.string().optional(),
    IBKR_ACCOUNT_ID: z.string().optional(),
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
