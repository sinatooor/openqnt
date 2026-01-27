/**
 * ChartModal - Floating chart preview
 * Equivalent to Blockly's FloatingChartModal
 */

import { memo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendingUp, X, Maximize2, Minimize2 } from 'lucide-react';

interface ChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol?: string;
  interval?: string;
}

const SYMBOLS = [
  { value: 'BTCUSDT', label: 'BTC/USDT' },
  { value: 'ETHUSDT', label: 'ETH/USDT' },
  { value: 'EURUSD', label: 'EUR/USD' },
  { value: 'GBPUSD', label: 'GBP/USD' },
  { value: 'USDJPY', label: 'USD/JPY' },
  { value: 'SPX', label: 'S&P 500' },
  { value: 'AAPL', label: 'Apple' },
  { value: 'GOOGL', label: 'Google' },
];

const INTERVALS = [
  { value: '1', label: '1m' },
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '60', label: '1H' },
  { value: '240', label: '4H' },
  { value: 'D', label: '1D' },
  { value: 'W', label: '1W' },
];

export const ChartModal = memo(({
  open,
  onOpenChange,
  symbol: initialSymbol = 'BTCUSDT',
  interval: initialInterval = 'D',
}: ChartModalProps) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [interval, setInterval] = useState(initialInterval);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // TradingView widget URL
  const chartUrl = `https://www.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${symbol}&interval=${interval}&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=1a1a1a&studies=[]&theme=dark&style=1&timezone=Etc/UTC&withdateranges=1&hide_top_toolbar=0&hide_legend=0&allow_symbol_change=0`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`bg-card/80 backdrop-blur-xl border-border/50 text-foreground p-0 ${isFullscreen ? 'max-w-[95vw] h-[90vh]' : 'max-w-4xl h-[600px]'
          }`}
      >
        <DialogHeader className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Price Chart
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="w-32 bg-secondary border-border h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-secondary border-border">
                  {SYMBOLS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={interval} onValueChange={setInterval}>
                <SelectTrigger className="w-20 bg-secondary border-border h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-secondary border-border">
                  {INTERVALS.map(i => (
                    <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Chart iframe */}
        <div className="flex-1 p-0 h-full">
          <iframe
            src={chartUrl}
            className="w-full h-full border-0"
            title="TradingView Chart"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
});

ChartModal.displayName = 'ChartModal';
