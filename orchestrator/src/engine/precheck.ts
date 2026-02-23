/**
 * Pre-check Agent — lightweight threshold checks before full graph evaluation.
 * Inspired by OpenClaw's cheap-check-first pattern.
 *
 * Before invoking the full FlowInterpreter (and Python compute service),
 * the pre-check agent performs fast, local checks to determine if any
 * trigger conditions are close to firing. If no pre-checks pass,
 * the heartbeat cycle completes silently as HEARTBEAT_OK.
 */

import { logger } from '../utils/logger.js';

// ─── Types ───────────────────────────────────────────────────

export interface PrecheckInput {
    /** The node data from trigger nodes in the strategy */
    triggerNodes: TriggerNodeConfig[];
    /** Current market data snapshot (cheap to fetch) */
    marketSnapshot: MarketSnapshot;
}

export interface TriggerNodeConfig {
    nodeId: string;
    triggerType: string;
    config: Record<string, any>;
}

export interface MarketSnapshot {
    /** Current prices by symbol */
    prices: Record<string, number>;
    /** Volume for current period by symbol */
    volumes: Record<string, number>;
    /** Timestamp of the snapshot */
    timestamp: string;
}

export interface PrecheckResult {
    /** Whether at least one pre-check fired — if false, skip full evaluation */
    shouldEvaluate: boolean;
    /** Which trigger nodes passed pre-checks */
    firedTriggers: string[];
    /** Diagnostic summary for logging */
    summary: string;
    /** Duration of pre-check in ms */
    durationMs: number;
}

// ─── Pre-check Logic ─────────────────────────────────────────

/**
 * Run lightweight pre-checks on all trigger nodes.
 * This avoids expensive Python compute and LLM calls when no triggers fire.
 */
export function runPrechecks(input: PrecheckInput): PrecheckResult {
    const start = Date.now();
    const firedTriggers: string[] = [];

    for (const trigger of input.triggerNodes) {
        const fired = checkTrigger(trigger, input.marketSnapshot);
        if (fired) {
            firedTriggers.push(trigger.nodeId);
        }
    }

    const shouldEvaluate = firedTriggers.length > 0;
    const durationMs = Date.now() - start;

    const summary = shouldEvaluate
        ? `${firedTriggers.length}/${input.triggerNodes.length} triggers fired (${firedTriggers.join(', ')})`
        : `HEARTBEAT_OK — 0/${input.triggerNodes.length} triggers fired`;

    if (!shouldEvaluate) {
        logger.debug({ durationMs, triggers: input.triggerNodes.length }, summary);
    } else {
        logger.info({ durationMs, firedTriggers }, summary);
    }

    return { shouldEvaluate, firedTriggers, summary, durationMs };
}

/**
 * Check a single trigger node against the current market snapshot.
 * These are intentionally cheap, O(1) operations — no network calls.
 */
function checkTrigger(trigger: TriggerNodeConfig, market: MarketSnapshot): boolean {
    switch (trigger.triggerType) {
        case 'heartbeatTrigger':
            // Heartbeat triggers always fire (they run on schedule)
            return true;

        case 'webhookTrigger':
            // Webhook triggers are event-driven — they fire externally, not on heartbeat
            return false;

        case 'priceAlertTrigger': {
            const { symbol, condition, priceLevel } = trigger.config;
            const currentPrice = market.prices[symbol];
            if (currentPrice === undefined || priceLevel === undefined) return false;

            switch (condition) {
                case 'crosses_above': return currentPrice >= priceLevel;
                case 'crosses_below': return currentPrice <= priceLevel;
                case 'equals': return Math.abs(currentPrice - priceLevel) < 0.01;
                default: return false;
            }
        }

        case 'newsTrigger':
            // News triggers require external data — they fire via a separate news poller service.
            // Pre-check: skip on heartbeat, handled by news event bus.
            return false;

        case 'brokerEventTrigger':
            // Broker events are pushed via websocket — they fire externally.
            return false;

        default:
            logger.warn({ triggerType: trigger.triggerType }, 'Unknown trigger type in pre-check');
            return false;
    }
}

// ─── Extract Trigger Nodes ──────────────────────────────────

/**
 * Extract trigger node configs from a compiled strategy's nodes.
 */
export function extractTriggerNodes(
    nodes: Array<{ id: string; type: string; data?: Record<string, any> }>
): TriggerNodeConfig[] {
    return nodes
        .filter(n => n.type === 'trigger')
        .map(n => ({
            nodeId: n.id,
            triggerType: n.data?.triggerType ?? 'heartbeatTrigger',
            config: n.data ?? {},
        }));
}
