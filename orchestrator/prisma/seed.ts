import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // ── Create test user ──────────────────────────────────────
    const passwordHash = await bcrypt.hash('testpassword123', 12);

    const user = await prisma.user.upsert({
        where: { email: 'test@strategyflow.ai' },
        update: {},
        create: {
            email: 'test@strategyflow.ai',
            passwordHash,
            name: 'Test User',
            subscriptionTier: 'pro',
            preferences: {
                theme: 'dark',
                notifications: { telegram: true, email: true },
            },
        },
    });

    console.log(`  ✅ User created: ${user.email} (${user.id})`);

    // ── Create test strategy ──────────────────────────────────
    const strategy = await prisma.strategy.upsert({
        where: { id: 'seed-strategy-001' },
        update: {},
        create: {
            id: 'seed-strategy-001',
            userId: user.id,
            name: 'RSI Mean Reversion',
            description: 'Buy when RSI < 30 on quality stocks with no negative news',
            nodes: [
                {
                    id: 'env-price-1',
                    type: 'environment',
                    position: { x: 100, y: 200 },
                    data: { label: 'Price', environmentType: 'price', priceType: 'mid' },
                },
                {
                    id: 'ind-rsi-1',
                    type: 'indicator',
                    position: { x: 300, y: 200 },
                    data: { label: 'RSI', indicatorType: 'rsi', params: { period: 14 } },
                },
                {
                    id: 'cond-compare-1',
                    type: 'condition',
                    position: { x: 500, y: 200 },
                    data: { label: 'RSI < 30', conditionType: 'compare', operator: 'lt', value: 30 },
                },
                {
                    id: 'action-buy-1',
                    type: 'action',
                    position: { x: 700, y: 200 },
                    data: { label: 'Buy $500', actionType: 'order', direction: 'buy', size: 500, sizeType: 'fixed' },
                },
            ],
            edges: [
                { id: 'e1', source: 'env-price-1', target: 'ind-rsi-1' },
                { id: 'e2', source: 'ind-rsi-1', target: 'cond-compare-1' },
                { id: 'e3', source: 'cond-compare-1', target: 'action-buy-1' },
            ],
            settings: { name: 'RSI Mean Reversion', instrument: 'AAPL', timeframe: '1h' },
            status: 'draft',
        },
    });

    console.log(`  ✅ Strategy created: ${strategy.name} (${strategy.id})`);

    // ── Create agent config for user ──────────────────────────
    const agentConfig = await prisma.agentConfig.upsert({
        where: { userId: user.id },
        update: {},
        create: {
            userId: user.id,
            operationalMode: 'advisory',
            heartbeatIntervalSeconds: 300,
            activeHours: { mode: '24/7' },
            maxSingleTradeValue: 1000,
            maxDailySpend: 5000,
            maxPositionConcentrationPct: 20,
        },
    });

    console.log(`  ✅ Agent config created: mode=${agentConfig.operationalMode}`);

    console.log('\n🎉 Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
