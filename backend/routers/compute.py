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

# =============================================================================
# CUSTOM INDICATOR IMPLEMENTATIONS
# =============================================================================

def calculate_supertrend(high, low, close, period=10, multiplier=3):
    """Calculate SuperTrend indicator."""
    high = pd.Series(high)
    low = pd.Series(low)
    close = pd.Series(close)

    # Calculate ATR
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(period).mean()

    # Calculate basic upper and lower bands
    hl2 = (high + low) / 2
    basic_upper = hl2 + (multiplier * atr)
    basic_lower = hl2 - (multiplier * atr)

    # Initialize final bands
    final_upper = basic_upper.copy()
    final_lower = basic_lower.copy()
    trend = pd.Series(0, index=close.index)

    for i in range(period, len(close)):
        if basic_upper.iloc[i] < final_upper.iloc[i-1] or close.iloc[i-1] > final_upper.iloc[i-1]:
            final_upper.iloc[i] = basic_upper.iloc[i]
        else:
            final_upper.iloc[i] = final_upper.iloc[i-1]

        if basic_lower.iloc[i] > final_lower.iloc[i-1] or close.iloc[i-1] < final_lower.iloc[i-1]:
            final_lower.iloc[i] = basic_lower.iloc[i]
        else:
            final_lower.iloc[i] = final_lower.iloc[i-1]

        # Determine trend direction
        if close.iloc[i] > final_upper.iloc[i-1]:
            trend.iloc[i] = 1
        elif close.iloc[i] < final_lower.iloc[i-1]:
            trend.iloc[i] = -1
        else:
            trend.iloc[i] = trend.iloc[i-1]

    # SuperTrend value
    st = pd.Series(np.nan, index=close.index)
    st[trend == 1] = final_lower[trend == 1]
    st[trend == -1] = final_upper[trend == -1]

    return st.fillna(0).tolist(), trend.fillna(0).tolist()

def calculate_vwap(high, low, close, volume):
    """Calculate Volume Weighted Average Price (VWAP)."""
    high = pd.Series(high)
    low = pd.Series(low)
    close = pd.Series(close)
    volume = pd.Series(volume)

    typical_price = (high + low + close) / 3
    vwap = (typical_price * volume).cumsum() / volume.cumsum()

    return vwap.fillna(0).tolist()

def calculate_ichimoku(high, low, close, tenkan=9, kijun=26, senkou_b=52):
    """Calculate Ichimoku Cloud."""
    high = pd.Series(high)
    low = pd.Series(low)
    close = pd.Series(close)

    # Tenkan-sen (Conversion Line): (9-period high + 9-period low)/2
    period9_high = high.rolling(window=tenkan).max()
    period9_low = low.rolling(window=tenkan).min()
    tenkan_sen = (period9_high + period9_low) / 2

    # Kijun-sen (Base Line): (26-period high + 26-period low)/2
    period26_high = high.rolling(window=kijun).max()
    period26_low = low.rolling(window=kijun).min()
    kijun_sen = (period26_high + period26_low) / 2

    # Senkou Span A (Leading Span A): (Conversion Line + Base Line)/2
    senkou_span_a = ((tenkan_sen + kijun_sen) / 2).shift(kijun)

    # Senkou Span B (Leading Span B): (52-period high + 52-period low)/2
    period52_high = high.rolling(window=senkou_b).max()
    period52_low = low.rolling(window=senkou_b).min()
    senkou_span_b = ((period52_high + period52_low) / 2).shift(kijun)

    # Chikou Span (Lagging Span): Close shifted back 26 periods
    chikou_span = close.shift(-kijun)

    return {
        "tenkan": tenkan_sen.fillna(0).tolist(),
        "kijun": kijun_sen.fillna(0).tolist(),
        "senkou_a": senkou_span_a.fillna(0).tolist(),
        "senkou_b": senkou_span_b.fillna(0).tolist(),
        "chikou": chikou_span.fillna(0).tolist()
    }

def calculate_donchian(high, low, period=20):
    """Calculate Donchian Channels."""
    high = pd.Series(high)
    low = pd.Series(low)

    upper = high.rolling(window=period).max()
    lower = low.rolling(window=period).min()
    middle = (upper + lower) / 2

    return {
        "upper": upper.fillna(0).tolist(),
        "middle": middle.fillna(0).tolist(),
        "lower": lower.fillna(0).tolist()
    }

def calculate_keltner(high, low, close, period=20, multiplier=2):
    """Calculate Keltner Channels."""
    high = pd.Series(high)
    low = pd.Series(low)
    close = pd.Series(close)

    # Typical Price
    tp = (high + low + close) / 3
    # EMA of Typical Price
    middle = tp.ewm(span=period, adjust=False).mean()

    # ATR
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(period).mean()

    upper = middle + (multiplier * atr)
    lower = middle - (multiplier * atr)

    return {
        "upper": upper.fillna(0).tolist(),
        "middle": middle.fillna(0).tolist(),
        "lower": lower.fillna(0).tolist()
    }

def calculate_envelopes(close, period=14, deviation=0.1):
    """Calculate Envelopes."""
    close = pd.Series(close)
    ma = close.rolling(window=period).mean()

    upper = ma * (1 + deviation)
    lower = ma * (1 - deviation)

    return {
        "upper": upper.fillna(0).tolist(),
        "middle": ma.fillna(0).tolist(),
        "lower": lower.fillna(0).tolist()
    }

def calculate_alligator(high, low, jaw_period=13, teeth_period=8, lips_period=5):
    """Calculate Bill Williams Alligator."""
    # Smoothed Moving Average calculation helper
    def smma(series, period):
        return series.ewm(alpha=1/period, adjust=False).mean()

    hl2 = (pd.Series(high) + pd.Series(low)) / 2

    jaw = smma(hl2, jaw_period).shift(8)
    teeth = smma(hl2, teeth_period).shift(5)
    lips = smma(hl2, lips_period).shift(3)

    return {
        "jaw": jaw.fillna(0).tolist(),
        "teeth": teeth.fillna(0).tolist(),
        "lips": lips.fillna(0).tolist()
    }

def calculate_fractals(high, low):
    """Calculate Bill Williams Fractals."""
    high = pd.Series(high)
    low = pd.Series(low)

    up_fractal = pd.Series(np.nan, index=high.index)
    down_fractal = pd.Series(np.nan, index=low.index)

    # Simple 5-bar fractal
    # Bullish Fractal: High[i] > High[i-2], High[i-1], High[i+1], High[i+2]
    # Bearish Fractal: Low[i] < Low[i-2], Low[i-1], Low[i+1], Low[i+2]

    for i in range(2, len(high) - 2):
        if (high[i] > high[i-1] and high[i] > high[i-2] and
            high[i] > high[i+1] and high[i] > high[i+2]):
            up_fractal[i] = high[i]

        if (low[i] < low[i-1] and low[i] < low[i-2] and
            low[i] < low[i+1] and low[i] < low[i+2]):
            down_fractal[i] = low[i]

    return {
        "upper": up_fractal.fillna(0).tolist(),
        "lower": down_fractal.fillna(0).tolist()
    }

# =============================================================================
# API ENDPOINTS
# =============================================================================

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
    Supports extended list of indicators from BLOCK_CATALOG.xml.
    """
    try:
        raw_type = request.get("indicatorType", "").lower()
        # Strip 'ta_' prefix if present
        indicator_type = raw_type[3:] if raw_type.startswith("ta_") else raw_type

        params = request.get("params", {})
        price_data = request.get("priceData", {})
        
        # Extract data arrays
        close = np.array(price_data.get("close", []), dtype=float)
        high = np.array(price_data.get("high", []), dtype=float)
        low = np.array(price_data.get("low", []), dtype=float)
        open_arr = np.array(price_data.get("open", []), dtype=float)
        volume = np.array(price_data.get("volume", []), dtype=float)
        
        if len(close) == 0:
            raise HTTPException(status_code=400, detail="No price data provided")
        
        result: Dict[str, List[float]] = {}
        
        # === OSCILLATORS ===
        if indicator_type == "rsi":
            period = int(params.get("period", 14))
            values = talib.RSI(close, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()

        elif indicator_type == "stoch" or indicator_type == "stochastic":
            fastk_period = int(params.get("fastk_period", params.get("kperiod", 5)))
            slowk_period = int(params.get("slowk_period", params.get("slowing", 3)))
            slowd_period = int(params.get("slowd_period", params.get("dperiod", 3)))
            slowk, slowd = talib.STOCH(high, low, close,
                                     fastk_period=fastk_period,
                                     slowk_period=slowk_period,
                                     slowd_period=slowd_period)
            result["main"] = np.nan_to_num(slowk).tolist() # Maps to 'main' component
            result["signal"] = np.nan_to_num(slowd).tolist()

        elif indicator_type == "cci":
            period = int(params.get("period", 14))
            values = talib.CCI(high, low, close, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()
            
        elif indicator_type == "williams_r" or indicator_type == "willr":
            period = int(params.get("period", 14))
            values = talib.WILLR(high, low, close, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()

        elif indicator_type == "momentum":
            period = int(params.get("period", 14))
            values = talib.MOM(close, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()

        elif indicator_type == "adx":
            period = int(params.get("period", 14))
            values = talib.ADX(high, low, close, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()

        elif indicator_type == "adxwilder":
             # ADX Wilder is similar to ADX but uses Wilders Smoothing
             # TA-Lib doesn't have explicit ADX Wilder, assume ADX for now or use custom
             # Using standard ADX as fallback
             period = int(params.get("period", 14))
             values = talib.ADX(high, low, close, timeperiod=period)
             result["output"] = np.nan_to_num(values).tolist()

        elif indicator_type == "dmi":
            period = int(params.get("period", 14))
            plus_di = talib.PLUS_DI(high, low, close, timeperiod=period)
            minus_di = talib.MINUS_DI(high, low, close, timeperiod=period)
            adx = talib.ADX(high, low, close, timeperiod=period)
            result["plus_di"] = np.nan_to_num(plus_di).tolist()
            result["minus_di"] = np.nan_to_num(minus_di).tolist()
            result["adx"] = np.nan_to_num(adx).tolist()

        # === MOVING AVERAGES ===
        elif indicator_type == "sma":
            period = int(params.get("period", 20))
            values = talib.SMA(close, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()
            
        elif indicator_type == "ema":
            period = int(params.get("period", 20))
            values = talib.EMA(close, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()
            
        elif indicator_type == "wma" or indicator_type == "lwma":
            period = int(params.get("period", 20))
            values = talib.WMA(close, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()

        elif indicator_type == "dema":
            period = int(params.get("period", 30))
            values = talib.DEMA(close, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()

        elif indicator_type == "tema":
            period = int(params.get("period", 30))
            values = talib.TEMA(close, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()

        elif indicator_type == "trima":
            period = int(params.get("period", 30))
            values = talib.TRIMA(close, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()

        elif indicator_type == "kama" or indicator_type == "ama":
            period = int(params.get("period", 30))
            values = talib.KAMA(close, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()

        # === TREND ===
        elif indicator_type == "macd" or indicator_type == "macd_value":
            fast = int(params.get("fast", params.get("fastema", 12)))
            slow = int(params.get("slow", params.get("slowema", 26)))
            signal = int(params.get("signal", params.get("signalsma", 9)))
            macd, signal_line, hist = talib.MACD(close, fastperiod=fast, slowperiod=slow, signalperiod=signal)
            result["line"] = np.nan_to_num(macd).tolist()
            result["signal"] = np.nan_to_num(signal_line).tolist()
            result["histogram"] = np.nan_to_num(hist).tolist()

        elif indicator_type == "sar":
            accel = float(params.get("acceleration", params.get("step", 0.02)))
            max_val = float(params.get("maximum", 0.2))
            values = talib.SAR(high, low, acceleration=accel, maximum=max_val)
            result["output"] = np.nan_to_num(values).tolist()
            
        elif indicator_type == "supertrend":
            period = int(params.get("period", 10))
            multiplier = float(params.get("multiplier", 3.0))
            st, trend = calculate_supertrend(high, low, close, period, multiplier)
            result["output"] = st
            result["trend"] = trend

        elif indicator_type == "ichimoku":
            tenkan = int(params.get("tenkan", params.get("tenkansen", 9)))
            kijun = int(params.get("kijun", params.get("kijunsen", 26)))
            senkou_b = int(params.get("senkou_b", params.get("senkouspanb", 52)))
            ichimoku = calculate_ichimoku(high, low, close, tenkan, kijun, senkou_b)
            result.update(ichimoku)

        # === VOLATILITY ===
        elif indicator_type == "bbands" or indicator_type == "bb":
            period = int(params.get("period", 20))
            nbdevup = float(params.get("nbdevup", params.get("deviation", 2)))
            nbdevdn = float(params.get("nbdevdn", params.get("deviation", 2)))
            upper, middle, lower = talib.BBANDS(close, timeperiod=period, nbdevup=nbdevup, nbdevdn=nbdevdn)
            result["upper"] = np.nan_to_num(upper).tolist()
            result["middle"] = np.nan_to_num(middle).tolist()
            result["lower"] = np.nan_to_num(lower).tolist()
            
        elif indicator_type == "atr":
            period = int(params.get("period", 14))
            values = talib.ATR(high, low, close, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()
            
        elif indicator_type == "keltner":
            period = int(params.get("period", 20))
            multiplier = float(params.get("multiplier", params.get("deviation", 2)))
            keltner = calculate_keltner(high, low, close, period, multiplier)
            result.update(keltner)
            
        elif indicator_type == "donchian":
            period = int(params.get("period", 20))
            donchian = calculate_donchian(high, low, period)
            result.update(donchian)
            
        elif indicator_type == "envelopes":
            period = int(params.get("period", 14))
            deviation = float(params.get("deviation", 0.1))
            envelopes = calculate_envelopes(close, period, deviation)
            result.update(envelopes)
            
        elif indicator_type == "stddev":
            period = int(params.get("period", 20))
            nbdev = float(params.get("nbdev", 1))
            values = talib.STDDEV(close, timeperiod=period, nbdev=nbdev)
            result["output"] = np.nan_to_num(values).tolist()

        # === VOLUME ===
        elif indicator_type == "obv":
            values = talib.OBV(close, volume)
            result["output"] = np.nan_to_num(values).tolist()
            
        elif indicator_type == "mfi":
            period = int(params.get("period", 14))
            values = talib.MFI(high, low, close, volume, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()

        elif indicator_type == "vwap":
            values = calculate_vwap(high, low, close, volume)
            result["output"] = values

        elif indicator_type == "ad": # Accumulation/Distribution
            values = talib.AD(high, low, close, volume)
            result["output"] = np.nan_to_num(values).tolist()

        elif indicator_type == "chaikin": # Chaikin Oscillator
            fast = int(params.get("fast_ema", 3))
            slow = int(params.get("slow_ema", 10))
            values = talib.ADO(high, low, close, volume, fastperiod=fast, slowperiod=slow)
            result["output"] = np.nan_to_num(values).tolist()

        # === BILL WILLIAMS ===
        elif indicator_type == "alligator":
            jaw_p = int(params.get("jawperiod", 13))
            teeth_p = int(params.get("teethperiod", 8))
            lips_p = int(params.get("lipsperiod", 5))
            alligator = calculate_alligator(high, low, jaw_p, teeth_p, lips_p)
            result.update(alligator)

        elif indicator_type == "fractals":
            fractals = calculate_fractals(high, low)
            result.update(fractals)

        # === OTHER ===
        elif indicator_type == "highest":
            period = int(params.get("period", 14))
            values = talib.MAX(high, timeperiod=period) # Assuming High
            result["output"] = np.nan_to_num(values).tolist()

        elif indicator_type == "lowest":
            period = int(params.get("period", 14))
            values = talib.MIN(low, timeperiod=period) # Assuming Low
            result["output"] = np.nan_to_num(values).tolist()

        elif indicator_type == "trix":
            period = int(params.get("period", 30))
            values = talib.TRIX(close, timeperiod=period)
            result["output"] = np.nan_to_num(values).tolist()
            
        else:
            # Fallback for unsupported types, log warning in production
            # Returning zeros to prevent crash, or raise error
            raise HTTPException(status_code=400, detail=f"Unsupported indicator: {indicator_type} (raw: {raw_type})")
        
        return {"values": result}
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
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
