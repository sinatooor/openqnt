import { Router, Request, Response } from 'express';

const router = Router();

/** Health check — used by Docker, load balancers, and monitoring */
router.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'ok',
        service: 'strategyflow-orchestrator',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

export default router;
