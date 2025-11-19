import { CandlestickData, Time } from 'lightweight-charts';

export interface MarketDataConfig {
  symbol: string;
  daysBack: number;
  basePrice?: number;
  volatility?: number;
  trend?: 'up' | 'down' | 'sideways';
}

export function generateMockData(
  symbol: string = 'BTC/USDT',
  daysBack: number = 90,
  config?: Partial<MarketDataConfig>
): CandlestickData[] {
  const data: CandlestickData[] = [];
  const now = new Date();
  
  // Base price based on symbol
  let basePrice = config?.basePrice || getBasePrice(symbol);
  const volatility = config?.volatility || 0.02; // 2% daily volatility
  const trend = config?.trend || 'sideways';
  
  // Generate data points for each day
  for (let i = daysBack; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const time = Math.floor(date.getTime() / 1000) as Time;
    
    // Add trend bias
    let trendBias = 0;
    if (trend === 'up') {
      trendBias = 0.001; // 0.1% daily upward bias
    } else if (trend === 'down') {
      trendBias = -0.001; // 0.1% daily downward bias
    }
    
    // Calculate price movement
    const randomChange = (Math.random() - 0.5) * volatility;
    const priceChange = basePrice * (randomChange + trendBias);
    
    // Generate OHLC values
    const open = basePrice;
    const close = basePrice + priceChange;
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    
    data.push({
      time,
      open,
      high,
      low,
      close,
    });
    
    basePrice = close; // Next candle starts where this one closed
  }
  
  return data;
}

function getBasePrice(symbol: string): number {
  const prices: Record<string, number> = {
    'AAPL': 180,
    'MSFT': 380,
    'GOOGL': 140,
    'TSLA': 250,
    'SPY': 450,
    'BTC/USD': 45000,
    'ETH/USD': 2500,
    'BTC/USDT': 45000,
    'ETH/USDT': 2500,
    'BNB/USDT': 350,
    'SOL/USDT': 100,
    'XRP/USDT': 0.6,
    'ADA/USDT': 0.5,
    'DOGE/USDT': 0.08,
  };
  
  return prices[symbol] || 100;
}

export function generateRealtimeCandle(lastCandle: CandlestickData, volatility: number = 0.01): CandlestickData {
  const randomChange = (Math.random() - 0.5) * volatility;
  const priceChange = lastCandle.close * randomChange;
  
  const open = lastCandle.close;
  const close = open + priceChange;
  const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.3);
  const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.3);
  
  // Next timestamp (1 day later)
  const time = (lastCandle.time as number + 86400) as Time;
  
  return {
    time,
    open,
    high,
    low,
    close,
  };
}
