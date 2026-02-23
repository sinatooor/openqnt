import { useState } from 'react';
import { Layers, FlaskConical, Play, BarChart2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { WindowModal } from './WindowModal';
import { api } from '@/services/api';
import { useStrategyFlowStore } from '../../store/strategyFlowStore';

export interface ResearchModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const ResearchModal = ({ open, onOpenChange }: ResearchModalProps) => {
    const { strategyName } = useStrategyFlowStore();
    const [activeTab, setActiveTab] = useState<'mcpt' | 'wfo' | 'corr'>('mcpt');

    // MCPT Form State
    const [symbol, setSymbol] = useState('BTCUSD');
    const [permutations, setPermutations] = useState<number>(100);
    const [timeframe, setTimeframe] = useState('1d');

    // MCPT Results
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{
        pValue: number;
        realPf: number;
        plotImage?: string;
    } | null>(null);

    const runMCPT = async () => {
        setIsRunning(true);
        setError(null);
        setResult(null);

        try {
            // Create a date range covering the last year approx
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - 1);
            const startStr = startDate.toISOString().split('T')[0];

            const res = await api.runMCPT({
                symbol,
                startDate: startStr,
                endDate,
                timeframe,
                permutations,
            });

            if (res.data.success) {
                setResult({
                    pValue: res.data.pValue,
                    realPf: res.data.realPf,
                    plotImage: res.data.plotImage,
                });
            } else {
                setError(res.data.error || 'Failed to run MCPT');
            }
        } catch (err: any) {
            setError(err?.message || 'Network error executing MCPT');
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <WindowModal
            open={open}
            onOpenChange={onOpenChange}
            title={
                <div className="flex items-center gap-2">
                    <FlaskConical className="w-5 h-5 text-purple-400" />
                    <span>Research & Quant Tools</span>
                    <span className="text-muted-foreground font-normal ml-2">— {strategyName}</span>
                </div>
            }
            defaultWidth={900}
            defaultHeight={650}
            minWidth={600}
            minHeight={400}
        >
            <div className="flex h-full flex-col">
                {/* Navigation Tabs */}
                <div className="flex items-center gap-4 px-6 py-3 border-b border-border/50 bg-muted/20">
                    <button
                        onClick={() => setActiveTab('mcpt')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'mcpt'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                            }`}
                    >
                        <BarChart2 className="w-4 h-4" />
                        Monte Carlo Permutations
                    </button>
                    <button
                        onClick={() => setActiveTab('wfo')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'wfo'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                            }`}
                    >
                        <Layers className="w-4 h-4" />
                        Walk-Forward Analysis
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-6">
                    {activeTab === 'mcpt' && (
                        <div className="space-y-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground">Monte Carlo Permutation Test</h3>
                                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                                        Validates if your strategy's performance is genuinely predictive or overfit by shuffling
                                        price sequences and recalculating the profit factor.
                                    </p>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex gap-4 items-end bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                                <div className="space-y-1.5 flex-1">
                                    <label className="text-xs font-medium text-muted-foreground pl-1">Symbol</label>
                                    <input
                                        type="text"
                                        value={symbol}
                                        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5 flex-1">
                                    <label className="text-xs font-medium text-muted-foreground pl-1">Permutations</label>
                                    <input
                                        type="number"
                                        min="10"
                                        max="1000"
                                        step="10"
                                        value={permutations}
                                        onChange={(e) => setPermutations(parseInt(e.target.value))}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5 flex-1">
                                    <label className="text-xs font-medium text-muted-foreground pl-1">Timeframe</label>
                                    <select
                                        value={timeframe}
                                        onChange={(e) => setTimeframe(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all"
                                    >
                                        <option value="15m">15m</option>
                                        <option value="1h">1h</option>
                                        <option value="1d">1d</option>
                                    </select>
                                </div>

                                <button
                                    onClick={runMCPT}
                                    disabled={isRunning}
                                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition-all shadow-md focus:ring-2 focus:ring-purple-500/50 focus:outline-none h-[38px] min-w-[120px] justify-center"
                                >
                                    {isRunning ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Running</>
                                    ) : (
                                        <><Play className="w-4 h-4" /> Run MCPT</>
                                    )}
                                </button>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm">{error}</div>
                                </div>
                            )}

                            {/* Results */}
                            {result && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-card border border-border/50 rounded-xl p-5 shadow-sm">
                                            <div className="text-xs font-medium text-muted-foreground mb-1">In-Sample P-Value</div>
                                            <div className={`text-3xl font-bold ${result.pValue < 0.05 ? 'text-green-400' : 'text-amber-400'}`}>
                                                {result.pValue.toFixed(4)}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-2">
                                                {result.pValue < 0.05
                                                    ? 'Statistically significant predictive power.'
                                                    : 'High probability of overfitting. Strategy may not generalize.'}
                                            </div>
                                        </div>
                                        <div className="bg-card border border-border/50 rounded-xl p-5 shadow-sm">
                                            <div className="text-xs font-medium text-muted-foreground mb-1">Real Profit Factor</div>
                                            <div className="text-3xl font-bold text-foreground">
                                                {result.realPf.toFixed(2)}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-2">
                                                Gross profit divided by gross loss on actual market data.
                                            </div>
                                        </div>
                                    </div>

                                    {result.plotImage && (
                                        <div className="bg-card glass border border-border/50 rounded-xl p-4 shadow-sm">
                                            <h4 className="text-sm font-medium text-foreground mb-4 pl-2">Distribution of Permuted Profit Factors</h4>
                                            <div className="rounded-lg overflow-hidden border border-border/30 bg-[#000000]">
                                                <img
                                                    src={result.plotImage}
                                                    alt="MCPT Plot"
                                                    className="w-full max-h-[400px] object-contain"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Default Empty State */}
                            {!result && !isRunning && !error && (
                                <div className="flex flex-col items-center justify-center p-12 mt-8 border-2 border-dashed border-border/50 rounded-xl opacity-60">
                                    <FlaskConical className="w-12 h-12 text-muted-foreground mb-4" />
                                    <h4 className="text-lg font-medium text-foreground">Ready to analyze</h4>
                                    <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
                                        Configure your parameters and run the permutation test to evaluate your strategy's robustness.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'wfo' && (
                        <div className="flex flex-col items-center justify-center h-full opacity-60">
                            <RefreshCw className="w-12 h-12 text-blue-400 mb-4" />
                            <h3 className="text-lg font-medium text-foreground">Walk-Forward Analysis</h3>
                            <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
                                Walk-forward optimization tests strategy parameters over rolling out-of-sample periods to estimate future performance stability. Coming soon.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </WindowModal>
    );
};
