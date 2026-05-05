/**
 * Agent Config Page
 * Heartbeat settings, operational mode, trading guardrails.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { motion } from 'framer-motion';
import { ConfigProvider, theme as antTheme } from 'antd';
import {
    Settings,
    ArrowRight,
    AlertTriangle,
    Save,
    BellRing,
    UserCheck,
    Bot,
    TestTube2,
    ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import CircularProgress from '@mui/material/CircularProgress';
import { PAGE_CONTENT_CLASS } from '@/components/PageHeader';

const MODES = [
    { value: 'advisory', label: 'Advisory', desc: 'Alerts only — no trades executed', icon: <BellRing className="w-6 h-6" />, color: '#3b82f6', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', borderClass: 'border-blue-500/50' },
    { value: 'hitl', label: 'Human-in-the-Loop', desc: 'Requires your approval before each trade', icon: <UserCheck className="w-6 h-6" />, color: '#a78bfa', colorClass: 'text-purple-400', bgClass: 'bg-purple-400/10', borderClass: 'border-purple-400/50' },
    { value: 'autonomous', label: 'Autonomous', desc: 'Fully automated — trades execute without approval', icon: <Bot className="w-6 h-6" />, color: '#22c55e', colorClass: 'text-green-500', bgClass: 'bg-green-500/10', borderClass: 'border-green-500/50' },
    { value: 'simulation', label: 'Simulation', desc: 'Paper trades only — no real money', icon: <TestTube2 className="w-6 h-6" />, color: '#f59e0b', colorClass: 'text-amber-500', bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/50' },
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

    if (loading) return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-3">
            <CircularProgress size={32} sx={{ color: 'hsl(217.2 91.2% 59.8%)' }} />
            <p className="text-muted-foreground text-sm">Loading config...</p>
        </div>
    );

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
            <div className="min-h-screen bg-background text-foreground flex flex-col pt-14">
                <main className={`flex-1 p-6 ${PAGE_CONTENT_CLASS} space-y-6`}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary" />
                            <h1 className="text-foreground font-medium text-sm tracking-tight">Agent Configuration</h1>
                            <div className="h-4 w-px bg-muted/60" />
                            <span className="text-muted-foreground text-xs">Control AI behavior</span>
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-muted/40 text-foreground/80 hover:bg-muted/60 hover:text-foreground transition-colors"
                        >
                            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                            Dashboard
                        </button>
                    </div>
                    {/* Operational Mode */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <Card className="bg-card/60 backdrop-blur-sm border-border/60 shadow-trading rounded-xl">
                            <CardHeader className="pb-4 border-b border-border/60">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Bot className="w-4 h-4 text-primary" />
                                    Operational Mode
                                </CardTitle>
                                <CardDescription>
                                    Determine how strategies interact with your broker.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {MODES.map((mode) => {
                                        const isActive = config?.operationalMode === mode.value;
                                        return (
                                            <div
                                                key={mode.value}
                                                className={`p-5 rounded-xl border-2 cursor-pointer flex gap-4 items-center transition-all ${isActive ? mode.borderClass + ' ' + mode.bgClass : 'border-border/60 bg-muted/30 hover:border-border/60'
                                                    }`}
                                                onClick={() => setConfig({ ...config, operationalMode: mode.value })}
                                            >
                                                <div className={`${isActive ? mode.colorClass : 'text-muted-foreground'}`}>
                                                    {mode.icon}
                                                </div>
                                                <div>
                                                    <div className={`font-semibold text-sm mb-0.5 ${isActive ? mode.colorClass : 'text-foreground'}`}>
                                                        {mode.label}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground leading-tight">
                                                        {mode.desc}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Trading Guardrails */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <Card className="bg-card/60 backdrop-blur-sm border-border/60 shadow-trading rounded-xl">
                            <CardHeader className="pb-4 border-b border-border/60">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                                    Trading Guardrails
                                </CardTitle>
                                <CardDescription>
                                    Set limits to protect your capital.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">Max Single Trade Value ($)</label>
                                        <input
                                            className="w-full h-10 rounded-md border border-border/60 bg-muted/30 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                            type="number"
                                            value={config?.maxSingleTradeValue ?? ''}
                                            onChange={(e) => setConfig({ ...config, maxSingleTradeValue: Number(e.target.value) || null })}
                                            placeholder="e.g. 5000"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">Max Daily Spend ($)</label>
                                        <input
                                            className="w-full h-10 rounded-md border border-border/60 bg-muted/30 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                            type="number"
                                            value={config?.maxDailySpend ?? ''}
                                            onChange={(e) => setConfig({ ...config, maxDailySpend: Number(e.target.value) || null })}
                                            placeholder="e.g. 10000"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">Max Position Concentration (%)</label>
                                        <input
                                            className="w-full h-10 rounded-md border border-border/60 bg-muted/30 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                            type="number"
                                            value={config?.maxPositionConcentrationPct ?? ''}
                                            onChange={(e) => setConfig({ ...config, maxPositionConcentrationPct: Number(e.target.value) || null })}
                                            placeholder="e.g. 25"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">Heartbeat Interval (seconds)</label>
                                        <input
                                            className="w-full h-10 rounded-md border border-border/60 bg-muted/30 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                            type="number"
                                            value={config?.heartbeatIntervalSeconds ?? 300}
                                            onChange={(e) => setConfig({ ...config, heartbeatIntervalSeconds: Number(e.target.value) })}
                                            min={30}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Actions */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="pt-4 flex flex-col sm:flex-row gap-4">
                        <Button
                            className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                            onClick={handleSave}
                            disabled={saving}
                            size="lg"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </Button>
                        <Button
                            variant="destructive"
                            className="flex-1 gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50"
                            onClick={handleKill}
                            size="lg"
                        >
                            <AlertTriangle className="w-5 h-5" />
                            Emergency Kill Switch
                        </Button>
                    </motion.div>
                </main>
            </div>
        </ConfigProvider>
    );
};

export default AgentConfig;
