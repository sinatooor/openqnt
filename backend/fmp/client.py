"""
Financial Modeling Prep (FMP) API Client.

Handles authentication, rate limiting, and historical data fetching for:
- Stocks
- Commodities  
- Forex pairs
- Indices

API Documentation: https://site.financialmodelingprep.com/developer/docs
"""
import asyncio
import aiohttp
import logging
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class AssetType(Enum):
    """Classification of tradeable assets."""
    STOCK = "stock"
    COMMODITY = "commodity"
    FOREX = "forex"
    INDEX = "index"
    CRYPTO = "crypto"


@dataclass
class SymbolConfig:
    """Configuration for a symbol to fetch."""
    symbol: str
    asset_type: AssetType
    name: str
    exchange: Optional[str] = None
    currency: Optional[str] = None


# ============================================================================
# Symbol Definitions
# ============================================================================

STOCKS = [
    SymbolConfig("AAPL", AssetType.STOCK, "Apple Inc.", "NASDAQ", "USD"),
    SymbolConfig("MSFT", AssetType.STOCK, "Microsoft Corporation", "NASDAQ", "USD"),
    SymbolConfig("GOOGL", AssetType.STOCK, "Alphabet Inc.", "NASDAQ", "USD"),
    SymbolConfig("AMZN", AssetType.STOCK, "Amazon.com Inc.", "NASDAQ", "USD"),
    SymbolConfig("META", AssetType.STOCK, "Meta Platforms Inc.", "NASDAQ", "USD"),
    SymbolConfig("TSLA", AssetType.STOCK, "Tesla Inc.", "NASDAQ", "USD"),
    SymbolConfig("NVDA", AssetType.STOCK, "NVIDIA Corporation", "NASDAQ", "USD"),
    SymbolConfig("BRK-B", AssetType.STOCK, "Berkshire Hathaway Inc.", "NYSE", "USD"),
    SymbolConfig("JPM", AssetType.STOCK, "JPMorgan Chase & Co.", "NYSE", "USD"),
    SymbolConfig("XOM", AssetType.STOCK, "Exxon Mobil Corporation", "NYSE", "USD"),
]

COMMODITIES = [
    SymbolConfig("GCUSD", AssetType.COMMODITY, "Gold", None, "USD"),
    SymbolConfig("SIUSD", AssetType.COMMODITY, "Silver", None, "USD"),
    SymbolConfig("CLUSD", AssetType.COMMODITY, "WTI Crude Oil", None, "USD"),
    SymbolConfig("BZUSD", AssetType.COMMODITY, "Brent Crude Oil", None, "USD"),
    SymbolConfig("NGUSD", AssetType.COMMODITY, "Natural Gas", None, "USD"),
]

FOREX_PAIRS = [
    SymbolConfig("EURUSD", AssetType.FOREX, "Euro / US Dollar", None, "USD"),
    SymbolConfig("USDJPY", AssetType.FOREX, "US Dollar / Japanese Yen", None, "JPY"),
    SymbolConfig("GBPUSD", AssetType.FOREX, "British Pound / US Dollar", None, "USD"),
    SymbolConfig("AUDUSD", AssetType.FOREX, "Australian Dollar / US Dollar", None, "USD"),
    SymbolConfig("USDCAD", AssetType.FOREX, "US Dollar / Canadian Dollar", None, "CAD"),
    SymbolConfig("USDCHF", AssetType.FOREX, "US Dollar / Swiss Franc", None, "CHF"),
    SymbolConfig("NZDUSD", AssetType.FOREX, "New Zealand Dollar / US Dollar", None, "USD"),
    SymbolConfig("EURGBP", AssetType.FOREX, "Euro / British Pound", None, "GBP"),
    SymbolConfig("EURJPY", AssetType.FOREX, "Euro / Japanese Yen", None, "JPY"),
    SymbolConfig("GBPJPY", AssetType.FOREX, "British Pound / Japanese Yen", None, "JPY"),
]

INDICES = [
    SymbolConfig("^GSPC", AssetType.INDEX, "S&P 500 Index", None, "USD"),
]

# All symbols combined
ALL_SYMBOLS = STOCKS + COMMODITIES + FOREX_PAIRS + INDICES


class FMPClient:
    """
    Async client for Financial Modeling Prep API.
    
    Features:
    - Rate limiting with configurable delays
    - Automatic retry with exponential backoff
    - Date range chunking for large historical requests
    - Unified interface for all asset types
    """
    
    BASE_URL = "https://financialmodelingprep.com/stable"
    MAX_RECORDS_PER_REQUEST = 5000
    
    def __init__(
        self, 
        api_key: str,
        requests_per_minute: int = 250,  # Conservative for free tier
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        """
        Initialize FMP client.
        
        Args:
            api_key: FMP API key
            requests_per_minute: Rate limit (250/day for free, 300/min for starter)
            max_retries: Maximum retry attempts on failure
            retry_delay: Base delay between retries (exponential backoff applied)
        """
        self.api_key = api_key
        self.requests_per_minute = requests_per_minute
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self._request_count = 0
        self._last_request_time = None
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        self._session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._session:
            await self._session.close()
            self._session = None
    
    def _get_min_delay(self) -> float:
        """Calculate minimum delay between requests based on rate limit."""
        return 60.0 / self.requests_per_minute
    
    async def _rate_limit(self):
        """Apply rate limiting between requests."""
        if self._last_request_time:
            elapsed = (datetime.now() - self._last_request_time).total_seconds()
            min_delay = self._get_min_delay()
            if elapsed < min_delay:
                await asyncio.sleep(min_delay - elapsed)
        self._last_request_time = datetime.now()
        self._request_count += 1
    
    async def _make_request(self, endpoint: str, params: Dict[str, Any]) -> Optional[List[Dict]]:
        """
        Make an API request with retry logic.
        
        Args:
            endpoint: API endpoint path
            params: Query parameters
            
        Returns:
            JSON response data or None on failure
        """
        if not self._session:
            raise RuntimeError("Client not initialized. Use async context manager.")
        
        params["apikey"] = self.api_key
        url = f"{self.BASE_URL}/{endpoint}"
        
        for attempt in range(self.max_retries):
            try:
                await self._rate_limit()
                
                async with self._session.get(url, params=params, timeout=30) as response:
                    if response.status == 200:
                        data = await response.json()
                        if isinstance(data, dict) and "Error Message" in data:
                            logger.error(f"API Error: {data['Error Message']}")
                            return None
                        return data
                    elif response.status == 429:
                        # Rate limit exceeded
                        logger.warning(f"Rate limit hit, waiting {self.retry_delay * (2 ** attempt)}s...")
                        await asyncio.sleep(self.retry_delay * (2 ** attempt))
                    else:
                        text = await response.text()
                        logger.error(f"HTTP {response.status}: {text}")
                        if attempt < self.max_retries - 1:
                            await asyncio.sleep(self.retry_delay * (2 ** attempt))
                            
            except asyncio.TimeoutError:
                logger.warning(f"Request timeout (attempt {attempt + 1}/{self.max_retries})")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay * (2 ** attempt))
            except aiohttp.ClientError as e:
                logger.error(f"Client error: {e}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay * (2 ** attempt))
        
        return None
    
    def _chunk_date_range(
        self, 
        from_date: date, 
        to_date: date, 
        chunk_years: int = 2
    ) -> List[tuple]:
        """
        Split a date range into smaller chunks.
        
        FMP limits records per request, so for 10-year spans we need to chunk.
        
        Args:
            from_date: Start date
            to_date: End date  
            chunk_years: Years per chunk
            
        Returns:
            List of (start_date, end_date) tuples
        """
        chunks = []
        current_start = from_date
        
        while current_start < to_date:
            chunk_end = min(
                current_start.replace(year=current_start.year + chunk_years),
                to_date
            )
            chunks.append((current_start, chunk_end))
            current_start = chunk_end + timedelta(days=1)
        
        return chunks
    
    async def fetch_historical_prices(
        self,
        symbol: str,
        from_date: date,
        to_date: date,
    ) -> List[Dict[str, Any]]:
        """
        Fetch historical daily price data for a symbol.
        
        Uses the unified historical-price-eod/full endpoint that works for
        stocks, forex, commodities, and indices.
        
        Args:
            symbol: The symbol to fetch (e.g., "AAPL", "EURUSD", "GCUSD", "^GSPC")
            from_date: Start date for historical data
            to_date: End date for historical data
            
        Returns:
            List of OHLCV price records
        """
        all_data = []
        
        # Chunk the date range to avoid hitting record limits
        chunks = self._chunk_date_range(from_date, to_date, chunk_years=2)
        
        for chunk_start, chunk_end in chunks:
            logger.info(f"Fetching {symbol}: {chunk_start} to {chunk_end}")
            
            params = {
                "symbol": symbol,
                "from": chunk_start.isoformat(),
                "to": chunk_end.isoformat(),
            }
            
            data = await self._make_request("historical-price-eod/full", params)
            
            if data and isinstance(data, list):
                all_data.extend(data)
                logger.info(f"  → Received {len(data)} records")
            else:
                logger.warning(f"  → No data received for {symbol} ({chunk_start} to {chunk_end})")
        
        # Sort by date (oldest first)
        all_data.sort(key=lambda x: x.get("date", ""))
        
        return all_data
    
    async def fetch_all_symbols(
        self,
        from_date: date,
        to_date: date,
        symbols: Optional[List[SymbolConfig]] = None,
        progress_callback: Optional[callable] = None,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetch historical data for all configured symbols.
        
        Args:
            from_date: Start date
            to_date: End date
            symbols: List of symbols to fetch (defaults to ALL_SYMBOLS)
            progress_callback: Optional callback(symbol, current, total) for progress updates
            
        Returns:
            Dictionary mapping symbol to list of price records
        """
        if symbols is None:
            symbols = ALL_SYMBOLS
        
        results = {}
        total = len(symbols)
        
        for i, config in enumerate(symbols, 1):
            if progress_callback:
                progress_callback(config.symbol, i, total)
            
            logger.info(f"[{i}/{total}] Fetching {config.symbol} ({config.name})")
            
            data = await self.fetch_historical_prices(
                config.symbol,
                from_date,
                to_date,
            )
            
            results[config.symbol] = data
            logger.info(f"  → Total: {len(data)} records for {config.symbol}")
        
        return results
    
    @property
    def request_count(self) -> int:
        """Return the total number of API requests made."""
        return self._request_count
