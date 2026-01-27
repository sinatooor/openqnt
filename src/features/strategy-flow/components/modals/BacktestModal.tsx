/**
 * BacktestModal - Modal for configuring and running backtests
 */

import { memo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, DollarSign, TrendingUp, Settings2, Play, Loader2 } from 'lucide-react';

interface BacktestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRunBacktest?: (config: BacktestConfig) => void;
  isRunning?: boolean;
}

export interface BacktestConfig {
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  positionSize: number;
  positionSizeType: 'fixed' | 'percentage' | 'risk';
  commission: number;
  slippage: number;
  leverage: number;
}

const SYMBOLS = [
  { value: 'BTCUSDT', label: 'BTC/USDT' },
  { value: 'ETHUSDT', label: 'ETH/USDT' },
  { value: 'EURUSD', label: 'EUR/USD' },
  { value: 'GBPUSD', label: 'GBP/USD' },
  { value: 'USDJPY', label: 'USD/JPY' },
  { value: 'SPX', label: 'S&P 500' },
  { value: 'AAPL', label: 'Apple Inc.' },
  { value: 'GOOGL', label: 'Alphabet Inc.' },
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

export const BacktestModal = memo(({ 
  open, 
  onOpenChange, 
  onRunBacktest,
  isRunning = false,
}: BacktestModalProps) => {
  const [config, setConfig] = useState<BacktestConfig>({
    symbol: 'BTCUSDT',
    timeframe: '1h',
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 10000,
    positionSize: 10,
    positionSizeType: 'percentage',
    commission: 0.1,
    slippage: 0.05,
    leverage: 1,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRunBacktest?.(config);
  };

  const updateConfig = (key: keyof BacktestConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-[#1e1e1e] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Backtest Configuration
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Configure your backtest parameters and run a simulation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Symbol & Timeframe */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white/70">Symbol</Label>
              <Select 
                value={config.symbol} 
                onValueChange={(v) => updateConfig('symbol', v)}
              >
                <SelectTrigger className="bg-[#2a2a2a] border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2a2a2a] border-white/10">
                  {SYMBOLS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Timeframe</Label>
              <Select 
                value={config.timeframe} 
                onValueChange={(v) => updateConfig('timeframe', v)}
              >
                <SelectTrigger className="bg-[#2a2a2a] border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2a2a2a] border-white/10">
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
                className="bg-[#2a2a2a] border-white/10"
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
                className="bg-[#2a2a2a] border-white/10"
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
                className="bg-[#2a2a2a] border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Position Size (%)</Label>
              <Input
                type="number"
                value={config.positionSize}
                onChange={(e) => updateConfig('positionSize', parseFloat(e.target.value))}
                className="bg-[#2a2a2a] border-white/10"
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
                className="bg-[#2a2a2a] border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70 text-xs">Slippage (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={config.slippage}
                onChange={(e) => updateConfig('slippage', parseFloat(e.target.value))}
                className="bg-[#2a2a2a] border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70 text-xs">Leverage</Label>
              <Input
                type="number"
                value={config.leverage}
                onChange={(e) => updateConfig('leverage', parseInt(e.target.value))}
                className="bg-[#2a2a2a] border-white/10"
                min={1}
                max={100}
              />
            </div>
          </div>
        </form>

        <DialogFooter className="mt-6">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-white/10 text-white/70 hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isRunning}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Backtest
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

BacktestModal.displayName = 'BacktestModal';
