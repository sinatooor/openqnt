from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import yfinance as yf

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

class PortfolioPriceRequest(BaseModel):
    symbols: List[str]

class PriceData(BaseModel):
    price: float
    previousClose: Optional[float] = None

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
