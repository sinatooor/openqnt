from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import yfinance as yf

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

class PortfolioPriceRequest(BaseModel):
    symbols: List[str]

class PriceData(BaseModel):
    price: float
    previousClose: Optional[float] = None


class PortfolioHistoryHolding(BaseModel):
    symbol: str
    quantity: float = Field(..., gt=0)


class PortfolioHistoryRequest(BaseModel):
    holdings: List[PortfolioHistoryHolding]
    days: int = Field(90, ge=7, le=365)


class PortfolioHistoryPoint(BaseModel):
    timestamp: int
    totalValue: float

@router.post("/prices", response_model=Dict[str, PriceData])
async def get_portfolio_prices(req: PortfolioPriceRequest):
    """
    Fetch real-time prices and previous close for a list of symbols using yfinance.
    """
    if not req.symbols:
        return {}
        
    prices = {}
    try:
        # We can either fetch them one by one or in a batch. 
        # yfinance download works for batch, Ticker for single.
        # For simplicity and robustness with different asset types, we'll iterate
        # To speed up, we could batch but yf's batch is sometimes tricky with mixed types.
        for symbol in req.symbols:
            try:
                # Clean up symbol for yfinance if needed (e.g. BTC -> BTC-USD for crypto if not already specified)
                # But we assume the frontend sends a valid yfinance ticker.
                ticker = yf.Ticker(symbol)
                info = ticker.fast_info
                
                # fast_info provides last_price and previous_close safely
                last_price = info.get("last_price")
                prev_close = info.get("previous_close")
                
                if last_price is not None:
                    prices[symbol] = PriceData(
                        price=float(last_price),
                        previousClose=float(prev_close) if prev_close is not None else None
                    )
            except Exception as e:
                print(f"Failed to fetch price for {symbol}: {e}")
                # We simply omit it from the response if it fails
                pass

        return prices
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/history")
async def get_portfolio_history(req: PortfolioHistoryRequest):
    """
    Build a portfolio value history from current holdings using yfinance.
    Returns daily total value for the last N days.
    """
    if not req.holdings:
        return {"history": [], "source": "yfinance", "missingSymbols": []}

    holdings = [h for h in req.holdings if h.quantity > 0]
    if not holdings:
        return {"history": [], "source": "yfinance", "missingSymbols": []}

    def _normalize_symbol(symbol: str) -> str:
        s = symbol.strip().upper()
        if s in {"BTC", "ETH"}:
            return f"{s}-USD"
        return s

    symbols = [_normalize_symbol(h.symbol) for h in holdings]
    symbol_map = {h.symbol: _normalize_symbol(h.symbol) for h in holdings}

    try:
        df = yf.download(
            " ".join(sorted(set(symbols))),
            period=f"{req.days}d",
            interval="1d",
            progress=False,
            group_by="ticker",
            auto_adjust=False,
            threads=True,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"history fetch failed: {e}")

    if df is None or df.empty:
        raise HTTPException(status_code=502, detail="history fetch failed: empty response")

    is_multi = hasattr(df, "columns") and hasattr(df.columns, "levels")

    def _close_series(symbol: str):
        try:
            if is_multi:
                return df[symbol]["Close"].dropna()
            return df["Close"].dropna()
        except Exception:
            return None

    closes = {sym: _close_series(sym) for sym in set(symbols)}
    missing = [sym for sym, series in closes.items() if series is None or series.empty]

    history: List[Dict[str, float]] = []
    for ts in df.index:
        total = 0.0
        for holding in holdings:
            sym = symbol_map[holding.symbol]
            series = closes.get(sym)
            if series is None:
                continue
            try:
                price = float(series.loc[ts])
            except Exception:
                continue
            total += price * float(holding.quantity)
        if total > 0:
            history.append({
                "timestamp": int(ts.to_pydatetime().replace(tzinfo=timezone.utc).timestamp() * 1000),
                "totalValue": round(total, 2),
            })

    return {"history": history, "source": "yfinance", "missingSymbols": missing}
