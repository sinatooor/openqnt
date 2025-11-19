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

    // Determine which Alpha Vantage function to use based on interval
    let avFunction = 'TIME_SERIES_DAILY';
    let timeSeriesKey = 'Time Series (Daily)';

    if (interval !== 'daily' && interval !== 'weekly' && interval !== 'monthly') {
      // Intraday data
      avFunction = 'TIME_SERIES_INTRADAY';
      timeSeriesKey = `Time Series (${interval})`;
    } else if (interval === 'weekly') {
      avFunction = 'TIME_SERIES_WEEKLY';
      timeSeriesKey = 'Weekly Time Series';
    } else if (interval === 'monthly') {
      avFunction = 'TIME_SERIES_MONTHLY';
      timeSeriesKey = 'Monthly Time Series';
    }

    // Build the API URL
    const url = new URL('https://www.alphavantage.co/query');
    url.searchParams.set('function', avFunction);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('outputsize', outputsize);
    
    if (avFunction === 'TIME_SERIES_INTRADAY') {
      url.searchParams.set('interval', interval);
    }

    console.log('Calling Alpha Vantage API:', url.toString().replace(apiKey, 'HIDDEN'));

    const response = await fetch(url.toString());
    const data = await response.json();

    // Check for API errors
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }

    if (data['Note']) {
      throw new Error('API call frequency limit reached. Please try again later.');
    }

    // Transform the data to our format
    const timeSeries = data[timeSeriesKey];
    if (!timeSeries) {
      console.error('Unexpected API response:', data);
      throw new Error('Invalid response from Alpha Vantage API');
    }

    const candlestickData = Object.entries(timeSeries).map(([timestamp, values]: [string, any]) => ({
      time: Math.floor(new Date(timestamp).getTime() / 1000),
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume'] || '0'),
    })).sort((a, b) => a.time - b.time); // Sort chronologically

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
