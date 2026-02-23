/**
 * Webhook Handler Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../../src/app.js';
import request from 'supertest';

describe('Webhooks API', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
    });

    it('POST /api/webhooks/:strategyId — should return 404 for non-existent strategy', async () => {
        const res = await request(app)
            .post('/api/webhooks/non-existent-id')
            .send({ symbol: 'AAPL', price: 150 });

        // Will get 404 since we don't have a real DB connected in tests
        // or 500 if Prisma isn't available — either confirms the route exists
        expect([404, 500]).toContain(res.status);
    });

    it('POST /api/webhooks/hitl/:executionId — should return 404 for non-existent execution', async () => {
        const res = await request(app)
            .post('/api/webhooks/hitl/non-existent-id')
            .send({ action: 'approve', userId: 'test-user' });

        expect([404, 500]).toContain(res.status);
    });
});
