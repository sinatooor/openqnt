/**
 * Settings Page
 * Account info, preferences, and subscription tier.
 */

import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { motion } from 'framer-motion';
import { ConfigProvider, theme as antTheme } from 'antd';
import {
    User,
    ArrowRight,
    LogOut,
    Puzzle,
    History,
    Key,
    Bot,
    Mail,
    Shield,
    CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const Settings = () => {
    const { user, logout, isAuthenticated } = useAuthStore();
    const navigate = useNavigate();

    if (!isAuthenticated) {
        navigate('/login');
        return null;
    }

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
                            <User className="w-5 h-5 text-primary" />
                            <h1 className="text-white font-medium text-sm tracking-tight">
                                Settings
                            </h1>
                        </div>
                        <div className="h-4 w-px bg-white/10" />
                        <span className="text-white/40 text-xs">
                            Account and Preferences
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                            Dashboard
                        </button>
                    </div>
                </header>

                <main className="flex-1 p-6 max-w-4xl w-full mx-auto space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Account Card */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <Card className="bg-card/60 backdrop-blur-sm border-white/5 shadow-trading rounded-xl h-full">
                                <CardHeader className="pb-4 border-b border-white/5">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-primary" />
                                        Account Context
                                    </CardTitle>
                                    <CardDescription>Your personal details and access level.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="flex justify-between items-center pb-3 border-b border-white/5">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <User className="w-3.5 h-3.5" /> Name
                                        </span>
                                        <span className="text-sm font-medium text-foreground">{user?.name ?? '—'}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-white/5">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Mail className="w-3.5 h-3.5" /> Email
                                        </span>
                                        <span className="text-sm text-foreground">{user?.email ?? '—'}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-1">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <CreditCard className="w-3.5 h-3.5" /> Subscription
                                        </span>
                                        <Badge variant="outline" className={`uppercase tracking-wider text-[10px] ${getTierClass(user?.subscriptionTier)}`}>
                                            {user?.subscriptionTier ?? 'free'}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Quick Links */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                            <Card className="bg-card/60 backdrop-blur-sm border-white/5 shadow-trading rounded-xl h-full flex flex-col">
                                <CardHeader className="pb-4 border-b border-white/5">
                                    <CardTitle className="text-base">Quick Links</CardTitle>
                                    <CardDescription>Navigate to other application areas.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6 flex-1 flex flex-col gap-2">
                                    <button onClick={() => navigate('/')} className="flex items-center justify-between w-full px-4 py-3 bg-black/20 hover:bg-white/5 border border-white/5 rounded-lg text-sm text-foreground transition-all group">
                                        <span className="flex items-center gap-3"><Puzzle className="w-4 h-4 text-blue-400" /> Strategy Builder</span>
                                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                    </button>
                                    <button onClick={() => navigate('/executions')} className="flex items-center justify-between w-full px-4 py-3 bg-black/20 hover:bg-white/5 border border-white/5 rounded-lg text-sm text-foreground transition-all group">
                                        <span className="flex items-center gap-3"><History className="w-4 h-4 text-green-400" /> Execution History</span>
                                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                    </button>
                                    <button onClick={() => navigate('/credentials')} className="flex items-center justify-between w-full px-4 py-3 bg-black/20 hover:bg-white/5 border border-white/5 rounded-lg text-sm text-foreground transition-all group">
                                        <span className="flex items-center gap-3"><Key className="w-4 h-4 text-amber-400" /> Credential Vault</span>
                                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                    </button>
                                    <button onClick={() => navigate('/agent')} className="flex items-center justify-between w-full px-4 py-3 bg-black/20 hover:bg-white/5 border border-white/5 rounded-lg text-sm text-foreground transition-all group">
                                        <span className="flex items-center gap-3"><Bot className="w-4 h-4 text-purple-400" /> Agent Config</span>
                                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                    </button>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Danger Zone */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="md:col-span-2">
                            <Card className="bg-red-500/5 backdrop-blur-sm border-red-500/20 shadow-trading rounded-xl">
                                <CardHeader className="pb-4 border-b border-red-500/10">
                                    <CardTitle className="text-base text-red-500 flex items-center gap-2">
                                        <LogOut className="w-4 h-4" />
                                        Danger Zone
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Sign Out of Session</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                This will clear your local session and return you to the login screen.
                                            </p>
                                        </div>
                                        <Button
                                            variant="destructive"
                                            className="w-full sm:w-auto bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 gap-2"
                                            onClick={() => { logout(); navigate('/login'); }}
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Sign Out
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </main>
            </div>
        </ConfigProvider>
    );
};

function getTierClass(tier?: string): string {
    switch (tier) {
        case 'pro': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
        case 'starter': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
        case 'wealth_manager': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
}

export default Settings;
