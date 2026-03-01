/**
 * Settings Page
 * General account settings, trading defaults, broker connections, and preferences.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUserProfile } from '../hooks/useUserProfile';
import { motion } from 'framer-motion';
import { ConfigProvider, theme as antTheme } from 'antd';
import {
    User,
    ArrowRight,
    LogOut,
    Mail,
    Shield,
    CreditCard,
    Wallet,
    Link2,
    CheckCircle,
    Settings as SettingsIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BrokerConnectionModal } from '@/features/strategy-flow/components/modals/BrokerConnectionModal';
import { PAGE_CONTENT_CLASS } from '@/components/PageHeader';

const BROKERS = [
    { id: 'ig', name: 'IG Markets', description: 'CFD Trading', logo: '/logo/logo_ig.png' },
    { id: 'icmarkets', name: 'IC Markets', description: 'Forex & CFDs', logo: '/logo/logo_icmarkets.png' },
    { id: 'ibkr', name: 'Interactive Brokers', description: 'Global Markets', logo: '/logo/interactivebrokers.png' },
    { id: 'nordnet', name: 'Nordnet', description: 'Nordic Broker', logo: '/logo/nordnet.png' },
    { id: 'avanza', name: 'Avanza', description: 'Swedish Stockbroker', logo: '/logo/avanza.png' },
    { id: 'etoro', name: 'eToro', description: 'Social Trading', logo: '/logo/logo_etoro.png' },
];

const CONNECTORS = [
    { id: 'tradingview', name: 'TradingView', description: 'Charting & Alerts', logo: '/logo/logo_tradingview.webp' },
    { id: 'discord', name: 'Discord Bot', description: 'Notifications', logo: '/logo/logo_discord_small.png' },
    { id: 'n8n', name: 'n8n', description: 'Workflow automation', logo: '/logo/logo_n8n.png' },
];

const Settings = () => {
    const { user, logout, isAuthenticated } = useAuthStore();
    const { settings, updateSettings } = useUserProfile();
    const navigate = useNavigate();
    const [brokerConnections, setBrokerConnections] = useState<Record<string, boolean>>({});
    const [selectedBroker, setSelectedBroker] = useState<{ id: string; name: string } | null>(null);

    if (!isAuthenticated) {
        navigate('/login');
        return null;
    }

    const handleConnectBroker = (brokerId: string) => {
        const broker = BROKERS.find(b => b.id === brokerId);
        if (broker) {
            setSelectedBroker({ id: broker.id, name: broker.name });
        }
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
            <div className="min-h-screen bg-background text-foreground flex flex-col pt-14">
                <main className={`flex-1 p-6 ${PAGE_CONTENT_CLASS} space-y-6 pb-8`}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <SettingsIcon className="w-5 h-5 text-primary" />
                            <h1 className="text-white font-medium text-sm tracking-tight">Settings</h1>
                            <div className="h-4 w-px bg-white/10" />
                            <span className="text-white/40 text-xs">Account, Trading & Connections</span>
                        </div>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                            Dashboard
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Account Card */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <Card className="bg-card/60 backdrop-blur-sm border-white/5 shadow-trading rounded-xl h-full">
                                <CardHeader className="pb-4 border-b border-white/5">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-primary" />
                                        Account
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

                        {/* Trading Defaults & Preferences */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                            <Card className="bg-card/60 backdrop-blur-sm border-white/5 shadow-trading rounded-xl h-full">
                                <CardHeader className="pb-4 border-b border-white/5">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <SettingsIcon className="w-4 h-4 text-primary" />
                                        Trading Defaults
                                    </CardTitle>
                                    <CardDescription>Default symbol, timeframe, and preferences.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Default Symbol</Label>
                                            <Input
                                                type="text"
                                                defaultValue={settings?.defaultSymbol || 'EURUSD'}
                                                onChange={(e) => updateSettings({ defaultSymbol: e.target.value })}
                                                className="mt-1.5 bg-black/20 border-white/5"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Default Timeframe</Label>
                                            <Input
                                                type="text"
                                                defaultValue={settings?.defaultTimeframe || '1H'}
                                                onChange={(e) => updateSettings({ defaultTimeframe: e.target.value })}
                                                className="mt-1.5 bg-black/20 border-white/5"
                                            />
                                        </div>
                                    </div>
                                    <Separator className="bg-white/5" />
                                    <div>
                                        <h4 className="text-sm font-medium mb-3">Preferences</h4>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                defaultChecked={settings?.autoSave ?? true}
                                                onChange={(e) => updateSettings({ autoSave: e.target.checked })}
                                                className="rounded"
                                            />
                                            <span className="text-sm">Auto-save strategies</span>
                                        </label>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>

                    {/* Brokers & Integrations */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <Card className="bg-card/60 backdrop-blur-sm border-white/5 shadow-trading rounded-xl">
                            <CardHeader className="pb-4 border-b border-white/5">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Wallet className="w-4 h-4 text-green-400" />
                                    Brokers & Integrations
                                </CardTitle>
                                <CardDescription>Connect your trading accounts and external services.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div>
                                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                                        <Wallet className="w-3.5 h-3.5 text-green-400" />
                                        Trading Brokers
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {BROKERS.map((broker) => (
                                            <div
                                                key={broker.id}
                                                className="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-white/5"
                                            >
                                                <img
                                                    src={broker.logo}
                                                    alt={broker.name}
                                                    className="w-10 h-10 rounded object-contain bg-white/5 p-1"
                                                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm truncate">{broker.name}</div>
                                                    <div className="text-xs text-muted-foreground">{broker.description}</div>
                                                </div>
                                                {brokerConnections[broker.id] ? (
                                                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 shrink-0">
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Connected
                                                    </Badge>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleConnectBroker(broker.id)}
                                                        className="border-white/10 text-xs shrink-0"
                                                    >
                                                        Connect
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Separator className="bg-white/5" />

                                <div>
                                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                                        <Link2 className="w-3.5 h-3.5 text-purple-400" />
                                        Integrations
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {CONNECTORS.map((connector) => (
                                            <div
                                                key={connector.id}
                                                className="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-white/5"
                                            >
                                                <img
                                                    src={connector.logo}
                                                    alt={connector.name}
                                                    className="w-10 h-10 rounded object-contain bg-white/5 p-1"
                                                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm truncate">{connector.name}</div>
                                                    <div className="text-xs text-muted-foreground">{connector.description}</div>
                                                </div>
                                                <Button size="sm" variant="outline" className="border-white/10 text-xs shrink-0">
                                                    Setup
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Danger Zone */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
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
                </main>
            </div>

            {selectedBroker && (
                <BrokerConnectionModal
                    open={!!selectedBroker}
                    onOpenChange={(open) => !open && setSelectedBroker(null)}
                    brokerId={selectedBroker.id}
                    brokerName={selectedBroker.name}
                    onConnected={() => {
                        setBrokerConnections(prev => ({ ...prev, [selectedBroker.id]: true }));
                    }}
                />
            )}
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
