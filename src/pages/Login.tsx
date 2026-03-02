/**
 * Login / Register Page
 * Modern auth page with toggle between login and register modes.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const Login = () => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const { login, register, isLoading, error, clearError } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        try {
            if (mode === 'login') {
                await login(email, password);
            } else {
                await register(email, password, name);
            }
            navigate('/dashboard');
        } catch {
            // Error is set in store
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.backdrop} />
            <div style={styles.card}>
                <div style={styles.logo}>
                    <span style={styles.logoIcon}>⚡</span>
                    <h1 style={styles.title}>OpenQwnt</h1>
                    <p style={styles.subtitle}>AI-Powered Trading Automation</p>
                </div>

                <div style={styles.tabs}>
                    <button
                        style={{ ...styles.tab, ...(mode === 'login' ? styles.tabActive : {}) }}
                        onClick={() => { setMode('login'); clearError(); }}
                    >
                        Sign In
                    </button>
                    <button
                        style={{ ...styles.tab, ...(mode === 'register' ? styles.tabActive : {}) }}
                        onClick={() => { setMode('register'); clearError(); }}
                    >
                        Create Account
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={styles.form}>
                    {mode === 'register' && (
                        <div style={styles.field}>
                            <label style={styles.label}>Name</label>
                            <input
                                style={styles.input}
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                required
                            />
                        </div>
                    )}

                    <div style={styles.field}>
                        <label style={styles.label}>Email</label>
                        <input
                            style={styles.input}
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>Password</label>
                        <input
                            style={styles.input}
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={8}
                        />
                    </div>

                    {error && <div style={styles.error}>{error}</div>}

                    <button
                        type="submit"
                        style={styles.button}
                        disabled={isLoading}
                    >
                        {isLoading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>

                <p style={styles.footer}>
                    {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                    <button
                        style={styles.link}
                        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); clearError(); }}
                    >
                        {mode === 'login' ? 'Create one' : 'Sign in'}
                    </button>
                </p>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a1628 100%)',
    },
    backdrop: {
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 30% 40%, rgba(139,92,246,0.08) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(59,130,246,0.06) 0%, transparent 50%)',
    },
    card: {
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, padding: 40,
        background: 'rgba(15,15,30,0.85)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(139,92,246,0.15)', borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
    },
    logo: { textAlign: 'center' as const, marginBottom: 32 },
    logoIcon: { fontSize: 48, display: 'block', marginBottom: 8 },
    title: { fontSize: 28, fontWeight: 700, color: '#e2e8f0', margin: 0 },
    subtitle: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
    tabs: {
        display: 'flex', gap: 0, background: 'rgba(30,30,60,0.5)',
        borderRadius: 8, padding: 4, marginBottom: 24,
    },
    tab: {
        flex: 1, padding: '10px 0', border: 'none', borderRadius: 6,
        background: 'transparent', color: '#94a3b8', fontSize: 14,
        fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
    },
    tabActive: {
        background: 'rgba(139,92,246,0.2)', color: '#c4b5fd',
        boxShadow: '0 0 12px rgba(139,92,246,0.15)',
    },
    form: { display: 'flex', flexDirection: 'column' as const, gap: 16 },
    field: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
    label: { fontSize: 13, fontWeight: 500, color: '#94a3b8' },
    input: {
        padding: '10px 14px', background: 'rgba(30,30,60,0.6)',
        border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8,
        color: '#e2e8f0', fontSize: 14, outline: 'none',
        transition: 'border-color 0.2s',
    },
    button: {
        padding: '12px 0', border: 'none', borderRadius: 8,
        background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
        color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
        marginTop: 8, transition: 'transform 0.1s, box-shadow 0.2s',
        boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
    },
    error: {
        padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
        color: '#f87171', fontSize: 13,
    },
    footer: { textAlign: 'center' as const, fontSize: 13, color: '#64748b', marginTop: 20 },
    link: {
        background: 'none', border: 'none', color: '#a78bfa',
        cursor: 'pointer', fontSize: 13, textDecoration: 'underline',
    },
};

export default Login;
