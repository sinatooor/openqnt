/**
 * Credentials Page
 * Manage encrypted API keys for broker integrations.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';

const Credentials = () => {
    const { isAuthenticated } = useAuthStore();
    const navigate = useNavigate();
    const [credentials, setCredentials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ alias: '', provider: 'alpaca', apiKey: '', apiSecret: '' });

    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        loadCredentials();
    }, [isAuthenticated]);

    const loadCredentials = async () => {
        setLoading(true);
        try {
            const data = await api.listCredentials();
            setCredentials(data.credentials ?? []);
        } catch { /* silent */ }
        setLoading(false);
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.storeCredential(form);
            setShowAdd(false);
            setForm({ alias: '', provider: 'alpaca', apiKey: '', apiSecret: '' });
            loadCredentials();
        } catch { /* silent */ }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this credential?')) return;
        try {
            await api.deleteCredential(id);
            loadCredentials();
        } catch { /* silent */ }
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div>
                    <h1 style={styles.heading}>🔑 Credential Vault</h1>
                    <p style={styles.sub}>Your API keys are encrypted with AES-256-GCM at rest</p>
                </div>
                <div style={styles.headerActions}>
                    <button style={styles.addBtn} onClick={() => setShowAdd(!showAdd)}>
                        {showAdd ? '✕ Cancel' : '+ Add Credential'}
                    </button>
                    <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
                </div>
            </header>

            {/* Add Form */}
            {showAdd && (
                <form onSubmit={handleAdd} style={styles.addForm}>
                    <div style={styles.formGrid}>
                        <div style={styles.field}>
                            <label style={styles.label}>Alias</label>
                            <input style={styles.input} value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} placeholder="e.g. alpaca_paper" required />
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>Provider</label>
                            <select style={styles.input} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                                <option value="alpaca">Alpaca</option>
                                <option value="ig">IG Markets</option>
                                <option value="ibkr">Interactive Brokers</option>
                                <option value="nordnet">Nordnet</option>
                            </select>
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>API Key</label>
                            <input style={styles.input} type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="API Key" required />
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>API Secret (optional)</label>
                            <input style={styles.input} type="password" value={form.apiSecret} onChange={(e) => setForm({ ...form, apiSecret: e.target.value })} placeholder="API Secret" />
                        </div>
                    </div>
                    <button type="submit" style={styles.submitBtn}>🔒 Encrypt & Store</button>
                </form>
            )}

            {/* Credentials List */}
            {loading ? (
                <p style={styles.empty}>Loading...</p>
            ) : credentials.length === 0 ? (
                <div style={styles.emptyState}>
                    <span style={{ fontSize: 48 }}>🔐</span>
                    <p style={styles.emptyTitle}>No credentials stored</p>
                    <p style={styles.empty}>Add your broker API keys to enable live and paper trading.</p>
                </div>
            ) : (
                <div style={styles.grid}>
                    {credentials.map((cred: any) => (
                        <div key={cred.id} style={styles.card}>
                            <div style={styles.cardHeader}>
                                <span style={styles.providerBadge}>{cred.provider}</span>
                                <button style={styles.deleteBtn} onClick={() => handleDelete(cred.id)}>🗑</button>
                            </div>
                            <h3 style={styles.cardAlias}>{cred.alias}</h3>
                            <p style={styles.cardMeta}>Added {new Date(cred.createdAt).toLocaleDateString()}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh', padding: '32px 48px',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #0f0f24 100%)',
        color: '#e2e8f0',
    },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
    heading: { fontSize: 28, fontWeight: 700, margin: 0 },
    sub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
    headerActions: { display: 'flex', gap: 8 },
    addBtn: {
        padding: '8px 16px', background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
        border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    },
    backBtn: {
        padding: '8px 16px', background: 'rgba(30,30,60,0.6)', border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: 8, color: '#c4b5fd', fontSize: 13, cursor: 'pointer',
    },
    addForm: {
        padding: 24, background: 'rgba(15,15,30,0.6)', border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: 12, marginBottom: 24,
    },
    formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
    field: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
    label: { fontSize: 12, fontWeight: 500, color: '#94a3b8' },
    input: {
        padding: '8px 12px', background: 'rgba(30,30,60,0.6)', border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none',
    },
    submitBtn: {
        padding: '10px 24px', background: 'linear-gradient(135deg, #22c55e, #16a34a)',
        border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
    card: {
        padding: 20, background: 'rgba(15,15,30,0.6)', border: '1px solid rgba(139,92,246,0.1)',
        borderRadius: 12, transition: 'border-color 0.2s',
    },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    providerBadge: {
        padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
        background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', textTransform: 'uppercase' as const,
    },
    deleteBtn: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', opacity: 0.5 },
    cardAlias: { fontSize: 16, fontWeight: 600, margin: '0 0 4px' },
    cardMeta: { fontSize: 12, color: '#64748b', margin: 0 },
    emptyState: { textAlign: 'center', padding: 60 },
    emptyTitle: { fontSize: 18, fontWeight: 600, marginTop: 12, marginBottom: 4 },
    empty: { fontSize: 14, color: '#64748b' },
};

export default Credentials;
