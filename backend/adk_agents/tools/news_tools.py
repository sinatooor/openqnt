"""
News Tools
Provides access to real-time market news using various data sources.
"""
import yfinance as yf
from typing import List, Dict, Optional
import datetime

def get_market_news(symbol: str, limit: int = 5) -> str:
    """
    Get the latest news headlines and links for a specific symbol.
    Uses yfinance to fetch aggregated news from major financial publishers.
    
    Args:
        symbol: Ticker symbol (e.g., "AAPL", "EURUSD=X")
        limit: Number of news items to return
    
    Returns:
        Markdown formatted list of news items.
    """
    try:
        ticker = yf.Ticker(symbol)
        news_items = ticker.news
        
        if not news_items:
            return f"No recent news found for {symbol}."
            
        summary = f"## Lateast News for {symbol}\n\n"
        
        for i, item in enumerate(news_items[:limit]):
            title = item.get('title', 'No Title')
            link = item.get('link', '#')
            publisher = item.get('publisher', 'Unknown')
            # Timestamp (unix)
            ts = item.get('providerPublishTime', 0)
            date_str = datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M') if ts else "N/A"
            
            summary += f"### {i+1}. {title}\n"
            summary += f"- **Source:** {publisher} ({date_str})\n"
            summary += f"- **Link:** {link}\n"
            # Some feeds have 'relatedTickers'
            related = item.get('relatedTickers', [])
            if related:
                summary += f"- **Related:** {', '.join(related)}\n"
            summary += "\n"
            
        summary += "---\n*Tip: Use `scrape_url_text(link)` to read the full content of an interesting article.*"
        return summary
        
    except Exception as e:
        return f"Error fetching news for {symbol}: {str(e)}"

def get_general_market_news() -> str:
    """
    Get general market news (top stories).
    Note: yfinance focuses on symbols. Ideally this would use a different API.
    For now, we can proxy via a major index like ^GSPC (S&P 500) or pure search.
    """
    return get_market_news("^GSPC", limit=5)

__all__ = ["get_market_news", "get_general_market_news"]
