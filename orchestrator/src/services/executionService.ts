/**
 * Execution service — orchestrates the full flow execution lifecycle:
 * 1. Pre-checks
 * 2. Indicator computation (via Python)
 * 3. Flow interpretation
 * 4. Execution logging to database
 * 5. HITL pause/resume lifecycle
 */

import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { decrypt } from '../utils/crypto.js';
import { compileFlowStrategy } from '../engine/compiler.js';
import { FlowInterpreter, type EvaluationContext, type EvaluationResult, type Bar } from '../engine/interpreter.js';
import { runPreChecks } from '../engine/preChecks.js';
import { notificationQueue } from './notificationService.js';
import { getBrokerClient } from './brokerGateway.js';
import { computeIndicators } from './computeClient.js';
import { getRedis } from '../config/redis.js';
import { emitExecutionStarted, emitNodeUpdate, emitExecutionCompleted } from '../api/websocket.js';

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

    // ── Emergency Kill Switch ──
    if (agentConfig.emergencyKill) {
        logger.warn({ userId: input.userId, strategyId: input.strategyId }, 'Emergency kill active — execution blocked');
        throw new Error('Emergency kill switch is active — all strategy executions are blocked');
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
    // TODO: Ideally fetch real portfolio state from broker here
    const portfolio = { cash: 0, equity: 0, positions: {} };
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

    // Emit execution started event via WebSocket
    emitExecutionStarted(input.userId, input.strategyId, executionRun.id);

    if (!preChecks.passed) {
        return {
            executionRunId: executionRun.id,
            result: {
                orderIntents: [],
                outputs: {},
                nodeLogs: [],
                nodesExecuted: 0,
                nodesSkipped: 0,
                nodesErrored: 0,
                pythonDelegations: 0,
            },
            preChecksPassed: false,
            preCheckFailures: preChecks.failedChecks,
        };
    }

    // ── Credential Loading ──
    const credentialsMap: Record<string, string> = {};
    try {
        const userCredentials = await prisma.credential.findMany({
            where: { userId: input.userId }
        });

        for (const cred of userCredentials) {
            try {
                const encrypted = Buffer.from(cred.encryptedKey).toString('base64');
                const decrypted = decrypt(encrypted, env.ENCRYPTION_KEY);
                const keyData = JSON.parse(decrypted);

                // Flatten credentials for easy access (e.g. "alpaca.apiKey")
                // Also store the alias itself if it's a simple string (backwards compat)
                if (keyData.apiKey) {
                    credentialsMap[`${cred.alias}.apiKey`] = String(keyData.apiKey);
                    credentialsMap[cred.alias] = String(keyData.apiKey); // Default to apiKey
                }
                if (keyData.apiSecret) {
                    credentialsMap[`${cred.alias}.apiSecret`] = String(keyData.apiSecret);
                }
                // Also store raw JSON string just in case
                credentialsMap[`${cred.alias}.json`] = decrypted;
            } catch (err) {
                logger.error({ error: err, credentialId: cred.id }, 'Failed to decrypt credential during execution');
            }
        }
    } catch (err) {
        logger.error({ error: err }, 'Failed to load credentials');
    }

    // ── Indicator Pre-computation ──
    const indicatorCache: Record<string, number[]> = {};
    const indicatorDefs = compiled.compiled.indicatorDefs;

    if (indicatorDefs.length > 0) {
        try {
            // Prepare market data arrays from fetched history
            const priceData = {
                open: history.map(b => b.open),
                high: history.map(b => b.high),
                low: history.map(b => b.low),
                close: history.map(b => b.close),
                volume: history.map(b => b.volume),
            };

            // Fetch indicators in parallel
            await Promise.all(indicatorDefs.map(async (def) => {
                try {
                    const result = await computeIndicators({
                        indicatorType: def.indicatorType ?? 'unknown',
                        params: def.params,
                        priceData
                    });

                    // Store results in cache
                    // Key format must match Interpreter logic: `${nodeId}:${component}`
                    for (const [component, values] of Object.entries(result.data.values)) {
                        indicatorCache[`${def.nodeId}:${component}`] = values;
                    }
                } catch (err) {
                    logger.error({ error: err, indicatorType: def.indicatorType }, 'Failed to compute indicator');
                }
            }));
        } catch (err) {
            logger.error({ error: err }, 'Failed to prepare indicator data');
        }
    }

    // 6. Interpret the strategy flow
    const interpreter = new FlowInterpreter(compiled.compiled);

    const ctx: EvaluationContext = {
        bar,
        history,
        index: barIndex,
        portfolio,
        variables: {},
        indicatorCache,
        riskConfig: {},
        credentials: credentialsMap,
    };

    const result = await interpreter.evaluate(ctx);

    const durationMs = Date.now() - startTime;

    // ── HITL Pause Handling ──
    // If the interpreter returned a pendingApproval, save state and pause.
    if (result.pendingApproval) {
        // Save paused execution state to Redis for later resumption
        const pausedState = {
            compiledStrategy: compiled.compiled,
            context: {
                bar: ctx.bar,
                history: ctx.history,
                index: ctx.index,
                portfolio: ctx.portfolio,
                variables: ctx.variables,
                indicatorCache: ctx.indicatorCache,
                riskConfig: ctx.riskConfig,
                // Note: credentials are NOT stored in Redis for security
            },
            outputs: result.outputs,
            orderIntents: result.orderIntents,
            hitlNodeId: result.pendingApproval.nodeId,
            strategyId: input.strategyId,
            userId: input.userId,
        };

        const redis = getRedis();
        const stateKey = `hitl:paused:${executionRun.id}`;
        await redis.set(stateKey, JSON.stringify(pausedState), 'EX', 7200); // 2 hour TTL

        // Create ApprovalRequest record
        await prisma.approvalRequest.create({
            data: {
                executionRunId: executionRun.id,
                nodeId: result.pendingApproval.nodeId,
                userId: input.userId,
                status: 'pending',
                context: result.pendingApproval.approvalContext,
                message: result.pendingApproval.approvalContext.message ?? 'Human approval required',
                timeoutMinutes: result.pendingApproval.approvalContext.timeoutMinutes ?? 30,
            },
        });

        // Mark execution as pending_approval
        await prisma.executionRun.update({
            where: { id: executionRun.id },
            data: {
                status: 'pending_approval',
                durationMs,
                nodesExecuted: result.nodesExecuted,
                nodesSkipped: result.nodesSkipped,
                nodesErrored: result.nodesErrored,
                pythonDelegations: result.pythonDelegations,
                summary: {
                    orderIntents: result.orderIntents.length,
                    preChecksPassed: preChecks.passed,
                    preCheckFailures: preChecks.failedChecks,
                    pausedAtNode: result.pendingApproval.nodeId,
                },
            },
        });

        // Log nodes that executed before the pause
        if (result.nodeLogs.length > 0) {
            await prisma.executionNodeLog.createMany({
                data: result.nodeLogs.map((log) => ({
                    executionRunId: executionRun.id,
                    nodeId: log.nodeId,
                    nodeType: log.nodeType,
                    status: log.status,
                    inputData: log.inputData ?? {},
                    outputData: log.outputData ?? {},
                    errorMessage: log.errorMessage,
                    durationMs: log.durationMs,
                    executionOrder: log.executionOrder,
                })),
            });
        }

        // Send notification about the approval request
        await notificationQueue.add('hitl-request', {
            userId: input.userId,
            executionRunId: executionRun.id,
            channel: 'in_app',
            type: 'hitl_request',
            title: `Approval Required: ${strategy.name}`,
            body: result.pendingApproval.approvalContext.message ?? 'Human approval required to proceed',
        });

        logger.info({
            executionRunId: executionRun.id,
            hitlNodeId: result.pendingApproval.nodeId,
        }, 'Execution paused at HITL node — awaiting approval');

        return {
            executionRunId: executionRun.id,
            result,
            preChecksPassed: preChecks.passed,
            preCheckFailures: preChecks.failedChecks,
        };
    }

    // 7. Update execution run with results
    await prisma.executionRun.update({
        where: { id: executionRun.id },
        data: {
            status: result.nodesErrored > 0 ? 'error' : 'success',
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

    // 8. Log individual node executions & emit real-time updates
    if (result.nodeLogs.length > 0) {
        await prisma.executionNodeLog.createMany({
            data: result.nodeLogs.map((log) => ({
                executionRunId: executionRun.id,
                nodeId: log.nodeId,
                nodeType: log.nodeType,
                status: log.status,
                inputData: log.inputData ?? {},
                outputData: log.outputData ?? {},
                errorMessage: log.errorMessage,
                durationMs: log.durationMs,
                executionOrder: log.executionOrder,
            })),
        });

        // Emit per-node progress updates via WebSocket
        for (const log of result.nodeLogs) {
            emitNodeUpdate(input.userId, input.strategyId, {
                nodeId: log.nodeId,
                status: log.status,
                outputData: log.outputData ?? {},
                durationMs: log.durationMs,
            });
        }
    }

    // Emit execution completed event via WebSocket
    emitExecutionCompleted(input.userId, input.strategyId, {
        executionRunId: executionRun.id,
        status: result.nodesErrored > 0 ? 'error' : 'success',
        durationMs,
        orderIntents: result.orderIntents.length,
    });

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

    // 9. Process order dispatch based on operational mode
    await processOrderIntents(result, agentConfig, input, executionRun.id, strategy.name);

    // 10. Dispatch any notification + voice-call intents produced by the
    //     graph (telegramNode, notification action, voiceCallNode).
    await processNotificationIntents(result, agentConfig, input, executionRun.id, strategy.name);
    await processVoiceCallIntents(result, agentConfig, input, executionRun.id);

    return {
        executionRunId: executionRun.id,
        result,
        preChecksPassed: preChecks.passed,
        preCheckFailures: preChecks.failedChecks,
    };
}

// ─── Order Dispatch Helper ──────────────────────────────────────

async function processOrderIntents(
    result: EvaluationResult,
    agentConfig: any,
    input: { userId: string; strategyId: string },
    executionRunId: string,
    strategyName: string,
) {
    if (result.orderIntents.length === 0) return;

    // ── Simulation Mode: always route to paper broker ──
    if (agentConfig.operationalMode === 'simulation') {
        const paperBroker = getBrokerClient('paper');
        if (!paperBroker.isConnected()) {
            await paperBroker.connect('paper');
        }

        for (const intent of result.orderIntents) {
            try {
                await paperBroker.submitOrder({
                    symbol: intent.symbol,
                    side: intent.side.toLowerCase() as any,
                    type: intent.orderType as any,
                    quantity: intent.size,
                    limitPrice: intent.price,
                    stopPrice: intent.stopLoss,
                });
                logger.info({ symbol: intent.symbol, side: intent.side, size: intent.size }, 'Simulation order submitted to paper broker');
            } catch (error) {
                logger.error({ error, symbol: intent.symbol }, 'Failed to submit simulation order');
            }
        }
        return;
    }

    if (agentConfig.operationalMode === 'hitl') {
        await notificationQueue.add('hitl-request', {
            userId: input.userId,
            executionRunId,
            channel: 'telegram',
            type: 'hitl_request',
            title: `HITL Approval Required: ${strategyName}`,
            body: `Strategy "${strategyName}" wants to execute ${result.orderIntents.length} orders.\n\nPlease approve or reject this execution round.`,
            telegram: {
                chatId: agentConfig.user?.preferences ? (agentConfig.user.preferences as any).telegramChatId : '',
                replyMarkup: {
                    inline_keyboard: [[
                        { text: '✅ Approve', callback_data: `approve_${executionRunId}` },
                        { text: '❌ Reject', callback_data: `reject_${executionRunId}` }
                    ]]
                }
            }
        });
    } else if (agentConfig.operationalMode === 'advisory') {
        await notificationQueue.add('advisory-alert', {
            userId: input.userId,
            executionRunId,
            channel: 'telegram',
            type: 'alert',
            title: `Advisory Mode Alert: ${strategyName}`,
            body: `Strategy "${strategyName}" generated ${result.orderIntents.length} order intents.\n\nSince agent is in advisory mode, no trades were executed.`,
            telegram: {
                chatId: agentConfig.user?.preferences ? (agentConfig.user.preferences as any).telegramChatId : ''
            }
        });
    } else if (agentConfig.operationalMode === 'autonomous') {
        const portfolio = await prisma.portfolio.findFirst({
            where: { userId: input.userId },
            include: { positions: true },
        });

        if (!portfolio) {
            logger.warn({ strategyId: input.strategyId }, 'No portfolio found for autonomous execution');
            return;
        }

        const broker = getBrokerClient(portfolio.brokerName);
        if (!broker.isConnected()) {
            await broker.connect(portfolio.credentialAlias ?? '');
        }

        // ── Guardrail Enforcement ──
        const redis = getRedis();
        const dailySpendKey = `guardrail:daily_spend:${input.userId}:${new Date().toISOString().slice(0, 10)}`;

        // Load current daily spend
        let currentDailySpend = parseFloat(await redis.get(dailySpendKey) ?? '0');

        for (const intent of result.orderIntents) {
            const estimatedValue = intent.size * (intent.price ?? 0 /* use last known price */);
            // If price is not available (market orders), use a rough estimate
            const orderValue = estimatedValue > 0 ? estimatedValue : intent.size;

            // Check 1: maxSingleTradeValue
            if (agentConfig.maxSingleTradeValue && orderValue > agentConfig.maxSingleTradeValue) {
                logger.warn({
                    symbol: intent.symbol,
                    orderValue,
                    maxSingleTradeValue: agentConfig.maxSingleTradeValue,
                }, 'Guardrail: order exceeds maxSingleTradeValue — BLOCKED');
                continue;
            }

            // Check 2: maxDailySpend
            if (agentConfig.maxDailySpend && (currentDailySpend + orderValue) > agentConfig.maxDailySpend) {
                logger.warn({
                    symbol: intent.symbol,
                    orderValue,
                    currentDailySpend,
                    maxDailySpend: agentConfig.maxDailySpend,
                }, 'Guardrail: daily spend limit exceeded — BLOCKED');
                continue;
            }

            // Check 3: maxPositionConcentrationPct
            if (agentConfig.maxPositionConcentrationPct && portfolio.totalEquity > 0) {
                const existingPosition = portfolio.positions.find(p => p.symbol === intent.symbol);
                const existingValue = existingPosition
                    ? existingPosition.quantity * existingPosition.currentPrice
                    : 0;
                const newValue = existingValue + orderValue;
                const concentrationPct = (newValue / portfolio.totalEquity) * 100;

                if (concentrationPct > agentConfig.maxPositionConcentrationPct) {
                    logger.warn({
                        symbol: intent.symbol,
                        concentrationPct: concentrationPct.toFixed(1),
                        maxConcentrationPct: agentConfig.maxPositionConcentrationPct,
                    }, 'Guardrail: position concentration limit exceeded — BLOCKED');
                    continue;
                }
            }

            // All guardrails passed — submit the order
            try {
                await broker.submitOrder({
                    symbol: intent.symbol,
                    side: intent.side.toLowerCase() as any,
                    type: intent.orderType as any,
                    quantity: intent.size,
                    limitPrice: intent.price,
                    stopPrice: intent.stopLoss,
                });

                // Track daily spend
                currentDailySpend += orderValue;
                await redis.set(dailySpendKey, currentDailySpend.toString(), 'EX', 86400); // 24h TTL
            } catch (error) {
                logger.error({ error, symbol: intent.symbol }, 'Failed to submit autonomous order');
            }
        }
    }
}

// ─── Resume Paused Execution ─────────────────────────────────────

/**
 * Resume a paused HITL execution after approval.
 * Loads the saved state from Redis, creates a new interpreter that continues
 * from after the HITL node, and processes the remaining flow.
 */
export async function resumeExecution(executionRunId: string): Promise<void> {
    const redis = getRedis();
    const stateKey = `hitl:paused:${executionRunId}`;
    const stateJson = await redis.get(stateKey);

    if (!stateJson) {
        logger.warn({ executionRunId }, 'No paused state found in Redis — state may have expired');
        // Still mark execution as success since the approval was granted
        await prisma.executionRun.update({
            where: { id: executionRunId },
            data: { status: 'success', finishedAt: new Date() },
        });
        return;
    }

    const pausedState = JSON.parse(stateJson);
    const { compiledStrategy, context, outputs, orderIntents, hitlNodeId, strategyId, userId } = pausedState;

    // Mark the HITL node output as approved
    if (outputs[hitlNodeId]) {
        outputs[hitlNodeId].output = 'approved';
        outputs[hitlNodeId].approvalRequired = false;
    }

    // Find where the HITL node sits in the execution order
    const hitlIndex = compiledStrategy.nodeOrder.indexOf(hitlNodeId);
    const remainingNodes = compiledStrategy.nodeOrder.slice(hitlIndex + 1);

    if (remainingNodes.length === 0) {
        logger.info({ executionRunId }, 'No nodes after HITL — execution complete');
        await prisma.executionRun.update({
            where: { id: executionRunId },
            data: { status: 'success', finishedAt: new Date() },
        });
        await redis.del(stateKey);
        return;
    }

    // Re-create the compiled strategy with only remaining nodes
    const resumeCompiled = {
        ...compiledStrategy,
        nodeOrder: remainingNodes,
    };

    // Reload credentials (not stored in Redis for security)
    const credentialsMap: Record<string, string> = {};
    try {
        const userCredentials = await prisma.credential.findMany({ where: { userId } });
        for (const cred of userCredentials) {
            try {
                const encrypted = Buffer.from(cred.encryptedKey).toString('base64');
                const decrypted = decrypt(encrypted, env.ENCRYPTION_KEY);
                const keyData = JSON.parse(decrypted);
                if (keyData.apiKey) {
                    credentialsMap[`${cred.alias}.apiKey`] = String(keyData.apiKey);
                    credentialsMap[cred.alias] = String(keyData.apiKey);
                }
                if (keyData.apiSecret) {
                    credentialsMap[`${cred.alias}.apiSecret`] = String(keyData.apiSecret);
                }
                credentialsMap[`${cred.alias}.json`] = decrypted;
            } catch { /* skip failed */ }
        }
    } catch { /* ok */ }

    // Build the evaluation context with restored state
    const ctx: EvaluationContext = {
        ...context,
        credentials: credentialsMap,
    };

    // Create interpreter and evaluate remaining nodes
    const interpreter = new FlowInterpreter(resumeCompiled);

    // Pre-seed interpreter outputs with the saved outputs
    const resumeResult = await interpreter.evaluate(ctx, outputs);

    // Merge order intents from before and after the pause
    const allOrderIntents = [...orderIntents, ...resumeResult.orderIntents];

    // Update execution run
    await prisma.executionRun.update({
        where: { id: executionRunId },
        data: {
            status: resumeResult.nodesErrored > 0 ? 'error' : 'success',
            nodesExecuted: resumeResult.nodesExecuted,
            nodesSkipped: resumeResult.nodesSkipped,
            nodesErrored: resumeResult.nodesErrored,
            pythonDelegations: resumeResult.pythonDelegations,
            summary: {
                orderIntents: allOrderIntents.length,
                resumedFromHitl: true,
                hitlNodeId,
            },
            finishedAt: new Date(),
        },
    });

    // Log resumed node executions
    if (resumeResult.nodeLogs.length > 0) {
        await prisma.executionNodeLog.createMany({
            data: resumeResult.nodeLogs.map((log) => ({
                executionRunId,
                nodeId: log.nodeId,
                nodeType: log.nodeType,
                status: log.status,
                inputData: log.inputData ?? {},
                outputData: log.outputData ?? {},
                errorMessage: log.errorMessage,
                durationMs: log.durationMs,
                executionOrder: log.executionOrder,
            })),
        });
    }

    // Process any order intents from the resumed execution
    const agentConfig = await prisma.agentConfig.findUnique({
        where: { userId },
        include: { user: true },
    });

    if (agentConfig && allOrderIntents.length > 0) {
        const mergedResult = { ...resumeResult, orderIntents: allOrderIntents };
        const strategy = await prisma.strategy.findUnique({ where: { id: strategyId } });
        await processOrderIntents(
            mergedResult,
            agentConfig,
            { userId, strategyId },
            executionRunId,
            strategy?.name ?? 'Unknown Strategy',
        );
    }

    // Clean up Redis state
    await redis.del(stateKey);

    logger.info({
        executionRunId,
        nodesResumed: remainingNodes.length,
        orderIntents: allOrderIntents.length,
    }, 'Execution resumed and completed after HITL approval');
}


// ─── Notification / voice-call dispatch helpers ──────────────────

import { env as appEnv } from '../config/env.js';

async function processNotificationIntents(
    result: EvaluationResult,
    agentConfig: any,
    input: { userId: string; strategyId: string },
    executionRunId: string,
    strategyName: string,
) {
    const intents = result.notificationIntents ?? [];
    if (intents.length === 0) return;

    const prefs = (agentConfig?.user?.preferences as any) ?? {};
    const tgChatId = prefs.telegramChatId ?? '';

    for (const intent of intents) {
        const channel = intent.channel.toLowerCase();
        // Skip telegram dispatch when the user has no chatId configured (graceful).
        if (channel === 'telegram' && !(intent.target || tgChatId)) {
            logger.warn(
                { nodeId: intent.nodeId, userId: input.userId },
                'telegramNode skipped — user has no telegramChatId configured',
            );
            continue;
        }
        try {
            await notificationQueue.add('strategy-notification', {
                userId: input.userId,
                executionRunId,
                channel,
                type: 'alert',
                title: intent.title ?? `Strategy alert: ${strategyName}`,
                body: intent.body,
                metadata: { nodeId: intent.nodeId, strategyId: input.strategyId },
                telegram: channel === 'telegram'
                    ? { chatId: intent.target ?? tgChatId }
                    : undefined,
                attachments: intent.attachments?.map((a) => ({
                    kind: a.kind,
                    path: a.path,
                    buffer: a.bufferBase64 ? Buffer.from(a.bufferBase64, 'base64') : undefined,
                    filename: a.filename,
                    caption: a.caption,
                })),
            });
        } catch (err) {
            logger.error(
                { err, nodeId: intent.nodeId },
                'Failed to enqueue notification intent',
            );
        }
    }
}

async function processVoiceCallIntents(
    result: EvaluationResult,
    _agentConfig: any,
    input: { userId: string; strategyId: string },
    executionRunId: string,
) {
    const intents = result.voiceCallIntents ?? [];
    if (intents.length === 0) return;

    // Backend voice router lives on the Python compute service.
    const computeUrl = appEnv.COMPUTE_SERVICE_URL;
    if (!computeUrl) {
        logger.warn('voiceCallNode skipped — COMPUTE_SERVICE_URL is not set');
        return;
    }

    for (const intent of intents) {
        try {
            const body = {
                user_id: input.userId,
                transport: intent.transport,
                voice: intent.voice,
                opening_message: intent.openingMessage,
                trigger_source: 'strategy',
                allowed_tools: undefined as string[] | undefined,
                metadata: {
                    executionRunId,
                    strategyId: input.strategyId,
                    nodeId: intent.nodeId,
                    urgencyLevel: intent.urgencyLevel,
                    allowedActions: intent.allowedActions,
                },
            };
            const response = await fetch(`${computeUrl}/api/voice/call`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(appEnv.INTERNAL_API_TOKEN
                        ? { 'X-Internal-Token': appEnv.INTERNAL_API_TOKEN }
                        : {}),
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                throw new Error(`voice call returned ${response.status}`);
            }
        } catch (err) {
            logger.error(
                { err, nodeId: intent.nodeId },
                'Failed to dispatch voiceCallNode',
            );
        }
    }
}
