/**
 * Credentials Page
 * Manage encrypted API keys for broker integrations.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfigProvider, theme as antTheme } from 'antd';
import {
    Activity,
    ArrowRight,
    Key,
    Plus,
    X,
    Trash2,
    Lock,
    Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CircularProgress from '@mui/material/CircularProgress';

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
        <ConfigProvider
            theme={{
                algorithm: antTheme.darkAlgorithm,
                token: {
                    colorPrimary: '#3b82f6',
                    colorBgContainer: 'transparent',
                    colorText: '#e2e8f0',
                    colorTextSecondary: '#94a3b8',
                    borderRadius: 8,
                    fontSize: 13,
                },
            }}
        >
            <div className="min-h-screen bg-background text-foreground flex flex-col">
                {/* Top Bar */}
                <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 bg-[#252526]/90 backdrop-blur-sm border-b border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Key className="w-5 h-5 text-amber-400" />
                            <h1 className="text-white font-medium text-sm tracking-tight">
                                Credential Vault
                            </h1>
                        </div>
                        <div className="h-4 w-px bg-white/10" />
                        <span className="text-white/40 text-xs flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" />
                            AES-256-GCM Encrypted
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="default"
                            size="sm"
                            className="h-8 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
                            onClick={() => setShowAdd(!showAdd)}
                        >
                            {showAdd ? <><X className="w-4 h-4 mr-1.5" />Cancel</> : <><Plus className="w-4 h-4 mr-1.5" />Add Credential</>}
                        </Button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                            Dashboard
                        </button>
                    </div>
                </header>

                <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
                    {/* Add Form */}
                    <AnimatePresence>
                        {showAdd && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <Card className="bg-card/60 backdrop-blur-sm border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)] rounded-xl mb-6">
                                    <form onSubmit={handleAdd}>
                                        <CardHeader className="pb-4 border-b border-white/5">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Plus className="w-4 h-4" />
                                                Store New Credential
                                            </CardTitle>
                                            <CardDescription>
                                                Keys are encrypted on the server before resting in PostgreSQL.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-6 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-medium text-muted-foreground">Alias</label>
                                                    <input
                                                        className="w-full h-9 rounded-md border border-white/10 bg-black/20 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                                        value={form.alias}
                                                        onChange={(e) => setForm({ ...form, alias: e.target.value })}
                                                        placeholder="e.g. alpaca_paper"
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-medium text-muted-foreground">Provider</label>
                                                    <select
                                                        className="w-full h-9 rounded-md border border-white/10 bg-black/20 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                                        value={form.provider}
                                                        onChange={(e) => setForm({ ...form, provider: e.target.value })}
                                                    >
                                                        <option value="alpaca">Alpaca</option>
                                                        <option value="ig">IG Markets</option>
                                                        <option value="ibkr">Interactive Brokers</option>
                                                        <option value="nordnet">Nordnet</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-medium text-muted-foreground">API Key</label>
                                                    <input
                                                        className="w-full h-9 rounded-md border border-white/10 bg-black/20 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                                        type="password"
                                                        value={form.apiKey}
                                                        onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                                                        placeholder="••••••••••••••••"
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-medium text-muted-foreground">API Secret <span className="text-muted-foreground/50">(optional)</span></label>
                                                    <input
                                                        className="w-full h-9 rounded-md border border-white/10 bg-black/20 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                                        type="password"
                                                        value={form.apiSecret}
                                                        onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
                                                        placeholder="••••••••••••••••"
                                                    />
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <Button type="submit" className="w-full sm:w-auto gap-2 bg-green-600 hover:bg-green-700 text-white">
                                                    <Lock className="w-4 h-4" />
                                                    Encrypt & Store
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </form>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Credentials List */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                            <CircularProgress size={32} sx={{ color: 'hsl(45, 93%, 47%)' }} />
                            <span className="text-sm">Loading vault...</span>
                        </div>
                    ) : credentials.length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                                <Key className="w-8 h-8 text-amber-400" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground mb-1">Vault is empty</h3>
                            <p className="text-sm text-muted-foreground max-w-sm">
                                Securely store your broker API keys here to enable live execution and paper trading.
                            </p>
                        </motion.div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {credentials.map((cred: any, i: number) => (
                                <motion.div
                                    key={cred.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <Card className="bg-card/60 backdrop-blur-sm border-white/5 shadow-trading hover:border-white/10 transition-all group overflow-hidden">
                                        <CardContent className="p-5">
                                            <div className="flex justify-between items-start mb-4">
                                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 uppercase tracking-wider text-[10px]">
                                                    {cred.provider}
                                                </Badge>
                                                <button
                                                    onClick={() => handleDelete(cred.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-red-400 hover:bg-red-400/10 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <h3 className="text-lg font-medium text-foreground truncate mb-1" title={cred.alias}>
                                                {cred.alias}
                                            </h3>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                <Clock className="w-3 h-3" />
                                                Added {new Date(cred.createdAt).toLocaleDateString()}
                                            </p>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </ConfigProvider>
    );
};

export default Credentials;
