"""
Web Scraper Tools
Provides ability for the agent to read external web content.
"""
import requests
import re
from typing import Optional

def scrape_url_text(url: str, max_chars: int = 5000) -> str:
    """
    Fetch and extract main text content from a URL.
    Useful for reading news articles, documentation, or analysis linked by the user.
    
    Args:
        url: The URL to scrape
        max_chars: Maximum characters to return (to avoid flooding context)
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return f"Error: HTTP {response.status_code} when fetching {url}"
            
        html = response.text
        
        # very simple extraction: remove scripts, styles, and tags
        # 1. Remove script/style
        text = re.sub(r'<(script|style)[^>]*>[\s\S]*?</\1>', '', html, flags=re.IGNORECASE)
        # 2. Remove comments
        text = re.sub(r'<!--[\s\S]*?-->', '', text)
        # 3. Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', text)
        # 4. Collapse whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        if not text:
            return "No text content found."
            
        if len(text) > max_chars:
            return f"{text[:max_chars]}...\n\n[Content Truncated]"
            
        return text
            
    except Exception as e:
        return f"Error scraping URL: {str(e)}"

__all__ = ["scrape_url_text"]
