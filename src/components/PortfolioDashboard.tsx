/**
 * PortfolioDashboard - Portfolio overview with equity curve and positions
 * Displays aggregated performance across all strategies
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Activity,
    PieChart,
    ArrowUpRight,
    ArrowDownRight,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/services/api';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts';

interface Trade {
    id: number;
    symbol: string;
    direction: string;
    entry_price: number;
    exit_price?: number;
    pnl?: number;
    status: string;
    entry_time: string;
    exit_time?: string;
    size: number;
}

interface TradeSummary {
    total_trades: number;
    winning_trades: number;
    total_pnl: number;
    win_rate: number;
}

export const PortfolioDashboard = () => {
    // Fetch trades
    const { data: trades = [], isLoading: loadingTrades } = useQuery<Trade[]>({
        queryKey: ['portfolio-trades'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/trades`);
            if (!res.ok) throw new Error('Failed to fetch trades');
            return res.json();
        }
    });

    // Fetch summary
    const { data: summary, isLoading: loadingSummary } = useQuery<TradeSummary>({
        queryKey: ['trade-summary'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/trades/summary`);
            if (!res.ok) throw new Error('Failed to fetch summary');
            return res.json();
        }
    });

    // Calculate equity curve from trades
    const equityCurve = useMemo(() => {
        if (trades.length === 0) return [];

        // Sort by exit time
        const sortedTrades = [...trades]
            .filter(t => t.exit_time && t.pnl !== undefined)
            .sort((a, b) => new Date(a.exit_time!).getTime() - new Date(b.exit_time!).getTime());

        let balance = 10000; // Starting balance
        const curve = [{ date: 'Start', balance: 10000 }];

        sortedTrades.forEach(trade => {
            balance += trade.pnl || 0;
            curve.push({
                date: new Date(trade.exit_time!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                balance: Math.round(balance * 100) / 100
            });
        });

        return curve;
    }, [trades]);

    // Active positions (open trades)
    const activePositions = useMemo(() => {
        return trades.filter(t => t.status === 'OPEN' || !t.exit_time);
    }, [trades]);

    // Daily PnL
    const dailyPnL = useMemo(() => {
        const today = new Date().toDateString();
        return trades
            .filter(t => t.exit_time && new Date(t.exit_time).toDateString() === today)
            .reduce((sum, t) => sum + (t.pnl || 0), 0);
    }, [trades]);

    // Weekly PnL
    const weeklyPnL = useMemo(() => {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return trades
            .filter(t => t.exit_time && new Date(t.exit_time) >= weekAgo)
            .reduce((sum, t) => sum + (t.pnl || 0), 0);
    }, [trades]);

    const isLoading = loadingTrades || loadingSummary;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                    <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-muted-foreground">Total Balance</span>
                        </div>
                        <p className="text-xl font-bold">
                            ${((summary?.total_pnl || 0) + 10000).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                    </CardContent>
                </Card>

                <Card className={cn(
                    "border-opacity-20",
                    (summary?.total_pnl || 0) >= 0
                        ? "bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20"
                        : "bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20"
                )}>
                    <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                            {(summary?.total_pnl || 0) >= 0
                                ? <TrendingUp className="w-4 h-4 text-green-500" />
                                : <TrendingDown className="w-4 h-4 text-red-500" />
                            }
                            <span className="text-xs text-muted-foreground">Total P&L</span>
                        </div>
                        <p className={cn(
                            "text-xl font-bold",
                            (summary?.total_pnl || 0) >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                            {(summary?.total_pnl || 0) >= 0 ? '+' : ''}${(summary?.total_pnl || 0).toFixed(2)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Win Rate</span>
                        </div>
                        <p className="text-xl font-bold">{(summary?.win_rate || 0).toFixed(1)}%</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <PieChart className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Total Trades</span>
                        </div>
                        <p className="text-xl font-bold">{summary?.total_trades || 0}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Daily/Weekly PnL */}
            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-card">
                    <span className="text-xs text-muted-foreground">Today</span>
                    <p className={cn(
                        "text-lg font-semibold",
                        dailyPnL >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                        {dailyPnL >= 0 ? '+' : ''}${dailyPnL.toFixed(2)}
                    </p>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                    <span className="text-xs text-muted-foreground">This Week</span>
                    <p className={cn(
                        "text-lg font-semibold",
                        weeklyPnL >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                        {weeklyPnL >= 0 ? '+' : ''}${weeklyPnL.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Equity Curve */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Equity Curve</CardTitle>
                </CardHeader>
                <CardContent>
                    {equityCurve.length > 1 ? (
                        <div className="h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={equityCurve}>
                                    <defs>
                                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#666" />
                                    <YAxis tick={{ fontSize: 10 }} stroke="#666" domain={['dataMin - 100', 'dataMax + 100']} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                                        labelStyle={{ color: '#999' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="balance"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        fill="url(#colorBalance)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[150px] flex items-center justify-center text-muted-foreground text-sm">
                            No trade data yet
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Active Positions */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        Active Positions
                        {activePositions.length > 0 && (
                            <Badge variant="secondary" className="text-xs">{activePositions.length}</Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {activePositions.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                            No open positions
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs">Symbol</TableHead>
                                    <TableHead className="text-xs">Side</TableHead>
                                    <TableHead className="text-xs text-right">Entry</TableHead>
                                    <TableHead className="text-xs text-right">Size</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activePositions.slice(0, 5).map((pos) => (
                                    <TableRow key={pos.id}>
                                        <TableCell className="font-mono text-xs">{pos.symbol}</TableCell>
                                        <TableCell>
                                            <Badge variant={pos.direction === 'BUY' ? 'default' : 'destructive'} className="text-[10px]">
                                                {pos.direction === 'BUY' ? <ArrowUpRight className="w-2 h-2 mr-1" /> : <ArrowDownRight className="w-2 h-2 mr-1" />}
                                                {pos.direction}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs">{pos.entry_price.toFixed(4)}</TableCell>
                                        <TableCell className="text-right text-xs">{pos.size}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default PortfolioDashboard;
