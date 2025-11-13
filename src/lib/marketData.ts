export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const generateMockData = (days: number = 365): CandleData[] => {
  const data: CandleData[] = [];
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  
  let price = 50000 + Math.random() * 10000;
  
  for (let i = days; i >= 0; i--) {
    const time = Math.floor((now - i * msPerDay) / 1000);
    
    // Simulate price movement with some volatility
    const change = (Math.random() - 0.5) * 1000;
    price = Math.max(1000, price + change);
    
    const volatility = price * 0.02;
    const open = price;
    const close = price + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    const volume = Math.random() * 1000000 + 500000;
    
    data.push({
      time,
      open,
      high,
      low,
      close,
      volume,
    });
    
    price = close;
  }
  
  return data;
};

export const getSymbolData = (symbol: string, days: number = 365): CandleData[] => {
  // For now, return mock data. In the future, this could fetch real data from APIs
  return generateMockData(days);
};
