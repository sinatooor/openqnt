/**
 * Execution History Page
 * n8n-style execution list with filtering, pagination, and node-level detail.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExecutionStore } from '../stores/executionStore';
import { useAuthStore } from '../stores/authStore';

const ExecutionHistory = () => {
    const { isAuthenticated } = useAuthStore();
    const { runs, pagination, isLoading, fetchRuns } = useExecutionStore();
    const navigate = useNavigate();
    const [statusFilter, setStatusFilter] = useState<string>('');

    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        fetchRuns({ status: statusFilter || undefined });
    }, [isAuthenticated, statusFilter]);

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div>
                    <h1 style={styles.heading}>Execution History</h1>
                    <p style={styles.sub}>{pagination.total} total runs</p>
                </div>
                <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
            </header>

            {/* Filters */}
            <div style={styles.filters}>
                {['', 'success', 'error', 'running', 'skipped'].map((status) => (
                    <button
                        key={status}
                        style={{ ...styles.filterBtn, ...(statusFilter === status ? styles.filterActive : {}) }}
                        onClick={() => setStatusFilter(status)}
                    >
                        {status || 'All'}
                    </button>
                ))}
            </div>

            {/* Runs Table */}
            <div style={styles.table}>
                <div style={styles.tableHeader}>
                    <span style={{ flex: 2 }}>Strategy</span>
                    <span style={{ flex: 1 }}>Trigger</span>
                    <span style={{ flex: 1 }}>Status</span>
                    <span style={{ flex: 1 }}>Nodes</span>
                    <span style={{ flex: 1 }}>Duration</span>
                    <span style={{ flex: 1.5 }}>Started</span>
                </div>

                {isLoading ? (
                    <div style={styles.loadingRow}>Loading...</div>
                ) : runs.length === 0 ? (
                    <div style={styles.loadingRow}>No execution runs found.</div>
                ) : (
                    runs.map((run) => (
                        <div
                            key={run.id}
                            style={styles.row}
                            onClick={() => navigate(`/execution/${run.id}`)}
                        >
                            <span style={{ flex: 2, fontWeight: 500 }}>{run.strategy?.name ?? '—'}</span>
                            <span style={{ flex: 1 }}>
                                <span style={styles.triggerBadge}>{run.triggerType}</span>
                            </span>
                            <span style={{ flex: 1 }}>
                                <span style={{ ...styles.statusBadge, ...getStatusStyle(run.status) }}>{run.status}</span>
                            </span>
                            <span style={{ flex: 1, color: '#94a3b8' }}>
                                {run.nodesExecuted}/{run.nodesExecuted + run.nodesSkipped + run.nodesErrored}
                                {run.nodesErrored > 0 && <span style={{ color: '#ef4444' }}> ({run.nodesErrored}⚠)</span>}
                            </span>
                            <span style={{ flex: 1, color: '#94a3b8' }}>
                                {run.durationMs ? `${run.durationMs}ms` : '—'}
                            </span>
                            <span style={{ flex: 1.5, color: '#64748b', fontSize: 12 }}>
                                {new Date(run.startedAt).toLocaleString()}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div style={styles.pagination}>
                    {Array.from({ length: pagination.totalPages }, (_, i) => (
                        <button
                            key={i + 1}
                            style={{ ...styles.pageBtn, ...(pagination.page === i + 1 ? styles.pageBtnActive : {}) }}
                            onClick={() => fetchRuns({ page: i + 1, status: statusFilter || undefined })}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

function getStatusStyle(status: string): React.CSSProperties {
    switch (status) {
        case 'success': return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' };
        case 'error': return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' };
        case 'running': return { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' };
        case 'skipped': return { background: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
        default: return { background: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
    }
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh', padding: '32px 48px',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #0f0f24 100%)',
        color: '#e2e8f0',
    },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    heading: { fontSize: 28, fontWeight: 700, margin: 0 },
    sub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
    backBtn: {
        padding: '8px 16px', background: 'rgba(30,30,60,0.6)', border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: 8, color: '#c4b5fd', fontSize: 13, cursor: 'pointer',
    },
    filters: { display: 'flex', gap: 8, marginBottom: 20 },
    filterBtn: {
        padding: '6px 14px', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 6,
        background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer',
        textTransform: 'capitalize' as const,
    },
    filterActive: { background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', borderColor: 'rgba(139,92,246,0.4)' },
    table: {
        background: 'rgba(15,15,30,0.6)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(139,92,246,0.1)', borderRadius: 12, overflow: 'hidden',
    },
    tableHeader: {
        display: 'flex', padding: '12px 20px', fontSize: 12, fontWeight: 600,
        color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 0.5,
        borderBottom: '1px solid rgba(100,116,139,0.1)',
    },
    row: {
        display: 'flex', padding: '14px 20px', fontSize: 13, alignItems: 'center',
        borderBottom: '1px solid rgba(100,116,139,0.05)', cursor: 'pointer',
        transition: 'background 0.15s',
    },
    loadingRow: { padding: 32, textAlign: 'center', color: '#64748b' },
    triggerBadge: {
        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
        background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
    },
    statusBadge: { padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500 },
    pagination: { display: 'flex', gap: 4, justifyContent: 'center', marginTop: 20 },
    pageBtn: {
        padding: '6px 12px', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 6,
        background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer',
    },
    pageBtnActive: { background: 'rgba(139,92,246,0.2)', color: '#c4b5fd' },
};

export default ExecutionHistory;
