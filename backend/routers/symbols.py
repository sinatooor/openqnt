"""
Symbol Search Router

Provides symbol lookup and search functionality.
"""
from fastapi import APIRouter, Query
from typing import List, Optional

router = APIRouter(
    prefix="/api/symbols",
    tags=["symbols"]
)

# Pre-defined symbol database (in production, use a real data source)
SYMBOLS = [
    # Forex
    {"symbol": "EURUSD", "name": "Euro / US Dollar", "type": "forex", "exchange": "FOREX"},
    {"symbol": "GBPUSD", "name": "British Pound / US Dollar", "type": "forex", "exchange": "FOREX"},
    {"symbol": "USDJPY", "name": "US Dollar / Japanese Yen", "type": "forex", "exchange": "FOREX"},
    {"symbol": "AUDUSD", "name": "Australian Dollar / US Dollar", "type": "forex", "exchange": "FOREX"},
    {"symbol": "USDCAD", "name": "US Dollar / Canadian Dollar", "type": "forex", "exchange": "FOREX"},
    {"symbol": "NZDUSD", "name": "New Zealand Dollar / US Dollar", "type": "forex", "exchange": "FOREX"},
    {"symbol": "EURGBP", "name": "Euro / British Pound", "type": "forex", "exchange": "FOREX"},
    {"symbol": "EURJPY", "name": "Euro / Japanese Yen", "type": "forex", "exchange": "FOREX"},
    {"symbol": "GBPJPY", "name": "British Pound / Japanese Yen", "type": "forex", "exchange": "FOREX"},
    
    # US Stocks
    {"symbol": "AAPL", "name": "Apple Inc.", "type": "stock", "exchange": "NASDAQ"},
    {"symbol": "MSFT", "name": "Microsoft Corporation", "type": "stock", "exchange": "NASDAQ"},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "type": "stock", "exchange": "NASDAQ"},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "type": "stock", "exchange": "NASDAQ"},
    {"symbol": "TSLA", "name": "Tesla Inc.", "type": "stock", "exchange": "NASDAQ"},
    {"symbol": "META", "name": "Meta Platforms Inc.", "type": "stock", "exchange": "NASDAQ"},
    {"symbol": "NVDA", "name": "NVIDIA Corporation", "type": "stock", "exchange": "NASDAQ"},
    {"symbol": "JPM", "name": "JPMorgan Chase & Co.", "type": "stock", "exchange": "NYSE"},
    {"symbol": "V", "name": "Visa Inc.", "type": "stock", "exchange": "NYSE"},
    {"symbol": "JNJ", "name": "Johnson & Johnson", "type": "stock", "exchange": "NYSE"},
    
    # ETFs
    {"symbol": "SPY", "name": "SPDR S&P 500 ETF", "type": "etf", "exchange": "NYSE"},
    {"symbol": "QQQ", "name": "Invesco QQQ Trust", "type": "etf", "exchange": "NASDAQ"},
    {"symbol": "IWM", "name": "iShares Russell 2000 ETF", "type": "etf", "exchange": "NYSE"},
    {"symbol": "DIA", "name": "SPDR Dow Jones ETF", "type": "etf", "exchange": "NYSE"},
    {"symbol": "VTI", "name": "Vanguard Total Stock Market ETF", "type": "etf", "exchange": "NYSE"},
    
    # Crypto
    {"symbol": "BTCUSD", "name": "Bitcoin / US Dollar", "type": "crypto", "exchange": "CRYPTO"},
    {"symbol": "ETHUSD", "name": "Ethereum / US Dollar", "type": "crypto", "exchange": "CRYPTO"},
    {"symbol": "SOLUSD", "name": "Solana / US Dollar", "type": "crypto", "exchange": "CRYPTO"},
    {"symbol": "XRPUSD", "name": "Ripple / US Dollar", "type": "crypto", "exchange": "CRYPTO"},
    {"symbol": "ADAUSD", "name": "Cardano / US Dollar", "type": "crypto", "exchange": "CRYPTO"},
    
    # Indices
    {"symbol": "US500", "name": "S&P 500 Index", "type": "index", "exchange": "INDEX"},
    {"symbol": "US30", "name": "Dow Jones Industrial Average", "type": "index", "exchange": "INDEX"},
    {"symbol": "US100", "name": "NASDAQ 100 Index", "type": "index", "exchange": "INDEX"},
    {"symbol": "UK100", "name": "FTSE 100 Index", "type": "index", "exchange": "INDEX"},
    {"symbol": "DE40", "name": "DAX 40 Index", "type": "index", "exchange": "INDEX"},
]


@router.get("/search")
async def search_symbols(
    q: str = Query(..., min_length=1, description="Search query"),
    type: Optional[str] = Query(None, description="Filter by type: forex, stock, etf, crypto, index"),
    limit: int = Query(20, le=100)
):
    """Search for symbols by name or ticker."""
    query = q.upper()
    
    results = [
        s for s in SYMBOLS
        if query in s["symbol"] or query in s["name"].upper()
    ]
    
    if type:
        results = [s for s in results if s["type"] == type]
    
    return {
        "results": results[:limit],
        "total": len(results)
    }


@router.get("/popular")
async def get_popular_symbols(
    type: Optional[str] = None,
    limit: int = 10
):
    """Get popular/common symbols."""
    popular = ["EURUSD", "BTCUSD", "SPY", "AAPL", "GBPUSD", "TSLA", "US500", "ETHUSD", "QQQ", "MSFT"]
    
    results = [s for s in SYMBOLS if s["symbol"] in popular]
    
    if type:
        results = [s for s in results if s["type"] == type]
    
    return results[:limit]


@router.get("/types")
async def get_symbol_types():
    """Get available symbol types."""
    return {
        "types": [
            {"id": "forex", "name": "Forex", "count": len([s for s in SYMBOLS if s["type"] == "forex"])},
            {"id": "stock", "name": "Stocks", "count": len([s for s in SYMBOLS if s["type"] == "stock"])},
            {"id": "etf", "name": "ETFs", "count": len([s for s in SYMBOLS if s["type"] == "etf"])},
            {"id": "crypto", "name": "Crypto", "count": len([s for s in SYMBOLS if s["type"] == "crypto"])},
            {"id": "index", "name": "Indices", "count": len([s for s in SYMBOLS if s["type"] == "index"])},
        ]
    }


@router.get("/{symbol}")
async def get_symbol_info(symbol: str):
    """Get detailed info for a specific symbol."""
    symbol = symbol.upper()
    for s in SYMBOLS:
        if s["symbol"] == symbol:
            return s
    return {"error": "Symbol not found", "symbol": symbol}
