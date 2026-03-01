import { useState } from 'react';
import {
    Layers, FlaskConical, Play, BarChart2, Loader2, AlertCircle,
    RefreshCw, TrendingDown, GitCompare, SlidersHorizontal, Activity,
} from 'lucide-react';
import { WindowModal } from './WindowModal';
import { api } from '@/services/api';
import { useStrategyFlowStore } from '../../store/strategyFlowStore';

export interface ResearchModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type Tab = 'mcpt' | 'montecarlo' | 'hmm' | 'wfo' | 'var' | 'coint' | 'sweep';

const TABS: { id: Tab; label: string; icon: React.ElementType; color: string }[] = [
    { id: 'mcpt', label: 'MCPT', icon: BarChart2, color: 'purple' },
    { id: 'montecarlo', label: 'Monte Carlo', icon: Activity, color: 'cyan' },
    { id: 'hmm', label: 'HMM Regime', icon: Layers, color: 'emerald' },
    { id: 'wfo', label: 'Walk-Forward', icon: RefreshCw, color: 'blue' },
    { id: 'var', label: 'VaR / CVaR', icon: TrendingDown, color: 'red' },
    { id: 'coint', label: 'Cointegration', icon: GitCompare, color: 'amber' },
    { id: 'sweep', label: 'Param Sweep', icon: SlidersHorizontal, color: 'pink' },
];

const backendUrl = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:3001';

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

export const ResearchModal = ({ open, onOpenChange }: ResearchModalProps) => {
    const { strategyName } = useStrategyFlowStore();
    const [activeTab, setActiveTab] = useState<Tab>('mcpt');
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── MCPT ──
    const [mcptSymbol, setMcptSymbol] = useState('BTCUSD');
    const [mcptPerms, setMcptPerms] = useState(100);
    const [mcptTf, setMcptTf] = useState('1d');
    const [mcptResult, setMcptResult] = useState<any>(null);

    // ── Monte Carlo ──
    const [mcTrades, setMcTrades] = useState('');
    const [mcSims, setMcSims] = useState(1000);
    const [mcCapital, setMcCapital] = useState(10000);
    const [mcResult, setMcResult] = useState<any>(null);

    // ── HMM ──
    const [hmmPrices, setHmmPrices] = useState('');
    const [hmmStates, setHmmStates] = useState(3);
    const [hmmResult, setHmmResult] = useState<any>(null);

    // ── Walk-Forward ──
    const [wfReturns, setWfReturns] = useState('');
    const [wfTrain, setWfTrain] = useState(252);
    const [wfTest, setWfTest] = useState(63);
    const [wfResult, setWfResult] = useState<any>(null);

    // ── VaR/CVaR ──
    const [varReturns, setVarReturns] = useState('');
    const [varConf, setVarConf] = useState(0.95);
    const [varPortVal, setVarPortVal] = useState(100000);
    const [varResult, setVarResult] = useState<any>(null);

    // ── Cointegration ──
    const [cointA, setCointA] = useState('');
    const [cointB, setCointB] = useState('');
    const [cointResult, setCointResult] = useState<any>(null);

    const parseList = (s: string): number[] => s.split(/[,\n\s]+/).map(Number).filter(n => !isNaN(n));

    const run = async (fn: () => Promise<void>) => {
        setIsRunning(true);
        setError(null);
        try { await fn(); } catch (e: any) { setError(e.message); } finally { setIsRunning(false); }
    };

    const runMCPT = () => run(async () => {
        const end = new Date().toISOString().split('T')[0];
        const start = new Date();
        start.setFullYear(start.getFullYear() - 1);
        const res = await api.runMCPT({ symbol: mcptSymbol, startDate: start.toISOString().split('T')[0], endDate: end, timeframe: mcptTf, permutations: mcptPerms });
        if (res.data.success) setMcptResult(res.data);
        else throw new Error(res.data.error || 'MCPT failed');
    });

    const runMC = () => run(async () => {
        const trades = parseList(mcTrades).map(p => ({ pnl: p }));
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

    const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all";
    const textareaCls = `${inputCls} font-mono text-xs min-h-[80px]`;

    const RunBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
        <button onClick={onClick} disabled={isRunning}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium transition-all shadow-md h-[38px] min-w-[120px] justify-center">
            {isRunning ? <><Loader2 className="w-4 h-4 animate-spin" /> Running</> : <><Play className="w-4 h-4" /> {label}</>}
        </button>
    );

    const Stat = ({ label, value, color = 'foreground' }: { label: string; value: string | number; color?: string }) => (
        <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
            <div className={`text-2xl font-bold text-${color}`}>{value}</div>
        </div>
    );

    return (
        <WindowModal open={open} onOpenChange={onOpenChange}
            title={<div className="flex items-center gap-2"><FlaskConical className="w-5 h-5 text-purple-400" /><span>Research & Quant Tools</span><span className="text-muted-foreground font-normal ml-2">— {strategyName}</span></div>}
            defaultWidth={1000} defaultHeight={700} minWidth={700} minHeight={450}>
            <div className="flex h-full flex-col">
                {/* Tabs */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-muted/20 overflow-x-auto">
                    {TABS.map(t => {
                        const Icon = t.icon;
                        return (
                            <button key={t.id} onClick={() => { setActiveTab(t.id); setError(null); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${activeTab === t.id ? `bg-${t.color}-500/20 text-${t.color}-400` : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}>
                                <Icon className="w-3.5 h-3.5" />{t.label}
                            </button>
                        );
                    })}
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mx-6 mt-4 flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 space-y-6">

                    {/* ── MCPT ── */}
                    {activeTab === 'mcpt' && (<div className="space-y-5">
                        <div><h3 className="text-lg font-semibold">Monte Carlo Permutation Test</h3><p className="text-sm text-muted-foreground mt-1">Validates if strategy performance is genuinely predictive or overfit by shuffling price sequences.</p></div>
                        <div className="flex gap-4 items-end bg-card border border-border/50 rounded-xl p-4">
                            <div className="space-y-1.5 flex-1"><label className="text-xs font-medium text-muted-foreground">Symbol</label><input value={mcptSymbol} onChange={e => setMcptSymbol(e.target.value.toUpperCase())} className={inputCls} /></div>
                            <div className="space-y-1.5 flex-1"><label className="text-xs font-medium text-muted-foreground">Permutations</label><input type="number" min={10} max={1000} value={mcptPerms} onChange={e => setMcptPerms(+e.target.value)} className={inputCls} /></div>
                            <div className="space-y-1.5 flex-1"><label className="text-xs font-medium text-muted-foreground">Timeframe</label><select value={mcptTf} onChange={e => setMcptTf(e.target.value)} className={inputCls}><option value="15m">15m</option><option value="1h">1h</option><option value="1d">1d</option></select></div>
                            <RunBtn onClick={runMCPT} label="Run MCPT" />
                        </div>
                        {mcptResult && (<div className="grid grid-cols-2 gap-4"><Stat label="P-Value" value={mcptResult.pValue?.toFixed(4)} color={mcptResult.pValue < 0.05 ? 'green-400' : 'amber-400'} /><Stat label="Real Profit Factor" value={mcptResult.realPf?.toFixed(2)} /></div>)}
                        {mcptResult?.plotImage && (<div className="rounded-xl overflow-hidden border border-border/30 bg-black"><img src={mcptResult.plotImage} alt="MCPT" className="w-full max-h-[350px] object-contain" /></div>)}
                    </div>)}

                    {/* ── Monte Carlo Simulation ── */}
                    {activeTab === 'montecarlo' && (<div className="space-y-5">
                        <div><h3 className="text-lg font-semibold">Monte Carlo Simulation</h3><p className="text-sm text-muted-foreground mt-1">Randomize trade order to generate a distribution of possible equity outcomes. Paste PnL values (comma or newline separated).</p></div>
                        <div className="grid grid-cols-3 gap-4 bg-card border border-border/50 rounded-xl p-4">
                            <div className="col-span-3"><label className="text-xs font-medium text-muted-foreground">Trade PnLs</label><textarea value={mcTrades} onChange={e => setMcTrades(e.target.value)} placeholder="100, -50, 200, -30, 150, ..." className={textareaCls} /></div>
                            <div><label className="text-xs font-medium text-muted-foreground">Simulations</label><input type="number" value={mcSims} onChange={e => setMcSims(+e.target.value)} className={inputCls} /></div>
                            <div><label className="text-xs font-medium text-muted-foreground">Initial Capital</label><input type="number" value={mcCapital} onChange={e => setMcCapital(+e.target.value)} className={inputCls} /></div>
                            <div className="flex items-end"><RunBtn onClick={runMC} label="Simulate" /></div>
                        </div>
                        {mcResult && (<div className="grid grid-cols-5 gap-3">
                            <Stat label="P5" value={`$${mcResult.percentiles.p5.toFixed(0)}`} />
                            <Stat label="P25" value={`$${mcResult.percentiles.p25.toFixed(0)}`} />
                            <Stat label="Median" value={`$${mcResult.percentiles.p50.toFixed(0)}`} />
                            <Stat label="P75" value={`$${mcResult.percentiles.p75.toFixed(0)}`} />
                            <Stat label="P95" value={`$${mcResult.percentiles.p95.toFixed(0)}`} />
                        </div>)}
                    </div>)}

                    {/* ── HMM Regime Detection ── */}
                    {activeTab === 'hmm' && (<div className="space-y-5">
                        <div><h3 className="text-lg font-semibold">Hidden Markov Model — Regime Detection</h3><p className="text-sm text-muted-foreground mt-1">Identify bull/bear/sideways market regimes from close prices using a Gaussian HMM. Paste close prices.</p></div>
                        <div className="grid grid-cols-3 gap-4 bg-card border border-border/50 rounded-xl p-4">
                            <div className="col-span-3"><label className="text-xs font-medium text-muted-foreground">Close Prices</label><textarea value={hmmPrices} onChange={e => setHmmPrices(e.target.value)} placeholder="150.5, 151.2, 149.8, ..." className={textareaCls} /></div>
                            <div><label className="text-xs font-medium text-muted-foreground">Num States</label><input type="number" min={2} max={5} value={hmmStates} onChange={e => setHmmStates(+e.target.value)} className={inputCls} /></div>
                            <div className="col-span-2 flex items-end"><RunBtn onClick={runHMM} label="Detect Regimes" /></div>
                        </div>
                        {hmmResult && (<div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                                <Stat label="Current Regime" value={hmmResult.currentRegime} color="emerald-400" />
                                <Stat label="Num States" value={hmmResult.numStates} />
                                <Stat label="Bars Analyzed" value={hmmResult.numBars} />
                            </div>
                            <div className="bg-card border border-border/50 rounded-xl p-4">
                                <h4 className="text-sm font-medium mb-2">Transition Matrix</h4>
                                <div className="font-mono text-xs space-y-1">
                                    {hmmResult.transitionMatrix?.map((row: number[], i: number) => (
                                        <div key={i} className="flex gap-4">
                                            <span className="text-muted-foreground w-20">{hmmResult.stateLabels[i] || `State ${i}`}</span>
                                            {row.map((p: number, j: number) => <span key={j} className="w-16 text-right">{(p * 100).toFixed(1)}%</span>)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>)}
                    </div>)}

                    {/* ── Walk-Forward Analysis ── */}
                    {activeTab === 'wfo' && (<div className="space-y-5">
                        <div><h3 className="text-lg font-semibold">Walk-Forward Analysis</h3><p className="text-sm text-muted-foreground mt-1">Train on a rolling window, test on the next window, repeat. Measures out-of-sample robustness. Paste daily returns.</p></div>
                        <div className="grid grid-cols-3 gap-4 bg-card border border-border/50 rounded-xl p-4">
                            <div className="col-span-3"><label className="text-xs font-medium text-muted-foreground">Strategy Returns (daily)</label><textarea value={wfReturns} onChange={e => setWfReturns(e.target.value)} placeholder="0.01, -0.005, 0.003, ..." className={textareaCls} /></div>
                            <div><label className="text-xs font-medium text-muted-foreground">Train Window (bars)</label><input type="number" value={wfTrain} onChange={e => setWfTrain(+e.target.value)} className={inputCls} /></div>
                            <div><label className="text-xs font-medium text-muted-foreground">Test Window (bars)</label><input type="number" value={wfTest} onChange={e => setWfTest(+e.target.value)} className={inputCls} /></div>
                            <div className="flex items-end"><RunBtn onClick={runWF} label="Analyze" /></div>
                        </div>
                        {wfResult && (<div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                                <Stat label="OOS Sharpe" value={wfResult.overallOOSSharpe} color={wfResult.overallOOSSharpe > 0.5 ? 'green-400' : 'amber-400'} />
                                <Stat label="Avg IS Sharpe" value={wfResult.avgISSharpe} />
                                <Stat label="Efficiency" value={`${(wfResult.efficiency * 100).toFixed(0)}%`} color={wfResult.efficiency > 0.5 ? 'green-400' : 'red-400'} />
                            </div>
                            <div className="bg-card border border-border/50 rounded-xl p-4 max-h-[200px] overflow-auto">
                                <h4 className="text-sm font-medium mb-2">Windows</h4>
                                <table className="w-full text-xs"><thead><tr className="text-muted-foreground"><th className="text-left">Window</th><th className="text-right">IS Sharpe</th><th className="text-right">OOS Sharpe</th><th className="text-right">IS Return</th><th className="text-right">OOS Return</th></tr></thead>
                                    <tbody>{wfResult.windows?.map((w: any, i: number) => (<tr key={i} className="border-t border-border/30"><td>{i + 1}</td><td className="text-right">{w.trainSharpe}</td><td className="text-right">{w.testSharpe}</td><td className="text-right">{w.trainReturn}%</td><td className="text-right">{w.testReturn}%</td></tr>))}</tbody></table>
                            </div>
                        </div>)}
                    </div>)}

                    {/* ── VaR / CVaR ── */}
                    {activeTab === 'var' && (<div className="space-y-5">
                        <div><h3 className="text-lg font-semibold">Value at Risk / Conditional VaR</h3><p className="text-sm text-muted-foreground mt-1">Estimate worst-case losses at a given confidence level. Paste daily returns (as decimals, e.g., -0.02 = -2%).</p></div>
                        <div className="grid grid-cols-3 gap-4 bg-card border border-border/50 rounded-xl p-4">
                            <div className="col-span-3"><label className="text-xs font-medium text-muted-foreground">Daily Returns</label><textarea value={varReturns} onChange={e => setVarReturns(e.target.value)} placeholder="0.01, -0.02, 0.005, ..." className={textareaCls} /></div>
                            <div><label className="text-xs font-medium text-muted-foreground">Confidence</label><input type="number" step={0.01} min={0.9} max={0.99} value={varConf} onChange={e => setVarConf(+e.target.value)} className={inputCls} /></div>
                            <div><label className="text-xs font-medium text-muted-foreground">Portfolio Value ($)</label><input type="number" value={varPortVal} onChange={e => setVarPortVal(+e.target.value)} className={inputCls} /></div>
                            <div className="flex items-end"><RunBtn onClick={runVaR} label="Calculate" /></div>
                        </div>
                        {varResult && (<div className="grid grid-cols-4 gap-3">
                            <Stat label={`VaR (${(varConf * 100).toFixed(0)}%)`} value={`${varResult.var?.toFixed(2)}%`} color="red-400" />
                            <Stat label="CVaR (ES)" value={`${varResult.cvar?.toFixed(2)}%`} color="red-400" />
                            <Stat label="VaR ($)" value={`$${varResult.varDollar?.toLocaleString()}`} />
                            <Stat label="CVaR ($)" value={`$${varResult.cvarDollar?.toLocaleString()}`} />
                        </div>)}
                    </div>)}

                    {/* ── Cointegration ── */}
                    {activeTab === 'coint' && (<div className="space-y-5">
                        <div><h3 className="text-lg font-semibold">Cointegration Test (Engle-Granger)</h3><p className="text-sm text-muted-foreground mt-1">Test if two price series are cointegrated for pairs trading. Paste close prices for each series.</p></div>
                        <div className="grid grid-cols-2 gap-4 bg-card border border-border/50 rounded-xl p-4">
                            <div><label className="text-xs font-medium text-muted-foreground">Prices A</label><textarea value={cointA} onChange={e => setCointA(e.target.value)} placeholder="150.5, 151.2, ..." className={textareaCls} /></div>
                            <div><label className="text-xs font-medium text-muted-foreground">Prices B</label><textarea value={cointB} onChange={e => setCointB(e.target.value)} placeholder="75.3, 76.1, ..." className={textareaCls} /></div>
                            <div className="col-span-2 flex justify-end"><RunBtn onClick={runCoint} label="Test" /></div>
                        </div>
                        {cointResult && (<div className="grid grid-cols-4 gap-3">
                            <Stat label="Cointegrated?" value={cointResult.cointegrated ? 'YES' : 'NO'} color={cointResult.cointegrated ? 'green-400' : 'red-400'} />
                            <Stat label="P-Value" value={cointResult.pValue?.toFixed(4)} />
                            <Stat label="Hedge Ratio" value={cointResult.hedgeRatio?.toFixed(4)} />
                            <Stat label="Current Z-Score" value={cointResult.zScore?.toFixed(2)} />
                        </div>)}
                    </div>)}

                    {/* ── Param Sweep ── */}
                    {activeTab === 'sweep' && (<div className="space-y-5">
                        <div><h3 className="text-lg font-semibold">Parameter Sensitivity Sweep</h3><p className="text-sm text-muted-foreground mt-1">Run backtest across a range of parameter values and compare Sharpe, return, and drawdown.</p></div>
                        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border/50 rounded-xl opacity-60">
                            <SlidersHorizontal className="w-12 h-12 text-muted-foreground mb-4" />
                            <h4 className="text-lg font-medium">Coming Soon</h4>
                            <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
                                Parameter sweep will automatically vary indicator parameters across your strategy
                                and run backtests for each combination, producing a heatmap of results.
                            </p>
                        </div>
                    </div>)}
                </div>
            </div>
        </WindowModal>
    );
};
