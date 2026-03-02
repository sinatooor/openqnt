"""
Quant Tools — QuantStats portfolio analytics & quant-trading strategy backtests.

Provides two main entry points:
  1. run_quantstats_report(ticker, benchmark, start, end)
     → portfolio metrics + base64 plot images
  2. run_quant_strategy(strategy, ticker, start, end, params)
     → strategy backtest metrics + signal chart
"""

import io
import base64
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fig_to_base64(fig) -> str:
    """Convert a matplotlib figure to a base64 PNG data-URI."""
    import matplotlib
    matplotlib.use("Agg")
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100, bbox_inches="tight",
                facecolor="#1e1e1e", edgecolor="none")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode()
    buf.close()
    import matplotlib.pyplot as plt
    plt.close(fig)
    return f"data:image/png;base64,{b64}"


def _download_ohlcv(ticker: str, start: str, end: str) -> pd.DataFrame:
    """Download OHLCV data using yfinance."""
    import yfinance as yf
    df = yf.download(ticker, start=start, end=end, progress=False, auto_adjust=True)
    if df.empty:
        raise ValueError(f"No data for {ticker} between {start} and {end}")
    # Flatten MultiIndex columns from yfinance if necessary
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    return df


def _safe_float(v) -> Optional[float]:
    """Convert numpy/pandas scalar to Python float, return None if NaN."""
    if v is None:
        return None
    try:
        f = float(v)
        return None if np.isnan(f) or np.isinf(f) else round(f, 6)
    except (TypeError, ValueError):
        return None


# ============================================================================
# 1. QUANTSTATS REPORT
# ============================================================================

def run_quantstats_report(
    ticker: str,
    benchmark: str = "SPY",
    start_date: str = "",
    end_date: str = "",
) -> Dict[str, Any]:
    """
    Generate a full QuantStats-style analytics report.

    Returns:
      - metrics: dict of key performance metrics
      - plots: dict of { name: base64_png }
    """
    import quantstats as qs
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # Defaults
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    if not start_date:
        start_date = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

    # Fetch returns
    returns = qs.utils.download_returns(ticker, period=f"{start_date}--{end_date}")
    if returns is None or returns.empty:
        raise ValueError(f"Could not fetch returns for {ticker}")

    bench_returns = qs.utils.download_returns(benchmark, period=f"{start_date}--{end_date}")

    # ── Metrics ──
    metrics: Dict[str, Any] = {}
    try:
        metrics["sharpe"] = _safe_float(qs.stats.sharpe(returns))
        metrics["sortino"] = _safe_float(qs.stats.sortino(returns))
        metrics["cagr"] = _safe_float(qs.stats.cagr(returns))
        metrics["maxDrawdown"] = _safe_float(qs.stats.max_drawdown(returns))
        metrics["volatility"] = _safe_float(qs.stats.volatility(returns))
        metrics["calmar"] = _safe_float(qs.stats.calmar(returns))
        metrics["winRate"] = _safe_float(qs.stats.win_rate(returns))
        metrics["profitFactor"] = _safe_float(qs.stats.profit_factor(returns))
        metrics["payoffRatio"] = _safe_float(qs.stats.payoff_ratio(returns))
        metrics["valueAtRisk"] = _safe_float(qs.stats.value_at_risk(returns))
        metrics["expectedShortfall"] = _safe_float(qs.stats.cvar(returns))
        metrics["kellyC"] = _safe_float(qs.stats.kelly_criterion(returns))
        metrics["kurtosis"] = _safe_float(qs.stats.kurtosis(returns))
        metrics["skew"] = _safe_float(qs.stats.skew(returns))
        metrics["bestDay"] = _safe_float(qs.stats.best(returns))
        metrics["worstDay"] = _safe_float(qs.stats.worst(returns))
        metrics["avgReturn"] = _safe_float(qs.stats.avg_return(returns))
        metrics["avgWin"] = _safe_float(qs.stats.avg_win(returns))
        metrics["avgLoss"] = _safe_float(qs.stats.avg_loss(returns))
        metrics["consecutiveWins"] = _safe_float(qs.stats.consecutive_wins(returns))
        metrics["consecutiveLosses"] = _safe_float(qs.stats.consecutive_losses(returns))
    except Exception:
        pass  # some metrics may fail, keep what we have

    # ── Plots (base64 PNGs) ──
    plots: Dict[str, str] = {}

    # Snapshot
    try:
        fig = qs.plots.snapshot(returns, title=f"{ticker} Performance", show=False,
                                savefig=None, figsize=(10, 8))
        if fig is not None:
            plots["snapshot"] = _fig_to_base64(fig)
    except Exception:
        pass

    # Drawdown
    try:
        fig = qs.plots.drawdown(returns, show=False, savefig=None, figsize=(10, 4))
        if fig is not None:
            plots["drawdown"] = _fig_to_base64(fig)
    except Exception:
        pass

    # Monthly heatmap
    try:
        fig = qs.plots.monthly_heatmap(returns, show=False, savefig=None, figsize=(10, 5))
        if fig is not None:
            plots["monthlyHeatmap"] = _fig_to_base64(fig)
    except Exception:
        pass

    # Returns distribution
    try:
        fig = qs.plots.distribution(returns, show=False, savefig=None, figsize=(10, 4))
        if fig is not None:
            plots["distribution"] = _fig_to_base64(fig)
    except Exception:
        pass

    # Rolling Sharpe
    try:
        fig = qs.plots.rolling_sharpe(returns, show=False, savefig=None, figsize=(10, 3))
        if fig is not None:
            plots["rollingSharpe"] = _fig_to_base64(fig)
    except Exception:
        pass

    # Rolling Volatility
    try:
        fig = qs.plots.rolling_volatility(returns, show=False, savefig=None, figsize=(10, 3))
        if fig is not None:
            plots["rollingVolatility"] = _fig_to_base64(fig)
    except Exception:
        pass

    # Daily returns
    try:
        fig = qs.plots.daily_returns(returns, show=False, savefig=None, figsize=(10, 3))
        if fig is not None:
            plots["dailyReturns"] = _fig_to_base64(fig)
    except Exception:
        pass

    # Rolling beta vs benchmark
    try:
        if bench_returns is not None and not bench_returns.empty:
            fig = qs.plots.rolling_beta(returns, bench_returns, show=False,
                                        savefig=None, figsize=(10, 3))
            if fig is not None:
                plots["rollingBeta"] = _fig_to_base64(fig)
    except Exception:
        pass

    plt.close("all")

    return {
        "success": True,
        "ticker": ticker,
        "benchmark": benchmark,
        "startDate": start_date,
        "endDate": end_date,
        "metrics": metrics,
        "plots": plots,
    }


# ============================================================================
# 2. QUANT-TRADING STRATEGIES
# ============================================================================

STRATEGY_REGISTRY: Dict[str, Dict[str, Any]] = {
    "macd": {
        "name": "MACD Oscillator",
        "description": "Momentum trading using Moving Average Convergence/Divergence crossover signals.",
        "params": {"shortWindow": 12, "longWindow": 26, "signalWindow": 9},
    },
    "pair_trading": {
        "name": "Pair Trading",
        "description": "Statistical arbitrage using Engle-Granger cointegration between two stocks.",
        "params": {"tickerB": "MSFT", "lookback": 60, "entryZ": 2.0, "exitZ": 0.5},
    },
    "heikin_ashi": {
        "name": "Heikin-Ashi",
        "description": "Japanese candlestick variant that filters noise for cleaner trend signals.",
        "params": {},
    },
    "bollinger_bands": {
        "name": "Bollinger Bands",
        "description": "Mean-reversion & pattern recognition using Bollinger Band width and touch signals.",
        "params": {"period": 20, "stdDev": 2.0},
    },
    "rsi": {
        "name": "RSI Pattern Recognition",
        "description": "Relative Strength Index with overbought/oversold and pattern-based signals.",
        "params": {"period": 14, "overbought": 70, "oversold": 30},
    },
    "parabolic_sar": {
        "name": "Parabolic SAR",
        "description": "Stop-and-reverse trend-following indicator developed by Welles Wilder.",
        "params": {"af": 0.02, "maxAf": 0.2},
    },
    "awesome_oscillator": {
        "name": "Awesome Oscillator",
        "description": "Upgraded MACD using midpoint price instead of close price for momentum signals.",
        "params": {"shortPeriod": 5, "longPeriod": 34},
    },
    "dual_thrust": {
        "name": "Dual Thrust",
        "description": "Opening range breakout strategy using dynamic upper/lower thresholds.",
        "params": {"lookback": 4, "k1": 0.5, "k2": 0.5},
    },
    "shooting_star": {
        "name": "Shooting Star",
        "description": "Bearish candlestick reversal pattern with long upper shadow recognition.",
        "params": {"bodyRatio": 0.3, "shadowRatio": 2.0},
    },
    "options_straddle": {
        "name": "Options Straddle",
        "description": "Long straddle P&L simulation — profits from large moves in either direction.",
        "params": {"strikePrice": 100, "callPremium": 5.0, "putPremium": 4.5, "days": 30},
    },
    "vix_calc": {
        "name": "VIX Calculator",
        "description": "Compute a VIX-like volatility index from historical price data.",
        "params": {"windowDays": 30},
    },
}


def list_strategies() -> List[Dict[str, Any]]:
    """Return the list of available strategies with their default params."""
    return [
        {"id": k, "name": v["name"], "description": v["description"],
         "defaultParams": v["params"]}
        for k, v in STRATEGY_REGISTRY.items()
    ]


def run_quant_strategy(
    strategy: str,
    ticker: str,
    start_date: str = "",
    end_date: str = "",
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Run a selected quant-trading strategy backtest.
    Returns metrics + a base64 chart image.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    if strategy not in STRATEGY_REGISTRY:
        raise ValueError(f"Unknown strategy: {strategy}. Available: {list(STRATEGY_REGISTRY.keys())}")

    meta = STRATEGY_REGISTRY[strategy]
    p = {**meta["params"], **(params or {})}

    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    if not start_date:
        start_date = (datetime.now() - timedelta(days=365 * 2)).strftime("%Y-%m-%d")

    # Dispatch
    handler = _STRATEGY_HANDLERS.get(strategy)
    if handler is None:
        raise ValueError(f"No handler for strategy: {strategy}")

    result = handler(ticker, start_date, end_date, p)
    plt.close("all")
    return {
        "success": True,
        "strategy": strategy,
        "strategyName": meta["name"],
        "ticker": ticker,
        "startDate": start_date,
        "endDate": end_date,
        **result,
    }


# ---------------------------------------------------------------------------
# Strategy Implementations
# ---------------------------------------------------------------------------

def _run_macd(ticker: str, start: str, end: str, p: Dict) -> Dict:
    df = _download_ohlcv(ticker, start, end)
    short_w, long_w, sig_w = int(p["shortWindow"]), int(p["longWindow"]), int(p["signalWindow"])
    df["ema_short"] = df["Close"].ewm(span=short_w, adjust=False).mean()
    df["ema_long"] = df["Close"].ewm(span=long_w, adjust=False).mean()
    df["macd_line"] = df["ema_short"] - df["ema_long"]
    df["signal_line"] = df["macd_line"].ewm(span=sig_w, adjust=False).mean()
    df["histogram"] = df["macd_line"] - df["signal_line"]
    df["signal"] = 0
    df.loc[df["macd_line"] > df["signal_line"], "signal"] = 1
    df.loc[df["macd_line"] < df["signal_line"], "signal"] = -1
    return _backtest_and_plot(df, f"MACD ({short_w}/{long_w}/{sig_w}) — {ticker}")


def _run_pair_trading(ticker: str, start: str, end: str, p: Dict) -> Dict:
    ticker_b = str(p.get("tickerB", "MSFT"))
    lookback = int(p.get("lookback", 60))
    entry_z = float(p.get("entryZ", 2.0))
    exit_z = float(p.get("exitZ", 0.5))
    df_a = _download_ohlcv(ticker, start, end)
    df_b = _download_ohlcv(ticker_b, start, end)
    merged = pd.DataFrame({"A": df_a["Close"], "B": df_b["Close"]}).dropna()
    if len(merged) < lookback:
        raise ValueError(f"Not enough overlapping data ({len(merged)} bars, need {lookback})")
    # Spread = A - hedge_ratio * B
    from numpy.polynomial.polynomial import polyfit
    slope = np.polyfit(merged["B"].values, merged["A"].values, 1)[0]
    merged["spread"] = merged["A"] - slope * merged["B"]
    merged["z_score"] = (merged["spread"] - merged["spread"].rolling(lookback).mean()) / merged["spread"].rolling(lookback).std()
    merged["signal"] = 0
    merged.loc[merged["z_score"] < -entry_z, "signal"] = 1
    merged.loc[merged["z_score"] > entry_z, "signal"] = -1
    merged.loc[merged["z_score"].abs() < exit_z, "signal"] = 0
    merged["Close"] = merged["A"]
    return _backtest_and_plot(merged, f"Pair Trading {ticker}/{ticker_b}")


def _run_heikin_ashi(ticker: str, start: str, end: str, p: Dict) -> Dict:
    df = _download_ohlcv(ticker, start, end)
    ha = pd.DataFrame(index=df.index)
    ha["Close"] = (df["Open"] + df["High"] + df["Low"] + df["Close"]) / 4
    ha["Open"] = (df["Open"].shift(1) + df["Close"].shift(1)) / 2
    ha.iloc[0, ha.columns.get_loc("Open")] = df["Open"].iloc[0]
    ha["High"] = pd.concat([df["High"], ha["Open"], ha["Close"]], axis=1).max(axis=1)
    ha["Low"] = pd.concat([df["Low"], ha["Open"], ha["Close"]], axis=1).min(axis=1)
    ha["signal"] = 0
    bullish = (ha["Close"] > ha["Open"]) & (ha["Low"] == ha["Open"])
    bearish = (ha["Close"] < ha["Open"]) & (ha["High"] == ha["Open"])
    ha.loc[bullish, "signal"] = 1
    ha.loc[bearish, "signal"] = -1
    ha["signal"] = ha["signal"].replace(0, np.nan).ffill().fillna(0)
    return _backtest_and_plot(ha, f"Heikin-Ashi — {ticker}")


def _run_bollinger(ticker: str, start: str, end: str, p: Dict) -> Dict:
    df = _download_ohlcv(ticker, start, end)
    period = int(p.get("period", 20))
    std_dev = float(p.get("stdDev", 2.0))
    df["mid"] = df["Close"].rolling(period).mean()
    df["upper"] = df["mid"] + std_dev * df["Close"].rolling(period).std()
    df["lower"] = df["mid"] - std_dev * df["Close"].rolling(period).std()
    df["signal"] = 0
    df.loc[df["Close"] < df["lower"], "signal"] = 1    # Buy at lower band
    df.loc[df["Close"] > df["upper"], "signal"] = -1   # Sell at upper band
    df["signal"] = df["signal"].replace(0, np.nan).ffill().fillna(0)
    return _backtest_and_plot(df, f"Bollinger Bands ({period}, {std_dev}σ) — {ticker}")


def _run_rsi(ticker: str, start: str, end: str, p: Dict) -> Dict:
    df = _download_ohlcv(ticker, start, end)
    period = int(p.get("period", 14))
    ob = float(p.get("overbought", 70))
    os_ = float(p.get("oversold", 30))
    delta = df["Close"].diff()
    gain = delta.where(delta > 0, 0.0).rolling(period).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    df["rsi"] = 100 - (100 / (1 + rs))
    df["signal"] = 0
    df.loc[df["rsi"] < os_, "signal"] = 1
    df.loc[df["rsi"] > ob, "signal"] = -1
    df["signal"] = df["signal"].replace(0, np.nan).ffill().fillna(0)
    return _backtest_and_plot(df, f"RSI ({period}) — {ticker}")


def _run_parabolic_sar(ticker: str, start: str, end: str, p: Dict) -> Dict:
    df = _download_ohlcv(ticker, start, end)
    af_init = float(p.get("af", 0.02))
    max_af = float(p.get("maxAf", 0.2))
    high, low, close = df["High"].values, df["Low"].values, df["Close"].values
    n = len(close)
    sar = np.zeros(n)
    trend = np.ones(n)  # 1 = up, -1 = down
    af = af_init
    ep = high[0]
    sar[0] = low[0]
    for i in range(1, n):
        sar[i] = sar[i-1] + af * (ep - sar[i-1])
        if trend[i-1] == 1:
            if low[i] < sar[i]:
                trend[i] = -1
                sar[i] = ep
                ep = low[i]
                af = af_init
            else:
                trend[i] = 1
                if high[i] > ep:
                    ep = high[i]
                    af = min(af + af_init, max_af)
        else:
            if high[i] > sar[i]:
                trend[i] = 1
                sar[i] = ep
                ep = high[i]
                af = af_init
            else:
                trend[i] = -1
                if low[i] < ep:
                    ep = low[i]
                    af = min(af + af_init, max_af)
    df["sar"] = sar
    df["signal"] = np.where(trend == 1, 1, -1)
    return _backtest_and_plot(df, f"Parabolic SAR — {ticker}")


def _run_awesome(ticker: str, start: str, end: str, p: Dict) -> Dict:
    df = _download_ohlcv(ticker, start, end)
    sp = int(p.get("shortPeriod", 5))
    lp = int(p.get("longPeriod", 34))
    midpoint = (df["High"] + df["Low"]) / 2
    df["ao"] = midpoint.rolling(sp).mean() - midpoint.rolling(lp).mean()
    df["signal"] = 0
    df.loc[df["ao"] > 0, "signal"] = 1
    df.loc[df["ao"] < 0, "signal"] = -1
    return _backtest_and_plot(df, f"Awesome Oscillator ({sp}/{lp}) — {ticker}")


def _run_dual_thrust(ticker: str, start: str, end: str, p: Dict) -> Dict:
    df = _download_ohlcv(ticker, start, end)
    lb = int(p.get("lookback", 4))
    k1 = float(p.get("k1", 0.5))
    k2 = float(p.get("k2", 0.5))
    hh = df["High"].rolling(lb).max()
    lc = df["Close"].rolling(lb).min()
    hc = df["Close"].rolling(lb).max()
    ll = df["Low"].rolling(lb).min()
    rng = pd.concat([hh - lc, hc - ll], axis=1).max(axis=1)
    df["upper"] = df["Open"] + k1 * rng
    df["lower"] = df["Open"] - k2 * rng
    df["signal"] = 0
    df.loc[df["Close"] > df["upper"], "signal"] = 1
    df.loc[df["Close"] < df["lower"], "signal"] = -1
    df["signal"] = df["signal"].replace(0, np.nan).ffill().fillna(0)
    return _backtest_and_plot(df, f"Dual Thrust — {ticker}")


def _run_shooting_star(ticker: str, start: str, end: str, p: Dict) -> Dict:
    df = _download_ohlcv(ticker, start, end)
    body_ratio = float(p.get("bodyRatio", 0.3))
    shadow_ratio = float(p.get("shadowRatio", 2.0))
    body = (df["Close"] - df["Open"]).abs()
    full_range = df["High"] - df["Low"]
    upper_shadow = df["High"] - pd.concat([df["Close"], df["Open"]], axis=1).max(axis=1)
    is_star = (
        (body / full_range.replace(0, np.nan) < body_ratio) &
        (upper_shadow / body.replace(0, np.nan) > shadow_ratio) &
        (df["Close"] < df["Open"])  # bearish body
    )
    hammer = (
        (body / full_range.replace(0, np.nan) < body_ratio) &
        ((df["Low"] - pd.concat([df["Close"], df["Open"]], axis=1).min(axis=1).abs()) / body.replace(0, np.nan) > shadow_ratio) &
        (df["Close"] > df["Open"])
    )
    df["signal"] = 0
    df.loc[is_star, "signal"] = -1
    df.loc[hammer, "signal"] = 1
    df["signal"] = df["signal"].replace(0, np.nan).ffill().fillna(0)
    return _backtest_and_plot(df, f"Shooting Star — {ticker}")


def _run_options_straddle(ticker: str, start: str, end: str, p: Dict) -> Dict:
    """Simulate straddle P&L across a price range."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    strike = float(p.get("strikePrice", 100))
    call_prem = float(p.get("callPremium", 5.0))
    put_prem = float(p.get("putPremium", 4.5))
    total_prem = call_prem + put_prem

    prices = np.linspace(strike * 0.7, strike * 1.3, 200)
    call_payoff = np.maximum(prices - strike, 0) - call_prem
    put_payoff = np.maximum(strike - prices, 0) - put_prem
    straddle_pnl = call_payoff + put_payoff

    break_lower = strike - total_prem
    break_upper = strike + total_prem

    fig, ax = plt.subplots(figsize=(10, 5), facecolor="#1e1e1e")
    ax.set_facecolor("#1e1e1e")
    ax.plot(prices, straddle_pnl, color="#7c3aed", linewidth=2, label="Straddle P&L")
    ax.axhline(0, color="white", linewidth=0.5, alpha=0.3)
    ax.axvline(strike, color="#facc15", linewidth=1, linestyle="--", alpha=0.5, label=f"Strike: {strike}")
    ax.fill_between(prices, straddle_pnl, 0, where=straddle_pnl > 0, alpha=0.2, color="#22c55e")
    ax.fill_between(prices, straddle_pnl, 0, where=straddle_pnl < 0, alpha=0.2, color="#ef4444")
    ax.set_title(f"Options Straddle Payoff — Strike ${strike}", color="white", fontsize=13)
    ax.set_xlabel("Underlying Price", color="white")
    ax.set_ylabel("P&L ($)", color="white")
    ax.tick_params(colors="white")
    ax.legend(facecolor="#2d2d2d", edgecolor="white", labelcolor="white")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    for spine in ax.spines.values():
        spine.set_color("#444")

    plot_b64 = _fig_to_base64(fig)

    return {
        "metrics": {
            "strikePrice": strike,
            "totalPremium": round(total_prem, 2),
            "maxLoss": round(-total_prem, 2),
            "breakEvenLower": round(break_lower, 2),
            "breakEvenUpper": round(break_upper, 2),
            "maxProfitPotential": "Unlimited (upside)",
        },
        "plotImage": plot_b64,
    }


def _run_vix_calc(ticker: str, start: str, end: str, p: Dict) -> Dict:
    """Compute a VIX-like realized volatility index."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    window = int(p.get("windowDays", 30))
    df = _download_ohlcv(ticker, start, end)
    log_ret = np.log(df["Close"] / df["Close"].shift(1))
    df["realized_vol"] = log_ret.rolling(window).std() * np.sqrt(252) * 100
    df.dropna(inplace=True)

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 6), facecolor="#1e1e1e",
                                    gridspec_kw={"height_ratios": [2, 1]})
    for ax in (ax1, ax2):
        ax.set_facecolor("#1e1e1e")
        ax.tick_params(colors="white")
        for spine in ax.spines.values():
            spine.set_color("#444")

    ax1.plot(df.index, df["Close"], color="#60a5fa", linewidth=1)
    ax1.set_title(f"{ticker} Price", color="white", fontsize=12)
    ax1.set_ylabel("Price", color="white")

    ax2.plot(df.index, df["realized_vol"], color="#f97316", linewidth=1)
    ax2.axhline(df["realized_vol"].mean(), color="#facc15", linewidth=0.8, linestyle="--", alpha=0.6)
    ax2.set_title(f"Realized Volatility ({window}d annualized)", color="white", fontsize=12)
    ax2.set_ylabel("Vol %", color="white")

    fig.tight_layout()
    plot_b64 = _fig_to_base64(fig)

    return {
        "metrics": {
            "currentVol": _safe_float(df["realized_vol"].iloc[-1]),
            "avgVol": _safe_float(df["realized_vol"].mean()),
            "maxVol": _safe_float(df["realized_vol"].max()),
            "minVol": _safe_float(df["realized_vol"].min()),
            "windowDays": window,
        },
        "plotImage": plot_b64,
    }


# ---------------------------------------------------------------------------
# Generic vectorized backtest + plot helper
# ---------------------------------------------------------------------------

def _backtest_and_plot(df: pd.DataFrame, title: str) -> Dict:
    """
    Given a DataFrame with 'Close' and 'signal' columns, run a simple
    long/short backtest and produce a chart + metrics.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    df = df.copy()
    df.dropna(subset=["Close"], inplace=True)
    if "signal" not in df.columns:
        df["signal"] = 0

    df["returns"] = df["Close"].pct_change()
    df["strategy_returns"] = df["signal"].shift(1) * df["returns"]
    df["cumulative_market"] = (1 + df["returns"]).cumprod()
    df["cumulative_strategy"] = (1 + df["strategy_returns"]).cumprod()
    df.dropna(inplace=True)

    # Metrics
    total_return = (df["cumulative_strategy"].iloc[-1] - 1) * 100 if len(df) > 0 else 0
    market_return = (df["cumulative_market"].iloc[-1] - 1) * 100 if len(df) > 0 else 0
    strat_ret = df["strategy_returns"]
    sharpe = (strat_ret.mean() / strat_ret.std() * np.sqrt(252)) if strat_ret.std() != 0 else 0
    downside = strat_ret[strat_ret < 0].std()
    sortino = (strat_ret.mean() / downside * np.sqrt(252)) if downside and downside != 0 else 0
    equity = df["cumulative_strategy"]
    peaks = equity.cummax()
    drawdowns = (peaks - equity) / peaks
    max_dd = drawdowns.max() * 100
    win_rate = (strat_ret > 0).sum() / max(1, (strat_ret != 0).sum()) * 100
    num_trades = (df["signal"].diff().abs() > 0).sum()

    metrics = {
        "totalReturn": round(float(total_return), 2),
        "marketReturn": round(float(market_return), 2),
        "sharpe": round(float(sharpe), 3),
        "sortino": round(float(sortino), 3),
        "maxDrawdown": round(float(max_dd), 2),
        "winRate": round(float(win_rate), 1),
        "numTrades": int(num_trades),
        "numBars": len(df),
    }

    # Plot
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 6), facecolor="#1e1e1e",
                                    gridspec_kw={"height_ratios": [2, 1]})
    for ax in (ax1, ax2):
        ax.set_facecolor("#1e1e1e")
        ax.tick_params(colors="white")
        for spine in ax.spines.values():
            spine.set_color("#444")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)

    ax1.plot(df.index, df["cumulative_strategy"], color="#7c3aed", linewidth=1.5, label="Strategy")
    ax1.plot(df.index, df["cumulative_market"], color="#60a5fa", linewidth=1, alpha=0.6, label="Buy & Hold")
    ax1.set_title(title, color="white", fontsize=13, fontweight="bold")
    ax1.set_ylabel("Cumulative Return", color="white")
    ax1.legend(facecolor="#2d2d2d", edgecolor="#444", labelcolor="white", fontsize=8)

    colors = df["signal"].map({1: "#22c55e", -1: "#ef4444", 0: "#666"}).fillna("#666")
    ax2.bar(df.index, df["signal"], color=colors.values, width=1, alpha=0.7)
    ax2.set_ylabel("Signal", color="white")
    ax2.set_yticks([-1, 0, 1])
    ax2.set_yticklabels(["Short", "Flat", "Long"], fontsize=8)

    fig.tight_layout()
    plot_b64 = _fig_to_base64(fig)

    return {
        "metrics": metrics,
        "plotImage": plot_b64,
    }


# Map strategy IDs to handler functions
_STRATEGY_HANDLERS = {
    "macd": _run_macd,
    "pair_trading": _run_pair_trading,
    "heikin_ashi": _run_heikin_ashi,
    "bollinger_bands": _run_bollinger,
    "rsi": _run_rsi,
    "parabolic_sar": _run_parabolic_sar,
    "awesome_oscillator": _run_awesome,
    "dual_thrust": _run_dual_thrust,
    "shooting_star": _run_shooting_star,
    "options_straddle": _run_options_straddle,
    "vix_calc": _run_vix_calc,
}
