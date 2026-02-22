import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('Health Check', () => {
    it('GET /health returns 200 with status ok', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('strategyflow-orchestrator');
        expect(res.body.timestamp).toBeDefined();
        expect(res.body.uptime).toBeGreaterThan(0);
    });
});

describe('Security Headers', () => {
    it('includes helmet security headers', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
});

describe('CORS', () => {
    it('sets Access-Control-Allow-Origin for allowed origin', async () => {
        const res = await request(app)
            .get('/health')
            .set('Origin', 'http://localhost:5173');
        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
});

describe('404 handling', () => {
    it('returns 404 for unknown routes', async () => {
        const res = await request(app).get('/nonexistent');
        expect(res.status).toBe(404);
    });
});
