/**
 * BacktestNode - Historical backtesting configuration node
 * Receives strategy signal, runs backtest, outputs results
 */

import { memo, useState } from 'react';
import { Position } from '@xyflow/react';
import { LineChart, Play, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { BaseNode } from './BaseNode';
import { BacktestNodeData } from '../../types';
import { usePipelineStore } from '../../store/pipelineStore';

interface BacktestNodeProps {
  id: string;
  data: BacktestNodeData;
  selected?: boolean;
}

const TIMEFRAMES = [
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: 'Daily' },
] as const;

export const BacktestNode = memo(({ id, data, selected }: BacktestNodeProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const runBacktest = async () => {
    setIsRunning(true);
    setProgress(0);
    updateNodeData<BacktestNodeData>(id, { status: 'running' });

    try {
      // Simulate backtest progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((r) => setTimeout(r, 200));
        setProgress(i);
      }

      // Mock results - in production, this calls the backend
      const mockResults = {
        totalReturn: Math.random() * 50 - 10, // -10% to +40%
        winRate: 45 + Math.random() * 20, // 45% to 65%
        profitFactor: 0.8 + Math.random() * 1.2, // 0.8 to 2.0
        maxDrawdown: 5 + Math.random() * 20, // 5% to 25%
        sharpeRatio: -0.5 + Math.random() * 2.5, // -0.5 to 2.0
        totalTrades: Math.floor(50 + Math.random() * 200),
      };

      updateNodeData<BacktestNodeData>(id, { 
        status: 'success',
        results: mockResults,
      });
    } catch (error) {
      updateNodeData<BacktestNodeData>(id, { status: 'error' });
    } finally {
      setIsRunning(false);
      setProgress(100);
    }
  };

  const getReturnIcon = (returnPct?: number) => {
    if (returnPct === undefined) return null;
    if (returnPct > 0) return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (returnPct < 0) return <TrendingDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  const formatPercent = (val?: number) => {
    if (val === undefined) return '—';
    return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
  };

  return (
    <BaseNode
      title="Backtest"
      icon={<LineChart className="w-4 h-4" />}
      color="#06b6d4"
      selected={selected}
      status={data.status || 'idle'}
      statusText={isRunning ? `${progress}%` : data.results ? 'Complete' : undefined}
      handles={[
        { id: 'strategy-in', type: 'target', position: Position.Left, color: '#8b5cf6' },
        { id: 'results-out', type: 'source', position: Position.Right, color: '#06b6d4' },
      ]}
    >
      <div className="space-y-2.5">
        {/* Symbol & Timeframe */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Symbol</label>
            <Input
              value={data.symbol}
              onChange={(e) => updateNodeData<BacktestNodeData>(id, { symbol: e.target.value.toUpperCase() })}
              className="h-7 text-xs font-mono"
              placeholder="EURUSD"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Timeframe</label>
            <Select
              value={data.timeframe}
              onValueChange={(v) => updateNodeData<BacktestNodeData>(id, { timeframe: v })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((tf) => (
                  <SelectItem key={tf.value} value={tf.value}>
                    {tf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Start</label>
            <Input
              type="date"
              value={data.startDate}
              onChange={(e) => updateNodeData<BacktestNodeData>(id, { startDate: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">End</label>
            <Input
              type="date"
              value={data.endDate}
              onChange={(e) => updateNodeData<BacktestNodeData>(id, { endDate: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
        </div>

        {/* Capital */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Initial Capital</label>
          <Input
            type="number"
            value={data.initialCapital}
            onChange={(e) => updateNodeData<BacktestNodeData>(id, { initialCapital: parseFloat(e.target.value) || 10000 })}
            className="h-7 text-xs"
          />
        </div>

        {/* Run Button */}
        <Button
          size="sm"
          className="w-full h-7 text-xs"
          onClick={runBacktest}
          disabled={isRunning || !data.symbol}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Running Backtest...
            </>
          ) : (
            <>
              <Play className="w-3 h-3 mr-1" />
              Run Backtest
            </>
          )}
        </Button>

        {/* Progress Bar */}
        {isRunning && (
          <Progress value={progress} className="h-1" />
        )}

        {/* Results */}
        {data.results && !isRunning && (
          <div className="space-y-1.5 p-2 bg-muted/30 rounded">
            {/* Return */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Total Return</span>
              <div className="flex items-center gap-1">
                {getReturnIcon(data.results.totalReturn)}
                <span className={`text-xs font-medium ${
                  data.results.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {formatPercent(data.results.totalReturn)}
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Win Rate</span>
                <span>{data.results.winRate?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Profit Factor</span>
                <span>{data.results.profitFactor?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max DD</span>
                <span className="text-red-400">-{data.results.maxDrawdown?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sharpe</span>
                <span>{data.results.sharpeRatio?.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center pt-1">
              <Badge variant="outline" className="text-[9px] h-4">
                {data.results.totalTrades} trades
              </Badge>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

BacktestNode.displayName = 'BacktestNode';
