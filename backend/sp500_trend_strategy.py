"""
SP500 Trend-Following Strategy

This strategy is converted from the Blockly XML and implements:

Long Entry Conditions:
1. EMA(20) > SMA(50) - Bullish trend
2. RSI(14) > 50 - Momentum confirmation
3. MACD Line > MACD Signal - MACD bullish crossover
4. Price > VWAP - Price above volume-weighted average

Short Entry Conditions:
1. EMA(20) < SMA(50) - Bearish trend
2. RSI(14) < 50 - Momentum confirmation
3. MACD Line < MACD Signal - MACD bearish crossover
4. Price < VWAP - Price below volume-weighted average

Trade Management:
- Stop Loss: Entry ± ATR(14) * 2
- Take Profit: Entry ± ATR(14) * 6 (2x ATR * 3 = 6x ATR)

Usage:
    python sp500_trend_strategy.py
"""

import numpy as np
import pandas as pd
import yfinance as yf
from backtesting import Backtest, Strategy
from backtesting.lib import crossover
from backtesting.test import SMA


# ============================================================
# Custom Indicator Functions
# ============================================================

def EMA(values, n):
    """Exponential Moving Average"""
    values = np.asarray(values)
    alpha = 2 / (n + 1)
    ema = np.zeros_like(values, dtype=float)
    ema[0] = values[0]
    for i in range(1, len(values)):
        ema[i] = alpha * values[i] + (1 - alpha) * ema[i-1]
    return ema


def RSI(arr, period=14):
    """Relative Strength Index"""
    arr = np.asarray(arr, dtype=float)
    deltas = np.diff(arr)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    
    avg_gain = np.zeros(len(arr))
    avg_loss = np.zeros(len(arr))
    
    if period < len(arr):
        avg_gain[period] = np.mean(gains[:period])
        avg_loss[period] = np.mean(losses[:period])
    
    for i in range(period + 1, len(arr)):
        avg_gain[i] = (avg_gain[i-1] * (period - 1) + gains[i-1]) / period
        avg_loss[i] = (avg_loss[i-1] * (period - 1) + losses[i-1]) / period
    
    rs = avg_gain / (avg_loss + 1e-10)
    rsi = 100 - (100 / (1 + rs))
    rsi[:period] = 50  # Fill initial values with neutral
    return rsi


def MACD_line(values, fast=12, slow=26):
    """MACD line = Fast EMA - Slow EMA"""
    return EMA(values, fast) - EMA(values, slow)


def MACD_signal(values, fast=12, slow=26, signal=9):
    """MACD signal line = EMA of MACD line"""
    macd = MACD_line(values, fast, slow)
    return EMA(macd, signal)


def ATR(high, low, close, period=14):
    """Average True Range"""
    high = np.asarray(high, dtype=float)
    low = np.asarray(low, dtype=float)
    close = np.asarray(close, dtype=float)
    
    # True Range calculation
    tr = np.zeros_like(close)
    tr[0] = high[0] - low[0]
    
    for i in range(1, len(close)):
        hl = high[i] - low[i]
        hc = abs(high[i] - close[i-1])
        lc = abs(low[i] - close[i-1])
        tr[i] = max(hl, hc, lc)
    
    # ATR is EMA of True Range
    atr = np.zeros_like(tr)
    atr[:period] = np.mean(tr[:period])
    
    alpha = 2 / (period + 1)
    for i in range(period, len(tr)):
        atr[i] = alpha * tr[i] + (1 - alpha) * atr[i-1]
    
    return atr


def VWAP(high, low, close, volume):
    """Volume-Weighted Average Price (cumulative)"""
    typical_price = (high + low + close) / 3
    vwap = np.cumsum(typical_price * volume) / np.cumsum(volume)
    return vwap


# ============================================================
# SP500 Trend-Following Strategy
# ============================================================

class SP500TrendStrategy(Strategy):
    """
    Multi-indicator trend-following strategy for S&P 500.
    
    Uses EMA/SMA crossover, RSI momentum, MACD confirmation, and VWAP filter.
    Dynamic ATR-based stop loss and take profit.
    """
    
    # Strategy Parameters
    ema_period = 20
    sma_period = 50
    rsi_period = 14
    macd_fast = 12
    macd_slow = 26
    macd_signal = 9
    atr_period = 14
    atr_sl_mult = 2.0
    atr_tp_mult = 6.0  # 2 * 3 = 6
    trade_size = 0.1  # 10% of equity per trade
    
    def init(self):
        """Initialize indicators using self.I() wrapper"""
        # Trend indicators
        self.ema = self.I(EMA, self.data.Close, self.ema_period)
        self.sma = self.I(SMA, self.data.Close, self.sma_period)
        
        # Momentum
        self.rsi = self.I(RSI, self.data.Close, self.rsi_period)
        
        # MACD
        self.macd_line = self.I(MACD_line, self.data.Close, self.macd_fast, self.macd_slow)
        self.macd_sig = self.I(MACD_signal, self.data.Close, self.macd_fast, self.macd_slow, self.macd_signal)
        
        # Volatility
        self.atr = self.I(ATR, self.data.High, self.data.Low, self.data.Close, self.atr_period)
        
        # VWAP
        self.vwap = self.I(VWAP, self.data.High, self.data.Low, self.data.Close, self.data.Volume)
    
    def next(self):
        """Execute on each new candle"""
        price = self.data.Close[-1]
        atr = self.atr[-1]
        
        # Skip if indicators not ready
        if len(self.data.Close) < self.sma_period:
            return
        
        # Current indicator values
        ema_val = self.ema[-1]
        sma_val = self.sma[-1]
        rsi_val = self.rsi[-1]
        macd_line_val = self.macd_line[-1]
        macd_sig_val = self.macd_sig[-1]
        vwap_val = self.vwap[-1]
        
        # Long Entry Conditions
        long_trend = ema_val > sma_val
        long_momentum = rsi_val > 50
        long_macd = macd_line_val > macd_sig_val
        long_vwap = price > vwap_val
        
        long_signal = long_trend and long_momentum and long_macd and long_vwap
        
        # Short Entry Conditions
        short_trend = ema_val < sma_val
        short_momentum = rsi_val < 50
        short_macd = macd_line_val < macd_sig_val
        short_vwap = price < vwap_val
        
        short_signal = short_trend and short_momentum and short_macd and short_vwap
        
        # Trading Logic
        if long_signal:
            # Close any existing short position
            if self.position.is_short:
                self.position.close()
            
            # Enter long if not already in position
            if not self.position.is_long:
                sl_price = price - (atr * self.atr_sl_mult)
                tp_price = price + (atr * self.atr_tp_mult)
                self.buy(sl=sl_price, tp=tp_price)
        
        elif short_signal:
            # Close any existing long position
            if self.position.is_long:
                self.position.close()
            
            # Enter short if not already in position
            if not self.position.is_short:
                sl_price = price + (atr * self.atr_sl_mult)
                tp_price = price - (atr * self.atr_tp_mult)
                self.sell(sl=sl_price, tp=tp_price)


# ============================================================
# Simplified Strategy (No VWAP - for assets without volume)
# ============================================================

class SP500TrendStrategyNoVWAP(Strategy):
    """
    Simplified version without VWAP for forex or assets without reliable volume.
    """
    
    # Strategy Parameters
    ema_period = 20
    sma_period = 50
    rsi_period = 14
    macd_fast = 12
    macd_slow = 26
    macd_signal = 9
    atr_period = 14
    atr_sl_mult = 2.0
    atr_tp_mult = 6.0
    
    def init(self):
        """Initialize indicators"""
        self.ema = self.I(EMA, self.data.Close, self.ema_period)
        self.sma = self.I(SMA, self.data.Close, self.sma_period)
        self.rsi = self.I(RSI, self.data.Close, self.rsi_period)
        self.macd_line = self.I(MACD_line, self.data.Close, self.macd_fast, self.macd_slow)
        self.macd_sig = self.I(MACD_signal, self.data.Close, self.macd_fast, self.macd_slow, self.macd_signal)
        self.atr = self.I(ATR, self.data.High, self.data.Low, self.data.Close, self.atr_period)
    
    def next(self):
        """Execute on each new candle"""
        price = self.data.Close[-1]
        atr = self.atr[-1]
        
        if len(self.data.Close) < self.sma_period:
            return
        
        # Long Conditions (no VWAP)
        long_signal = (
            self.ema[-1] > self.sma[-1] and
            self.rsi[-1] > 50 and
            self.macd_line[-1] > self.macd_sig[-1]
        )
        
        # Short Conditions (no VWAP)
        short_signal = (
            self.ema[-1] < self.sma[-1] and
            self.rsi[-1] < 50 and
            self.macd_line[-1] < self.macd_sig[-1]
        )
        
        if long_signal:
            if self.position.is_short:
                self.position.close()
            if not self.position.is_long:
                sl = price - (atr * self.atr_sl_mult)
                tp = price + (atr * self.atr_tp_mult)
                self.buy(sl=sl, tp=tp)
        
        elif short_signal:
            if self.position.is_long:
                self.position.close()
            if not self.position.is_short:
                sl = price + (atr * self.atr_sl_mult)
                tp = price - (atr * self.atr_tp_mult)
                self.sell(sl=sl, tp=tp)


# ============================================================
# Backtest Runner
# ============================================================

def fetch_data(symbol="SPY", period="1y", interval="1d"):
    """Fetch historical data using yfinance"""
    print(f"Fetching {symbol} data ({period}, {interval})...")
    
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, interval=interval)
    
    if df.empty:
        raise ValueError(f"No data found for {symbol}")
    
    # Ensure column names match backtesting.py expectations
    df = df[['Open', 'High', 'Low', 'Close', 'Volume']]
    
    print(f"Fetched {len(df)} bars from {df.index[0]} to {df.index[-1]}")
    return df


def run_backtest(symbol="SPY", period="1y", initial_cash=100000, use_vwap=True):
    """
    Run backtest on the SP500 Trend Strategy.
    
    Args:
        symbol: Stock/ETF symbol (default: SPY for S&P500)
        period: Historical data period (1mo, 3mo, 6mo, 1y, 2y)
        initial_cash: Starting capital
        use_vwap: Whether to use VWAP indicator
    
    Returns:
        Backtest statistics
    """
    # Fetch data
    data = fetch_data(symbol, period)
    
    # Check if volume data is available
    has_volume = data['Volume'].sum() > 0
    
    if use_vwap and has_volume:
        strategy_class = SP500TrendStrategy
        print("Using full strategy with VWAP")
    else:
        strategy_class = SP500TrendStrategyNoVWAP
        print("Using simplified strategy (no VWAP)")
    
    # Create backtest
    bt = Backtest(
        data,
        strategy_class,
        cash=initial_cash,
        commission=0.002,  # 0.2% commission
        exclusive_orders=True,
        trade_on_close=True
    )
    
    # Run backtest
    stats = bt.run()
    
    return stats, bt


def print_results(stats):
    """Print formatted backtest results"""
    print("\n" + "="*60)
    print("BACKTEST RESULTS")
    print("="*60)
    
    print(f"\n📈 Performance:")
    print(f"   Total Return: {stats['Return [%]']:.2f}%")
    print(f"   Buy & Hold Return: {stats['Buy & Hold Return [%]']:.2f}%")
    print(f"   Max Drawdown: {stats['Max. Drawdown [%]']:.2f}%")
    
    print(f"\n📊 Risk Metrics:")
    print(f"   Sharpe Ratio: {stats['Sharpe Ratio']:.2f}" if pd.notna(stats['Sharpe Ratio']) else "   Sharpe Ratio: N/A")
    print(f"   Profit Factor: {stats['Profit Factor']:.2f}" if pd.notna(stats['Profit Factor']) else "   Profit Factor: N/A")
    
    print(f"\n🎯 Trade Statistics:")
    print(f"   Total Trades: {stats['# Trades']}")
    print(f"   Win Rate: {stats['Win Rate [%]']:.1f}%" if pd.notna(stats['Win Rate [%]']) else "   Win Rate: N/A")
    print(f"   Best Trade: {stats['Best Trade [%]']:.2f}%" if pd.notna(stats['Best Trade [%]']) else "   Best Trade: N/A")
    print(f"   Worst Trade: {stats['Worst Trade [%]']:.2f}%" if pd.notna(stats['Worst Trade [%]']) else "   Worst Trade: N/A")
    
    print(f"\n💰 Account:")
    print(f"   Starting Equity: ${stats._equity_curve['Equity'].iloc[0]:,.2f}")
    print(f"   Final Equity: ${stats['Equity Final [$]']:,.2f}")
    print(f"   Peak Equity: ${stats['Equity Peak [$]']:,.2f}")
    
    print("="*60 + "\n")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Run SP500 Trend Strategy Backtest")
    parser.add_argument("--symbol", default="SPY", help="Symbol to trade (default: SPY)")
    parser.add_argument("--period", default="1y", help="Data period: 1mo, 3mo, 6mo, 1y, 2y (default: 1y)")
    parser.add_argument("--cash", type=float, default=100000, help="Initial cash (default: 100000)")
    parser.add_argument("--no-vwap", action="store_true", help="Disable VWAP indicator")
    parser.add_argument("--plot", action="store_true", help="Generate interactive plot")
    
    args = parser.parse_args()
    
    print(f"\n🚀 SP500 Trend-Following Strategy Backtest")
    print(f"   Symbol: {args.symbol}")
    print(f"   Period: {args.period}")
    print(f"   Initial Cash: ${args.cash:,.0f}")
    print(f"   VWAP: {'Enabled' if not args.no_vwap else 'Disabled'}")
    
    try:
        stats, bt = run_backtest(
            symbol=args.symbol,
            period=args.period,
            initial_cash=args.cash,
            use_vwap=not args.no_vwap
        )
        
        print_results(stats)
        
        if args.plot:
            print("Generating plot...")
            bt.plot(open_browser=True)
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
