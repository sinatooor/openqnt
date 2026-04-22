"""
Built-in `backtesting.py` Strategy classes for the canonical engine.

These are the strategies the REST endpoint and agents can name by string.
"Custom" strategies execute user-supplied code in `engine.py`.

Keep these tiny and well-known — they are also the validation surface for
the SMA(50/200) reference test.
"""
from __future__ import annotations

import numpy as np
from backtesting import Strategy
from backtesting.lib import crossover


def _sma(arr: np.ndarray, n: int) -> np.ndarray:
    return np.convolve(arr, np.ones(n) / n, mode="same")


def _rsi(arr: np.ndarray, n: int = 14) -> np.ndarray:
    """Wilder RSI — vectorized, no TA-Lib dependency."""
    deltas = np.diff(arr, prepend=arr[0])
    gain = np.clip(deltas, 0, None)
    loss = -np.clip(deltas, None, 0)
    # Wilder smoothing via EMA-like recursion.
    avg_gain = np.zeros_like(arr, dtype=float)
    avg_loss = np.zeros_like(arr, dtype=float)
    avg_gain[:n] = gain[:n].mean()
    avg_loss[:n] = loss[:n].mean()
    for i in range(n, len(arr)):
        avg_gain[i] = (avg_gain[i - 1] * (n - 1) + gain[i]) / n
        avg_loss[i] = (avg_loss[i - 1] * (n - 1) + loss[i]) / n
    rs = avg_gain / np.where(avg_loss == 0, 1e-9, avg_loss)
    rsi = 100 - (100 / (1 + rs))
    rsi[: n] = 50  # warmup
    return rsi


# ── strategies ────────────────────────────────────────────────────────


class SmaCrossover(Strategy):
    """Classic fast/slow SMA crossover. Long when fast crosses above slow,
    flat when fast crosses below."""

    fast: int = 50
    slow: int = 200

    def init(self) -> None:
        close = self.data.Close
        self.sma_fast = self.I(_sma, close, self.fast)
        self.sma_slow = self.I(_sma, close, self.slow)

    def next(self) -> None:
        if crossover(self.sma_fast, self.sma_slow):
            self.position.close()
            self.buy()
        elif crossover(self.sma_slow, self.sma_fast):
            self.position.close()


class RsiMeanRev(Strategy):
    """Long when RSI < oversold; close when RSI > overbought."""

    rsi_period: int = 14
    oversold: int = 30
    overbought: int = 70

    def init(self) -> None:
        self.rsi = self.I(_rsi, self.data.Close, self.rsi_period)

    def next(self) -> None:
        if not self.position and self.rsi[-1] < self.oversold:
            self.buy()
        elif self.position and self.rsi[-1] > self.overbought:
            self.position.close()


class BuyAndHold(Strategy):
    """Reference baseline."""

    def init(self) -> None:
        pass

    def next(self) -> None:
        if not self.position:
            self.buy()


STRATEGIES: dict[str, type[Strategy]] = {
    "sma_crossover": SmaCrossover,
    "rsi_meanrev": RsiMeanRev,
    "buy_and_hold": BuyAndHold,
}
