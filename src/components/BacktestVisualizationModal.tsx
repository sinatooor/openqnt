import { useState, useMemo } from "react";
import { DraggableModal } from "./DraggableModal";
import { Button } from "./ui/button";
import { FileText, BarChart3, List, ArrowUpRight, ArrowDownRight, Clock, TrendingUp, TrendingDown, Filter, PieChart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent } from "./ui/card";

interface Trade {
    entry_time: string;
    exit_time: string;
    entry_price: number;
    exit_price: number;
    size: number;
    pnl: number;
    return_pct: number;
    type: string;
    // Optional properties for Nautilus engine compatibility
    side?: string;
    profit_loss?: number;
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
            year: 'numeric',
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

export const BacktestVisualizationModal = ({
    isOpen,
    onClose,
    htmlContent,
    rawStats,
    trades = [],
    title = "Backtest Results"
}: BacktestVisualizationModalProps) => {
    const [activeTab, setActiveTab] = useState<"chart" | "trades" | "summary" | "stats">("chart");
    const [tradeFilter, setTradeFilter] = useState<"all" | "wins" | "losses">("all");

    const hasTrades = trades && trades.length > 0;
    const hasChart = htmlContent !== null;
    const hasStats = rawStats !== null;

    // Calculate trade analytics
    const analytics = useMemo(() => {
        if (!hasTrades) return null;

        const wins = trades.filter(t => t.pnl > 0);
        const losses = trades.filter(t => t.pnl < 0);
        const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);

        // Best and worst trades
        const sortedByPnl = [...trades].sort((a, b) => b.pnl - a.pnl);
        const bestTrade = sortedByPnl[0];
        const worstTrade = sortedByPnl[sortedByPnl.length - 1];

        // Average durations
        const durations = trades.map(t => {
            const entry = new Date(t.entry_time);
            const exit = new Date(t.exit_time);
            return exit.getTime() - entry.getTime();
        });
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

        // Format avg duration
        const avgDays = Math.floor(avgDuration / (1000 * 60 * 60 * 24));
        const avgHours = Math.floor((avgDuration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const avgDurationStr = avgDays > 0 ? `${avgDays}d ${avgHours}h` : `${avgHours}h`;

        // Win/loss averages
        const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0;

        // Expectancy
        const winRate = wins.length / trades.length;
        const lossRate = losses.length / trades.length;
        const expectancy = (winRate * avgWin) + (lossRate * avgLoss);

        // Cumulative P&L
        let cumulative = 0;
        const tradesWithCumulative = trades.map(t => {
            cumulative += t.pnl;
            return { ...t, cumulativePnl: cumulative };
        });

        return {
            winCount: wins.length,
            lossCount: losses.length,
            totalPnL,
            bestTrade,
            worstTrade,
            avgDuration: avgDurationStr,
            avgWin,
            avgLoss,
            expectancy,
            tradesWithCumulative,
            winRate: (wins.length / trades.length) * 100
        };
    }, [trades, hasTrades]);

    // Filter trades
    const filteredTrades = useMemo(() => {
        if (!analytics) return [];
        const base = analytics.tradesWithCumulative;
        switch (tradeFilter) {
            case "wins": return base.filter(t => t.pnl > 0);
            case "losses": return base.filter(t => t.pnl < 0);
            default: return base;
        }
    }, [analytics, tradeFilter]);

    return (
        <DraggableModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            defaultWidth={1200}
            defaultHeight={750}
        >
            <div className="w-full h-full flex flex-col bg-background">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col h-full">
                    <div className="border-b px-4 py-2 flex items-center justify-between">
                        <TabsList className="h-8">
                            {hasChart && (
                                <TabsTrigger value="chart" className="text-xs h-7 px-3">
                                    <BarChart3 className="w-3 h-3 mr-1" />
                                    Chart
                                </TabsTrigger>
                            )}
                            <TabsTrigger value="trades" className="text-xs h-7 px-3">
                                <List className="w-3 h-3 mr-1" />
                                Trades ({trades.length})
                            </TabsTrigger>
                            {hasTrades && (
                                <TabsTrigger value="summary" className="text-xs h-7 px-3">
                                    <PieChart className="w-3 h-3 mr-1" />
                                    Summary
                                </TabsTrigger>
                            )}
                            {hasStats && (
                                <TabsTrigger value="stats" className="text-xs h-7 px-3">
                                    <FileText className="w-3 h-3 mr-1" />
                                    Raw Stats
                                </TabsTrigger>
                            )}
                        </TabsList>

                        {activeTab === "trades" && hasTrades && analytics && (
                            <div className="flex items-center gap-3 text-xs">
                                <span className="text-muted-foreground">
                                    <span className="text-green-500">{analytics.winCount} wins</span>
                                    {" / "}
                                    <span className="text-red-500">{analytics.lossCount} losses</span>
                                </span>
                                <Badge variant={analytics.totalPnL >= 0 ? "default" : "destructive"}>
                                    {analytics.totalPnL >= 0 ? "+" : ""}{formatNumber(analytics.totalPnL)} Total P&L
                                </Badge>
                            </div>
                        )}
                    </div>

                    {hasChart && (
                        <TabsContent value="chart" className="flex-1 m-0">
                            <div className="w-full h-full bg-white">
                                <iframe
                                    title="Backtest Plot"
                                    srcDoc={htmlContent}
                                    className="w-full h-full border-none"
                                    sandbox="allow-scripts allow-popups allow-forms"
                                />
                            </div>
                        </TabsContent>
                    )}

                    <TabsContent value="trades" className="flex-1 m-0 overflow-hidden">
                        <ScrollArea className="h-full">
                            {hasTrades && analytics ? (
                                <div className="p-4 space-y-4">
                                    {/* Analytics Cards */}
                                    <div className="grid grid-cols-5 gap-3">
                                        <Card className="bg-muted/30">
                                            <CardContent className="p-3">
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    Avg Duration
                                                </div>
                                                <div className="text-lg font-bold mt-1">{analytics.avgDuration}</div>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-green-500/10 border-green-500/20">
                                            <CardContent className="p-3">
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                                    <TrendingUp className="w-3 h-3 text-green-500" />
                                                    Best Trade
                                                </div>
                                                <div className="text-lg font-bold text-green-500 mt-1">
                                                    +{formatNumber(analytics.bestTrade?.pnl)}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-red-500/10 border-red-500/20">
                                            <CardContent className="p-3">
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                                    <TrendingDown className="w-3 h-3 text-red-500" />
                                                    Worst Trade
                                                </div>
                                                <div className="text-lg font-bold text-red-500 mt-1">
                                                    {formatNumber(analytics.worstTrade?.pnl)}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-muted/30">
                                            <CardContent className="p-3">
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg Win</div>
                                                <div className="text-lg font-bold text-green-500 mt-1">
                                                    +{formatNumber(analytics.avgWin)}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-muted/30">
                                            <CardContent className="p-3">
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg Loss</div>
                                                <div className="text-lg font-bold text-red-500 mt-1">
                                                    {formatNumber(analytics.avgLoss)}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Filter Buttons */}
                                    <div className="flex items-center gap-2">
                                        <Filter className="w-4 h-4 text-muted-foreground" />
                                        <div className="flex gap-1 bg-muted/50 p-0.5 rounded-md">
                                            <Button
                                                variant={tradeFilter === "all" ? "secondary" : "ghost"}
                                                size="sm"
                                                className="h-6 text-xs px-3"
                                                onClick={() => setTradeFilter("all")}
                                            >
                                                All ({trades.length})
                                            </Button>
                                            <Button
                                                variant={tradeFilter === "wins" ? "secondary" : "ghost"}
                                                size="sm"
                                                className="h-6 text-xs px-3"
                                                onClick={() => setTradeFilter("wins")}
                                            >
                                                <span className="text-green-500">Wins ({analytics.winCount})</span>
                                            </Button>
                                            <Button
                                                variant={tradeFilter === "losses" ? "secondary" : "ghost"}
                                                size="sm"
                                                className="h-6 text-xs px-3"
                                                onClick={() => setTradeFilter("losses")}
                                            >
                                                <span className="text-red-500">Losses ({analytics.lossCount})</span>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Enhanced Trades Table */}
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="text-xs">
                                                <TableHead className="w-[40px]">#</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Entry</TableHead>
                                                <TableHead>Exit</TableHead>
                                                <TableHead className="text-center">Duration</TableHead>
                                                <TableHead className="text-right">Entry $</TableHead>
                                                <TableHead className="text-right">Exit $</TableHead>
                                                <TableHead className="text-right">P&L</TableHead>
                                                <TableHead className="text-right">Cumulative</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredTrades.map((trade, idx) => {
                                                const isBest = trade === analytics.bestTrade;
                                                const isWorst = trade === analytics.worstTrade;
                                                return (
                                                    <TableRow
                                                        key={idx}
                                                        className={`text-xs ${isBest ? 'bg-green-500/10' : isWorst ? 'bg-red-500/10' : ''}`}
                                                    >
                                                        <TableCell className="font-mono text-muted-foreground">
                                                            {idx + 1}
                                                            {isBest && <span className="ml-1 text-green-500">★</span>}
                                                            {isWorst && <span className="ml-1 text-red-500">★</span>}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={(trade.type || trade.side) === "long" || (trade.type || trade.side) === "buy" ? "default" : "secondary"} className="text-[10px]">
                                                                {(trade.type || trade.side) === "long" || (trade.type || trade.side) === "buy" ? (
                                                                    <ArrowUpRight className="w-3 h-3 mr-1" />
                                                                ) : (
                                                                    <ArrowDownRight className="w-3 h-3 mr-1" />
                                                                )}
                                                                {(trade.type || trade.side || "unknown").toUpperCase()}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-muted-foreground text-[11px]">
                                                            {formatDateTime(trade.entry_time)}
                                                        </TableCell>
                                                        <TableCell className="font-mono text-muted-foreground text-[11px]">
                                                            {formatDateTime(trade.exit_time)}
                                                        </TableCell>
                                                        <TableCell className="text-center font-mono text-muted-foreground">
                                                            {formatDuration(trade.entry_time, trade.exit_time)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono">
                                                            {formatNumber(trade.entry_price, 4)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono">
                                                            {formatNumber(trade.exit_price, 4)}
                                                        </TableCell>
                                                        <TableCell className={`text-right font-mono font-medium ${(trade.pnl ?? trade.profit_loss ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            {(trade.pnl ?? trade.profit_loss ?? 0) >= 0 ? '+' : ''}{formatNumber(trade.pnl ?? trade.profit_loss ?? 0, 2)}
                                                        </TableCell>
                                                        <TableCell className={`text-right font-mono font-medium ${(trade.cumulativePnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {(trade.cumulativePnl ?? 0) >= 0 ? '+' : ''}{formatNumber(trade.cumulativePnl ?? 0, 2)}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <div className="text-center">
                                        <List className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>No trades were executed</p>
                                        <p className="text-xs mt-1">Adjust entry conditions or date range</p>
                                    </div>
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    {/* New Summary Tab */}
                    {hasTrades && analytics && (
                        <TabsContent value="summary" className="flex-1 m-0 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="p-6 space-y-6">
                                    <h3 className="text-lg font-semibold">Performance Summary</h3>

                                    {/* Key Metrics Grid */}
                                    <div className="grid grid-cols-4 gap-4">
                                        <Card>
                                            <CardContent className="p-4 text-center">
                                                <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
                                                <div className="text-3xl font-bold">{formatNumber(analytics.winRate, 1)}%</div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {analytics.winCount}W / {analytics.lossCount}L
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4 text-center">
                                                <div className="text-xs text-muted-foreground mb-1">Expectancy</div>
                                                <div className={`text-3xl font-bold ${analytics.expectancy >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {analytics.expectancy >= 0 ? '+' : ''}{formatNumber(analytics.expectancy)}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">per trade</div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4 text-center">
                                                <div className="text-xs text-muted-foreground mb-1">Total P&L</div>
                                                <div className={`text-3xl font-bold ${analytics.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {analytics.totalPnL >= 0 ? '+' : ''}{formatNumber(analytics.totalPnL)}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">{trades.length} trades</div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4 text-center">
                                                <div className="text-xs text-muted-foreground mb-1">Reward/Risk</div>
                                                <div className="text-3xl font-bold">
                                                    {analytics.avgLoss !== 0
                                                        ? formatNumber(Math.abs(analytics.avgWin / analytics.avgLoss), 2)
                                                        : "∞"
                                                    }
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">avg win / avg loss</div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Win/Loss Breakdown */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <Card className="bg-green-500/5 border-green-500/20">
                                            <CardContent className="p-4">
                                                <h4 className="font-medium text-green-600 mb-3">Winning Trades</h4>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Count</span>
                                                        <span className="font-mono font-medium">{analytics.winCount}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Average</span>
                                                        <span className="font-mono font-medium text-green-500">+{formatNumber(analytics.avgWin)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Best</span>
                                                        <span className="font-mono font-medium text-green-500">+{formatNumber(analytics.bestTrade?.pnl)}</span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-red-500/5 border-red-500/20">
                                            <CardContent className="p-4">
                                                <h4 className="font-medium text-red-600 mb-3">Losing Trades</h4>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Count</span>
                                                        <span className="font-mono font-medium">{analytics.lossCount}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Average</span>
                                                        <span className="font-mono font-medium text-red-500">{formatNumber(analytics.avgLoss)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Worst</span>
                                                        <span className="font-mono font-medium text-red-500">{formatNumber(analytics.worstTrade?.pnl)}</span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    )}

                    {hasStats && (
                        <TabsContent value="stats" className="flex-1 m-0 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="p-4 font-mono text-xs whitespace-pre">
                                    {rawStats}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </DraggableModal>
    );
};
