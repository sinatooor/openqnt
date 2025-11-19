import { useState, useEffect } from 'react';
import { CandlestickData } from 'lightweight-charts';
import { fetchMarketData } from '@/lib/marketDataService';
import { generateMockData } from '@/lib/marketData';
import { toast } from 'sonner';

interface UseMarketDataOptions {
  symbol: string;
  interval?: string;
  useMockData?: boolean;
  autoFetch?: boolean;
}

export function useMarketData({
  symbol,
  interval = '1D',
  useMockData = false,
  autoFetch = true,
}: UseMarketDataOptions) {
  const [data, setData] = useState<CandlestickData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (useMockData) {
      // Use mock data
      const mockData = generateMockData(symbol, 90, { trend: 'up' });
      setData(mockData);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Map display intervals to Alpha Vantage intervals
      const intervalMap: Record<string, string> = {
        '1H': '60min',
        '4H': '60min', // We'll fetch hourly and aggregate
        '1D': 'daily',
        '1W': 'weekly',
        '1M': 'monthly',
      };

      const avInterval = intervalMap[interval] || 'daily';
      const outputsize = interval === '1D' || interval === '1W' || interval === '1M' ? 'full' : 'compact';

      const marketData = await fetchMarketData({
        symbol,
        interval: avInterval,
        outputsize,
      });

      setData(marketData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch market data';
      setError(errorMessage);
      console.error('Error fetching market data:', err);
      
      toast.error('Failed to fetch real market data', {
        description: 'Using mock data instead. Check your API key and symbol.',
      });

      // Fallback to mock data
      const mockData = generateMockData(symbol, 90, { trend: 'up' });
      setData(mockData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [symbol, interval, useMockData, autoFetch]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
