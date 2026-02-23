/**
 * Execution Timeline — horizontal scrubber showing node execution order.
 */

import type { NodeExecutionData } from './ExecutionCanvas';

interface ExecutionTimelineProps {
    nodeExecutions: NodeExecutionData[];
    totalDurationMs: number;
    onNodeSelect?: (node: NodeExecutionData) => void;
    selectedNodeId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
    success: '#22c55e',
    error: '#ef4444',
    skipped: '#475569',
    running: '#3b82f6',
    pending: '#1e293b',
};

export const ExecutionTimeline = ({ nodeExecutions, totalDurationMs, onNodeSelect, selectedNodeId }: ExecutionTimelineProps) => {
    const sorted = [...nodeExecutions].sort((a, b) => (a.executionOrder ?? 0) - (b.executionOrder ?? 0));

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <span style={styles.label}>Execution Timeline</span>
                <span style={styles.duration}>{totalDurationMs}ms total</span>
            </div>
            <div style={styles.track}>
                {sorted.map((node, i) => {
                    const width = totalDurationMs > 0 && node.durationMs
                        ? Math.max(20, (node.durationMs / totalDurationMs) * 100)
                        : Math.max(20, 100 / sorted.length);

                    return (
                        <div
                            key={node.nodeId}
                            style={{
                                ...styles.segment,
                                width: `${width}%`,
                                background: `${STATUS_COLORS[node.status]}22`,
                                borderColor: STATUS_COLORS[node.status],
                                boxShadow: selectedNodeId === node.nodeId ? `0 0 8px ${STATUS_COLORS[node.status]}` : 'none',
                            }}
                            onClick={() => onNodeSelect?.(node)}
                            title={`${node.nodeId} (${node.status}) — ${node.durationMs ?? '?'}ms`}
                        >
                            <span style={{ ...styles.segmentLabel, color: STATUS_COLORS[node.status] }}>
                                {i + 1}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div style={styles.legend}>
                {Object.entries(STATUS_COLORS).filter(([k]) => k !== 'pending').map(([status, color]) => (
                    <span key={status} style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: color }} />
                        {status}
                    </span>
                ))}
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: 16, background: 'rgba(15,15,30,0.6)', border: '1px solid rgba(139,92,246,0.1)',
        borderRadius: 12,
    },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    label: { fontSize: 13, fontWeight: 600, color: '#c4b5fd' },
    duration: { fontSize: 12, color: '#64748b' },
    track: {
        display: 'flex', gap: 2, height: 32, borderRadius: 6, overflow: 'hidden',
        background: 'rgba(0,0,0,0.2)',
    },
    segment: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid', borderRadius: 4, cursor: 'pointer',
        transition: 'all 0.15s',
    },
    segmentLabel: { fontSize: 10, fontWeight: 700 },
    legend: { display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: '#94a3b8' },
    legendItem: { display: 'flex', alignItems: 'center', gap: 4, textTransform: 'capitalize' as const },
    legendDot: { width: 8, height: 8, borderRadius: 2 },
};

export default ExecutionTimeline;
