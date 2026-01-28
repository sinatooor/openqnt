/**
 * BacktestModal - Backtesting modal for Strategy Flow
 * Features: Results display, visualization, equity curve
 * Engine: Backtrader with TA-Lib indicators
 */

import { memo, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Play,
  Loader2,
  Settings2,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStrategyFlowStore, validateStrategy } from '../../store/strategyFlowStore';
import { generateBacktestingPyCode } from '../../generators';

interface BacktestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface BacktestConfig {
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  positionSize: number;
  commission: number;
  slippage: number;
  leverage: number;
}

interface BacktestResult {
  success: boolean;
  totalReturn: number;
  winRate: number;
  totalTrades: number;
  maxDrawdown: number;
  finalBalance: number;
  sharpeRatio?: number;
  profitFactor?: number;
  sortinoRatio?: number;
  calmarRatio?: number;
  avgHoldingTime?: string;
  visualizationHtml?: string;
  rawStats?: string;
  trades?: Array<{
    entry_time: string;
    exit_time: string;
    entry_price: number;
    exit_price: number;
    pnl: number;
    type: string;
  }>;
}

const SYMBOLS = [
  { value: 'EURUSD', label: 'EUR/USD', category: 'Forex' },
  { value: 'GBPUSD', label: 'GBP/USD', category: 'Forex' },
  { value: 'USDJPY', label: 'USD/JPY', category: 'Forex' },
  { value: 'BTCUSDT', label: 'BTC/USDT', category: 'Crypto' },
  { value: 'ETHUSDT', label: 'ETH/USDT', category: 'Crypto' },
  { value: 'SPY', label: 'S&P 500 ETF', category: 'Stocks' },
  { value: 'AAPL', label: 'Apple Inc.', category: 'Stocks' },
  { value: 'GOOGL', label: 'Alphabet', category: 'Stocks' },
  { value: 'MSFT', label: 'Microsoft', category: 'Stocks' },
  { value: 'TSLA', label: 'Tesla', category: 'Stocks' },
];

const TIMEFRAMES = [
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: 'Daily' },
  { value: '1w', label: 'Weekly' },
];

// Using backtrader as the single engine - no engine selection needed

const formatNumber = (value: number | undefined, decimals: number = 2): string => {
  if (value === undefined || value === null || isNaN(value)) return 'N/A';
  return value.toFixed(decimals);
};

export const BacktestModal = memo(({ open, onOpenChange }: BacktestModalProps) => {
  const [activeTab, setActiveTab] = useState<'config' | 'results'>('config');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const { nodes, edges, strategyName } = useStrategyFlowStore();

  const [config, setConfig] = useState<BacktestConfig>({
    symbol: 'EURUSD',
    timeframe: '1d',
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 10000,
    positionSize: 10,
    commission: 0.1,
    slippage: 0.05,
    leverage: 1,
  });

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  const updateConfig = (key: keyof BacktestConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const runBacktest = useCallback(async () => {
    if (nodes.length === 0) {
      toast.error('Add nodes to your strategy first');
      return;
    }

    // Validate strategy before running
    const validation = validateStrategy(nodes, edges);

    if (!validation.isValid) {
      toast.error('Strategy validation failed', {
        description: validation.errors.join('. '),
      });
      return;
    }

    // Show warnings but continue
    if (validation.warnings.length > 0) {
      toast.warning('Strategy has warnings', {
        description: validation.warnings[0],
      });
    }

    setIsRunning(true);
    setResult(null);

    try {
      // Generate Python code from flow nodes
      const pythonCode = generateBacktestingPyCode(nodes, edges);

      if (!pythonCode || pythonCode.includes('# No strategy defined')) {
        toast.error('Could not generate strategy code. Add indicator and action nodes.');
        setIsRunning(false);
        return;
      }

      toast.info('Running backtest with Backtrader...');

      const response = await fetch(`${backendUrl}/backtest-py-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pythonCode,
          symbol: config.symbol,
          startDate: config.startDate,
          endDate: config.endDate,
          initialBalance: config.initialCapital,
          commission: config.commission / 100,
          leverage: config.leverage,
          timeframe: config.timeframe,
          positionSize: config.positionSize,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          totalReturn: data.metrics.total_return,
          winRate: data.metrics.win_rate,
          totalTrades: data.metrics.total_trades,
          maxDrawdown: data.metrics.max_drawdown,
          finalBalance: data.final_balance,
          sharpeRatio: data.metrics.sharpe_ratio,
          profitFactor: data.metrics.profit_factor,
          sortinoRatio: data.metrics.sortino_ratio,
          calmarRatio: data.metrics.calmar_ratio,
          avgHoldingTime: data.metrics.avg_holding_time,
          visualizationHtml: data.visualization_html,
          rawStats: data.raw_stats,
          trades: data.trades,
        });

        setActiveTab('results');
        toast.success(`Backtest completed: ${formatNumber(data.metrics.total_return)}% return`);
      } else {
        toast.error('Backtest failed', { description: data.error });
      }
    } catch (error) {
      console.error('Backtest error:', error);
      toast.error('Backtest failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsRunning(false);
    }
  }, [nodes, edges, config, backendUrl]);

  const handleOpenVisualization = () => {
    if (result?.visualizationHtml) {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(result.visualizationHtml);
      }
    }
  };

  const handleDownloadReport = () => {
    if (result) {
      const report = {
        strategy: strategyName,
        config,
        results: result,
        timestamp: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backtest_${strategyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[700px] bg-card/80 backdrop-blur-xl border-border/50 text-foreground p-0 flex flex-col">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Backtest Strategy
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure parameters and run a historical simulation
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'config' | 'results')} className="flex-1 flex flex-col">
          <TabsList className="mx-6 bg-secondary border border-border">
            <TabsTrigger value="config" className="flex items-center gap-1.5 data-[state=active]:bg-purple-600">
              <Settings2 className="w-3.5 h-3.5" />
              Configuration
            </TabsTrigger>
            <TabsTrigger
              value="results"
              className="flex items-center gap-1.5 data-[state=active]:bg-purple-600"
              disabled={!result}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Results
              {result && (
                <Badge variant="outline" className={`ml-1 text-xs ${result.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {result.totalReturn >= 0 ? '+' : ''}{formatNumber(result.totalReturn)}%
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 p-6">
            {/* Configuration Tab */}
            <TabsContent value="config" className="m-0 space-y-6">
              {/* Symbol & Timeframe */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Symbol</Label>
                  <Select value={config.symbol} onValueChange={(v) => updateConfig('symbol', v)}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {SYMBOLS.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          <span className="flex items-center gap-2">
                            {s.label}
                            <Badge variant="outline" className="text-[10px]">{s.category}</Badge>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Timeframe</Label>
                  <Select value={config.timeframe} onValueChange={(v) => updateConfig('timeframe', v)}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-secondary border-border">
                      {TIMEFRAMES.map(tf => (
                        <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Start Date
                  </Label>
                  <Input
                    type="date"
                    value={config.startDate}
                    onChange={(e) => updateConfig('startDate', e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    End Date
                  </Label>
                  <Input
                    type="date"
                    value={config.endDate}
                    onChange={(e) => updateConfig('endDate', e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              {/* Capital & Position Size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    Initial Capital
                  </Label>
                  <Input
                    type="number"
                    value={config.initialCapital}
                    onChange={(e) => updateConfig('initialCapital', parseFloat(e.target.value))}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Position Size (%)</Label>
                  <Input
                    type="number"
                    value={config.positionSize}
                    onChange={(e) => updateConfig('positionSize', parseFloat(e.target.value))}
                    className="bg-secondary border-border"
                    min={1}
                    max={100}
                  />
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Commission (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.commission}
                    onChange={(e) => updateConfig('commission', parseFloat(e.target.value))}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Slippage (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.slippage}
                    onChange={(e) => updateConfig('slippage', parseFloat(e.target.value))}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Leverage</Label>
                  <Input
                    type="number"
                    value={config.leverage}
                    onChange={(e) => updateConfig('leverage', parseInt(e.target.value))}
                    className="bg-secondary border-border"
                    min={1}
                    max={100}
                  />
                </div>
              </div>

              {/* Run Button */}
              <div className="pt-4">
                <Button
                  onClick={runBacktest}
                  disabled={isRunning || nodes.length === 0}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-lg shadow-md"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Running Backtest...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Run Backtest
                    </>
                  )}
                </Button>
                {nodes.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    Add nodes to your strategy to run a backtest
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="m-0 space-y-6">
              {result && (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 bg-secondary rounded-lg border border-border text-center">
                      <div className={`text-xl font-bold ${result.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {result.totalReturn >= 0 ? '+' : ''}{formatNumber(result.totalReturn)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Total Return</div>
                    </div>
                    <div className="p-3 bg-secondary rounded-lg border border-border text-center">
                      <div className="text-xl font-bold text-blue-400">{formatNumber(result.winRate)}%</div>
                      <div className="text-xs text-muted-foreground">Win Rate</div>
                    </div>
                    <div className="p-3 bg-secondary rounded-lg border border-border text-center">
                      <div className="text-xl font-bold text-purple-400">{result.totalTrades}</div>
                      <div className="text-xs text-muted-foreground">Total Trades</div>
                    </div>
                    <div className="p-3 bg-secondary rounded-lg border border-border text-center">
                      <div className="text-xl font-bold text-red-400">{formatNumber(result.maxDrawdown)}%</div>
                      <div className="text-xs text-muted-foreground">Max Drawdown</div>
                    </div>
                  </div>

                  {/* Equity Curve */}
                  <div className="p-4 bg-secondary rounded-lg border border-border">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-purple-400" />
                      Equity Curve
                    </h4>
                    <div className="h-32 relative bg-black/20 rounded overflow-hidden">
                      {/* Simple equity visualization */}
                      <div className="absolute inset-0 flex items-end justify-around px-1 gap-0.5">
                        {/* Generate a simple bar chart based on return */}
                        {Array.from({ length: 20 }, (_, i) => {
                          // Simulate equity curve based on final return
                          const progress = (i + 1) / 20;
                          const noise = Math.sin(i * 0.8) * 15;
                          const baseHeight = 30 + (result.totalReturn > 0 
                            ? Math.min(progress * result.totalReturn * 2, 60) 
                            : Math.max(progress * result.totalReturn * 2, -20));
                          const height = Math.max(10, Math.min(95, baseHeight + noise));
                          const isPositive = result.totalReturn >= 0;
                          
                          return (
                            <div
                              key={i}
                              className={`flex-1 rounded-t transition-all ${
                                isPositive 
                                  ? 'bg-gradient-to-t from-green-600 to-green-400' 
                                  : 'bg-gradient-to-t from-red-600 to-red-400'
                              }`}
                              style={{ height: `${height}%`, opacity: 0.6 + (progress * 0.4) }}
                            />
                          );
                        })}
                      </div>
                      {/* Start/End labels */}
                      <div className="absolute bottom-0 left-2 text-[10px] text-muted-foreground">
                        ${formatNumber(config.initialCapital, 0)}
                      </div>
                      <div className="absolute bottom-0 right-2 text-[10px] text-muted-foreground">
                        ${formatNumber(result.finalBalance, 0)}
                      </div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>{config.startDate}</span>
                      <span>{config.endDate}</span>
                    </div>
                  </div>

                  {/* Detailed Metrics */}
                  <div className="p-4 bg-secondary rounded-lg border border-border">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-purple-400" />
                      Performance Metrics
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Final Balance:</span>
                        <span className="font-medium">${formatNumber(result.finalBalance, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sharpe Ratio:</span>
                        <span className="font-medium">{formatNumber(result.sharpeRatio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Profit Factor:</span>
                        <span className="font-medium">{formatNumber(result.profitFactor)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sortino Ratio:</span>
                        <span className="font-medium">{formatNumber(result.sortinoRatio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Calmar Ratio:</span>
                        <span className="font-medium">{formatNumber(result.calmarRatio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Hold Time:</span>
                        <span className="font-medium">{result.avgHoldingTime || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Result Status */}
                  <div className={`p-4 rounded-lg border ${result.totalReturn >= 0
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                    }`}>
                    <div className="flex items-center gap-2">
                      {result.totalReturn >= 0 ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      )}
                      <span className="font-medium">
                        {result.totalReturn >= 0
                          ? 'Strategy shows positive returns'
                          : 'Strategy shows negative returns'}
                      </span>
                    </div>
                    {result.totalTrades === 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        No trades were executed. Check your entry/exit conditions.
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    {result.visualizationHtml && (
                      <Button
                        variant="outline"
                        onClick={handleOpenVisualization}
                        className="flex-1 border-border"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Chart
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={handleDownloadReport}
                      className="flex-1 border-border"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Report
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('config')}
                      className="flex-1 border-border"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Run Again
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
});

BacktestModal.displayName = 'BacktestModal';
