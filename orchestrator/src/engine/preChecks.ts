/**
 * Pre-check rules evaluated before strategy execution.
 * These act as guardrails to prevent unwanted trades.
 */

import type { PortfolioState, Bar } from './interpreter.js';
import { logger } from '../utils/logger.js';

export interface AgentConfigInput {
    emergencyKill: boolean;
    maxSingleTradeValue: number | null;
    maxPositionConcentrationPct: number | null;
    maxDailySpend: number | null;
    operationalMode: string;
}

export interface PreCheckResult {
    passed: boolean;
    failedChecks: string[];
}

/**
 * Run all pre-checks before executing a strategy.
 * Returns the result with a list of any failed checks.
 */
export function runPreChecks(
    agentConfig: AgentConfigInput,
    portfolio: PortfolioState,
    bar: Bar,
    orderSize?: number
): PreCheckResult {
    const failedChecks: string[] = [];

    // 1. Emergency kill switch
    if (agentConfig.emergencyKill) {
        failedChecks.push('Emergency kill switch is activated');
    }

    // 2. Max single trade value
    if (agentConfig.maxSingleTradeValue && orderSize) {
        const tradeValue = orderSize * bar.close;
        if (tradeValue > agentConfig.maxSingleTradeValue) {
            failedChecks.push(
                `Trade value $${tradeValue.toFixed(2)} exceeds max $${agentConfig.maxSingleTradeValue}`
            );
        }
    }

    // 3. Max position concentration
    if (agentConfig.maxPositionConcentrationPct && portfolio.equity > 0) {
        const positionValue = Object.values(portfolio.positions).reduce(
            (sum, p) => sum + p.size * bar.close,
            0
        );
        const concentration = (positionValue / portfolio.equity) * 100;
        if (concentration > agentConfig.maxPositionConcentrationPct) {
            failedChecks.push(
                `Position concentration ${concentration.toFixed(1)}% exceeds max ${agentConfig.maxPositionConcentrationPct}%`
            );
        }
    }

    // 4. Advisory mode — always block actual execution
    if (agentConfig.operationalMode === 'advisory') {
        failedChecks.push('Agent is in advisory mode — no trades executed');
    }

    // 5. Simulation mode — trades are simulated, not blocked
    // (no fail — simulation mode allows through but marks as simulated)

    const passed = failedChecks.length === 0;

    if (!passed) {
        logger.info({ failedChecks }, 'Pre-checks failed');
    }

    return { passed, failedChecks };
}
