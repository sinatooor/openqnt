"""
Agent-facing wrapper for the canonical backtest engine.

Agents call `run_backtest_tool(...)` and get back the same shape the REST
endpoint returns. The result is intentionally trimmed for an LLM context:
the equity curve and trade list are summarised, not enumerated.

If an `AgentRunContext` is supplied, the tool emits a `tool_call` event,
saves the equity-curve PNG as a run artifact, and posts a one-line
conclusion the agent can quote in its summary.
"""
from __future__ import annotations

from typing import Any, Optional

from backtest import BacktestSpec, run_backtest


def run_backtest_tool(
    symbol: str = "SPY",
    start: str = "2020-01-01",
    end: str = "2024-12-31",
    interval: str = "1d",
    strategy: str = "sma_crossover",
    params: Optional[dict[str, Any]] = None,
    initial_cash: float = 10_000.0,
    commission: float = 0.002,
    code: Optional[str] = None,
    ctx: Any = None,
) -> dict[str, Any]:
    """Run a backtest and return a compact, LLM-friendly summary.

    Pass `ctx` to surface the call in the live agent stream and to
    persist the equity-curve PNG into that run's artifacts dir.
    """
    spec = BacktestSpec(
        symbol=symbol,
        start=start,
        end=end,
        interval=interval,
        strategy=strategy,
        params=params or {},
        initial_cash=initial_cash,
        commission=commission,
        code=code,
        save_artifacts=True,
    )

    if ctx is not None:
        with ctx.tool_call(
            "backtest.run",
            {
                "symbol": symbol,
                "strategy": strategy,
                "period": f"{start}..{end}",
                "params": params or {},
            },
        ) as h:
            result = run_backtest(spec)
            if not result.success:
                h.result(f"backtest failed: {result.error[:200] if result.error else 'unknown'}", status="error")
                return _summarize(result)
            # Persist the chart as a run artifact so it shows inline.
            try:
                from pathlib import Path

                if result.plot_path and Path(result.plot_path).exists():
                    png = Path(result.plot_path).read_bytes()
                    ctx.save_artifact(
                        f"{symbol}_{strategy}_equity.png",
                        png,
                        kind="plot",
                        caption=f"Backtest equity & drawdown · {symbol} · {strategy}",
                    )
            except Exception:  # noqa: BLE001
                pass
            m = result.metrics
            h.result(
                f"return={m.get('return_pct', 0):.1f}% · "
                f"sharpe={m.get('sharpe', 0):.2f} · "
                f"max_dd={m.get('max_drawdown_pct', 0):.1f}% · "
                f"trades={m.get('n_trades', 0)} · "
                f"vs B&H {m.get('buy_and_hold_pct', 0):.1f}%"
            )
    else:
        result = run_backtest(spec)

    return _summarize(result)


def _summarize(result) -> dict[str, Any]:
    """Trim to what an agent actually needs to reason about."""
    if not result.success:
        return {
            "success": False,
            "error": result.error,
            "spec": result.spec,
        }
    m = result.metrics
    eq = result.equity_curve
    # Sample the equity curve down to ~20 points so it fits in a prompt.
    step = max(1, len(eq) // 20)
    sampled = [{"ts": e["ts"], "equity": e["equity"]} for e in eq[::step]]
    trades = result.trades
    return {
        "success": True,
        "spec": result.spec,
        "metrics": m,
        "equity_curve_summary": sampled,
        "n_trades": len(trades),
        "first_trade": trades[0] if trades else None,
        "last_trade": trades[-1] if trades else None,
        "plot_path": result.plot_path,
        "artifacts_dir": result.artifacts_dir,
    }
