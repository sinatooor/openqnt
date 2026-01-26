
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

def run_market_screen(symbols: List[str], filter_name: str, days_back: int = 365) -> List[Dict[str, Any]]:
    """
    Run a market screen on a list of symbols using a specific technical filter.
    
    Args:
        symbols: List of ticker symbols to screen (e.g., ["AAPL", "MSFT", "EURUSD=X"]).
        filter_name: The name of the filter to apply. Options:
                     - "uptrend_sma200": Price > 200 SMA (Bullish Trend)
                     - "downtrend_sma200": Price < 200 SMA (Bearish Trend)
                     - "rsi_oversold": RSI < 30 (Potential Reversal)
                     - "rsi_overbought": RSI > 70 (Potential Reversal)
                     - "macd_bullish_crossover": MACD > Signal (Bullish Momentum)
                     - "macd_bearish_crossover": MACD < Signal (Bearish Momentum)
                     - "bollinger_squeeze": Low Volatility (Pre-breakout)
                     - "volume_breakout": Volume > 200% of Avg
                     - "all": No filter (returns data for all symbols)
        days_back: Number of days of history to fetch (default: 365).
        
    Returns:
        A list of dictionaries containing screening results for symbols that passed the filter.
        Each result includes: symbol, close, change_pct, volume, signal, sparkline data.
    """
    try:
        # Import lazily to avoid circular imports
        from market_screener import MarketScreener
        
        screener = MarketScreener()
        results = screener.screen(symbols, filter_name, days_back)
        return results
        
    except Exception as e:
        logger.error(f"Error running market screen: {e}")
        return []
