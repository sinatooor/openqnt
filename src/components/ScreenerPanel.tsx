
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
    Search,
    TrendingUp,
    TrendingDown,
    Activity,
    Loader2,
    Filter,
    ArrowUpRight,
    ArrowDownRight
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
    // Mock additional fields for enhancement
    sector?: string;
    signal?: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
}

const DEFAULT_SYMBOLS = "EURUSD=X, GBPUSD=X, USDJPY=X, AUDUSD=X, USDCAD=X, USDCHF=X, NZDUSD=X, BTC-USD, ETH-USD, SPY, QQQ, GLD, SLV, MSFT, AAPL, GOOGL, AMZN, NVDA, TSLA, AMD, INTC, COIN, MSTR";

const FILTERS = [
    { value: "uptrend_sma200", label: "Uptrend (Price > SMA 200)" },
    { value: "downtrend_sma200", label: "Downtrend (Price < SMA 200)" },
    { value: "rsi_oversold", label: "RSI Oversold (< 30)" },
    { value: "rsi_overbought", label: "RSI Overbought (> 70)" },
];

const SECTORS = [
    { value: "all", label: "All Sectors" },
    { value: "tech", label: "Technology" },
    { value: "finance", label: "Finance" },
    { value: "crypto", label: "Crypto" },
    { value: "forex", label: "Forex" },
];

export const ScreenerPanel = () => {
    const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS);
    const [selectedFilter, setSelectedFilter] = useState("uptrend_sma200");
    const [selectedSector, setSelectedSector] = useState("all");
    const [daysBack, setDaysBack] = useState("365");

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

            // Enhance with mock data for now
            return (data.results as ScreenResult[]).map(r => ({
                ...r,
                sector: determineSector(r.symbol),
                signal: generateMockSignal(r.change_pct)
            }));
        },
        onError: (err) => {
            toast.error(`Screening failed: ${err.message}`);
        },
        onSuccess: (data) => {
            toast.success(`Found ${data.length} matches`);
        }
    });

    // Helper to mock sector based on symbol
    const determineSector = (sym: string) => {
        if (sym.includes('=X')) return 'Forex';
        if (sym.includes('-USD') || sym === 'COIN' || sym === 'MSTR') return 'Crypto';
        if (['SPY', 'QQQ', 'GLD', 'SLV'].includes(sym)) return 'Index/ETF';
        return 'Technology'; // Fallback
    };

    // Helper to mock signal
    const generateMockSignal = (change: number): ScreenResult['signal'] => {
        if (change > 2.0) return 'STRONG_BUY';
        if (change > 0.5) return 'BUY';
        if (change < -2.0) return 'STRONG_SELL';
        if (change < -0.5) return 'SELL';
        return 'NEUTRAL';
    };

    const handleRun = () => {
        runScreen();
    };

    const filteredResults = results?.filter(r => {
        if (selectedSector === 'all') return true;
        if (selectedSector === 'forex') return r.sector === 'Forex';
        if (selectedSector === 'crypto') return r.sector === 'Crypto';
        if (selectedSector === 'tech') return r.sector === 'Technology';
        if (selectedSector === 'finance') return r.sector === 'Finance';
        return true;
    });

    return (
        <div className="flex flex-col h-full gap-4 p-4 text-sm bg-background/50 backdrop-blur-sm">

            {/* Controls Area */}
            <Card className="bg-card/50 border-border/50">
                <CardContent className="p-4 grid gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2 col-span-1 md:col-span-1">
                            <label className="text-xs font-medium text-muted-foreground">Technical Filter</label>
                            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select a filter..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {FILTERS.map(f => (
                                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 col-span-1 md:col-span-1">
                            <label className="text-xs font-medium text-muted-foreground">Sector</label>
                            <Select value={selectedSector} onValueChange={setSelectedSector}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="All Sectors" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SECTORS.map(s => (
                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 col-span-1 md:col-span-1">
                            <label className="text-xs font-medium text-muted-foreground">Lookback (Days)</label>
                            <Input
                                type="number"
                                value={daysBack}
                                onChange={e => setDaysBack(e.target.value)}
                                min={100}
                                max={3650}
                                className="h-9"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-1">
                            <Button onClick={handleRun} disabled={isPending} className="w-full h-9 bg-teal-600 hover:bg-teal-700 text-white">
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Scanning...
                                    </>
                                ) : (
                                    <>
                                        <Activity className="mr-2 h-4 w-4" />
                                        Run Screen
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-medium text-muted-foreground">Universe (Symbols)</label>
                            <span
                                className="text-[10px] text-teal-400 cursor-pointer hover:underline"
                                onClick={() => setSymbols(DEFAULT_SYMBOLS)}
                            >
                                Reset to Defaults
                            </span>
                        </div>
                        <Textarea
                            value={symbols}
                            onChange={e => setSymbols(e.target.value)}
                            className="font-mono text-xs h-16 bg-background/50 resize-none border-border/50"
                            placeholder="AAPL, MSFT, EURUSD=X..."
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Results Table */}
            <Card className="flex-1 overflow-hidden flex flex-col border-border/50 bg-card/30">
                <CardContent className="p-0 flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                            <TableRow className="border-border/50 hover:bg-transparent">
                                <TableHead className="w-[120px]">Symbol</TableHead>
                                <TableHead className="w-[100px]">Sector</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Change %</TableHead>
                                <TableHead className="text-center">Signal</TableHead>
                                <TableHead className="text-right">Volume</TableHead>
                                <TableHead className="w-[80px] text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isPending ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
                                            <span>Scanning Markets...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : !results ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Filter className="h-6 w-6 opacity-20" />
                                            <span>Select criteria and run screen to see results.</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredResults?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                        No matches found for these criteria.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredResults?.map((r) => (
                                    <TableRow key={r.symbol} className="border-border/40 hover:bg-muted/30">
                                        <TableCell className="font-bold text-foreground">{r.symbol}</TableCell>
                                        <TableCell className="text-muted-foreground">{r.sector}</TableCell>
                                        <TableCell className="text-right font-mono text-foreground">{r.close}</TableCell>
                                        <TableCell className="text-right">
                                            <div className={cn(
                                                "inline-flex items-center gap-1 font-medium",
                                                r.change_pct >= 0 ? "text-green-500" : "text-red-500"
                                            )}>
                                                {r.change_pct >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                                {Math.abs(r.change_pct).toFixed(2)}%
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={cn(
                                                "text-[10px] w-20 justify-center",
                                                r.signal?.includes('BUY') ? "border-green-800 text-green-500 bg-green-500/10" :
                                                    r.signal?.includes('SELL') ? "border-red-800 text-red-500 bg-red-500/10" :
                                                        "border-gray-700 text-gray-500"
                                            )}>
                                                {r.signal?.replace('_', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground font-mono text-xs">
                                            {(r.volume / 1000000).toFixed(1)}M
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:text-teal-400">
                                                <Activity className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};
