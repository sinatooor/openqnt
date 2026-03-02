import { Router } from 'express';
import {
    runMCPT, MCPTRequest,
    runMonteCarlo, MonteCarloRequest,
    runHMMRegime, HMMRegimeRequest,
    runWalkForward, WalkForwardRequest,
    runVaRCVaR, VaRCVaRRequest,
    runCointegration, CointegrationRequest,
    runParamSweep, ParamSweepRequest,
    runQuantStats, QuantStatsRequest,
    runQuantStrategy, QuantStrategyRequest,
    listQuantStrategies,
} from '../../services/computeClient.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// ─── Monte Carlo Permutation Test (existing) ────────────────

router.post('/mcpt', async (req, res) => {
    try {
        const { symbol, startDate, endDate, timeframe, permutations } = req.body;
        if (!symbol || !startDate || !endDate) {
            return res.status(400).json({ error: 'Missing required fields: symbol, startDate, endDate' });
        }
        const request: MCPTRequest = {
            symbol, startDate, endDate,
            timeframe: timeframe || '1d',
            permutations: permutations ? parseInt(permutations) : 100,
        };
        const result = await runMCPT(request);
        if (!result.data.success) {
            return res.status(400).json({ error: result.data.error || 'MCPT failed' });
        }
        return res.json(result.data);
    } catch (error: any) {
        logger.error({ err: error }, 'MCPT failed');
        return res.status(500).json({ error: error.message || 'MCPT failed' });
    }
});

// ─── Monte Carlo Simulation ─────────────────────────────────

router.post('/monte-carlo', async (req, res) => {
    try {
        const request: MonteCarloRequest = req.body;
        if (!request.trades?.length && !request.returns?.length) {
            return res.status(400).json({ error: 'Provide trades or returns' });
        }
        const result = await runMonteCarlo(request);
        return res.json(result.data);
    } catch (error: any) {
        logger.error({ err: error }, 'Monte Carlo failed');
        return res.status(500).json({ error: error.message || 'Monte Carlo simulation failed' });
    }
});

// ─── HMM Regime Detection ───────────────────────────────────

router.post('/hmm-regime', async (req, res) => {
    try {
        const request: HMMRegimeRequest = req.body;
        if (!request.prices?.length || request.prices.length < 30) {
            return res.status(400).json({ error: 'Need at least 30 price observations' });
        }
        const result = await runHMMRegime(request);
        return res.json(result.data);
    } catch (error: any) {
        logger.error({ err: error }, 'HMM regime detection failed');
        return res.status(500).json({ error: error.message || 'HMM regime detection failed' });
    }
});

// ─── Walk-Forward Analysis ──────────────────────────────────

router.post('/walk-forward', async (req, res) => {
    try {
        const request: WalkForwardRequest = req.body;
        if (!request.returns?.length) {
            return res.status(400).json({ error: 'Provide returns array' });
        }
        const result = await runWalkForward(request);
        return res.json(result.data);
    } catch (error: any) {
        logger.error({ err: error }, 'Walk-forward analysis failed');
        return res.status(500).json({ error: error.message || 'Walk-forward analysis failed' });
    }
});

// ─── VaR / CVaR ─────────────────────────────────────────────

router.post('/var-cvar', async (req, res) => {
    try {
        const request: VaRCVaRRequest = req.body;
        if (!request.returns?.length || request.returns.length < 10) {
            return res.status(400).json({ error: 'Need at least 10 return observations' });
        }
        const result = await runVaRCVaR(request);
        return res.json(result.data);
    } catch (error: any) {
        logger.error({ err: error }, 'VaR/CVaR failed');
        return res.status(500).json({ error: error.message || 'VaR/CVaR computation failed' });
    }
});

// ─── Cointegration Test ─────────────────────────────────────

router.post('/cointegration', async (req, res) => {
    try {
        const request: CointegrationRequest = req.body;
        if (!request.pricesA?.length || !request.pricesB?.length) {
            return res.status(400).json({ error: 'Provide pricesA and pricesB arrays' });
        }
        const result = await runCointegration(request);
        return res.json(result.data);
    } catch (error: any) {
        logger.error({ err: error }, 'Cointegration test failed');
        return res.status(500).json({ error: error.message || 'Cointegration test failed' });
    }
});

// ─── Parameter Sweep ────────────────────────────────────────

router.post('/param-sweep', async (req, res) => {
    try {
        const request: ParamSweepRequest = req.body;
        if (!request.paramValues?.length) {
            return res.status(400).json({ error: 'Provide paramValues array' });
        }
        const result = await runParamSweep(request);
        return res.json(result.data);
    } catch (error: any) {
        logger.error({ err: error }, 'Parameter sweep failed');
        return res.status(500).json({ error: error.message || 'Parameter sweep failed' });
    }
});

// ─── QuantStats Portfolio Analytics ─────────────────────────

router.post('/quantstats', async (req, res) => {
    try {
        const request: QuantStatsRequest = req.body;
        if (!request.ticker) {
            return res.status(400).json({ error: 'Missing required field: ticker' });
        }
        const result = await runQuantStats(request);
        return res.json(result.data);
    } catch (error: any) {
        logger.error({ err: error }, 'QuantStats report failed');
        return res.status(500).json({ error: error.message || 'QuantStats report failed' });
    }
});

// ─── Quant-Trading Strategy Backtest ────────────────────────

router.post('/quant-strategy', async (req, res) => {
    try {
        const request: QuantStrategyRequest = req.body;
        if (!request.strategy || !request.ticker) {
            return res.status(400).json({ error: 'Missing required fields: strategy, ticker' });
        }
        const result = await runQuantStrategy(request);
        return res.json(result.data);
    } catch (error: any) {
        logger.error({ err: error }, 'Quant strategy failed');
        return res.status(500).json({ error: error.message || 'Quant strategy backtest failed' });
    }
});

// ─── List Available Quant Strategies ────────────────────────

router.get('/quant-strategies-list', async (_req, res) => {
    try {
        const result = await listQuantStrategies();
        return res.json(result.data);
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to list quant strategies');
        return res.status(500).json({ error: error.message || 'Failed to list strategies' });
    }
});

export default router;
