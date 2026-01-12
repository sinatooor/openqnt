/**
 * StrategyComparison - Side-by-side comparison of backtest results
 * Allows comparing 2 strategies with highlighting of best metrics
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Download,
    Trophy,
    TrendingUp,
    TrendingDown,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BacktestResultSummary {
    strategyName: string;
    timestamp: string;
    symbol: string;
    totalReturn: number;
    winRate: number;
    totalTrades: number;
    maxDrawdown: number;
    sharpeRatio?: number;
    profitFactor?: number;
    finalBalance: number;
}

const STORAGE_KEY = 'ppm_backtest_results';

// Utility to get stored results
export const getStoredBacktestResults = (): BacktestResultSummary[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

// Utility to save a result
export const saveBacktestResult = (result: BacktestResultSummary) => {
    const existing = getStoredBacktestResults();
    const updated = [result, ...existing].slice(0, 20); // Keep last 20
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

interface StrategyComparisonProps {
    onClose?: () => void;
}

export const StrategyComparison = ({ onClose }: StrategyComparisonProps) => {
    const [strategy1, setStrategy1] = useState<string>('');
    const [strategy2, setStrategy2] = useState<string>('');

    const results = getStoredBacktestResults();

    const result1 = useMemo(() => results.find(r => r.timestamp === strategy1), [results, strategy1]);
    const result2 = useMemo(() => results.find(r => r.timestamp === strategy2), [results, strategy2]);

    const metrics: {
        key: keyof BacktestResultSummary;
        label: string;
        format: (v: any) => string;
        higherIsBetter: boolean;
    }[] = [
            { key: 'totalReturn', label: 'Total Return', format: (v) => `${v?.toFixed(2) || 'N/A'}%`, higherIsBetter: true },
            { key: 'winRate', label: 'Win Rate', format: (v) => `${v?.toFixed(2) || 'N/A'}%`, higherIsBetter: true },
            { key: 'totalTrades', label: 'Total Trades', format: (v) => String(v || 0), higherIsBetter: true },
            { key: 'maxDrawdown', label: 'Max Drawdown', format: (v) => `${v?.toFixed(2) || 'N/A'}%`, higherIsBetter: false },
            { key: 'sharpeRatio', label: 'Sharpe Ratio', format: (v) => v?.toFixed(2) || 'N/A', higherIsBetter: true },
            { key: 'profitFactor', label: 'Profit Factor', format: (v) => v?.toFixed(2) || 'N/A', higherIsBetter: true },
            { key: 'finalBalance', label: 'Final Balance', format: (v) => `$${v?.toLocaleString() || 'N/A'}`, higherIsBetter: true },
        ];

    const getWinner = (key: keyof BacktestResultSummary, higherIsBetter: boolean): 1 | 2 | null => {
        if (!result1 || !result2) return null;
        const val1 = result1[key] as number | undefined;
        const val2 = result2[key] as number | undefined;
        if (val1 === undefined || val2 === undefined) return null;
        if (val1 === val2) return null;
        if (higherIsBetter) {
            return val1 > val2 ? 1 : 2;
        } else {
            return val1 < val2 ? 1 : 2;
        }
    };

    const handleExportCSV = () => {
        if (!result1 || !result2) {
            toast.error('Select two strategies to compare');
            return;
        }

        const headers = ['Metric', result1.strategyName, result2.strategyName];
        const rows = metrics.map(m => [
            m.label,
            m.format(result1[m.key]),
            m.format(result2[m.key])
        ]);

        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'strategy-comparison.csv';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Comparison exported');
    };

    if (results.length < 2) {
        return (
            <Card className="bg-muted/30">
                <CardContent className="p-4 text-center text-muted-foreground">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Run at least 2 backtests to compare strategies</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-muted/30">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        Strategy Comparison
                    </CardTitle>
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={handleExportCSV}
                            disabled={!result1 || !result2}
                        >
                            <Download className="w-3 h-3 mr-1" />
                            CSV
                        </Button>
                        {onClose && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                                <X className="w-3 h-3" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Strategy Selectors */}
                <div className="grid grid-cols-2 gap-2">
                    <Select value={strategy1} onValueChange={setStrategy1}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select Strategy A" />
                        </SelectTrigger>
                        <SelectContent>
                            {results.filter(r => r.timestamp !== strategy2).map((r) => (
                                <SelectItem key={r.timestamp} value={r.timestamp}>
                                    {r.strategyName} ({r.symbol})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={strategy2} onValueChange={setStrategy2}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select Strategy B" />
                        </SelectTrigger>
                        <SelectContent>
                            {results.filter(r => r.timestamp !== strategy1).map((r) => (
                                <SelectItem key={r.timestamp} value={r.timestamp}>
                                    {r.strategyName} ({r.symbol})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {result1 && result2 && (
                    <>
                        <Separator />

                        {/* Comparison Table */}
                        <div className="space-y-1">
                            {/* Header */}
                            <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground font-medium px-1">
                                <span>Metric</span>
                                <span className="text-center truncate">{result1.strategyName}</span>
                                <span className="text-center truncate">{result2.strategyName}</span>
                            </div>

                            {/* Rows */}
                            {metrics.map((metric) => {
                                const winner = getWinner(metric.key, metric.higherIsBetter);
                                return (
                                    <div key={metric.key} className="grid grid-cols-3 gap-2 text-xs py-1 px-1 rounded hover:bg-muted/50">
                                        <span className="text-muted-foreground">{metric.label}</span>
                                        <span className={cn(
                                            "text-center font-mono",
                                            winner === 1 && "text-green-500 font-semibold"
                                        )}>
                                            {metric.format(result1[metric.key])}
                                            {winner === 1 && <Trophy className="w-3 h-3 inline ml-1 text-yellow-500" />}
                                        </span>
                                        <span className={cn(
                                            "text-center font-mono",
                                            winner === 2 && "text-green-500 font-semibold"
                                        )}>
                                            {metric.format(result2[metric.key])}
                                            {winner === 2 && <Trophy className="w-3 h-3 inline ml-1 text-yellow-500" />}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default StrategyComparison;
