/**
 * ExecutionEdge - Custom bezier edge with execution-state visualization,
 * a hover-only cancel button at the midpoint, and an inline data-value
 * label showing the current value flowing through the edge.
 *
 * Behavior:
 *  - "running" edges: blue, animated dash
 *  - "active" (completed) edges: green with a subtle glow
 *  - inactive edges: original data-type color from props.style
 *
 * UX:
 *  - Hovering the edge reveals an ✕ button at the midpoint to remove it.
 *  - When the source node has produced output, the value flowing through
 *    the edge is rendered as a small foreignObject label (with truncation
 *    so long strings / large numbers do not blow out the canvas).
 */

import { memo, useMemo, useState } from 'react';
import {
  EdgeProps,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  useStore as useReactFlowStore,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { useExecutionStore, selectEdgeExecution, selectNodeOutput } from '../../store/executionStore';

const MAX_STRING_LEN = 14;
const MIN_LABEL_ZOOM = 0.55;

/* -------------------------------------------------------------------------- */
/*  Value formatting                                                          */
/* -------------------------------------------------------------------------- */

function formatScalar(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return String(v);
    const abs = Math.abs(v);
    if (abs >= 1e6 || (abs > 0 && abs < 1e-3)) return v.toExponential(2);
    if (abs < 1) return v.toFixed(4);
    if (abs < 100) return v.toFixed(2);
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') {
    return v.length > MAX_STRING_LEN ? `${v.slice(0, MAX_STRING_LEN)}…` : v;
  }
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === 'object') {
    const keys = Object.keys(v as object);
    if (keys.length === 0) return '{ }';
    return `{${keys.length}}`;
  }
  return null;
}

/**
 * Pick the most relevant scalar from a node's output for display on an edge.
 * Tries the source-handle key first, then a `value`/`result`/`output` key,
 * then the first scalar entry. Falls back to the whole object summary.
 */
function pickEdgeValue(
  output: Record<string, unknown> | null,
  sourceHandle: string | null | undefined,
): string | null {
  if (!output) return null;

  if (sourceHandle && sourceHandle in output) {
    const formatted = formatScalar(output[sourceHandle]);
    if (formatted) return formatted;
  }

  for (const key of ['value', 'result', 'output', 'signal']) {
    if (key in output) {
      const formatted = formatScalar(output[key]);
      if (formatted) return formatted;
    }
  }

  for (const v of Object.values(output)) {
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
      const formatted = formatScalar(v);
      if (formatted) return formatted;
    }
  }

  return formatScalar(output);
}

/* -------------------------------------------------------------------------- */
/*  Edge component                                                            */
/* -------------------------------------------------------------------------- */

export const ExecutionEdge = memo((props: EdgeProps) => {
  const {
    id,
    source,
    sourceHandleId,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
  } = props;

  const [hover, setHover] = useState(false);
  const { setEdges } = useReactFlow();
  const zoom = useReactFlowStore((s) => s.transform[2]);

  const edgeExec = useExecutionStore(selectEdgeExecution(id));
  const sourceOutput = useExecutionStore(selectNodeOutput(source));

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const computedStyle = useMemo(() => {
    const base = { ...style };
    if (edgeExec.running) return { ...base, stroke: '#3b82f6', strokeWidth: 3 };
    if (edgeExec.active) return { ...base, stroke: '#22c55e', strokeWidth: 2.5 };
    return base;
  }, [style, edgeExec.running, edgeExec.active]);

  const edgeClass = edgeExec.running
    ? 'exec-edge-running'
    : edgeExec.active
      ? 'exec-edge-success'
      : '';

  const dataLabel = useMemo(
    () => pickEdgeValue(sourceOutput, sourceHandleId),
    [sourceOutput, sourceHandleId],
  );

  const itemCountLabel =
    edgeExec.active && edgeExec.itemCount > 1 ? `× ${edgeExec.itemCount}` : null;

  const showLabel = (dataLabel || itemCountLabel) && zoom >= MIN_LABEL_ZOOM;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges((es) => es.filter((edge) => edge.id !== id));
  };

  return (
    <>
      {/* Wide invisible interaction path — captures hover for the entire edge */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
      {/* Visible edge */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={(computedStyle.stroke as string) || '#64748b'}
        strokeWidth={(computedStyle.strokeWidth as number) || 2}
        className={`react-flow__edge-path ${edgeClass}`}
        markerEnd={markerEnd}
        style={{
          transition: edgeExec.running
            ? 'none'
            : 'stroke 0.3s ease, stroke-width 0.3s ease',
        }}
      />

      <EdgeLabelRenderer>
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="flex items-center gap-1.5 nodrag nopan"
        >
          {showLabel && (
            <div
              className="px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums leading-none bg-card/95 border border-border text-foreground/80 shadow-sm max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap"
              title={dataLabel ?? undefined}
            >
              {dataLabel}
              {itemCountLabel && (
                <span className="ml-1 text-foreground/50">{itemCountLabel}</span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Remove edge"
            className={`flex items-center justify-center w-[18px] h-[18px] rounded-full bg-background border border-border text-foreground/70 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive shadow-sm transition-opacity ${
              hover ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

ExecutionEdge.displayName = 'ExecutionEdge';
