/**
 * HTTP client to the Python Compute Service.
 * All compute-heavy operations (indicators, backtesting, AI analysis)
 * are delegated to Python via these endpoints.
 */

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const BASE_URL = env.COMPUTE_SERVICE_URL;
const TIMEOUT = 30000; // 30 seconds

interface ComputeResponse<T = any> {
    data: T;
    durationMs: number;
}

async function computeRequest<T>(
    endpoint: string,
    body: Record<string, any>
): Promise<ComputeResponse<T>> {
    const url = `${BASE_URL}${endpoint}`;
    const start = Date.now();

    logger.debug({ url, body: Object.keys(body) }, 'Compute request');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Compute service error (${response.status}): ${error}`);
        }

        const data = (await response.json()) as T;
        const durationMs = Date.now() - start;

        logger.info({ endpoint, durationMs }, 'Compute request completed');

        return { data, durationMs };
    } finally {
        clearTimeout(timeout);
    }
}

// ─── Public API ──────────────────────────────────────────────

export interface IndicatorRequest {
    indicatorType: string;
    params: Record<string, any>;
    priceData: { open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] };
}

export interface IndicatorResponse {
    values: Record<string, number[]>;
}

export async function computeIndicators(
    request: IndicatorRequest
): Promise<ComputeResponse<IndicatorResponse>> {
    return computeRequest<IndicatorResponse>('/compute/indicators', request);
}

export interface BacktestRequest {
    compiledStrategy: Record<string, any>;
    parameters: {
        startDate: string;
        endDate: string;
        initialCapital: number;
        engine?: string;
    };
}

export interface BacktestResponse {
    metrics: Record<string, number>;
    equityCurve: { timestamp: string; equity: number }[];
    tradeLog: Record<string, any>[];
}

export async function runBacktest(
    request: BacktestRequest
): Promise<ComputeResponse<BacktestResponse>> {
    return computeRequest<BacktestResponse>('/compute/backtest', request);
}

export interface AIAnalysisRequest {
    context: Record<string, any>;
    agentType: 'trading' | 'research' | 'sentiment';
}

export interface AIAnalysisResponse {
    analysis: string;
    confidence: number;
    reasoning: string;
}

export async function runAIAnalysis(
    request: AIAnalysisRequest
): Promise<ComputeResponse<AIAnalysisResponse>> {
    return computeRequest<AIAnalysisResponse>('/compute/ai-analyze', request);
}

export async function checkComputeHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${BASE_URL}/compute/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });
        return response.ok;
    } catch {
        return false;
    }
}

// ─── Research & Quant Tools ──────────────────────────────────

export interface MCPTRequest {
    symbol: string;
    startDate: string;
    endDate: string;
    timeframe?: string;
    permutations?: number;
}

export interface MCPTResponse {
    pValue: number;
    permutedPfs: number[];
    realPf: number;
    plotImage?: string;
    success: boolean;
    error?: string;
}

export async function runMCPT(
    request: MCPTRequest
): Promise<ComputeResponse<MCPTResponse>> {
    return computeRequest<MCPTResponse>('/api/mcpt/run', request);
}

// ─── Monte Carlo Simulation ─────────────────────────────────

export interface MonteCarloRequest {
    trades?: { pnl: number }[];
    returns?: number[];
    numSimulations?: number;
    initialCapital?: number;
}

export interface MonteCarloResponse {
    success: boolean;
    numSimulations: number;
    percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
    mean: number;
    std: number;
    equityPaths: number[][];
    distribution: { counts: number[]; edges: number[] };
}

export async function runMonteCarlo(
    request: MonteCarloRequest
): Promise<ComputeResponse<MonteCarloResponse>> {
    return computeRequest<MonteCarloResponse>('/compute/monte-carlo', request);
}

// ─── HMM Regime Detection ───────────────────────────────────

export interface HMMRegimeRequest {
    prices: number[];
    numStates?: number;
    lookback?: number;
}

export interface HMMRegimeResponse {
    success: boolean;
    states: number[];
    stateLabels: Record<string, string>;
    transitionMatrix: number[][];
    means: number[];
    variances: number[][];
    currentRegime: string;
}

export async function runHMMRegime(
    request: HMMRegimeRequest
): Promise<ComputeResponse<HMMRegimeResponse>> {
    return computeRequest<HMMRegimeResponse>('/compute/hmm-regime', request);
}

// ─── Walk-Forward Analysis ──────────────────────────────────

export interface WalkForwardRequest {
    returns: number[];
    trainWindow?: number;
    testWindow?: number;
}

export interface WalkForwardResponse {
    success: boolean;
    numWindows: number;
    windows: { startIdx: number; trainSharpe: number; testSharpe: number; trainReturn: number; testReturn: number }[];
    overallOOSSharpe: number;
    avgISSharpe: number;
    efficiency: number;
}

export async function runWalkForward(
    request: WalkForwardRequest
): Promise<ComputeResponse<WalkForwardResponse>> {
    return computeRequest<WalkForwardResponse>('/compute/walk-forward', request);
}

// ─── VaR / CVaR ─────────────────────────────────────────────

export interface VaRCVaRRequest {
    returns: number[];
    confidence?: number;
    portfolioValue?: number;
}

export interface VaRCVaRResponse {
    success: boolean;
    var: number;
    cvar: number;
    varDollar: number;
    cvarDollar: number;
    meanReturn: number;
    stdReturn: number;
}

export async function runVaRCVaR(
    request: VaRCVaRRequest
): Promise<ComputeResponse<VaRCVaRResponse>> {
    return computeRequest<VaRCVaRResponse>('/compute/var-cvar', request);
}

// ─── Cointegration Test ─────────────────────────────────────

export interface CointegrationRequest {
    pricesA: number[];
    pricesB: number[];
    symbolA?: string;
    symbolB?: string;
}

export interface CointegrationResponse {
    success: boolean;
    cointegrated: boolean;
    pValue: number;
    tStatistic: number;
    hedgeRatio: number;
    spreadMean: number;
    spreadStd: number;
    currentSpread: number;
    zScore: number;
}

export async function runCointegration(
    request: CointegrationRequest
): Promise<ComputeResponse<CointegrationResponse>> {
    return computeRequest<CointegrationResponse>('/compute/cointegration', request);
}

// ─── Parameter Sweep ────────────────────────────────────────

export interface ParamSweepRequest {
    paramName: string;
    paramValues: number[];
    returns?: Record<string, number[]>;
    backtestResults?: Record<string, { sharpe: number; totalReturn: number; maxDrawdown: number }>;
}

export interface ParamSweepResponse {
    success: boolean;
    paramName: string;
    results: { paramValue: number; sharpe: number; totalReturn: number; maxDrawdown: number }[];
    bestParam: { paramValue: number; sharpe: number } | null;
}

export async function runParamSweep(
    request: ParamSweepRequest
): Promise<ComputeResponse<ParamSweepResponse>> {
    return computeRequest<ParamSweepResponse>('/compute/param-sweep', request);
}

// ─── QuantStats Report ──────────────────────────────────────

export interface QuantStatsRequest {
    ticker: string;
    benchmark?: string;
    startDate?: string;
    endDate?: string;
}

export interface QuantStatsResponse {
    success: boolean;
    ticker: string;
    benchmark: string;
    startDate: string;
    endDate: string;
    metrics: Record<string, number | null>;
    plots: Record<string, string>;
}

export async function runQuantStats(
    request: QuantStatsRequest
): Promise<ComputeResponse<QuantStatsResponse>> {
    return computeRequest<QuantStatsResponse>('/compute/quantstats-report', request);
}

// ─── Quant-Trading Strategy ─────────────────────────────────

export interface QuantStrategyRequest {
    strategy: string;
    ticker: string;
    startDate?: string;
    endDate?: string;
    params?: Record<string, any>;
}

export interface QuantStrategyResponse {
    success: boolean;
    strategy: string;
    strategyName: string;
    ticker: string;
    startDate: string;
    endDate: string;
    metrics: Record<string, number | string>;
    plotImage: string;
}

export async function runQuantStrategy(
    request: QuantStrategyRequest
): Promise<ComputeResponse<QuantStrategyResponse>> {
    return computeRequest<QuantStrategyResponse>('/compute/quant-strategy', request);
}

export interface StrategyListItem {
    id: string;
    name: string;
    description: string;
    defaultParams: Record<string, any>;
}

export async function listQuantStrategies(): Promise<ComputeResponse<{ success: boolean; strategies: StrategyListItem[] }>> {
    const url = `${BASE_URL}/compute/quant-strategies-list`;
    const start = Date.now();
    const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(TIMEOUT) });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Compute service error (${response.status}): ${error}`);
    }
    const data = await response.json();
    return { data, durationMs: Date.now() - start };
}
