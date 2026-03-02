"""
Quant Tools — QuantStats portfolio analytics & quant-trading strategy backtests.

Faithfully ported from:
  - quantstats (pip package): portfolio analytics
  - je-suis-tm/quant-trading (GitHub): 11 strategy scripts

Each strategy preserves the original algorithm logic and produces multi-panel
matplotlib plots matching the original repo's style, returned as base64 PNGs.
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
    fig.savefig(buf, format="png", dpi=120, bbox_inches="tight",
                facecolor=fig.get_facecolor(), edgecolor="none")
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
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    return df


def _safe_float(v) -> Optional[float]:
    if v is None:
        return None
    try:
        f = float(v)
        return None if np.isnan(f) or np.isinf(f) else round(f, 6)
    except (TypeError, ValueError):
        return None


def _mdd(series) -> float:
    """Maximum drawdown — ported from Heikin-Ashi backtest.py stats module."""
    minimum = 0
    arr = series.values if hasattr(series, 'values') else list(series)
    for i in range(1, len(arr)):
        dd = arr[i] / max(arr[:i]) - 1
        if minimum > dd:
            minimum = dd
    return minimum


def _portfolio_stats(df: pd.DataFrame, capital0: float = 10000, positions_count: int = 100) -> Dict:
    """
    Portfolio stats matching Heikin-Ashi backtest stats() function.
    Expects df with 'Close' and 'signals' columns.
    """
    df = df.copy()
    df['cumsum'] = df['signals'].cumsum()
    holdings = df['cumsum'] * df['Close'] * positions_count
    cash = capital0 - (df['signals'] * df['Close'] * positions_count).cumsum()
    total_asset = holdings + cash
    ret = total_asset.pct_change().fillna(0)

    growth_rate = (float(total_asset.iloc[-1] / capital0)) ** (1 / max(len(df), 1)) - 1
    std = float(np.sqrt(((ret - growth_rate) ** 2).sum() / max(len(df), 1)))
    max_dd = _mdd(total_asset)
    sharpe = growth_rate / max(std, 1e-9)
    portfolio_return = float(total_asset.iloc[-1] / capital0 - 1)
    num_longs = int((df['signals'] == 1).sum())
    num_shorts = int((df['signals'] < 0).sum())
    num_trades = num_longs + num_shorts

    return {
        "portfolioReturn": round(portfolio_return * 100, 2),
        "cagr": round(growth_rate * 100, 4),
        "sharpe": round(sharpe, 4),
        "maxDrawdown": round(max_dd * 100, 2),
        "numLongs": num_longs,
        "numShorts": num_shorts,
        "numTrades": num_trades,
        "finalAsset": round(float(total_asset.iloc[-1]), 2),
        "numBars": len(df),
    }


# ============================================================================
# 1. QUANTSTATS REPORT
# ============================================================================

def run_quantstats_report(
    ticker: str,
    benchmark: str = "SPY",
    start_date: str = "",
    end_date: str = "",
) -> Dict[str, Any]:
    import quantstats as qs
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    if not start_date:
        start_date = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

    # Use yfinance directly — qs.utils.download_returns only supports period strings
    import yfinance as yf
    stock = yf.download(ticker, start=start_date, end=end_date, progress=False, auto_adjust=True)
    if stock.empty:
        raise ValueError(f"Could not fetch returns for {ticker}")
    close = stock['Close']
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
    returns = close.pct_change().dropna()
    returns.name = ticker

    bench_data = yf.download(benchmark, start=start_date, end=end_date, progress=False, auto_adjust=True)
    bench_returns = None
    if not bench_data.empty:
        bc = bench_data['Close']
        if isinstance(bc, pd.DataFrame):
            bc = bc.iloc[:, 0]
        bench_returns = bc.pct_change().dropna()
        bench_returns.name = benchmark

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
        pass

    plots: Dict[str, str] = {}

    for plot_name, plot_fn, kwargs in [
        ("snapshot", qs.plots.snapshot, {"title": f"{ticker} Performance", "show": False, "savefig": None, "figsize": (10, 8)}),
        ("drawdown", qs.plots.drawdown, {"show": False, "savefig": None, "figsize": (10, 4)}),
        ("monthlyHeatmap", qs.plots.monthly_heatmap, {"show": False, "savefig": None, "figsize": (10, 5)}),
        ("distribution", qs.plots.distribution, {"show": False, "savefig": None, "figsize": (10, 4)}),
        ("rollingSharpe", qs.plots.rolling_sharpe, {"show": False, "savefig": None, "figsize": (10, 3)}),
        ("rollingVolatility", qs.plots.rolling_volatility, {"show": False, "savefig": None, "figsize": (10, 3)}),
        ("dailyReturns", qs.plots.daily_returns, {"show": False, "savefig": None, "figsize": (10, 3)}),
    ]:
        try:
            fig = plot_fn(returns, **kwargs)
            if fig is not None:
                plots[plot_name] = _fig_to_base64(fig)
        except Exception:
            pass

    try:
        if bench_returns is not None and not bench_returns.empty:
            fig = qs.plots.rolling_beta(returns, bench_returns, show=False, savefig=None, figsize=(10, 3))
            if fig is not None:
                plots["rollingBeta"] = _fig_to_base64(fig)
    except Exception:
        pass

    plt.close("all")

    return {
        "success": True, "ticker": ticker, "benchmark": benchmark,
        "startDate": start_date, "endDate": end_date,
        "metrics": metrics, "plots": plots,
    }


# ============================================================================
# 2. QUANT-TRADING STRATEGIES
# ============================================================================

STRATEGY_REGISTRY: Dict[str, Dict[str, Any]] = {
    "macd": {
        "name": "MACD Oscillator",
        "description": "Moving Average Convergence/Diverge oscillator — long when short MA > long MA. Uses SMA as in original repo.",
        "params": {"shortWindow": 12, "longWindow": 26},
    },
    "pair_trading": {
        "name": "Pair Trading (Engle-Granger)",
        "description": "Cointegration-based statistical arbitrage using Engle-Granger two-step method with rolling OLS.",
        "params": {"tickerB": "MSFT", "bandwidth": 250},
    },
    "heikin_ashi": {
        "name": "Heikin-Ashi",
        "description": "Japanese candlestick noise filter with marubozu-like trigger conditions and stop-loss position limits.",
        "params": {"stopLossLimit": 3},
    },
    "bollinger_bands": {
        "name": "Bollinger Bands",
        "description": "Mean-reversion with Bollinger Bands — buy at lower band touch, sell at upper band touch with 20-period SMA ± 2σ.",
        "params": {"period": 20, "stdDev": 2.0},
    },
    "rsi": {
        "name": "RSI Overbought/Oversold",
        "description": "RSI with Smoothed Moving Average (SMMA) — short above 70, long below 30. Original Wilder method.",
        "params": {"period": 14, "overbought": 70, "oversold": 30},
    },
    "parabolic_sar": {
        "name": "Parabolic SAR",
        "description": "Stop-and-reverse using Welles Wilder's parabolic SAR with acceleration factor tracking. Exact original algo.",
        "params": {"initialAF": 0.02, "stepAF": 0.02, "endAF": 0.2},
    },
    "awesome_oscillator": {
        "name": "Awesome Oscillator",
        "description": "SMA of midpoint price (H+L)/2 with saucer signal generation — upgraded MACD comparison.",
        "params": {"shortPeriod": 5, "longPeriod": 34},
    },
    "dual_thrust": {
        "name": "Dual Thrust",
        "description": "Opening range breakout using dynamic upper/lower thresholds based on prior day range.",
        "params": {"lookback": 5, "k1": 0.5, "k2": 0.5},
    },
    "shooting_star": {
        "name": "Shooting Star",
        "description": "Bearish reversal candlestick with 8 conditions — small body, long upper wick, uptrend confirmation.",
        "params": {"lowerBound": 0.2, "bodySize": 0.5, "stopThreshold": 0.05, "holdingPeriod": 7},
    },
    "options_straddle": {
        "name": "Options Straddle",
        "description": "Long straddle P&L payoff diagram — buy call + put at same strike price.",
        "params": {"strikePrice": 100, "callPremium": 5.0, "putPremium": 4.5},
    },
    "vix_calc": {
        "name": "VIX Calculator (Realized Vol)",
        "description": "Compute realized volatility from historical prices — annualized rolling standard deviation of log returns.",
        "params": {"windowDays": 30},
    },
}


def list_strategies() -> List[Dict[str, Any]]:
    return [
        {"id": k, "name": v["name"], "description": v["description"],
         "defaultParams": v["params"]}
        for k, v in STRATEGY_REGISTRY.items()
    ]


def run_quant_strategy(
    strategy: str, ticker: str, start_date: str = "", end_date: str = "",
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    if strategy not in STRATEGY_REGISTRY:
        raise ValueError(f"Unknown strategy: {strategy}")

    meta = STRATEGY_REGISTRY[strategy]
    p = {**meta["params"], **(params or {})}

    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    if not start_date:
        start_date = (datetime.now() - timedelta(days=365 * 2)).strftime("%Y-%m-%d")

    handler = _STRATEGY_HANDLERS.get(strategy)
    if handler is None:
        raise ValueError(f"No handler for strategy: {strategy}")

    result = handler(ticker, start_date, end_date, p)
    plt.close("all")
    return {
        "success": True, "strategy": strategy, "strategyName": meta["name"],
        "ticker": ticker, "startDate": start_date, "endDate": end_date,
        **result,
    }


# ---------------------------------------------------------------------------
# Strategy Implementations — faithful to je-suis-tm/quant-trading
# ---------------------------------------------------------------------------

def _run_macd(ticker: str, start: str, end: str, p: Dict) -> Dict:
    """
    Ported from MACD Oscillator backtest.py
    Uses SMA (rolling mean), not EMA. Positions via np.where, signals via diff().
    Two-panel plot: (1) Close + markers, (2) Oscillator bar + MAs.
    """
    import matplotlib.pyplot as plt

    ma1 = int(p.get("shortWindow", 12))
    ma2 = int(p.get("longWindow", 26))
    df = _download_ohlcv(ticker, start, end)

    # SMA as in original
    df['ma1'] = df['Close'].rolling(window=ma1, min_periods=1, center=False).mean()
    df['ma2'] = df['Close'].rolling(window=ma2, min_periods=1, center=False).mean()

    df['positions'] = 0
    df.loc[df.index[ma1:], 'positions'] = np.where(df['ma1'].iloc[ma1:] >= df['ma2'].iloc[ma1:], 1, 0)
    df['signals'] = df['positions'].diff()
    df['oscillator'] = df['ma1'] - df['ma2']

    # Two-panel plot matching original
    fig = plt.figure(figsize=(10, 8))

    # Panel 1: Close price with LONG/SHORT markers
    ax = fig.add_subplot(211)
    ax.plot(df.index, df['Close'], label=ticker)
    ax.plot(df.loc[df['signals'] == 1].index, df['Close'][df['signals'] == 1],
            label='LONG', lw=0, marker='^', c='g', markersize=8)
    ax.plot(df.loc[df['signals'] == -1].index, df['Close'][df['signals'] == -1],
            label='SHORT', lw=0, marker='v', c='r', markersize=8)
    ax.legend(loc='best')
    ax.grid(True)
    ax.set_title('Positions')

    # Panel 2: Oscillator bar chart + MAs
    bx = fig.add_subplot(212)
    colors = np.where(df['oscillator'] >= 0, 'g', 'r')
    bx.bar(range(len(df)), df['oscillator'].values, color=colors, width=1)
    bx.set_title('MACD Oscillator')
    bx.grid(True)
    bx.set_xticks([])

    fig.tight_layout()
    plot_b64 = _fig_to_base64(fig)
    metrics = _portfolio_stats(df)
    return {"metrics": metrics, "plotImage": plot_b64}


def _run_pair_trading(ticker: str, start: str, end: str, p: Dict) -> Dict:
    """
    Ported from Pair trading backtest.py
    Uses Engle-Granger two-step cointegration with rolling bandwidth.
    Two-panel plot: (1) Both assets + markers, (2) Total asset + Z-stats.
    """
    import matplotlib.pyplot as plt
    import statsmodels.api as sm
    from statsmodels.tsa.stattools import adfuller

    ticker_b = str(p.get("tickerB", "MSFT"))
    bandwidth = int(p.get("bandwidth", 250))

    df_a = _download_ohlcv(ticker, start, end)
    df_b = _download_ohlcv(ticker_b, start, end)

    signals = pd.DataFrame()
    signals['asset1'] = df_a['Close']
    signals['asset2'] = df_b['Close']
    merged = signals.dropna()

    if len(merged) < bandwidth + 10:
        raise ValueError(f"Not enough overlapping data ({len(merged)} bars, need {bandwidth}+)")

    signals = merged.copy()
    signals['signals1'] = 0
    signals['signals2'] = 0
    signals['z'] = np.nan
    signals['z upper limit'] = np.nan
    signals['z lower limit'] = np.nan

    # Engle-Granger rolling — simplified version of the original loop
    prev_status = False
    for i in range(bandwidth, len(signals)):
        X = signals['asset1'].iloc[i - bandwidth:i]
        Y = signals['asset2'].iloc[i - bandwidth:i]

        model = sm.OLS(Y, sm.add_constant(X)).fit()
        epsilon = model.resid
        adf_pval = adfuller(epsilon)[1]
        coint_status = adf_pval <= 0.05

        if prev_status and not coint_status:
            if signals['signals1'].iloc[i - 1] != 0:
                signals.iloc[i, signals.columns.get_loc('signals1')] = 0

        if coint_status:
            x_val = pd.DataFrame({'const': [1.0], 'asset1': [signals['asset1'].iloc[i]]})
            fitted_val = model.predict(x_val).iloc[0]
            resid = signals['asset2'].iloc[i] - fitted_val
            z = (resid - np.mean(epsilon)) / np.std(epsilon)
            signals.iloc[i, signals.columns.get_loc('z')] = z
            z_upper = z + np.std(epsilon)
            z_lower = z - np.std(epsilon)
            signals.iloc[i, signals.columns.get_loc('z upper limit')] = z_upper
            signals.iloc[i, signals.columns.get_loc('z lower limit')] = z_lower

            if z > z_upper:
                signals.iloc[i, signals.columns.get_loc('signals1')] = 1
            elif z < z_lower:
                signals.iloc[i, signals.columns.get_loc('signals1')] = -1

        prev_status = coint_status

    signals['positions1'] = signals['signals1'].diff()
    signals['signals2'] = -signals['signals1']
    signals['positions2'] = signals['signals2'].diff()

    # Plot: two assets with positions
    ind = signals['z'].dropna().index
    if len(ind) == 0:
        raise ValueError("No cointegration detected in the data range")
    plot_data = signals.loc[ind[0]:]

    fig = plt.figure(figsize=(10, 10))
    ax = fig.add_subplot(211)
    ax2 = ax.twinx()
    ax.plot(plot_data.index, plot_data['asset1'], c='#113aac', alpha=0.7, label=ticker)
    ax2.plot(plot_data.index, plot_data['asset2'], c='#907163', alpha=0.7, label=ticker_b)
    ax.plot(plot_data.loc[plot_data['positions1'] == 1].index,
            plot_data['asset1'][plot_data['positions1'] == 1],
            lw=0, marker='^', markersize=8, c='g', alpha=0.7)
    ax.plot(plot_data.loc[plot_data['positions1'] == -1].index,
            plot_data['asset1'][plot_data['positions1'] == -1],
            lw=0, marker='v', markersize=8, c='r', alpha=0.7)
    ax.set_ylabel(ticker)
    ax2.set_ylabel(ticker_b, rotation=270, labelpad=15)
    ax.set_title('Pair Trading Positions')
    ax.grid(True)
    ax.legend(loc='upper left')
    ax2.legend(loc='upper right')

    # Panel 2: Z-stats and total asset
    bx = fig.add_subplot(212)
    bx2 = bx.twinx()
    z_valid = plot_data['z'].dropna()
    if len(z_valid) > 0:
        bx2.plot(z_valid.index, z_valid, c='#4f4a41', alpha=0.3, label='Z Statistics')
        bx2.fill_between(plot_data.index,
                         plot_data['z upper limit'].fillna(method='ffill'),
                         plot_data['z lower limit'].fillna(method='ffill'),
                         alpha=0.2, color='#ffb48f')
    bx.plot(plot_data.index, plot_data['asset1'], c='#46344e', label='Asset Performance')
    bx.set_ylabel('Price')
    bx2.set_ylabel('Z Statistics', rotation=270, labelpad=15)
    bx.set_title('Z-Score Band')
    bx.grid(True)
    bx.legend(loc='upper left')

    fig.tight_layout()
    plot_b64 = _fig_to_base64(fig)

    # Simplified metrics
    signals['Close'] = signals['asset1']
    signals['signals'] = signals['signals1']
    metrics = _portfolio_stats(signals)
    return {"metrics": metrics, "plotImage": plot_b64}


def _run_heikin_ashi(ticker: str, start: str, end: str, p: Dict) -> Dict:
    """
    Ported from Heikin-Ashi backtest.py
    Computes HA OHLC, generates signals with marubozu rules + stop loss limit.
    Two-panel plot: (1) Close + markers, (2) Total asset performance.
    """
    import matplotlib.pyplot as plt

    stls = int(p.get("stopLossLimit", 3))
    df = _download_ohlcv(ticker, start, end)
    df.reset_index(inplace=True)

    # Heikin-Ashi computation — exact original
    df['HA close'] = (df['Open'] + df['Close'] + df['High'] + df['Low']) / 4
    df['HA open'] = float(0)
    df.at[0, 'HA open'] = df['Open'].iloc[0]
    for n in range(1, len(df)):
        df.at[n, 'HA open'] = (df['HA open'].iloc[n - 1] + df['HA close'].iloc[n - 1]) / 2

    temp = pd.concat([df['HA open'], df['HA close'], df['Low'], df['High']], axis=1)
    df['HA high'] = temp.max(axis=1)
    df['HA low'] = temp.min(axis=1)

    # Signal generation — exact original rules
    df['signals'] = 0
    df['cumsum'] = 0

    for n in range(1, len(df)):
        # Long trigger — bearish HA bar bigger than previous, previous also bearish
        if (df['HA open'].iloc[n] > df['HA close'].iloc[n] and
                df['HA open'].iloc[n] == df['HA high'].iloc[n] and
                np.abs(df['HA open'].iloc[n] - df['HA close'].iloc[n]) >
                np.abs(df['HA open'].iloc[n - 1] - df['HA close'].iloc[n - 1]) and
                df['HA open'].iloc[n - 1] > df['HA close'].iloc[n - 1]):
            df.at[n, 'signals'] = 1
            df['cumsum'] = df['signals'].cumsum()
            if df['cumsum'].iloc[n] > stls:
                df.at[n, 'signals'] = 0

        # Exit — bullish HA bar, HA open == HA low, previous bullish
        elif (df['HA open'].iloc[n] < df['HA close'].iloc[n] and
              df['HA open'].iloc[n] == df['HA low'].iloc[n] and
              df['HA open'].iloc[n - 1] < df['HA close'].iloc[n - 1]):
            df.at[n, 'signals'] = -1
            df['cumsum'] = df['signals'].cumsum()
            if df['cumsum'].iloc[n] > 0:
                df.at[n, 'signals'] = -1 * (df['cumsum'].iloc[n - 1])
            if df['cumsum'].iloc[n] < 0:
                df.at[n, 'signals'] = 0

    df.set_index('Date', inplace=True)

    # Plot: price with signals + total asset
    fig = plt.figure(figsize=(10, 8))
    ax = fig.add_subplot(211)
    ax.plot(df.index, df['Close'], label=ticker)
    ax.plot(df.loc[df['signals'] == 1].index, df['Close'][df['signals'] == 1],
            marker='^', lw=0, c='g', label='long', markersize=8)
    ax.plot(df.loc[df['signals'] < 0].index, df['Close'][df['signals'] < 0],
            marker='v', lw=0, c='r', label='short', markersize=8)
    ax.legend(loc='best')
    ax.grid(True)
    ax.set_title('Heikin-Ashi Positions')

    # Portfolio performance
    capital0 = 10000
    positions = 100
    df['cumsum'] = df['signals'].cumsum()
    holdings = df['cumsum'] * df['Close'] * positions
    cash = capital0 - (df['signals'] * df['Close'] * positions).cumsum()
    total_asset = holdings + cash

    bx = fig.add_subplot(212)
    bx.plot(total_asset.index, total_asset, label='Total Asset')
    bx.plot(df.loc[df['signals'] == 1].index, total_asset[df['signals'] == 1],
            lw=0, marker='^', c='g', label='long', markersize=8)
    bx.plot(df.loc[df['signals'] < 0].index, total_asset[df['signals'] < 0],
            lw=0, marker='v', c='r', label='short', markersize=8)
    bx.legend(loc='best')
    bx.grid(True)
    bx.set_xlabel('Date')
    bx.set_ylabel('Asset Value')
    bx.set_title('Total Asset')

    fig.tight_layout()
    plot_b64 = _fig_to_base64(fig)
    metrics = _portfolio_stats(df)
    return {"metrics": metrics, "plotImage": plot_b64}


def _run_bollinger(ticker: str, start: str, end: str, p: Dict) -> Dict:
    """
    Ported from Bollinger Bands Pattern Recognition backtest.py
    Uses SMA + 2σ bands, plots price with band fill and long/short markers.
    """
    import matplotlib.pyplot as plt

    period = int(p.get("period", 20))
    std_dev = float(p.get("stdDev", 2.0))
    df = _download_ohlcv(ticker, start, end)

    df['std'] = df['Close'].rolling(window=period, min_periods=period).std()
    df['mid band'] = df['Close'].rolling(window=period, min_periods=period).mean()
    df['upper band'] = df['mid band'] + std_dev * df['std']
    df['lower band'] = df['mid band'] - std_dev * df['std']

    # Signal: buy near lower band, sell near upper
    df['signals'] = 0
    df['positions'] = 0
    df.loc[df['Close'] <= df['lower band'], 'positions'] = 1
    df.loc[df['Close'] >= df['upper band'], 'positions'] = -1
    df['signals'] = df['positions'].diff()

    # Plot — matching original style
    fig = plt.figure(figsize=(10, 5))
    ax = fig.add_subplot(111)
    ax.plot(df.index, df['Close'], label='price')
    ax.fill_between(df.index, df['lower band'], df['upper band'], alpha=0.2, color='#45ADA8')
    ax.plot(df.index, df['mid band'], linestyle='--', label='moving average', c='#132226')
    ax.plot(df.loc[df['signals'] == 1].index, df['Close'][df['signals'] == 1],
            marker='^', markersize=10, lw=0, c='g', label='LONG')
    ax.plot(df.loc[df['signals'] == -1].index, df['Close'][df['signals'] == -1],
            marker='v', markersize=10, lw=0, c='r', label='SHORT')
    ax.legend(loc='best')
    ax.set_title('Bollinger Bands Pattern Recognition')
    ax.set_ylabel('price')
    ax.grid(True)

    fig.tight_layout()
    plot_b64 = _fig_to_base64(fig)
    metrics = _portfolio_stats(df)
    return {"metrics": metrics, "plotImage": plot_b64}


def _smma(series, n):
    """Smoothed moving average — ported from RSI Pattern Recognition backtest.py"""
    output = [series[0]]
    for i in range(1, len(series)):
        temp = output[-1] * (n - 1) + series[i]
        output.append(temp / n)
    return output


def _run_rsi(ticker: str, start: str, end: str, p: Dict) -> Dict:
    """
    Ported from RSI Pattern Recognition backtest.py
    Uses Smoothed Moving Average (SMMA) — the authentic Wilder method.
    Two-panel plot: (1) Close + markers, (2) RSI with overbought/oversold fill.
    """
    import matplotlib.pyplot as plt

    n = int(p.get("period", 14))
    ob = float(p.get("overbought", 70))
    os_ = float(p.get("oversold", 30))
    df = _download_ohlcv(ticker, start, end)

    # RSI with SMMA — exact original
    delta = df['Close'].diff().dropna()
    up = np.where(delta > 0, delta, 0)
    down = np.where(delta < 0, -delta, 0)
    rs = np.divide(_smma(up, n), np.array(_smma(down, n)) + 1e-15)
    rsi_vals = 100 - 100 / (1 + rs)

    df['rsi'] = 0.0
    df.loc[df.index[n:], 'rsi'] = rsi_vals[n - 1:]
    df['positions'] = np.select([df['rsi'] < os_, df['rsi'] > ob], [1, -1], default=0)
    df['signals'] = df['positions'].diff()
    df = df.iloc[n:]

    # Two-panel plot matching original
    fig = plt.figure(figsize=(10, 10))
    ax = fig.add_subplot(211)
    ax.plot(df.index, df['Close'], label=ticker)
    ax.plot(df.loc[df['signals'] == 1].index, df['Close'][df['signals'] == 1],
            label='LONG', lw=0, marker='^', c='g', markersize=8)
    ax.plot(df.loc[df['signals'] == -1].index, df['Close'][df['signals'] == -1],
            label='SHORT', lw=0, marker='v', c='r', markersize=8)
    ax.legend(loc='best')
    ax.grid(True)
    ax.set_title('Positions')
    ax.set_ylabel('price')

    bx = fig.add_subplot(212)
    bx.plot(df.index, df['rsi'], label='relative strength index', c='#522e75')
    bx.fill_between(df.index, os_, ob, alpha=0.5, color='#f22f08')
    bx.set_title('RSI')
    bx.set_xlabel('Date')
    bx.set_ylabel('value')
    bx.legend(loc='best')
    bx.grid(True)

    fig.tight_layout()
    plot_b64 = _fig_to_base64(fig)
    metrics = _portfolio_stats(df)
    return {"metrics": metrics, "plotImage": plot_b64}


def _run_parabolic_sar(ticker: str, start: str, end: str, p: Dict) -> Dict:
    """
    Ported from Parabolic SAR backtest.py — exact iterative SAR calculation.
    """
    import matplotlib.pyplot as plt

    initial_af = float(p.get("initialAF", 0.02))
    step_af = float(p.get("stepAF", 0.02))
    end_af = float(p.get("endAF", 0.2))
    df = _download_ohlcv(ticker, start, end)
    df.reset_index(inplace=True)

    n = len(df)
    df['trend'] = 0
    df['sar'] = 0.0
    df['real sar'] = 0.0
    df['ep'] = 0.0
    df['af'] = 0.0

    # Initial values
    df.at[1, 'trend'] = 1 if df['Close'].iloc[1] > df['Close'].iloc[0] else -1
    df.at[1, 'sar'] = df['High'].iloc[0] if df['trend'].iloc[1] > 0 else df['Low'].iloc[0]
    df.at[1, 'real sar'] = df['sar'].iloc[1]
    df.at[1, 'ep'] = df['High'].iloc[1] if df['trend'].iloc[1] > 0 else df['Low'].iloc[1]
    df.at[1, 'af'] = initial_af

    # Exact original calculation loop
    for i in range(2, n):
        temp = df['sar'].iloc[i - 1] + df['af'].iloc[i - 1] * (df['ep'].iloc[i - 1] - df['sar'].iloc[i - 1])
        if df['trend'].iloc[i - 1] < 0:
            df.at[i, 'sar'] = max(temp, df['High'].iloc[i - 1], df['High'].iloc[i - 2])
            temp = 1 if df['sar'].iloc[i] < df['High'].iloc[i] else df['trend'].iloc[i - 1] - 1
        else:
            df.at[i, 'sar'] = min(temp, df['Low'].iloc[i - 1], df['Low'].iloc[i - 2])
            temp = -1 if df['sar'].iloc[i] > df['Low'].iloc[i] else df['trend'].iloc[i - 1] + 1
        df.at[i, 'trend'] = temp

        if df['trend'].iloc[i] < 0:
            temp = min(df['Low'].iloc[i], df['ep'].iloc[i - 1]) if df['trend'].iloc[i] != -1 else df['Low'].iloc[i]
        else:
            temp = max(df['High'].iloc[i], df['ep'].iloc[i - 1]) if df['trend'].iloc[i] != 1 else df['High'].iloc[i]
        df.at[i, 'ep'] = temp

        if np.abs(df['trend'].iloc[i]) == 1:
            temp = df['ep'].iloc[i - 1]
            df.at[i, 'af'] = initial_af
        else:
            temp = df['sar'].iloc[i]
            if df['ep'].iloc[i] == df['ep'].iloc[i - 1]:
                df.at[i, 'af'] = df['af'].iloc[i - 1]
            else:
                df.at[i, 'af'] = min(end_af, df['af'].iloc[i - 1] + step_af)
        df.at[i, 'real sar'] = temp

    # Signals — same as in original
    df['positions'] = np.where(df['real sar'] < df['Close'], 1, 0)
    df['signals'] = df['positions'].diff()

    df.set_index(pd.to_datetime(df['Date']), inplace=True)

    # Plot — matching original
    fig = plt.figure(figsize=(10, 5))
    ax = fig.add_subplot(111)
    ax.plot(df.index, df['Close'], lw=2, label=ticker)
    ax.plot(df.index, df['real sar'], linestyle=':', label='Parabolic SAR', color='k')
    ax.plot(df.loc[df['signals'] == 1].index, df['Close'][df['signals'] == 1],
            marker='^', color='g', label='LONG', lw=0, markersize=10)
    ax.plot(df.loc[df['signals'] == -1].index, df['Close'][df['signals'] == -1],
            marker='v', color='r', label='SHORT', lw=0, markersize=10)
    ax.legend()
    ax.grid(True)
    ax.set_title('Parabolic SAR')
    ax.set_ylabel('price')

    fig.tight_layout()
    plot_b64 = _fig_to_base64(fig)
    metrics = _portfolio_stats(df)
    return {"metrics": metrics, "plotImage": plot_b64}


def _run_awesome(ticker: str, start: str, end: str, p: Dict) -> Dict:
    """
    Ported from Awesome Oscillator backtest.py
    SMA of midpoint (H+L)/2 with saucer signal generation + cumsum control.
    Three-panel plot: (1) Positions, (2) Oscillator bar chart, (3) MAs.
    """
    import matplotlib.pyplot as plt

    sp = int(p.get("shortPeriod", 5))
    lp = int(p.get("longPeriod", 34))
    df = _download_ohlcv(ticker, start, end)
    df.reset_index(inplace=True)

    # Awesome oscillator — SMA of midpoint
    midpoint = (df['High'] + df['Low']) / 2
    df['awesome ma1'] = midpoint.rolling(window=sp).mean()
    df['awesome ma2'] = midpoint.rolling(window=lp).mean()
    df['awesome oscillator'] = df['awesome ma1'] - df['awesome ma2']
    df['signals'] = 0
    df['cumsum'] = 0

    for i in range(2, len(df)):
        # Bearish saucer
        if (df['Open'].iloc[i] > df['Close'].iloc[i] and
                df['Open'].iloc[i - 1] < df['Close'].iloc[i - 1] and
                df['Open'].iloc[i - 2] < df['Close'].iloc[i - 2] and
                df['awesome oscillator'].iloc[i - 1] > df['awesome oscillator'].iloc[i - 2] and
                df['awesome oscillator'].iloc[i - 1] < 0 and
                df['awesome oscillator'].iloc[i] < 0):
            df.at[i, 'signals'] = 1

        # Bullish saucer
        if (df['Open'].iloc[i] < df['Close'].iloc[i] and
                df['Open'].iloc[i - 1] > df['Close'].iloc[i - 1] and
                df['Open'].iloc[i - 2] > df['Close'].iloc[i - 2] and
                df['awesome oscillator'].iloc[i - 1] < df['awesome oscillator'].iloc[i - 2] and
                df['awesome oscillator'].iloc[i - 1] > 0 and
                df['awesome oscillator'].iloc[i] > 0):
            df.at[i, 'signals'] = -1

        # MA crossover with cumsum control
        if df['awesome ma1'].iloc[i] > df['awesome ma2'].iloc[i]:
            df.at[i, 'signals'] = 1
            df['cumsum'] = df['signals'].cumsum()
            if df['cumsum'].iloc[i] > 1:
                df.at[i, 'signals'] = 0

        if df['awesome ma1'].iloc[i] < df['awesome ma2'].iloc[i]:
            df.at[i, 'signals'] = -1
            df['cumsum'] = df['signals'].cumsum()
            if df['cumsum'].iloc[i] < 0:
                df.at[i, 'signals'] = 0

    df['cumsum'] = df['signals'].cumsum()
    df.set_index(pd.to_datetime(df['Date']), inplace=True)

    # Three-panel plot matching original
    fig = plt.figure(figsize=(10, 12))

    ax = fig.add_subplot(311)
    ax.plot(df.index, df['Close'], label=ticker)
    ax.plot(df.loc[df['signals'] == 1].index, df['Close'][df['signals'] == 1],
            label='LONG', lw=0, marker='^', c='g')
    ax.plot(df.loc[df['signals'] == -1].index, df['Close'][df['signals'] == -1],
            label='SHORT', lw=0, marker='v', c='r')
    ax.legend(loc='best')
    ax.grid(True)
    ax.set_title('Positions')

    cx = fig.add_subplot(312)
    c = np.where(df['Open'] > df['Close'], 'r', 'g')
    cx.bar(range(len(df)), df['awesome oscillator'].values, color=c)
    cx.grid(True)
    cx.set_title('Awesome Oscillator')
    cx.set_xticks([])

    dx = fig.add_subplot(313)
    dx.plot(df.index, df['awesome ma1'], label=f'MA {sp}')
    dx.plot(df.index, df['awesome ma2'], label=f'MA {lp}', linestyle=':')
    dx.legend(loc='best')
    dx.grid(True)
    dx.set_title('Moving Average')

    fig.tight_layout()
    plot_b64 = _fig_to_base64(fig)
    metrics = _portfolio_stats(df)
    return {"metrics": metrics, "plotImage": plot_b64}


def _run_dual_thrust(ticker: str, start: str, end: str, p: Dict) -> Dict:
    """
    Adapted from Dual Thrust backtest.py for daily OHLCV data.
    Original uses intraday forex data; we adapt the range breakout logic to daily bars.
    """
    import matplotlib.pyplot as plt

    lb = int(p.get("lookback", 5))
    k1 = float(p.get("k1", 0.5))
    k2 = float(p.get("k2", 0.5))
    df = _download_ohlcv(ticker, start, end)

    # Range calculation — ported from original min2day
    hh = df['High'].rolling(lb).max()
    lc = df['Close'].rolling(lb).min()
    hc = df['Close'].rolling(lb).max()
    ll = df['Low'].rolling(lb).min()
    range1 = hh - lc
    range2 = hc - ll
    rng = pd.concat([range1, range2], axis=1).max(axis=1)

    df['upper'] = df['Open'] + k1 * rng
    df['lower'] = df['Open'] - k2 * rng
    df['signals'] = 0
    df['cumsum'] = 0

    for i in range(lb, len(df)):
        if df['Close'].iloc[i] > df['upper'].iloc[i]:
            df.iloc[i, df.columns.get_loc('signals')] = 1
        elif df['Close'].iloc[i] < df['lower'].iloc[i]:
            df.iloc[i, df.columns.get_loc('signals')] = -1

    # Plot — matching original style with threshold fill
    fig = plt.figure(figsize=(10, 5))
    ax = fig.add_subplot(111)
    ax.plot(df.index, df['Close'], label=ticker)
    valid = df['upper'].notna()
    ax.fill_between(df.index[valid], df['upper'][valid], df['lower'][valid],
                    alpha=0.2, color='#355c7d')
    ax.plot(df.loc[df['signals'] == 1].index, df['Close'][df['signals'] == 1],
            lw=0, marker='^', markersize=10, c='g', label='LONG')
    ax.plot(df.loc[df['signals'] == -1].index, df['Close'][df['signals'] == -1],
            lw=0, marker='v', markersize=10, c='r', label='SHORT')
    ax.legend(loc='best')
    ax.set_ylabel('price')
    ax.set_title('Dual Thrust')
    ax.grid(True)

    fig.tight_layout()
    plot_b64 = _fig_to_base64(fig)
    metrics = _portfolio_stats(df)
    return {"metrics": metrics, "plotImage": plot_b64}


def _run_shooting_star(ticker: str, start: str, end: str, p: Dict) -> Dict:
    """
    Ported from Shooting Star backtest.py — all 8 conditions.
    Plot: Close price with long/short markers.
    """
    import matplotlib.pyplot as plt

    lower_bound = float(p.get("lowerBound", 0.2))
    body_size = float(p.get("bodySize", 0.5))
    stop_threshold = float(p.get("stopThreshold", 0.05))
    holding_period = int(p.get("holdingPeriod", 7))

    df = _download_ohlcv(ticker, start, end)
    df.reset_index(inplace=True)
    df['Date'] = pd.to_datetime(df['Date'])

    # 8 conditions — exact original
    c1 = df['Open'] >= df['Close']  # Red candle
    c2 = (df['Close'] - df['Low']) < lower_bound * abs(df['Close'] - df['Open'])  # Little lower wick
    c3 = abs(df['Open'] - df['Close']) < abs(np.mean(df['Open'] - df['Close'])) * body_size  # Small body
    c4 = (df['High'] - df['Open']) >= 2 * (df['Open'] - df['Close'])  # Long upper wick
    c5 = df['Close'] >= df['Close'].shift(1)  # Uptrend
    c6 = df['Close'].shift(1) >= df['Close'].shift(2)  # Uptrend continued
    c7 = df['High'].shift(-1) <= df['High']  # Next high below
    c8 = df['Close'].shift(-1) <= df['Close']  # Next close below

    df['signals'] = -(c1 & c2 & c3 & c4 & c5 & c6 & c7 & c8).astype(int)

    # Find exit — stop loss/profit or holding period
    idxlist = df[df['signals'] == -1].index.tolist()
    for ind in idxlist:
        entry_pos = df['Close'].iloc[ind]
        counter = 0
        j = ind + 1
        while j < len(df):
            counter += 1
            if abs(df['Close'].iloc[j] / entry_pos - 1) > stop_threshold:
                df.at[j, 'signals'] = 1
                break
            if counter >= holding_period:
                df.at[j, 'signals'] = 1
                break
            j += 1

    df.set_index('Date', inplace=True)

    # Plot — matching original
    fig = plt.figure(figsize=(10, 5))
    ax = fig.add_subplot(111)
    ax.plot(df.index, df['Close'], label=ticker)
    ax.plot(df.loc[df['signals'] == -1].index, df['Close'][df['signals'] == -1],
            marker='v', lw=0, c='r', label='SHORT', markersize=10)
    ax.plot(df.loc[df['signals'] == 1].index, df['Close'][df['signals'] == 1],
            marker='^', lw=0, c='g', label='LONG', markersize=10)
    ax.grid(True)
    ax.legend(loc='best')
    ax.set_title('Shooting Star')
    ax.set_ylabel('price')

    fig.tight_layout()
    plot_b64 = _fig_to_base64(fig)
    metrics = _portfolio_stats(df)
    return {"metrics": metrics, "plotImage": plot_b64}


def _run_options_straddle(ticker: str, start: str, end: str, p: Dict) -> Dict:
    """
    Ported from Options Straddle backtest.py — payoff diagram.
    Uses the original's plotting with color-coded P&L, strike price line, and annotations.
    """
    import matplotlib.pyplot as plt

    strike = float(p.get("strikePrice", 100))
    call_prem = float(p.get("callPremium", 5.0))
    put_prem = float(p.get("putPremium", 4.5))
    total_prem = call_prem + put_prem

    begin = round(strike - 5 * total_prem, 0)
    end_range = round(strike + 5 * total_prem, 0) + 1
    x = list(np.arange(int(begin), int(end_range)))

    y = []
    group1, group2 = -10, -10
    for j in x:
        temp = abs(j - strike) - total_prem
        y.append(temp)
        if temp < 0 and group1 < 0:
            group1 = x.index(j)
        if temp > 0 and group1 > 0 and group2 < 0:
            group2 = x.index(j)

    break_lower = strike - total_prem
    break_upper = strike + total_prem

    # Plot — matching original style
    fig = plt.figure(figsize=(10, 5))
    ax = fig.add_subplot(111)
    ax.spines['bottom'].set_position(('data', 0))
    ax.spines['right'].set_visible(False)
    ax.spines['top'].set_visible(False)

    # P&L in different colors
    if group1 >= 0 and group2 >= 0:
        ax.plot(x[:group1], y[:group1], c='#57bc90', lw=5)
        ax.plot(x[group2:], y[group2:], c='#57bc90', lw=5)
        ax.plot(x[group1:group2], y[group1:group2], c='#ec576b', lw=5)
    else:
        ax.plot(x, y, c='#57bc90', lw=5)

    # Strike price line
    ax.plot([strike, strike], [0, -total_prem], linestyle=':', lw=3, c='#ec576b', alpha=0.5)

    # Annotations
    ax.annotate('Strike Price', xy=(strike, 0), xytext=(strike, total_prem),
                arrowprops=dict(arrowstyle='simple', facecolor='#c5c1c0'),
                va='center', ha='center')
    ax.annotate('Lower Breakeven', xy=(break_lower, 0),
                xytext=(break_lower, -total_prem * 0.8),
                arrowprops=dict(arrowstyle='simple', facecolor='#c5c1c0'),
                va='center', ha='center', fontsize=8)
    ax.annotate('Upper Breakeven', xy=(break_upper, 0),
                xytext=(break_upper, -total_prem * 0.8),
                arrowprops=dict(arrowstyle='simple', facecolor='#c5c1c0'),
                va='center', ha='center', fontsize=8)

    ax.set_title(f'Long Straddle Options Strategy')
    ax.set_ylabel('Profit & Loss')
    ax.set_xlabel('Price')

    fig.tight_layout()
    plot_b64 = _fig_to_base64(fig)

    return {
        "metrics": {
            "strikePrice": strike,
            "callPremium": call_prem,
            "putPremium": put_prem,
            "totalPremium": round(total_prem, 2),
            "maxLoss": round(-total_prem, 2),
            "breakEvenLower": round(break_lower, 2),
            "breakEvenUpper": round(break_upper, 2),
            "maxProfitPotential": "Unlimited (upside)",
        },
        "plotImage": plot_b64,
    }


def _run_vix_calc(ticker: str, start: str, end: str, p: Dict) -> Dict:
    """
    Realized volatility calculator.
    The original VIX Calculator uses options chain data (CBOE methodology)
    which requires specialized data feeds. For this app, we compute a
    VIX-like realized volatility from the historical close prices.
    Two-panel plot: (1) Price, (2) Realized Vol.
    """
    import matplotlib.pyplot as plt

    window = int(p.get("windowDays", 30))
    df = _download_ohlcv(ticker, start, end)
    log_ret = np.log(df['Close'] / df['Close'].shift(1))
    df['realized_vol'] = log_ret.rolling(window).std() * np.sqrt(252) * 100
    df.dropna(inplace=True)

    fig = plt.figure(figsize=(10, 6))
    ax1 = fig.add_subplot(211)
    ax1.plot(df.index, df['Close'], c='#113aac')
    ax1.set_title(f'{ticker} Price')
    ax1.set_ylabel('Price')
    ax1.grid(True)

    ax2 = fig.add_subplot(212)
    ax2.plot(df.index, df['realized_vol'], c='#f22f08')
    ax2.axhline(df['realized_vol'].mean(), color='#46344e', linewidth=0.8, linestyle='--', alpha=0.6,
                label=f"Mean: {df['realized_vol'].mean():.1f}%")
    ax2.set_title(f'Realized Volatility ({window}d annualized)')
    ax2.set_ylabel('Vol %')
    ax2.set_xlabel('Date')
    ax2.legend(loc='best')
    ax2.grid(True)

    fig.tight_layout()
    plot_b64 = _fig_to_base64(fig)

    return {
        "metrics": {
            "currentVol": _safe_float(df['realized_vol'].iloc[-1]),
            "avgVol": _safe_float(df['realized_vol'].mean()),
            "maxVol": _safe_float(df['realized_vol'].max()),
            "minVol": _safe_float(df['realized_vol'].min()),
            "windowDays": window,
        },
        "plotImage": plot_b64,
    }


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
