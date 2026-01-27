/**
 * BacktestModal - Full-featured backtesting modal for Strategy Flow
 * Features: Engine selection, results display, visualization, comparison
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
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Play, 
  Loader2, 
  Settings2,
  BarChart3,
  Cpu,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Download,
  GitCompare
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
  engine: 'backtesting.py' | 'rust' | 'nautilus';
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

const ENGINES = [
  { 
    value: 'backtesting.py', 
    label: 'Backtesting.py', 
    description: 'Python-based, feature-rich', 
    icon: Cpu,
    color: 'text-blue-400'
  },
  { 
    value: 'rust', 
    label: 'Rust Engine', 
    description: 'Ultra-fast performance', 
    icon: Zap,
    color: 'text-orange-400'
  },
  { 
    value: 'nautilus', 
    label: 'NautilusTrader', 
    description: 'Institutional-grade', 
    icon: Target,
    color: 'text-green-400'
  },
];

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
    engine: 'backtesting.py',
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

      toast.info(`Running backtest with ${config.engine}...`);

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
          engine: config.engine,
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
      <DialogContent className="sm:max-w-[700px] h-[700px] bg-[#1a1a1f] border-white/10 text-white p-0 flex flex-col">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Backtest Strategy
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Configure parameters and run a historical simulation
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'config' | 'results')} className="flex-1 flex flex-col">
          <TabsList className="mx-6 bg-[#252530] border border-white/10">
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
              {/* Engine Selection */}
              <div className="space-y-3">
                <Label className="text-white/70 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Backtest Engine
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {ENGINES.map((engine) => {
                    const Icon = engine.icon;
                    const isSelected = config.engine === engine.value;
                    return (
                      <button
                        key={engine.value}
                        type="button"
                        onClick={() => updateConfig('engine', engine.value)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          isSelected 
                            ? 'bg-purple-600/20 border-purple-500' 
                            : 'bg-[#252530] border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`w-4 h-4 ${engine.color}`} />
                          <span className="font-medium text-sm">{engine.label}</span>
                        </div>
                        <p className="text-xs text-white/50">{engine.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator className="bg-white/10" />

              {/* Symbol & Timeframe */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/70">Symbol</Label>
                  <Select value={config.symbol} onValueChange={(v) => updateConfig('symbol', v)}>
                    <SelectTrigger className="bg-[#252530] border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#252530] border-white/10">
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
                  <Label className="text-white/70">Timeframe</Label>
                  <Select value={config.timeframe} onValueChange={(v) => updateConfig('timeframe', v)}>
                    <SelectTrigger className="bg-[#252530] border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#252530] border-white/10">
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
                  <Label className="text-white/70 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Start Date
                  </Label>
                  <Input
                    type="date"
                    value={config.startDate}
                    onChange={(e) => updateConfig('startDate', e.target.value)}
                    className="bg-[#252530] border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    End Date
                  </Label>
                  <Input
                    type="date"
                    value={config.endDate}
                    onChange={(e) => updateConfig('endDate', e.target.value)}
                    className="bg-[#252530] border-white/10"
                  />
                </div>
              </div>

              {/* Capital & Position Size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/70 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    Initial Capital
                  </Label>
                  <Input
                    type="number"
                    value={config.initialCapital}
                    onChange={(e) => updateConfig('initialCapital', parseFloat(e.target.value))}
                    className="bg-[#252530] border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Position Size (%)</Label>
                  <Input
                    type="number"
                    value={config.positionSize}
                    onChange={(e) => updateConfig('positionSize', parseFloat(e.target.value))}
                    className="bg-[#252530] border-white/10"
                    min={1}
                    max={100}
                  />
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs">Commission (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.commission}
                    onChange={(e) => updateConfig('commission', parseFloat(e.target.value))}
                    className="bg-[#252530] border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs">Slippage (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.slippage}
                    onChange={(e) => updateConfig('slippage', parseFloat(e.target.value))}
                    className="bg-[#252530] border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs">Leverage</Label>
                  <Input
                    type="number"
                    value={config.leverage}
                    onChange={(e) => updateConfig('leverage', parseInt(e.target.value))}
                    className="bg-[#252530] border-white/10"
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
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg"
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
                  <p className="text-center text-xs text-white/40 mt-2">
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
                    <div className="p-3 bg-[#252530] rounded-lg border border-white/10 text-center">
                      <div className={`text-xl font-bold ${result.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {result.totalReturn >= 0 ? '+' : ''}{formatNumber(result.totalReturn)}%
                      </div>
                      <div className="text-xs text-white/50">Total Return</div>
                    </div>
                    <div className="p-3 bg-[#252530] rounded-lg border border-white/10 text-center">
                      <div className="text-xl font-bold text-blue-400">{formatNumber(result.winRate)}%</div>
                      <div className="text-xs text-white/50">Win Rate</div>
                    </div>
                    <div className="p-3 bg-[#252530] rounded-lg border border-white/10 text-center">
                      <div className="text-xl font-bold text-purple-400">{result.totalTrades}</div>
                      <div className="text-xs text-white/50">Total Trades</div>
                    </div>
                    <div className="p-3 bg-[#252530] rounded-lg border border-white/10 text-center">
                      <div className="text-xl font-bold text-red-400">{formatNumber(result.maxDrawdown)}%</div>
                      <div className="text-xs text-white/50">Max Drawdown</div>
                    </div>
                  </div>

                  {/* Detailed Metrics */}
                  <div className="p-4 bg-[#252530] rounded-lg border border-white/10">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-purple-400" />
                      Performance Metrics
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-white/60">Final Balance:</span>
                        <span className="font-medium">${formatNumber(result.finalBalance, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Sharpe Ratio:</span>
                        <span className="font-medium">{formatNumber(result.sharpeRatio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Profit Factor:</span>
                        <span className="font-medium">{formatNumber(result.profitFactor)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Sortino Ratio:</span>
                        <span className="font-medium">{formatNumber(result.sortinoRatio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Calmar Ratio:</span>
                        <span className="font-medium">{formatNumber(result.calmarRatio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Avg Hold Time:</span>
                        <span className="font-medium">{result.avgHoldingTime || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Result Status */}
                  <div className={`p-4 rounded-lg border ${
                    result.totalReturn >= 0 
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
                      <p className="text-sm text-white/60 mt-2">
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
                        className="flex-1 border-white/10"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Chart
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={handleDownloadReport}
                      className="flex-1 border-white/10"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Report
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('config')}
                      className="flex-1 border-white/10"
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
