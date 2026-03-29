"""News Router — Real-time financial news from Google News RSS + optional Gemini AI analysis."""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import re
import httpx
import json
import uuid
import asyncio
import logging
import feedparser
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/news", tags=["news"])


class NewsArticle(BaseModel):
    id: str
    headline: str
    summary: str
    source: str
    published_at: str
    url: str
    sentiment: str
    tickers: List[str]


class NewsAnalysis(BaseModel):
    summary: str
    overall_sentiment: str
    key_takeaways: List[str]
    market_impact: str


class NewsResponse(BaseModel):
    articles: List[NewsArticle]
    analysis: Optional[NewsAnalysis] = None
    query: str
    category: str


MARKET_QUERIES = {
    "global": "stock market today",
    "tech": "technology stocks AI semiconductor NVIDIA",
    "energy": "oil gas energy stocks renewable",
    "crypto": "bitcoin ethereum cryptocurrency market",
    "healthcare": "healthcare pharma biotech stocks",
    "finance": "banking financial sector interest rates",
    "commodities": "gold silver oil commodities market",
}

KNOWN_TICKERS = {
    "apple": ["AAPL"], "iphone": ["AAPL"], "ipad": ["AAPL"],
    "microsoft": ["MSFT"], "windows": ["MSFT"], "azure": ["MSFT"],
    "nvidia": ["NVDA"], "nvda": ["NVDA"], "geforce": ["NVDA"],
    "google": ["GOOGL"], "alphabet": ["GOOGL"], "youtube": ["GOOGL"],
    "amazon": ["AMZN"], "aws": ["AMZN"],
    "meta": ["META"], "facebook": ["META"], "instagram": ["META"],
    "tesla": ["TSLA"], "tsla": ["TSLA"],
    "netflix": ["NFLX"], "amd": ["AMD"], "intel": ["INTC"],
    "broadcom": ["AVGO"], "qualcomm": ["QCOM"], "adobe": ["ADBE"],
    "salesforce": ["CRM"], "oracle": ["ORCL"], "ibm": ["IBM"],
    "jpmorgan": ["JPM"], "jp morgan": ["JPM"],
    "goldman sachs": ["GS"], "morgan stanley": ["MS"],
    "bank of america": ["BAC"], "citigroup": ["C"], "wells fargo": ["WFC"],
    "visa": ["V"], "mastercard": ["MA"], "paypal": ["PYPL"],
    "exxon": ["XOM"], "chevron": ["CVX"], "conocophillips": ["COP"],
    "berkshire": ["BRK.B"], "walmart": ["WMT"], "costco": ["COST"],
    "disney": ["DIS"], "nike": ["NKE"], "coca-cola": ["KO"],
    "pepsi": ["PEP"], "pepsico": ["PEP"], "boeing": ["BA"],
    "s&p": ["SPY"], "s&p 500": ["SPY"], "nasdaq": ["QQQ"],
    "dow jones": ["DIA"], "dow": ["DIA"], "bitcoin": ["BTC"],
    "ethereum": ["ETH"], "oil": ["USO"], "crude": ["USO"],
    "gold": ["GLD"], "silver": ["SLV"], "copper": ["CPER"],
    "uber": ["UBER"], "airbnb": ["ABNB"], "snowflake": ["SNOW"],
    "palantir": ["PLTR"], "coinbase": ["COIN"], "robinhood": ["HOOD"],
    "semiconductor": ["SMH"], "chip": ["SMH"], "chips": ["SMH"],
    "openai": ["MSFT"], "chatgpt": ["MSFT"],
    "arm holdings": ["ARM"], "arm": ["ARM"],
    "supermicro": ["SMCI"], "micron": ["MU"], "marvell": ["MRVL"],
    "taiwan semiconductor": ["TSM"], "tsmc": ["TSM"],
}

POSITIVE_WORDS = {
    "surge", "surges", "rally", "rallies", "gain", "gains", "rise", "rises",
    "jump", "jumps", "soar", "soars", "bullish", "record", "high", "upgrade",
    "beat", "beats", "exceed", "exceeds", "strong", "growth", "profit",
    "boost", "boosts", "optimism", "recovery", "rebounds", "positive",
    "outperform", "upbeat", "boom", "advances",
}

NEGATIVE_WORDS = {
    "fall", "falls", "drop", "drops", "decline", "declines", "plunge",
    "plunges", "crash", "crashes", "bearish", "loss", "losses", "miss",
    "misses", "weak", "warning", "downgrade", "cut", "layoff", "layoffs",
    "recession", "fear", "fears", "concern", "concerns", "slump", "tumble",
    "risk", "risks", "sell-off", "selloff", "negative", "underperform",
    "downturn", "sinks", "slides",
}

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_HTML_ENTITY_RE = re.compile(r"&\w+;|&#\d+;")


def _clean_html(text: str) -> str:
    import html
    text = _HTML_TAG_RE.sub("", text)
    text = html.unescape(text)
    text = _HTML_ENTITY_RE.sub(" ", text)
    return " ".join(text.split()).strip()


def _extract_source(entry: dict) -> str:
    """Extract the source publication from a Google News RSS entry."""
    source = entry.get("source", {})
    if isinstance(source, dict):
        return source.get("title", "") or source.get("value", "")
    title = entry.get("title", "")
    if " - " in title:
        return title.rsplit(" - ", 1)[-1].strip()
    return "News"


def _extract_tickers(text: str, explicit_ticker: str = "") -> list[str]:
    """Extract likely stock tickers from headline/summary text."""
    tickers = set()
    if explicit_ticker:
        tickers.add(explicit_ticker.upper())

    text_lower = text.lower()
    for keyword, syms in KNOWN_TICKERS.items():
        if keyword in text_lower:
            tickers.update(syms)

    all_caps = re.findall(r"\b([A-Z]{2,5})\b", text)
    skip = {"THE", "AND", "FOR", "CEO", "IPO", "GDP", "CPI", "FED", "SEC",
            "ETF", "NYSE", "USA", "NFL", "NBA", "CNN", "BBC", "AI", "EU", "UK"}
    for word in all_caps:
        if word not in skip and len(word) >= 2:
            tickers.add(word)

    return sorted(tickers)[:6]


def _score_sentiment(text: str) -> str:
    words = set(text.lower().split())
    pos = len(words & POSITIVE_WORDS)
    neg = len(words & NEGATIVE_WORDS)
    if pos > neg:
        return "positive"
    if neg > pos:
        return "negative"
    return "neutral"


async def _fetch_google_news(query: str, num: int = 12) -> list[dict]:
    """Fetch articles from Google News RSS."""
    encoded = httpx.URL("", params={"q": query}).params
    url = f"https://news.google.com/rss/search?{encoded}&hl=en-US&gl=US&ceid=US:en"

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    feed = feedparser.parse(resp.text)
    articles = []

    for entry in feed.entries[:num]:
        try:
            pub_date = parsedate_to_datetime(entry.get("published", ""))
        except Exception:
            pub_date = datetime.now(timezone.utc)

        headline = _clean_html(entry.get("title", ""))
        raw_summary = _clean_html(entry.get("summary", entry.get("description", "")))
        source = _extract_source(entry)

        if source and headline.endswith(f" - {source}"):
            headline = headline[: -(len(source) + 3)].strip()

        # Google News RSS summaries often just repeat "headline  Source"
        summary = raw_summary
        if source and summary.endswith(source):
            summary = summary[: -len(source)].strip()
        if summary == headline or not summary:
            summary = ""

        articles.append({
            "headline": headline,
            "summary": summary,
            "source": source,
            "published_at": pub_date.isoformat(),
            "url": entry.get("link", "#"),
        })

    return articles


async def _gemini_analyze(headlines: list[str], query: str, api_key: str) -> Optional[NewsAnalysis]:
    """Use Gemini to provide AI analysis of the fetched headlines."""
    if not api_key:
        return None

    bullet_list = "\n".join(f"- {h}" for h in headlines[:12])
    prompt = (
        f"You are a financial analyst. Analyze these recent news headlines about '{query}'.\n\n"
        f"Headlines:\n{bullet_list}\n\n"
        "Return ONLY valid JSON (no markdown, no fences):\n"
        '{"summary": "2-3 sentence market assessment",'
        ' "overall_sentiment": "positive|negative|neutral",'
        ' "key_takeaways": ["point1", "point2", "point3", "point4"],'
        ' "market_impact": "Expected impact on portfolios"}'
    )

    gemini_url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024},
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for attempt in range(2):
                resp = await client.post(gemini_url, json=payload)
                if resp.status_code == 429:
                    await asyncio.sleep(2 ** attempt * 2)
                    continue
                break

            if resp.status_code != 200:
                logger.warning("Gemini analysis unavailable (HTTP %d)", resp.status_code)
                return None

            data = resp.json()
            text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )

            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            brace_start = text.find("{")
            brace_end = text.rfind("}")
            if brace_start != -1 and brace_end != -1:
                text = text[brace_start : brace_end + 1]

            result = json.loads(text)
            overall = result.get("overall_sentiment", "neutral").lower()
            if overall not in ("positive", "negative", "neutral"):
                overall = "neutral"

            return NewsAnalysis(
                summary=result.get("summary", ""),
                overall_sentiment=overall,
                key_takeaways=result.get("key_takeaways", []),
                market_impact=result.get("market_impact", ""),
            )

    except Exception as e:
        logger.warning("Gemini analysis failed: %s", e)
        return None


def _build_fallback_analysis(articles: list[NewsArticle], query: str) -> NewsAnalysis:
    """Build a simple analysis from sentiment counts when Gemini is unavailable."""
    counts = {"positive": 0, "negative": 0, "neutral": 0}
    for a in articles:
        counts[a.sentiment] = counts.get(a.sentiment, 0) + 1

    total = len(articles) or 1
    dominant = max(counts, key=lambda k: counts[k])

    pos_pct = round(counts["positive"] / total * 100)
    neg_pct = round(counts["negative"] / total * 100)

    summary = (
        f"Based on {total} recent articles about {query}: "
        f"{pos_pct}% positive, {neg_pct}% negative sentiment. "
        f"Overall tone is {dominant}."
    )

    takeaways = []
    sources = set(a.source for a in articles)
    tickers = set()
    for a in articles:
        tickers.update(a.tickers)
    if sources:
        takeaways.append(f"Coverage from {len(sources)} sources including {', '.join(list(sources)[:3])}")
    if tickers:
        takeaways.append(f"Key tickers mentioned: {', '.join(list(tickers)[:6])}")
    if counts["positive"] > counts["negative"]:
        takeaways.append("Majority of coverage carries bullish signals")
    elif counts["negative"] > counts["positive"]:
        takeaways.append("Majority of coverage carries bearish signals")
    else:
        takeaways.append("Market sentiment is mixed with no clear direction")
    takeaways.append(f"Analysis based on {total} articles — refresh for latest data")

    return NewsAnalysis(
        summary=summary,
        overall_sentiment=dominant,
        key_takeaways=takeaways,
        market_impact=f"{'Positive' if dominant == 'positive' else 'Negative' if dominant == 'negative' else 'Mixed'} outlook for related positions.",
    )


@router.get("/", response_model=NewsResponse)
async def get_news(
    query: str = Query(
        default="global",
        description="Company ticker (e.g. AAPL) or market topic (e.g. tech, crypto)",
    ),
    category: str = Query(
        default="market",
        description="'company' or 'market'",
    ),
):
    """Fetch real-time financial news from Google News and optionally analyze with Gemini."""
    if category == "market":
        search_query = MARKET_QUERIES.get(query.lower(), f"{query} stocks market")
    else:
        search_query = f"{query} stock financial news"

    explicit_ticker = query.upper() if category == "company" else ""

    try:
        raw_articles = await _fetch_google_news(search_query, num=12)
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch news: {e}")

    if not raw_articles:
        return NewsResponse(
            articles=[], analysis=None, query=query, category=category,
        )

    articles: list[NewsArticle] = []
    for raw in raw_articles:
        headline = raw["headline"]
        summary = raw["summary"]
        combined_text = f"{headline} {summary}"

        articles.append(NewsArticle(
            id=uuid.uuid4().hex[:8],
            headline=headline,
            summary=summary,
            source=raw["source"],
            published_at=raw["published_at"],
            url=raw["url"],
            sentiment=_score_sentiment(combined_text),
            tickers=_extract_tickers(combined_text, explicit_ticker),
        ))

    api_key = os.getenv("GEMINI_API_KEY", "")
    headlines = [a.headline for a in articles]
    analysis = await _gemini_analyze(headlines, query, api_key)

    if analysis is None:
        analysis = _build_fallback_analysis(articles, query)

    return NewsResponse(
        articles=articles,
        analysis=analysis,
        query=query,
        category=category,
    )
