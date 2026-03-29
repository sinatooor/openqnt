"""
Search Tools for ADK Trading Agent

Provides real-time market information via web search.
"""

import os
import httpx
from typing import Optional


async def _google_search(query: str, num_results: int = 5) -> list[dict]:
    """
    Perform a Google search using Gemini's grounding feature.
    Falls back to a simple search if API is not available.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return [{"error": "GEMINI_API_KEY not configured"}]
    
    # Use Gemini with Google Search grounding
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [{
            "role": "user",
            "parts": [{"text": f"Search the web and provide the latest information about: {query}. Include sources."}]
        }],
        "tools": [{
            "googleSearch": {}
        }],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 1024
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 200:
                data = response.json()
                text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                return [{"summary": text, "query": query}]
            else:
                return [{"error": f"Search API error: {response.status_code}"}]
    except Exception as e:
        return [{"error": str(e)}]


def search_market_news(symbol: str) -> dict:
    """
    Search for the latest market news about a trading symbol.
    
    Uses Google Search to find current headlines, price movements,
    and market sentiment for stocks, forex pairs, or crypto.
    
    Args:
        symbol: The trading symbol to search for (e.g., "AAPL", "EURUSD", "BTC")
        
    Returns:
        dict: Contains status, symbol, and news summary with headlines
        
    Example:
        >>> search_market_news("AAPL")
        {"status": "success", "symbol": "AAPL", "news": "Apple stock rises 2%..."}
    """
    import asyncio
    
    query = f"{symbol} stock market news today price movement"
    
    try:
        loop = asyncio.get_event_loop()
        results = loop.run_until_complete(_google_search(query))
    except RuntimeError:
        # No event loop, create one
        results = asyncio.run(_google_search(query))
    
    if results and "error" not in results[0]:
        return {
            "status": "success",
            "symbol": symbol,
            "news": results[0].get("summary", "No news found")
        }
    else:
        return {
            "status": "error",
            "symbol": symbol,
            "error_message": results[0].get("error", "Search failed") if results else "No results"
        }


def search_sentiment(topic: str) -> dict:
    """
    Analyze market sentiment for a specific topic using web search.
    
    Searches for bullish/bearish indicators, analyst opinions,
    and overall market mood around the given topic.
    
    Args:
        topic: The market topic to analyze (e.g., "Fed interest rates", 
               "tech earnings", "oil prices", "crypto regulation")
               
    Returns:
        dict: Contains status, topic, and sentiment analysis summary
        
    Example:
        >>> search_sentiment("Fed interest rates December 2024")
        {"status": "success", "topic": "Fed interest rates...", "sentiment": "neutral to hawkish..."}
    """
    import asyncio
    
    query = f"{topic} market sentiment analysis bullish bearish forecast"
    
    try:
        loop = asyncio.get_event_loop()
        results = loop.run_until_complete(_google_search(query))
    except RuntimeError:
        results = asyncio.run(_google_search(query))
    
    if results and "error" not in results[0]:
        return {
            "status": "success",
            "topic": topic,
            "sentiment": results[0].get("summary", "No sentiment data found")
        }
    else:
        return {
            "status": "error",
            "topic": topic,
            "error_message": results[0].get("error", "Search failed") if results else "No results"
        }


def search_economic_calendar(days: int = 7) -> dict:
    """
    Search for upcoming economic events and data releases.
    
    Args:
        days: Number of days to look ahead (default: 7)
        
    Returns:
        dict: Contains upcoming economic events with dates and expected impact
    """
    import asyncio
    
    query = f"economic calendar next {days} days FOMC NFP CPI important events"
    
    try:
        loop = asyncio.get_event_loop()
        results = loop.run_until_complete(_google_search(query))
    except RuntimeError:
        results = asyncio.run(_google_search(query))
    
    if results and "error" not in results[0]:
        return {
            "status": "success",
            "days_ahead": days,
            "events": results[0].get("summary", "No events found")
        }
    else:
        return {
            "status": "error",
            "error_message": results[0].get("error", "Search failed") if results else "No results"
        }
