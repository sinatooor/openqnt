/**
 * ChartModal - Floating chart preview
 * Equivalent to Blockly's FloatingChartModal
 */

import { memo, useState } from 'react';
import { WindowModal } from './WindowModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendingUp } from 'lucide-react';

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

  // TradingView widget URL
  const chartUrl = `https://www.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${symbol}&interval=${interval}&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=1a1a1a&studies=[]&theme=dark&style=1&timezone=Etc/UTC&withdateranges=1&hide_top_toolbar=0&hide_legend=0&allow_symbol_change=0`;

  return (
    <WindowModal
      open={open}
      onOpenChange={onOpenChange}
      title="Price Chart"
      icon={<TrendingUp className="w-5 h-5 text-green-400" />}
      defaultWidth={900}
      defaultHeight={600}
      minWidth={500}
      minHeight={400}
    >
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
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
      </div>

      {/* Chart iframe */}
      <div className="flex-1 h-full">
        <iframe
          src={chartUrl}
          className="w-full h-full border-0"
          title="TradingView Chart"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
    </WindowModal>
  );
});

ChartModal.displayName = 'ChartModal';
