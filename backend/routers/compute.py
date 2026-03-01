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


# =====================================================================
# Advanced Quantitative Research Endpoints
# =====================================================================

@router.post("/monte-carlo")
async def compute_monte_carlo(request: Dict[str, Any]):
    """
    Monte Carlo simulation on backtest trade results.
    Randomizes trade order / returns to generate a distribution of outcomes.

    Input:
      - trades: list of { pnl: float } or returns: list of float
      - numSimulations: int (default 1000)
      - initialCapital: float (default 10000)

    Output:
      - percentiles: { p5, p25, p50, p75, p95 } of final equity
      - equityPaths: sampled paths (5 representative)
      - distribution: histogram of final equities
    """
    try:
        trades = request.get("trades", [])
        returns = request.get("returns", [])
        num_sims = int(request.get("numSimulations", 1000))
        initial_capital = float(request.get("initialCapital", 10000))

        if trades:
            pnls = np.array([float(t.get("pnl", t) if isinstance(t, dict) else t) for t in trades])
        elif returns:
            pnls = np.array([float(r) for r in returns])
        else:
            raise HTTPException(status_code=400, detail="Provide 'trades' (with pnl) or 'returns'")

        if len(pnls) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 trades/returns")

        final_equities = np.zeros(num_sims)
        sample_paths = []

        for i in range(num_sims):
            shuffled = np.random.permutation(pnls)
            equity_curve = initial_capital + np.cumsum(shuffled)
            equity_curve = np.insert(equity_curve, 0, initial_capital)
            final_equities[i] = equity_curve[-1]
            if i < 5:
                sample_paths.append(equity_curve.tolist())

        percentiles = {
            "p5": float(np.percentile(final_equities, 5)),
            "p25": float(np.percentile(final_equities, 25)),
            "p50": float(np.percentile(final_equities, 50)),
            "p75": float(np.percentile(final_equities, 75)),
            "p95": float(np.percentile(final_equities, 95)),
        }

        hist_counts, hist_edges = np.histogram(final_equities, bins=50)
        distribution = {
            "counts": hist_counts.tolist(),
            "edges": hist_edges.tolist(),
        }

        return {
            "success": True,
            "numSimulations": num_sims,
            "initialCapital": initial_capital,
            "numTrades": len(pnls),
            "percentiles": percentiles,
            "mean": float(np.mean(final_equities)),
            "std": float(np.std(final_equities)),
            "equityPaths": sample_paths,
            "distribution": distribution,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Monte Carlo simulation failed: {str(e)}")


@router.post("/hmm-regime")
async def compute_hmm_regime(request: Dict[str, Any]):
    """
    Hidden Markov Model regime detection on a price series.

    Input:
      - prices: list of float (close prices)
      - numStates: int (default 3 — bull/bear/sideways)
      - lookback: int (optional, use last N bars)

    Output:
      - states: list of int (regime label per bar)
      - stateLabels: { 0: "low_vol", 1: "high_vol", ... }
      - transitionMatrix: NxN
      - means, variances per state
    """
    try:
        from hmmlearn.hmm import GaussianHMM

        prices = np.array(request.get("prices", []), dtype=float)
        num_states = int(request.get("numStates", 3))
        lookback = request.get("lookback")

        if len(prices) < 30:
            raise HTTPException(status_code=400, detail="Need at least 30 price points")

        if lookback:
            prices = prices[-int(lookback):]

        log_returns = np.diff(np.log(prices)).reshape(-1, 1)

        model = GaussianHMM(
            n_components=num_states,
            covariance_type="full",
            n_iter=200,
            random_state=42,
        )
        model.fit(log_returns)
        states = model.predict(log_returns)

        # Label states by mean return: highest mean = "bull", lowest = "bear"
        means = model.means_.flatten()
        sorted_idx = np.argsort(means)
        labels = {}
        label_names = ["bear", "sideways", "bull"] if num_states == 3 else [f"regime_{i}" for i in range(num_states)]
        for rank, idx in enumerate(sorted_idx):
            labels[int(idx)] = label_names[min(rank, len(label_names) - 1)]

        return {
            "success": True,
            "numStates": num_states,
            "numBars": len(prices),
            "states": states.tolist(),
            "stateLabels": labels,
            "transitionMatrix": model.transmat_.tolist(),
            "means": model.means_.flatten().tolist(),
            "variances": [cov.flatten().tolist() for cov in model.covars_],
            "currentRegime": labels.get(int(states[-1]), "unknown"),
        }
    except ImportError:
        raise HTTPException(status_code=501, detail="hmmlearn not installed. Run: pip install hmmlearn")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HMM regime detection failed: {str(e)}")


@router.post("/walk-forward")
async def compute_walk_forward(request: Dict[str, Any]):
    """
    Walk-forward analysis — train on window, test on next window, roll forward.

    Input:
      - returns: list of float (strategy returns per bar)
      - trainWindow: int (bars for in-sample)
      - testWindow: int (bars for out-of-sample)

    Output:
      - windows: list of { trainSharpe, testSharpe, trainReturn, testReturn }
      - overallOOSSharpe: Sharpe of all OOS returns concatenated
      - efficiency: OOS Sharpe / IS Sharpe ratio
    """
    try:
        returns = np.array(request.get("returns", []), dtype=float)
        train_window = int(request.get("trainWindow", 252))
        test_window = int(request.get("testWindow", 63))

        if len(returns) < train_window + test_window:
            raise HTTPException(status_code=400, detail=f"Need at least {train_window + test_window} returns")

        windows = []
        all_oos_returns = []
        i = 0

        while i + train_window + test_window <= len(returns):
            train = returns[i:i + train_window]
            test = returns[i + train_window:i + train_window + test_window]

            train_sharpe = float(np.mean(train) / max(np.std(train), 1e-9) * np.sqrt(252))
            test_sharpe = float(np.mean(test) / max(np.std(test), 1e-9) * np.sqrt(252))

            windows.append({
                "startIdx": i,
                "trainSharpe": round(train_sharpe, 4),
                "testSharpe": round(test_sharpe, 4),
                "trainReturn": round(float(np.sum(train)) * 100, 2),
                "testReturn": round(float(np.sum(test)) * 100, 2),
            })
            all_oos_returns.extend(test.tolist())
            i += test_window

        oos = np.array(all_oos_returns)
        oos_sharpe = float(np.mean(oos) / max(np.std(oos), 1e-9) * np.sqrt(252)) if len(oos) > 1 else 0
        is_sharpes = [w["trainSharpe"] for w in windows]
        avg_is = np.mean(is_sharpes) if is_sharpes else 1
        efficiency = round(oos_sharpe / max(avg_is, 1e-9), 4)

        return {
            "success": True,
            "numWindows": len(windows),
            "trainWindow": train_window,
            "testWindow": test_window,
            "windows": windows,
            "overallOOSSharpe": round(oos_sharpe, 4),
            "avgISSharpe": round(float(avg_is), 4),
            "efficiency": efficiency,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Walk-forward analysis failed: {str(e)}")


@router.post("/var-cvar")
async def compute_var_cvar(request: Dict[str, Any]):
    """
    Value at Risk (VaR) and Conditional VaR (CVaR / Expected Shortfall).

    Input:
      - returns: list of float (daily returns)
      - confidence: float (default 0.95)
      - portfolioValue: float (default 100000)

    Output:
      - var: VaR at confidence level
      - cvar: CVaR (expected loss beyond VaR)
      - varDollar, cvarDollar: dollar amounts
    """
    try:
        returns = np.array(request.get("returns", []), dtype=float)
        confidence = float(request.get("confidence", 0.95))
        portfolio_value = float(request.get("portfolioValue", 100000))

        if len(returns) < 10:
            raise HTTPException(status_code=400, detail="Need at least 10 return observations")

        alpha = 1 - confidence
        sorted_returns = np.sort(returns)
        var_idx = int(np.floor(alpha * len(sorted_returns)))
        var_pct = float(sorted_returns[var_idx])
        cvar_pct = float(np.mean(sorted_returns[:max(var_idx, 1)]))

        return {
            "success": True,
            "confidence": confidence,
            "numObservations": len(returns),
            "var": round(var_pct * 100, 4),
            "cvar": round(cvar_pct * 100, 4),
            "varDollar": round(abs(var_pct) * portfolio_value, 2),
            "cvarDollar": round(abs(cvar_pct) * portfolio_value, 2),
            "meanReturn": round(float(np.mean(returns)) * 100, 4),
            "stdReturn": round(float(np.std(returns)) * 100, 4),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"VaR/CVaR computation failed: {str(e)}")


@router.post("/cointegration")
async def compute_cointegration(request: Dict[str, Any]):
    """
    Cointegration test (Engle-Granger) between two price series.

    Input:
      - pricesA: list of float
      - pricesB: list of float
      - symbolA: str (optional label)
      - symbolB: str (optional label)

    Output:
      - cointegrated: bool (at 5% significance)
      - pValue, tStatistic, criticalValues
      - hedgeRatio, spread statistics
    """
    try:
        from statsmodels.tsa.stattools import coint

        prices_a = np.array(request.get("pricesA", []), dtype=float)
        prices_b = np.array(request.get("pricesB", []), dtype=float)
        symbol_a = request.get("symbolA", "A")
        symbol_b = request.get("symbolB", "B")

        if len(prices_a) < 30 or len(prices_b) < 30:
            raise HTTPException(status_code=400, detail="Need at least 30 observations per series")

        min_len = min(len(prices_a), len(prices_b))
        prices_a = prices_a[:min_len]
        prices_b = prices_b[:min_len]

        t_stat, p_value, crit_values = coint(prices_a, prices_b)

        # Hedge ratio via OLS
        hedge_ratio = float(np.polyfit(prices_b, prices_a, 1)[0])
        spread = prices_a - hedge_ratio * prices_b
        spread_mean = float(np.mean(spread))
        spread_std = float(np.std(spread))

        return {
            "success": True,
            "symbolA": symbol_a,
            "symbolB": symbol_b,
            "cointegrated": bool(p_value < 0.05),
            "pValue": round(float(p_value), 6),
            "tStatistic": round(float(t_stat), 4),
            "criticalValues": {
                "1pct": round(float(crit_values[0]), 4),
                "5pct": round(float(crit_values[1]), 4),
                "10pct": round(float(crit_values[2]), 4),
            },
            "hedgeRatio": round(hedge_ratio, 6),
            "spreadMean": round(spread_mean, 4),
            "spreadStd": round(spread_std, 4),
            "currentSpread": round(float(spread[-1]), 4),
            "zScore": round(float((spread[-1] - spread_mean) / max(spread_std, 1e-9)), 4),
        }
    except ImportError:
        raise HTTPException(status_code=501, detail="statsmodels not installed. Run: pip install statsmodels")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cointegration test failed: {str(e)}")


@router.post("/param-sweep")
async def compute_param_sweep(request: Dict[str, Any]):
    """
    Parameter sensitivity analysis — evaluate a metric across a grid of parameter values.

    Input:
      - paramName: str (e.g. "rsi_period")
      - paramValues: list of numbers (e.g. [10, 12, 14, 16, 18, 20])
      - returns: dict mapping param_value -> list of strategy returns
        OR
      - backtestResults: dict mapping param_value -> { sharpe, totalReturn, maxDrawdown }

    Output:
      - results: list of { paramValue, sharpe, totalReturn, maxDrawdown }
      - bestParam: the param value with highest Sharpe
    """
    try:
        param_name = request.get("paramName", "parameter")
        param_values = request.get("paramValues", [])
        returns_map = request.get("returns", {})
        bt_results = request.get("backtestResults", {})

        results = []

        if returns_map:
            for pv in param_values:
                key = str(pv)
                rets = np.array(returns_map.get(key, []), dtype=float)
                if len(rets) < 2:
                    continue
                sharpe = float(np.mean(rets) / max(np.std(rets), 1e-9) * np.sqrt(252))
                cum = np.cumprod(1 + rets)
                peak = np.maximum.accumulate(cum)
                dd = float(np.min(cum / peak - 1))
                results.append({
                    "paramValue": pv,
                    "sharpe": round(sharpe, 4),
                    "totalReturn": round(float((cum[-1] - 1) * 100), 2),
                    "maxDrawdown": round(dd * 100, 2),
                })
        elif bt_results:
            for pv in param_values:
                key = str(pv)
                r = bt_results.get(key, {})
                results.append({
                    "paramValue": pv,
                    "sharpe": r.get("sharpe", 0),
                    "totalReturn": r.get("totalReturn", 0),
                    "maxDrawdown": r.get("maxDrawdown", 0),
                })
        else:
            raise HTTPException(status_code=400, detail="Provide 'returns' or 'backtestResults'")

        best = max(results, key=lambda x: x["sharpe"]) if results else None

        return {
            "success": True,
            "paramName": param_name,
            "numValues": len(results),
            "results": results,
            "bestParam": best,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parameter sweep failed: {str(e)}")
