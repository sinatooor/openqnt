
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
    Search,
    TrendingUp,
    TrendingDown,
    Activity,
    AlertCircle,
    Loader2
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { DraggableModal } from "./DraggableModal";
import { API_BASE_URL } from "@/services/api";
import { toast } from "sonner";

interface ScreenerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ScreenResult {
    symbol: string;
    close: number;
    change_pct: number;
    volume: number;
    date: string;
}

const DEFAULT_SYMBOLS = "EURUSD=X, GBPUSD=X, USDJPY=X, AUDUSD=X, USDCAD=X, USDCHF=X, NZDUSD=X, BTC-USD, ETH-USD, SPY, QQQ, GLD, SLV, MSFT, AAPL, GOOGL, AMZN, NVDA, TSLA";

const FILTERS = [
    { value: "uptrend_sma200", label: "Uptrend (Price > SMA 200)" },
    { value: "downtrend_sma200", label: "Downtrend (Price < SMA 200)" },
    { value: "rsi_oversold", label: "RSI Oversold (< 30)" },
    { value: "rsi_overbought", label: "RSI Overbought (> 70)" },
];

export const ScreenerModal = ({ isOpen, onClose }: ScreenerModalProps) => {
    const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS);
    const [selectedFilter, setSelectedFilter] = useState("uptrend_sma200");
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
            return data.results as ScreenResult[];
        },
        onError: (err) => {
            toast.error(`Screening failed: ${err.message}`);
        },
        onSuccess: (data) => {
            toast.success(`Found ${data.length} matches`);
        }
    });

    const handleRun = () => {
        runScreen();
    };

    return (
        <DraggableModal
            isOpen={isOpen}
            onClose={onClose}
            title="Market Screener"
            defaultWidth={900}
            defaultHeight={700}
            minWidth={800}
            minHeight={600}
        >
            <div className="flex flex-col h-full gap-4 p-4 text-sm">

                {/* Controls Area */}
                <Card className="bg-muted/30">
                    <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Search className="w-4 h-4" />
                            Screening Criteria
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium">Filter Logic</label>
                                <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a filter..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FILTERS.map(f => (
                                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium">Lookback Period (Days)</label>
                                <Input
                                    type="number"
                                    value={daysBack}
                                    onChange={e => setDaysBack(e.target.value)}
                                    min={100}
                                    max={3650}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium flex justify-between">
                                <span>Symbols (comma separated)</span>
                                <span className="text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => setSymbols(DEFAULT_SYMBOLS)}>Reset Defaults</span>
                            </label>
                            <Textarea
                                value={symbols}
                                onChange={e => setSymbols(e.target.value)}
                                className="font-mono text-xs h-20"
                                placeholder="AAPL, MSFT, EURUSD=X..."
                            />
                        </div>

                        <Button onClick={handleRun} disabled={isPending} className="w-full md:w-auto md:ml-auto">
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Scanning Markets...
                                </>
                            ) : (
                                <>
                                    <Activity className="mr-2 h-4 w-4" />
                                    Run Screen
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Results Table */}
                <Card className="flex-1 overflow-hidden flex flex-col">
                    <CardContent className="p-0 flex-1 overflow-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead>Symbol</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right">Change %</TableHead>
                                    <TableHead className="text-right">Volume</TableHead>
                                    <TableHead className="text-right">Date</TableHead>
                                    <TableHead className="w-[100px]">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isPending ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            Scanning...
                                        </TableCell>
                                    </TableRow>
                                ) : !results ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            Run the screener to see results.
                                        </TableCell>
                                    </TableRow>
                                ) : results.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No matches found for these criteria.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    results.map((r) => (
                                        <TableRow key={r.symbol}>
                                            <TableCell className="font-bold">{r.symbol}</TableCell>
                                            <TableCell className="text-right font-mono">{r.close}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={r.change_pct >= 0 ? "default" : "destructive"} className={r.change_pct >= 0 ? "bg-green-600" : ""}>
                                                    {r.change_pct > 0 ? "+" : ""}{r.change_pct}%
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">{r.volume.toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-muted-foreground text-xs">{r.date}</TableCell>
                                            <TableCell>
                                                {/* Placeholder for future actions like 'Load Chart' */}
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                    <TrendingUp className="h-4 w-4" />
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
        </DraggableModal>
    );
};
