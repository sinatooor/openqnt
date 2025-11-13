import { CandleData } from './marketData';

export interface Trade {
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  time: number;
  pnl?: number;
}

export interface BacktestResult {
  trades: Trade[];
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  profitFactor: number;
  initialBalance: number;
  finalBalance: number;
}

export interface EnvironmentData {
  price: number;
  volume: number;
  time: number;
  spread: number;
}

export const backtestStrategy = (
  strategyCode: string,
  marketData: CandleData[],
  initialBalance: number = 10000
): BacktestResult => {
  const trades: Trade[] = [];
  let balance = initialBalance;
  let position = 0;
  let positionPrice = 0;
  let maxBalance = initialBalance;
  let maxDrawdown = 0;
  
  const wins: number[] = [];
  const losses: number[] = [];

  // Helper functions available in the strategy code
  const strategyContext = {
    buy: (amount: number) => {
      if (balance >= amount * envData.price) {
        position += amount;
        balance -= amount * envData.price;
        positionPrice = envData.price;
        trades.push({
          type: 'buy',
          price: envData.price,
          amount,
          time: envData.time,
        });
      }
    },
    sell: (amount: number) => {
      if (position >= amount) {
        const pnl = (envData.price - positionPrice) * amount;
        position -= amount;
        balance += amount * envData.price;
        trades.push({
          type: 'sell',
          price: envData.price,
          amount,
          time: envData.time,
          pnl,
        });
        
        if (pnl > 0) wins.push(pnl);
        else losses.push(Math.abs(pnl));
      }
    },
    setStopLoss: (percent: number) => {
      if (position > 0 && positionPrice > 0) {
        const stopPrice = positionPrice * (1 - percent / 100);
        if (envData.price <= stopPrice) {
          strategyContext.sell(position);
        }
      }
    },
    setTakeProfit: (percent: number) => {
      if (position > 0 && positionPrice > 0) {
        const targetPrice = positionPrice * (1 + percent / 100);
        if (envData.price >= targetPrice) {
          strategyContext.sell(position);
        }
      }
    },
    // Technical indicators (simplified implementations)
    sma: (period: number) => {
      const prices = marketData.slice(Math.max(0, currentIndex - period), currentIndex + 1).map(d => d.close);
      return prices.reduce((a, b) => a + b, 0) / prices.length;
    },
    ema: (period: number) => {
      const prices = marketData.slice(Math.max(0, currentIndex - period), currentIndex + 1).map(d => d.close);
      const k = 2 / (period + 1);
      let ema = prices[0];
      for (let i = 1; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
      }
      return ema;
    },
    rsi: (period: number = 14) => {
      const prices = marketData.slice(Math.max(0, currentIndex - period - 1), currentIndex + 1).map(d => d.close);
      if (prices.length < 2) return 50;
      
      let gains = 0;
      let losses = 0;
      for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }
      
      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgGain / (avgLoss || 1);
      return 100 - (100 / (1 + rs));
    },
    macd: () => {
      const ema12 = strategyContext.ema(12);
      const ema26 = strategyContext.ema(26);
      return ema12 - ema26;
    },
    bb: (period: number = 20) => {
      const sma = strategyContext.sma(period);
      const prices = marketData.slice(Math.max(0, currentIndex - period), currentIndex + 1).map(d => d.close);
      const variance = prices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / prices.length;
      const stdDev = Math.sqrt(variance);
      return {
        upper: sma + stdDev * 2,
        middle: sma,
        lower: sma - stdDev * 2,
      };
    },
  };

  let envData: EnvironmentData = {
    price: 0,
    volume: 0,
    time: 0,
    spread: 0,
  };
  
  let currentIndex = 0;

  // Execute strategy for each candle
  for (let i = 20; i < marketData.length; i++) {
    currentIndex = i;
    const candle = marketData[i];
    
    envData = {
      price: candle.close,
      volume: candle.volume,
      time: candle.time,
      spread: (candle.high - candle.low) / candle.close * 100,
    };

    try {
      // Create a safe execution context
      const safeCode = strategyCode
        .replace(/environment_price/g, 'envData.price')
        .replace(/environment_volume/g, 'envData.volume')
        .replace(/environment_time/g, 'envData.time')
        .replace(/environment_spread/g, 'envData.spread')
        .replace(/buy\(/g, 'strategyContext.buy(')
        .replace(/sell\(/g, 'strategyContext.sell(')
        .replace(/setStopLoss\(/g, 'strategyContext.setStopLoss(')
        .replace(/setTakeProfit\(/g, 'strategyContext.setTakeProfit(')
        .replace(/sma\(/g, 'strategyContext.sma(')
        .replace(/ema\(/g, 'strategyContext.ema(')
        .replace(/rsi\(/g, 'strategyContext.rsi(')
        .replace(/macd\(/g, 'strategyContext.macd(')
        .replace(/bb\(/g, 'strategyContext.bb(');

      // Execute the strategy code
      const executeStrategy = new Function('envData', 'strategyContext', safeCode);
      executeStrategy(envData, strategyContext);
    } catch (error) {
      console.error('Strategy execution error:', error);
    }

    // Update max balance and drawdown
    const currentValue = balance + position * envData.price;
    if (currentValue > maxBalance) {
      maxBalance = currentValue;
    }
    const drawdown = (maxBalance - currentValue) / maxBalance * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Close any remaining position
  if (position > 0) {
    const lastPrice = marketData[marketData.length - 1].close;
    const pnl = (lastPrice - positionPrice) * position;
    balance += position * lastPrice;
    trades.push({
      type: 'sell',
      price: lastPrice,
      amount: position,
      time: marketData[marketData.length - 1].time,
      pnl,
    });
    if (pnl > 0) wins.push(pnl);
    else losses.push(Math.abs(pnl));
    position = 0;
  }

  const finalBalance = balance;
  const totalReturn = ((finalBalance - initialBalance) / initialBalance) * 100;
  const winningTrades = wins.length;
  const losingTrades = losses.length;
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  const totalWins = wins.reduce((a, b) => a + b, 0);
  const totalLosses = losses.reduce((a, b) => a + b, 0);
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  // Calculate Sharpe Ratio (simplified)
  const returns = trades.filter(t => t.pnl !== undefined).map(t => t.pnl! / initialBalance);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length || 1));
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  return {
    trades,
    totalReturn,
    winRate,
    maxDrawdown,
    sharpeRatio,
    totalTrades,
    winningTrades,
    losingTrades,
    profitFactor,
    initialBalance,
    finalBalance,
  };
};
