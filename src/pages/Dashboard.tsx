/**
 * Dashboard — agentic finance command centre.
 *
 * Layout:
 *   1. Hero block: greeting, market session pill, "Ask AI" entry, mode
 *      toggle, kill switch.
 *   2. Daily Briefing — at-a-glance AI summary with bullets.
 *   3. KPI strip: Total P&L proxy / Strategies / Agents / Pending signals.
 *   4. Two-column main:
 *        Left: Active Agents grid + Strategies table + Activity timeline.
 *        Right: Today's signals (approvals), Markets watchlist, System health.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    ArrowRight,
    ArrowUpRight,
    ArrowDownRight,
    Bot,
    Briefcase,
    Check,
    CheckCircle2,
    Clock,
    Code2,
    ExternalLink,
    Layers,
    Loader2,
    LayoutDashboard,
    LineChart,
    Newspaper,
    Play,
    Plus,
    Radio,
    RefreshCw,
    Rocket,
    ShieldCheck,
    Sparkles,
    TrendingUp,
    Wallet,
    X,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { useAppModeStore } from '../stores/appModeStore';
import { usePageContext, usePanelStore } from '@/features/ai-chat';
import {
    useAgentMonitorStore,
    selectAgents,
} from '@/features/agents/store/agentMonitorStore';
import { resolveIcon } from '@/features/agents/components/iconResolver';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const greeting = (name: string) => {
    const hr = new Date().getHours();
    if (hr < 5) return `Working late, ${name}?`;
    if (hr < 12) return `Good morning, ${name}`;
    if (hr < 17) return `Good afternoon, ${name}`;
    if (hr < 22) return `Good evening, ${name}`;
    return `Working late, ${name}?`;
};

interface MarketSession {
    label: string;
    open: boolean;
    detail: string;
}

const marketSession = (): MarketSession => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcDay = now.getUTCDay();
    const isWeekend = utcDay === 0 || utcDay === 6;
    if (isWeekend) {
        return { label: 'Markets closed', open: false, detail: 'Weekend' };
    }
    // US session: 14:30–21:00 UTC (rough)
    if (utcHour >= 14 && utcHour < 21) {
        return { label: 'US session open', open: true, detail: 'NYSE • NASDAQ' };
    }
    if (utcHour >= 7 && utcHour < 16) {
        return { label: 'EU session open', open: true, detail: 'LSE • Euronext' };
    }
    if (utcHour >= 0 && utcHour < 8) {
        return { label: 'Asia session', open: true, detail: 'TSE • HKEX' };
    }
    return { label: 'Markets closed', open: false, detail: 'Pre-open' };
};

const relTime = (ts: number | string | null | undefined): string => {
    if (!ts) return '—';
    const t = typeof ts === 'string' ? Date.parse(ts) : ts;
    if (Number.isNaN(t)) return '—';
    const sec = Math.max(0, (Date.now() - t) / 1000);
    if (sec < 60) return `${sec.toFixed(0)}s ago`;
    const m = Math.floor(sec / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

const fmtMoney = (n: number, digits = 2) =>
    n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

const KpiTile = ({
    label,
    value,
    delta,
    icon: Icon,
    tone = 'default',
    onClick,
}: {
    label: string;
    value: ReactNode;
    delta?: ReactNode;
    icon: LucideIcon;
    tone?: 'default' | 'profit' | 'loss' | 'warn' | 'primary';
    onClick?: () => void;
}) => {
    const toneClass =
        tone === 'profit' ? 'text-profit'
            : tone === 'loss' ? 'text-loss'
                : tone === 'warn' ? 'text-amber-500'
                    : tone === 'primary' ? 'text-primary'
                        : 'text-foreground';
    return (
        <Card
            onClick={onClick}
            className={cn(
                'bg-card border-border/60 transition-colors',
                onClick && 'cursor-pointer hover:border-border',
            )}
        >
            <CardContent className="p-4 flex items-start gap-3">
                <div className={cn('w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0', toneClass)}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {label}
                    </div>
                    <div className={cn('text-2xl font-semibold tabular-nums leading-tight mt-0.5', toneClass)}>
                        {value}
                    </div>
                    {delta && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                            {delta}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

const SectionHeader = ({
    icon: Icon,
    title,
    cta,
    accent,
}: {
    icon: LucideIcon;
    title: string;
    cta?: ReactNode;
    accent?: string;
}) => (
    <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
            <Icon className={cn('w-4 h-4', accent ?? 'text-primary')} />
            <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
        </div>
        {cta}
    </div>
);

interface AgentTileProps {
    agent: ReturnType<typeof selectAgents>[number];
    onClick: () => void;
}

const AgentTile = ({ agent, onClick }: AgentTileProps) => {
    const Icon = resolveIcon(agent.icon);
    const activeRun = useAgentMonitorStore((s) => {
        const rid = s.activeRunIdByAgent[agent.id];
        return rid ? s.runs[rid] : undefined;
    });
    const running = activeRun?.status === 'running';
    return (
        <button
            onClick={onClick}
            className="group text-left flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-card hover:border-border hover:bg-muted/20 transition-colors min-w-0"
        >
            <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{
                    backgroundColor: `${agent.color ?? '#7c3aed'}22`,
                    color: agent.color ?? '#a78bfa',
                }}
            >
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium truncate">{agent.label}</span>
                    {running && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    )}
                </div>
                <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                    {agent.agentType}
                </p>
                <p className="text-[10px] text-muted-foreground/80 mt-1">
                    {agent.lastActive
                        ? `Last active ${relTime(agent.lastActive)}`
                        : `Hired ${relTime(agent.createdAt)}`}
                </p>
            </div>
        </button>
    );
};

const StatusDot = ({ status }: { status: string }) => {
    const cls =
        status === 'success' ? 'bg-profit'
            : status === 'failed' || status === 'error' ? 'bg-loss'
                : status === 'running' ? 'bg-amber-500 animate-pulse'
                    : 'bg-muted-foreground/40';
    return <span className={cn('w-1.5 h-1.5 rounded-full', cls)} />;
};

/* -------------------------------------------------------------------------- */
/*  Main                                                                      */
/* -------------------------------------------------------------------------- */

const Dashboard = () => {
    const { user, isAuthenticated } = useAuthStore();
    const navigate = useNavigate();
    usePageContext({ page: 'dashboard' });

    const { mode, setMode } = useAppModeStore();
    const openAi = usePanelStore((s) => s.toggle);
    const agents = useAgentMonitorStore(useShallow(selectAgents));

    const [stats, setStats] = useState<any>(null);
    const [strategies, setStrategies] = useState<any[]>([]);
    const [recentRuns, setRecentRuns] = useState<any[]>([]);
    const [portfolios, setPortfolios] = useState<any[]>([]);
    const [newsEvents, setNewsEvents] = useState<any[]>([]);
    const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        loadDashboard();
    }, [isAuthenticated]);

    const loadDashboard = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const [statsRes, stratsRes, runsRes, portRes, newsRes, apprRes] = await Promise.allSettled([
                api.getExecutionStats(),
                api.listStrategies(),
                api.listExecutions({ page: 1 }),
                api.getPortfolios(),
                api.listDataEvents({ limit: 8 }),
                api.listPendingApprovals(),
            ]);
            if (statsRes.status === 'fulfilled') setStats(statsRes.value?.stats);
            if (stratsRes.status === 'fulfilled') setStrategies(stratsRes.value?.strategies ?? []);
            if (runsRes.status === 'fulfilled') setRecentRuns(runsRes.value?.runs?.slice(0, 8) ?? []);
            if (portRes.status === 'fulfilled') setPortfolios(portRes.value?.portfolios ?? []);
            if (newsRes.status === 'fulfilled') setNewsEvents(newsRes.value?.events ?? newsRes.value?.dataEvents ?? []);
            if (apprRes.status === 'fulfilled') setPendingApprovals(apprRes.value?.approvals ?? []);
        } catch { /* silent */ }
        setLoading(false);
        setRefreshing(false);
    };

    const session = useMemo(marketSession, []);
    const userName = user?.name ?? user?.email?.split('@')[0] ?? 'Trader';
    const heroGreeting = useMemo(() => greeting(userName), [userName]);

    const activeStrategies = useMemo(
        () => strategies.filter((s: any) => s.status === 'active'),
        [strategies],
    );

    const successRate = stats?.successRate ?? 0;
    const totalRuns = stats?.totalRuns ?? 0;
    const errorRuns = stats?.errorRuns ?? 0;

    const runningAgents = useMemo(() => {
        const runningIds = Object.values(useAgentMonitorStore.getState().runs)
            .filter((r) => r.status === 'running')
            .map((r) => r.agentId);
        return new Set(runningIds);
    }, [agents]);

    /* Watchlist heuristic: portfolio positions, fallback to news symbols */
    const watchItems = useMemo(() => {
        const symbols = new Map<string, { qty: number; price: number; pnl?: number }>();
        portfolios.forEach((p: any) =>
            (p.positions ?? []).forEach((pos: any) => {
                if (!pos.symbol) return;
                symbols.set(pos.symbol, {
                    qty: pos.qty ?? 0,
                    price: pos.last_price ?? pos.lastPrice ?? 0,
                    pnl: pos.unrealised_pnl ?? pos.unrealisedPnl,
                });
            }),
        );
        if (symbols.size === 0) {
            newsEvents.forEach((ev: any) => {
                if (ev.symbol && !symbols.has(ev.symbol)) {
                    symbols.set(ev.symbol, { qty: 0, price: 0 });
                }
            });
        }
        return Array.from(symbols.entries())
            .slice(0, 6)
            .map(([symbol, v]) => ({ symbol, ...v }));
    }, [portfolios, newsEvents]);

    /* Briefing line — synthesised from data we already have */
    const briefingBullets = useMemo(() => {
        const out: string[] = [];
        if (activeStrategies.length > 0) {
            out.push(
                `${activeStrategies.length} strateg${activeStrategies.length === 1 ? 'y is' : 'ies are'} live; success rate ${successRate}%.`,
            );
        } else {
            out.push('No live strategies yet — drop in a template to get started.');
        }
        if (pendingApprovals.length > 0) {
            out.push(`${pendingApprovals.length} signal${pendingApprovals.length === 1 ? '' : 's'} waiting on your approval.`);
        }
        if (newsEvents.length > 0) {
            const bullish = newsEvents.filter((e: any) => e.sentiment === 'bullish').length;
            const bearish = newsEvents.filter((e: any) => e.sentiment === 'bearish').length;
            if (bullish || bearish) {
                out.push(`Overnight news skews ${bullish >= bearish ? 'bullish' : 'bearish'} (${bullish}↑ / ${bearish}↓).`);
            }
        }
        if (errorRuns > 0) {
            out.push(`${errorRuns} run${errorRuns === 1 ? '' : 's'} errored recently — investigate the journal.`);
        }
        return out;
    }, [activeStrategies, successRate, pendingApprovals, newsEvents, errorRuns]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pt-14">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-muted-foreground text-sm">Loading dashboard…</span>
                </div>
            </div>
        );
    }

    return (
        <TooltipProvider delayDuration={200}>
            <div className="min-h-screen bg-background text-foreground pt-14">
                {/* Refresh ribbon */}
                <AnimatePresence>
                    {refreshing && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="h-0.5 w-full overflow-hidden bg-transparent"
                        >
                            <div className="h-full w-1/3 animate-pulse bg-primary" />
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="max-w-[1400px] mx-auto w-full px-4 md:px-6 py-6 space-y-6">
                    {/* ─── Hero ───────────────────────────────────────────── */}
                    <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                <LayoutDashboard className="w-5 h-5 text-primary" />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-xs">
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            'gap-1.5 text-[10px] uppercase tracking-wider',
                                            session.open
                                                ? 'border-profit/30 bg-profit/10 text-profit'
                                                : 'border-muted-foreground/30 bg-muted/30 text-muted-foreground',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'w-1.5 h-1.5 rounded-full',
                                                session.open ? 'bg-profit animate-pulse' : 'bg-muted-foreground/60',
                                            )}
                                        />
                                        {session.label}
                                    </Badge>
                                    <span className="text-muted-foreground">{session.detail}</span>
                                </div>
                                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                                    {heroGreeting}.
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    {activeStrategies.length > 0
                                        ? `${activeStrategies.length} strateg${activeStrategies.length === 1 ? 'y' : 'ies'} live • ${agents.length} agent${agents.length === 1 ? '' : 's'} on staff`
                                        : 'No strategies live yet — let’s get you started.'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <button
                                onClick={() => openAi()}
                                className="group inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-md border border-border bg-card hover:bg-muted/40 transition-colors text-xs"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                                <span className="text-muted-foreground">Ask OpenQnt AI…</span>
                                <kbd className="ml-1 hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 text-[10px] font-mono text-muted-foreground">
                                    ⌘J
                                </kbd>
                            </button>

                            {/* Mode toggle */}
                            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-muted/40 border border-border/60">
                                <button
                                    onClick={() => setMode('demo')}
                                    className={cn(
                                        'px-2.5 py-1 rounded text-[11px] font-medium uppercase tracking-wider transition-colors',
                                        mode === 'demo'
                                            ? 'bg-amber-500/15 text-amber-500'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    Demo
                                </button>
                                <button
                                    onClick={() => setMode('real')}
                                    className={cn(
                                        'px-2.5 py-1 rounded text-[11px] font-medium uppercase tracking-wider transition-colors',
                                        mode === 'real'
                                            ? 'bg-profit/15 text-profit'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    Real
                                </button>
                            </div>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" onClick={() => loadDashboard(true)} className="h-8 w-8">
                                        <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Refresh data</TooltipContent>
                            </Tooltip>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" className="gap-1.5 h-8 uppercase tracking-wider text-[10px] font-bold">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Kill all</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Engage emergency kill switch?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Halts all active strategies, cancels pending orders. Use only in emergencies.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => api.emergencyKill()}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Engage kill switch
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </section>

                    {/* ─── Daily Briefing ───────────────────────────────── */}
                    <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20 overflow-hidden">
                        <CardContent className="p-5 flex flex-col md:flex-row gap-4 items-start">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                <Sparkles className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-semibold tracking-tight">Today’s briefing</h2>
                                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider border-primary/30 bg-primary/5 text-primary">
                                        AI
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground ml-auto">
                                        Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <ul className="mt-3 space-y-1.5">
                                    {briefingBullets.map((b, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                                            <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
                                            <span className="leading-relaxed">{b}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-3 flex items-center gap-2">
                                    <Button onClick={() => openAi()} size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                                        <Sparkles className="w-3 h-3" />
                                        Ask for full briefing
                                    </Button>
                                    <Button
                                        onClick={() => navigate('/news')}
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs gap-1.5 text-muted-foreground"
                                    >
                                        <Newspaper className="w-3 h-3" />
                                        News feed
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ─── KPI strip ─────────────────────────────────────── */}
                    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <KpiTile
                            label="Active strategies"
                            value={activeStrategies.length}
                            delta={`of ${strategies.length} total`}
                            icon={Layers}
                            tone="primary"
                            onClick={() => navigate('/builder')}
                        />
                        <KpiTile
                            label="Agents on staff"
                            value={agents.length}
                            delta={runningAgents.size > 0 ? `${runningAgents.size} working` : 'all idle'}
                            icon={Bot}
                            tone={runningAgents.size > 0 ? 'warn' : 'default'}
                            onClick={() => navigate('/agents')}
                        />
                        <KpiTile
                            label="Success rate"
                            value={`${successRate}%`}
                            delta={`${totalRuns} lifetime runs`}
                            icon={TrendingUp}
                            tone={successRate >= 80 ? 'profit' : successRate >= 50 ? 'warn' : 'loss'}
                            onClick={() => navigate('/executions')}
                        />
                        <KpiTile
                            label="Pending signals"
                            value={pendingApprovals.length}
                            delta={pendingApprovals.length > 0 ? 'awaiting your call' : 'queue clear'}
                            icon={ShieldCheck}
                            tone={pendingApprovals.length > 0 ? 'warn' : 'default'}
                        />
                    </section>

                    {/* ─── Two-column main ───────────────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* Left column (2/3) */}
                        <div className="lg:col-span-2 space-y-5">
                            {/* Active Agents */}
                            <section>
                                <SectionHeader
                                    icon={Bot}
                                    title="Active Agents"
                                    accent="text-primary"
                                    cta={
                                        <Button onClick={() => navigate('/agents')} size="sm" variant="ghost" className="h-7 text-xs gap-1">
                                            View all <ArrowRight className="w-3 h-3" />
                                        </Button>
                                    }
                                />
                                {agents.length === 0 ? (
                                    <Card className="bg-card/40 border-border/40 border-dashed">
                                        <CardContent className="p-8 text-center text-sm text-muted-foreground">
                                            No agents yet. Drop an agent node into a strategy on the
                                            <button onClick={() => navigate('/builder')} className="text-primary hover:underline mx-1">
                                                builder
                                            </button>
                                            to start.
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                                        {agents.slice(0, 6).map((a) => (
                                            <AgentTile
                                                key={a.id}
                                                agent={a}
                                                onClick={() => navigate(`/agents/${encodeURIComponent(a.id)}`)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* Strategies */}
                            <section>
                                <SectionHeader
                                    icon={Layers}
                                    title="Strategies"
                                    cta={
                                        <Button onClick={() => navigate('/builder')} size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                                            <Plus className="w-3 h-3" />
                                            New
                                        </Button>
                                    }
                                />
                                <Card className="bg-card border-border/60">
                                    <CardContent className="p-0">
                                        {strategies.length === 0 ? (
                                            <div className="p-10 text-center">
                                                <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                                                    <Rocket className="w-5 h-5 text-primary" />
                                                </div>
                                                <p className="text-sm font-medium">Build your first strategy</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Drag nodes onto the canvas, or ask the AI to draft one.
                                                </p>
                                                <Button onClick={() => navigate('/builder')} size="sm" className="gap-1.5 mt-4">
                                                    <Code2 className="w-3.5 h-3.5" />
                                                    Open builder
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-border/40">
                                                {strategies.slice(0, 6).map((s: any) => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => navigate('/builder')}
                                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <span
                                                                className={cn(
                                                                    'w-1.5 h-1.5 rounded-full shrink-0',
                                                                    s.status === 'active' ? 'bg-profit shadow-[0_0_6px] shadow-profit/60' : 'bg-muted-foreground/40',
                                                                )}
                                                            />
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-medium truncate">{s.name}</div>
                                                                <div className="text-[11px] text-muted-foreground tabular-nums">
                                                                    v{s.currentVersion} · updated {relTime(s.updatedAt)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    'text-[10px] uppercase tracking-wider',
                                                                    s.status === 'active'
                                                                        ? 'border-profit/40 bg-profit/10 text-profit'
                                                                        : 'border-border bg-muted/30 text-muted-foreground',
                                                                )}
                                                            >
                                                                {s.status}
                                                            </Badge>
                                                            <ArrowRight className="w-3.5 h-3.5 text-transparent group-hover:text-muted-foreground" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </section>

                            {/* Activity timeline */}
                            <section>
                                <SectionHeader
                                    icon={Activity}
                                    title="Recent activity"
                                    cta={
                                        <Button onClick={() => navigate('/executions')} size="sm" variant="ghost" className="h-7 text-xs gap-1">
                                            View all <ExternalLink className="w-3 h-3" />
                                        </Button>
                                    }
                                />
                                <Card className="bg-card border-border/60">
                                    <CardContent className="p-0">
                                        {recentRuns.length === 0 ? (
                                            <div className="p-10 text-center text-sm text-muted-foreground">
                                                No execution runs yet. Once a strategy is live, runs will appear here.
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-border/40">
                                                {recentRuns.map((run: any) => (
                                                    <button
                                                        key={run.id}
                                                        onClick={() => navigate(`/execution/${run.id}`)}
                                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <StatusDot status={run.status} />
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-medium truncate">
                                                                    {run.strategy?.name ?? 'Unknown strategy'}
                                                                </div>
                                                                <div className="text-[11px] text-muted-foreground tabular-nums flex items-center gap-2">
                                                                    <Badge variant="outline" className="h-[18px] px-1.5 text-[9px] uppercase tracking-wider border-border/60 bg-muted/30 text-muted-foreground">
                                                                        {run.triggerType ?? 'manual'}
                                                                    </Badge>
                                                                    <span className="flex items-center gap-1">
                                                                        <Clock className="w-2.5 h-2.5" />
                                                                        {run.durationMs ? `${run.durationMs}ms` : '—'}
                                                                    </span>
                                                                    <span>{relTime(run.startedAt)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                'text-[9px] uppercase tracking-wider',
                                                                run.status === 'success' ? 'border-profit/40 bg-profit/10 text-profit'
                                                                    : run.status === 'failed' || run.status === 'error' ? 'border-loss/40 bg-loss/10 text-loss'
                                                                        : run.status === 'running' ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
                                                                            : 'border-border bg-muted/30 text-muted-foreground',
                                                            )}
                                                        >
                                                            {run.status}
                                                        </Badge>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </section>
                        </div>

                        {/* Right column (1/3) */}
                        <aside className="space-y-5">
                            {/* Pending Approvals */}
                            {pendingApprovals.length > 0 && (
                                <section>
                                    <SectionHeader
                                        icon={ShieldCheck}
                                        title="Awaiting your call"
                                        accent="text-amber-500"
                                    />
                                    <Card className="bg-amber-500/5 border-amber-500/30">
                                        <CardContent className="p-3 space-y-2">
                                            {pendingApprovals.slice(0, 4).map((a: any) => (
                                                <div
                                                    key={a.id}
                                                    className="px-3 py-2.5 rounded-md bg-card border border-border/60"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-medium leading-snug">
                                                                {a.message || 'Approval required'}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                                                                {a.nodeId?.slice(0, 8)}… · {relTime(a.createdAt)}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        await api.approveRequest(a.id);
                                                                        setPendingApprovals((prev) => prev.filter((x) => x.id !== a.id));
                                                                    } catch { /* silent */ }
                                                                }}
                                                                className="p-1.5 rounded-md bg-profit/10 text-profit hover:bg-profit/20 transition-colors"
                                                                aria-label="Approve"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        await api.rejectRequest(a.id);
                                                                        setPendingApprovals((prev) => prev.filter((x) => x.id !== a.id));
                                                                    } catch { /* silent */ }
                                                                }}
                                                                className="p-1.5 rounded-md bg-loss/10 text-loss hover:bg-loss/20 transition-colors"
                                                                aria-label="Reject"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </section>
                            )}

                            {/* Watchlist */}
                            <section>
                                <SectionHeader
                                    icon={LineChart}
                                    title="Watchlist"
                                    cta={
                                        <Button onClick={() => navigate('/portfolio')} size="sm" variant="ghost" className="h-7 text-xs gap-1">
                                            <Wallet className="w-3 h-3" />
                                            Portfolio
                                        </Button>
                                    }
                                />
                                <Card className="bg-card border-border/60">
                                    <CardContent className="p-0">
                                        {watchItems.length === 0 ? (
                                            <div className="p-6 text-center text-xs text-muted-foreground">
                                                Connect a broker or open positions to populate your watchlist.
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-border/40">
                                                {watchItems.map((it) => (
                                                    <div
                                                        key={it.symbol}
                                                        className="flex items-center justify-between px-3 py-2.5"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="font-mono text-[13px] font-medium">{it.symbol}</span>
                                                            {it.qty > 0 && (
                                                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                                                    × {it.qty}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0 tabular-nums">
                                                            {it.price > 0 && (
                                                                <span className="text-[12px] font-mono">${fmtMoney(it.price)}</span>
                                                            )}
                                                            {typeof it.pnl === 'number' && (
                                                                <span
                                                                    className={cn(
                                                                        'text-[11px] font-mono inline-flex items-center gap-0.5',
                                                                        it.pnl >= 0 ? 'text-profit' : 'text-loss',
                                                                    )}
                                                                >
                                                                    {it.pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                                    {fmtMoney(Math.abs(it.pnl))}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </section>

                            {/* News pulse */}
                            {newsEvents.length > 0 && (
                                <section>
                                    <SectionHeader
                                        icon={Newspaper}
                                        title="News pulse"
                                        cta={
                                            <Button onClick={() => navigate('/news')} size="sm" variant="ghost" className="h-7 text-xs gap-1">
                                                Open <ArrowRight className="w-3 h-3" />
                                            </Button>
                                        }
                                    />
                                    <Card className="bg-card border-border/60">
                                        <CardContent className="p-0 divide-y divide-border/40">
                                            {newsEvents.slice(0, 4).map((ev: any, i: number) => (
                                                <button
                                                    key={ev.id ?? i}
                                                    onClick={() => ev.url && window.open(ev.url, '_blank')}
                                                    className="w-full text-left px-3 py-2.5 hover:bg-muted/30 transition-colors group"
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <span
                                                            className={cn(
                                                                'mt-1.5 w-1.5 h-1.5 rounded-full shrink-0',
                                                                ev.sentiment === 'bullish' ? 'bg-profit'
                                                                    : ev.sentiment === 'bearish' ? 'bg-loss'
                                                                        : 'bg-muted-foreground/50',
                                                            )}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-medium leading-snug line-clamp-2">
                                                                {ev.headline}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                                                {ev.symbol && (
                                                                    <span className="font-mono px-1.5 py-0.5 rounded bg-muted/40">
                                                                        ${ev.symbol}
                                                                    </span>
                                                                )}
                                                                <span>
                                                                    {ev.publishedAt
                                                                        ? relTime(ev.publishedAt)
                                                                        : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </section>
                            )}

                            {/* System Health */}
                            <section>
                                <SectionHeader icon={Radio} title="System" />
                                <Card className="bg-card border-border/60">
                                    <CardContent className="p-3 space-y-2.5">
                                        <HealthRow label="API" status="operational" />
                                        <HealthRow
                                            label="Strategies"
                                            status={strategies.length > 0 ? 'operational' : 'idle'}
                                        />
                                        <HealthRow
                                            label="Success rate"
                                            status={
                                                successRate >= 80 ? 'operational'
                                                    : successRate >= 50 ? 'warning'
                                                        : totalRuns === 0 ? 'idle'
                                                            : 'degraded'
                                            }
                                        />
                                        <HealthRow
                                            label="Errors"
                                            status={errorRuns === 0 ? 'operational' : errorRuns < 3 ? 'warning' : 'degraded'}
                                            value={String(errorRuns)}
                                        />
                                    </CardContent>
                                </Card>
                            </section>

                            {/* Quick actions */}
                            <section>
                                <SectionHeader icon={Zap} title="Quick actions" accent="text-amber-500" />
                                <div className="grid grid-cols-2 gap-2">
                                    <QuickAction icon={Code2} label="Builder" onClick={() => navigate('/builder')} />
                                    <QuickAction icon={Bot} label="Agents" onClick={() => navigate('/agents')} />
                                    <QuickAction icon={Briefcase} label="Portfolio" onClick={() => navigate('/portfolio')} />
                                    <QuickAction icon={Play} label="Executions" onClick={() => navigate('/executions')} />
                                </div>
                            </section>
                        </aside>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
};

/* -------------------------------------------------------------------------- */
/*  Small helpers (sub-components)                                            */
/* -------------------------------------------------------------------------- */

const HealthRow = ({
    label,
    status,
    value,
}: {
    label: string;
    status: 'operational' | 'warning' | 'degraded' | 'idle';
    value?: string;
}) => {
    const cfg =
        status === 'operational' ? { dot: 'bg-profit', text: 'text-profit', word: 'OK' }
            : status === 'warning' ? { dot: 'bg-amber-500', text: 'text-amber-500', word: 'WARN' }
                : status === 'degraded' ? { dot: 'bg-loss', text: 'text-loss', word: 'DEGRADED' }
                    : { dot: 'bg-muted-foreground/60', text: 'text-muted-foreground', word: 'IDLE' };
    return (
        <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
                <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot, status === 'operational' && 'animate-pulse')} />
                <span className="text-foreground/80">{label}</span>
            </div>
            <span className={cn('font-mono uppercase tracking-wider text-[10px]', cfg.text)}>
                {value ?? cfg.word}
            </span>
        </div>
    );
};

const QuickAction = ({
    icon: Icon,
    label,
    onClick,
}: {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
}) => (
    <button
        onClick={onClick}
        className="group flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-md border border-border/60 bg-card hover:border-border hover:bg-muted/30 transition-colors"
    >
        <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="text-[11px] font-medium">{label}</span>
    </button>
);

export default Dashboard;
