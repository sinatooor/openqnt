import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Plus, X, Trash2, Lock, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CircularProgress from '@mui/material/CircularProgress';

export const CredentialsTab = () => {
    const [credentials, setCredentials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ alias: '', provider: 'alpaca', apiKey: '', apiSecret: '' });

    useEffect(() => {
        loadCredentials();
    }, []);

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
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-medium tracking-tight">Credential Vault</h3>
                </div>
                <Button
                    variant="default"
                    size="sm"
                    className="h-8 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
                    onClick={() => setShowAdd(!showAdd)}
                >
                    {showAdd ? <><X className="w-4 h-4 mr-1.5" />Cancel</> : <><Plus className="w-4 h-4 mr-1.5" />Add Credential</>}
                </Button>
            </div>
            
            {/* Add Form */}
            <AnimatePresence>
                {showAdd && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-secondary rounded-lg border border-border mb-4 overflow-hidden shadow-[0_0_15px_rgba(245,158,11,0.05)] border-amber-500/20">
                            <form onSubmit={handleAdd}>
                                <div className="p-4 border-b border-border/50 bg-black/20">
                                    <h4 className="text-sm font-medium flex items-center gap-2">
                                        <Plus className="w-4 h-4" />
                                        Store New Credential
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Keys are encrypted on the server before resting.
                                    </p>
                                </div>
                                <div className="p-4 space-y-4 bg-secondary">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground">Alias</label>
                                            <input
                                                className="w-full h-9 rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                                value={form.alias}
                                                onChange={(e) => setForm({ ...form, alias: e.target.value })}
                                                placeholder="e.g. alpaca_paper"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground">Provider</label>
                                            <select
                                                className="w-full h-9 rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
                                                className="w-full h-9 rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
                                                className="w-full h-9 rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
                                </div>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Credentials List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                    <CircularProgress size={24} sx={{ color: 'hsl(45, 93%, 47%)' }} />
                </div>
            ) : credentials.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-xl">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-3">
                        <Key className="w-6 h-6 text-amber-400" />
                    </div>
                    <h3 className="text-sm font-medium text-foreground mb-1">Vault is empty</h3>
                    <p className="text-xs text-muted-foreground max-w-[250px]">
                        Securely store your broker API keys here to enable live execution.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {credentials.map((cred: any, i: number) => (
                        <div
                            key={cred.id}
                            className="flex items-center gap-3 p-3 bg-secondary rounded-lg border border-border hover:border-primary/50 transition-colors group"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-sm font-medium text-foreground truncate" title={cred.alias}>
                                        {cred.alias}
                                    </h3>
                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 uppercase tracking-wider text-[9px] py-0">
                                        {cred.provider}
                                    </Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="w-3 h-3" />
                                    Added {new Date(cred.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(cred.id)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
