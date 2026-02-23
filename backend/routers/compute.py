"""
Compute-only endpoints for StrategyFlow Orchestrator integration.
These endpoints are called by the Node.js orchestrator for compute-heavy operations.
"""

import talib
import numpy as np
import pandas as pd
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/compute", tags=["compute"])


@router.get("/health")
async def compute_health():
    """Health check for compute service."""
    return {
        "status": "healthy",
        "service": "strategyflow-compute",
        "timestamp": pd.Timestamp.now().isoformat()
    }


@router.post("/indicators")
async def compute_indicators(request: Dict[str, Any]):
    """
    Compute indicator values from price data.
    """
    try:
        indicator_type = request.get("indicatorType")
        params = request.get("params", {})
        price_data = request.get("priceData", {})
        
        close = np.array(price_data.get("close", []))
        high = np.array(price_data.get("high", []))
        low = np.array(price_data.get("low", []))
        open_arr = np.array(price_data.get("open", []))
        volume = np.array(price_data.get("volume", []))
        
        if len(close) == 0:
            raise HTTPException(status_code=400, detail="No price data provided")
        
        result: Dict[str, List[float]] = {}
        
        if indicator_type == "rsi":
            period = params.get("period", 14)
            values = talib.RSI(close, timeperiod=period)
            result["output"] = values.tolist()
            
        elif indicator_type == "sma":
            period = params.get("period", 20)
            values = talib.SMA(close, timeperiod=period)
            result["output"] = values.tolist()
            
        elif indicator_type == "ema":
            period = params.get("period", 20)
            values = talib.EMA(close, timeperiod=period)
            result["output"] = values.tolist()
            
        elif indicator_type == "macd":
            fast = params.get("fast", 12)
            slow = params.get("slow", 26)
            signal = params.get("signal", 9)
            macd, signal_line, hist = talib.MACD(close, fastperiod=fast, slowperiod=slow, signalperiod=signal)
            result["macd"] = macd.tolist()
            result["signal"] = signal_line.tolist()
            result["histogram"] = hist.tolist()
            
        elif indicator_type == "bbands":
            period = params.get("period", 20)
            nbdevup = params.get("nbdevup", 2)
            nbdevdn = params.get("nbdevdn", 2)
            upper, middle, lower = talib.BBANDS(close, timeperiod=period, nbdevup=nbdevup, nbdevdn=nbdevdn)
            result["upper"] = upper.tolist()
            result["middle"] = middle.tolist()
            result["lower"] = lower.tolist()
            
        elif indicator_type == "atr":
            period = params.get("period", 14)
            values = talib.ATR(high, low, close, timeperiod=period)
            result["output"] = values.tolist()
            
        elif indicator_type == "adx":
            period = params.get("period", 14)
            values = talib.ADX(high, low, close, timeperiod=period)
            result["output"] = values.tolist()
            
        elif indicator_type == "cci":
            period = params.get("period", 20)
            values = talib.CCI(high, low, close, timeperiod=period)
            result["output"] = values.tolist()
            
        elif indicator_type == "stoch":
            fastk_period = params.get("fastk_period", 5)
            slowk_period = params.get("slowk_period", 3)
            slowd_period = params.get("slowd_period", 3)
            slowk, slowd = talib.STOCH(high, low, close, fastk_period=fastk_period, slowk_period=slowk_period, slowd_period=slowd_period)
            result["k"] = slowk.tolist()
            result["d"] = slowd.tolist()
            
        elif indicator_type == "willr":
            period = params.get("period", 14)
            values = talib.WILLR(high, low, close, timeperiod=period)
            result["output"] = values.tolist()
            
        elif indicator_type == "obv":
            values = talib.OBV(close, volume)
            result["output"] = values.tolist()
            
        elif indicator_type == "mfi":
            period = params.get("period", 14)
            values = talib.MFI(high, low, close, volume, timeperiod=period)
            result["output"] = values.tolist()
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported indicator: {indicator_type}")
        
        return {"values": result}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indicator computation failed: {str(e)}")


@router.post("/backtest")
async def compute_backtest(request: Dict[str, Any]):
    """
    Run backtest on a compiled strategy.
    """
    return {
        "metrics": {
            "total_return": 0.0,
            "sharpe_ratio": 0.0,
            "max_drawdown": 0.0,
            "win_rate": 0.0,
            "total_trades": 0
        },
        "equity_curve": [],
        "trade_log": [],
        "message": "Backtest endpoint available - full implementation pending"
    }


@router.post("/ai-analyze")
async def compute_ai_analyze(request: Dict[str, Any]):
    """
    Run AI analysis on strategy context.
    """
    return {
        "analysis": "AI analysis not yet implemented",
        "confidence": 0.0,
        "reasoning": "ADK integration pending"
    }
