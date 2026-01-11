"""
Technical Analysis Tools
Provides direct calculation of technical indicators for agent analysis.
Uses pandas for calculation to ensure independence from external complex libs.
"""
import pandas as pd
import numpy as np
import yfinance as yf
from typing import Dict, Any, Optional

def get_technical_summary(symbol: str, period: str = "6mo", interval: str = "1d") -> str:
    """
    Get a comprehensive technical analysis summary for a symbol.
    Calculates RSI, MACD, Moving Averages, and Bollinger Bands.
    
    Args:
        symbol: Ticker symbol
        period: Data lookback period
        interval: Data interval
        
    Returns:
        Text summary of technicals
    """
    try:
        # Fetch data
        df = yf.Ticker(symbol).history(period=period, interval=interval)
        if df.empty:
            return f"No data found for {symbol}"
            
        close = df['Close']
        
        # Calculate Indicators
        current_price = close.iloc[-1]
        
        # 1. Moving Averages
        sma_50 = close.rolling(window=50).mean().iloc[-1]
        sma_200 = close.rolling(window=200).mean().iloc[-1]
        
        # 2. RSI (14)
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs)).iloc[-1]
        
        # 3. MACD (12, 26, 9)
        exp1 = close.ewm(span=12, adjust=False).mean()
        exp2 = close.ewm(span=26, adjust=False).mean()
        macd = exp1 - exp2
        signal = macd.ewm(span=9, adjust=False).mean()
        macd_val = macd.iloc[-1]
        signal_val = signal.iloc[-1]
        
        # 4. Bollinger Bands (20, 2)
        sma_20 = close.rolling(window=20).mean()
        std_20 = close.rolling(window=20).std()
        upper_bb = (sma_20 + (std_20 * 2)).iloc[-1]
        lower_bb = (sma_20 - (std_20 * 2)).iloc[-1]
        
        # Generate Analysis
        trend = "BULLISH" if current_price > sma_200 else "BEARISH"
        if pd.isna(sma_200): trend = "N/A (Not enough data)"
        
        rsi_status = "NEUTRAL"
        if rsi > 70: rsi_status = "OVERBOUGHT"
        elif rsi < 30: rsi_status = "OVERSOLD"
        
        macd_status = "BULLISH" if macd_val > signal_val else "BEARISH"
        
        summary = f"## Technical Analysis: {symbol} ({interval})\n"
        summary += f"**Price:** {current_price:.2f}\n"
        summary += f"**Trend (vs SMA200):** {trend}\n"
        summary += f"**RSI (14):** {rsi:.2f} ({rsi_status})\n"
        summary += f"**MACD:** {macd_val:.4f} (Signal: {signal_val:.4f}) -> {macd_status}\n"
        summary += f"**Bollinger Bands:** {lower_bb:.2f} - {upper_bb:.2f}\n"
        
        # Add simpler signals
        summary += "\n### Key Levels:\n"
        if not pd.isna(sma_50): summary += f"- SMA 50: {sma_50:.2f}\n"
        if not pd.isna(sma_200): summary += f"- SMA 200: {sma_200:.2f}\n"
        
        return summary
        
    except Exception as e:
        return f"Error performing TA for {symbol}: {str(e)}"

def calculate_pivot_points(symbol: str) -> str:
    """
    Calculate Standard Pivot Points, Support and Resistance levels based on previous day.
    """
    try:
        # Get last 5 days to ensure we have previous day complete
        df = yf.Ticker(symbol).history(period="5d", interval="1d")
        if len(df) < 2:
            return "Not enough data for pivot points"
            
        # Previous day data
        prev = df.iloc[-2]
        high = prev['High']
        low = prev['Low']
        close = prev['Close']
        
        pp = (high + low + close) / 3
        r1 = (2 * pp) - low
        s1 = (2 * pp) - high
        r2 = pp + (high - low)
        s2 = pp - (high - low)
        r3 = high + 2 * (pp - low)
        s3 = low - 2 * (high - pp)
        
        result = f"## Pivot Points (Standard) for {symbol}\n"
        result += f"**Pivot (PP):** {pp:.2f}\n\n"
        result += f"**Resistance:**\n- R3: {r3:.2f}\n- R2: {r2:.2f}\n- R1: {r1:.2f}\n\n"
        result += f"**Support:**\n- S1: {s1:.2f}\n- S2: {s2:.2f}\n- S3: {s3:.2f}\n"
        
        return result
    except Exception as e:
        return f"Error calculating pivots: {str(e)}"

__all__ = ["get_technical_summary", "calculate_pivot_points"]
