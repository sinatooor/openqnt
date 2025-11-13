import { useState } from 'react';
import { TradingViewChart } from './TradingViewChart';
import { BacktestResult } from '@/lib/backtestEngine';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  DollarSign,
  Percent,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BacktestingPanelProps {
  result: BacktestResult | null;
  isLoading: boolean;
  symbol?: string;
  onClose?: () => void;
}

export const BacktestingPanel = ({
  result,
  isLoading,
  symbol = 'BTC/USDT',
  onClose,
}: BacktestingPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [interval, setInterval] = useState('1D');

  const togglePanel = () => {
    if (!isExpanded && onClose) {
      onClose();
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  if (!result && !isLoading) {
    return null;
  }

  return (
    <div
      className={cn(
        'relative h-full bg-card border-l border-border transition-all duration-300 flex flex-col',
        isExpanded ? 'w-[500px]' : 'w-12',
        'md:w-[500px] md:max-w-[500px]', // Responsive width
        !isExpanded && 'md:w-12'
      )}
    >
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePanel}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 h-8 w-8 rounded-full bg-card border border-border shadow-lg hover:bg-accent"
      >
        {isExpanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      {/* Panel Content */}
      {isExpanded && (
        <div className="flex flex-col h-full animate-fade-in">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-foreground">Backtest Results</h2>
              <Badge variant="secondary" className="gap-1">
                <Activity className="h-3 w-3" />
                {symbol}
              </Badge>
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Running backtest...
              </div>
            )}
          </div>

          {/* Content */}
          {result && !isLoading && (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* Performance Metrics */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Performance Metrics
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Total Return */}
                    <Card className="bg-background/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Total Return
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div
                          className={cn(
                            'text-2xl font-bold flex items-center gap-1',
                            result.metrics.totalReturn >= 0 ? 'text-block-environment' : 'text-destructive'
                          )}
                        >
                          {result.metrics.totalReturn >= 0 ? (
                            <TrendingUp className="h-5 w-5" />
                          ) : (
                            <TrendingDown className="h-5 w-5" />
                          )}
                          {result.metrics.totalReturn.toFixed(2)}%
                        </div>
                      </CardContent>
                    </Card>

                    {/* Win Rate */}
                    <Card className="bg-background/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Win Rate
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-foreground flex items-center gap-1">
                          <Percent className="h-5 w-5" />
                          {result.metrics.winRate.toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>

                    {/* Max Drawdown */}
                    <Card className="bg-background/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground">Max Drawdown</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-bold text-destructive">
                          -{result.metrics.maxDrawdown.toFixed(2)}%
                        </div>
                      </CardContent>
                    </Card>

                    {/* Sharpe Ratio */}
                    <Card className="bg-background/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground">Sharpe Ratio</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-bold text-foreground">
                          {result.metrics.sharpeRatio.toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Total Trades */}
                    <Card className="bg-background/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground">Total Trades</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-bold text-foreground">
                          {result.metrics.totalTrades}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="text-block-environment">{result.metrics.winningTrades}W</span> /{' '}
                          <span className="text-destructive">{result.metrics.losingTrades}L</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Profit Factor */}
                    <Card className="bg-background/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground">Profit Factor</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-bold text-foreground">
                          {result.metrics.profitFactor === Infinity
                            ? '∞'
                            : result.metrics.profitFactor.toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Separator />

                {/* Chart */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Price Chart</h3>
                  <TradingViewChart
                    data={result.chartData}
                    trades={result.trades}
                    symbol={symbol}
                    interval={interval}
                    onIntervalChange={setInterval}
                  />
                </div>

                <Separator />

                {/* Trade Log */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Trade Log</h3>
                  <div className="space-y-2">
                    {result.trades.length === 0 ? (
                      <Card className="bg-background/50">
                        <CardContent className="py-8 text-center text-muted-foreground text-sm">
                          No trades executed
                        </CardContent>
                      </Card>
                    ) : (
                      result.trades.map((trade, index) => (
                        <Card key={index} className="bg-background/50">
                          <CardContent className="py-3 px-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={trade.type === 'buy' ? 'default' : 'secondary'}
                                  className={cn(
                                    'font-semibold',
                                    trade.type === 'buy'
                                      ? 'bg-block-environment text-block-environment-foreground'
                                      : 'bg-destructive text-destructive-foreground'
                                  )}
                                >
                                  {trade.type.toUpperCase()}
                                </Badge>
                                <span className="text-sm font-medium text-foreground">
                                  ${trade.price.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {trade.profit !== undefined && (
                                  <span
                                    className={cn(
                                      'text-sm font-semibold',
                                      trade.profit >= 0 ? 'text-block-environment' : 'text-destructive'
                                    )}
                                  >
                                    {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {new Date((trade.time as number) * 1000).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
};
