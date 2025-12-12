import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  CandlestickData,
  Time,
  ColorType,
  LineStyle,
  CandlestickSeries,
  LineSeries,
} from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TradeMarker {
  time: Time;
  type: 'buy' | 'sell';
  price: number;
  profit?: number;
}

export interface Indicator {
  type: 'sma' | 'ema' | 'bb-upper' | 'bb-lower' | 'bb-middle';
  period: number;
  data: Array<{ time: Time; value: number }>;
  color: string;
}

export interface ChartProps {
  data: CandlestickData[];
  trades?: TradeMarker[];
  indicators?: Indicator[];
  symbol?: string;
  interval?: string;
  onIntervalChange?: (interval: string) => void;
}

const INTERVALS = ['1H', '4H', '1D', '1W'];

export const TradingViewChart = ({
  data,
  trades = [],
  indicators = [],
  symbol = 'BTC/USDT',
  interval = '1D',
  onIntervalChange,
}: ChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const indicatorSeriesRefs = useRef<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: 'hsl(142 71% 45%)',
      downColor: 'hsl(0 84% 60%)',
      borderVisible: false,
      wickUpColor: 'hsl(142 71% 45%)',
      wickDownColor: 'hsl(0 84% 60%)',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    setMounted(true);
    setIsLoading(false);

    // Handle resize with ResizeObserver for modal resize detection
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === chartContainerRef.current && chart) {
          const width = entry.contentRect.width;
          const height = entry.contentRect.height;
          if (width > 0 && height > 0) {
            chart.applyOptions({
              width: width,
              height: height,
            });
          }
        }
      }
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    // Also listen for window resize as fallback
    const handleWindowResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
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

  // Add indicator overlays
  useEffect(() => {
    if (!chartRef.current || !mounted || indicators.length === 0) return;

    // Clear existing indicator series
    indicatorSeriesRefs.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch (e) {
        // Series might already be removed
      }
    });
    indicatorSeriesRefs.current = [];

    // Add new indicator series
    indicators.forEach((indicator) => {
      const lineSeries = chartRef.current!.addSeries(LineSeries, {
        color: indicator.color,
        lineWidth: 2,
        lineStyle: indicator.type.includes('bb') ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      lineSeries.setData(indicator.data);
      indicatorSeriesRefs.current.push(lineSeries);
    });

    return () => {
      indicatorSeriesRefs.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series);
        } catch (e) {
          // Series might already be removed
        }
      });
      indicatorSeriesRefs.current = [];
    };
  }, [indicators, mounted]);

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
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">{symbol}</h3>
          <Badge variant="secondary" className="animate-scale-in">{interval}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {totalTrades > 0 && (
            <>
              <Badge variant="outline" className="gap-1 animate-scale-in hover-scale">
                <TrendingUp className="h-3 w-3 text-block-environment" />
                {buyTrades}
              </Badge>
              <Badge variant="outline" className="gap-1 animate-scale-in hover-scale">
                <TrendingDown className="h-3 w-3 text-destructive" />
                {sellTrades}
              </Badge>
            </>
          )}
          {indicators.length > 0 && (
            <Badge variant="outline" className="gap-1 animate-scale-in">
              <Activity className="h-3 w-3" />
              {indicators.length} indicators
            </Badge>
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
            className="transition-all duration-200 hover-scale"
          >
            {int}
          </Button>
        ))}
      </div>

      {/* Chart Container */}
      <div
        ref={chartContainerRef}
        className={cn(
          "w-full rounded-lg border border-border bg-card overflow-hidden relative transition-all duration-300",
          isLoading && "animate-pulse"
        )}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/50 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Loading chart...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
