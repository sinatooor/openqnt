/**
 * Settings Page
 * General account settings, trading defaults, broker connections, and preferences.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUserProfile } from '../hooks/useUserProfile';
import { motion } from 'framer-motion';
import { ConfigProvider, theme as antTheme } from 'antd';
import { toast } from 'sonner';
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
    Database,
    RefreshCw,
    Loader2,
    Settings as SettingsIcon,
    Palette,
    Sun,
    Moon,
    Eye,
    Terminal as TerminalIcon,
    Monitor,
} from 'lucide-react';
import { useTheme, type Theme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { BrokerConnectionModal } from '@/features/strategy-flow/components/modals/BrokerConnectionModal';
import { PAGE_CONTENT_CLASS } from '@/components/PageHeader';
import { AvanzaConnectModal } from '@/integrations/avanza/AvanzaConnectModal';
import { avanzaApi } from '@/integrations/avanza/api';
import { useIntegrationsStore } from '@/stores/integrationsStore';
import {
    MARKET_DATA_SOURCES,
    useDataSourceStore,
    type MarketDataSource,
} from '@/stores/dataSourceStore';

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

interface ThemeOption {
    id: Theme;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    swatch: { bg: string; card: string; primary: string };
}

const THEME_OPTIONS: ThemeOption[] = [
    {
        id: 'dark',
        label: 'Dark',
        description: 'Webull-inspired deep dark — the default.',
        icon: Moon,
        swatch: { bg: 'hsl(0 0% 4%)', card: 'hsl(0 0% 7%)', primary: 'hsl(217 91% 60%)' },
    },
    {
        id: 'light',
        label: 'Light',
        description: 'Clean daylight reading.',
        icon: Sun,
        swatch: { bg: 'hsl(0 0% 100%)', card: 'hsl(220 14% 96%)', primary: 'hsl(217 91% 50%)' },
    },
    {
        id: 'hicontrast',
        label: 'High Contrast',
        description: 'Pure black & white, AAA-accessible.',
        icon: Eye,
        swatch: { bg: 'hsl(0 0% 0%)', card: 'hsl(0 0% 8%)', primary: 'hsl(60 100% 60%)' },
    },
    {
        id: 'bloomberg',
        label: 'Bloomberg',
        description: 'Terminal amber on near-black.',
        icon: TerminalIcon,
        swatch: { bg: 'hsl(40 100% 2%)', card: 'hsl(40 60% 4%)', primary: 'hsl(36 100% 55%)' },
    },
    {
        id: 'system',
        label: 'System',
        description: 'Follow OS preference.',
        icon: Monitor,
        swatch: { bg: 'linear-gradient(90deg, hsl(0 0% 4%) 50%, hsl(0 0% 100%) 50%)', card: 'hsl(0 0% 50%)', primary: 'hsl(217 91% 55%)' },
    },
];

const Settings = () => {
    const { user, logout, isAuthenticated } = useAuthStore();
    const { settings, updateSettings } = useUserProfile();
    const navigate = useNavigate();
    const [brokerConnections, setBrokerConnections] = useState<Record<string, boolean>>({});
    const [selectedBroker, setSelectedBroker] = useState<{ id: string; name: string } | null>(null);
    const [avanzaModalOpen, setAvanzaModalOpen] = useState(false);
    const [syncingAvanza, setSyncingAvanza] = useState(false);
    const avanzaState = useIntegrationsStore((s) => s.integrations.avanza);
    const setIntegrationStatus = useIntegrationsStore((s) => s.setStatus);
    const dataSource = useDataSourceStore((s) => s.source);
    const setDataSource = useDataSourceStore((s) => s.setSource);
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        let cancelled = false;
        avanzaApi
            .status()
            .then((status) => {
                if (cancelled) return;
                setIntegrationStatus('avanza', {
                    status: status.connected ? 'connected' : 'disconnected',
                    connectedAt: status.connectedAt ? Date.parse(status.connectedAt) : null,
                    lastSyncAt: status.lastSyncAt ? Date.parse(status.lastSyncAt) : null,
                    lastError: status.error,
                });
            })
            .catch(() => {/* leave whatever the bootstrap hook stored */});
        return () => { cancelled = true; };
    }, [setIntegrationStatus]);

    if (!isAuthenticated) {
        navigate('/login');
        return null;
    }

    const handleConnectBroker = (brokerId: string) => {
        if (brokerId === 'avanza') {
            setAvanzaModalOpen(true);
            return;
        }
        const broker = BROKERS.find(b => b.id === brokerId);
        if (broker) {
            setSelectedBroker({ id: broker.id, name: broker.name });
        }
    };

    const handleAvanzaSync = async () => {
        setSyncingAvanza(true);
        try {
            const result = await avanzaApi.sync();
            setIntegrationStatus('avanza', {
                lastSyncAt: Date.parse(result.syncedAt),
                lastError: null,
            });
            toast.success(
                `Avanza synced: ${result.positions} positions, ${result.watchlists} watchlists, ${result.transactions} transactions`,
            );
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Sync failed';
            setIntegrationStatus('avanza', { lastError: msg });
            toast.error(msg);
        } finally {
            setSyncingAvanza(false);
        }
    };

    const handleAvanzaDisconnect = async () => {
        try {
            await avanzaApi.disconnect();
            setIntegrationStatus('avanza', {
                status: 'disconnected',
                connectedAt: null,
                lastSyncAt: null,
                lastError: null,
            });
            toast.success('Avanza disconnected');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Disconnect failed';
            toast.error(msg);
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
                            onClick={() => navigate('/')}
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

                    {/* Market Data Source */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                        <Card className="bg-card/60 backdrop-blur-sm border-white/5 shadow-trading rounded-xl">
                            <CardHeader className="pb-4 border-b border-white/5">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Database className="w-4 h-4 text-blue-400" />
                                    Market Data Source
                                </CardTitle>
                                <CardDescription>
                                    Where the Terminal screens, charts, and screeners read from.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <RadioGroup
                                    value={dataSource}
                                    onValueChange={(v) => setDataSource(v as MarketDataSource)}
                                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                                >
                                    {MARKET_DATA_SOURCES.map((src) => {
                                        const requiresConnection = src.id === 'avanza';
                                        const disabled = requiresConnection && avanzaState.status !== 'connected';
                                        return (
                                            <label
                                                key={src.id}
                                                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                                                    dataSource === src.id
                                                        ? 'border-blue-500/50 bg-blue-500/5'
                                                        : 'border-white/5 bg-black/20 hover:bg-black/30'
                                                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <RadioGroupItem
                                                    value={src.id}
                                                    disabled={disabled}
                                                    className="mt-0.5"
                                                />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">{src.label}</span>
                                                        {disabled && (
                                                            <Badge variant="outline" className="text-[10px] uppercase">
                                                                Connect first
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {src.description}
                                                    </p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </RadioGroup>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Appearance — theme switcher */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }}>
                        <Card className="bg-card/60 backdrop-blur-sm border-white/5 shadow-trading rounded-xl">
                            <CardHeader className="pb-4 border-b border-white/5">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Palette className="w-4 h-4 text-primary" />
                                    Appearance
                                </CardTitle>
                                <CardDescription>
                                    Pick a theme for the entire app — affects every page, panel, and modal.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="flex items-start gap-4 flex-wrap">
                                    <div className="flex-1 min-w-[240px] space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Theme</Label>
                                        <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {THEME_OPTIONS.map((opt) => {
                                                    const Icon = opt.icon;
                                                    return (
                                                        <SelectItem key={opt.id} value={opt.id}>
                                                            <div className="flex items-center gap-2">
                                                                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                                                <span>{opt.label}</span>
                                                            </div>
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                        {(() => {
                                            const active = THEME_OPTIONS.find((o) => o.id === theme);
                                            return active ? (
                                                <p className="text-[11px] text-muted-foreground leading-snug pt-1">
                                                    {active.description}
                                                </p>
                                            ) : null;
                                        })()}
                                    </div>
                                    {(() => {
                                        const active = THEME_OPTIONS.find((o) => o.id === theme);
                                        if (!active) return null;
                                        return (
                                            <div className="flex flex-col gap-1.5 shrink-0">
                                                <Label className="text-xs text-muted-foreground">Preview</Label>
                                                <div
                                                    className="w-32 h-10 rounded-md border border-border/40 overflow-hidden flex"
                                                    aria-hidden
                                                >
                                                    <div className="flex-1" style={{ background: active.swatch.bg }} />
                                                    <div className="flex-1" style={{ background: active.swatch.card }} />
                                                    <div className="flex-1" style={{ background: active.swatch.primary }} />
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

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
                                        {BROKERS.map((broker) => {
                                            const isAvanza = broker.id === 'avanza';
                                            const avanzaConnected = avanzaState.status === 'connected';
                                            const connected = isAvanza
                                                ? avanzaConnected
                                                : !!brokerConnections[broker.id];
                                            const lastSync = isAvanza && avanzaState.lastSyncAt
                                                ? new Date(avanzaState.lastSyncAt).toLocaleString()
                                                : null;
                                            return (
                                                <div
                                                    key={broker.id}
                                                    className="flex flex-col gap-2 p-3 bg-black/20 rounded-lg border border-white/5"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <img
                                                            src={broker.logo}
                                                            alt={broker.name}
                                                            className="w-10 h-10 rounded object-contain bg-white/5 p-1"
                                                            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-sm truncate">{broker.name}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {broker.description}
                                                            </div>
                                                        </div>
                                                        {connected ? (
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
                                                    {isAvanza && avanzaConnected && (
                                                        <div className="flex flex-wrap items-center gap-2 pl-13 text-[11px] text-muted-foreground">
                                                            <span>
                                                                {lastSync ? `Last sync: ${lastSync}` : 'Never synced'}
                                                            </span>
                                                            {avanzaState.lastError && (
                                                                <span className="text-red-400">
                                                                    · {avanzaState.lastError}
                                                                </span>
                                                            )}
                                                            <span className="ml-auto flex gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-6 text-[11px] border-white/10"
                                                                    onClick={handleAvanzaSync}
                                                                    disabled={syncingAvanza}
                                                                >
                                                                    {syncingAvanza ? (
                                                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                    ) : (
                                                                        <RefreshCw className="w-3 h-3 mr-1" />
                                                                    )}
                                                                    Sync now
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-6 text-[11px] border-red-500/20 text-red-400 hover:bg-red-500/10"
                                                                    onClick={handleAvanzaDisconnect}
                                                                >
                                                                    Disconnect
                                                                </Button>
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
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

            <AvanzaConnectModal
                open={avanzaModalOpen}
                onOpenChange={setAvanzaModalOpen}
                onConnected={() => {
                    void avanzaApi.sync().catch(() => {/* surfaces in toast separately */});
                }}
            />
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
