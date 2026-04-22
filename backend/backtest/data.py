"""
Historical OHLCV loader for the canonical backtest engine.

Uses yfinance with a tiny on-disk parquet cache so reference tests don't
re-download SPY 2010-2024 every run. The cache key is (symbol, start, end,
interval).
"""
from __future__ import annotations

import hashlib
from pathlib import Path

import pandas as pd

CACHE_ROOT = Path(__file__).resolve().parents[2] / "agents" / "_cache" / "bars"


def _cache_path(symbol: str, start: str, end: str, interval: str) -> Path:
    key = hashlib.sha1(f"{symbol}|{start}|{end}|{interval}".encode()).hexdigest()[:16]
    safe = symbol.replace("/", "_").replace("=", "_")
    return CACHE_ROOT / f"{safe}_{interval}_{key}.parquet"


def load_bars(symbol: str, start: str, end: str, interval: str = "1d") -> pd.DataFrame:
    """Return an OHLCV frame with columns Open/High/Low/Close/Volume.

    `backtesting.py` requires those exact column names and a DatetimeIndex.
    """
    cp = _cache_path(symbol, start, end, interval)
    if cp.exists():
        df = pd.read_parquet(cp)
    else:
        import yfinance as yf

        df = yf.Ticker(symbol).history(start=start, end=end, interval=interval, auto_adjust=False)
        if df.empty:
            raise ValueError(f"yfinance returned no rows for {symbol} {start}..{end} ({interval})")
        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
        # Drop tz so backtesting.py is happy.
        if df.index.tz is not None:
            df.index = df.index.tz_localize(None)
        cp.parent.mkdir(parents=True, exist_ok=True)
        df.to_parquet(cp)
    return df
