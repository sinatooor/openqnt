import { Router } from 'express';
import { runMCPT, MCPTRequest } from '../../services/computeClient.js';
import { logger } from '../../utils/logger.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Apply authentication middleware to all research routes
router.use(authenticate);

/**
 * POST /api/research/mcpt
 * Run a Monte Carlo Permutation Test (MCPT)
 */
router.post('/mcpt', async (req, res) => {
    try {
        const { symbol, startDate, endDate, timeframe, permutations } = req.body;

        if (!symbol || !startDate || !endDate) {
            return res.status(400).json({ error: 'Missing required fields: symbol, startDate, endDate' });
        }

        const request: MCPTRequest = {
            symbol,
            startDate,
            endDate,
            timeframe: timeframe || '1d',
            permutations: permutations ? parseInt(permutations) : 100,
        };

        const result = await runMCPT(request);

        if (!result.data.success) {
            return res.status(400).json({ error: result.data.error || 'MCPT failed on compute service' });
        }

        res.json(result.data);
    } catch (error: any) {
        logger.error({ err: error }, 'Error running MCPT');
        res.status(500).json({ error: error.message || 'Internal server error while running MCPT' });
    }
});

export default router;
