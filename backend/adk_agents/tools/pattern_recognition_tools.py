"""
Pattern Recognition Tools
Provides candlestick pattern detection using pure pandas/numpy.
"""
import pandas as pd
import numpy as np
import yfinance as yf
from typing import List, Dict, Union

def scan_candlestick_patterns(symbol: str, period: str = "3mo") -> str:
    """
    Scan for common candlestick patterns (Doji, Hammer, Engulfing).
    
    Args:
        symbol: Ticker symbol
        period: Data lookback period
    """
    try:
        df = yf.download(symbol, period=period, interval="1d", progress=False)
        if df.empty:
            return "No data found."
            
        # Prepare data
        o = df['Open']
        h = df['High']
        l = df['Low']
        c = df['Close']
        
        # Candle properties
        body = np.abs(c - o)
        upper_shadow = h - np.maximum(c, o)
        lower_shadow = np.minimum(c, o) - l
        total_range = h - l
        avg_body = body.rolling(10).mean()
        
        patterns = []
        
        # Check last 3 candles
        for i in range(-3, 0):
            idx = df.index[i]
            date_str = idx.strftime('%Y-%m-%d')
            
            # 1. Doji (Body is < 10% of range)
            is_doji = body.iloc[i] <= 0.1 * total_range.iloc[i]
            if is_doji:
                patterns.append(f"- **{date_str}**: Doji (Indecision)")
                
            # 2. Hammer (Lower shadow > 2x body, small upper shadow)
            is_hammer = (lower_shadow.iloc[i] > 2 * body.iloc[i]) and \
                        (upper_shadow.iloc[i] < body.iloc[i])
            if is_hammer:
                patterns.append(f"- **{date_str}**: Hammer (Potential Reversal)")
                
            # 3. Bullish Engulfing (Current Green > Prev Red Body)
            if i > -3: # Need previous candle
                curr_green = c.iloc[i] > o.iloc[i]
                prev_red = c.iloc[i-1] < o.iloc[i-1]
                engulfs = (c.iloc[i] > o.iloc[i-1]) and (o.iloc[i] < c.iloc[i-1])
                
                if curr_green and prev_red and engulfs:
                    patterns.append(f"- **{date_str}**: Bullish Engulfing (Strong Buy Signal)")
                    
            # 4. Bearish Engulfing
            if i > -3:
                curr_red = c.iloc[i] < o.iloc[i]
                prev_green = c.iloc[i-1] > o.iloc[i-1]
                engulfs = (o.iloc[i] > c.iloc[i-1]) and (c.iloc[i] < o.iloc[i-1])
                
                if curr_red and prev_green and engulfs:
                    patterns.append(f"- **{date_str}**: Bearish Engulfing (Strong Sell Signal)")
                    
        if not patterns:
            return f"No significant patterns detected in the last 3 days for {symbol}."
            
        return f"## Pattern Scan: {symbol}\n" + "\n".join(patterns)
        
    except Exception as e:
        return f"Error scanning patterns: {str(e)}"

__all__ = ["scan_candlestick_patterns"]
