import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { DraggableModal } from "./DraggableModal";
import { Button } from "./ui/button";
import { FileText, BarChart3, List, ArrowUpRight, ArrowDownRight, Clock, TrendingUp, TrendingDown, Filter, PieChart } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent } from "./ui/card";
import { Model, Layout, IJsonModel, TabNode } from "flexlayout-react";
import "flexlayout-react/style/dark.css";

interface Trade {
    entry_time: string;
    exit_time: string;
    entry_price: number;
    exit_price: number;
    size: number;
    pnl: number;
    return_pct: number;
    type: string;
    side?: string;
    profit_loss?: number;
    cumulativePnl?: number;
}

interface BacktestVisualizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    htmlContent: string | null;
    rawStats?: string | null;
    trades?: Trade[];
    title?: string;
}

const formatNumber = (value: number | undefined, decimals: number = 2): string => {
    if (value === undefined || value === null || isNaN(value)) return "N/A";
    return value.toFixed(decimals);
};

const formatDateTime = (dateStr: string): string => {
    try {
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
};

const formatDuration = (entryTime: string, exitTime: string): string => {
    try {
        const entry = new Date(entryTime);
        const exit = new Date(exitTime);
        const diffMs = exit.getTime() - entry.getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    } catch {
        return "N/A";
    }
};

// FlexLayout configuration
const createLayoutModel = (hasChart: boolean, hasStats: boolean): IJsonModel => ({
    global: {
        tabEnableClose: false,
        tabEnableRename: false,
        borderSize: 0,
        tabSetEnableMaximize: true,
        tabSetEnableDivide: true,
        splitterSize: 4,
        splitterExtra: 4,
    },
    borders: [],
    layout: {
        type: "row",
        weight: 100,
        children: [
            {
                type: "row",
                weight: 55,
                children: [
                    {
                        type: "tabset",
                        weight: 100,
                        children: [
                            ...(hasChart ? [{
                                type: "tab",
                                name: "📈 Chart",
                                component: "chart",
                            }] : []),
                            ...(hasStats ? [{
                                type: "tab",
                                name: "📊 Raw Stats",
                                component: "stats",
                            }] : []),
                        ],
                    },
                ],
            },
            {
                type: "row",
                weight: 45,
                children: [
                    {
                        type: "tabset",
                        weight: 40,
                        children: [
                            {
                                type: "tab",
                                name: "📊 Summary",
                                component: "summary",
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 60,
                        children: [
                            {
                                type: "tab",
                                name: "📋 Trades",
                                component: "trades",
                            },
                        ],
                    },
                ],
            },
        ],
    },
});

export const BacktestVisualizationModal = ({
    isOpen,
    onClose,
    htmlContent,
    rawStats,
    trades = [],
    title = "Backtest Results"
}: BacktestVisualizationModalProps) => {
    const [tradeFilter, setTradeFilter] = useState<"all" | "wins" | "losses">("all");
    const modelRef = useRef<Model | null>(null);

    const hasTrades = trades && trades.length > 0;
    const hasChart = htmlContent !== null;
    const hasStats = rawStats !== null;

    // Initialize model
    useEffect(() => {
        if (isOpen) {
            modelRef.current = Model.fromJson(createLayoutModel(hasChart, hasStats));
        }
    }, [isOpen, hasChart, hasStats]);

    // Calculate trade analytics
    const analytics = useMemo(() => {
        if (!hasTrades) return null;
        const wins = trades.filter(t => t.pnl > 0);
        const losses = trades.filter(t => t.pnl < 0);
        const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
        const sortedByPnl = [...trades].sort((a, b) => b.pnl - a.pnl);
        const bestTrade = sortedByPnl[0];
        const worstTrade = sortedByPnl[sortedByPnl.length - 1];
        const durations = trades.map(t => new Date(t.exit_time).getTime() - new Date(t.entry_time).getTime());
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const avgDays = Math.floor(avgDuration / (1000 * 60 * 60 * 24));
        const avgHours = Math.floor((avgDuration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const avgDurationStr = avgDays > 0 ? `${avgDays}d ${avgHours}h` : `${avgHours}h`;
        const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0;
        const winRate = wins.length / trades.length;
        const lossRate = losses.length / trades.length;
        const expectancy = (winRate * avgWin) + (lossRate * avgLoss);
        let cumulative = 0;
        const tradesWithCumulative = trades.map(t => {
            cumulative += t.pnl;
            return { ...t, cumulativePnl: cumulative };
        });
        return {
            winCount: wins.length, lossCount: losses.length, totalPnL, bestTrade, worstTrade,
            avgDuration: avgDurationStr, avgWin, avgLoss, expectancy, tradesWithCumulative,
            winRate: (wins.length / trades.length) * 100
        };
    }, [trades, hasTrades]);

    const filteredTrades = useMemo(() => {
        if (!analytics) return [];
        const base = analytics.tradesWithCumulative;
        switch (tradeFilter) {
            case "wins": return base.filter(t => t.pnl > 0);
            case "losses": return base.filter(t => t.pnl < 0);
            default: return base;
        }
    }, [analytics, tradeFilter]);

    // Panel components
    const ChartPanel = () => (
        <div className="w-full h-full bg-white">
            <iframe
                title="Backtest Plot"
                srcDoc={htmlContent || ''}
                className="w-full h-full border-none"
                sandbox="allow-scripts allow-popups allow-forms"
            />
        </div>
    );

    const StatsPanel = () => (
        <ScrollArea className="h-full">
            <div className="p-4 font-mono text-xs whitespace-pre text-foreground">
                {rawStats}
            </div>
        </ScrollArea>
    );

    const SummaryPanel = () => (
        <ScrollArea className="h-full">
            {analytics ? (
                <div className="p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <Card className="bg-muted/30">
                            <CardContent className="p-3 text-center">
                                <div className="text-[10px] text-muted-foreground uppercase">Win Rate</div>
                                <div className="text-base font-bold">{formatNumber(analytics.winRate, 1)}%</div>
                                <div className="text-[10px] text-muted-foreground">{analytics.winCount}W / {analytics.lossCount}L</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-muted/30">
                            <CardContent className="p-3 text-center">
                                <div className="text-[10px] text-muted-foreground uppercase">Total P&L</div>
                                <div className={`text-base font-bold ${analytics.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {analytics.totalPnL >= 0 ? '+' : ''}{formatNumber(analytics.totalPnL)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">{trades.length} trades</div>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Card className="bg-green-500/10 border-green-500/20">
                            <CardContent className="p-2">
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3 text-green-500" /> Best
                                </div>
                                <div className="text-sm font-bold text-green-500">+{formatNumber(analytics.bestTrade?.pnl)}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-red-500/10 border-red-500/20">
                            <CardContent className="p-2">
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <TrendingDown className="w-3 h-3 text-red-500" /> Worst
                                </div>
                                <div className="text-sm font-bold text-red-500">{formatNumber(analytics.worstTrade?.pnl)}</div>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-muted/30 rounded">
                            <div className="text-[10px] text-muted-foreground">Avg Win</div>
                            <div className="text-sm font-bold text-green-500">+{formatNumber(analytics.avgWin)}</div>
                        </div>
                        <div className="p-2 bg-muted/30 rounded">
                            <div className="text-[10px] text-muted-foreground">Avg Loss</div>
                            <div className="text-sm font-bold text-red-500">{formatNumber(analytics.avgLoss)}</div>
                        </div>
                        <div className="p-2 bg-muted/30 rounded">
                            <div className="text-[10px] text-muted-foreground">Expectancy</div>
                            <div className={`text-sm font-bold ${analytics.expectancy >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {analytics.expectancy >= 0 ? '+' : ''}{formatNumber(analytics.expectancy)}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                    <PieChart className="w-8 h-8 opacity-50" />
                </div>
            )}
        </ScrollArea>
    );

    const TradesPanel = () => (
        <div className="h-full flex flex-col">
            {hasTrades && analytics ? (
                <>
                    <div className="flex items-center gap-2 p-2 border-b">
                        <Filter className="w-3 h-3 text-muted-foreground" />
                        <div className="flex gap-1 bg-muted/50 p-0.5 rounded">
                            {(['all', 'wins', 'losses'] as const).map(f => (
                                <Button
                                    key={f}
                                    variant={tradeFilter === f ? "secondary" : "ghost"}
                                    size="sm"
                                    className="h-5 text-[10px] px-2"
                                    onClick={() => setTradeFilter(f)}
                                >
                                    {f === 'all' && `All (${trades.length})`}
                                    {f === 'wins' && <span className="text-green-500">Wins ({analytics.winCount})</span>}
                                    {f === 'losses' && <span className="text-red-500">Losses ({analytics.lossCount})</span>}
                                </Button>
                            ))}
                        </div>
                        <Badge variant={analytics.totalPnL >= 0 ? "default" : "destructive"} className="ml-auto text-[10px]">
                            {analytics.totalPnL >= 0 ? "+" : ""}{formatNumber(analytics.totalPnL)} P&L
                        </Badge>
                    </div>
                    <ScrollArea className="flex-1">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-[10px]">
                                    <TableHead className="w-8">#</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Entry</TableHead>
                                    <TableHead>Exit</TableHead>
                                    <TableHead className="text-right">P&L</TableHead>
                                    <TableHead className="text-right">Cum.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTrades.map((trade, idx) => (
                                    <TableRow key={idx} className="text-[10px]">
                                        <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                                        <TableCell>
                                            <Badge variant={(trade.type || trade.side) === "long" || (trade.type || trade.side) === "buy" ? "default" : "secondary"} className="text-[9px] px-1">
                                                {(trade.type || trade.side) === "long" || (trade.type || trade.side) === "buy" ? "↑" : "↓"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-muted-foreground">{formatDateTime(trade.entry_time)}</TableCell>
                                        <TableCell className="font-mono text-muted-foreground">{formatDateTime(trade.exit_time)}</TableCell>
                                        <TableCell className={`text-right font-mono ${(trade.pnl ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {(trade.pnl ?? 0) >= 0 ? '+' : ''}{formatNumber(trade.pnl ?? 0)}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono ${(trade.cumulativePnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {(trade.cumulativePnl ?? 0) >= 0 ? '+' : ''}{formatNumber(trade.cumulativePnl ?? 0)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </>
            ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                        <List className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No trades</p>
                    </div>
                </div>
            )}
        </div>
    );

    const factory = useCallback((node: TabNode) => {
        const component = node.getComponent();
        switch (component) {
            case "chart": return <ChartPanel />;
            case "stats": return <StatsPanel />;
            case "summary": return <SummaryPanel />;
            case "trades": return <TradesPanel />;
            default: return <div>Unknown</div>;
        }
    }, [htmlContent, rawStats, analytics, filteredTrades, tradeFilter]);

    if (!isOpen || !modelRef.current) return null;

    return (
        <DraggableModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            defaultWidth={1200}
            defaultHeight={750}
        >
            <div className="w-full h-full relative">
                <style>{`
                    .flexlayout__layout {
                        --color-tabset-header-background: transparent;
                        --color-tabset-background: transparent;
                        --color-tab-selected-background: rgba(59, 130, 246, 0.15);
                        --color-tab-unselected-background: transparent;
                        --color-tab-selected: #fff;
                        --color-tab-unselected: #888;
                        --color-splitter: rgba(255, 255, 255, 0.1);
                        --color-splitter-drag: rgba(59, 130, 246, 0.5);
                        --font-size: 11px;
                        background: transparent !important;
                    }
                    .flexlayout__tabset {
                        background: rgba(15, 15, 15, 0.5) !important;
                        border-radius: 8px;
                        overflow: hidden;
                        border: 1px solid rgba(255, 255, 255, 0.05);
                    }
                    .flexlayout__tabset_header {
                        background: rgba(0, 0, 0, 0.3) !important;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    }
                    .flexlayout__tab { background: transparent !important; }
                    .flexlayout__tab_button {
                        padding: 3px 10px !important;
                        border-radius: 4px !important;
                        margin: 2px !important;
                        font-weight: 500;
                    }
                    .flexlayout__tab_button--selected {
                        background: rgba(59, 130, 246, 0.2) !important;
                    }
                    .flexlayout__splitter {
                        background: rgba(255, 255, 255, 0.05) !important;
                    }
                    .flexlayout__splitter:hover {
                        background: rgba(59, 130, 246, 0.3) !important;
                    }
                `}</style>
                <Layout model={modelRef.current} factory={factory} realtimeResize={true} />
            </div>
        </DraggableModal>
    );
};
