
import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import {
    Search,
    TrendingUp,
    TrendingDown,
    Activity,
    Loader2,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    BarChart2,
    SlidersHorizontal,
    RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { API_BASE_URL } from "@/services/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ScreenResult {
    symbol: string;
    close: number;
    change_pct: number;
    volume: number;
    date: string;
    sector?: string;
    signal?: string;
    market_cap?: string;
    sparkline?: number[];
}

const DEFAULT_SYMBOLS = "EURUSD=X, GBPUSD=X, USDJPY=X, AUDUSD=X, USDCAD=X, USDCHF=X, NZDUSD=X, BTC-USD, ETH-USD, SPY, QQQ, GLD, SLV, MSFT, AAPL, GOOGL, AMZN, NVDA, TSLA, AMD, INTC, COIN, MSTR, PLTR, AMD, JPM, BAC, XOM, CVX";

const FILTERS = [
    { value: "all", label: "No Filter (Show All)", color: "bg-gray-500" },
    { value: "uptrend_sma200", label: "Uptrend (SMA 200)", color: "bg-green-500" },
    { value: "downtrend_sma200", label: "Downtrend (SMA 200)", color: "bg-red-500" },
    { value: "rsi_oversold", label: "RSI Oversold (<30)", color: "bg-emerald-500" },
    { value: "rsi_overbought", label: "RSI Overbought (>70)", color: "bg-rose-500" },
    { value: "macd_bullish_crossover", label: "MACD Bull Cross", color: "bg-blue-500" },
    { value: "macd_bearish_crossover", label: "MACD Bear Cross", color: "bg-orange-500" },
    { value: "bollinger_squeeze", label: "Bollinger Squeeze (Vol)", color: "bg-purple-500" },
    { value: "volume_breakout", label: "Volume Breakout (>200%)", color: "bg-yellow-500" },
];

const SECTORS = [
    { value: "all", label: "All Sectors" },
    { value: "tech", label: "Technology" },
    { value: "finance", label: "Finance" },
    { value: "crypto", label: "Crypto" },
    { value: "forex", label: "Forex" },
    { value: "etf", label: "ETF/Indices" },
];

// Simple Sparkline Component
const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
    if (!data || data.length < 2) return <div className="h-8 w-24 bg-muted/10 rounded animate-pulse" />;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const width = 100;
    const height = 30;

    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(" ");

    return (
        <svg width="100" height="30" viewBox="0 0 100 30" className="overflow-visible">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

export const ScreenerPanel = () => {
    const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS);
    const [selectedFilter, setSelectedFilter] = useState("all");
    const [selectedSector, setSelectedSector] = useState("all");
    const [daysBack, setDaysBack] = useState("365");
    const [searchTerm, setSearchTerm] = useState("");

    const { mutate: runScreen, data: results, isPending } = useMutation({
        mutationFn: async () => {
            const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);

            const res = await fetch(`${API_BASE_URL}/api/screen`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbols: symbolList,
                    filter: selectedFilter,
                    days_back: parseInt(daysBack)
                })
            });

            if (!res.ok) throw new Error("Screening failed");
            const data = await res.json();

            // Post-process logic for Sector since we don't have it on backend
            return (data.results as ScreenResult[]).map(r => ({
                ...r,
                sector: determineSector(r.symbol)
            }));
        },
        onError: (err) => {
            toast.error(`Screening failed: ${err.message}`);
        },
        onSuccess: (data) => {
            toast.success(`Found ${data.length} matches`);
        }
    });

    const determineSector = (sym: string) => {
        if (sym.includes('=X')) return 'Forex';
        if (sym.includes('-USD') || sym === 'COIN' || sym === 'MSTR') return 'Crypto';
        if (['SPY', 'QQQ', 'GLD', 'SLV', 'DIA', 'IWM'].includes(sym)) return 'ETF/Indices';
        if (['JPM', 'BAC', 'GS', 'C'].includes(sym)) return 'Finance';
        return 'Technology'; // Bias default
    };

    const filteredResults = useMemo(() => {
        if (!results) return null;
        return results.filter(r => {
            const matchesSector = selectedSector === 'all' ||
                (selectedSector === 'tech' && r.sector === 'Technology') ||
                (selectedSector === 'forex' && r.sector === 'Forex') ||
                (selectedSector === 'crypto' && r.sector === 'Crypto') ||
                (selectedSector === 'finance' && r.sector === 'Finance') ||
                (selectedSector === 'etf' && r.sector === 'ETF/Indices');

            const matchesSearch = r.symbol.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSector && matchesSearch;
        });
    }, [results, selectedSector, searchTerm]);

    const activeFilterLabel = FILTERS.find(f => f.value === selectedFilter)?.label;

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-white font-sans selection:bg-teal-500/30">
            {/* Header / Control Bar */}
            <div className="flex flex-col md:flex-row gap-4 p-4 border-b border-white/10 bg-[#111] shrink-0">
                <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20">
                            <Activity className="h-5 w-5 text-white" />
                        </div>
                        <h2 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                            Market Screener Pro
                        </h2>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Universe: {symbols.split(',').length} Assets</span>
                        <span className="h-3 w-[1px] bg-white/10" />
                        <span>Data: Real-time (Delayed)</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter results..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9 w-[180px] bg-[#1a1a1a] border-white/10 text-xs focus-visible:ring-teal-500/50"
                        />
                    </div>

                    <Button
                        onClick={() => runScreen()}
                        disabled={isPending}
                        className="h-9 bg-teal-600 hover:bg-teal-500 text-white border-0 shadow-lg shadow-teal-900/20"
                    >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Run Scan
                    </Button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-2 px-4 py-2 bg-[#0f0f0f] border-b border-white/5 overflow-x-auto no-scrollbar shrink-0">
                <Filter className="h-3 w-3 text-muted-foreground mr-2 shrink-0" />
                {FILTERS.map(f => (
                    <button
                        key={f.value}
                        onClick={() => setSelectedFilter(f.value)}
                        className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap border",
                            selectedFilter === f.value
                                ? `${f.color} bg-opacity-20 border-${f.color.split('-')[1]}-500 text-white`
                                : "bg-transparent border-white/10 text-muted-foreground hover:border-white/20 hover:text-white"
                        )}
                    >
                        <div className="flex items-center gap-1.5">
                            <div className={cn("h-1.5 w-1.5 rounded-full", f.color.replace('bg-', 'bg-'))} />
                            {f.label}
                        </div>
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">

                {/* Side Settings (Collapsible idea, fixed for now) */}
                <div className="w-64 border-r border-white/10 bg-[#111] p-4 hidden lg:flex flex-col gap-6 overflow-y-auto">

                    <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <SlidersHorizontal className="h-3 w-3" />
                            Configuration
                        </h3>

                        <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-500">Scan Universe</label>
                            <Textarea
                                value={symbols}
                                onChange={(e) => setSymbols(e.target.value)}
                                className="h-32 bg-[#1a1a1a] border-white/10 text-[10px] font-mono leading-relaxed resize-none focus-visible:ring-teal-500/30"
                            />
                            <div className="flex justify-between">
                                <button className="text-[10px] text-teal-400 hover:underline" onClick={() => setSymbols(DEFAULT_SYMBOLS)}>Reset Default</button>
                                <button className="text-[10px] text-teal-400 hover:underline" onClick={() => setSymbols("")}>Clear</button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-500">Lookback Period</label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={daysBack}
                                    onChange={(e) => setDaysBack(e.target.value)}
                                    className="h-8 bg-[#1a1a1a] border-white/10 text-xs"
                                />
                                <span className="text-xs text-muted-foreground">Days</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-500">Sector Filter</label>
                            <Select value={selectedSector} onValueChange={setSelectedSector}>
                                <SelectTrigger className="h-8 bg-[#1a1a1a] border-white/10 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1a1a1a] border-white/10">
                                    {SECTORS.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Results Table */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
                    <Table>
                        <TableHeader className="bg-[#111] sticky top-0 z-10 shadow-sm border-b border-white/10">
                            <TableRow className="hover:bg-transparent border-0">
                                <TableHead className="text-xs font-semibold text-gray-400 w-[140px]">Asset</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-400 w-[100px]">Price</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-400 w-[120px]">Trend (20d)</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-400 text-right w-[100px]">Change</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-400 text-center w-[120px]">Signal</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-400 text-right">Volume</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-400 text-right w-[100px]">Sector</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isPending ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i} className="border-b border-white/5">
                                        <TableCell><div className="h-4 w-20 bg-white/5 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-16 bg-white/5 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-6 w-24 bg-white/5 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-12 bg-white/5 rounded animate-pulse ml-auto" /></TableCell>
                                        <TableCell><div className="h-5 w-16 bg-white/5 rounded-full animate-pulse mx-auto" /></TableCell>
                                        <TableCell><div className="h-4 w-16 bg-white/5 rounded animate-pulse ml-auto" /></TableCell>
                                        <TableCell><div className="h-4 w-16 bg-white/5 rounded animate-pulse ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : results && filteredResults?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-3 opacity-50">
                                            <Search className="h-10 w-10" />
                                            <p>No assets match your criteria ({activeFilterLabel})</p>
                                            <Button variant="link" onClick={() => setSelectedFilter("all")}>Clear Filters</Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredResults ? (
                                filteredResults.map((r, i) => (
                                    <TableRow key={r.symbol} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-white group-hover:text-teal-400 transition-colors">{r.symbol}</span>
                                                <span className="text-[10px] text-muted-foreground">{r.date}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm text-gray-300">
                                            {r.close.toFixed(r.close < 1 ? 5 : 2)}
                                        </TableCell>
                                        <TableCell>
                                            <Sparkline
                                                data={r.sparkline || []}
                                                color={r.change_pct >= 0 ? "#10b981" : "#ef4444"}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className={cn(
                                                "inline-flex items-center gap-1 font-mono font-medium text-xs",
                                                r.change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                                            )}>
                                                {r.change_pct >= 0 ? "+" : ""}{r.change_pct.toFixed(2)}%
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={cn(
                                                "border-0 text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider shadow-sm",
                                                r.signal === 'Strong Buy' ? "bg-emerald-500/20 text-emerald-400 shadow-emerald-500/20" :
                                                    r.signal === 'Buy' ? "bg-green-500/10 text-green-400" :
                                                        r.signal === 'Strong Sell' ? "bg-rose-500/20 text-rose-400 shadow-rose-500/20" :
                                                            r.signal === 'Sell' ? "bg-red-500/10 text-red-400" :
                                                                "bg-gray-500/10 text-gray-400"
                                            )}>
                                                {r.signal}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-gray-400">
                                            {(r.volume / 1000000).toFixed(2)}M
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">
                                            {r.sector}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-4">
                                            <BarChart2 className="h-12 w-12 opacity-20" />
                                            <div className="space-y-1">
                                                <p className="font-medium text-white">Market Screener Ready</p>
                                                <p className="text-xs">Define your universe and filters to scan the market.</p>
                                            </div>
                                            <Button variant="outline" onClick={() => runScreen()} className="border-white/10 hover:bg-white/5">
                                                Start Scan
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};
