import { CandlestickData, Time } from 'lightweight-charts';
import { generateMockData } from '@/lib/marketData';
import { TradeMarker } from '@/components/TradingViewChart';
import { createIndicatorContext, OHLCVBar } from './indicators';
import { executeStrategy } from './runtime';

export interface BacktestResult {
  trades: TradeMarker[];
  metrics: {
    totalReturn: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    averageWin: number;
    averageLoss: number;
    profitFactor: number;
  };
  chartData: CandlestickData[];
}

interface Position {
  type: 'long' | 'short' | null;
  entryPrice: number;
  entryTime: Time;
  size: number;
}

interface StrategyContext {
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma: (period: number) => number;
  ema: (period: number) => number;
  rsi: (period: number) => number;
  macd: () => { macd: number; signal: number; histogram: number };
  bb: (period: number, stdDev: number) => { upper: number; middle: number; lower: number };
}

export async function runBacktest(
  generatedCode: string,
  symbol: string = 'BTC/USDT',
  daysBack: number = 90,
  historicalData?: CandlestickData[]
): Promise<BacktestResult> {
  // Use provided historical data or generate mock data
  const chartData = historicalData || generateMockData(symbol, daysBack);
  const trades: TradeMarker[] = [];
  let position: Position = { type: null, entryPrice: 0, entryTime: 0 as Time, size: 0 };
  
  const initialCapital = 10000;
  let capital = initialCapital;
  let equity = initialCapital;
  let maxEquity = initialCapital;
  let maxDrawdown = 0;
  
  const returns: number[] = [];
  let totalProfit = 0;
  let totalLoss = 0;
  let winningTrades = 0;
  let losingTrades = 0;

  // Historical price data for indicators
  const priceHistory: number[] = [];
  
  // Parse and extract strategy logic
  const strategyFn = parseStrategyCode(generatedCode);
  
  // Run backtest over historical data
  for (let i = 0; i < chartData.length; i++) {
    const candle = chartData[i];
    priceHistory.push(candle.close);
    
    // Create context for strategy evaluation
    const context: StrategyContext = {
      price: candle.close,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: (candle as any).volume || 0,
      sma: (period: number) => calculateSMA(priceHistory, period),
      ema: (period: number) => calculateEMA(priceHistory, period),
      rsi: (period: number) => calculateRSI(priceHistory, period),
      macd: () => calculateMACD(priceHistory),
      bb: (period: number, stdDev: number) => calculateBB(priceHistory, period, stdDev),
    };
    
    // Evaluate strategy
    const action = strategyFn(context, position.type);
    
    // Execute trades
    if (action === 'buy' && position.type === null) {
      // Open long position
      position = {
        type: 'long',
        entryPrice: candle.close,
        entryTime: candle.time,
        size: capital * 0.95, // Use 95% of capital
      };
      
      trades.push({
        time: candle.time,
        type: 'buy',
        price: candle.close,
      });
    } else if (action === 'sell' && position.type === 'long') {
      // Close long position
      const profit = (candle.close - position.entryPrice) * (position.size / position.entryPrice);
      capital += profit;
      equity = capital;
      
      if (profit > 0) {
        totalProfit += profit;
        winningTrades++;
      } else {
        totalLoss += Math.abs(profit);
        losingTrades++;
      }
      
      const returnPct = (profit / position.size) * 100;
      returns.push(returnPct);
      
      trades.push({
        time: candle.time,
        type: 'sell',
        price: candle.close,
        profit,
      });
      
      position = { type: null, entryPrice: 0, entryTime: 0 as Time, size: 0 };
    }
    
    // Track max drawdown
    if (equity > maxEquity) {
      maxEquity = equity;
    }
    const drawdown = ((maxEquity - equity) / maxEquity) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  // Calculate metrics
  const totalReturn = ((capital - initialCapital) / initialCapital) * 100;
  const totalTrades = winningTrades + losingTrades;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const averageWin = winningTrades > 0 ? totalProfit / winningTrades : 0;
  const averageLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
  
  // Calculate Sharpe ratio (assuming 252 trading days, 0% risk-free rate)
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = calculateStdDev(returns);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
  
  return {
    trades,
    metrics: {
      totalReturn,
      winRate,
      maxDrawdown,
      sharpeRatio,
      totalTrades,
      winningTrades,
      losingTrades,
      averageWin,
      averageLoss,
      profitFactor,
    },
    chartData,
  };
}

function parseStrategyCode(code: string): (context: StrategyContext, positionType: 'long' | 'short' | null) => 'buy' | 'sell' | 'hold' {
  // Extract the logic and create a safe evaluation function
  return (context: StrategyContext, positionType: 'long' | 'short' | null) => {
    try {
      // Simple pattern matching for common block combinations
      // This is a simplified parser - in production, you'd want more robust parsing
      
      const hasPrice = /price|close/i.test(code);
      const hasSMA = /sma/i.test(code);
      const hasRSI = /rsi/i.test(code);
      const hasMACD = /macd/i.test(code);
      const hasBB = /bollinger|bb/i.test(code);
      
      // Example strategy: Buy when price crosses above SMA(20) and RSI < 70
      if (hasSMA && hasRSI) {
        const sma20 = context.sma(20);
        const rsi14 = context.rsi(14);
        
        if (positionType === null && context.close > sma20 && rsi14 < 70) {
          return 'buy';
        }
        if (positionType === 'long' && (context.close < sma20 || rsi14 > 80)) {
          return 'sell';
        }
      }
      
      // Example strategy: MACD crossover
      if (hasMACD) {
        const macd = context.macd();
        
        if (positionType === null && macd.histogram > 0) {
          return 'buy';
        }
        if (positionType === 'long' && macd.histogram < 0) {
          return 'sell';
        }
      }
      
      // Example strategy: Bollinger Band bounce
      if (hasBB) {
        const bb = context.bb(20, 2);
        
        if (positionType === null && context.close < bb.lower) {
          return 'buy';
        }
        if (positionType === 'long' && context.close > bb.upper) {
          return 'sell';
        }
      }
      
      // Default: hold
      return 'hold';
    } catch (error) {
      console.error('Strategy evaluation error:', error);
      return 'hold';
    }
  };
}

// Technical indicator calculations
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  return slice.reduce((sum, price) => sum + price, 0) / period;
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(prices.slice(0, period), period);
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  const recentChanges = changes.slice(-period);
  const gains = recentChanges.filter(c => c > 0).reduce((sum, c) => sum + c, 0) / period;
  const losses = Math.abs(recentChanges.filter(c => c < 0).reduce((sum, c) => sum + c, 0)) / period;
  
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  
  // Simple signal line approximation
  const signal = macd * 0.9;
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

function calculateBB(prices: number[], period: number = 20, stdDev: number = 2): { upper: number; middle: number; lower: number } {
  const middle = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  const variance = slice.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    upper: middle + (std * stdDev),
    middle,
    lower: middle - (std * stdDev),
  };
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Enhanced TypeScript backtest engine using `technicalindicators`.
 * Executes generated JS code via a sandboxed runtime.
 */
export async function runBacktestTS(
  generatedCode: string,
  historicalData: OHLCVBar[],
  initialCapital = 10000,
): Promise<BacktestResult> {
  const trades: TradeMarker[] = [];
  let capital = initialCapital;
  let equity = initialCapital;
  let maxEquity = initialCapital;
  let maxDrawdown = 0;

  interface TSPosition {
    type: 'long' | 'short' | null;
    entryPrice: number;
    entryTime: Time;
    size: number;
  }

  let position: TSPosition = { type: null, entryPrice: 0, entryTime: 0 as Time, size: 0 };

  const returns: number[] = [];
  let totalProfit = 0;
  let totalLoss = 0;
  let winningTrades = 0;
  let losingTrades = 0;

  // Need at least a few bars for indicators to warm up
  const warmupPeriod = 30;

  for (let i = warmupPeriod; i < historicalData.length; i++) {
    const bars = historicalData.slice(0, i + 1);
    const ctx = createIndicatorContext(bars);
    const action = executeStrategy(generatedCode, ctx);
    const candle = historicalData[i];

    // Open long
    if (action === 'buy' && position.type === null) {
      position = {
        type: 'long',
        entryPrice: candle.close,
        entryTime: i as unknown as Time,
        size: capital * 0.95,
      };
      trades.push({ time: i as unknown as Time, type: 'buy', price: candle.close });
    }
    // Close long
    else if (action === 'sell' && position.type === 'long') {
      const profit = (candle.close - position.entryPrice) * (position.size / position.entryPrice);
      capital += profit;
      equity = capital;

      if (profit > 0) {
        totalProfit += profit;
        winningTrades++;
      } else {
        totalLoss += Math.abs(profit);
        losingTrades++;
      }

      const returnPct = (profit / position.size) * 100;
      returns.push(returnPct);

      trades.push({ time: i as unknown as Time, type: 'sell', price: candle.close, profit });
      position = { type: null, entryPrice: 0, entryTime: 0 as Time, size: 0 };
    }

    // Track drawdown
    if (equity > maxEquity) maxEquity = equity;
    const drawdown = ((maxEquity - equity) / maxEquity) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Metrics
  const totalReturn = ((capital - initialCapital) / initialCapital) * 100;
  const totalTrades = winningTrades + losingTrades;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const averageWin = winningTrades > 0 ? totalProfit / winningTrades : 0;
  const averageLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = calculateStdDev(returns);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  // Convert historicalData to CandlestickData
  const chartData: CandlestickData[] = historicalData.map((bar, idx) => ({
    time: idx as unknown as Time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  }));

  return {
    trades,
    metrics: {
      totalReturn,
      winRate,
      maxDrawdown,
      sharpeRatio,
      totalTrades,
      winningTrades,
      losingTrades,
      averageWin,
      averageLoss,
      profitFactor,
    },
    chartData,
  };
}

