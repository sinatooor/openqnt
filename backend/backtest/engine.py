"""
Single canonical entrypoint: `run_backtest(spec) -> BacktestResult`.

Delegates to `backtesting.py` (the only engine AUDIT.md confirmed working
end-to-end). Standardizes the result, renders an equity+drawdown PNG, and
optionally persists artifacts under `backend/agents/_backtests/<run_id>/`.

Custom code path: `spec.strategy="custom"` + `spec.code` (a string defining
a `class GeneratedStrategy(Strategy): ...`). We exec it in an isolated
namespace, find the Strategy subclass, and run it. Same standardized
result either way.
"""
from __future__ import annotations

import base64
import json
import math
import time
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from backtesting import Backtest, Strategy

from .builtins import STRATEGIES
from .data import load_bars
from .plot import render_equity_drawdown
from .schema import BacktestResult, BacktestSpec

ARTIFACTS_ROOT = Path(__file__).resolve().parents[2] / "agents" / "_backtests"


def available_strategies() -> list[dict[str, Any]]:
    """Surface metadata for the REST/UI layer (e.g. dropdowns)."""
    out = []
    for name, cls in STRATEGIES.items():
        params = {
            k: getattr(cls, k)
            for k in dir(cls)
            if not k.startswith("_") and isinstance(getattr(cls, k), (int, float, str, bool))
            and k not in {"data", "position", "orders", "trades", "closed_trades", "equity"}
        }
        out.append({"name": name, "params": params, "doc": (cls.__doc__ or "").strip()})
    return out


def _strategy_class_from_spec(spec: BacktestSpec) -> type[Strategy]:
    if spec.strategy == "custom":
        if not spec.code:
            raise ValueError("strategy='custom' requires `code`")
        ns: dict[str, Any] = {}
        exec(compile(spec.code, "<custom_strategy>", "exec"), ns)
        # Prefer `GeneratedStrategy`; otherwise pick any Strategy subclass.
        cls = ns.get("GeneratedStrategy")
        if cls is None:
            for v in ns.values():
                if isinstance(v, type) and issubclass(v, Strategy) and v is not Strategy:
                    cls = v
                    break
        if cls is None:
            raise ValueError("Custom code defined no Strategy subclass")
        return cls
    cls = STRATEGIES.get(spec.strategy)
    if cls is None:
        raise ValueError(
            f"Unknown strategy '{spec.strategy}'. Available: {sorted(STRATEGIES) + ['custom']}"
        )
    return cls


def _safe(x: Any) -> Any:
    if isinstance(x, float):
        if math.isnan(x) or math.isinf(x):
            return None
        return x
    if isinstance(x, (np.floating, np.integer)):
        return _safe(x.item())
    if isinstance(x, pd.Timestamp):
        return x.isoformat()
    return x


def _metrics_from_stats(stats: pd.Series) -> dict[str, float]:
    """Map `backtesting.py` Stats → our canonical metric names."""
    def g(k: str, default: Any = None) -> Any:
        if k in stats.index:
            return _safe(stats[k])
        return default

    return {
        "return_pct": g("Return [%]", 0.0),
        "cagr_pct": g("Return (Ann.) [%]", g("Annualized Return [%]", 0.0)),
        "sharpe": g("Sharpe Ratio", 0.0),
        "sortino": g("Sortino Ratio", 0.0),
        "calmar": g("Calmar Ratio", 0.0),
        "max_drawdown_pct": g("Max. Drawdown [%]", 0.0),
        "win_rate_pct": g("Win Rate [%]", 0.0),
        "profit_factor": g("Profit Factor", 0.0),
        "n_trades": int(g("# Trades", 0) or 0),
        "exposure_pct": g("Exposure Time [%]", 0.0),
        "final_equity": g("Equity Final [$]", 0.0),
        "buy_and_hold_pct": g("Buy & Hold Return [%]", 0.0),
    }


def _trades_from_stats(stats: pd.Series, max_rows: int = 200) -> list[dict[str, Any]]:
    if "_trades" not in stats.index:
        return []
    df = stats["_trades"]
    if df is None or len(df) == 0:
        return []
    out = []
    for r in df.head(max_rows).itertuples(index=False):
        out.append(
            {
                "entry_time": _safe(getattr(r, "EntryTime", None)),
                "exit_time": _safe(getattr(r, "ExitTime", None)),
                "entry_price": _safe(getattr(r, "EntryPrice", None)),
                "exit_price": _safe(getattr(r, "ExitPrice", None)),
                "size": _safe(getattr(r, "Size", None)),
                "pnl": _safe(getattr(r, "PnL", None)),
                "return_pct": _safe(getattr(r, "ReturnPct", None)),
                "duration": str(getattr(r, "Duration", "")) or None,
            }
        )
    return out


def _equity_curve(stats: pd.Series, buy_hold_series: pd.Series, max_points: int = 800) -> list[dict[str, Any]]:
    eq_df = stats["_equity_curve"]
    if eq_df is None or len(eq_df) == 0:
        return []
    step = max(1, len(eq_df) // max_points)
    sliced = eq_df.iloc[::step]
    bh = buy_hold_series.reindex(sliced.index, method="nearest")
    return [
        {
            "ts": _safe(idx),
            "equity": _safe(row.Equity),
            "drawdown_pct": _safe(row.DrawdownPct * 100.0 if hasattr(row, "DrawdownPct") else None),
            "buy_and_hold": _safe(bh_val),
        }
        for (idx, row), bh_val in zip(sliced.iterrows(), bh.values)
    ]


def run_backtest(spec: BacktestSpec) -> BacktestResult:
    """Execute a backtest. Never raises — errors land in `result.error`."""
    t0 = time.time()
    try:
        bars = load_bars(spec.symbol, spec.start, spec.end, spec.interval)
        if bars.empty or len(bars) < 5:
            return BacktestResult(
                success=False,
                spec=spec.to_dict(),
                error=f"Not enough bars for {spec.symbol} ({len(bars)})",
            )

        cls = _strategy_class_from_spec(spec)

        # Apply per-spec params via subclassing so we don't mutate the original.
        if spec.params:
            cls = type(cls.__name__, (cls,), {k: v for k, v in spec.params.items()})

        bt = Backtest(
            bars,
            cls,
            cash=spec.initial_cash,
            commission=spec.commission,
            finalize_trades=True,
            exclusive_orders=True,
        )
        stats = bt.run()

        metrics = _metrics_from_stats(stats)
        # Buy-and-hold series for plot (initial_cash * close/close[0]).
        bh_series = (bars["Close"] / bars["Close"].iloc[0]) * spec.initial_cash

        # Render plot.
        run_id = spec.run_id or f"bt_{uuid.uuid4().hex[:10]}"
        artifacts_dir = ARTIFACTS_ROOT / run_id if spec.save_artifacts else None
        plot_path = (artifacts_dir / "equity.png") if artifacts_dir else None
        png = render_equity_drawdown(
            equity=stats["_equity_curve"]["Equity"],
            buy_hold=bh_series,
            title=f"{spec.symbol} · {spec.strategy} · {spec.start}→{spec.end}",
            out_path=plot_path,
        )
        plot_b64 = "data:image/png;base64," + base64.b64encode(png).decode("ascii")

        result = BacktestResult(
            success=True,
            spec=spec.to_dict(),
            metrics=metrics,
            equity_curve=_equity_curve(stats, bh_series),
            trades=_trades_from_stats(stats),
            plot_b64=plot_b64,
            plot_path=str(plot_path) if plot_path else None,
            artifacts_dir=str(artifacts_dir) if artifacts_dir else None,
        )

        if artifacts_dir is not None:
            artifacts_dir.mkdir(parents=True, exist_ok=True)
            (artifacts_dir / "result.json").write_text(
                json.dumps(
                    {**result.to_dict(), "plot_b64": None},  # don't double-store the image
                    indent=2,
                    default=str,
                )
            )
            (artifacts_dir / "spec.json").write_text(json.dumps(spec.to_dict(), indent=2))

        result.metrics["duration_ms"] = int((time.time() - t0) * 1000)
        return result

    except Exception as e:  # noqa: BLE001
        import traceback as _tb

        return BacktestResult(
            success=False,
            spec=spec.to_dict(),
            error=f"{type(e).__name__}: {e}\n{_tb.format_exc()[-1500:]}",
        )
