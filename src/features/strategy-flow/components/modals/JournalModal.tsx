/**
 * JournalModal - Trade journal for Strategy Flow
 * Shows trade history, performance stats, and analytics
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WindowModal } from './WindowModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  BookOpen,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  DollarSign,
  Target,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface Trade {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entry_time: string;
  exit_time?: string;
  entry_price: number;
  exit_price?: number;
  size: number;
  pnl?: number;
  return_pct?: number;
  status: 'open' | 'closed' | 'cancelled';
  strategy?: string;
}

interface TradeSummary {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
  largest_win: number;
  largest_loss: number;
}

interface JournalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

async function fetchTrades(): Promise<Trade[]> {
  const response = await fetch(`${API_BASE_URL}/api/trades`);
  if (!response.ok) throw new Error('Failed to fetch trades');
  return response.json();
}

async function fetchTradeSummary(): Promise<TradeSummary> {
  const response = await fetch(`${API_BASE_URL}/api/trades/summary`);
  if (!response.ok) throw new Error('Failed to fetch summary');
  return response.json();
}

export const JournalModal = ({ open, onOpenChange }: JournalModalProps) => {
  const [activeTab, setActiveTab] = useState('trades');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Trade; direction: 'asc' | 'desc' } | null>(null);

  const { data: trades = [], isLoading, refetch } = useQuery({
    queryKey: ['trades'],
    queryFn: fetchTrades,
    enabled: open,
    refetchInterval: 10000,
  });

  const { data: summary } = useQuery({
    queryKey: ['trade-summary'],
    queryFn: fetchTradeSummary,
    enabled: open,
    refetchInterval: 30000,
  });

  const sortedTrades = useMemo(() => {
    if (!sortConfig) return trades;
    return [...trades].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [trades, sortConfig]);

  const handleSort = (key: keyof Trade) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleExport = () => {
    const csv = [
      ['ID', 'Symbol', 'Direction', 'Entry Time', 'Exit Time', 'Entry Price', 'Exit Price', 'Size', 'PnL', 'Return %', 'Status'].join(','),
      ...trades.map(t => [
        t.id, t.symbol, t.direction, t.entry_time, t.exit_time || '',
        t.entry_price, t.exit_price || '', t.size, t.pnl || '', t.return_pct || '', t.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Trades exported');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumber = (value?: number, decimals = 2) => {
    if (value === undefined || value === null) return '-';
    return value.toFixed(decimals);
  };

  return (
    <WindowModal
      open={open}
      onOpenChange={onOpenChange}
      title="Trade Journal"
      icon={<BookOpen className="w-5 h-5 text-purple-400" />}
      defaultWidth={900}
      defaultHeight={700}
      minWidth={600}
      minHeight={400}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="border-border"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="border-border"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-2 bg-secondary border border-border">
            <TabsTrigger value="trades" className="data-[state=active]:bg-purple-600">
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              Trade History
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-purple-600">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
              Statistics
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 p-6">
            {/* Trade History Tab */}
            <TabsContent value="trades" className="m-0">
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  Loading trades...
                </div>
              ) : trades.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No trades recorded yet</p>
                  <p className="text-sm mt-1">Run a backtest or start live trading to see trades here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="cursor-pointer" onClick={() => handleSort('symbol')}>
                        Symbol
                        <ArrowUpDown className="w-3 h-3 ml-1 inline" />
                      </TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('entry_time')}>
                        Entry
                        <ArrowUpDown className="w-3 h-3 ml-1 inline" />
                      </TableHead>
                      <TableHead>Exit</TableHead>
                      <TableHead className="text-right">Entry Price</TableHead>
                      <TableHead className="text-right">Exit Price</TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('pnl')}>
                        PnL
                        <ArrowUpDown className="w-3 h-3 ml-1 inline" />
                      </TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTrades.map((trade) => (
                      <TableRow key={trade.id} className="border-border">
                        <TableCell className="font-medium">{trade.symbol}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={trade.direction === 'long'
                              ? 'bg-green-500/10 text-green-400 border-green-500/30'
                              : 'bg-red-500/10 text-red-400 border-red-500/30'
                            }
                          >
                            {trade.direction === 'long' ? (
                              <TrendingUp className="w-3 h-3 mr-1" />
                            ) : (
                              <TrendingDown className="w-3 h-3 mr-1" />
                            )}
                            {trade.direction.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(trade.entry_time)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(trade.exit_time)}</TableCell>
                        <TableCell className="text-right">{formatNumber(trade.entry_price, 4)}</TableCell>
                        <TableCell className="text-right">{formatNumber(trade.exit_price, 4)}</TableCell>
                        <TableCell className={`text-right font-medium ${(trade.pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                          {trade.pnl !== undefined ? (
                            <>
                              {trade.pnl >= 0 ? '+' : ''}{formatNumber(trade.pnl)}
                              {trade.return_pct !== undefined && (
                                <span className="text-xs ml-1">({formatNumber(trade.return_pct)}%)</span>
                              )}
                            </>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              trade.status === 'open'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : trade.status === 'closed'
                                  ? 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                            }
                          >
                            {trade.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Statistics Tab */}
            <TabsContent value="stats" className="m-0 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-secondary rounded-lg border border-border text-center">
                  <div className="text-2xl font-bold text-purple-400">{summary?.total_trades || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Trades</div>
                </div>
                <div className="p-4 bg-secondary rounded-lg border border-border text-center">
                  <div className="text-2xl font-bold text-blue-400">{formatNumber(summary?.win_rate)}%</div>
                  <div className="text-xs text-muted-foreground">Win Rate</div>
                </div>
                <div className="p-4 bg-secondary rounded-lg border border-border text-center">
                  <div className={`text-2xl font-bold ${(summary?.total_pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${formatNumber(summary?.total_pnl)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total PnL</div>
                </div>
                <div className="p-4 bg-secondary rounded-lg border border-border text-center">
                  <div className="text-2xl font-bold text-orange-400">{formatNumber(summary?.profit_factor)}</div>
                  <div className="text-xs text-muted-foreground">Profit Factor</div>
                </div>
              </div>

              {/* Detailed Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-secondary rounded-lg border border-border">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    Winning Trades
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Count:</span>
                      <span className="font-medium text-green-400">{summary?.winning_trades || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Average Win:</span>
                      <span className="font-medium text-green-400">${formatNumber(summary?.avg_win)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Largest Win:</span>
                      <span className="font-medium text-green-400">${formatNumber(summary?.largest_win)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-secondary rounded-lg border border-border">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    Losing Trades
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Count:</span>
                      <span className="font-medium text-red-400">{summary?.losing_trades || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Average Loss:</span>
                      <span className="font-medium text-red-400">${formatNumber(summary?.avg_loss)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Largest Loss:</span>
                      <span className="font-medium text-red-400">${formatNumber(summary?.largest_loss)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </WindowModal>
  );
};

export default JournalModal;
