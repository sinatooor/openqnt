from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from datetime import datetime

router = APIRouter(
    prefix="/api/news",
    tags=["news"]
)

class NewsArticle(BaseModel):
    id: str
    headline: str
    summary: str
    source: str
    published_at: str
    url: str
    sentiment: str
    tickers: List[str]

@router.get("/", response_model=List[NewsArticle])
async def get_news():
    # Simplified mock news feed
    return [
        {
            "id": "1",
            "headline": "Fed signals potential rate cut amid cooling inflation",
            "summary": "The Federal Reserve indicated it may consider cutting interest rates later this year as inflation shows signs of cooling.",
            "source": "Financial Times",
            "published_at": datetime.utcnow().isoformat(),
            "url": "https://example.com/news/1",
            "sentiment": "positive",
            "tickers": ["SPY", "QQQ"]
        },
        {
            "id": "2",
            "headline": "Tech stocks rally as AI spending accelerates",
            "summary": "Major technology companies saw their stock prices surge following reports of increased capital expenditure on artificial intelligence infrastructure.",
            "source": "Market Watch",
            "published_at": datetime.utcnow().isoformat(),
            "url": "https://example.com/news/2",
            "sentiment": "positive",
            "tickers": ["MSFT", "NVDA", "GOOGL"]
        },
        {
            "id": "3",
            "headline": "Oil prices dip on oversupply concerns",
            "summary": "Crude oil futures fell slightly in early trading due to concerns about global oversupply and weaker than expected demand.",
            "source": "Bloomberg",
            "published_at": datetime.utcnow().isoformat(),
            "url": "https://example.com/news/3",
            "sentiment": "negative",
            "tickers": ["USO", "XOM"]
        }
    ]
