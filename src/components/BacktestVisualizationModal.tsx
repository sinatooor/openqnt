import { useState } from "react";
import { DraggableModal } from "./DraggableModal";
import { Button } from "./ui/button";
import { FileText, BarChart3, List, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";

interface Trade {
    entry_time: string;
    exit_time: string;
    entry_price: number;
    exit_price: number;
    size: number;
    pnl: number;
    return_pct: number;
    type: string;
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

export const BacktestVisualizationModal = ({
    isOpen,
    onClose,
    htmlContent,
    rawStats,
    trades = [],
    title = "Backtest Results"
}: BacktestVisualizationModalProps) => {
    const [activeTab, setActiveTab] = useState<"chart" | "trades" | "stats">("chart");

    if (!isOpen) return null;

    const hasTrades = trades && trades.length > 0;
    const hasChart = htmlContent !== null;
    const hasStats = rawStats !== null;

    // Calculate trade summary
    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const losingTrades = trades.filter(t => t.pnl < 0).length;
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);

    return (
        <DraggableModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            defaultWidth={1100}
            defaultHeight={700}
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
                            {hasStats && (
                                <TabsTrigger value="stats" className="text-xs h-7 px-3">
                                    <FileText className="w-3 h-3 mr-1" />
                                    Raw Stats
                                </TabsTrigger>
                            )}
                        </TabsList>

                        {activeTab === "trades" && hasTrades && (
                            <div className="flex items-center gap-3 text-xs">
                                <span className="text-muted-foreground">
                                    <span className="text-green-500">{winningTrades} wins</span>
                                    {" / "}
                                    <span className="text-red-500">{losingTrades} losses</span>
                                </span>
                                <Badge variant={totalPnL >= 0 ? "default" : "destructive"}>
                                    {totalPnL >= 0 ? "+" : ""}{formatNumber(totalPnL)} Total P&L
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
                            {hasTrades ? (
                                <div className="p-4">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="text-xs">
                                                <TableHead className="w-[50px]">#</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Entry Time</TableHead>
                                                <TableHead>Exit Time</TableHead>
                                                <TableHead className="text-right">Entry Price</TableHead>
                                                <TableHead className="text-right">Exit Price</TableHead>
                                                <TableHead className="text-right">Size</TableHead>
                                                <TableHead className="text-right">P&L</TableHead>
                                                <TableHead className="text-right">Return %</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {trades.map((trade, idx) => (
                                                <TableRow key={idx} className="text-xs">
                                                    <TableCell className="font-mono text-muted-foreground">
                                                        {idx + 1}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={trade.type === "long" ? "default" : "secondary"} className="text-[10px]">
                                                            {trade.type === "long" ? (
                                                                <ArrowUpRight className="w-3 h-3 mr-1" />
                                                            ) : (
                                                                <ArrowDownRight className="w-3 h-3 mr-1" />
                                                            )}
                                                            {trade.type.toUpperCase()}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-muted-foreground">
                                                        {formatDateTime(trade.entry_time)}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-muted-foreground">
                                                        {formatDateTime(trade.exit_time)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {formatNumber(trade.entry_price, 4)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {formatNumber(trade.exit_price, 4)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {formatNumber(trade.size, 2)}
                                                    </TableCell>
                                                    <TableCell className={`text-right font-mono font-medium ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {trade.pnl >= 0 ? '+' : ''}{formatNumber(trade.pnl, 2)}
                                                    </TableCell>
                                                    <TableCell className={`text-right font-mono ${trade.return_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {trade.return_pct >= 0 ? '+' : ''}{formatNumber(trade.return_pct, 2)}%
                                                    </TableCell>
                                                </TableRow>
                                            ))}
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
