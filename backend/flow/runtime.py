"""Runtime support for Flow-compiled strategies."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

import numpy as np
import pandas as pd


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
    def __init__(self, compiled: Dict[str, Any]):
        self.compiled = compiled
        self.nodes_by_id = {n["id"]: n for n in compiled.get("nodes", [])}
        self.inputs = compiled.get("inputs", {})
        self.node_order = compiled.get("node_order", [])
        self.settings = compiled.get("settings", {})

    def _get_inputs(self, node_id: str) -> Dict[str, Any]:
        return self.inputs.get(node_id, {})

    def _resolve_value(self, outputs: Dict[str, Dict[str, Any]], source: Dict[str, Optional[str]]) -> Any:
        source_id = source.get("nodeId")
        source_handle = source.get("sourceHandle") or "output"
        if source_id in outputs:
            return outputs[source_id].get(source_handle) or outputs[source_id].get("output")
        return None

    def evaluate(self, ctx: StrategyContext) -> List[OrderIntent]:
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
                    val = self._resolve_value(outputs, source[0]) if source else 0.0
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
                    a = self._resolve_value(outputs, inputs.get("input-a", [])[0]) if inputs.get("input-a") else 0.0
                    b = self._resolve_value(outputs, inputs.get("input-b", [])[0]) if inputs.get("input-b") else 0.0
                    a = float(a or 0.0)
                    b = float(b or 0.0)
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
                    value = self._resolve_value(outputs, source[0]) if source else data.get("value")
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
                    value = float(self._resolve_value(outputs, inputs.get("input-a", [])[0]) or 0.0)
                    result = data.get("minValue", 0) <= value <= data.get("maxValue", 0)
                else:
                    left = float(self._resolve_value(outputs, inputs.get("input-a", [])[0]) or 0.0)
                    right = float(self._resolve_value(outputs, inputs.get("input-b", [])[0]) or data.get("value", 0))
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
                    size = float(size_input or data.get("size") or 0.0)
                    if size == 0.0:
                        pct = ctx.risk_config.get("positionPercent")
                        if pct and ctx.portfolio.equity:
                            size = (ctx.portfolio.equity * float(pct) / 100.0) / max(ctx.bar.close, 1e-9)
                        else:
                            size = 1.0
                    order_type = data.get("orderType", "market")
                    direction = data.get("direction", "long")
                    side = "BUY" if direction == "long" else "SELL"
                    price = data.get("limitPrice") if order_type in {"limit", "stop"} else None
                    intents.append(
                        OrderIntent(
                            symbol=data.get("symbol", self.settings.get("symbol", "UNKNOWN")),
                            side=side,
                            order_type=order_type,
                            size=size,
                            price=price,
                            stop_loss=data.get("stopPrice"),
                            take_profit=data.get("takeProfitPrice"),
                            tag=node_id,
                        )
                    )
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
