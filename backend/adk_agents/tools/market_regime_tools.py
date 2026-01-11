"""
Market Regime Tools
Provides classification of market conditions (Trend, Range, Volatility) using technical indicators.
"""
import pandas as pd
import numpy as np
import yfinance as yf

def classify_market_regime(symbol: str, period: str = "6mo") -> str:
    """
    Classify the market regime for a symbol (Trending vs Ranging, High vs Low Volatility).
    Uses ADX for trend strength and ATR for volatility.
    
    Args:
        symbol: Ticker symbol
        period: Lookback period
    """
    try:
        # Fetch data
        df = yf.download(symbol, period=period, interval="1d", progress=False)
        if df.empty:
            return "No data found."
            
        high = df['High']
        low = df['Low']
        close = df['Close']
        
        # 1. Calculate ATR (Volatility)
        tr1 = high - low
        tr2 = np.abs(high - close.shift())
        tr3 = np.abs(low - close.shift())
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = tr.rolling(14).mean()
        
        # Normalized ATR (ATR %)
        natr = (atr / close) * 100
        current_natr = natr.iloc[-1]
        
        # 2. Calculate ADX (Trend Strength) - Simplified
        # Uses standard +DI/-DI calculation
        up = high - high.shift()
        down = low.shift() - low
        
        plus_dm = np.where((up > down) & (up > 0), up, 0.0)
        minus_dm = np.where((down > up) & (down > 0), down, 0.0)
        
        pd_series = pd.Series(plus_dm, index=df.index).ewm(alpha=1/14, adjust=False).mean()
        md_series = pd.Series(minus_dm, index=df.index).ewm(alpha=1/14, adjust=False).mean()
        
        atr_series = tr.ewm(alpha=1/14, adjust=False).mean()
        
        plus_di = 100 * (pd_series / atr_series)
        minus_di = 100 * (md_series / atr_series)
        
        dx = 100 * np.abs(plus_di - minus_di) / (plus_di + minus_di)
        adx = dx.ewm(alpha=1/14, adjust=False).mean()
        current_adx = adx.iloc[-1]
        
        # 3. Determine Regime
        # ADX > 25 = Trending
        # ADX < 20 = Ranging
        
        trend_status = "Weak/Ranging"
        if current_adx > 25:
            trend_status = "Strong Trend"
        elif current_adx > 20:
            trend_status = "Trending"
            
        # Direction
        sma50 = close.rolling(50).mean().iloc[-1]
        sma200 = close.rolling(200).mean().iloc[-1]
        
        direction = "Sideways"
        if close.iloc[-1] > sma50:
            direction = "Bullish"
        if close.iloc[-1] < sma50:
            direction = "Bearish"
            
        # Volatility
        vol_status = "Normal"
        if current_natr > 2.0: # Arbitrary threshold for "High" (varies by asset class)
            vol_status = "High Volatility"
        elif current_natr < 0.5:
            vol_status = "Low Volatility"
            
        # Composite Regime
        regime = f"{direction} {trend_status} ({vol_status})"
        
        summary = f"## Market Regime: {symbol}\n\n"
        summary += f"**Overall Regime:** {regime}\n\n"
        summary += "### Indicators\n"
        summary += f"- **ADX (Trend Strength):** {current_adx:.2f} (>25 is strong)\n"
        summary += f"- **ATR% (Volatility):** {current_natr:.2f}%\n"
        summary += f"- **Trend Bias:** {direction} (Price vs SMA50)\n"
        
        if trend_status == "Strong Trend":
            summary += "\n💡 **Strategy Tip:** Use trend-following strategies (Moving Averages, Breakouts)."
        elif trend_status == "Weak/Ranging":
            summary += "\n💡 **Strategy Tip:** Use mean-reversion strategies (RSI, Bollinger Bands, Grid)."
            
        return summary
        
    except Exception as e:
        return f"Error classifying regime: {str(e)}"

__all__ = ["classify_market_regime"]
