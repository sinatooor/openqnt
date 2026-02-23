/**
 * Dashboard Page
 * Portfolio overview, active strategies, execution stats, and recent alerts.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { getAuthHeaders } from '../stores/authStore';

const Dashboard = () => {
    const { user, isAuthenticated } = useAuthStore();
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [strategies, setStrategies] = useState<any[]>([]);
    const [recentRuns, setRecentRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        loadDashboard();
    }, [isAuthenticated]);

    const loadDashboard = async () => {
        setLoading(true);
        try {
            const [statsData, strategiesData, runsData] = await Promise.allSettled([
                api.getExecutionStats(),
                api.listStrategies(),
                api.listExecutions({ page: 1 }),
            ]);
            if (statsData.status === 'fulfilled') setStats(statsData.value?.stats);
            if (strategiesData.status === 'fulfilled') setStrategies(strategiesData.value?.strategies ?? []);
            if (runsData.status === 'fulfilled') setRecentRuns(runsData.value?.runs?.slice(0, 5) ?? []);
        } catch { /* silent */ }
        setLoading(false);
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Loading dashboard...</div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <header style={styles.header}>
                <div>
                    <h1 style={styles.heading}>Dashboard</h1>
                    <p style={styles.greeting}>Welcome back, {user?.name ?? 'Trader'}</p>
                </div>
                <button style={styles.killBtn} onClick={() => api.emergencyKill()}>
                    🚨 Emergency Kill
                </button>
            </header>

            {/* Stats Cards */}
            <div style={styles.statsGrid}>
                <StatCard title="Total Runs" value={stats?.totalRuns ?? 0} icon="📊" color="#8b5cf6" />
                <StatCard title="Success Rate" value={`${stats?.successRate ?? 0}%`} icon="✅" color="#22c55e" />
                <StatCard title="Errors" value={stats?.errorRuns ?? 0} icon="❌" color="#ef4444" />
                <StatCard title="Active Strategies" value={strategies.filter((s: any) => s.status === 'active').length} icon="⚡" color="#3b82f6" />
            </div>

            {/* Main Grid */}
            <div style={styles.mainGrid}>
                {/* Active Strategies */}
                <div style={styles.panel}>
                    <h2 style={styles.panelTitle}>Strategies</h2>
                    {strategies.length === 0 ? (
                        <p style={styles.empty}>No strategies yet. <button style={styles.link} onClick={() => navigate('/')}>Create one →</button></p>
                    ) : (
                        strategies.map((s: any) => (
                            <div key={s.id} style={styles.strategyRow}>
                                <div>
                                    <span style={styles.strategyName}>{s.name}</span>
                                    <span style={{ ...styles.badge, background: s.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)', color: s.status === 'active' ? '#22c55e' : '#94a3b8' }}>
                                        {s.status}
                                    </span>
                                </div>
                                <span style={styles.meta}>v{s.currentVersion}</span>
                            </div>
                        ))
                    )}
                </div>

                {/* Recent Executions */}
                <div style={styles.panel}>
                    <div style={styles.panelHeader}>
                        <h2 style={styles.panelTitle}>Recent Executions</h2>
                        <button style={styles.link} onClick={() => navigate('/executions')}>View all →</button>
                    </div>
                    {recentRuns.length === 0 ? (
                        <p style={styles.empty}>No execution runs yet.</p>
                    ) : (
                        recentRuns.map((run: any) => (
                            <div key={run.id} style={styles.runRow} onClick={() => navigate(`/execution/${run.id}`)}>
                                <div>
                                    <span style={styles.runStrategy}>{run.strategy?.name ?? 'Unknown'}</span>
                                    <span style={{ ...styles.badge, ...getStatusStyle(run.status) }}>{run.status}</span>
                                </div>
                                <div style={styles.runMeta}>
                                    <span>{run.triggerType}</span>
                                    <span>{run.durationMs ? `${run.durationMs}ms` : '-'}</span>
                                    <span>{new Date(run.startedAt).toLocaleTimeString()}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div style={styles.actionsBar}>
                <button style={styles.actionBtn} onClick={() => navigate('/')}>🧩 Strategy Builder</button>
                <button style={styles.actionBtn} onClick={() => navigate('/credentials')}>🔑 Credentials</button>
                <button style={styles.actionBtn} onClick={() => navigate('/agent')}>⚙️ Agent Config</button>
                <button style={styles.actionBtn} onClick={() => navigate('/settings')}>👤 Settings</button>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) => (
    <div style={{ ...styles.statCard, borderColor: `${color}33` }}>
        <span style={{ fontSize: 28 }}>{icon}</span>
        <div>
            <div style={{ ...styles.statValue, color }}>{value}</div>
            <div style={styles.statLabel}>{title}</div>
        </div>
    </div>
);

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
    loading: { textAlign: 'center', padding: 80, color: '#94a3b8', fontSize: 16 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
    heading: { fontSize: 28, fontWeight: 700, margin: 0 },
    greeting: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
    killBtn: {
        padding: '10px 20px', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8,
        background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 13, fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.2s',
    },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 },
    statCard: {
        padding: 20, background: 'rgba(15,15,30,0.6)', backdropFilter: 'blur(12px)',
        border: '1px solid', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16,
    },
    statValue: { fontSize: 24, fontWeight: 700 },
    statLabel: { fontSize: 13, color: '#94a3b8' },
    mainGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 },
    panel: {
        padding: 24, background: 'rgba(15,15,30,0.6)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(139,92,246,0.1)', borderRadius: 12,
    },
    panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    panelTitle: { fontSize: 16, fontWeight: 600, color: '#c4b5fd', marginBottom: 16, marginTop: 0 },
    empty: { fontSize: 14, color: '#64748b' },
    link: { background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: 13 },
    strategyRow: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 0', borderBottom: '1px solid rgba(100,116,139,0.1)',
    },
    strategyName: { fontSize: 14, fontWeight: 500, marginRight: 8 },
    badge: { padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500 },
    meta: { fontSize: 12, color: '#64748b' },
    runRow: {
        padding: '12px 0', borderBottom: '1px solid rgba(100,116,139,0.1)',
        cursor: 'pointer', transition: 'background 0.15s',
    },
    runStrategy: { fontSize: 14, fontWeight: 500, marginRight: 8 },
    runMeta: { display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: '#64748b' },
    actionsBar: { display: 'flex', gap: 12 },
    actionBtn: {
        padding: '10px 20px', background: 'rgba(30,30,60,0.6)', border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: 8, color: '#c4b5fd', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        transition: 'all 0.2s',
    },
};

export default Dashboard;
