/**
 * Settings — compact, finance-app layout.
 *
 * Left rail with section anchors, right column with terse label/value rows.
 * Hosts the account-scope picker (previously in the navbar) under "Accounts".
 */

import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUserProfile } from '../hooks/useUserProfile';
import { toast } from 'sonner';
import {
    User,
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
    Briefcase,
    Settings2,
    Palette,
    Sun,
    Moon,
    Eye,
    Terminal as TerminalIcon,
    Monitor,
    SlidersHorizontal,
    AlertTriangle,
    ChevronRight,
    KeyRound,
    Phone,
    UserCircle,
} from 'lucide-react';
import { ApiKeysPanel } from '@/features/settings/ApiKeysPanel';
import { ProfilePanel } from '@/features/settings/ProfilePanel';
import { VoicePanel } from '@/features/settings/VoicePanel';
import { CredentialsPanel } from '@/features/settings/CredentialsPanel';
import { useTheme, type Theme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { BrokerConnectionModal } from '@/features/strategy-flow/components/modals/BrokerConnectionModal';
import { PAGE_CONTENT_CLASS } from '@/components/PageHeader';
import { AvanzaConnectModal } from '@/integrations/avanza/AvanzaConnectModal';
import { avanzaApi } from '@/integrations/avanza/api';
import { IBKRConnectModal } from '@/integrations/ibkr/IBKRConnectModal';
import { ibkrApi } from '@/integrations/ibkr/api';
import { useIntegrationsStore } from '@/stores/integrationsStore';
import {
    MARKET_DATA_SOURCES,
    useDataSourceStore,
    type MarketDataSource,
} from '@/stores/dataSourceStore';
import { useAccountStore, ACCOUNT_TYPE_LABELS } from '@/stores/accountStore';
import { AccountManagerDialog } from '@/components/AccountManagerDialog';

const BROKERS = [
    { id: 'ig',         name: 'IG Markets',          description: 'CFD trading',         logo: '/logo/logo_ig.png' },
    { id: 'icmarkets',  name: 'IC Markets',          description: 'Forex & CFDs',        logo: '/logo/logo_icmarkets.png' },
    { id: 'ibkr',       name: 'Interactive Brokers', description: 'Global markets',      logo: '/logo/interactivebrokers.png' },
    { id: 'nordnet',    name: 'Nordnet',             description: 'Nordic broker',       logo: '/logo/nordnet.png' },
    { id: 'avanza',     name: 'Avanza',              description: 'Swedish stockbroker', logo: '/logo/avanza.png' },
    { id: 'etoro',      name: 'eToro',               description: 'Social trading',      logo: '/logo/logo_etoro.png' },
];

const CONNECTORS = [
    { id: 'tradingview', name: 'TradingView',  description: 'Charting & alerts',     logo: '/logo/logo_tradingview.webp' },
    { id: 'discord',     name: 'Discord Bot',  description: 'Notifications',         logo: '/logo/logo_discord_small.png' },
    { id: 'n8n',         name: 'n8n',          description: 'Workflow automation',   logo: '/logo/logo_n8n.png' },
];

interface ThemeOption {
    id: Theme;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    swatch: { bg: string; card: string; primary: string };
}

const THEME_OPTIONS: ThemeOption[] = [
    { id: 'dark',       label: 'Dark',          description: 'Webull-inspired deep dark.',         icon: Moon,         swatch: { bg: 'hsl(0 0% 4%)',     card: 'hsl(0 0% 7%)',    primary: 'hsl(217 91% 60%)' } },
    { id: 'light',      label: 'Light',         description: 'Editorial fintech in white.',        icon: Sun,          swatch: { bg: 'hsl(210 33% 98%)', card: 'hsl(0 0% 100%)',  primary: 'hsl(221 100% 39%)' } },
    { id: 'hicontrast', label: 'High Contrast', description: 'Pure black & white, AAA.',           icon: Eye,          swatch: { bg: 'hsl(0 0% 0%)',     card: 'hsl(0 0% 8%)',    primary: 'hsl(60 100% 60%)' } },
    { id: 'bloomberg',  label: 'Bloomberg',     description: 'Charcoal with electric orange.',     icon: TerminalIcon, swatch: { bg: 'hsl(204 9% 11%)',  card: 'hsl(204 6% 15%)', primary: 'hsl(21 100% 53%)' } },
    { id: 'system',     label: 'System',        description: 'Follow OS preference.',              icon: Monitor,      swatch: { bg: 'linear-gradient(90deg, hsl(0 0% 4%) 50%, hsl(0 0% 100%) 50%)', card: 'hsl(0 0% 50%)', primary: 'hsl(217 91% 55%)' } },
];

interface SectionDef {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: SectionDef[] = [
    { id: 'profile',     label: 'Profile',         icon: UserCircle },
    { id: 'account',     label: 'Account',         icon: Shield },
    { id: 'accounts',    label: 'Accounts',        icon: Briefcase },
    { id: 'api-keys',    label: 'API Keys',        icon: KeyRound },
    { id: 'trading',     label: 'Trading',         icon: SlidersHorizontal },
    { id: 'data-source', label: 'Market data',     icon: Database },
    { id: 'appearance',  label: 'Appearance',      icon: Palette },
    { id: 'brokers',     label: 'Brokers',         icon: Wallet },
    { id: 'connectors',  label: 'Connectors',      icon: Link2 },
    { id: 'voice',       label: 'Voice',           icon: Phone },
    { id: 'danger',      label: 'Danger zone',     icon: AlertTriangle },
];

const ALL_SCOPE = '__all__';

const Settings = () => {
    const { user, logout, isAuthenticated } = useAuthStore();
    const { settings, updateSettings } = useUserProfile();
    const navigate = useNavigate();
    const [brokerConnections, setBrokerConnections] = useState<Record<string, boolean>>({});
    const [selectedBroker, setSelectedBroker] = useState<{ id: string; name: string } | null>(null);
    const [avanzaModalOpen, setAvanzaModalOpen] = useState(false);
    const [syncingAvanza, setSyncingAvanza] = useState(false);
    const [ibkrModalOpen, setIbkrModalOpen] = useState(false);
    const [syncingIbkr, setSyncingIbkr] = useState(false);
    const [accountManagerOpen, setAccountManagerOpen] = useState(false);
    const [activeSection, setActiveSection] = useState<string>('account');
    const avanzaState = useIntegrationsStore((s) => s.integrations.avanza);
    const ibkrState = useIntegrationsStore((s) => s.integrations.ibkr);
    const setIntegrationStatus = useIntegrationsStore((s) => s.setStatus);
    const dataSource = useDataSourceStore((s) => s.source);
    const setDataSource = useDataSourceStore((s) => s.setSource);
    const { theme, setTheme } = useTheme();

    // Subscribe to the raw array reference; filter via useMemo so the
    // snapshot returned by Zustand is stable across renders. A selector that
    // returns a fresh `[].filter(...)` every call trips
    // useSyncExternalStore's equality check and infinite-loops.
    const allAccounts = useAccountStore((s) => s.accounts);
    const accounts = useMemo(
        () => allAccounts.filter((a) => !a.archived),
        [allAccounts],
    );
    const activeAccountId = useAccountStore((s) => s.activeAccountId);
    const setActiveAccount = useAccountStore((s) => s.setActiveAccount);
    const activeAccount = activeAccountId
        ? accounts.find((a) => a.id === activeAccountId)
        : null;

    // Track section in view via IntersectionObserver so the rail highlights
    // the section the user is reading.
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
    useEffect(() => {
        const obs = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                if (visible) setActiveSection(visible.target.id);
            },
            { rootMargin: '-30% 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
        );
        SECTIONS.forEach((s) => {
            const el = sectionRefs.current[s.id];
            if (el) obs.observe(el);
        });
        return () => obs.disconnect();
    }, []);

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
            .catch(() => { /* leave whatever the bootstrap hook stored */ });
        ibkrApi
            .status()
            .then((status) => {
                if (cancelled) return;
                setIntegrationStatus('ibkr', {
                    status: status.connected ? 'connected' : 'disconnected',
                    connectedAt: status.connectedAt ? Date.parse(status.connectedAt) : null,
                    lastSyncAt: status.lastSyncAt ? Date.parse(status.lastSyncAt) : null,
                    lastError: status.error,
                });
            })
            .catch(() => { /* TWS likely offline */ });
        return () => { cancelled = true; };
    }, [setIntegrationStatus]);

    if (!isAuthenticated) {
        navigate('/login');
        return null;
    }

    const handleConnectBroker = (brokerId: string) => {
        if (brokerId === 'avanza') { setAvanzaModalOpen(true); return; }
        if (brokerId === 'ibkr') { setIbkrModalOpen(true); return; }
        const broker = BROKERS.find((b) => b.id === brokerId);
        if (broker) setSelectedBroker({ id: broker.id, name: broker.name });
    };

    const handleIbkrSync = async () => {
        setSyncingIbkr(true);
        try {
            const result = await ibkrApi.sync();
            setIntegrationStatus('ibkr', {
                lastSyncAt: Date.parse(result.syncedAt),
                lastError: null,
            });
            toast.success(
                `IBKR synced: ${result.positions} positions, equity ${result.equity.toFixed(0)} USD`,
            );
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Sync failed';
            setIntegrationStatus('ibkr', { lastError: msg });
            toast.error(msg);
        } finally {
            setSyncingIbkr(false);
        }
    };

    const handleIbkrDisconnect = async () => {
        try {
            await ibkrApi.disconnect();
            setIntegrationStatus('ibkr', {
                status: 'disconnected',
                connectedAt: null,
                lastSyncAt: null,
                lastError: null,
            });
            toast.success('Disconnected from IBKR');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Disconnect failed');
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
        <div className="min-h-screen bg-background text-foreground flex flex-col pt-14">
            <main className={`flex-1 ${PAGE_CONTENT_CLASS} px-6 pb-12`}>
                {/* Page header */}
                <div className="flex items-baseline gap-3 py-5 border-b border-border/60">
                    <Settings2 className="w-4 h-4 text-muted-foreground self-center" />
                    <h1 className="text-foreground text-base font-medium tracking-tight">Settings</h1>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                        {user?.email ?? 'no account'}
                    </span>
                    <span className="ml-auto text-[11px] text-muted-foreground font-mono">
                        {activeAccount ? activeAccount.name : 'All accounts'}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 pt-6">
                    {/* ── Section rail ─────────────────────────────────── */}
                    <aside className="hidden md:block sticky top-20 self-start">
                        <ul className="text-[12px] space-y-0.5">
                            {SECTIONS.map((s) => {
                                const Icon = s.icon;
                                const active = activeSection === s.id;
                                return (
                                    <li key={s.id}>
                                        <a
                                            href={`#${s.id}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                sectionRefs.current[s.id]?.scrollIntoView({
                                                    behavior: 'smooth',
                                                    block: 'start',
                                                });
                                                setActiveSection(s.id);
                                            }}
                                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
                                                active
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]'
                                            }`}
                                        >
                                            <Icon className="w-3.5 h-3.5" />
                                            <span>{s.label}</span>
                                            {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    </aside>

                    {/* ── Content column ───────────────────────────────── */}
                    <div className="space-y-10 max-w-3xl">
                        {/* Profile (moved from former ProfileModal in the nav) */}
                        <Section
                            id="profile"
                            title="Profile"
                            description="Sign-in identity and your saved-work stats."
                            innerRef={(el) => (sectionRefs.current.profile = el)}
                        >
                            <ProfilePanel />
                        </Section>

                        {/* Account */}
                        <Section
                            id="account"
                            title="Account"
                            description="Identity and access tier."
                            innerRef={(el) => (sectionRefs.current.account = el)}
                        >
                            <Row label="Name" icon={User}>
                                <span className="text-foreground">{user?.name ?? '—'}</span>
                            </Row>
                            <Row label="Email" icon={Mail}>
                                <span className="text-foreground font-mono text-[12px]">
                                    {user?.email ?? '—'}
                                </span>
                            </Row>
                            <Row label="Subscription" icon={CreditCard}>
                                <Badge
                                    variant="outline"
                                    className={`uppercase tracking-wider text-[10px] ${getTierClass(user?.subscriptionTier)}`}
                                >
                                    {user?.subscriptionTier ?? 'free'}
                                </Badge>
                            </Row>
                        </Section>

                        {/* Accounts (scope picker, was in the nav) */}
                        <Section
                            id="accounts"
                            title="Accounts"
                            description="Choose which account drives the dashboard, portfolio, and execution scope."
                            innerRef={(el) => (sectionRefs.current.accounts = el)}
                        >
                            <Row label="Active scope" icon={Briefcase}>
                                <select
                                    value={activeAccountId ?? ALL_SCOPE}
                                    onChange={(e) =>
                                        setActiveAccount(e.target.value === ALL_SCOPE ? null : e.target.value)
                                    }
                                    className="h-7 bg-muted/40 border border-border/60 rounded-md px-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/40 min-w-[200px]"
                                >
                                    <option value={ALL_SCOPE}>All accounts (aggregate)</option>
                                    {accounts.length > 0 && (
                                        <optgroup label="Accounts">
                                            {accounts.map((a) => (
                                                <option key={a.id} value={a.id}>
                                                    {a.name} — {ACCOUNT_TYPE_LABELS[a.type]}
                                                    {a.last4 ? ` ··${a.last4}` : ''}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </Row>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                                <div className="text-[11px] text-muted-foreground">
                                    {accounts.length === 0 && 'No accounts yet — add one to start scoping.'}
                                    {accounts.length > 0 && (
                                        <>
                                            <span className="font-mono text-foreground">{accounts.length}</span>
                                            {' '}account{accounts.length === 1 ? '' : 's'} configured.
                                        </>
                                    )}
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-[11px] border-border/60"
                                        onClick={() => setAccountManagerOpen(true)}
                                    >
                                        <Settings2 className="w-3 h-3 mr-1" />
                                        Manage accounts
                                    </Button>
                                </div>
                            </div>
                        </Section>

                        {/* API Keys (encrypted via OS keychain in desktop builds) */}
                        <Section
                            id="api-keys"
                            title="API Keys"
                            description="LLM, broker, and data-feed credentials. Stored encrypted in your OS keychain."
                            innerRef={(el) => (sectionRefs.current['api-keys'] = el)}
                        >
                            <ApiKeysPanel />
                        </Section>

                        {/* Trading defaults */}
                        <Section
                            id="trading"
                            title="Trading"
                            description="Defaults applied to new strategies and the symbol palette."
                            innerRef={(el) => (sectionRefs.current.trading = el)}
                        >
                            <Row label="Default symbol">
                                <Input
                                    type="text"
                                    defaultValue={settings?.defaultSymbol || 'EURUSD'}
                                    onChange={(e) => updateSettings({ defaultSymbol: e.target.value })}
                                    className="h-7 w-32 bg-muted/40 border-border/60 text-[12px]"
                                />
                            </Row>
                            <Row label="Default timeframe">
                                <Input
                                    type="text"
                                    defaultValue={settings?.defaultTimeframe || '1H'}
                                    onChange={(e) => updateSettings({ defaultTimeframe: e.target.value })}
                                    className="h-7 w-32 bg-muted/40 border-border/60 text-[12px]"
                                />
                            </Row>
                            <Row label="Auto-save strategies">
                                <input
                                    type="checkbox"
                                    defaultChecked={settings?.autoSave ?? true}
                                    onChange={(e) => updateSettings({ autoSave: e.target.checked })}
                                    className="rounded h-3.5 w-3.5 cursor-pointer"
                                />
                            </Row>
                        </Section>

                        {/* Market Data Source */}
                        <Section
                            id="data-source"
                            title="Market data"
                            description="Where Terminal screens, charts, and screeners read prices from."
                            innerRef={(el) => (sectionRefs.current['data-source'] = el)}
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {MARKET_DATA_SOURCES.map((src) => {
                                    const requiresConnection = src.id === 'avanza';
                                    const disabled = requiresConnection && avanzaState.status !== 'connected';
                                    const active = dataSource === src.id;
                                    return (
                                        <button
                                            key={src.id}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => setDataSource(src.id as MarketDataSource)}
                                            className={`text-left flex flex-col gap-0.5 p-2.5 rounded-md border text-[12px] transition-colors ${
                                                active
                                                    ? 'border-primary/60 bg-primary/5'
                                                    : 'border-border/60 bg-white/[0.02] hover:bg-white/[0.04]'
                                            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium">{src.label}</span>
                                                {disabled && (
                                                    <Badge variant="outline" className="text-[9px] uppercase">
                                                        Connect
                                                    </Badge>
                                                )}
                                                {active && !disabled && (
                                                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                                                )}
                                            </div>
                                            <span className="text-[11px] text-muted-foreground">
                                                {src.description}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </Section>

                        {/* Appearance */}
                        <Section
                            id="appearance"
                            title="Appearance"
                            description="Theme applied to every page, panel, and modal."
                            innerRef={(el) => (sectionRefs.current.appearance = el)}
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {THEME_OPTIONS.map((opt) => {
                                    const Icon = opt.icon;
                                    const active = theme === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setTheme(opt.id)}
                                            className={`flex items-center gap-2.5 p-2 rounded-md border text-[12px] transition-colors ${
                                                active
                                                    ? 'border-primary/60 bg-primary/5'
                                                    : 'border-border/60 bg-white/[0.02] hover:bg-white/[0.04]'
                                            }`}
                                        >
                                            <div
                                                className="w-8 h-8 rounded-md border border-border/60 overflow-hidden flex shrink-0"
                                                aria-hidden
                                            >
                                                <div className="flex-1" style={{ background: opt.swatch.bg }} />
                                                <div className="flex-1" style={{ background: opt.swatch.card }} />
                                                <div className="flex-1" style={{ background: opt.swatch.primary }} />
                                            </div>
                                            <div className="text-left flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <Icon className="w-3 h-3 text-muted-foreground" />
                                                    <span className="font-medium">{opt.label}</span>
                                                </div>
                                                <span className="text-[10.5px] text-muted-foreground line-clamp-1">
                                                    {opt.description}
                                                </span>
                                            </div>
                                            {active && <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </Section>

                        {/* Brokers */}
                        <Section
                            id="brokers"
                            title="Brokers"
                            description="Live trading and portfolio sync. Connect once per broker."
                            innerRef={(el) => (sectionRefs.current.brokers = el)}
                        >
                            <ul className="divide-y divide-border/60 border border-border/60 rounded-md overflow-hidden">
                                {BROKERS.map((broker) => {
                                    const isAvanza = broker.id === 'avanza';
                                    const isIbkr = broker.id === 'ibkr';
                                    const avanzaConnected = avanzaState.status === 'connected';
                                    const ibkrConnected = ibkrState.status === 'connected';
                                    const connected = isAvanza
                                        ? avanzaConnected
                                        : isIbkr
                                            ? ibkrConnected
                                            : !!brokerConnections[broker.id];
                                    const lastSync = isAvanza && avanzaState.lastSyncAt
                                        ? new Date(avanzaState.lastSyncAt).toLocaleString()
                                        : isIbkr && ibkrState.lastSyncAt
                                            ? new Date(ibkrState.lastSyncAt).toLocaleString()
                                            : null;
                                    const brokerErr = isAvanza
                                        ? avanzaState.lastError
                                        : isIbkr
                                            ? ibkrState.lastError
                                            : null;
                                    return (
                                        <li key={broker.id} className="px-3 py-2 bg-white/[0.01]">
                                            <div className="flex items-center gap-3">
                                                <BrokerLogo logo={broker.logo} name={broker.name} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-[12.5px] truncate">
                                                        {broker.name}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground truncate">
                                                        {broker.description}
                                                    </div>
                                                </div>
                                                {connected ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="bg-green-500/10 text-green-400 border-green-500/30 shrink-0 text-[10px]"
                                                    >
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Connected
                                                    </Badge>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleConnectBroker(broker.id)}
                                                        className="h-7 text-[11px] border-border/60 shrink-0"
                                                    >
                                                        Connect
                                                    </Button>
                                                )}
                                            </div>
                                            {isAvanza && avanzaConnected && (
                                                <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-9 text-[11px] text-muted-foreground">
                                                    <span className="font-mono">
                                                        {lastSync ? `last sync ${lastSync}` : 'never synced'}
                                                    </span>
                                                    {avanzaState.lastError && (
                                                        <span className="text-red-400">· {avanzaState.lastError}</span>
                                                    )}
                                                    <span className="ml-auto flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-[10.5px] border-border/60"
                                                            onClick={handleAvanzaSync}
                                                            disabled={syncingAvanza}
                                                        >
                                                            {syncingAvanza ? (
                                                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                            ) : (
                                                                <RefreshCw className="w-3 h-3 mr-1" />
                                                            )}
                                                            Sync
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-[10.5px] border-red-500/20 text-red-400 hover:bg-red-500/10"
                                                            onClick={handleAvanzaDisconnect}
                                                        >
                                                            Disconnect
                                                        </Button>
                                                    </span>
                                                </div>
                                            )}
                                            {isIbkr && ibkrConnected && (
                                                <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-9 text-[11px] text-muted-foreground">
                                                    <span className="font-mono">
                                                        {lastSync ? `last sync ${lastSync}` : 'never synced'}
                                                    </span>
                                                    {brokerErr && (
                                                        <span className="text-red-400">· {brokerErr}</span>
                                                    )}
                                                    <span className="ml-auto flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-[10.5px] border-border/60"
                                                            onClick={handleIbkrSync}
                                                            disabled={syncingIbkr}
                                                        >
                                                            {syncingIbkr ? (
                                                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                            ) : (
                                                                <RefreshCw className="w-3 h-3 mr-1" />
                                                            )}
                                                            Sync
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-[10.5px] border-red-500/20 text-red-400 hover:bg-red-500/10"
                                                            onClick={handleIbkrDisconnect}
                                                        >
                                                            Disconnect
                                                        </Button>
                                                    </span>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>

                            {/* Server-side encrypted credential vault for live execution
                                (Alpaca, IG, IBKR, Nordnet). Distinct from API Keys
                                above which holds LLM / data-feed keys in the OS
                                keychain on this device. */}
                            <div className="mt-6 pt-6 border-t border-border/40">
                                <CredentialsPanel />
                            </div>
                        </Section>

                        {/* Connectors */}
                        <Section
                            id="connectors"
                            title="Connectors"
                            description="External services for charts, alerts, and workflow automation."
                            innerRef={(el) => (sectionRefs.current.connectors = el)}
                        >
                            <ul className="divide-y divide-border/60 border border-border/60 rounded-md overflow-hidden">
                                {CONNECTORS.map((c) => (
                                    <li
                                        key={c.id}
                                        className="px-3 py-2 bg-white/[0.01] flex items-center gap-3"
                                    >
                                        <BrokerLogo logo={c.logo} name={c.name} />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-[12.5px] truncate">{c.name}</div>
                                            <div className="text-[11px] text-muted-foreground truncate">
                                                {c.description}
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-[11px] border-border/60 shrink-0"
                                        >
                                            Setup
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </Section>

                        {/* Voice + notifications (phone, passphrase, Telegram chat ID, iOS pairing) */}
                        <Section
                            id="voice"
                            title="Voice & Notifications"
                            description="Phone, voice passphrase, Telegram chat ID, iOS pairing, voice-trading toggle."
                            innerRef={(el) => (sectionRefs.current.voice = el)}
                        >
                            <VoicePanel />
                        </Section>

                        {/* Danger zone */}
                        <Section
                            id="danger"
                            title="Danger zone"
                            description="Irreversible operations."
                            innerRef={(el) => (sectionRefs.current.danger = el)}
                            tone="danger"
                        >
                            <Row label="Sign out">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-7 text-[11px] bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 gap-1.5"
                                    onClick={() => { logout(); navigate('/login'); }}
                                >
                                    <LogOut className="w-3 h-3" />
                                    Sign out
                                </Button>
                            </Row>
                        </Section>
                    </div>
                </div>
            </main>

            {selectedBroker && (
                <BrokerConnectionModal
                    open={!!selectedBroker}
                    onOpenChange={(open) => !open && setSelectedBroker(null)}
                    brokerId={selectedBroker.id}
                    brokerName={selectedBroker.name}
                    onConnected={() => {
                        setBrokerConnections((prev) => ({ ...prev, [selectedBroker.id]: true }));
                    }}
                />
            )}

            <AvanzaConnectModal
                open={avanzaModalOpen}
                onOpenChange={setAvanzaModalOpen}
                onConnected={() => {
                    void avanzaApi.sync().catch(() => { /* surfaced via toast */ });
                }}
            />

            <IBKRConnectModal
                open={ibkrModalOpen}
                onOpenChange={setIbkrModalOpen}
                onConnected={() => {
                    void ibkrApi.sync().catch(() => { /* TWS may still be syncing — surfaced via toast */ });
                }}
            />

            <Dialog open={accountManagerOpen} onOpenChange={setAccountManagerOpen}>
                <AccountManagerDialog onClose={() => setAccountManagerOpen(false)} />
            </Dialog>
        </div>
    );
};

// ── Layout primitives ─────────────────────────────────────────────────

interface SectionProps {
    id: string;
    title: string;
    description?: string;
    children: ReactNode;
    innerRef?: (el: HTMLElement | null) => void;
    tone?: 'default' | 'danger';
}

function Section({ id, title, description, children, innerRef, tone = 'default' }: SectionProps) {
    return (
        <section
            id={id}
            ref={innerRef as never}
            className="scroll-mt-24"
        >
            <div className={`flex items-baseline gap-3 pb-2 mb-3 border-b ${
                tone === 'danger' ? 'border-red-500/20' : 'border-border/60'
            }`}>
                <h2 className={`text-[13px] font-medium uppercase tracking-wider ${
                    tone === 'danger' ? 'text-red-400' : 'text-foreground'
                }`}>
                    {title}
                </h2>
                {description && (
                    <span className="text-[11px] text-muted-foreground">{description}</span>
                )}
            </div>
            <div className="space-y-2">{children}</div>
        </section>
    );
}

interface RowProps {
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    children: ReactNode;
}

function Row({ label, icon: Icon, children }: RowProps) {
    return (
        <div className="flex items-center justify-between gap-4 py-1.5 border-b border-border/30">
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground min-w-0">
                {Icon && <Icon className="w-3 h-3" />}
                <span className="truncate">{label}</span>
            </span>
            <div className="text-[12px] flex-shrink-0">{children}</div>
        </div>
    );
}

function BrokerLogo({ logo, name }: { logo: string; name: string }) {
    return (
        <div className="w-8 h-8 rounded-md bg-white border border-border/60 shrink-0 flex items-center justify-center overflow-hidden">
            <img
                src={logo}
                alt={name}
                className="max-w-[80%] max-h-[80%] object-contain"
                onError={(e) => {
                    const t = e.target as HTMLImageElement;
                    t.style.display = 'none';
                    if (t.parentElement) {
                        t.parentElement.textContent = name.slice(0, 2).toUpperCase();
                        t.parentElement.classList.add('text-foreground', 'font-bold', 'text-[10px]');
                    }
                }}
            />
        </div>
    );
}

function getTierClass(tier?: string): string {
    switch (tier) {
        case 'pro': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
        case 'starter': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
        case 'wealth_manager': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
}

export default Settings;
