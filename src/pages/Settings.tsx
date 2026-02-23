/**
 * Settings Page
 * Account info, preferences, and subscription tier.
 */

import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const Settings = () => {
    const { user, logout, isAuthenticated } = useAuthStore();
    const navigate = useNavigate();

    if (!isAuthenticated) {
        navigate('/login');
        return null;
    }

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.heading}>👤 Settings</h1>
                <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
            </header>

            <div style={styles.grid}>
                {/* Account Card */}
                <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Account</h2>
                    <div style={styles.row}>
                        <span style={styles.label}>Name</span>
                        <span style={styles.value}>{user?.name ?? '—'}</span>
                    </div>
                    <div style={styles.row}>
                        <span style={styles.label}>Email</span>
                        <span style={styles.value}>{user?.email ?? '—'}</span>
                    </div>
                    <div style={styles.row}>
                        <span style={styles.label}>Subscription</span>
                        <span style={{ ...styles.badge, ...getTierColor(user?.subscriptionTier) }}>{user?.subscriptionTier ?? 'free'}</span>
                    </div>
                </div>

                {/* Quick Links */}
                <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Quick Links</h2>
                    <div style={styles.linkGrid}>
                        <button style={styles.linkBtn} onClick={() => navigate('/')}>🧩 Strategy Builder</button>
                        <button style={styles.linkBtn} onClick={() => navigate('/executions')}>📊 Execution History</button>
                        <button style={styles.linkBtn} onClick={() => navigate('/credentials')}>🔑 Credentials</button>
                        <button style={styles.linkBtn} onClick={() => navigate('/agent')}>⚙️ Agent Config</button>
                    </div>
                </div>

                {/* Danger Zone */}
                <div style={{ ...styles.card, borderColor: 'rgba(239,68,68,0.2)' }}>
                    <h2 style={{ ...styles.cardTitle, color: '#f87171' }}>Danger Zone</h2>
                    <button style={styles.logoutBtn} onClick={() => { logout(); navigate('/login'); }}>
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

function getTierColor(tier?: string): React.CSSProperties {
    switch (tier) {
        case 'pro': return { background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' };
        case 'starter': return { background: 'rgba(59,130,246,0.15)', color: '#60a5fa' };
        case 'wealth_manager': return { background: 'rgba(234,179,8,0.15)', color: '#fbbf24' };
        default: return { background: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
    }
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh', padding: '32px 48px',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #0f0f24 100%)',
        color: '#e2e8f0',
    },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
    heading: { fontSize: 28, fontWeight: 700, margin: 0 },
    backBtn: {
        padding: '8px 16px', background: 'rgba(30,30,60,0.6)', border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: 8, color: '#c4b5fd', fontSize: 13, cursor: 'pointer',
    },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
    card: {
        padding: 24, background: 'rgba(15,15,30,0.6)', border: '1px solid rgba(139,92,246,0.1)',
        borderRadius: 12,
    },
    cardTitle: { fontSize: 16, fontWeight: 600, color: '#c4b5fd', marginTop: 0, marginBottom: 16 },
    row: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 0', borderBottom: '1px solid rgba(100,116,139,0.1)',
    },
    label: { fontSize: 13, color: '#94a3b8' },
    value: { fontSize: 13, fontWeight: 500 },
    badge: { padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const },
    linkGrid: { display: 'flex', flexDirection: 'column' as const, gap: 8 },
    linkBtn: {
        padding: '10px 14px', background: 'rgba(30,30,60,0.4)', border: '1px solid rgba(100,116,139,0.1)',
        borderRadius: 8, color: '#e2e8f0', fontSize: 13, cursor: 'pointer', textAlign: 'left' as const,
        transition: 'all 0.15s',
    },
    logoutBtn: {
        padding: '10px 20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 8, color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    },
};

export default Settings;
