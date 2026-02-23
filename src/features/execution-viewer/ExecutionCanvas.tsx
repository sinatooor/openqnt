/**
 * Execution Canvas — canvas overlay showing node execution status.
 * Green = success, Red = error, Gray = skipped, Blue = running, Dark = not reached.
 */

import { useMemo } from 'react';

export interface NodeExecutionData {
    nodeId: string;
    nodeType: string;
    status: 'success' | 'error' | 'skipped' | 'running' | 'pending';
    inputData?: any;
    outputData?: any;
    durationMs?: number;
    executionOrder?: number;
    errorMessage?: string;
}

interface ExecutionCanvasProps {
    nodes: Array<{ id: string; type: string; data: { label: string }; position: { x: number; y: number } }>;
    edges: Array<{ id: string; source: string; target: string }>;
    nodeExecutions: NodeExecutionData[];
    onNodeHover?: (node: NodeExecutionData | null) => void;
    onNodeClick?: (node: NodeExecutionData) => void;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; glow: string }> = {
    success: { bg: 'rgba(34,197,94,0.12)', border: '#22c55e', glow: '0 0 12px rgba(34,197,94,0.3)' },
    error: { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', glow: '0 0 12px rgba(239,68,68,0.3)' },
    skipped: { bg: 'rgba(100,116,139,0.08)', border: '#475569', glow: 'none' },
    running: { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6', glow: '0 0 16px rgba(59,130,246,0.4)' },
    pending: { bg: 'rgba(30,30,50,0.5)', border: '#1e293b', glow: 'none' },
};

const STATUS_ICONS: Record<string, string> = {
    success: '✓',
    error: '✗',
    skipped: '—',
    running: '⟳',
    pending: '○',
};

export const ExecutionCanvas = ({ nodes, edges, nodeExecutions, onNodeHover, onNodeClick }: ExecutionCanvasProps) => {
    const execMap = useMemo(() => {
        const map = new Map<string, NodeExecutionData>();
        nodeExecutions.forEach((n) => map.set(n.nodeId, n));
        return map;
    }, [nodeExecutions]);

    // Compute SVG bounds
    const bounds = useMemo(() => {
        if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
        const xs = nodes.map((n) => n.position.x);
        const ys = nodes.map((n) => n.position.y);
        return {
            minX: Math.min(...xs) - 60,
            minY: Math.min(...ys) - 40,
            maxX: Math.max(...xs) + 220,
            maxY: Math.max(...ys) + 100,
        };
    }, [nodes]);

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    return (
        <div style={styles.container}>
            <svg
                viewBox={`${bounds.minX} ${bounds.minY} ${width} ${height}`}
                style={styles.svg}
                width="100%"
                height="100%"
            >
                {/* Edges */}
                {edges.map((edge) => {
                    const source = nodes.find((n) => n.id === edge.source);
                    const target = nodes.find((n) => n.id === edge.target);
                    if (!source || !target) return null;
                    const sourceExec = execMap.get(edge.source);
                    const edgeColor = sourceExec?.status === 'success' ? '#22c55e40' : sourceExec?.status === 'error' ? '#ef444440' : '#1e293b';
                    return (
                        <line
                            key={edge.id}
                            x1={source.position.x + 80}
                            y1={source.position.y + 24}
                            x2={target.position.x + 80}
                            y2={target.position.y + 24}
                            stroke={edgeColor}
                            strokeWidth={2}
                            strokeDasharray={sourceExec?.status === 'skipped' ? '4,4' : undefined}
                        />
                    );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                    const exec = execMap.get(node.id) ?? { nodeId: node.id, nodeType: node.type, status: 'pending' as const };
                    const colors = STATUS_COLORS[exec.status];
                    return (
                        <g
                            key={node.id}
                            transform={`translate(${node.position.x}, ${node.position.y})`}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => onNodeHover?.(exec)}
                            onMouseLeave={() => onNodeHover?.(null)}
                            onClick={() => onNodeClick?.(exec)}
                        >
                            <rect
                                width={160}
                                height={48}
                                rx={8}
                                fill={colors.bg}
                                stroke={colors.border}
                                strokeWidth={1.5}
                            />
                            {/* Status icon */}
                            <text
                                x={16}
                                y={30}
                                fontSize={14}
                                fill={colors.border}
                                fontWeight={600}
                            >
                                {STATUS_ICONS[exec.status]}
                            </text>
                            {/* Label */}
                            <text
                                x={34}
                                y={24}
                                fontSize={11}
                                fill="#e2e8f0"
                                fontWeight={500}
                            >
                                {node.data.label?.slice(0, 16) ?? node.type}
                            </text>
                            {/* Duration */}
                            {exec.durationMs != null && (
                                <text x={34} y={38} fontSize={9} fill="#64748b">
                                    {exec.durationMs}ms
                                </text>
                            )}
                            {/* Execution order badge */}
                            {exec.executionOrder != null && (
                                <>
                                    <circle cx={150} cy={8} r={10} fill="#0f172a" stroke={colors.border} strokeWidth={1} />
                                    <text x={150} y={12} fontSize={8} fill={colors.border} textAnchor="middle" fontWeight={700}>
                                        {exec.executionOrder}
                                    </text>
                                </>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        width: '100%', height: '100%', minHeight: 400,
        background: 'rgba(10,10,26,0.9)', borderRadius: 12,
        border: '1px solid rgba(139,92,246,0.1)', overflow: 'auto',
    },
    svg: { display: 'block' },
};

export default ExecutionCanvas;
