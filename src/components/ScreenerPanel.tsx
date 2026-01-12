
import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import {
    Search,
    Loader2,
    Filter,
    RefreshCw,
    Settings,
    Database
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
    { value: "all", label: "All" },
    { value: "uptrend_sma200", label: "Uptrend (SMA 200)" },
    { value: "downtrend_sma200", label: "Downtrend (SMA 200)" },
    { value: "rsi_oversold", label: "RSI Oversold (<30)" },
    { value: "rsi_overbought", label: "RSI Overbought (>70)" },
    { value: "macd_bullish_crossover", label: "MACD Bull Cross" },
    { value: "macd_bearish_crossover", label: "MACD Bear Cross" },
    { value: "bollinger_squeeze", label: "BB Squeeze" },
    { value: "volume_breakout", label: "Vol Breakout" },
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
    if (!data || data.length < 2) return <div className="h-8 w-24 bg-muted/20 rounded animate-pulse" />;

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
    const [showConfig, setShowConfig] = useState(true);

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
        <div className="flex flex-col h-full gap-4 p-2">

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowConfig(!showConfig)}
                        className={showConfig ? "bg-accent" : ""}
                    >
                        <Settings className="h-4 w-4 mr-2" />
                        Config
                    </Button>
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter symbol..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-md px-3 py-1.5 bg-muted/20">
                        <Database className="h-3.5 w-3.5" />
                        <span>{symbols.split(',').length} Assets</span>
                    </div>
                    <Button onClick={() => runScreen()} disabled={isPending} size="sm">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Run Scan
                    </Button>
                </div>
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 no-scrollbar">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                {FILTERS.map(f => (
                    <Badge
                        key={f.value}
                        variant={selectedFilter === f.value ? "default" : "outline"}
                        className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap"
                        onClick={() => setSelectedFilter(f.value)}
                    >
                        {f.label}
                    </Badge>
                ))}
            </div>

            <div className="flex-1 flex gap-4 min-h-0">

                {/* Side Config Panel (Toggleable) */}
                {showConfig && (
                    <Card className="w-64 shrink-0 flex flex-col h-full border-r border-border bg-muted/10">
                        <CardContent className="p-4 space-y-4 overflow-y-auto">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Scan Universe</label>
                                <Textarea
                                    value={symbols}
                                    onChange={(e) => setSymbols(e.target.value)}
                                    className="h-48 font-mono text-xs resize-none"
                                    placeholder="Enter symbols..."
                                />
                                <div className="flex justify-between">
                                    <button className="text-[10px] text-primary hover:underline" onClick={() => setSymbols(DEFAULT_SYMBOLS)}>Reset Default</button>
                                    <button className="text-[10px] text-primary hover:underline" onClick={() => setSymbols("")}>Clear</button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Lookback Period</label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        value={daysBack}
                                        onChange={(e) => setDaysBack(e.target.value)}
                                        className="h-8"
                                    />
                                    <span className="text-xs text-muted-foreground">Days</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Sector Filter</label>
                                <Select value={selectedSector} onValueChange={setSelectedSector}>
                                    <SelectTrigger className="h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SECTORS.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Main Results Table */}
                <Card className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <CardContent className="p-0 flex-1 overflow-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-secondary/50 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
                                <TableRow>
                                    <TableHead>Asset</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead>Trend (20d)</TableHead>
                                    <TableHead className="text-right">Change</TableHead>
                                    <TableHead className="text-center">Signal</TableHead>
                                    <TableHead className="text-right">Volume</TableHead>
                                    <TableHead className="text-right">Sector</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isPending ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-64 text-center text-muted-foreground animate-pulse">
                                            Scanning markets...
                                        </TableCell>
                                    </TableRow>
                                ) : results && filteredResults?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-64 text-center text-muted-foreground">
                                            No assets match "{activeFilterLabel}"
                                        </TableCell>
                                    </TableRow>
                                ) : filteredResults ? (
                                    filteredResults.map((r) => (
                                        <TableRow key={r.symbol} className="hover:bg-muted/50">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">{r.symbol}</span>
                                                    <span className="text-xs text-muted-foreground">{r.date}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {r.close.toFixed(r.close < 1 ? 5 : 2)}
                                            </TableCell>
                                            <TableCell>
                                                <Sparkline
                                                    data={r.sparkline || []}
                                                    color={r.change_pct >= 0 ? "rgb(34 197 94)" : "rgb(239 68 68)"}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className={cn(
                                                    "font-mono font-medium",
                                                    r.change_pct >= 0 ? "text-green-600" : "text-red-600"
                                                )}>
                                                    {r.change_pct >= 0 ? "+" : ""}{r.change_pct.toFixed(2)}%
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={
                                                    r.signal?.includes('Buy') ? "default" :
                                                        r.signal?.includes('Sell') ? "destructive" : "secondary"
                                                } className={cn(
                                                    r.signal?.includes('Buy') ? "bg-green-600 hover:bg-green-700" : ""
                                                )}>
                                                    {r.signal}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground font-mono text-xs">
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
                                            Ready to scan. Select filters and click Run Scan.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
