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
type TriggerType = 'heartbeat' | 'webhook' | 'price_alert' | 'news' | 'manual' | 'replay';

export interface ExecuteStrategyInput {
    strategyId: string;
    userId: string;
    triggerType: TriggerType;
    triggerData?: Record<string, any>;
    bar: Bar;
    history: Bar[];
    barIndex: number;
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

    // 2. Load agent config for pre-checks
    const agentConfig = await prisma.agentConfig.findUnique({
        where: { userId: input.userId },
    });

    if (!agentConfig) {
        throw new Error(`Agent config not found for user ${input.userId}`);
    }

    // 3. Compile the strategy
    const nodes = strategy.nodes as any[];
    const edges = strategy.edges as any[];
    const settings = (strategy.settings as Record<string, any>) ?? {};
    const compiled = compileFlowStrategy(nodes, edges, { ...settings, name: strategy.name });

    // 4. Run pre-checks
    const portfolio = { cash: 0, equity: 0, positions: {} }; // TODO: load from broker
    const preChecks = runPreChecks(agentConfig, portfolio, input.bar);

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
    const ctx: EvaluationContext = {
        bar: input.bar,
        history: input.history,
        index: input.barIndex,
        portfolio,
        variables: {},
        indicatorCache: {}, // TODO: populate from Python compute service
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

    return {
        executionRunId: executionRun.id,
        result,
        preChecksPassed: preChecks.passed,
        preCheckFailures: preChecks.failedChecks,
    };
}
