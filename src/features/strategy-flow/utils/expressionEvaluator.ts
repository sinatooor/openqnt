/**
 * Expression Evaluator - evaluates {{ }} expressions in node parameters.
 *
 * Syntax (inspired by n8n):
 *   {{ $node.NodeId.output.field }}       – field from a node's output data
 *   {{ $node.NodeId.input.field }}        – field from a node's input data
 *   {{ $node['Node Label'].output.field }}– same but by label
 *   {{ $workflow.name }}                  – workflow metadata
 *   {{ $workflow.id }}
 *   {{ $now }}                            – current ISO timestamp
 *   {{ $json.field }}                     – alias for the first upstream node output
 *
 * Expressions are evaluated at runtime against the current executionStore state.
 */

import type { NodeExecutionData } from '../store/executionStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpressionContext {
  /** Node execution state (from executionStore.nodeStates) */
  nodeStates: Record<string, NodeExecutionData>;
  /** Node list (used to resolve label → id) */
  nodes: Array<{ id: string; data: { label: string } }>;
  /** Workflow metadata */
  workflow: { name: string; id: string | null };
}

// ---------------------------------------------------------------------------
// Regex
// ---------------------------------------------------------------------------

const EXPR_RE = /\{\{\s*([\s\S]*?)\s*\}\}/g;

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Returns true if the string contains at least one {{ }} expression */
export function containsExpression(value: string): boolean {
  EXPR_RE.lastIndex = 0;
  return EXPR_RE.test(value);
}

/**
 * Evaluate all {{ }} expressions in a string and return the result.
 * If the whole string is a single expression the raw value is returned
 * (not stringified), allowing numbers/booleans to pass through correctly.
 */
export function evaluateExpressions(
  template: string,
  ctx: ExpressionContext,
): unknown {
  EXPR_RE.lastIndex = 0;
  const matches = [...template.matchAll(EXPR_RE)];
  if (matches.length === 0) return template;

  // If the entire string is one expression, return raw value
  if (matches.length === 1 && matches[0][0] === template.trim()) {
    return evalSingle(matches[0][1].trim(), ctx);
  }

  // Otherwise string-interpolate all expressions
  let result = template;
  for (const match of matches) {
    const raw = evalSingle(match[1].trim(), ctx);
    result = result.replace(match[0], raw === undefined ? '' : String(raw));
  }
  return result;
}

/**
 * Evaluate a single expression (without the {{ }}).
 */
function evalSingle(expr: string, ctx: ExpressionContext): unknown {
  try {
    // $now
    if (expr === '$now') return new Date().toISOString();

    // $workflow.name / $workflow.id
    if (expr.startsWith('$workflow.')) {
      const field = expr.slice('$workflow.'.length);
      return (ctx.workflow as Record<string, unknown>)[field];
    }

    // $node.NodeRef.output.field  /  $node.NodeRef.input.field
    if (expr.startsWith('$node.') || expr.startsWith("$node['") || expr.startsWith('$node["')) {
      return resolveNodeRef(expr, ctx);
    }

    // $json.field  — shorthand for first upstream output
    if (expr.startsWith('$json.')) {
      const field = expr.slice('$json.'.length);
      const firstNodeId = Object.keys(ctx.nodeStates)[0];
      if (!firstNodeId) return undefined;
      return getNestedValue(ctx.nodeStates[firstNodeId]?.outputData, field);
    }

    return undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Node reference resolver
// ---------------------------------------------------------------------------

function resolveNodeRef(expr: string, ctx: ExpressionContext): unknown {
  // Normalise: $node['Foo Bar'].output.field  →  $node.Foo Bar.output.field
  const normalised = expr
    .replace(/^\$node\[['"](.+?)['"]\]/, '$node.$1')
    .replace(/^\$node\["(.+?)"\]/, '$node.$1');

  // Strip leading $node.
  const rest = normalised.replace(/^\$node\./, '');

  // Split on first two dots (nodeRef, ioType, ...fieldPath)
  const dotIdx1 = rest.indexOf('.');
  if (dotIdx1 === -1) return undefined;

  const nodeRef = rest.slice(0, dotIdx1);
  const afterNode = rest.slice(dotIdx1 + 1);

  const dotIdx2 = afterNode.indexOf('.');
  const ioType = dotIdx2 === -1 ? afterNode : afterNode.slice(0, dotIdx2);
  const fieldPath = dotIdx2 === -1 ? '' : afterNode.slice(dotIdx2 + 1);

  // Resolve nodeRef → nodeId (by id first, then by label)
  const node =
    ctx.nodes.find((n) => n.id === nodeRef) ??
    ctx.nodes.find((n) => n.data.label === nodeRef);

  if (!node) return undefined;

  const ns = ctx.nodeStates[node.id];
  if (!ns) return undefined;

  const dataObj = ioType === 'output' ? ns.outputData : ns.inputData;
  return fieldPath ? getNestedValue(dataObj, fieldPath) : dataObj;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const key of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}
