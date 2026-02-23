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
    // Note: This endpoint is on the Python backend, outside of the /compute prefix 
    // because it was already defined that way in the original mcpt router.
    return computeRequest<MCPTResponse>('/api/mcpt/run', request);
}

