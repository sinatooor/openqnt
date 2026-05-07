import { CandlestickData } from 'lightweight-charts';

import { apiBase } from '@/lib/runtimeConfig';
const BACKEND_URL = apiBase();

interface MarketDataCache {
  data: CandlestickData[];
  timestamp: number;
  symbol: string;
  interval: string;
}

// Cache market data for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;
const dataCache = new Map<string, MarketDataCache>();

export interface FetchMarketDataParams {
  symbol: string;
  interval?: string;
  outputsize?: 'compact' | 'full';
  useCache?: boolean;
}

export interface SymbolInfo {
  symbol: string;
  name: string;
  asset_type: string;
  is_active: boolean;
  record_count: number;
  first_date: string | null;
  last_date: string | null;
}

export interface SymbolsResponse {
  success: boolean;
  total: number;
  symbols: SymbolInfo[];
  grouped: {
    stocks: SymbolInfo[];
    forex: SymbolInfo[];
    indices: SymbolInfo[];
    commodities: SymbolInfo[];
    crypto: SymbolInfo[];
    futures: SymbolInfo[];
    etf: SymbolInfo[];
  };
  error?: string;
}

/**
 * Fetch available symbols from local database
 */
export async function fetchAvailableSymbols(): Promise<SymbolsResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/symbols`);

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch symbols:', error);
    return {
      success: false,
      total: 0,
      symbols: [],
      grouped: {
        stocks: [],
        forex: [],
        indices: [],
        commodities: [],
        crypto: [],
        futures: [],
        etf: [],
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch market data from backend (uses local database first)
 */
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
    console.log(`Fetching data for ${symbol} from backend...`);

    // Map intervals
    const backendInterval = interval === 'daily' ? '1d' : interval === 'weekly' ? '1w' : '1d';

    const response = await fetch(
      `${BACKEND_URL}/market-data?symbol=${encodeURIComponent(symbol)}&interval=${backendInterval}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch market data');
    }

    // Convert to CandlestickData format
    const marketData: CandlestickData[] = result.data.map((bar: any) => ({
      time: bar.date || bar.time,
      open: parseFloat(bar.open),
      high: parseFloat(bar.high),
      low: parseFloat(bar.low),
      close: parseFloat(bar.close),
    }));

    // Update cache
    dataCache.set(cacheKey, {
      data: marketData,
      timestamp: Date.now(),
      symbol,
      interval,
    });

    console.log(`Fetched ${marketData.length} candles for ${symbol} from ${result.source}`);
    return marketData;
  } catch (error) {
    console.error('Failed to fetch market data:', error);
    throw error;
  }
}

export function clearMarketDataCache(symbol?: string) {
  if (symbol) {
    const keys = Array.from(dataCache.keys()).filter(key => key.startsWith(symbol));
    keys.forEach(key => dataCache.delete(key));
  } else {
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
