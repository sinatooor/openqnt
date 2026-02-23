/**
 * Agent Config Page
 * Heartbeat settings, operational mode, trading guardrails.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';

const MODES = [
    { value: 'advisory', label: 'Advisory', desc: 'Alerts only — no trades executed', icon: '📢', color: '#3b82f6' },
    { value: 'hitl', label: 'Human-in-the-Loop', desc: 'Requires your approval before each trade', icon: '👤', color: '#a78bfa' },
    { value: 'autonomous', label: 'Autonomous', desc: 'Fully automated — trades execute without approval', icon: '🤖', color: '#22c55e' },
    { value: 'simulation', label: 'Simulation', desc: 'Paper trades only — no real money', icon: '🧪', color: '#f59e0b' },
];

const AgentConfig = () => {
    const { isAuthenticated } = useAuthStore();
    const navigate = useNavigate();
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        loadConfig();
    }, [isAuthenticated]);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const data = await api.getAgentConfig();
            setConfig(data.config);
        } catch { /* silent */ }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.updateAgentConfig(config);
        } catch { /* silent */ }
        setSaving(false);
    };

    const handleKill = async () => {
        if (!confirm('🚨 This will halt ALL active strategies and cancel pending orders. Continue?')) return;
        try {
            await api.emergencyKill();
            loadConfig();
        } catch { /* silent */ }
    };

    if (loading) return <div style={styles.container}><p style={styles.loading}>Loading agent config...</p></div>;

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div>
                    <h1 style={styles.heading}>⚙️ Agent Configuration</h1>
                    <p style={styles.sub}>Control how your AI trading agent behaves</p>
                </div>
                <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
            </header>

            {/* Operational Mode */}
            <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Operational Mode</h2>
                <div style={styles.modeGrid}>
                    {MODES.map((mode) => (
                        <div
                            key={mode.value}
                            style={{
                                ...styles.modeCard,
                                borderColor: config?.operationalMode === mode.value ? mode.color : 'rgba(100,116,139,0.15)',
                                background: config?.operationalMode === mode.value ? `${mode.color}10` : 'rgba(15,15,30,0.6)',
                            }}
                            onClick={() => setConfig({ ...config, operationalMode: mode.value })}
                        >
                            <span style={{ fontSize: 32 }}>{mode.icon}</span>
                            <div>
                                <div style={{ ...styles.modeName, color: config?.operationalMode === mode.value ? mode.color : '#e2e8f0' }}>{mode.label}</div>
                                <div style={styles.modeDesc}>{mode.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Trading Guardrails */}
            <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Trading Guardrails</h2>
                <div style={styles.guardrailGrid}>
                    <div style={styles.field}>
                        <label style={styles.label}>Max Single Trade Value ($)</label>
                        <input
                            style={styles.input}
                            type="number"
                            value={config?.maxSingleTradeValue ?? ''}
                            onChange={(e) => setConfig({ ...config, maxSingleTradeValue: Number(e.target.value) || null })}
                            placeholder="e.g. 5000"
                        />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Max Daily Spend ($)</label>
                        <input
                            style={styles.input}
                            type="number"
                            value={config?.maxDailySpend ?? ''}
                            onChange={(e) => setConfig({ ...config, maxDailySpend: Number(e.target.value) || null })}
                            placeholder="e.g. 10000"
                        />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Max Position Concentration (%)</label>
                        <input
                            style={styles.input}
                            type="number"
                            value={config?.maxPositionConcentrationPct ?? ''}
                            onChange={(e) => setConfig({ ...config, maxPositionConcentrationPct: Number(e.target.value) || null })}
                            placeholder="e.g. 25"
                        />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Heartbeat Interval (seconds)</label>
                        <input
                            style={styles.input}
                            type="number"
                            value={config?.heartbeatIntervalSeconds ?? 300}
                            onChange={(e) => setConfig({ ...config, heartbeatIntervalSeconds: Number(e.target.value) })}
                            min={30}
                        />
                    </div>
                </div>
            </section>

            {/* Actions */}
            <div style={styles.actions}>
                <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : '💾 Save Configuration'}
                </button>
                <button style={styles.killBtn} onClick={handleKill}>
                    🚨 Emergency Kill Switch
                </button>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh', padding: '32px 48px',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #0f0f24 100%)',
        color: '#e2e8f0',
    },
    loading: { textAlign: 'center', padding: 80, color: '#94a3b8' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
    heading: { fontSize: 28, fontWeight: 700, margin: 0 },
    sub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
    backBtn: {
        padding: '8px 16px', background: 'rgba(30,30,60,0.6)', border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: 8, color: '#c4b5fd', fontSize: 13, cursor: 'pointer',
    },
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 16, fontWeight: 600, color: '#c4b5fd', marginBottom: 16 },
    modeGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 },
    modeCard: {
        padding: 20, borderRadius: 12, border: '2px solid', cursor: 'pointer',
        display: 'flex', gap: 16, alignItems: 'center', transition: 'all 0.2s',
    },
    modeName: { fontSize: 15, fontWeight: 600 },
    modeDesc: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    guardrailGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 },
    field: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
    label: { fontSize: 12, fontWeight: 500, color: '#94a3b8' },
    input: {
        padding: '10px 14px', background: 'rgba(30,30,60,0.6)', border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none',
    },
    actions: { display: 'flex', gap: 12 },
    saveBtn: {
        padding: '12px 28px', background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
        border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
    },
    killBtn: {
        padding: '12px 28px', border: '2px solid rgba(239,68,68,0.5)', borderRadius: 8,
        background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    },
};

export default AgentConfig;
