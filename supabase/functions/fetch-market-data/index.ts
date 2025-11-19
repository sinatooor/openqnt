import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketDataRequest {
  symbol: string;
  interval?: string; // 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly
  outputsize?: 'compact' | 'full'; // compact = last 100 data points, full = up to 20 years
}

// Detect if symbol is a stock or crypto
function getSymbolType(symbol: string): { type: 'stock' | 'crypto', cleanSymbol: string, market?: string } {
  // Check if it's a crypto pair (contains /)
  if (symbol.includes('/')) {
    const [base, quote] = symbol.split('/');
    return { type: 'crypto', cleanSymbol: base, market: quote };
  }
  // Otherwise treat as stock ticker
  return { type: 'stock', cleanSymbol: symbol };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
    if (!apiKey) {
      throw new Error('Alpha Vantage API key not configured');
    }

    const { symbol, interval = 'daily', outputsize = 'compact' } = await req.json() as MarketDataRequest;

    console.log(`Fetching market data for ${symbol}, interval: ${interval}, outputsize: ${outputsize}`);

    const symbolInfo = getSymbolType(symbol);
    let avFunction = '';
    let timeSeriesKey = '';
    const url = new URL('https://www.alphavantage.co/query');
    url.searchParams.set('apikey', apiKey);

    if (symbolInfo.type === 'stock') {
      // Stock symbols - use TIME_SERIES functions
      if (interval !== 'daily' && interval !== 'weekly' && interval !== 'monthly') {
        // Intraday data for stocks
        avFunction = 'TIME_SERIES_INTRADAY';
        timeSeriesKey = `Time Series (${interval})`;
        url.searchParams.set('function', avFunction);
        url.searchParams.set('symbol', symbolInfo.cleanSymbol);
        url.searchParams.set('interval', interval);
        url.searchParams.set('outputsize', outputsize);
      } else if (interval === 'weekly') {
        avFunction = 'TIME_SERIES_WEEKLY';
        timeSeriesKey = 'Weekly Time Series';
        url.searchParams.set('function', avFunction);
        url.searchParams.set('symbol', symbolInfo.cleanSymbol);
      } else if (interval === 'monthly') {
        avFunction = 'TIME_SERIES_MONTHLY';
        timeSeriesKey = 'Monthly Time Series';
        url.searchParams.set('function', avFunction);
        url.searchParams.set('symbol', symbolInfo.cleanSymbol);
      } else {
        // Daily
        avFunction = 'TIME_SERIES_DAILY';
        timeSeriesKey = 'Time Series (Daily)';
        url.searchParams.set('function', avFunction);
        url.searchParams.set('symbol', symbolInfo.cleanSymbol);
        url.searchParams.set('outputsize', outputsize);
      }
    } else {
      // Crypto symbols - use DIGITAL_CURRENCY functions
      if (interval !== 'daily' && interval !== 'weekly' && interval !== 'monthly') {
        // Alpha Vantage doesn't support intraday crypto, fallback to daily
        avFunction = 'DIGITAL_CURRENCY_DAILY';
        timeSeriesKey = 'Time Series (Digital Currency Daily)';
        console.log(`Note: Intraday not available for crypto, using daily data`);
      } else if (interval === 'weekly') {
        avFunction = 'DIGITAL_CURRENCY_WEEKLY';
        timeSeriesKey = 'Time Series (Digital Currency Weekly)';
      } else if (interval === 'monthly') {
        avFunction = 'DIGITAL_CURRENCY_MONTHLY';
        timeSeriesKey = 'Time Series (Digital Currency Monthly)';
      } else {
        avFunction = 'DIGITAL_CURRENCY_DAILY';
        timeSeriesKey = 'Time Series (Digital Currency Daily)';
      }
      
      url.searchParams.set('function', avFunction);
      url.searchParams.set('symbol', symbolInfo.cleanSymbol);
      url.searchParams.set('market', symbolInfo.market || 'USD');
    }

    console.log('Calling Alpha Vantage API:', url.toString().replace(apiKey, 'HIDDEN'));

    const response = await fetch(url.toString());
    const data = await response.json();

    // Check for API errors
    if (data['Error Message']) {
      console.error('Alpha Vantage API error:', data['Error Message']);
      throw new Error(data['Error Message']);
    }

    if (data['Information']) {
      console.error('Alpha Vantage rate limit:', data['Information']);
      throw new Error('API rate limit reached. Please upgrade your Alpha Vantage plan or try again later.');
    }

    if (data['Note']) {
      console.warn('Alpha Vantage note:', data['Note']);
      throw new Error('API call frequency limit reached. Please try again in a minute.');
    }

    // Transform the data to our format
    const timeSeries = data[timeSeriesKey];
    if (!timeSeries) {
      console.error('Unexpected API response:', data);
      throw new Error(`No time series data found. Expected key: "${timeSeriesKey}"`);
    }

    const candlestickData = Object.entries(timeSeries).map(([timestamp, values]: [string, any]) => {
      // Handle both stock and crypto data formats
      const open = parseFloat(values['1. open'] || values['1a. open (USD)']);
      const high = parseFloat(values['2. high'] || values['2a. high (USD)']);
      const low = parseFloat(values['3. low'] || values['3a. low (USD)']);
      const close = parseFloat(values['4. close'] || values['4a. close (USD)']);
      const volume = parseInt(values['5. volume'] || '0');

      return {
        time: Math.floor(new Date(timestamp).getTime() / 1000),
        open,
        high,
        low,
        close,
        volume,
      };
    }).sort((a, b) => a.time - b.time); // Sort chronologically

    console.log(`Successfully fetched ${candlestickData.length} data points for ${symbol}`);

    return new Response(
      JSON.stringify({ 
        data: candlestickData,
        symbol,
        interval,
        lastUpdate: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in fetch-market-data function:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Failed to fetch market data from Alpha Vantage'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
