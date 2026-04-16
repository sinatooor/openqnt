/**
 * ExecutionEdge - Custom bezier edge that visualizes execution flow.
 *
 * During execution:
 *  - "running" edges get a flowing dash animation (pulse along the path)
 *  - "active" (completed) edges turn green with a subtle glow
 *  - inactive edges stay at their original data-type color
 *
 * Preserves the existing data-type color coding when not executing.
 */

import { memo, useMemo } from 'react';
import { BezierEdge, EdgeProps, getBezierPath } from '@xyflow/react';
import { useExecutionStore, selectEdgeExecution } from '../../store/executionStore';

export const ExecutionEdge = memo((props: EdgeProps) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    selected,
  } = props;

  const edgeExec = useExecutionStore(selectEdgeExecution(id));

  // Compute the bezier path
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Build dynamic style based on execution state
  const computedStyle = useMemo(() => {
    const base = { ...style };

    if (edgeExec.running) {
      // Running: blue, animated dash
      return {
        ...base,
        stroke: '#3b82f6',
        strokeWidth: 3,
      };
    }

    if (edgeExec.active) {
      // Completed successfully: green
      return {
        ...base,
        stroke: '#22c55e',
        strokeWidth: 2.5,
      };
    }

    // Default: keep original data-type color
    return base;
  }, [style, edgeExec.running, edgeExec.active]);

  // CSS class for edge animation
  const edgeClass = useMemo(() => {
    if (edgeExec.running) return 'exec-edge-running';
    if (edgeExec.active) return 'exec-edge-success';
    return '';
  }, [edgeExec.running, edgeExec.active]);

  return (
    <>
      {/* Invisible wider path for easier interaction */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />
      {/* Visible edge path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={computedStyle.stroke as string || '#64748b'}
        strokeWidth={computedStyle.strokeWidth as number || 2}
        className={`react-flow__edge-path ${edgeClass}`}
        markerEnd={markerEnd}
        style={{
          transition: edgeExec.running ? 'none' : 'stroke 0.3s ease, stroke-width 0.3s ease',
        }}
      />
      {/* Item count label when edge has completed with data */}
      {edgeExec.active && edgeExec.itemCount > 0 && (
        <EdgeLabel
          edgePath={edgePath}
          label={`${edgeExec.itemCount} item${edgeExec.itemCount > 1 ? 's' : ''}`}
        />
      )}
    </>
  );
});

ExecutionEdge.displayName = 'ExecutionEdge';

/**
 * Small label displayed at the midpoint of the edge path.
 */
const EdgeLabel = memo(({ edgePath, label }: { edgePath: string; label: string }) => {
  // Use an SVG text element positioned at 50% along the path
  return (
    <g>
      <text>
        <textPath
          href={`#temp-measure`}
          startOffset="50%"
          textAnchor="middle"
          className="fill-white/60 text-[10px]"
        >
          {label}
        </textPath>
      </text>
    </g>
  );
});

EdgeLabel.displayName = 'EdgeLabel';
