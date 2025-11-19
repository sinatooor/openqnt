import { CandlestickData } from 'lightweight-charts';
import { supabase } from '@/integrations/supabase/client';

interface MarketDataCache {
  data: CandlestickData[];
  timestamp: number;
  symbol: string;
  interval: string;
}

// Cache market data for 5 minutes to avoid excessive API calls
const CACHE_DURATION = 5 * 60 * 1000;
const dataCache = new Map<string, MarketDataCache>();

export interface FetchMarketDataParams {
  symbol: string;
  interval?: string;
  outputsize?: 'compact' | 'full';
  useCache?: boolean;
}

export async function fetchMarketData({
  symbol,
  interval = 'daily',
  outputsize = 'compact',
  useCache = true,
}: FetchMarketDataParams): Promise<CandlestickData[]> {
  const cacheKey = `${symbol}-${interval}-${outputsize}`;

  // Check cache first
  if (useCache) {
    const cached = dataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Using cached data for ${symbol}`);
      return cached.data;
    }
  }

  try {
    console.log(`Fetching fresh data for ${symbol} (${interval})`);
    
    const { data, error } = await supabase.functions.invoke('fetch-market-data', {
      body: { symbol, interval, outputsize },
    });

    if (error) {
      console.error('Error calling fetch-market-data function:', error);
      throw new Error(error.message || 'Failed to fetch market data');
    }

    if (!data || !data.data) {
      throw new Error('Invalid response from market data service');
    }

    const marketData = data.data as CandlestickData[];

    // Update cache
    dataCache.set(cacheKey, {
      data: marketData,
      timestamp: Date.now(),
      symbol,
      interval,
    });

    return marketData;
  } catch (error) {
    console.error('Failed to fetch market data:', error);
    throw error;
  }
}

export function clearMarketDataCache(symbol?: string) {
  if (symbol) {
    // Clear cache for specific symbol
    const keys = Array.from(dataCache.keys()).filter(key => key.startsWith(symbol));
    keys.forEach(key => dataCache.delete(key));
  } else {
    // Clear all cache
    dataCache.clear();
  }
}

export function getCachedData(symbol: string, interval: string, outputsize: string = 'compact'): CandlestickData[] | null {
  const cacheKey = `${symbol}-${interval}-${outputsize}`;
  const cached = dataCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  return null;
}
