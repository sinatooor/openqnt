import { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import { CandleData } from '@/lib/marketData';
import { Trade } from '@/lib/backtestEngine';

interface TradingViewChartProps {
  data: CandleData[];
  trades: Trade[];
}

export const TradingViewChart = ({ data, trades }: TradingViewChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'hsl(220, 13%, 10%)' },
        textColor: 'hsl(210, 40%, 98%)',
      },
      grid: {
        vertLines: { color: 'hsl(220, 13%, 15%)' },
        horzLines: { color: 'hsl(220, 13%, 15%)' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'hsl(220, 13%, 20%)',
      },
      timeScale: {
        borderColor: 'hsl(220, 13%, 20%)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    // Add candlestick series using new API
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Set data - time needs to be in specific format
    const chartData = data.map(d => ({
      time: d.time as any,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candleSeries.setData(chartData);

    // Add trade markers
    const markers = trades.map(trade => {
      const position = trade.type === 'buy' ? 'belowBar' : 'aboveBar';
      const shape = trade.type === 'buy' ? 'arrowUp' : 'arrowDown';
      return {
        time: trade.time as any,
        position: position as 'belowBar' | 'aboveBar',
        color: trade.type === 'buy' ? '#10b981' : '#ef4444',
        shape: shape as 'arrowUp' | 'arrowDown',
        text: trade.type === 'buy' ? 'B' : 'S',
      };
    });

    (candleSeries as any).setMarkers(markers);

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, trades]);

  return (
    <div ref={chartContainerRef} className="w-full" />
  );
};
