/**
 * browserInterpreter — Lightweight per-node evaluation for the canvas
 * execution overlay. Runs entirely in the browser; no network round-trips.
 *
 * Goal: replace the random-value simulator in useExecutionFlow.ts with
 * real computed values so the canvas shows numbers the user can reason
 * about (e.g. RSI=27.4 lights up the "RSI < 30" condition).
 *
 * Scope by design:
 *   • Indicators → delegated to computeKernel (browser-side).
 *   • Math / Condition / Control / Environment / TradeInfo / Trigger →
 *     evaluated synchronously here.
 *   • Action → records intent only; never submits.
 *   • LLM / Agent / Integration → out of scope (still backend-only); the
 *     interpreter returns a placeholder string so the canvas can show
 *     something sensible.
 *
 * This is a "preview" interpreter — production execution still runs on
 * the orchestrator. Code paths are kept narrow and side-effect free.
 */

import type { StrategyFlowNode, StrategyFlowEdge, StrategyNodeData } from '../types';
import { computeKernel, type Candle } from './computeKernel';
import { getSyntheticCandles } from './syntheticMarketData';

export type EvalContext = {
  /** Candles per data-source nodeId or symbol (whichever is wired). */
  candles: Map<string, Candle[]>;
  /** Per-node output values keyed by `${nodeId}:${handleId}`. */
  outputs: Map<string, number | boolean | string | null>;
  /** Variables set by setVariable nodes. */
  variables: Map<string, unknown>;
  /** Source candles fallback (when no dataSource wired). */
  defaultCandles: Candle[];
  /** Strategy ticker for synthetic data. */
  ticker: string;
};

export type NodeEvalResult = {
  /** Primary output value (for canvas display). */
  value: number | boolean | string | null;
  /** Per-handle output values written to the context. */
  handles: Record<string, number | boolean | string | null>;
  /** True/false for condition outputs; controls which edges to traverse. */
  branch?: string;
  /** Short label for canvas display (e.g. "RSI 27.4"). */
  display?: string;
};

/** Resolve an input handle value by walking the connected upstream edge. */
function resolveInput(
  ctx: EvalContext,
  edges: StrategyFlowEdge[],
  nodeId: string,
  handle: string
): number | boolean | string | null | undefined {
  const edge = edges.find((e) => e.target === nodeId && e.targetHandle === handle);
  if (!edge) return undefined;
  return ctx.outputs.get(`${edge.source}:${edge.sourceHandle || 'output'}`);
}

const asNumber = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const asBool = (v: unknown): boolean => v === true || v === 'true' || v === 1;

// ---------------------------------------------------------------------------
// Per-node-type handlers
// ---------------------------------------------------------------------------

function evalIndicator(
  node: StrategyFlowNode,
  ctx: EvalContext,
  edges: StrategyFlowEdge[]
): NodeEvalResult {
  const data = node.data as StrategyNodeData & { indicatorType?: string; params?: Record<string, number> };
  const subType = data.indicatorType || '';
  const params = data.params || {};

  // Resolve data input — try connected edge, fall back to default candles.
  const dataInputEdge = edges.find((e) => e.target === node.id && e.targetHandle === 'data');
  const candles = (dataInputEdge && ctx.candles.get(dataInputEdge.source)) || ctx.defaultCandles;

  if (!computeKernel.supports(subType)) {
    // Not implemented in the browser kernel — show placeholder.
    return {
      value: null,
      handles: { value: null },
      display: `${data.label ?? subType} (backend)`,
    };
  }

  const out = computeKernel.compute(subType, candles, params);

  const handles: Record<string, number | null> = {};
  // Primary output
  handles.value = Number.isFinite(out.value) ? out.value : null;
  // Multi-output indicators
  if (out.latest) {
    for (const [k, v] of Object.entries(out.latest)) {
      handles[k] = Number.isFinite(v) ? v : null;
    }
  }

  const display = Number.isFinite(out.value)
    ? `${out.value.toFixed(2)}`
    : '—';

  return { value: handles.value, handles, display };
}

function evalDataSource(node: StrategyFlowNode, ctx: EvalContext): NodeEvalResult {
  const data = node.data as Record<string, any>;
  const ticker = (data.symbol as string) || ctx.ticker;
  const candles = getSyntheticCandles({ ticker, bars: 250 });
  ctx.candles.set(node.id, candles);
  const latest = candles[candles.length - 1];
  return {
    value: latest.close,
    handles: { candles: latest.close }, // Store close as a numeric proxy for display
    display: `${ticker} ${latest.close.toFixed(2)}`,
  };
}

function evalMath(
  node: StrategyFlowNode,
  ctx: EvalContext,
  edges: StrategyFlowEdge[]
): NodeEvalResult {
  const data = node.data as StrategyNodeData & {
    mathType?: string;
    value?: number;
    input?: number;
    inputA?: number;
    inputB?: number;
    mathFunction?: string;
    expression?: string;
  };

  if (data.mathType === 'number') {
    const v = asNumber(data.value);
    return { value: v, handles: { output: v }, display: String(v) };
  }

  if (data.mathType === 'advancedMath') {
    const x = asNumber(resolveInput(ctx, edges, node.id, 'input') ?? data.input);
    const fn = data.mathFunction || 'sqrt';
    let r = 0;
    switch (fn) {
      case 'sqrt': r = Math.sqrt(Math.max(0, x)); break;
      case 'abs': r = Math.abs(x); break;
      case 'sin': r = Math.sin(x); break;
      case 'cos': r = Math.cos(x); break;
      case 'tan': r = Math.tan(x); break;
      case 'log': r = x > 0 ? Math.log(x) : Number.NaN; break;
      case 'exp': r = Math.exp(x); break;
      case 'floor': r = Math.floor(x); break;
      case 'ceil': r = Math.ceil(x); break;
      case 'round': r = Math.round(x); break;
    }
    return { value: r, handles: { output: r }, display: r.toFixed(2) };
  }

  if (data.mathType === 'expression') {
    const a = asNumber(resolveInput(ctx, edges, node.id, 'input-a') ?? data.inputA);
    const b = asNumber(resolveInput(ctx, edges, node.id, 'input-b') ?? data.inputB);
    // Tiny safe-ish evaluator — only supports a, b, numbers, +-*/(), Math.fn
    let r: number = Number.NaN;
    try {
      const expr = (data.expression || 'a + b').replace(/[^a-zA-Z0-9_.+\-*/()\s,]/g, '');
      // eslint-disable-next-line no-new-func
      r = Function('a', 'b', 'Math', `"use strict"; return (${expr});`)(a, b, Math);
      if (!Number.isFinite(r)) r = Number.NaN;
    } catch {
      r = Number.NaN;
    }
    return {
      value: Number.isFinite(r) ? r : null,
      handles: { output: Number.isFinite(r) ? r : null },
      display: Number.isFinite(r) ? r.toFixed(2) : 'err',
    };
  }

  // Binary operators: add / subtract / multiply / divide
  const a = asNumber(resolveInput(ctx, edges, node.id, 'input-a') ?? data.inputA);
  const b = asNumber(resolveInput(ctx, edges, node.id, 'input-b') ?? data.inputB);
  let r = 0;
  switch (data.mathType) {
    case 'add': r = a + b; break;
    case 'subtract': r = a - b; break;
    case 'multiply': r = a * b; break;
    case 'divide': r = b === 0 ? Number.NaN : a / b; break;
    default: r = a;
  }
  return {
    value: Number.isFinite(r) ? r : null,
    handles: { output: Number.isFinite(r) ? r : null },
    display: Number.isFinite(r) ? r.toFixed(2) : '—',
  };
}

function evalCondition(
  node: StrategyFlowNode,
  ctx: EvalContext,
  edges: StrategyFlowEdge[]
): NodeEvalResult {
  const data = node.data as StrategyNodeData & {
    conditionType?: string;
    operator?: string;
    threshold?: number;
    min?: number;
    max?: number;
  };
  const a = asNumber(resolveInput(ctx, edges, node.id, 'input-a'));
  const b = asNumber(resolveInput(ctx, edges, node.id, 'input-b'));
  let result = false;

  switch (data.conditionType) {
    case 'compare':
      switch (data.operator) {
        case '>': result = a > b; break;
        case '<': result = a < b; break;
        case '>=': result = a >= b; break;
        case '<=': result = a <= b; break;
        case '==': result = a === b; break;
        case '!=': result = a !== b; break;
      }
      break;
    case 'threshold': {
      const t = asNumber(data.threshold);
      result = data.operator === '<' ? a < t : data.operator === '>' ? a > t : a === t;
      break;
    }
    case 'range':
      result = a >= asNumber(data.min) && a <= asNumber(data.max);
      break;
    case 'crossover':
    case 'crossunder':
      // Cross detection needs prior-bar state — for preview, approximate
      // by simple compare.
      result = data.conditionType === 'crossover' ? a > b : a < b;
      break;
    case 'and':
      result = asBool(resolveInput(ctx, edges, node.id, 'input-a')) && asBool(resolveInput(ctx, edges, node.id, 'input-b'));
      break;
    case 'or':
      result = asBool(resolveInput(ctx, edges, node.id, 'input-a')) || asBool(resolveInput(ctx, edges, node.id, 'input-b'));
      break;
    case 'not':
      result = !asBool(resolveInput(ctx, edges, node.id, 'input'));
      break;
  }

  return {
    value: result,
    handles: { output: result },
    branch: result ? 'true' : 'false',
    display: result ? 'true' : 'false',
  };
}

function evalEnvironment(node: StrategyFlowNode, ctx: EvalContext): NodeEvalResult {
  const data = node.data as Record<string, any>;
  const t = data.environmentType as string;
  const latest = ctx.defaultCandles[ctx.defaultCandles.length - 1];
  if (!latest) return { value: null, handles: { value: null }, display: '—' };
  let v: number;
  switch (t) {
    case 'price': {
      const pt = (data.priceType as string) || 'close';
      v = pt === 'open' ? latest.open
        : pt === 'high' ? latest.high
        : pt === 'low' ? latest.low
        : latest.close;
      break;
    }
    case 'bidAskSpread': v = latest.close * 0.0005; break;
    case 'time': v = latest.timestamp; break;
    case 'dayOfWeek': v = new Date(latest.timestamp).getDay(); break;
    case 'isMarketOpen': return { value: true, handles: { value: 1 }, display: 'open' };
    default: v = latest.close;
  }
  return {
    value: v,
    handles: { value: v },
    display: Math.abs(v) > 100_000 ? v.toExponential(2) : v.toFixed(2),
  };
}

function evalTradeInfo(node: StrategyFlowNode): NodeEvalResult {
  // No open positions in preview — return zeros.
  const t = (node.data as Record<string, any>).tradeInfoType as string;
  const v = 0;
  return { value: v, handles: { output: v }, display: `${t ?? 'tradeInfo'}: 0` };
}

function evalControl(
  node: StrategyFlowNode,
  ctx: EvalContext,
  edges: StrategyFlowEdge[]
): NodeEvalResult {
  const data = node.data as Record<string, any>;
  const t = data.controlType as string;
  switch (t) {
    case 'if':
    case 'ifElse': {
      const cond = asBool(resolveInput(ctx, edges, node.id, 'condition'));
      return {
        value: cond,
        handles: { then: cond ? true : null, else: cond ? null : true },
        branch: cond ? 'then' : 'else',
        display: cond ? '→ Then' : '→ Else',
      };
    }
    case 'wait':
    case 'waitUntil':
      return { value: true, handles: { output: true }, display: 'waited' };
    case 'stop':
      return { value: false, handles: { output: false }, display: 'stop' };
    case 'switch': {
      const val = asNumber(resolveInput(ctx, edges, node.id, 'input'));
      const rules: Array<{operator: string; value: number; outputIndex: number}> = data.rules || [];
      const match = rules.find((r) => {
        switch (r.operator) {
          case 'eq': return val === r.value;
          case 'gt': return val > r.value;
          case 'lt': return val < r.value;
          case 'gte': return val >= r.value;
          case 'lte': return val <= r.value;
          default: return false;
        }
      });
      const idx = match?.outputIndex ?? (data.defaultOutputIndex ?? rules.length);
      const handles: Record<string, any> = {};
      handles[`case-${idx}`] = true;
      return { value: idx, handles, branch: `case-${idx}`, display: `case ${idx}` };
    }
    default:
      return { value: true, handles: { output: true } };
  }
}

function evalTrigger(node: StrategyFlowNode): NodeEvalResult {
  // Triggers always fire in preview (no scheduling).
  const data = node.data as Record<string, any>;
  const t = data.triggerType as string;
  return {
    value: true,
    handles: { output: true, signal: true },
    display: t === 'startTrigger' ? 'start' : (data.label ?? 'fire'),
  };
}

function evalAction(node: StrategyFlowNode): NodeEvalResult {
  // Preview: record intent only.
  const data = node.data as Record<string, any>;
  return {
    value: true,
    handles: { next: true },
    display: `intent: ${data.actionType ?? 'action'}`,
  };
}

function evalRisk(): NodeEvalResult {
  // Risk nodes are config holders; preview emits no real number.
  return { value: 0, handles: { output: 0, size: 0 }, display: 'risk' };
}

function evalVariable(
  node: StrategyFlowNode,
  ctx: EvalContext,
  edges: StrategyFlowEdge[]
): NodeEvalResult {
  const data = node.data as Record<string, any>;
  const name = (data.variableName as string) || 'var';
  if (data.variableType === 'getVariable') {
    const v = ctx.variables.get(name) ?? 0;
    return { value: v as any, handles: { output: v as any }, display: `${name}=${v}` };
  }
  // set / change
  const v = resolveInput(ctx, edges, node.id, 'input') ?? data.value ?? 0;
  ctx.variables.set(name, v);
  return { value: v as any, handles: { output: v as any }, display: `${name}=${v}` };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Create a fresh evaluation context for one run. Defaults to a synthetic
 * series for the strategy's primary ticker.
 */
export function createEvalContext(ticker = 'SPY'): EvalContext {
  return {
    candles: new Map(),
    outputs: new Map(),
    variables: new Map(),
    defaultCandles: getSyntheticCandles({ ticker, bars: 250 }),
    ticker,
  };
}

/**
 * Evaluate a single node. Writes outputs into `ctx.outputs` (keyed by
 * `${nodeId}:${handleId}`) so downstream nodes can resolve their inputs.
 */
export function evaluateNode(
  node: StrategyFlowNode,
  ctx: EvalContext,
  edges: StrategyFlowEdge[]
): NodeEvalResult {
  let result: NodeEvalResult;
  switch (node.type) {
    case 'indicator':    result = evalIndicator(node, ctx, edges); break;
    case 'dataSource':   result = evalDataSource(node, ctx); break;
    case 'math':         result = evalMath(node, ctx, edges); break;
    case 'condition':    result = evalCondition(node, ctx, edges); break;
    case 'environment':  result = evalEnvironment(node, ctx); break;
    case 'tradeInfo':    result = evalTradeInfo(node); break;
    case 'control':      result = evalControl(node, ctx, edges); break;
    case 'trigger':      result = evalTrigger(node); break;
    case 'action':       result = evalAction(node); break;
    case 'risk':         result = evalRisk(); break;
    case 'variable':     result = evalVariable(node, ctx, edges); break;
    default:
      // LLM / Agent / Integration / PineScript / Portfolio — backend-only.
      result = {
        value: null,
        handles: { output: null },
        display: `${node.type ?? 'node'} (backend)`,
      };
  }

  // Persist outputs into context so downstream nodes can read them.
  for (const [handle, val] of Object.entries(result.handles)) {
    ctx.outputs.set(`${node.id}:${handle}`, val);
  }
  return result;
}
