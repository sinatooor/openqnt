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
