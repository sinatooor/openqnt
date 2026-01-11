
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    RefreshCw,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    ExternalLink,
    Download,
    BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { fetchTrades, fetchTradeSummary, Trade } from "@/services/trades";
import { API_BASE_URL } from "@/services/api";
import { PerformanceDashboard } from "@/components/PerformanceDashboard";
import { DraggableModal } from "./DraggableModal";
import { Link } from "react-router-dom";

type SortConfig = {
    key: keyof Trade;
    direction: 'asc' | 'desc';
} | null;

interface JournalModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const JournalModal = ({ isOpen, onClose }: JournalModalProps) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    const { data: trades = [], isLoading, isFetching, refetch } = useQuery({
        queryKey: ['trades'],
        queryFn: () => fetchTrades(),
        refetchInterval: 10000,
        enabled: isOpen, // Only fetch when open
    });

    // We can fetch summary too, or rely on global state. 
    // Journal.tsx had it.
    useQuery({
        queryKey: ['trade-summary'],
        queryFn: fetchTradeSummary,
        refetchInterval: 30000,
        enabled: isOpen,
    });

    const handleSort = (key: keyof Trade) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedTrades = useMemo(() => {
        if (!sortConfig) return trades;

        return [...trades].sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [trades, sortConfig]);

    const renderSortIcon = (key: keyof Trade) => {
        if (sortConfig?.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="ml-2 h-4 w-4" />
            : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const handleExport = () => {
        window.location.href = `${API_BASE_URL}/api/export/trades/csv`;
    };

    return (
        <DraggableModal
            isOpen={isOpen}
            onClose={onClose}
            title="Trade Journal"
            defaultWidth={1000}
            defaultHeight={800}
            minWidth={800}
            minHeight={600}
        >
            <div className="flex flex-col h-full gap-4 p-1">

                {/* Toolbar / Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-1">
                    <h3 className="text-sm font-medium text-muted-foreground hidden sm:block">
                        Performance & History
                    </h3>
                    <div className="flex gap-2 ml-auto">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            disabled={isLoading || trades.length === 0}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Export CSV
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            disabled={isLoading || isFetching}
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${(isLoading || isFetching) ? 'animate-spin' : ''}`} />
                            {isFetching ? 'Refreshing...' : 'Refresh'}
                        </Button>
                    </div>
                </div>

                {/* Dashboard */}
                <PerformanceDashboard className="mb-2" />

                {/* Table Container - Flex grow to fill remaining space */}
                <Card className="flex-1 overflow-hidden flex flex-col">
                    <CardContent className="p-0 flex-1 overflow-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="w-[180px] cursor-pointer" onClick={() => handleSort('entry_time')}>
                                        <div className="flex items-center">Time {renderSortIcon('entry_time')}</div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('symbol')}>
                                        <div className="flex items-center">Symbol {renderSortIcon('symbol')}</div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('direction')}>
                                        <div className="flex items-center">Direction {renderSortIcon('direction')}</div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort('size')}>
                                        <div className="flex items-center justify-end">Size {renderSortIcon('size')}</div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort('entry_price')}>
                                        <div className="flex items-center justify-end">Price {renderSortIcon('entry_price')}</div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort('pnl')}>
                                        <div className="flex items-center justify-end">PnL {renderSortIcon('pnl')}</div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>
                                        <div className="flex items-center">Status {renderSortIcon('status')}</div>
                                    </TableHead>
                                    <TableHead className="w-[80px]">Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            Loading trades...
                                        </TableCell>
                                    </TableRow>
                                ) : sortedTrades.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                            No trades found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedTrades.map((trade) => (
                                        <TableRow key={trade.id}>
                                            <TableCell className="font-medium whitespace-nowrap">
                                                {new Date(trade.entry_time).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="font-semibold">{trade.symbol}</TableCell>
                                            <TableCell>
                                                <Badge variant={trade.direction === 'BUY' ? 'default' : 'destructive'} className={trade.direction === 'BUY' ? 'bg-green-600 hover:bg-green-600' : ''}>
                                                    {trade.direction}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">{trade.size.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-mono">{trade.entry_price.toFixed(5)}</TableCell>
                                            <TableCell className={`text-right font-mono font-bold ${trade.pnl && trade.pnl > 0 ? 'text-green-600' : trade.pnl && trade.pnl < 0 ? 'text-red-600' : ''}`}>
                                                {trade.pnl ? `${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}` : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={trade.status === 'OPEN' ? 'border-blue-500 text-blue-500' : ''}>
                                                    {trade.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link to={`/execution/${trade.execution_id}`}>
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Link>
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
