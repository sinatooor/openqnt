import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    TrendingUp, TrendingDown, DollarSign, Target,
    BarChart3, Activity, Calendar, Percent
} from "lucide-react";

interface TradeSummary {
    total_trades: number;
    win_rate: number;
    total_pnl: number;
    avg_win: number;
    avg_loss: number;
    best_trade: number;
    worst_trade: number;
    profit_factor: number;
    max_drawdown: number;
    avg_holding_time: string;
}

interface PerformanceDashboardProps {
    className?: string;
}

export const PerformanceDashboard = ({ className }: PerformanceDashboardProps) => {
    const [summary, setSummary] = useState<TradeSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<"7d" | "30d" | "all">("30d");

    useEffect(() => {
        fetchSummary();
    }, [timeframe]);

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/trades/summary?timeframe=${timeframe}`);
            if (response.ok) {
                const data = await response.json();
                setSummary(data);
            }
        } catch (err) {
            console.error("Failed to fetch summary:", err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
        }).format(value);
    };

    const formatPercent = (value: number) => {
        return `${(value * 100).toFixed(1)}%`;
    };

    // Calculate mock data if no real data
    const mockSummary: TradeSummary = {
        total_trades: 0,
        win_rate: 0,
        total_pnl: 0,
        avg_win: 0,
        avg_loss: 0,
        best_trade: 0,
        worst_trade: 0,
        profit_factor: 0,
        max_drawdown: 0,
        avg_holding_time: "N/A"
    };

    const data = summary || mockSummary;

    return (
        <div className={className}>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Performance Dashboard
                </h2>
                <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as "7d" | "30d" | "all")}>
                    <TabsList className="h-8">
                        <TabsTrigger value="7d" className="text-xs px-2 h-6">7D</TabsTrigger>
                        <TabsTrigger value="30d" className="text-xs px-2 h-6">30D</TabsTrigger>
                        <TabsTrigger value="all" className="text-xs px-2 h-6">All</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-4">
                                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                                <div className="h-6 bg-muted rounded w-3/4"></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <>
                    {/* Main Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <Card className={data.total_pnl >= 0 ? "border-green-500/30 bg-green-950/20" : "border-red-500/30 bg-red-950/20"}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                    <DollarSign className="w-3 h-3" />
                                    Total P&L
                                </div>
                                <div className={`text-xl font-bold ${data.total_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                    {formatCurrency(data.total_pnl)}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                    <Target className="w-3 h-3" />
                                    Win Rate
                                </div>
                                <div className="text-xl font-bold">
                                    {formatPercent(data.win_rate)}
                                </div>
                                <Badge variant={data.win_rate >= 0.5 ? "default" : "secondary"} className="text-[10px] mt-1">
                                    {data.total_trades} trades
                                </Badge>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                    <Activity className="w-3 h-3" />
                                    Profit Factor
                                </div>
                                <div className="text-xl font-bold">
                                    {data.profit_factor.toFixed(2)}
                                </div>
                                <Badge variant={data.profit_factor >= 1.5 ? "default" : "secondary"} className="text-[10px] mt-1">
                                    {data.profit_factor >= 1.5 ? "Good" : data.profit_factor >= 1 ? "Fair" : "Poor"}
                                </Badge>
                            </CardContent>
                        </Card>

                        <Card className="border-orange-500/30 bg-orange-950/20">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                    <TrendingDown className="w-3 h-3" />
                                    Max Drawdown
                                </div>
                                <div className="text-xl font-bold text-orange-400">
                                    {formatCurrency(data.max_drawdown)}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Secondary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card>
                            <CardContent className="p-3">
                                <div className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3 text-green-400" />
                                    Avg Win
                                </div>
                                <div className="font-semibold text-green-400">
                                    {formatCurrency(data.avg_win)}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-3">
                                <div className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                                    <TrendingDown className="w-3 h-3 text-red-400" />
                                    Avg Loss
                                </div>
                                <div className="font-semibold text-red-400">
                                    {formatCurrency(data.avg_loss)}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-3">
                                <div className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                                    <Percent className="w-3 h-3" />
                                    Best Trade
                                </div>
                                <div className="font-semibold text-green-400">
                                    {formatCurrency(data.best_trade)}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-3">
                                <div className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Avg Hold Time
                                </div>
                                <div className="font-semibold">
                                    {data.avg_holding_time}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {data.total_trades === 0 && (
                        <div className="mt-4 p-4 bg-muted/30 rounded-lg text-center text-muted-foreground">
                            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No trades recorded yet.</p>
                            <p className="text-xs mt-1">Start trading to see your performance metrics here.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PerformanceDashboard;
