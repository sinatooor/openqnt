/**
 * Research — quant research / backtesting workbench.
 *
 * Layout: sticky page header • left sidebar (tool list) • right workspace
 * (tool header → inputs Card → results Card). Replaces the previous flat
 * tab-strip layout. All colors come from design tokens so the whole page
 * follows the active theme (dark / light / high-contrast / bloomberg).
 */

import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import {
    Layers, FlaskConical, Play, BarChart2, Loader2, AlertCircle, RefreshCw,
    TrendingDown, GitCompare, SlidersHorizontal, Activity, BarChart3, Beaker,
    Shield, Lock, History, ArrowRight, type LucideIcon,
} from 'lucide-react';
import { api } from '@/services/api';
import { useStrategyFlowStore } from '@/features/strategy-flow/store/strategyFlowStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PAGE_CONTENT_CLASS } from '@/components/PageHeader';
import { cn } from '@/lib/utils';

import { orchestratorBase } from '@/lib/runtimeConfig';
/* -------------------------------------------------------------------------- */
/*  Tool catalog                                                              */
/* -------------------------------------------------------------------------- */

type ToolId =
    | 'quantstats'
    | 'strategies'
    | 'mcpt'
    | 'montecarlo'
    | 'hmm'
    | 'wfo'
    | 'var'
    | 'coint'
    | 'stress'
    | 'sweep';

interface Tool {
    id: ToolId;
    label: string;
    blurb: string;
    icon: LucideIcon;
    comingSoon?: boolean;
}

const TOOLS: Tool[] = [
    { id: 'quantstats', label: 'QuantStats', blurb: 'Portfolio analytics — Sharpe, Sortino, drawdown.', icon: BarChart3 },
    { id: 'strategies', label: 'Strategies', blurb: 'Run classic quant strategies on real tickers.', icon: Beaker },
    { id: 'mcpt', label: 'MCPT', blurb: 'Monte Carlo permutation test for overfitting.', icon: BarChart2 },
    { id: 'montecarlo', label: 'Monte Carlo', blurb: 'Randomize trade order, simulate equity outcomes.', icon: Activity },
    { id: 'hmm', label: 'HMM Regime', blurb: 'Detect bull / bear / sideways regimes.', icon: Layers },
    { id: 'wfo', label: 'Walk-Forward', blurb: 'Rolling out-of-sample robustness.', icon: RefreshCw },
    { id: 'var', label: 'VaR / CVaR', blurb: 'Worst-case loss at a confidence level.', icon: TrendingDown },
    { id: 'coint', label: 'Cointegration', blurb: 'Engle-Granger pairs trading test.', icon: GitCompare },
    { id: 'stress', label: 'Stress Testing', blurb: 'Replay black-swan scenarios.', icon: Shield, comingSoon: true },
    { id: 'sweep', label: 'Param Sweep', blurb: 'Heatmap of parameter sensitivities.', icon: SlidersHorizontal, comingSoon: true },
];

const STRATEGY_OPTIONS = [
    { id: 'macd', name: 'MACD Oscillator', params: { shortWindow: 12, longWindow: 26, signalWindow: 9 } },
    { id: 'pair_trading', name: 'Pair Trading', params: { tickerB: 'MSFT', lookback: 60, entryZ: 2.0, exitZ: 0.5 } },
    { id: 'heikin_ashi', name: 'Heikin-Ashi', params: {} },
    { id: 'bollinger_bands', name: 'Bollinger Bands', params: { period: 20, stdDev: 2.0 } },
    { id: 'rsi', name: 'RSI Pattern', params: { period: 14, overbought: 70, oversold: 30 } },
    { id: 'parabolic_sar', name: 'Parabolic SAR', params: { af: 0.02, maxAf: 0.2 } },
    { id: 'awesome_oscillator', name: 'Awesome Oscillator', params: { shortPeriod: 5, longPeriod: 34 } },
    { id: 'dual_thrust', name: 'Dual Thrust', params: { lookback: 4, k1: 0.5, k2: 0.5 } },
    { id: 'shooting_star', name: 'Shooting Star', params: { bodyRatio: 0.3, shadowRatio: 2.0 } },
    { id: 'options_straddle', name: 'Options Straddle', params: { strikePrice: 100, callPremium: 5.0, putPremium: 4.5, days: 30 } },
    { id: 'vix_calc', name: 'VIX Calculator', params: { windowDays: 30 } },
];

const backendUrl = orchestratorBase() || 'http://localhost:3001';

async function researchPost(endpoint: string, body: Record<string, any>) {
    const resp = await fetch(`${backendUrl}/api/research/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(err.error || `HTTP ${resp.status}`);
    }
    return resp.json();
}

const parseList = (s: string): number[] =>
    s.split(/[,\n\s]+/).map(Number).filter((n) => !isNaN(n));

const yearsAgo = (n: number) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - n);
    return d.toISOString().split('T')[0];
};
const today = () => new Date().toISOString().split('T')[0];

/* -------------------------------------------------------------------------- */
/*  Building blocks                                                           */
/* -------------------------------------------------------------------------- */

interface StatProps {
    label: string;
    value: ReactNode;
    tone?: 'default' | 'profit' | 'loss' | 'warn' | 'muted';
    size?: 'sm' | 'md';
}

const toneClass: Record<NonNullable<StatProps['tone']>, string> = {
    default: 'text-foreground',
    profit: 'text-profit',
    loss: 'text-loss',
    warn: 'text-amber-400',
    muted: 'text-muted-foreground',
};

const Stat = ({ label, value, tone = 'default', size = 'md' }: StatProps) => (
    <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
        </div>
        <div
            className={cn(
                'font-bold tabular-nums leading-tight mt-1',
                size === 'md' ? 'text-xl' : 'text-base',
                toneClass[tone],
            )}
        >
            {value ?? '—'}
        </div>
    </div>
);

const StatGrid = ({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 }) => {
    const grid =
        cols === 5 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
            : cols === 4 ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4'
                : cols === 3 ? 'grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-2';
    return <div className={cn('grid gap-3', grid)}>{children}</div>;
};

interface RunButtonProps {
    onClick: () => void;
    isRunning: boolean;
    label?: string;
}

const RunButton = ({ onClick, isRunning, label = 'Run' }: RunButtonProps) => (
    <Button onClick={onClick} disabled={isRunning} className="gap-2 min-w-[120px]">
        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {isRunning ? 'Running…' : label}
    </Button>
);

const SectionTitle = ({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) => (
    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" />
        {children}
    </h4>
);

const EmptyState = ({
    icon: Icon,
    title,
    description,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
}) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
            <Icon className="w-7 h-7 text-primary" />
        </div>
        <h4 className="text-base font-semibold text-foreground tracking-tight">{title}</h4>
        <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">{description}</p>
    </div>
);

const ResultsEmpty = ({ tool }: { tool: Tool }) => (
    <Card className="bg-card/40 border-border/40 border-dashed">
        <CardContent className="p-0">
            <EmptyState
                icon={tool.icon}
                title="No results yet"
                description="Configure your inputs above and run the analysis to see results here."
            />
        </CardContent>
    </Card>
);

const ComingSoon = ({ tool }: { tool: Tool }) => (
    <Card className="bg-card/40 border-border/40 border-dashed">
        <CardContent className="p-0">
            <EmptyState
                icon={Lock}
                title="Coming soon"
                description={`${tool.label} — ${tool.blurb} This module is on the roadmap.`}
            />
        </CardContent>
    </Card>
);

/* -------------------------------------------------------------------------- */
/*  Sidebar                                                                   */
/* -------------------------------------------------------------------------- */

const ToolSidebar = ({
    active,
    onChange,
}: {
    active: ToolId;
    onChange: (id: ToolId) => void;
}) => (
    <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border/50 bg-card/30">
        <div className="px-4 py-3 border-b border-border/50">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tools
            </div>
        </div>
        <ScrollArea className="flex-1">
            <div className="p-2 flex flex-col gap-0.5">
                {TOOLS.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = active === tool.id;
                    return (
                        <button
                            key={tool.id}
                            data-active={isActive}
                            onClick={() => onChange(tool.id)}
                            className={cn(
                                'group flex items-start gap-2.5 px-3 py-2 rounded-md text-left transition-colors',
                                isActive
                                    ? 'bg-primary/10 text-foreground'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                        >
                            <Icon
                                className={cn(
                                    'w-3.5 h-3.5 mt-0.5 shrink-0',
                                    isActive ? 'text-primary' : 'text-muted-foreground/70',
                                )}
                            />
                            <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-medium flex items-center gap-1.5">
                                    {tool.label}
                                    {tool.comingSoon && (
                                        <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
                                            Soon
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-[11px] text-muted-foreground/80 leading-snug mt-0.5 line-clamp-2">
                                    {tool.blurb}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </ScrollArea>
    </aside>
);

/* -------------------------------------------------------------------------- */
/*  Tool panels                                                               */
/* -------------------------------------------------------------------------- */

interface ToolPanelProps {
    tool: Tool;
    children: ReactNode;
    headerExtra?: ReactNode;
}

const ToolHeader = ({ tool, headerExtra }: { tool: Tool; headerExtra?: ReactNode }) => {
    const Icon = tool.icon;
    return (
        <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                    {tool.label}
                    {tool.comingSoon && (
                        <Badge variant="outline" className="text-[10px] font-normal">Coming soon</Badge>
                    )}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">{tool.blurb}</p>
            </div>
            {headerExtra && <div className="shrink-0">{headerExtra}</div>}
        </div>
    );
};

const ToolPanel = ({ tool, children, headerExtra }: ToolPanelProps) => (
    <div>
        <ToolHeader tool={tool} headerExtra={headerExtra} />
        <div className="space-y-5">{children}</div>
    </div>
);

const InputsCard = ({ children, footer }: { children: ReactNode; footer?: ReactNode }) => (
    <Card className="bg-card/60 border-border/50">
        <CardContent className="p-5 space-y-4">{children}</CardContent>
        {footer && (
            <div className="px-5 py-3 border-t border-border/50 bg-muted/30 flex justify-end">
                {footer}
            </div>
        )}
    </Card>
);

const ResultsCard = ({ children }: { children: ReactNode }) => (
    <Card className="bg-card/60 border-border/50">
        <CardContent className="p-5 space-y-5">{children}</CardContent>
    </Card>
);

const FieldGrid = ({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) => {
    const grid =
        cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4'
            : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3'
                : 'sm:grid-cols-2';
    return <div className={cn('grid grid-cols-1 gap-3', grid)}>{children}</div>;
};

const Field = ({
    label,
    children,
    helper,
    span,
}: {
    label: string;
    children: ReactNode;
    helper?: string;
    span?: 'all' | 'half';
}) => (
    <div className={cn('space-y-1.5', span === 'all' && 'sm:col-span-full')}>
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {children}
        {helper && <p className="text-[10px] text-muted-foreground/70">{helper}</p>}
    </div>
);

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

const Research = () => {
    const { strategyName } = useStrategyFlowStore();
    const [activeTool, setActiveTool] = useState<ToolId>('quantstats');
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const tool = useMemo(() => TOOLS.find((t) => t.id === activeTool)!, [activeTool]);

    /* QuantStats state ----------------------------------------------------- */
    const [qsTicker, setQsTicker] = useState('AAPL');
    const [qsBenchmark, setQsBenchmark] = useState('SPY');
    const [qsStart, setQsStart] = useState(yearsAgo(1));
    const [qsEnd, setQsEnd] = useState(today());
    const [qsResult, setQsResult] = useState<any>(null);

    /* Quant Strategy state ------------------------------------------------- */
    const [selStrategy, setSelStrategy] = useState(STRATEGY_OPTIONS[0].id);
    const [stratTicker, setStratTicker] = useState('AAPL');
    const [stratStart, setStratStart] = useState(yearsAgo(2));
    const [stratEnd, setStratEnd] = useState(today());
    const [stratParams, setStratParams] = useState<Record<string, any>>({ ...STRATEGY_OPTIONS[0].params });
    const [stratResult, setStratResult] = useState<any>(null);

    useEffect(() => {
        const s = STRATEGY_OPTIONS.find((o) => o.id === selStrategy);
        if (s) setStratParams({ ...s.params });
    }, [selStrategy]);

    /* MCPT state ----------------------------------------------------------- */
    const [mcptSymbol, setMcptSymbol] = useState('BTCUSD');
    const [mcptPerms, setMcptPerms] = useState(100);
    const [mcptTf, setMcptTf] = useState('1d');
    const [mcptResult, setMcptResult] = useState<any>(null);

    /* Monte Carlo state ---------------------------------------------------- */
    const [mcTrades, setMcTrades] = useState('');
    const [mcSims, setMcSims] = useState(1000);
    const [mcCapital, setMcCapital] = useState(10000);
    const [mcResult, setMcResult] = useState<any>(null);

    /* HMM state ------------------------------------------------------------ */
    const [hmmPrices, setHmmPrices] = useState('');
    const [hmmStates, setHmmStates] = useState(3);
    const [hmmResult, setHmmResult] = useState<any>(null);

    /* Walk-Forward state --------------------------------------------------- */
    const [wfReturns, setWfReturns] = useState('');
    const [wfTrain, setWfTrain] = useState(252);
    const [wfTest, setWfTest] = useState(63);
    const [wfResult, setWfResult] = useState<any>(null);

    /* VaR state ------------------------------------------------------------ */
    const [varReturns, setVarReturns] = useState('');
    const [varConf, setVarConf] = useState(0.95);
    const [varPortVal, setVarPortVal] = useState(100000);
    const [varResult, setVarResult] = useState<any>(null);

    /* Cointegration state -------------------------------------------------- */
    const [cointA, setCointA] = useState('');
    const [cointB, setCointB] = useState('');
    const [cointResult, setCointResult] = useState<any>(null);

    const run = useCallback(async (fn: () => Promise<void>) => {
        setIsRunning(true);
        setError(null);
        try {
            await fn();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsRunning(false);
        }
    }, []);

    /* Tool runners --------------------------------------------------------- */

    const runQuantStats = () => run(async () => {
        if (!qsTicker.trim()) throw new Error('Enter a ticker symbol');
        const res = await researchPost('quantstats', {
            ticker: qsTicker.trim().toUpperCase(),
            benchmark: qsBenchmark.trim().toUpperCase(),
            startDate: qsStart, endDate: qsEnd,
        });
        setQsResult(res);
    });

    const runStrategy = () => run(async () => {
        if (!stratTicker.trim()) throw new Error('Enter a ticker symbol');
        const res = await researchPost('quant-strategy', {
            strategy: selStrategy,
            ticker: stratTicker.trim().toUpperCase(),
            startDate: stratStart, endDate: stratEnd,
            params: stratParams,
        });
        setStratResult(res);
    });

    const runMCPT = () => run(async () => {
        const res = await api.runMCPT({
            symbol: mcptSymbol,
            startDate: yearsAgo(1),
            endDate: today(),
            timeframe: mcptTf,
            permutations: mcptPerms,
        });
        if (res.data.success) setMcptResult(res.data);
        else throw new Error(res.data.error || 'MCPT failed');
    });

    const runMC = () => run(async () => {
        const trades = parseList(mcTrades).map((p) => ({ pnl: p }));
        if (trades.length < 2) throw new Error('Enter at least 2 PnL values');
        const res = await researchPost('monte-carlo', { trades, numSimulations: mcSims, initialCapital: mcCapital });
        setMcResult(res);
    });

    const runHMM = () => run(async () => {
        const prices = parseList(hmmPrices);
        if (prices.length < 30) throw new Error('Enter at least 30 price points');
        const res = await researchPost('hmm-regime', { prices, numStates: hmmStates });
        setHmmResult(res);
    });

    const runWF = () => run(async () => {
        const returns = parseList(wfReturns);
        if (returns.length < wfTrain + wfTest) throw new Error(`Enter at least ${wfTrain + wfTest} return values`);
        const res = await researchPost('walk-forward', { returns, trainWindow: wfTrain, testWindow: wfTest });
        setWfResult(res);
    });

    const runVaR = () => run(async () => {
        const returns = parseList(varReturns);
        if (returns.length < 10) throw new Error('Enter at least 10 return values');
        const res = await researchPost('var-cvar', { returns, confidence: varConf, portfolioValue: varPortVal });
        setVarResult(res);
    });

    const runCoint = () => run(async () => {
        const a = parseList(cointA);
        const b = parseList(cointB);
        if (a.length < 30 || b.length < 30) throw new Error('Enter at least 30 price points per series');
        const res = await researchPost('cointegration', { pricesA: a, pricesB: b });
        setCointResult(res);
    });

    /* Reset error when tool changes */
    useEffect(() => {
        setError(null);
    }, [activeTool]);

    /* ------------------------------------------------------------------- */
    /*  Render                                                              */
    /* ------------------------------------------------------------------- */

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col pt-14">
            {/* Sticky page header */}
            <header className={cn(PAGE_CONTENT_CLASS, 'sticky top-14 z-30 bg-background/90 backdrop-blur-md border-b border-border/50')}>
                <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <FlaskConical className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base font-semibold tracking-tight">Research & Quant Tools</h1>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Backtests, regime detection, risk analytics.</span>
                            {strategyName && (
                                <>
                                    <span className="text-muted-foreground/40">•</span>
                                    <Badge variant="secondary" className="text-[10px] font-normal h-5">
                                        Strategy: {strategyName}
                                    </Badge>
                                </>
                            )}
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" className="hidden lg:inline-flex gap-1.5 text-muted-foreground" disabled>
                        <History className="w-3.5 h-3.5" />
                        Run history
                    </Button>
                </div>
            </header>

            {/* Body — sidebar + workspace */}
            <div className="flex-1 max-w-7xl mx-auto w-full flex">
                <ToolSidebar active={activeTool} onChange={setActiveTool} />

                <main className="flex-1 min-w-0 px-4 sm:px-6 py-6">
                    {/* Mobile picker */}
                    <div className="md:hidden mb-4">
                        <Select value={activeTool} onValueChange={(v) => setActiveTool(v as ToolId)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TOOLS.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.label}
                                        {t.comingSoon && ' — Coming soon'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {error && (
                        <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive p-3 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">{error}</div>
                            <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100">
                                ×
                            </button>
                        </div>
                    )}

                    {/* QuantStats --------------------------------------------------- */}
                    {activeTool === 'quantstats' && (
                        <ToolPanel tool={tool}>
                            <InputsCard footer={<RunButton isRunning={isRunning} onClick={runQuantStats} label="Analyze" />}>
                                <FieldGrid cols={4}>
                                    <Field label="Ticker">
                                        <Input value={qsTicker} onChange={(e) => setQsTicker(e.target.value.toUpperCase())} placeholder="AAPL" />
                                    </Field>
                                    <Field label="Benchmark">
                                        <Input value={qsBenchmark} onChange={(e) => setQsBenchmark(e.target.value.toUpperCase())} placeholder="SPY" />
                                    </Field>
                                    <Field label="Start Date">
                                        <Input type="date" value={qsStart} onChange={(e) => setQsStart(e.target.value)} />
                                    </Field>
                                    <Field label="End Date">
                                        <Input type="date" value={qsEnd} onChange={(e) => setQsEnd(e.target.value)} />
                                    </Field>
                                </FieldGrid>
                            </InputsCard>

                            {qsResult?.metrics ? (
                                <ResultsCard>
                                    <SectionTitle icon={BarChart3}>Key Metrics</SectionTitle>
                                    <StatGrid cols={5}>
                                        <Stat label="Sharpe" value={qsResult.metrics.sharpe?.toFixed(3)} tone={qsResult.metrics.sharpe > 1 ? 'profit' : qsResult.metrics.sharpe > 0 ? 'warn' : 'loss'} />
                                        <Stat label="Sortino" value={qsResult.metrics.sortino?.toFixed(3)} />
                                        <Stat label="CAGR" value={qsResult.metrics.cagr != null ? `${(qsResult.metrics.cagr * 100).toFixed(2)}%` : '—'} tone={qsResult.metrics.cagr > 0 ? 'profit' : 'loss'} />
                                        <Stat label="Max Drawdown" value={qsResult.metrics.maxDrawdown != null ? `${(qsResult.metrics.maxDrawdown * 100).toFixed(2)}%` : '—'} tone="loss" />
                                        <Stat label="Volatility" value={qsResult.metrics.volatility != null ? `${(qsResult.metrics.volatility * 100).toFixed(2)}%` : '—'} />
                                        <Stat label="Win Rate" value={qsResult.metrics.winRate != null ? `${(qsResult.metrics.winRate * 100).toFixed(1)}%` : '—'} />
                                        <Stat label="Profit Factor" value={qsResult.metrics.profitFactor?.toFixed(3)} />
                                        <Stat label="VaR" value={qsResult.metrics.valueAtRisk != null ? `${(qsResult.metrics.valueAtRisk * 100).toFixed(2)}%` : '—'} tone="loss" />
                                        <Stat label="Avg Return" value={qsResult.metrics.avgReturn != null ? `${(qsResult.metrics.avgReturn * 100).toFixed(3)}%` : '—'} />
                                        <Stat label="Kelly" value={qsResult.metrics.kellyC?.toFixed(3)} />
                                    </StatGrid>

                                    {qsResult?.plots && Object.keys(qsResult.plots).length > 0 && (
                                        <div className="space-y-3 pt-2">
                                            <Separator />
                                            <SectionTitle icon={BarChart3}>Charts</SectionTitle>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {Object.entries(qsResult.plots).map(([key, imgSrc]) => (
                                                    <div key={key} className="rounded-lg overflow-hidden border border-border/40">
                                                        <div className="px-3 py-1.5 bg-muted/50 border-b border-border/40 text-[11px] font-medium text-muted-foreground capitalize">
                                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                                        </div>
                                                        <img src={imgSrc as string} alt={key} className="w-full object-contain bg-white" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </ResultsCard>
                            ) : <ResultsEmpty tool={tool} />}
                        </ToolPanel>
                    )}

                    {/* Strategies --------------------------------------------------- */}
                    {activeTool === 'strategies' && (
                        <ToolPanel tool={tool}>
                            <InputsCard footer={<RunButton isRunning={isRunning} onClick={runStrategy} label="Run Backtest" />}>
                                <FieldGrid cols={4}>
                                    <Field label="Strategy" span="all">
                                        <Select value={selStrategy} onValueChange={(v) => { setSelStrategy(v); setStratResult(null); }}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {STRATEGY_OPTIONS.map((s) => (
                                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    <Field label="Ticker">
                                        <Input value={stratTicker} onChange={(e) => setStratTicker(e.target.value.toUpperCase())} />
                                    </Field>
                                    <Field label="Start">
                                        <Input type="date" value={stratStart} onChange={(e) => setStratStart(e.target.value)} />
                                    </Field>
                                    <Field label="End">
                                        <Input type="date" value={stratEnd} onChange={(e) => setStratEnd(e.target.value)} />
                                    </Field>
                                </FieldGrid>

                                {Object.keys(stratParams).length > 0 && (
                                    <>
                                        <Separator />
                                        <div>
                                            <Label className="text-xs text-muted-foreground mb-2 block">Parameters</Label>
                                            <FieldGrid cols={4}>
                                                {Object.entries(stratParams).map(([key, val]) => (
                                                    <Field key={key} label={key.replace(/([A-Z])/g, ' $1')}>
                                                        <Input
                                                            value={val as string}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setStratParams((prev) => ({
                                                                    ...prev,
                                                                    [key]: isNaN(Number(v)) ? v : Number(v),
                                                                }));
                                                            }}
                                                        />
                                                    </Field>
                                                ))}
                                            </FieldGrid>
                                        </div>
                                    </>
                                )}
                            </InputsCard>

                            {stratResult ? (
                                <ResultsCard>
                                    <SectionTitle icon={Beaker}>{stratResult.strategyName} — Results</SectionTitle>
                                    <StatGrid cols={4}>
                                        {stratResult.metrics && Object.entries(stratResult.metrics).map(([k, v]) => (
                                            <Stat
                                                key={k}
                                                label={k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                                                value={typeof v === 'number'
                                                    ? (Math.abs(v as number) < 10 ? (v as number).toFixed(3) : (v as number).toLocaleString())
                                                    : String(v)}
                                                tone={k === 'totalReturn' ? ((v as number) > 0 ? 'profit' : 'loss') : k === 'maxDrawdown' ? 'loss' : 'default'}
                                            />
                                        ))}
                                    </StatGrid>
                                    {stratResult.plotImage && (
                                        <div className="rounded-lg overflow-hidden border border-border/40 mt-2">
                                            <img src={stratResult.plotImage} alt={stratResult.strategyName} className="w-full max-h-[500px] object-contain bg-white" />
                                        </div>
                                    )}
                                </ResultsCard>
                            ) : <ResultsEmpty tool={tool} />}
                        </ToolPanel>
                    )}

                    {/* MCPT --------------------------------------------------------- */}
                    {activeTool === 'mcpt' && (
                        <ToolPanel tool={tool}>
                            <InputsCard footer={<RunButton isRunning={isRunning} onClick={runMCPT} label="Run MCPT" />}>
                                <FieldGrid cols={3}>
                                    <Field label="Symbol">
                                        <Input value={mcptSymbol} onChange={(e) => setMcptSymbol(e.target.value.toUpperCase())} />
                                    </Field>
                                    <Field label="Permutations" helper="10–1000">
                                        <Input type="number" min={10} max={1000} value={mcptPerms} onChange={(e) => setMcptPerms(+e.target.value)} />
                                    </Field>
                                    <Field label="Timeframe">
                                        <Select value={mcptTf} onValueChange={setMcptTf}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="15m">15m</SelectItem>
                                                <SelectItem value="1h">1h</SelectItem>
                                                <SelectItem value="1d">1d</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                </FieldGrid>
                            </InputsCard>

                            {mcptResult ? (
                                <ResultsCard>
                                    <StatGrid cols={2}>
                                        <Stat label="P-Value" value={mcptResult.pValue?.toFixed(4)} tone={mcptResult.pValue < 0.05 ? 'profit' : 'warn'} />
                                        <Stat label="Real Profit Factor" value={mcptResult.realPf?.toFixed(2)} />
                                    </StatGrid>
                                    {mcptResult.plotImage && (
                                        <div className="rounded-lg overflow-hidden border border-border/40">
                                            <img src={mcptResult.plotImage} alt="MCPT" className="w-full max-h-[400px] object-contain bg-white" />
                                        </div>
                                    )}
                                </ResultsCard>
                            ) : <ResultsEmpty tool={tool} />}
                        </ToolPanel>
                    )}

                    {/* Monte Carlo -------------------------------------------------- */}
                    {activeTool === 'montecarlo' && (
                        <ToolPanel tool={tool}>
                            <InputsCard footer={<RunButton isRunning={isRunning} onClick={runMC} label="Simulate" />}>
                                <Field label="Trade PnLs (comma separated)" span="all">
                                    <Textarea value={mcTrades} onChange={(e) => setMcTrades(e.target.value)} placeholder="100, -50, 200, -30, 150, …" className="font-mono text-xs min-h-[100px]" />
                                </Field>
                                <FieldGrid cols={2}>
                                    <Field label="Simulations">
                                        <Input type="number" value={mcSims} onChange={(e) => setMcSims(+e.target.value)} />
                                    </Field>
                                    <Field label="Initial Capital">
                                        <Input type="number" value={mcCapital} onChange={(e) => setMcCapital(+e.target.value)} />
                                    </Field>
                                </FieldGrid>
                            </InputsCard>

                            {mcResult ? (
                                <ResultsCard>
                                    <SectionTitle icon={Activity}>Equity Outcome Distribution</SectionTitle>
                                    <StatGrid cols={5}>
                                        <Stat label="P5" value={`$${mcResult.percentiles.p5.toFixed(0)}`} tone="loss" />
                                        <Stat label="P25" value={`$${mcResult.percentiles.p25.toFixed(0)}`} />
                                        <Stat label="Median" value={`$${mcResult.percentiles.p50.toFixed(0)}`} />
                                        <Stat label="P75" value={`$${mcResult.percentiles.p75.toFixed(0)}`} />
                                        <Stat label="P95" value={`$${mcResult.percentiles.p95.toFixed(0)}`} tone="profit" />
                                    </StatGrid>
                                </ResultsCard>
                            ) : <ResultsEmpty tool={tool} />}
                        </ToolPanel>
                    )}

                    {/* HMM ---------------------------------------------------------- */}
                    {activeTool === 'hmm' && (
                        <ToolPanel tool={tool}>
                            <InputsCard footer={<RunButton isRunning={isRunning} onClick={runHMM} label="Detect Regimes" />}>
                                <Field label="Close Prices" span="all">
                                    <Textarea value={hmmPrices} onChange={(e) => setHmmPrices(e.target.value)} placeholder="150.5, 151.2, 149.8, …" className="font-mono text-xs min-h-[100px]" />
                                </Field>
                                <FieldGrid cols={2}>
                                    <Field label="Num States" helper="2–5">
                                        <Input type="number" min={2} max={5} value={hmmStates} onChange={(e) => setHmmStates(+e.target.value)} />
                                    </Field>
                                </FieldGrid>
                            </InputsCard>

                            {hmmResult ? (
                                <ResultsCard>
                                    <StatGrid cols={3}>
                                        <Stat label="Current Regime" value={hmmResult.currentRegime} tone="profit" />
                                        <Stat label="Num States" value={hmmResult.numStates} />
                                        <Stat label="Bars Analyzed" value={hmmResult.numBars} />
                                    </StatGrid>
                                    <Separator />
                                    <SectionTitle icon={Layers}>Transition Matrix</SectionTitle>
                                    <div className="font-mono text-xs space-y-2">
                                        {hmmResult.transitionMatrix?.map((row: number[], i: number) => (
                                            <div key={i} className="flex gap-3 items-center">
                                                <span className="font-semibold w-24 px-2 py-1 bg-muted rounded text-foreground">
                                                    {hmmResult.stateLabels[i] || `State ${i}`}
                                                </span>
                                                {row.map((p: number, j: number) => (
                                                    <span key={j} className="w-16 text-right text-foreground/80 tabular-nums">
                                                        {(p * 100).toFixed(1)}%
                                                    </span>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </ResultsCard>
                            ) : <ResultsEmpty tool={tool} />}
                        </ToolPanel>
                    )}

                    {/* Walk-Forward -------------------------------------------------- */}
                    {activeTool === 'wfo' && (
                        <ToolPanel tool={tool}>
                            <InputsCard footer={<RunButton isRunning={isRunning} onClick={runWF} label="Analyze" />}>
                                <Field label="Strategy Returns (daily)" span="all">
                                    <Textarea value={wfReturns} onChange={(e) => setWfReturns(e.target.value)} placeholder="0.01, -0.005, 0.003, …" className="font-mono text-xs min-h-[100px]" />
                                </Field>
                                <FieldGrid cols={2}>
                                    <Field label="Train Window (bars)">
                                        <Input type="number" value={wfTrain} onChange={(e) => setWfTrain(+e.target.value)} />
                                    </Field>
                                    <Field label="Test Window (bars)">
                                        <Input type="number" value={wfTest} onChange={(e) => setWfTest(+e.target.value)} />
                                    </Field>
                                </FieldGrid>
                            </InputsCard>

                            {wfResult ? (
                                <ResultsCard>
                                    <StatGrid cols={3}>
                                        <Stat label="OOS Sharpe" value={wfResult.overallOOSSharpe} tone={wfResult.overallOOSSharpe > 0.5 ? 'profit' : 'warn'} />
                                        <Stat label="Avg IS Sharpe" value={wfResult.avgISSharpe} />
                                        <Stat label="Efficiency" value={`${(wfResult.efficiency * 100).toFixed(0)}%`} tone={wfResult.efficiency > 0.5 ? 'profit' : 'loss'} />
                                    </StatGrid>
                                    <div className="rounded-lg border border-border/40 max-h-[300px] overflow-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 sticky top-0 backdrop-blur-md">
                                                <tr className="text-muted-foreground text-xs">
                                                    <th className="text-left py-2 px-3 font-medium">Window</th>
                                                    <th className="text-right py-2 px-3 font-medium">IS Sharpe</th>
                                                    <th className="text-right py-2 px-3 font-medium">OOS Sharpe</th>
                                                    <th className="text-right py-2 px-3 font-medium">IS Return</th>
                                                    <th className="text-right py-2 px-3 font-medium">OOS Return</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {wfResult.windows?.map((w: any, i: number) => (
                                                    <tr key={i} className="border-t border-border/40 hover:bg-accent/40 tabular-nums">
                                                        <td className="py-2 px-3 font-medium">{i + 1}</td>
                                                        <td className="text-right py-2 px-3">{w.trainSharpe}</td>
                                                        <td className="text-right py-2 px-3 text-foreground">{w.testSharpe}</td>
                                                        <td className="text-right py-2 px-3">{w.trainReturn}%</td>
                                                        <td className="text-right py-2 px-3">{w.testReturn}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </ResultsCard>
                            ) : <ResultsEmpty tool={tool} />}
                        </ToolPanel>
                    )}

                    {/* VaR ---------------------------------------------------------- */}
                    {activeTool === 'var' && (
                        <ToolPanel tool={tool}>
                            <InputsCard footer={<RunButton isRunning={isRunning} onClick={runVaR} label="Calculate" />}>
                                <Field label="Daily Returns" span="all">
                                    <Textarea value={varReturns} onChange={(e) => setVarReturns(e.target.value)} placeholder="0.01, -0.02, 0.005, …" className="font-mono text-xs min-h-[100px]" />
                                </Field>
                                <FieldGrid cols={2}>
                                    <Field label="Confidence" helper="0.90 – 0.99">
                                        <Input type="number" step={0.01} min={0.9} max={0.99} value={varConf} onChange={(e) => setVarConf(+e.target.value)} />
                                    </Field>
                                    <Field label="Portfolio Value ($)">
                                        <Input type="number" value={varPortVal} onChange={(e) => setVarPortVal(+e.target.value)} />
                                    </Field>
                                </FieldGrid>
                            </InputsCard>

                            {varResult ? (
                                <ResultsCard>
                                    <StatGrid cols={4}>
                                        <Stat label={`VaR (${(varConf * 100).toFixed(0)}%)`} value={`${varResult.var?.toFixed(2)}%`} tone="loss" />
                                        <Stat label="CVaR (ES)" value={`${varResult.cvar?.toFixed(2)}%`} tone="loss" />
                                        <Stat label="VaR ($)" value={`$${varResult.varDollar?.toLocaleString()}`} />
                                        <Stat label="CVaR ($)" value={`$${varResult.cvarDollar?.toLocaleString()}`} />
                                    </StatGrid>
                                </ResultsCard>
                            ) : <ResultsEmpty tool={tool} />}
                        </ToolPanel>
                    )}

                    {/* Cointegration ------------------------------------------------- */}
                    {activeTool === 'coint' && (
                        <ToolPanel tool={tool}>
                            <InputsCard footer={<RunButton isRunning={isRunning} onClick={runCoint} label="Test Pairs" />}>
                                <FieldGrid cols={2}>
                                    <Field label="Prices A">
                                        <Textarea value={cointA} onChange={(e) => setCointA(e.target.value)} placeholder="150.5, 151.2, …" className="font-mono text-xs min-h-[100px]" />
                                    </Field>
                                    <Field label="Prices B">
                                        <Textarea value={cointB} onChange={(e) => setCointB(e.target.value)} placeholder="75.3, 76.1, …" className="font-mono text-xs min-h-[100px]" />
                                    </Field>
                                </FieldGrid>
                            </InputsCard>

                            {cointResult ? (
                                <ResultsCard>
                                    <StatGrid cols={4}>
                                        <Stat label="Cointegrated?" value={cointResult.cointegrated ? 'YES' : 'NO'} tone={cointResult.cointegrated ? 'profit' : 'loss'} />
                                        <Stat label="P-Value" value={cointResult.pValue?.toFixed(4)} />
                                        <Stat label="Hedge Ratio" value={cointResult.hedgeRatio?.toFixed(4)} />
                                        <Stat label="Z-Score" value={cointResult.zScore?.toFixed(2)} />
                                    </StatGrid>
                                </ResultsCard>
                            ) : <ResultsEmpty tool={tool} />}
                        </ToolPanel>
                    )}

                    {activeTool === 'stress' && (
                        <ToolPanel tool={tool}>
                            <ComingSoon tool={tool} />
                        </ToolPanel>
                    )}

                    {activeTool === 'sweep' && (
                        <ToolPanel tool={tool}>
                            <ComingSoon tool={tool} />
                        </ToolPanel>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Research;
