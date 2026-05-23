/**
 * Flow Interpreter — evaluates compiled strategy graphs.
 * TypeScript port of backend/flow/runtime.py
 *
 * Handles all non-compute node types locally (conditions, math, control, etc.)
 * and delegates indicator/LLM nodes to the Python compute service.
 */

import type { CompiledStrategy, InputSource } from './types.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

// ─── Context Types ───────────────────────────────────────────

export interface Bar {
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    symbol: string;
}

export interface OrderIntent {
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: string;
    size: number;
    price?: number;
    stopLoss?: number;
    takeProfit?: number;
    tag?: string;
}

export interface Position {
    side: string;
    size: number;
    entryPrice: number;
    entryTime: string;
    stopLoss?: number;
    takeProfit?: number;
}

export interface PortfolioState {
    cash: number;
    equity: number;
    positions: Record<string, Position>;
}

export interface EvaluationContext {
    bar: Bar;
    history: Bar[];
    index: number;
    portfolio: PortfolioState;
    variables: Record<string, any>;
    indicatorCache: Record<string, number[]>;
    riskConfig: Record<string, any>;
    /** Decrypted credentials from the vault, keyed by alias */
    credentials?: Record<string, string>;
}

export interface NodeLog {
    nodeId: string;
    nodeType: string;
    status: 'success' | 'error' | 'skipped' | 'delegated';
    inputData: Record<string, any>;
    outputData: Record<string, any>;
    errorMessage?: string;
    durationMs: number;
    executionOrder: number;
}

/** A request to dispatch a notification (Telegram/Slack/SMS/email/etc).
 *  The interpreter only declares intent; the executionService consumes
 *  these after evaluation and pushes onto the BullMQ notificationQueue.
 *  Mirrors how `orderIntents` works. */
export interface NotificationIntent {
    /** node id that produced the intent (audit/log) */
    nodeId: string;
    /** Lowercase channel: 'telegram' | 'slack' | 'sms' | 'email' | 'in_app' | 'push' */
    channel: string;
    title?: string;
    body: string;
    /** Override the user's saved chatId / phone / email; falls back to prefs. */
    target?: string;
    /** Optional file attachments (absolute paths or base64 buffers). */
    attachments?: Array<{
        kind: 'photo' | 'document';
        path?: string;
        bufferBase64?: string;
        filename?: string;
        caption?: string;
    }>;
}

/** A request to place an outbound voice call from a strategy graph. */
export interface VoiceCallIntent {
    nodeId: string;
    transport: 'twilio' | 'browser_webrtc' | 'ios_webrtc' | 'sip';
    openingMessage: string;
    voice?: string;
    allowedActions?: string[];
    urgencyLevel?: string;
}

export interface EvaluationResult {
    orderIntents: OrderIntent[];
    /** Notifications declared by `notification` action or `telegramNode`
     *  integration nodes during this evaluation. */
    notificationIntents?: NotificationIntent[];
    /** Outbound voice calls declared by `voiceCallNode` integration nodes. */
    voiceCallIntents?: VoiceCallIntent[];
    outputs: Record<string, Record<string, any>>;
    nodeLogs: NodeLog[];
    nodesExecuted: number;
    nodesSkipped: number;
    nodesErrored: number;
    pythonDelegations: number;
    /** Set when a HITL node pauses execution */
    pendingApproval?: {
        nodeId: string;
        approvalContext: Record<string, any>;
    };
}

// ─── Compare Helper ──────────────────────────────────────────

function compare(left: number, right: number, operator: string): boolean {
    switch (operator) {
        case '>': return left > right;
        case '>=': return left >= right;
        case '<': return left < right;
        case '<=': return left <= right;
        case '==': return left === right;
        case '!=': return left !== right;
        case 'gt': return left > right;
        case 'gte': return left >= right;
        case 'lt': return left < right;
        case 'lte': return left <= right;
        case 'eq': return left === right;
        case 'neq': return left !== right;
        default: return false;
    }
}

// ─── Advanced Math Helper ────────────────────────────────────

function advancedMath(value: number, func: string): number {
    switch (func) {
        case 'abs': return Math.abs(value);
        case 'sin': return Math.sin(value);
        case 'cos': return Math.cos(value);
        case 'tan': return Math.tan(value);
        case 'log': return Math.log(Math.max(value, 1e-9));
        case 'exp': return Math.exp(value);
        case 'floor': return Math.floor(value);
        case 'ceil': return Math.ceil(value);
        case 'round': return Math.round(value);
        case 'sqrt': return Math.sqrt(Math.max(value, 0));
        default: return Math.sqrt(Math.max(value, 0));
    }
}

// ─── Flow Interpreter ────────────────────────────────────────

export class FlowInterpreter {
    private nodeMap: Map<string, Record<string, any>>;
    private inputs: Record<string, Record<string, InputSource[]>>;
    private nodeOrder: string[];
    private settings: Record<string, any>;

    constructor(compiled: CompiledStrategy) {
        this.nodeMap = new Map(compiled.nodes.map((n) => [n.id, n]));
        this.inputs = compiled.inputs;
        this.nodeOrder = compiled.nodeOrder;
        this.settings = compiled.settings;
    }

    private resolveValue(
        outputs: Record<string, Record<string, any>>,
        source: InputSource
    ): any {
        const sourceHandle = source.sourceHandle ?? 'output';
        const nodeOutput = outputs[source.nodeId];
        if (!nodeOutput) return null;
        return nodeOutput[sourceHandle] ?? nodeOutput['output'] ?? null;
    }

    private resolveInput(
        outputs: Record<string, Record<string, any>>,
        nodeId: string,
        handle: string
    ): any {
        const sources = this.inputs[nodeId]?.[handle];
        if (!sources || sources.length === 0) return null;
        return this.resolveValue(outputs, sources[0]);
    }

    async evaluate(
        ctx: EvaluationContext,
        preSeededOutputs?: Record<string, Record<string, any>>,
    ): Promise<EvaluationResult> {
        const outputs: Record<string, Record<string, any>> = { ...(preSeededOutputs ?? {}) };
        const orderIntents: OrderIntent[] = [];
        const notificationIntents: NotificationIntent[] = [];
        const voiceCallIntents: VoiceCallIntent[] = [];
        const nodeLogs: NodeLog[] = [];
        let nodesExecuted = 0;
        let nodesSkipped = 0;
        let nodesErrored = 0;
        let pythonDelegations = 0;

        for (let i = 0; i < this.nodeOrder.length; i++) {
            const nodeId = this.nodeOrder[i];
            const node = this.nodeMap.get(nodeId);
            if (!node) continue;

            const ntype = node.type;
            const data: Record<string, any> = node.data ?? {};

            // ── Credential Resolution (PRD §2.5.4) ──
            // Resolve {{credentials.X}} patterns in node config values
            if (ctx.credentials) {
                for (const [key, value] of Object.entries(data)) {
                    if (typeof value === 'string' && value.startsWith('{{credentials.') && value.endsWith('}}')) {
                        const alias = value.slice('{{credentials.'.length, -2);
                        if (ctx.credentials[alias]) {
                            data[key] = ctx.credentials[alias];
                        }
                    }
                }
            }

            const startTime = Date.now();
            let nodeOutput: Record<string, any> = {};
            let status: NodeLog['status'] = 'success';
            let errorMessage: string | undefined;

            try {
                switch (ntype) {
                    // ── Indicator (delegate to Python) ──
                    case 'indicator': {
                        const prefix = `${nodeId}:`;
                        for (const [key, series] of Object.entries(ctx.indicatorCache)) {
                            if (!key.startsWith(prefix)) continue;
                            const handle = key.split(':')[1];
                            nodeOutput[handle] = Array.isArray(series) && ctx.index < series.length
                                ? series[ctx.index]
                                : NaN;
                        }
                        if (Object.keys(nodeOutput).length === 0) {
                            // Fallback: look for generic output
                            const key = `${nodeId}:output`;
                            if (ctx.indicatorCache[key]) {
                                const series = ctx.indicatorCache[key];
                                nodeOutput['output'] = ctx.index < series.length ? series[ctx.index] : NaN;
                            } else {
                                nodeOutput['output'] = NaN;
                            }
                        }
                        status = 'delegated';
                        pythonDelegations++;
                        break;
                    }

                    // ── Environment ──
                    case 'environment': {
                        const envType = data.environmentType;
                        let value: any;
                        switch (envType) {
                            case 'price': value = ctx.bar.close; break;
                            case 'spread': value = 0.0; break;
                            case 'prevCandleOpen':
                                value = ctx.history[Math.max(0, ctx.index - 1)]?.open ?? ctx.bar.open;
                                break;
                            case 'prevCandleClose':
                                value = ctx.history[Math.max(0, ctx.index - 1)]?.close ?? ctx.bar.close;
                                break;
                            case 'time': value = ctx.bar.timestamp; break;
                            case 'dayOfWeek': value = new Date(ctx.bar.timestamp).getDay(); break;
                            case 'newCandleOpen': value = true; break;
                            case 'isMarketOpen': value = true; break;
                            default: value = ctx.bar.close;
                        }
                        nodeOutput = { output: value };
                        break;
                    }

                    // ── Math ──
                    case 'math': {
                        const mathType = data.mathType;
                        if (mathType === 'number') {
                            nodeOutput = { output: Number(data.value ?? 0) };
                        } else if (mathType === 'advancedMath') {
                            const val = Number(this.resolveInput(outputs, nodeId, 'input') ?? 0);
                            nodeOutput = { output: advancedMath(val, data.mathFunction ?? 'sqrt') };
                        } else {
                            const a = Number(this.resolveInput(outputs, nodeId, 'input-a') ?? 0);
                            const b = Number(this.resolveInput(outputs, nodeId, 'input-b') ?? 0);
                            let result: number;
                            switch (mathType) {
                                case 'add': result = a + b; break;
                                case 'subtract': result = a - b; break;
                                case 'multiply': result = a * b; break;
                                case 'divide': result = b !== 0 ? a / b : 0; break;
                                default: result = a;
                            }
                            nodeOutput = { output: result };
                        }
                        break;
                    }

                    // ── Variable ──
                    case 'variable': {
                        const varType = data.variableType;
                        const varName = data.variableName;
                        if (varType === 'getVariable') {
                            nodeOutput = { output: ctx.variables[varName] ?? null };
                        } else {
                            const value = this.resolveInput(outputs, nodeId, 'input') ?? data.value;
                            if (varName) {
                                if (varType === 'changeVariable') {
                                    ctx.variables[varName] = (Number(ctx.variables[varName]) || 0) + Number(value ?? 0);
                                } else {
                                    ctx.variables[varName] = value;
                                }
                            }
                            nodeOutput = { output: true };
                        }
                        break;
                    }

                    // ── TradeInfo ──
                    case 'tradeInfo': {
                        const infoType = data.tradeInfoType;
                        const positions = Object.values(ctx.portfolio.positions);
                        const position = positions[0];
                        let value = 0;
                        if (position) {
                            switch (infoType) {
                                case 'entryPrice': value = position.entryPrice; break;
                                case 'positionSize': value = position.size; break;
                                case 'pnl': {
                                    const mult = position.side === 'LONG' ? 1 : -1;
                                    value = (ctx.bar.close - position.entryPrice) * position.size * mult;
                                    break;
                                }
                                case 'tradeDuration': {
                                    const entryMs = new Date(position.entryTime).getTime();
                                    const nowMs = new Date(ctx.bar.timestamp).getTime();
                                    value = (nowMs - entryMs) / 1000;
                                    break;
                                }
                            }
                        }
                        nodeOutput = { output: value };
                        break;
                    }

                    // ── Condition ──
                    case 'condition': {
                        const condType = data.conditionType;
                        let result: boolean;
                        if (condType === 'and' || condType === 'or') {
                            const left = Boolean(this.resolveInput(outputs, nodeId, 'input-a'));
                            const right = Boolean(this.resolveInput(outputs, nodeId, 'input-b'));
                            result = condType === 'and' ? left && right : left || right;
                        } else if (condType === 'not') {
                            result = !Boolean(this.resolveInput(outputs, nodeId, 'input'));
                        } else if (condType === 'crossover' || condType === 'crossunder') {
                            const left = Number(this.resolveInput(outputs, nodeId, 'input-a') ?? 0);
                            const right = Number(this.resolveInput(outputs, nodeId, 'input-b') ?? 0);
                            result = condType === 'crossover' ? left > right : left < right;
                        } else if (condType === 'range') {
                            const val = Number(this.resolveInput(outputs, nodeId, 'input-a') ?? 0);
                            result = val >= (data.minValue ?? 0) && val <= (data.maxValue ?? 0);
                        } else if (condType === 'threshold') {
                            const val = Number(this.resolveInput(outputs, nodeId, 'input-a') ?? 0);
                            result = compare(val, Number(data.value ?? 0), data.operator ?? '>');
                        } else {
                            // Default compare: two inputs
                            const left = Number(this.resolveInput(outputs, nodeId, 'input-a') ?? 0);
                            const right = Number(
                                this.resolveInput(outputs, nodeId, 'input-b') ?? data.value ?? 0
                            );
                            result = compare(left, right, data.operator ?? '>');
                        }
                        nodeOutput = { output: result };
                        break;
                    }

                    // ── Risk ──
                    case 'risk': {
                        const riskType = data.riskType;
                        if (riskType) {
                            ctx.riskConfig[riskType] = data.value ?? data.percentage;
                        }
                        nodeOutput = { output: ctx.riskConfig[riskType] ?? null };
                        break;
                    }

                    // ── Control ──
                    case 'control': {
                        const controlType = data.controlType;
                        let condition = true;
                        const condInput = this.resolveInput(outputs, nodeId, 'condition');
                        if (condInput !== null) condition = Boolean(condInput);
                        if (controlType === 'ifElse') {
                            nodeOutput = { then: condition, else: !condition, output: condition };
                        } else {
                            nodeOutput = { output: condition };
                        }
                        break;
                    }

                    // ── LLM (delegate to Python) ──
                    case 'llm': {
                        let trigger = true;
                        const trigInput = this.resolveInput(outputs, nodeId, 'trigger');
                        if (trigInput !== null) trigger = Boolean(trigInput);
                        if (trigger) {
                            const llmType = data.llmType ?? 'sentimentAnalysis';

                            // Determine the input text from upstream (e.g. news article content)
                            let textToAnalyze = this.resolveInput(outputs, nodeId, 'input') ?? '';
                            // Fallback to trigger data if trigger type is news
                            if (!textToAnalyze && ctx.variables['newsSnippet']) {
                                textToAnalyze = ctx.variables['newsSnippet'];
                            } else if (!textToAnalyze && ctx.variables['triggerData']?.contentSnippet) {
                                textToAnalyze = ctx.variables['triggerData'].contentSnippet;
                            }

                            try {
                                const response = await fetch(`${env.COMPUTE_SERVICE_URL}/api/llm/execute`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        type: llmType,
                                        prompt: data.prompt ?? '',
                                        text: textToAnalyze,
                                        context: {}, // Potentially expand context later
                                        openaiKey: ctx.credentials?.['openai'] ?? '',
                                        sentimentThreshold: data.sentimentThreshold
                                    })
                                });

                                if (!response.ok) {
                                    throw new Error(`LLM API returned ${response.status}`);
                                }

                                const llmResult = await response.json() as any;
                                nodeOutput = llmResult.output ?? { output: llmResult };
                            } catch (err) {
                                logger.error({ nodeId, error: err }, 'Failed to delegate LLM node to compute service');
                                nodeOutput = { output: data.fallback ?? {} };
                            }

                            status = 'delegated';
                            pythonDelegations++;
                        } else {
                            nodeOutput = { output: data.fallback ?? {} };
                            status = 'skipped';
                            nodesSkipped++;
                        }
                        break;
                    }

                    // ── Action ──
                    case 'action': {
                        let trigger = true;
                        const trigInput = this.resolveInput(outputs, nodeId, 'trigger');
                        if (trigInput !== null) trigger = Boolean(trigInput);

                        if (!trigger) {
                            nodeOutput = { output: false };
                            status = 'skipped';
                            nodesSkipped++;
                            break;
                        }

                        const actionType = data.actionType;
                        if (actionType === 'order') {
                            const sizeInput = this.resolveInput(outputs, nodeId, 'size');
                            let size = Number(sizeInput ?? data.size ?? 0);
                            if (size === 0) {
                                const pct = ctx.riskConfig.positionPercent;
                                if (pct && ctx.portfolio.equity) {
                                    size = (ctx.portfolio.equity * Number(pct) / 100) / Math.max(ctx.bar.close, 1e-9);
                                } else {
                                    size = 1;
                                }
                            }
                            const direction = data.direction ?? 'long';
                            const side: 'BUY' | 'SELL' = direction === 'long' ? 'BUY' : 'SELL';
                            const orderType = data.orderType ?? 'market';

                            orderIntents.push({
                                symbol: data.symbol ?? this.settings.symbol ?? 'UNKNOWN',
                                side,
                                orderType,
                                size,
                                price: orderType !== 'market' ? data.limitPrice : undefined,
                                stopLoss: data.stopPrice,
                                takeProfit: data.takeProfitPrice,
                                tag: nodeId,
                            });
                            nodeOutput = { output: true };
                        } else if (actionType === 'notification') {
                            // Pull body from upstream `message` handle if wired,
                            // else from node data. Channel defaults to telegram.
                            const upstreamMsg = this.resolveInput(outputs, nodeId, 'message');
                            const body = String(upstreamMsg ?? data.message ?? '');
                            const channel = String(data.channel ?? 'telegram').toLowerCase();
                            // Allow agent nodes upstream to drop a `chartPath`
                            // on their output — pick it up automatically.
                            const attachments: NotificationIntent['attachments'] = [];
                            const upstreamData = this.resolveInput(outputs, nodeId, 'data');
                            const chartPath = (upstreamData && typeof upstreamData === 'object')
                                ? (upstreamData.chartPath || upstreamData.plotPath || upstreamData.plotUrl)
                                : data.chartPath;
                            if (chartPath) {
                                attachments.push({
                                    kind: 'photo',
                                    path: String(chartPath),
                                    caption: body || undefined,
                                });
                            }
                            notificationIntents.push({
                                nodeId,
                                channel,
                                title: data.title,
                                body,
                                target: data.target,
                                attachments: attachments.length > 0 ? attachments : undefined,
                            });
                            nodeOutput = { output: true, dispatched: 'notification' };
                        } else {
                            nodeOutput = { output: true };
                        }
                        break;
                    }

                    // ── Agent ──
                    case 'agent': {
                        let trigger = true;
                        const trigInput = this.resolveInput(outputs, nodeId, 'trigger');
                        if (trigInput !== null) trigger = Boolean(trigInput);

                        if (!trigger) {
                            nodeOutput = { output: null, signal: null, confidence: 0 };
                            status = 'skipped';
                            nodesSkipped++;
                            break;
                        }

                        const agentNodeType = data.agentNodeType;
                        const agentType = data.agentType ?? 'news_analyst';
                        const model = data.model ?? 'gemini-2.0-flash';
                        const symbols = data.symbols ?? [this.settings.symbol].filter(Boolean);
                        const confidenceThreshold = data.confidenceThreshold ?? 0.5;

                        // Resolve upstream symbols input if connected
                        const symbolsInput = this.resolveInput(outputs, nodeId, 'symbols');
                        const resolvedSymbols = symbolsInput
                            ? (Array.isArray(symbolsInput) ? symbolsInput : [String(symbolsInput)])
                            : symbols;

                        const computeUrl = env.COMPUTE_SERVICE_URL;

                        // ── agentRunQuery: read latest persisted agent_runs row (no LLM call)
                        if (agentNodeType === 'agentRunQuery') {
                            if (!computeUrl) {
                                nodeOutput = { output: null, signal: null, confidence: 0 };
                                status = 'skipped';
                                nodesSkipped++;
                                break;
                            }
                            const querySymbol = data.symbol || resolvedSymbols[0] || '';
                            const maxAge = Number(data.maxAgeMinutes ?? 60);
                            const params = new URLSearchParams({ agent_type: agentType });
                            if (querySymbol) params.set('symbol', String(querySymbol));
                            if (maxAge > 0) params.set('max_age_minutes', String(maxAge));
                            try {
                                const r = await fetch(`${computeUrl}/compute/agents/last-run?${params.toString()}`);
                                if (r.status === 404) {
                                    nodeOutput = { output: null, signal: null, confidence: 0, summary: '' };
                                } else if (!r.ok) {
                                    throw new Error(`agent_runs query returned ${r.status}`);
                                } else {
                                    const row = await r.json() as any;
                                    const signal = row?.signal ?? 'neutral';
                                    const confidence = Number(row?.confidence ?? 0);
                                    const meetsThreshold = confidence >= confidenceThreshold;
                                    nodeOutput = {
                                        output: meetsThreshold ? signal : null,
                                        signal,
                                        confidence,
                                        summary: row?.summary ?? '',
                                        runId: row?.id,
                                        createdAt: row?.created_at,
                                        meetsThreshold,
                                    };
                                }
                            } catch (err) {
                                logger.error({ nodeId, agentType, error: err }, 'agentRunQuery failed');
                                nodeOutput = { output: null, signal: null, confidence: 0, error: String(err) };
                            }
                            status = 'delegated';
                            pythonDelegations++;
                            break;
                        }

                        // ── scheduledAgentRun: declarative cron registration (no per-bar work)
                        if (agentNodeType === 'scheduledAgentRun') {
                            // The strategy deploy path is responsible for calling
                            // POST /compute/agents/schedule when this node ships
                            // live. During execution it's a no-op signal source.
                            nodeOutput = {
                                output: null,
                                signal: null,
                                confidence: 0,
                                scheduled: true,
                                agentType,
                                intervalMinutes: Number(data.intervalMinutes ?? 30),
                            };
                            status = 'skipped';
                            nodesSkipped++;
                            break;
                        }

                        // ── Inline LLM agent (newsAgentNode, technicalAgentNode, etc.)
                        if (computeUrl) {
                            try {
                                const response = await fetch(`${computeUrl}/compute/agents/run`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        agent_type: agentType,
                                        context: {
                                            symbols: resolvedSymbols,
                                            bar: ctx.bar,
                                            model,
                                        },
                                    }),
                                });

                                if (!response.ok) {
                                    throw new Error(`Agent API returned ${response.status}`);
                                }

                                const wrapper = await response.json() as any;
                                // /compute/agents/run wraps output in {success, output}.
                                const agentResult = wrapper?.output ?? wrapper;
                                const confidence = agentResult.overall_confidence ?? 0;
                                const signal = agentResult.overall_signal ?? 'neutral';

                                // Only emit signal if confidence meets threshold
                                const meetsThreshold = confidence >= confidenceThreshold;
                                nodeOutput = {
                                    output: meetsThreshold ? signal : null,
                                    signal,
                                    confidence,
                                    findings: agentResult.findings ?? [],
                                    recommendations: agentResult.recommendations ?? [],
                                    summary: agentResult.summary ?? '',
                                    meetsThreshold,
                                };
                            } catch (err) {
                                logger.error({ nodeId, agentType, error: err }, 'Failed to run agent node');
                                nodeOutput = { output: null, signal: null, confidence: 0, error: String(err) };
                            }

                            status = 'delegated';
                            pythonDelegations++;
                        } else {
                            nodeOutput = { output: null, signal: null, confidence: 0 };
                            status = 'skipped';
                            nodesSkipped++;
                        }
                        break;
                    }

                    default:
                        // ── Trigger & Integration nodes ──
                        // Triggers are entry points — they don't compute during bar evaluation.
                        // Integration nodes (Telegram, Slack, HTTP, etc.) pass through to action dispatch.
                        if (ntype === 'trigger') {
                            nodeOutput = { output: true };
                        } else if (ntype === 'integration') {
                            let trigger = true;
                            const trigInput = this.resolveInput(outputs, nodeId, 'trigger');
                            if (trigInput !== null) trigger = Boolean(trigInput);

                            // ── HITL Approval Node ──
                            if (data.integrationType === 'hitl' && trigger) {
                                // Gather upstream context for the approval request
                                const upstreamData: Record<string, any> = {};
                                const inputSources = this.inputs[nodeId] ?? {};
                                for (const [handle, _] of Object.entries(inputSources)) {
                                    const val = this.resolveInput(outputs, nodeId, handle);
                                    if (val !== null) upstreamData[handle] = val;
                                }

                                nodeOutput = {
                                    output: 'pending_approval',
                                    dispatched: false,
                                    approvalRequired: true,
                                    upstreamData,
                                    message: data.message ?? 'Human approval required to proceed',
                                };

                                // Store pending approval info on the result
                                outputs[nodeId] = nodeOutput;
                                nodeLogs.push({
                                    nodeId,
                                    nodeType: ntype,
                                    status: 'success',
                                    inputData: this.inputs[nodeId] ?? {},
                                    outputData: nodeOutput,
                                    durationMs: Date.now() - startTime,
                                    executionOrder: i,
                                });
                                nodesExecuted++;

                                // Return early — execution is PAUSED at this node
                                return {
                                    orderIntents,
                                    notificationIntents,
                                    voiceCallIntents,
                                    outputs,
                                    nodeLogs,
                                    nodesExecuted,
                                    nodesSkipped,
                                    nodesErrored,
                                    pythonDelegations,
                                    pendingApproval: {
                                        nodeId,
                                        approvalContext: {
                                            ...upstreamData,
                                            message: data.message ?? 'Human approval required',
                                            timeoutMinutes: data.timeoutMinutes ?? 30,
                                        },
                                    },
                                };
                            }

                            if (trigger) {
                                const itype = data.integrationType;
                                // Telegram integration — same shape as the
                                // `notification` action but always Telegram.
                                if (itype === 'telegramNode') {
                                    const upstreamMsg = this.resolveInput(outputs, nodeId, 'message');
                                    const upstreamData = this.resolveInput(outputs, nodeId, 'data');
                                    const body = String(
                                        upstreamMsg ?? data.message ??
                                        (typeof upstreamData === 'string' ? upstreamData : '')
                                    );
                                    const attachments: NotificationIntent['attachments'] = [];
                                    const chartPath = (upstreamData && typeof upstreamData === 'object')
                                        ? (upstreamData.chartPath || upstreamData.plotPath || upstreamData.plotUrl)
                                        : data.chartPath;
                                    if (chartPath) {
                                        attachments.push({
                                            kind: 'photo',
                                            path: String(chartPath),
                                            caption: body || undefined,
                                        });
                                    }
                                    notificationIntents.push({
                                        nodeId,
                                        channel: 'telegram',
                                        title: data.title,
                                        body,
                                        target: data.chatId,
                                        attachments: attachments.length > 0 ? attachments : undefined,
                                    });
                                    nodeOutput = { output: true, dispatched: 'telegram' };
                                }
                                // Outbound voice call — declare an intent that
                                // executionService consumes after evaluation.
                                else if (itype === 'voiceCall' || itype === 'voiceCallNode') {
                                    const upstreamSummary = this.resolveInput(outputs, nodeId, 'message');
                                    const opening =
                                        String(upstreamSummary ?? '') ||
                                        String(data.openingMessageTemplate ?? data.openingMessage ?? 'Strategy alert');
                                    voiceCallIntents.push({
                                        nodeId,
                                        transport: (data.transport as VoiceCallIntent['transport']) ?? 'twilio',
                                        openingMessage: opening,
                                        voice: data.voice,
                                        allowedActions: data.allowedActions,
                                        urgencyLevel: data.urgencyLevel,
                                    });
                                    nodeOutput = { output: true, dispatched: 'voice_call' };
                                }
                                else {
                                    nodeOutput = { output: true, dispatched: true };
                                }
                                logger.info({ nodeId, integrationType: itype }, 'Integration node dispatched');
                            } else {
                                nodeOutput = { output: false };
                                status = 'skipped';
                                nodesSkipped++;
                            }
                        } else {
                            nodeOutput = { output: null };
                        }
                }

                nodesExecuted++;
            } catch (error: any) {
                nodeOutput = { output: null };
                status = 'error';
                errorMessage = error.message ?? String(error);
                nodesErrored++;
                logger.error({ nodeId, ntype, error: errorMessage }, 'Node evaluation failed');
            }

            outputs[nodeId] = nodeOutput;

            nodeLogs.push({
                nodeId,
                nodeType: ntype,
                status,
                inputData: this.inputs[nodeId] ?? {},
                outputData: nodeOutput,
                errorMessage,
                durationMs: Date.now() - startTime,
                executionOrder: i,
            });
        }

        return {
            orderIntents,
            notificationIntents,
            voiceCallIntents,
            outputs,
            nodeLogs,
            nodesExecuted,
            nodesSkipped,
            nodesErrored,
            pythonDelegations,
        };
    }
}
