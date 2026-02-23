/**
 * Node Data Preview — tooltip showing JSON input/output for a hovered node.
 */

import type { NodeExecutionData } from './ExecutionCanvas';

interface NodeDataPreviewProps {
    node: NodeExecutionData | null;
    position?: { x: number; y: number };
}

export const NodeDataPreview = ({ node, position }: NodeDataPreviewProps) => {
    if (!node) return null;

    return (
        <div
            style={{
                ...styles.container,
                ...(position ? { left: position.x + 16, top: position.y } : {}),
            }}
        >
            <div style={styles.header}>
                <span style={styles.nodeId}>{node.nodeId}</span>
                <span style={{ ...styles.statusBadge, ...getStatusColor(node.status) }}>{node.status}</span>
            </div>

            <div style={styles.meta}>
                <span>Type: {node.nodeType}</span>
                {node.durationMs != null && <span>Duration: {node.durationMs}ms</span>}
                {node.executionOrder != null && <span>Order: #{node.executionOrder}</span>}
            </div>

            {node.errorMessage && (
                <div style={styles.errorBox}>
                    <strong>Error:</strong> {node.errorMessage}
                </div>
            )}

            {node.inputData && (
                <div style={styles.section}>
                    <div style={styles.sectionTitle}>📥 Input</div>
                    <pre style={styles.json}>{JSON.stringify(node.inputData, null, 2)}</pre>
                </div>
            )}

            {node.outputData && (
                <div style={styles.section}>
                    <div style={styles.sectionTitle}>📤 Output</div>
                    <pre style={styles.json}>{JSON.stringify(node.outputData, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};

function getStatusColor(status: string): React.CSSProperties {
    switch (status) {
        case 'success': return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' };
        case 'error': return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' };
        case 'running': return { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' };
        default: return { background: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
    }
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        position: 'absolute', zIndex: 100, width: 320, maxHeight: 420,
        padding: 16, background: 'rgba(15,15,30,0.95)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)', overflow: 'auto',
        fontSize: 12, color: '#e2e8f0',
    },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    nodeId: { fontWeight: 600, fontFamily: 'monospace', fontSize: 11 },
    statusBadge: { padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 },
    meta: { display: 'flex', gap: 12, fontSize: 11, color: '#94a3b8', marginBottom: 10 },
    errorBox: {
        padding: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 6, color: '#f87171', fontSize: 11, marginBottom: 10,
    },
    section: { marginBottom: 8 },
    sectionTitle: { fontSize: 10, fontWeight: 600, color: '#94a3b8', marginBottom: 4 },
    json: {
        padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 6,
        fontSize: 10, fontFamily: 'monospace', color: '#c4b5fd', margin: 0,
        whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const, maxHeight: 120, overflow: 'auto',
    },
};

export default NodeDataPreview;
