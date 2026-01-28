"""Live execution engine for Flow strategies."""

from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from flow.runtime import Bar, FlowStrategy, OrderIntent, PortfolioState, Position
except ImportError:
    from backend.flow.runtime import Bar, FlowStrategy, OrderIntent, PortfolioState, Position
import pandas as pd
import numpy as np


class BrokerClient:
    async def place_order(self, intent: OrderIntent) -> Dict[str, Any]:
        raise NotImplementedError

    async def cancel_order(self, order_id: str) -> Dict[str, Any]:
        raise NotImplementedError

    async def get_positions(self) -> Dict[str, Any]:
        raise NotImplementedError

    async def get_latest_bar(self, symbol: str) -> Optional[Bar]:
        raise NotImplementedError


class IGBrokerAdapter(BrokerClient):
    def __init__(self, ig_client):
        self.ig_client = ig_client

    async def place_order(self, intent: OrderIntent) -> Dict[str, Any]:
        try:
            from ig_client import get_epic_for_symbol
        except ImportError:
            from backend.ig_client import get_epic_for_symbol
        epic = get_epic_for_symbol(intent.symbol)
        if not epic:
            return {"success": False, "error": "Unknown symbol"}
        return await self.ig_client.create_position(
            epic=epic,
            direction=intent.side,
            size=intent.size,
            stop_distance=intent.stop_loss,
            limit_distance=intent.take_profit,
        )

    async def cancel_order(self, order_id: str) -> Dict[str, Any]:
        return await self.ig_client.delete_working_order(order_id)

    async def get_positions(self) -> Dict[str, Any]:
        return await self.ig_client.get_positions()

    async def get_latest_bar(self, symbol: str) -> Optional[Bar]:
        try:
            from ig_client import get_epic_for_symbol
        except ImportError:
            from backend.ig_client import get_epic_for_symbol
        epic = get_epic_for_symbol(symbol)
        if not epic:
            return None
        res = await self.ig_client.get_historical_prices(epic=epic, resolution="MINUTE_1", num_points=1)
        if not res.get("success"):
            return None
        prices = res.get("prices", [])
        if not prices:
            return None
        last = prices[-1]
        return Bar(
            timestamp=pd.to_datetime(last.get("timestamp") or last.get("snapshotTimeUTC")),
            open=float(last.get("open", last.get("close", 0))),
            high=float(last.get("high", last.get("close", 0))),
            low=float(last.get("low", last.get("close", 0))),
            close=float(last.get("close", 0)),
            volume=float(last.get("volume", 0)),
            symbol=symbol,
        )


class PaperBroker(BrokerClient):
    def __init__(self):
        self.orders: Dict[str, OrderIntent] = {}
        self.positions: Dict[str, Position] = {}

    async def place_order(self, intent: OrderIntent) -> Dict[str, Any]:
        order_id = f"paper_{len(self.orders)+1}"
        self.orders[order_id] = intent
        return {"success": True, "order_id": order_id}

    async def cancel_order(self, order_id: str) -> Dict[str, Any]:
        if order_id in self.orders:
            self.orders.pop(order_id)
            return {"success": True}
        return {"success": False, "error": "Order not found"}

    async def get_positions(self) -> Dict[str, Any]:
        return {"positions": {k: asdict(v) for k, v in self.positions.items()}}

    async def get_latest_bar(self, symbol: str) -> Optional[Bar]:
        return None


@dataclass
class LiveEngineConfig:
    symbol: str
    poll_interval: int = 60
    max_drawdown_pct: float = 20.0
    max_position_size: float = 1.0
    state_path: Optional[str] = None


class StateStore:
    def __init__(self, path: str):
        self.path = path
        os.makedirs(os.path.dirname(path), exist_ok=True)

    def save(self, data: Dict[str, Any]) -> None:
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    def load(self) -> Dict[str, Any]:
        if not os.path.exists(self.path):
            return {}
        with open(self.path, "r", encoding="utf-8") as f:
            return json.load(f)


class LiveExecutionEngine:
    def __init__(
        self,
        broker: BrokerClient,
        strategy_code: str,
        config: LiveEngineConfig,
    ):
        self.broker = broker
        self.strategy_code = strategy_code
        self.config = config
        self.strategy = self._load_strategy(strategy_code)
        self.portfolio = PortfolioState(cash=0.0, equity=0.0)
        self.history: List[Bar] = []
        self.running = False
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
        default_path = os.path.join(base_dir, f"live_state_{config.symbol}.json")
        self.state_store = StateStore(config.state_path or default_path)

    def _load_strategy(self, code: str) -> FlowStrategy:
        module: Dict[str, Any] = {}
        exec(code, module)
        strategy_cls = module.get("GeneratedStrategy") or module.get("Strategy")
        if not strategy_cls:
            raise ValueError("Strategy class not found in compiled code.")
        return strategy_cls()

    async def start(self):
        self.running = True
        self._restore_state()
        while self.running:
            await self.tick()
            await asyncio.sleep(self.config.poll_interval)

    def stop(self):
        self.running = False
        self._persist_state()

    async def tick(self):
        bar = await self.broker.get_latest_bar(self.config.symbol)
        if not bar:
            return
        self.history.append(bar)
        indicator_cache = self._build_indicator_cache()
        intents = self.strategy.on_bar(bar, self.history, len(self.history) - 1, self.portfolio, indicator_cache)
        for intent in intents:
            if intent.size > self.config.max_position_size:
                continue
            await self.broker.place_order(intent)
        self._persist_state()

    def _build_indicator_cache(self) -> Dict[str, Any]:
        if not self.history:
            return {}
        df = pd.DataFrame(
            [
                {
                    "timestamp": b.timestamp,
                    "open": b.open,
                    "high": b.high,
                    "low": b.low,
                    "close": b.close,
                    "volume": b.volume,
                }
                for b in self.history
            ]
        )
        df = df.set_index("timestamp")
        cache: Dict[str, Any] = {}
        for ind in self.strategy.compiled.get("indicator_defs", []):
            node_id = ind["node_id"]
            ind_type = (ind.get("indicatorType") or "").lower()
            params = ind.get("params", {})
            series = self.strategy.indicator_registry.compute(ind_type, df, params)
            if ind_type == "macd" and isinstance(series, np.ndarray) and series.ndim == 2:
                cache[f"{node_id}:line"] = series[0]
                cache[f"{node_id}:signal"] = series[1]
                cache[f"{node_id}:histogram"] = series[2]
                cache[f"{node_id}:output"] = series[0]
            elif ind_type == "bb" and isinstance(series, np.ndarray) and series.ndim == 2:
                cache[f"{node_id}:upper"] = series[0]
                cache[f"{node_id}:middle"] = series[1]
                cache[f"{node_id}:lower"] = series[2]
                cache[f"{node_id}:output"] = series[1]
            else:
                cache[f"{node_id}:output"] = series
        return cache

    def _persist_state(self):
        state = {
            "timestamp": datetime.utcnow().isoformat(),
            "symbol": self.config.symbol,
            "history_count": len(self.history),
            "portfolio": asdict(self.portfolio),
        }
        self.state_store.save(state)

    def _restore_state(self):
        state = self.state_store.load()
        if not state:
            return
        portfolio = state.get("portfolio", {})
        self.portfolio.cash = portfolio.get("cash", 0.0)
        self.portfolio.equity = portfolio.get("equity", 0.0)
