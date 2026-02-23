/**
 * Execution service — orchestrates the full flow execution lifecycle:
 * 1. Pre-checks
 * 2. Indicator computation (via Python)
 * 3. Flow interpretation
 * 4. Execution logging to database
 */

import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { compileFlowStrategy } from '../engine/compiler.js';
import { FlowInterpreter, type EvaluationContext, type EvaluationResult, type Bar } from '../engine/interpreter.js';
import { runPreChecks } from '../engine/preChecks.js';
import { notificationQueue } from './notificationService.js';
import { getBrokerClient } from './brokerGateway.js';
import { computeIndicators } from './computeClient.js';
type TriggerType = 'heartbeat' | 'webhook' | 'price_alert' | 'news' | 'manual' | 'replay';

export interface ExecuteStrategyInput {
    strategyId: string;
    userId: string;
    triggerType: TriggerType;
    triggerData?: Record<string, any>;
    bar?: Bar;
    history?: Bar[];
    barIndex?: number;
}

export interface ExecuteStrategyOutput {
    executionRunId: string;
    result: EvaluationResult;
    preChecksPassed: boolean;
    preCheckFailures: string[];
}

/**
 * Execute a strategy end-to-end: compile → pre-check → interpret → log.
 */
export async function executeStrategy(input: ExecuteStrategyInput): Promise<ExecuteStrategyOutput> {
    const startTime = Date.now();

    // 1. Load strategy
    const strategy = await prisma.strategy.findUnique({
        where: { id: input.strategyId },
    });

    if (!strategy) {
        throw new Error(`Strategy ${input.strategyId} not found`);
    }

    // 2. Load agent config & user for pre-checks and notifications
    const agentConfig = await prisma.agentConfig.findUnique({
        where: { userId: input.userId },
        include: { user: true }
    });

    if (!agentConfig) {
        throw new Error(`Agent config not found for user ${input.userId}`);
    }

    // 3. Compile the strategy
    const nodes = strategy.nodes as any[];
    const edges = strategy.edges as any[];
    const settings = (strategy.settings as Record<string, any>) ?? {};
    const compiled = compileFlowStrategy(nodes, edges, { ...settings, name: strategy.name });

    // Data Fetching Logic (if not provided)
    let bar = input.bar;
    let history = input.history ?? [];
    let barIndex = input.barIndex ?? 0;

    if (!bar) {
        // Fetch portfolio to get broker credential
        const portfolioRec = await prisma.portfolio.findFirst({ where: { userId: input.userId } });
        if (portfolioRec) {
            try {
                const broker = getBrokerClient(portfolioRec.brokerName);
                // In production, fetch decrypted credentials from vault
                if (!broker.isConnected()) {
                    await broker.connect(portfolioRec.credentialAlias ?? '');
                }

                const symbol = (settings.symbol as string) ?? 'SPY';
                const timeframe = (settings.timeframe as string) ?? '1440'; // Daily default

                // Fetch 200 bars for indicators
                const bars = await broker.getBars(symbol, timeframe, 200);
                if (bars.length > 0) {
                    bar = bars[bars.length - 1];
                    history = bars;
                    barIndex = bars.length - 1;
                }
            } catch (err) {
                logger.error({ error: err, strategyId: input.strategyId }, 'Failed to fetch market data');
            }
        }
    }

    if (!bar) {
        // If still no data (and none provided), we can't execute meaningful logic.
        // But to avoid crashing if broker fails, we might create a fallback or throw.
        // Throwing ensures we don't execute on bad data.
        throw new Error('Market data not available for strategy execution');
    }

    // 4. Run pre-checks
    const portfolio = { cash: 0, equity: 0, positions: {} }; // TODO: load from broker
    const preChecks = runPreChecks(agentConfig, portfolio, bar);

    // 5. Create execution run record
    const executionRun = await prisma.executionRun.create({
        data: {
            strategyId: input.strategyId,
            userId: input.userId,
            triggerType: input.triggerType,
            triggerData: input.triggerData,
            status: preChecks.passed ? 'running' : 'skipped',
        },
    });

    // 6. Interpret the strategy flow
    const interpreter = new FlowInterpreter(compiled.compiled);

    // Pre-calculate Indicators
    const indicatorCache: Record<string, number[]> = {};
    for (const node of compiled.compiled.nodes) {
        if (node.type === 'indicator') {
            const data = node.data ?? {};
            const indicatorType = data.indicatorType;
            if (!indicatorType) continue;

            try {
                const priceData = {
                    open: history.map((b) => b.open),
                    high: history.map((b) => b.high),
                    low: history.map((b) => b.low),
                    close: history.map((b) => b.close),
                    volume: history.map((b) => b.volume),
                };

                const response = await computeIndicators({
                    indicatorType,
                    params: data,
                    priceData,
                });

                for (const [key, values] of Object.entries(response.data.values)) {
                    indicatorCache[`${node.id}:${key}`] = values;
                }
            } catch (err) {
                logger.error({ error: err, nodeId: node.id }, 'Failed to compute indicator');
            }
        }
    }

    const ctx: EvaluationContext = {
        bar,
        history,
        index: barIndex,
        portfolio,
        variables: {},
        indicatorCache,
        riskConfig: {},
    };

    const result = await interpreter.evaluate(ctx);

    const durationMs = Date.now() - startTime;

    // 7. Update execution run with results
    await prisma.executionRun.update({
        where: { id: executionRun.id },
        data: {
            status: result.nodesErrored > 0 ? 'error' : preChecks.passed ? 'success' : 'skipped',
            durationMs,
            nodesExecuted: result.nodesExecuted,
            nodesSkipped: result.nodesSkipped,
            nodesErrored: result.nodesErrored,
            pythonDelegations: result.pythonDelegations,
            summary: {
                orderIntents: result.orderIntents.length,
                preChecksPassed: preChecks.passed,
                preCheckFailures: preChecks.failedChecks,
            },
            finishedAt: new Date(),
        },
    });

    // 8. Log individual node executions
    if (result.nodeLogs.length > 0) {
        await prisma.executionNodeLog.createMany({
            data: result.nodeLogs.map((log) => ({
                executionRunId: executionRun.id,
                nodeId: log.nodeId,
                nodeType: log.nodeType,
                status: log.status,
                inputData: log.inputData,
                outputData: log.outputData,
                errorMessage: log.errorMessage,
                durationMs: log.durationMs,
                executionOrder: log.executionOrder,
            })),
        });
    }

    logger.info(
        {
            executionRunId: executionRun.id,
            strategyId: input.strategyId,
            durationMs,
            nodesExecuted: result.nodesExecuted,
            orderIntents: result.orderIntents.length,
        },
        'Strategy execution completed'
    );

    // 9. Process HITL or advisory notifications based on result
    if (agentConfig.operationalMode === 'hitl') {
        await notificationQueue.add('hitl-request', {
            userId: input.userId,
            executionRunId: executionRun.id,
            channel: 'telegram', // Could be dynamic from user prefs
            type: 'hitl_request',
            title: `HITL Approval Required: ${strategy.name}`,
            body: `Strategy "${strategy.name}" wants to execute ${result.orderIntents.length} orders.\n\nPlease approve or reject this execution round.`,
            telegram: {
                chatId: agentConfig.user.preferences ? (agentConfig.user.preferences as any).telegramChatId : '', // Required from prefs
                replyMarkup: {
                    inline_keyboard: [[
                        { text: '✅ Approve', callback_data: `approve_${executionRun.id}` },
                        { text: '❌ Reject', callback_data: `reject_${executionRun.id}` }
                    ]]
                }
            }
        });
    } else if (agentConfig.operationalMode === 'advisory' && result.orderIntents.length > 0) {
        await notificationQueue.add('advisory-alert', {
            userId: input.userId,
            executionRunId: executionRun.id,
            channel: 'telegram',
            type: 'alert',
            title: `Advisory Mode Alert: ${strategy.name}`,
            body: `Strategy "${strategy.name}" generated ${result.orderIntents.length} order intents.\n\nSince agent is in advisory mode, no trades were executed.`,
            telegram: {
                chatId: agentConfig.user.preferences ? (agentConfig.user.preferences as any).telegramChatId : ''
            }
        });
    } else if (agentConfig.operationalMode === 'autonomous' && result.orderIntents.length > 0) {
        // Find the portfolio this strategy targets (or pick first)
        const portfolio = await prisma.portfolio.findFirst({
            where: { userId: input.userId }
        });

        if (portfolio) {
            const broker = getBrokerClient(portfolio.brokerName);
            if (!broker.isConnected()) {
                await broker.connect(portfolio.credentialAlias ?? ''); // Assuming alias is used to fetch key internally in production
            }

            for (const intent of result.orderIntents) {
                try {
                    await broker.submitOrder({
                        symbol: intent.symbol,
                        side: intent.side.toLowerCase() as any,
                        type: intent.orderType as any,
                        quantity: intent.size,
                        limitPrice: intent.price,
                        stopPrice: intent.stopLoss
                    });
                } catch (error) {
                    logger.error({ error, symbol: intent.symbol }, 'Failed to submit autonomous order');
                }
            }
        } else {
            logger.warn({ strategyId: input.strategyId }, 'No portfolio found for autonomous execution');
        }
    }

    return {
        executionRunId: executionRun.id,
        result,
        preChecksPassed: preChecks.passed,
        preCheckFailures: preChecks.failedChecks,
    };
}
