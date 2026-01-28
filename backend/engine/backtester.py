"""Bar-based backtesting engine for Flow strategies."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

try:
    from flow.runtime import Bar, FlowStrategy, OrderIntent, PortfolioState, Position, IndicatorRegistry
except ImportError:
    from backend.flow.runtime import Bar, FlowStrategy, OrderIntent, PortfolioState, Position, IndicatorRegistry


@dataclass
class Order:
    id: str
    symbol: str
    side: str
    order_type: str
    size: float
    price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    status: str = "OPEN"
    created_at: Optional[datetime] = None


@dataclass
class Fill:
    order_id: str
    symbol: str
    side: str
    size: float
    price: float
    timestamp: datetime
    fee: float


@dataclass
class Trade:
    symbol: str
    side: str
    size: float
    entry_price: float
    entry_time: datetime
    exit_price: Optional[float] = None
    exit_time: Optional[datetime] = None
    pnl: float = 0.0
    status: str = "OPEN"
    exit_reason: Optional[str] = None


@dataclass
class BacktestResult:
    equity_curve: List[Dict[str, Any]]
    drawdown_curve: List[Dict[str, Any]]
    trades: List[Dict[str, Any]]
    fills: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    per_bar: List[Dict[str, Any]]


class BacktestEngine:
    def __init__(
        self,
        initial_cash: float = 100000.0,
        commission_pct: float = 0.0005,
        slippage_pct: float = 0.0001,
        allow_short: bool = True,
        volume_aware: bool = False,
    ):
        self.initial_cash = initial_cash
        self.commission_pct = commission_pct
        self.slippage_pct = slippage_pct
        self.allow_short = allow_short
        self.volume_aware = volume_aware

        self.orders: List[Order] = []
        self.fills: List[Fill] = []
        self.trades: List[Trade] = []
        self.indicator_registry = IndicatorRegistry()

    def run(
        self,
        strategy_code: str,
        data: pd.DataFrame,
        symbol: str,
    ) -> BacktestResult:
        self.default_symbol = symbol
        strategy = self._load_strategy(strategy_code)
        df = self._normalize_data(data)
        if "symbol" in df.columns:
            df = df[df["symbol"] == symbol]
        bars = self._build_bars(df)

        portfolio = PortfolioState(cash=self.initial_cash, equity=self.initial_cash)
        indicator_cache = self._build_indicator_cache(strategy, df)

        equity_curve: List[Dict[str, Any]] = []
        drawdown_curve: List[Dict[str, Any]] = []
        per_bar: List[Dict[str, Any]] = []
        peak_equity = portfolio.equity

        for idx, bar in enumerate(bars):
            self._process_open_orders(bar, portfolio)
            intents = strategy.on_bar(bar, bars, idx, portfolio, indicator_cache)
            self._submit_intents(intents, bar)
            self._update_positions(bar, portfolio)
            portfolio.equity = self._calculate_equity(portfolio, bar)
            peak_equity = max(peak_equity, portfolio.equity)
            drawdown_pct = ((peak_equity - portfolio.equity) / peak_equity) * 100 if peak_equity else 0.0
            equity_curve.append({"timestamp": bar.timestamp.isoformat(), "equity": portfolio.equity})
            drawdown_curve.append({"timestamp": bar.timestamp.isoformat(), "drawdownPct": drawdown_pct})
            per_bar.append(
                {
                    "timestamp": bar.timestamp.isoformat(),
                    "cash": portfolio.cash,
                    "equity": portfolio.equity,
                    "drawdownPct": drawdown_pct,
                    "positions": {k: vars(v) for k, v in portfolio.positions.items()},
                }
            )

        self._close_all_positions(bars[-1], portfolio)
        exposure_bars = sum(1 for p in per_bar if p["positions"])
        exposure_pct = (exposure_bars / len(per_bar) * 100) if per_bar else 0.0
        metrics = self._calculate_metrics(equity_curve, exposure_pct)
        return BacktestResult(
            equity_curve=equity_curve,
            drawdown_curve=drawdown_curve,
            trades=[vars(t) for t in self.trades],
            fills=[vars(f) for f in self.fills],
            metrics=metrics,
            per_bar=per_bar,
        )

    def _load_strategy(self, code: str) -> FlowStrategy:
        module: Dict[str, Any] = {}
        exec(code, module)
        strategy_cls = module.get("GeneratedStrategy") or module.get("Strategy")
        if not strategy_cls:
            raise ValueError("Strategy class not found in compiled code.")
        return strategy_cls()

    def _normalize_data(self, data: pd.DataFrame) -> pd.DataFrame:
        df = data.copy()
        df.columns = [c.lower() for c in df.columns]
        if "timestamp" not in df.columns:
            if isinstance(df.index, pd.DatetimeIndex):
                df["timestamp"] = df.index
            else:
                df["timestamp"] = pd.to_datetime(df.index)
        return df.sort_values("timestamp")

    def _build_bars(self, df: pd.DataFrame) -> List[Bar]:
        return [
            Bar(
                timestamp=row["timestamp"].to_pydatetime() if hasattr(row["timestamp"], "to_pydatetime") else row["timestamp"],
                open=float(row["open"]),
                high=float(row["high"]),
                low=float(row["low"]),
                close=float(row["close"]),
                volume=float(row.get("volume", 0)),
                symbol=str(row.get("symbol", "UNKNOWN")),
            )
            for _, row in df.iterrows()
        ]

    def _build_indicator_cache(self, strategy: FlowStrategy, df: pd.DataFrame) -> Dict[str, Any]:
        indicator_cache: Dict[str, Any] = {}
        for ind in strategy.compiled.get("indicator_defs", []):
            node_id = ind["node_id"]
            ind_type = (ind.get("indicatorType") or "").lower()
            params = ind.get("params", {})
            series = self.indicator_registry.compute(ind_type, df, params)
            if ind_type in {"macd"} and isinstance(series, np.ndarray) and series.ndim == 2:
                indicator_cache[f"{node_id}:line"] = series[0]
                indicator_cache[f"{node_id}:signal"] = series[1]
                indicator_cache[f"{node_id}:histogram"] = series[2]
                indicator_cache[f"{node_id}:output"] = series[0]
            elif ind_type in {"bb"} and isinstance(series, np.ndarray) and series.ndim == 2:
                indicator_cache[f"{node_id}:upper"] = series[0]
                indicator_cache[f"{node_id}:middle"] = series[1]
                indicator_cache[f"{node_id}:lower"] = series[2]
                indicator_cache[f"{node_id}:output"] = series[1]
            else:
                indicator_cache[f"{node_id}:output"] = series
        return indicator_cache

    def _submit_intents(self, intents: List[OrderIntent], bar: Bar):
        for intent in intents:
            if intent.side == "SELL" and not self.allow_short:
                continue
            resolved_symbol = intent.symbol if intent.symbol != "UNKNOWN" else self.default_symbol
            order = Order(
                id=f"order_{len(self.orders)+1}",
                symbol=resolved_symbol,
                side=intent.side,
                order_type=intent.order_type,
                size=float(intent.size),
                price=intent.price,
                stop_loss=intent.stop_loss,
                take_profit=intent.take_profit,
                created_at=bar.timestamp,
            )
            self.orders.append(order)

    def _process_open_orders(self, bar: Bar, portfolio: PortfolioState):
        for order in list(self.orders):
            if order.status != "OPEN":
                continue
            fill_price = self._get_fill_price(order, bar)
            if fill_price is None:
                continue

            fill_size = order.size
            if self.volume_aware and bar.volume:
                fill_size = min(order.size, bar.volume)
            fee = abs(fill_size * fill_price) * self.commission_pct
            self.fills.append(
                Fill(
                    order_id=order.id,
                    symbol=order.symbol,
                    side=order.side,
                    size=fill_size,
                    price=fill_price,
                    timestamp=bar.timestamp,
                    fee=fee,
                )
            )
            order.status = "FILLED"
            self._apply_fill_to_portfolio(order, fill_size, fill_price, bar, portfolio, fee)

    def _get_fill_price(self, order: Order, bar: Bar) -> Optional[float]:
        slippage = bar.close * self.slippage_pct
        if order.order_type == "market":
            return bar.close + (slippage if order.side == "BUY" else -slippage)
        if order.order_type == "limit" and order.price is not None:
            if order.side == "BUY" and bar.low <= order.price:
                return order.price
            if order.side == "SELL" and bar.high >= order.price:
                return order.price
        if order.order_type == "stop" and order.price is not None:
            if order.side == "BUY" and bar.high >= order.price:
                return order.price + slippage
            if order.side == "SELL" and bar.low <= order.price:
                return order.price - slippage
        return None

    def _apply_fill_to_portfolio(
        self,
        order: Order,
        fill_size: float,
        fill_price: float,
        bar: Bar,
        portfolio: PortfolioState,
        fee: float,
    ):
        cost = fill_size * fill_price
        side = order.side
        position = portfolio.positions.get(order.symbol)

        if side == "BUY":
            portfolio.cash -= cost + fee
            if position and position.side == "SHORT":
                self._close_trade(order.symbol, fill_price, bar.timestamp, "REVERSE")
                portfolio.positions.pop(order.symbol, None)
            portfolio.positions[order.symbol] = Position(
                side="LONG",
                size=fill_size,
                entry_price=fill_price,
                entry_time=bar.timestamp,
                stop_loss=order.stop_loss,
                take_profit=order.take_profit,
            )
            self.trades.append(
                Trade(
                    symbol=order.symbol,
                    side="LONG",
                    size=fill_size,
                    entry_price=fill_price,
                    entry_time=bar.timestamp,
                )
            )
        else:
            portfolio.cash += cost - fee
            if position and position.side == "LONG":
                self._close_trade(order.symbol, fill_price, bar.timestamp, "REVERSE")
                portfolio.positions.pop(order.symbol, None)
            portfolio.positions[order.symbol] = Position(
                side="SHORT",
                size=fill_size,
                entry_price=fill_price,
                entry_time=bar.timestamp,
                stop_loss=order.stop_loss,
                take_profit=order.take_profit,
            )
            self.trades.append(
                Trade(
                    symbol=order.symbol,
                    side="SHORT",
                    size=fill_size,
                    entry_price=fill_price,
                    entry_time=bar.timestamp,
                )
            )

    def _update_positions(self, bar: Bar, portfolio: PortfolioState):
        to_close = []
        for symbol, position in portfolio.positions.items():
            if position.stop_loss:
                if position.side == "LONG" and bar.low <= position.stop_loss:
                    to_close.append((symbol, position.stop_loss, "STOP_LOSS"))
                if position.side == "SHORT" and bar.high >= position.stop_loss:
                    to_close.append((symbol, position.stop_loss, "STOP_LOSS"))
            if position.take_profit:
                if position.side == "LONG" and bar.high >= position.take_profit:
                    to_close.append((symbol, position.take_profit, "TAKE_PROFIT"))
                if position.side == "SHORT" and bar.low <= position.take_profit:
                    to_close.append((symbol, position.take_profit, "TAKE_PROFIT"))

        for symbol, price, reason in to_close:
            self._close_trade(symbol, price, bar.timestamp, reason)
            portfolio.positions.pop(symbol, None)

    def _close_trade(self, symbol: str, price: float, timestamp: datetime, reason: str):
        for trade in reversed(self.trades):
            if trade.symbol == symbol and trade.status == "OPEN":
                multiplier = 1 if trade.side == "LONG" else -1
                trade.exit_price = price
                trade.exit_time = timestamp
                trade.exit_reason = reason
                trade.pnl = (price - trade.entry_price) * trade.size * multiplier
                trade.status = "CLOSED"
                return

    def _close_all_positions(self, bar: Bar, portfolio: PortfolioState):
        for symbol in list(portfolio.positions.keys()):
            self._close_trade(symbol, bar.close, bar.timestamp, "END_OF_TEST")
            portfolio.positions.pop(symbol, None)

    def _calculate_equity(self, portfolio: PortfolioState, bar: Bar) -> float:
        equity = portfolio.cash
        for position in portfolio.positions.values():
            multiplier = 1 if position.side == "LONG" else -1
            equity += position.size * (bar.close - position.entry_price) * multiplier
        return equity

    def _calculate_metrics(self, equity_curve: List[Dict[str, Any]], exposure_pct: float) -> Dict[str, Any]:
        if not equity_curve:
            return {}
        equity = np.array([p["equity"] for p in equity_curve])
        returns = np.diff(equity) / equity[:-1]
        if len(returns) == 0:
            returns = np.array([0.0])

        sharpe = np.sqrt(252) * returns.mean() / (returns.std() + 1e-9)
        downside = returns[returns < 0]
        sortino = np.sqrt(252) * returns.mean() / (downside.std() + 1e-9) if len(downside) else 0.0
        peaks = np.maximum.accumulate(equity)
        drawdown = (peaks - equity) / peaks
        max_dd = float(np.max(drawdown)) * 100
        volatility = float(returns.std() * np.sqrt(252))

        closed_trades = [t for t in self.trades if t.status == "CLOSED"]
        wins = [t for t in closed_trades if t.pnl > 0]
        losses = [t for t in closed_trades if t.pnl <= 0]
        win_rate = (len(wins) / len(closed_trades) * 100) if closed_trades else 0.0
        expectancy = (
            (np.mean([t.pnl for t in wins]) if wins else 0.0)
            + (np.mean([t.pnl for t in losses]) if losses else 0.0)
        )

        return {
            "final_equity": float(equity[-1]),
            "return_pct": float((equity[-1] - equity[0]) / equity[0] * 100),
            "max_drawdown_pct": max_dd,
            "sharpe_ratio": float(sharpe),
            "sortino_ratio": float(sortino),
            "volatility": volatility,
            "exposure_pct": float(exposure_pct),
            "win_rate_pct": float(win_rate),
            "expectancy": float(expectancy),
            "total_trades": len(closed_trades),
        }
