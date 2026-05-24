"""Runtime support for Flow-compiled strategies."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class Bar:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0
    symbol: str = "UNKNOWN"


@dataclass
class OrderIntent:
    symbol: str
    side: str  # BUY / SELL
    order_type: str  # market / limit / stop
    size: float
    price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    tag: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Position:
    side: str
    size: float
    entry_price: float
    entry_time: datetime
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None


@dataclass
class PortfolioState:
    cash: float
    equity: float
    positions: Dict[str, Position] = field(default_factory=dict)


class IndicatorRegistry:
    def __init__(self):
        self.cache: Dict[str, np.ndarray] = {}

    def compute(self, name: str, df: pd.DataFrame, params: Dict[str, Any]) -> np.ndarray:
        key = f"{name}:{sorted(params.items())}:{len(df)}"
        if key in self.cache:
            return self.cache[key]

        if name == "sma":
            period = int(params.get("period", 14))
            series = df["close"].rolling(window=period).mean().to_numpy()
        elif name == "ema":
            period = int(params.get("period", 14))
            series = df["close"].ewm(span=period, adjust=False).mean().to_numpy()
        elif name == "rsi":
            period = int(params.get("period", 14))
            delta = df["close"].diff()
            gain = delta.where(delta > 0, 0.0)
            loss = -delta.where(delta < 0, 0.0)
            avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
            avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
            rs = avg_gain / avg_loss.replace(0, np.nan)
            series = (100 - (100 / (1 + rs))).fillna(0.0).to_numpy()
        elif name == "macd":
            fast = int(params.get("fastPeriod", 12))
            slow = int(params.get("slowPeriod", 26))
            signal = int(params.get("signalPeriod", 9))
            fast_ema = df["close"].ewm(span=fast, adjust=False).mean()
            slow_ema = df["close"].ewm(span=slow, adjust=False).mean()
            macd_line = (fast_ema - slow_ema).to_numpy()
            signal_line = pd.Series(macd_line).ewm(span=signal, adjust=False).mean().to_numpy()
            hist = macd_line - signal_line
            series = np.vstack([macd_line, signal_line, hist])
        elif name == "bb":
            period = int(params.get("period", 20))
            deviation = float(params.get("deviation", 2))
            mid = df["close"].rolling(window=period).mean()
            std = df["close"].rolling(window=period).std()
            upper = (mid + deviation * std).to_numpy()
            lower = (mid - deviation * std).to_numpy()
            series = np.vstack([upper, mid.to_numpy(), lower])
        elif name == "atr":
            period = int(params.get("period", 14))
            high = df["high"]
            low = df["low"]
            close = df["close"]
            tr = pd.concat(
                [
                    (high - low),
                    (high - close.shift()).abs(),
                    (low - close.shift()).abs(),
                ],
                axis=1,
            ).max(axis=1)
            series = tr.ewm(span=period, adjust=False).mean().to_numpy()
        else:
            series = np.full(len(df), np.nan)

        self.cache[key] = series
        return series


@dataclass
class StrategyContext:
    bar: Bar
    history: List[Bar]
    index: int
    portfolio: PortfolioState
    variables: Dict[str, Any]
    indicator_cache: Dict[str, Any]
    indicator_registry: IndicatorRegistry
    risk_config: Dict[str, Any]
    llm: Optional[Callable[[str, Dict[str, Any]], Dict[str, Any]]] = None

    def indicator(self, node_id: str, output: str = "output") -> float:
        key = f"{node_id}:{output}"
        if key in self.indicator_cache:
            series = self.indicator_cache[key]
            if isinstance(series, np.ndarray):
                return float(series[self.index]) if self.index < len(series) else float("nan")
        return float("nan")


class FlowInterpreter:
    # Cache for live Avanza portfolio snapshots — keyed by account_key,
    # value is (epoch_ts, positions_dict, equity). Avoids hammering Avanza
    # when a strategy ticks at sub-minute intervals.
    _live_portfolio_cache: Dict[str, tuple] = {}
    _LIVE_PORTFOLIO_TTL_SEC = 30.0

    def __init__(self, compiled: Dict[str, Any]):
        self.compiled = compiled
        self.nodes_by_id = {n["id"]: n for n in compiled.get("nodes", [])}
        self.inputs = compiled.get("inputs", {})
        self.node_order = compiled.get("node_order", [])
        self.settings = compiled.get("settings", {})
        # `livePortfolioSource` selects which broker's live positions populate
        # portfolio_* nodes in this strategy run:
        #   'off' (or unset / legacy false) → use the backtest simulator's state
        #   'avanza'                        → live Avanza positions (SEK)
        #   'ibkr'                          → live Interactive Brokers positions (USD)
        #   'all'                           → merged view (symbols prefixed AVA:/IBKR:)
        # Legacy boolean `livePortfolio: true` is migrated to 'avanza'.
        legacy_bool = self.settings.get("livePortfolio")
        source_raw = self.settings.get("livePortfolioSource")
        if source_raw is None and legacy_bool is True:
            source_raw = "avanza"
        self.live_portfolio_source: str = str(source_raw or "off").lower()
        self.live_portfolio_account_key: str = str(self.settings.get("livePortfolioAccountKey") or "default")

    def _maybe_hydrate_live_portfolio(self, ctx: "StrategyContext") -> None:
        """
        Replace ctx.portfolio.{positions,equity} with live positions from the
        configured broker(s). No-op when source is 'off'. Cached for 30 s
        per (source, account_key) pair to avoid hammering brokers from a
        loop of portfolio_* nodes within a single tick.

        Raises if the requested broker isn't connected — the error bubbles up
        as a strategy-execution failure with a clear message.
        """
        if self.live_portfolio_source in ("", "off", "false", "0"):
            return

        source = self.live_portfolio_source
        account_key = self.live_portfolio_account_key
        cache_key = f"{source}:{account_key}"
        now = time.time()
        cached = self._live_portfolio_cache.get(cache_key)
        if cached and (now - cached[0]) < self._LIVE_PORTFOLIO_TTL_SEC:
            _, positions, equity = cached
            ctx.portfolio.positions = positions
            ctx.portfolio.equity = equity
            return

        if source == "avanza":
            positions, equity = self._fetch_avanza_portfolio(account_key)
        elif source == "ibkr":
            positions, equity = self._fetch_ibkr_portfolio(account_key)
        elif source == "all":
            positions, equity = self._fetch_all_portfolios(account_key)
        else:
            raise RuntimeError(
                f"Unknown livePortfolioSource '{source}'. "
                "Expected one of: off, avanza, ibkr, all."
            )

        self._live_portfolio_cache[cache_key] = (now, positions, equity)
        ctx.portfolio.positions = positions
        ctx.portfolio.equity = equity
        logger.info(
            "livePortfolio[%s] hydrated for '%s': %d positions, equity=%.2f",
            source, account_key, len(positions), equity,
        )

    # ── broker-specific fetchers (sync wrappers around async clients) ──

    def _run_async(self, coro):
        """Run an async coroutine from this sync method, regardless of whether
        we're already inside an asyncio loop."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                return asyncio.run_coroutine_threadsafe(coro, loop).result(timeout=20)
            return loop.run_until_complete(coro)
        except RuntimeError:
            return asyncio.run(coro)

    def _fetch_avanza_portfolio(self, account_key: str) -> tuple:
        """Returns (positions_dict, equity_sek). Raises if not connected."""
        from integrations.avanza.manager import get_manager
        from integrations.avanza.normalize import positions_from_avanza
        from integrations.avanza.storage import get_storage

        if not get_storage().load_credentials(account_key):
            raise RuntimeError(
                f"livePortfolioSource='avanza' but Avanza is not connected for account '{account_key}'. "
                "Connect Avanza in Settings."
            )

        async def _fetch():
            client = await get_manager().authed_client(account_key)
            acc_list = await client.accounts_list()
            ids = [
                str(a.get("urlParameterId"))
                for a in (acc_list if isinstance(acc_list, list) else [])
                if a.get("urlParameterId")
            ]
            pos_payload = await client.positions()
            totals = await client.performance_totals(ids) if ids else {}
            return pos_payload, totals

        pos_payload, totals = self._run_async(_fetch())
        rows = positions_from_avanza(pos_payload)
        positions: Dict[str, Position] = {}
        for r in rows:
            sym = r.get("symbol") or r.get("name") or r.get("orderbook_id")
            if not sym or not r.get("quantity"):
                continue
            positions[str(sym)] = Position(
                side="LONG",
                size=float(r["quantity"]),
                entry_price=float(r.get("average_price") or 0.0),
                entry_time=datetime.utcnow(),
            )
        equity_val = (
            (((totals or {}).get("totalValue") or {}).get("totalValue") or {}).get("value")
            if isinstance(totals, dict) else None
        )
        equity = float(equity_val or sum(float(r.get("market_value") or 0) for r in rows))
        return positions, equity

    def _fetch_ibkr_portfolio(self, account_key: str) -> tuple:
        """Returns (positions_dict, equity_usd). Raises if TWS is not connected."""
        from integrations.ibkr.manager import get_ibkr_manager

        mgr = get_ibkr_manager()

        async def _fetch():
            if not mgr.is_connected():
                ok = await mgr.ensure_connected_from_storage(account_key)
                if not ok:
                    raise RuntimeError(
                        "livePortfolioSource='ibkr' but TWS / IB Gateway is not reachable. "
                        "Start TWS and connect from Settings → Brokers."
                    )
            return await mgr.get_account()

        snap = self._run_async(_fetch())
        positions: Dict[str, Position] = {}
        for p in snap.positions:
            if p.qty == 0:
                continue
            positions[p.symbol] = Position(
                side="LONG" if p.qty > 0 else "SHORT",
                size=float(p.qty),
                entry_price=float(p.avg_price),
                entry_time=datetime.utcnow(),
            )
        return positions, float(snap.equity)

    def _fetch_all_portfolios(self, account_key: str) -> tuple:
        """Merge both brokers. Symbols are prefixed AVA:/IBKR: so they never
        collide. Equity is the sum (note: cross-currency, kept native)."""
        a_positions: Dict[str, Position] = {}
        i_positions: Dict[str, Position] = {}
        a_equity = 0.0
        i_equity = 0.0
        try:
            a_positions, a_equity = self._fetch_avanza_portfolio(account_key)
        except Exception as e:
            logger.warning("livePortfolio[all]: Avanza fetch failed: %s", e)
        try:
            i_positions, i_equity = self._fetch_ibkr_portfolio(account_key)
        except Exception as e:
            logger.warning("livePortfolio[all]: IBKR fetch failed: %s", e)
        if not a_positions and not i_positions:
            raise RuntimeError(
                "livePortfolioSource='all' but neither Avanza nor IBKR is connected. "
                "Connect at least one in Settings."
            )
        merged: Dict[str, Position] = {f"AVA:{k}": v for k, v in a_positions.items()}
        merged.update({f"IBKR:{k}": v for k, v in i_positions.items()})
        return merged, a_equity + i_equity

    def _get_inputs(self, node_id: str) -> Dict[str, Any]:
        return self.inputs.get(node_id, {})

    def _resolve_value(self, outputs: Dict[str, Dict[str, Any]], source: Dict[str, Optional[str]]) -> Any:
        source_id = source.get("nodeId")
        source_handle = source.get("sourceHandle") or "output"
        if source_id in outputs:
            return outputs[source_id].get(source_handle) or outputs[source_id].get("output")
        return None

    def evaluate(self, ctx: StrategyContext) -> List[OrderIntent]:
        # When `livePortfolio` is on in settings, fetch the user's actual
        # Avanza positions and stamp them into ctx.portfolio before any
        # portfolio_* node runs. Cached for 30s so high-frequency ticks
        # don't spam the broker API.
        self._maybe_hydrate_live_portfolio(ctx)

        outputs: Dict[str, Dict[str, Any]] = {}
        intents: List[OrderIntent] = []

        for node_id in self.node_order:
            node = self.nodes_by_id.get(node_id)
            if not node:
                continue
            ntype = node.get("type")
            data = node.get("data", {})
            inputs = self._get_inputs(node_id)

            if ntype == "indicator":
                node_outputs: Dict[str, Any] = {}
                prefix = f"{node_id}:"
                for key, series in ctx.indicator_cache.items():
                    if not key.startswith(prefix):
                        continue
                    handle = key.split(":", 1)[1]
                    if isinstance(series, np.ndarray):
                        node_outputs[handle] = float(series[ctx.index]) if ctx.index < len(series) else float("nan")
                    else:
                        node_outputs[handle] = series
                if not node_outputs:
                    node_outputs["output"] = ctx.indicator(node_id, "output")
                outputs[node_id] = node_outputs
                continue

            if ntype == "environment":
                env_type = data.get("environmentType")
                value: Any
                if env_type == "price":
                    value = ctx.bar.close
                elif env_type == "spread":
                    value = 0.0
                elif env_type == "prevCandleOpen":
                    value = ctx.history[max(0, ctx.index - 1)].open
                elif env_type == "prevCandleClose":
                    value = ctx.history[max(0, ctx.index - 1)].close
                elif env_type == "time":
                    value = ctx.bar.timestamp
                elif env_type == "dayOfWeek":
                    value = ctx.bar.timestamp.weekday()
                elif env_type == "newCandleOpen":
                    value = True
                elif env_type == "isMarketOpen":
                    value = True
                else:
                    value = ctx.bar.close
                outputs[node_id] = {"output": value}
                continue

            if ntype == "math":
                math_type = data.get("mathType")
                if math_type == "number":
                    outputs[node_id] = {"output": float(data.get("value", 0))}
                elif math_type == "advancedMath":
                    source = inputs.get("input", [])
                    edge_val = self._resolve_value(outputs, source[0]) if source else None
                    val = edge_val if edge_val is not None else data.get("input", 0.0)
                    func = data.get("mathFunction", "sqrt")
                    val = float(val or 0.0)
                    if func == "abs":
                        result = abs(val)
                    elif func == "sin":
                        result = float(np.sin(val))
                    elif func == "cos":
                        result = float(np.cos(val))
                    elif func == "tan":
                        result = float(np.tan(val))
                    elif func == "log":
                        result = float(np.log(max(val, 1e-9)))
                    elif func == "exp":
                        result = float(np.exp(val))
                    elif func == "floor":
                        result = float(np.floor(val))
                    elif func == "ceil":
                        result = float(np.ceil(val))
                    elif func == "round":
                        result = float(np.round(val))
                    else:
                        result = float(np.sqrt(max(val, 0.0)))
                    outputs[node_id] = {"output": result}
                else:
                    edge_a = self._resolve_value(outputs, inputs.get("input-a", [])[0]) if inputs.get("input-a") else None
                    edge_b = self._resolve_value(outputs, inputs.get("input-b", [])[0]) if inputs.get("input-b") else None
                    a = float(edge_a if edge_a is not None else data.get("inputA", 0.0))
                    b = float(edge_b if edge_b is not None else data.get("inputB", 0.0))
                    if math_type == "add":
                        result = a + b
                    elif math_type == "subtract":
                        result = a - b
                    elif math_type == "multiply":
                        result = a * b
                    elif math_type == "divide":
                        result = a / b if b != 0 else 0.0
                    else:
                        result = a
                    outputs[node_id] = {"output": result}
                continue

            if ntype == "variable":
                var_type = data.get("variableType")
                var_name = data.get("variableName")
                if var_type == "getVariable":
                    outputs[node_id] = {"output": ctx.variables.get(var_name)}
                else:
                    source = inputs.get("input", [])
                    edge_val = self._resolve_value(outputs, source[0]) if source else None
                    value = edge_val if edge_val is not None else data.get("value", 0.0)
                    if var_name:
                        if var_type == "changeVariable":
                            ctx.variables[var_name] = (ctx.variables.get(var_name, 0) or 0) + float(value or 0.0)
                        else:
                            ctx.variables[var_name] = value
                    outputs[node_id] = {"output": True}
                continue

            if ntype == "tradeInfo":
                info_type = data.get("tradeInfoType")
                position = next(iter(ctx.portfolio.positions.values()), None)
                value = 0.0
                if position:
                    if info_type == "entryPrice":
                        value = position.entry_price
                    elif info_type == "positionSize":
                        value = position.size
                    elif info_type == "pnl":
                        multiplier = 1 if position.side == "LONG" else -1
                        value = (ctx.bar.close - position.entry_price) * position.size * multiplier
                    elif info_type == "tradeDuration":
                        value = (ctx.bar.timestamp - position.entry_time).total_seconds()
                outputs[node_id] = {"output": value}
                continue

            if ntype == "portfolio":
                action = data.get("portfolioAction")
                symbol = data.get("symbol", "").upper()
                
                edge_threshold = self._resolve_value(outputs, inputs.get("threshold", [])[0]) if inputs.get("threshold") else None
                threshold = float(edge_threshold if edge_threshold is not None else data.get("threshold", 30))
                value = 0.0

                if action == "totalValue":
                    value = ctx.portfolio.equity
                elif action == "assetWeight" and symbol in ctx.portfolio.positions:
                    pos = ctx.portfolio.positions[symbol]
                    # basic approximation using current bar close if it matches symbol, else entry
                    price = ctx.bar.close if ctx.bar.symbol == symbol else pos.entry_price
                    pos_value = pos.size * price
                    value = (pos_value / max(ctx.portfolio.equity, 1e-9)) * 100
                elif action == "assetPnl" and symbol in ctx.portfolio.positions:
                    pos = ctx.portfolio.positions[symbol]
                    price = ctx.bar.close if ctx.bar.symbol == symbol else pos.entry_price
                    multiplier = 1 if pos.side == "LONG" else -1
                    value = (price - pos.entry_price) * pos.size * multiplier
                elif action == "concentrationCheck":
                    # Check if any position > threshold %
                    is_concentrated = False
                    for p_sym, pos in ctx.portfolio.positions.items():
                        price = ctx.bar.close if ctx.bar.symbol == p_sym else pos.entry_price
                        weight = ((pos.size * price) / max(ctx.portfolio.equity, 1e-9)) * 100
                        if weight > threshold:
                            is_concentrated = True
                            break
                    value = is_concentrated
                elif action == "diversificationScore":
                    # Simple mock score based on count of distinct symbols
                    value = min(100, len(ctx.portfolio.positions) * 10)
                elif action == "rebalanceSignal":
                    edge_drift = self._resolve_value(outputs, inputs.get("driftThreshold", [])[0]) if inputs.get("driftThreshold") else None
                    drift = float(edge_drift if edge_drift is not None else data.get("driftThreshold", 5))
                    
                    edge_target = self._resolve_value(outputs, inputs.get("targetPct", [])[0]) if inputs.get("targetPct") else None
                    target = float(edge_target if edge_target is not None else data.get("targetPct", 10))
                    if symbol in ctx.portfolio.positions:
                        pos = ctx.portfolio.positions[symbol]
                        price = ctx.bar.close if ctx.bar.symbol == symbol else pos.entry_price
                        weight = ((pos.size * price) / max(ctx.portfolio.equity, 1e-9)) * 100
                        value = abs(weight - target) > drift
                    else:
                        value = False

                outputs[node_id] = {"output": value}
                continue

            if ntype == "condition":
                condition_type = data.get("conditionType")
                if condition_type in {"and", "or"}:
                    left = self._resolve_value(outputs, inputs.get("input-a", [])[0]) if inputs.get("input-a") else False
                    right = self._resolve_value(outputs, inputs.get("input-b", [])[0]) if inputs.get("input-b") else False
                    result = bool(left) and bool(right) if condition_type == "and" else bool(left) or bool(right)
                elif condition_type == "not":
                    value = self._resolve_value(outputs, inputs.get("input", [])[0]) if inputs.get("input") else False
                    result = not bool(value)
                elif condition_type in {"crossover", "crossunder"}:
                    left = float(self._resolve_value(outputs, inputs.get("input-a", [])[0]) or 0.0)
                    right = float(self._resolve_value(outputs, inputs.get("input-b", [])[0]) or 0.0)
                    result = left > right if condition_type == "crossover" else left < right
                elif condition_type == "range":
                    edge_val = self._resolve_value(outputs, inputs.get("input-a", [])[0]) if inputs.get("input-a") else None
                    value = float(edge_val if edge_val is not None else 0.0)
                    
                    edge_min = self._resolve_value(outputs, inputs.get("minValue", [])[0]) if inputs.get("minValue") else None
                    min_val = float(edge_min if edge_min is not None else data.get("minValue", 0))
                    
                    edge_max = self._resolve_value(outputs, inputs.get("maxValue", [])[0]) if inputs.get("maxValue") else None
                    max_val = float(edge_max if edge_max is not None else data.get("maxValue", 0))
                    
                    result = min_val <= value <= max_val
                else:
                    edge_a = self._resolve_value(outputs, inputs.get("input-a", [])[0]) if inputs.get("input-a") else None
                    left = float(edge_a if edge_a is not None else data.get("inputA", 0.0))
                    
                    edge_b = self._resolve_value(outputs, inputs.get("input-b", [])[0]) if inputs.get("input-b") else None
                    if edge_b is None and condition_type == "threshold":
                        edge_b = self._resolve_value(outputs, inputs.get("value", [])[0]) if inputs.get("value") else None
                        
                    default_b = data.get("value", 0.0) if condition_type == "threshold" else data.get("inputB", 0.0)
                    right = float(edge_b if edge_b is not None else default_b)
                    op = data.get("operator", ">")
                    result = _compare(left, right, op)
                outputs[node_id] = {"output": result}
                continue

            if ntype == "risk":
                risk_type = data.get("riskType")
                if risk_type:
                    ctx.risk_config[risk_type] = data.get("value") or data.get("percentage")
                outputs[node_id] = {"output": ctx.risk_config.get(risk_type)}
                continue

            if ntype == "control":
                control_type = data.get("controlType")
                condition = True
                if inputs.get("condition"):
                    condition = bool(self._resolve_value(outputs, inputs.get("condition", [])[0]))
                if control_type == "ifElse":
                    outputs[node_id] = {"then": condition, "else": not condition, "output": condition}
                else:
                    outputs[node_id] = {"output": condition}
                continue

            if ntype == "llm":
                trigger = True
                if inputs.get("trigger"):
                    trigger = bool(self._resolve_value(outputs, inputs.get("trigger", [])[0]))
                if trigger and ctx.llm:
                    prompt = data.get("prompt", "")
                    schema = data.get("schema", {})
                    decision = ctx.llm(prompt, schema)
                else:
                    decision = data.get("fallback", {})
                outputs[node_id] = {"output": decision}
                continue

            if ntype == "action":
                trigger = True
                if inputs.get("trigger"):
                    trigger = bool(self._resolve_value(outputs, inputs.get("trigger", [])[0]))
                if not trigger:
                    outputs[node_id] = {"output": False}
                    continue

                action_type = data.get("actionType")
                if action_type == "order":
                    size_input = None
                    if inputs.get("size"):
                        size_input = self._resolve_value(outputs, inputs.get("size", [])[0])
                    size = float(size_input if size_input is not None else data.get("size", 0.0))
                    if size == 0.0:
                        pct = ctx.risk_config.get("positionPercent")
                        if pct and ctx.portfolio.equity:
                            size = (ctx.portfolio.equity * float(pct) / 100.0) / max(ctx.bar.close, 1e-9)
                        else:
                            size = 1.0
                    order_type = data.get("orderType", "market")
                    direction = data.get("direction", "long")
                    side = "BUY" if direction == "long" else "SELL"
                    
                    limit_price = None
                    if order_type in {"limit", "stop"}:
                        edge_limit = self._resolve_value(outputs, inputs.get("limitPrice", [])[0]) if inputs.get("limitPrice") else None
                        limit_price = float(edge_limit if edge_limit is not None else data.get("limitPrice", 0.0))
                        
                    edge_stop = self._resolve_value(outputs, inputs.get("stopPrice", [])[0]) if inputs.get("stopPrice") else None
                    stop_price = float(edge_stop if edge_stop is not None else data.get("stopPrice", 0.0))
                    if stop_price == 0.0:
                        stop_price = None
                        
                    edge_tp = self._resolve_value(outputs, inputs.get("takeProfitPrice", [])[0]) if inputs.get("takeProfitPrice") else None
                    take_profit_price = float(edge_tp if edge_tp is not None else data.get("takeProfitPrice", 0.0))
                    if take_profit_price == 0.0:
                        take_profit_price = None

                    intents.append(
                        OrderIntent(
                            symbol=data.get("symbol", self.settings.get("symbol", "UNKNOWN")),
                            side=side,
                            order_type=order_type,
                            size=size,
                            price=limit_price,
                            stop_loss=stop_price,
                            take_profit=take_profit_price,
                            tag=node_id,
                        )
                    )
                    outputs[node_id] = {"output": True}
                elif action_type == "options_order":
                    direction = data.get("direction", "buy")
                    side = "BUY" if direction == "buy" else "SELL"
                    size = float(data.get("size") or 1.0)
                    intents.append(
                        OrderIntent(
                            symbol=data.get("symbol", self.settings.get("symbol", "UNKNOWN")),
                            side=side,
                            order_type="options",
                            size=size,
                            tag=node_id,
                            metadata={
                                "option_type": data.get("optionType", "call"),
                                "strike": data.get("strike", "ATM")
                            }
                        )
                    )
                    outputs[node_id] = {"output": True}
                elif action_type == "portfolio_rebalance":
                    threshold = float(data.get("rebalanceThresholdPercent") or 5.0)
                    intents.append(
                        OrderIntent(
                            symbol="PORTFOLIO",
                            side="REBALANCE",
                            order_type="rebalance",
                            size=0,
                            tag=node_id,
                            metadata={
                                "rebalance_threshold": threshold
                            }
                        )
                    )
                    outputs[node_id] = {"output": True}
                elif action_type == "phoneCall":
                    # Realtime AI voice call. Fire-and-forget: the runtime is
                    # synchronous (per-bar) and we don't want to block the bar
                    # on Twilio's REST round-trip, so we kick this onto the
                    # current event loop if available, else to a thread.
                    try:
                        from services.voice import voice_call as voice_orch
                        from services import voice_db
                        import asyncio
                        import threading

                        user_id = (
                            data.get("userId")
                            or self.settings.get("userId")
                            or ctx.context.get("user_id") if hasattr(ctx, "context") else None
                        )
                        # Fall back to a single-tenant default if no user ctx
                        if not user_id:
                            import os
                            user_id = os.getenv("OPENQNT_DEFAULT_USER_ID")
                        if user_id:
                            profile = voice_db.get_user_voice_profile(user_id) or {}
                            phone = data.get("phoneNumber") or profile.get("phone_number")
                            transport = data.get("transport", "twilio")
                            # Tool surface: when the node explicitly opts into "trade",
                            # expose the full registry (confirm-tier tools are still
                            # gated by passphrase + verbal "yes" at dispatch time).
                            # Otherwise restrict to read-tier names pulled from the
                            # registry, so adding new read tools doesn't require
                            # editing this file.
                            if "trade" in (data.get("allowedActions") or []):
                                allowed = None  # full registry
                            else:
                                try:
                                    from services.voice.tool_dispatch import build_default_registry
                                    allowed = build_default_registry().names_for_risk("read")
                                except Exception:
                                    allowed = None

                            def _kick():
                                try:
                                    voice_orch.initiate_call(
                                        user_id=user_id,
                                        user_name=profile.get("name") or "trader",
                                        user_phone=phone,
                                        voice_trading_enabled=bool(profile.get("voice_trading_enabled")),
                                        opening_message=data.get("message", "Strategy alert."),
                                        transport=transport,
                                        trigger_source="node",
                                        allowed_tools=allowed,
                                        voice=data.get("voice", "Aoede"),
                                    )
                                except Exception:
                                    import logging
                                    logging.getLogger(__name__).exception("phoneCall node: initiate_call failed")

                            try:
                                loop = asyncio.get_event_loop()
                                loop.call_soon_threadsafe(_kick) if loop.is_running() else _kick()
                            except RuntimeError:
                                threading.Thread(target=_kick, daemon=True).start()
                    except Exception:
                        # Voice subsystem not available — backtests / paper-only setups
                        pass
                    outputs[node_id] = {"output": True}
                else:
                    outputs[node_id] = {"output": True}
                continue

            outputs[node_id] = {"output": None}

        return intents


def _compare(left: float, right: float, operator: str) -> bool:
    if operator == ">":
        return left > right
    if operator == ">=":
        return left >= right
    if operator == "<":
        return left < right
    if operator == "<=":
        return left <= right
    if operator == "==":
        return left == right
    if operator == "!=":
        return left != right
    return False


class FlowStrategy:
    def __init__(self, compiled: Dict[str, Any], config: Optional[Dict[str, Any]] = None):
        self.compiled = compiled
        self.config = config or {}
        self.interpreter = FlowInterpreter(compiled)
        self.variables: Dict[str, Any] = {}
        self.indicator_registry = IndicatorRegistry()
        self.risk_config: Dict[str, Any] = {}

    def on_bar(
        self,
        bar: Bar,
        history: List[Bar],
        index: int,
        portfolio: PortfolioState,
        indicator_cache: Optional[Dict[str, Any]] = None,
        llm: Optional[Callable[[str, Dict[str, Any]], Dict[str, Any]]] = None,
    ) -> List[OrderIntent]:
        ctx = StrategyContext(
            bar=bar,
            history=history,
            index=index,
            portfolio=portfolio,
            variables=self.variables,
            indicator_cache=indicator_cache or {},
            indicator_registry=self.indicator_registry,
            risk_config=self.risk_config,
            llm=llm,
        )
        return self.interpreter.evaluate(ctx)
