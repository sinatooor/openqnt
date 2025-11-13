import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  CandlestickData,
  Time,
  ColorType,
  LineStyle,
} from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface TradeMarker {
  time: Time;
  type: 'buy' | 'sell';
  price: number;
  profit?: number;
}

export interface ChartProps {
  data: CandlestickData[];
  trades?: TradeMarker[];
  symbol?: string;
  interval?: string;
  onIntervalChange?: (interval: string) => void;
}

const INTERVALS = ['1H', '4H', '1D', '1W'];

export const TradingViewChart = ({
  data,
  trades = [],
  symbol = 'BTC/USDT',
  interval = '1D',
  onIntervalChange,
}: ChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || mounted) return;

    // Get CSS variables for colors
    const styles = getComputedStyle(document.documentElement);
    const backgroundColor = styles.getPropertyValue('--background').trim();
    const textColor = styles.getPropertyValue('--foreground').trim();
    const gridColor = styles.getPropertyValue('--grid-color').trim();

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: `hsl(${backgroundColor})` },
        textColor: `hsl(${textColor})`,
      },
      grid: {
        vertLines: { color: `hsl(${gridColor})` },
        horzLines: { color: `hsl(${gridColor})` },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        borderColor: `hsl(${gridColor})`,
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: `hsl(${gridColor})`,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: `hsl(${textColor})`,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: `hsl(${backgroundColor})`,
        },
        horzLine: {
          color: `hsl(${textColor})`,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: `hsl(${backgroundColor})`,
        },
      },
    });

    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: 'hsl(142 71% 45%)',
      downColor: 'hsl(0 84% 60%)',
      borderVisible: false,
      wickUpColor: 'hsl(142 71% 45%)',
      wickDownColor: 'hsl(0 84% 60%)',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    setMounted(true);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      setMounted(false);
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (!candlestickSeriesRef.current || !mounted || data.length === 0) return;

    candlestickSeriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [data, mounted]);

  // Add trade markers
  useEffect(() => {
    if (!candlestickSeriesRef.current || !mounted || trades.length === 0) return;

    const markers = trades.map((trade) => ({
      time: trade.time,
      position: trade.type === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
      color: trade.type === 'buy' ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)',
      shape: trade.type === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
      text: trade.type === 'buy' ? 'BUY' : 'SELL',
    }));

    candlestickSeriesRef.current.setMarkers(markers);
  }, [trades, mounted]);

  const totalTrades = trades.length;
  const buyTrades = trades.filter((t) => t.type === 'buy').length;
  const sellTrades = trades.filter((t) => t.type === 'sell').length;

  return (
    <div className="flex flex-col gap-4">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">{symbol}</h3>
          <Badge variant="secondary">{interval}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {totalTrades > 0 && (
            <>
              <Badge variant="outline" className="gap-1">
                <TrendingUp className="h-3 w-3 text-block-environment" />
                {buyTrades}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <TrendingDown className="h-3 w-3 text-destructive" />
                {sellTrades}
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Time Interval Selector */}
      <div className="flex gap-2">
        {INTERVALS.map((int) => (
          <Button
            key={int}
            variant={interval === int ? 'default' : 'outline'}
            size="sm"
            onClick={() => onIntervalChange?.(int)}
          >
            {int}
          </Button>
        ))}
      </div>

      {/* Chart Container */}
      <div
        ref={chartContainerRef}
        className="w-full rounded-lg border border-border bg-card overflow-hidden"
      />
    </div>
  );
};
