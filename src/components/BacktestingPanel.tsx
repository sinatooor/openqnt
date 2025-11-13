import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TradingViewChart } from './TradingViewChart';
import { BacktestResult } from '@/lib/backtestEngine';
import { CandleData } from '@/lib/marketData';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target, 
  AlertTriangle,
  Eye,
  EyeOff,
  DollarSign,
  Percent,
  BarChart3
} from 'lucide-react';

interface BacktestingPanelProps {
  result: BacktestResult;
  marketData: CandleData[];
}

export const BacktestingPanel = ({ result, marketData }: BacktestingPanelProps) => {
  const [showChart, setShowChart] = useState(true);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="w-[500px] bg-card border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Backtest Results
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChart(!showChart)}
          >
            {showChart ? (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                Hide Chart
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Show Chart
              </>
            )}
          </Button>
        </div>
        
        {/* Performance Summary */}
        <div className="grid grid-cols-2 gap-2">
          <Card className={`${result.totalReturn >= 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Return</p>
                  <p className={`text-lg font-bold ${result.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatPercent(result.totalReturn)}
                  </p>
                </div>
                {result.totalReturn >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-500" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-500" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/30">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                  <p className="text-lg font-bold text-foreground">
                    {result.winRate.toFixed(1)}%
                  </p>
                </div>
                <Target className="w-6 h-6 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {/* Chart Section */}
        {showChart && (
          <div className="p-4 border-b border-border">
            <TradingViewChart data={marketData} trades={result.trades} />
          </div>
        )}

        {/* Detailed Metrics */}
        <div className="p-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Performance Metrics
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded bg-secondary/20">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <DollarSign className="w-3 h-3" />
                  Initial Balance
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(result.initialBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-secondary/20">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <DollarSign className="w-3 h-3" />
                  Final Balance
                </span>
                <span className={`text-sm font-semibold ${result.finalBalance >= result.initialBalance ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(result.finalBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-secondary/20">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3" />
                  Max Drawdown
                </span>
                <span className="text-sm font-semibold text-red-500">
                  {result.maxDrawdown.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-secondary/20">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Activity className="w-3 h-3" />
                  Sharpe Ratio
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {result.sharpeRatio.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-secondary/20">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Percent className="w-3 h-3" />
                  Profit Factor
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {result.profitFactor === Infinity ? '∞' : result.profitFactor.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Trade Statistics */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Trade Statistics</h4>
            <div className="grid grid-cols-3 gap-2">
              <Card className="bg-secondary/30">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Trades</p>
                  <p className="text-xl font-bold text-foreground">{result.totalTrades}</p>
                </CardContent>
              </Card>
              <Card className="bg-green-500/10 border-green-500/20">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Winners</p>
                  <p className="text-xl font-bold text-green-500">{result.winningTrades}</p>
                </CardContent>
              </Card>
              <Card className="bg-red-500/10 border-red-500/20">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Losers</p>
                  <p className="text-xl font-bold text-red-500">{result.losingTrades}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          {/* Trade Log */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Trade Log</h4>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {result.trades.map((trade, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded border ${
                      trade.type === 'buy'
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge
                        variant={trade.type === 'buy' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {trade.type.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(trade.time * 1000).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {trade.amount.toFixed(4)} @ {formatCurrency(trade.price)}
                      </span>
                      {trade.pnl !== undefined && (
                        <span className={trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
