"""
Matplotlib equity + drawdown chart for backtest results.

Produces a single PNG (top: equity vs buy-and-hold; bottom: drawdown).
Returns both the raw PNG bytes (so the REST endpoint can base64 it) and
optionally writes to disk.
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import Optional

import matplotlib

matplotlib.use("Agg")  # Headless. Required for FastAPI workers.
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402


def render_equity_drawdown(
    equity: pd.Series,
    buy_hold: Optional[pd.Series],
    title: str,
    out_path: Optional[Path] = None,
) -> bytes:
    fig, (ax1, ax2) = plt.subplots(
        2, 1, figsize=(10, 5.5), sharex=True,
        gridspec_kw={"height_ratios": [3, 1]},
    )

    ax1.plot(equity.index, equity.values, color="#7c3aed", lw=1.4, label="Strategy")
    if buy_hold is not None and len(buy_hold) == len(equity):
        ax1.plot(equity.index, buy_hold.values, color="#94a3b8", lw=1.0, ls="--", label="Buy & Hold")
    ax1.set_title(title, fontsize=12, color="#1e293b")
    ax1.set_ylabel("Equity")
    ax1.grid(True, alpha=0.25)
    ax1.legend(loc="upper left", frameon=False, fontsize=9)

    peak = equity.cummax()
    dd = (equity - peak) / peak * 100.0
    ax2.fill_between(dd.index, dd.values, 0, color="#ef4444", alpha=0.35)
    ax2.set_ylabel("Drawdown %")
    ax2.grid(True, alpha=0.25)
    ax2.set_ylim(min(dd.min() * 1.05, -1.0), 1.0)

    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=120, bbox_inches="tight")
    plt.close(fig)
    png = buf.getvalue()

    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(png)
    return png
