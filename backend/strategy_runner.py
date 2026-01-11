"""
Live Strategy Runner

Executes NautilusTrader-compatible Python strategies against live market data from IG.
"""

import asyncio
import traceback
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Callable
import pandas as pd
import importlib
import sys
import types

try:
    from backend.ig_client import IGClient, get_epic_for_symbol
    from backend.database.connection import session_scope
    from backend.database.models import StrategyExecution, Trade
except ImportError:
    from ig_client import IGClient, get_epic_for_symbol
    from database.connection import session_scope
    from database.models import StrategyExecution, Trade
# We don't use xml_evaluator anymore for execution, only for validation if needed
# from xml_evaluator import ...

# Mock Objects for Nautilus Environment
class MockLogger:
    def info(self, msg): print(f"[STRATEGY INFO] {msg}")
    def warn(self, msg): print(f"[STRATEGY WARN] {msg}")
    def error(self, msg): print(f"[STRATEGY ERROR] {msg}")

class MockInstrument:
    def __init__(self, symbol):
        self.id = symbol
        self.symbol = symbol

class MockCache:
    def __init__(self, symbol):
        self.instrument_obj = MockInstrument(symbol)
    
    def instruments(self):
        return [self.instrument_obj]

class MockOrderFactory:
    def market(self, instrument_id, order_side, quantity, time_in_force=None):
        return {
            "instrument_id": instrument_id,
            "order_side": order_side,
            "quantity": quantity,
            "type": "MARKET"
        }

class MockPortfolio:
    def __init__(self, instrument_id):
        self.instrument_id = instrument_id
        self.positions = {} # {instrument_id: size}
        self.long_exposure = False
        self.short_exposure = False

    def is_net_long(self, instrument_id):
        return self.positions.get(instrument_id, 0) > 0

    def is_net_short(self, instrument_id):
        return self.positions.get(instrument_id, 0) < 0

    def net_exposures(self):
        # Mock equity or exposure
        return {self.instrument_id: 10000.0} # Mock equity

# ... imports ...

class StrategyRunner:
    """
    Runs a Python (Nautilus-generated) strategy against live market data.
    Acts as a 'Harness' or 'Adapter' to bridge Nautilus code -> IG/Nordnet Execution.
    """
    
    def __init__(
        self,
        broker_client: Any,
        broker_type: str,
        strategy_code: str,
        symbol: str = "EURUSD",
        trade_size: float = 0.5,
        poll_interval: int = 60,
        lookback_bars: int = 100,
        live_mode: bool = False,
        safety_config: Dict[str, Any] = None
    ):
        self.broker_client = broker_client
        self.broker_type = broker_type
        self.strategy_code = strategy_code
        self.symbol = symbol
        
        # Resolving ID/EPIC
        if self.broker_type == 'ig':
            self.instrument_id = get_epic_for_symbol(symbol)
        elif self.broker_type == 'nordnet':
            self.instrument_id = symbol 
            
        self.trade_size = trade_size
        self.poll_interval = poll_interval
        self.lookback_bars = lookback_bars
        self.live_mode = live_mode
        self.safety_config = safety_config or {"max_size": 2.0, "max_drawdown": 500}
        
        self.is_running = False
        self.strategy_instance = None
        
        self.trades: List[Dict] = []
        self.last_signal: Optional[str] = None
        self.last_price: Optional[float] = None
        
        # Callbacks
        self.on_trade: Optional[Callable] = None
        self.on_error: Optional[Callable] = None
        
        self.execution_db_id: Optional[int] = None

    # ... _compile_and_load_strategy preserved ...
    def _compile_and_load_strategy(self):
        # Using existing implementation but patched for context
        try:
            module = types.ModuleType("dynamic_strategy")
            exec(self.strategy_code, module.__dict__)
            
            target_class = None
            if hasattr(module, "GeneratedStrategy"):
                target_class = getattr(module, "GeneratedStrategy")
            else:
                for name, obj in module.__dict__.items():
                    if isinstance(obj, type) and name.endswith("Strategy") and name != "Strategy":
                        target_class = obj
                        break
            
            if not target_class:
                raise Exception("Could not find 'GeneratedStrategy' class in code")

            instance = target_class(config=None)
            
            instance.log = MockLogger()
            instance.cache = MockCache(self.symbol)
            instance.order_factory = MockOrderFactory()
            instance.portfolio = MockPortfolio(self.symbol)
            instance.clock = type("MockClock", (), {"utc_now": lambda: datetime.utcnow()})()
            
            instance.submit_order = self._handle_order
            instance.close_all_positions = self._handle_close_all
            
            return instance
            
        except Exception as e:
            print(f"Error compiling strategy: {e}")
            traceback.print_exc()
            raise e

    def _handle_order(self, order):
        """Intercepts Nautilus submit_order calls."""
        print(f"[STRATEGY EXECUTOR] Intercepted Order: {order}")
        
        direction = str(order['order_side']).upper().replace("ORDERSIDE.", "") 
        if "BUY" in direction: direction = "BUY"
        elif "SELL" in direction: direction = "SELL"
        
        size = self.trade_size
        
        # SAFETY CHECK
        if size > self.safety_config.get("max_size", 2.0):
            print(f"[SAFETY] Order size {size} exceeds max {self.safety_config['max_size']}. Rejected.")
            return

        if self.live_mode:
            print(f"[LIVE EXECUTION] Sending {direction} {size} to {self.broker_type}")
            if self.broker_type == 'ig':
                asyncio.create_task(self._execute_ig_trade(direction, size))
            elif self.broker_type == 'nordnet':
                asyncio.create_task(self._execute_nordnet_trade(direction, size))
        else:
            print(f"[PAPER EXECUTION] Simulate {direction} {size}")
            # Simulate fill immediately
            self._record_trade(direction, size, f"PAPER_{int(datetime.now().timestamp())}")

    def _handle_close_all(self, instrument_id):
        print("[STRATEGY EXECUTOR] Intercepted Close All")
        if self.live_mode:
            if self.broker_type == 'ig':
                asyncio.create_task(self._close_ig_position())
            # Nordnet close logic TODO
        else:
             print("[PAPER EXECUTION] Simulate Close All")
             self.strategy_instance.portfolio.positions[self.symbol] = 0

    # ... IG Execution Methods (preserved) ...
    async def _execute_ig_trade(self, direction, size):
        print(f"[IG EXECUTION] executing {direction} {size}...")
        try:
            result = await self.broker_client.create_position(self.instrument_id, direction, size)
            if result.get("success"):
                self._record_trade(direction, size, result.get("deal_reference"))
            else:
                print(f"[IG ERROR] {result.get('error')}")
        except Exception as e:
            print(f"[IG EXCEPTION] {e}")
            
    async def _close_ig_position(self):
        try:
            positions_res = await self.broker_client.get_positions()
            if positions_res.get("success"):
                for pos in positions_res.get("positions", []):
                    if pos['epic'] == self.instrument_id:
                        await self.broker_client.close_position(pos['dealId'])
                        self.strategy_instance.portfolio.positions[self.symbol] = 0
                        print(f"[IG CLOSE] Closed {pos['dealId']}")
        except Exception as e:
            print(f"[IG CLOSE ERROR] {e}")

    # ... Nordnet Execution Methods ...
    async def _execute_nordnet_trade(self, direction, size):
        # Preserved but guarded by live_mode check in _handle_order
        print(f"[NORDNET EXECUTION] executing {direction} {size}...")
        try:
            accounts = self.broker_client.get_accounts()
            if not accounts:
                print("[NORDNET ERROR] No accounts found")
                return
            
            acc_id = accounts[0]['accid'] 
            price = self.last_price
            
            result = self.broker_client.place_order(
                account_id=acc_id,
                market_id=1, 
                identifier=self.instrument_id, 
                side=direction,
                volume=int(size) if size >= 1 else 1,
                price=price
            )
            
            if result.get("success"):
                self._record_trade(direction, size, result['data'].get('order_id'))
            else:
                print(f"[NORDNET ERROR] {result.get('error')}")
        except Exception as e:
            print(f"[NORDNET EXCEPTION] {e}")

    def _record_trade(self, direction, size, ref):
        self.strategy_instance.portfolio.positions[self.symbol] = size if direction == "BUY" else -size
        trade = {
            'time': datetime.now().isoformat(),
            'action': direction,
            'price': self.last_price or 0,
            'size': size,
            'deal_ref': ref
        }
        self.trades.append(trade)
        
        # Persist to DB
        try:
             with session_scope() as session:
                db_trade = Trade(
                    execution_id=self.execution_db_id,
                    symbol=self.symbol,
                    direction=direction,
                    entry_time=datetime.now(),
                    entry_price=self.last_price or 0,
                    size=size,
                    broker_ref=str(ref),
                    status="OPEN"
                )
                session.add(db_trade)
        except Exception as e:
            print(f"[PERSIST ERROR] Failed to save trade: {e}")
            
        if self.on_trade: self.on_trade(trade)

    async def start(self):
        try:
            # Check auth ONLY if LIVE
            if self.live_mode:
                if self.broker_type == 'ig' and not self.broker_client.is_authenticated:
                    await self.broker_client.login()
                elif self.broker_type == 'nordnet' and not self.broker_client.session_key:
                    pass
            
            self.strategy_instance = self._compile_and_load_strategy()
            self.strategy_instance.on_start()
            
            self.is_running = True
            
            # Create Execution Record
            try:
                with session_scope() as session:
                    execution = StrategyExecution(
                        strategy_name="PythonStrategy", 
                        symbol=self.symbol,
                        status="running" if self.live_mode else "running_paper",
                        configuration=str(self.trade_size)
                    )
                    session.add(execution)
                    session.flush()
                    self.execution_db_id = execution.id
            except Exception as e:
                print(f"[PERSIST ERROR] Failed to create execution record: {e}")
            
            print(f"[RUNNER] Started Python Strategy for {self.symbol} ({self.broker_type}) [LIVE={self.live_mode}]")
            
            while self.is_running:
                await self._tick()
                await asyncio.sleep(self.poll_interval)
                
        except Exception as e:
            print(f"[RUNNER ERROR] {e}")
            traceback.print_exc()
            self.is_running = False
            if self.on_error: self.on_error(str(e))

    def stop(self):
        self.is_running = False
        
        # Update Execution Record
        if self.execution_db_id:
            try:
                with session_scope() as session:
                    execution = session.query(StrategyExecution).get(self.execution_db_id)
                    if execution:
                        execution.end_time = datetime.utcnow()
                        execution.status = "stopped"
            except Exception as e:
                print(f"[PERSIST ERROR] Failed to close execution: {e}")

        if self.strategy_instance:
            self.strategy_instance.on_stop()

    def get_status(self) -> Dict[str, Any]:
        return {
            'is_running': self.is_running,
            'live_mode': self.live_mode,
            'symbol': self.symbol,
            'broker': self.broker_type,
            'last_price': self.last_price,
            'active_trades': len(self.strategy_instance.portfolio.positions) if self.strategy_instance and hasattr(self.strategy_instance, 'portfolio') else 0,
            'total_trades': len(self.trades),
            'recent_trades': self.trades[-5:] if self.trades else []
        }

    def update_parameters(self, trade_size: Optional[float] = None, safety_config: Optional[Dict[str, Any]] = None):
        """Dynamically update strategy parameters at runtime."""
        changes = []
        if trade_size is not None:
            old_size = self.trade_size
            self.trade_size = trade_size
            changes.append(f"Trade Size: {old_size} -> {trade_size}")
            
        if safety_config is not None:
            # Merge with existing
            if not self.safety_config: self.safety_config = {}
            for k, v in safety_config.items():
                self.safety_config[k] = v
            changes.append(f"Safety Config Updated: {list(safety_config.keys())}")
            
        print(f"[RUNNER] Dynamic Update: {', '.join(changes)}")
        return {"success": True, "changes": changes}

    async def _tick(self):
        # Fetch Data
        # Even in Paper mode, we need Live Data to generate signals
        if self.broker_type == 'ig':
            hist = await self.broker_client.get_historical_prices(self.instrument_id, resolution="MINUTE_1", num_points=self.lookback_bars)
            if not hist.get("success"): return
            prices = hist.get("prices", [])
            if not prices: return
            last_price_data = prices[-1]
            data = last_price_data 
            
        elif self.broker_type == 'nordnet':
            trade = self.broker_client.get_market_price(market_id=11, identifier=self.instrument_id) 
            if not trade: 
                 print("No Nordnet trade data")
                 return
            price = trade['price']
            data = {
                'open': price, 'high': price, 'low': price, 'close': price, 'volume': trade['volume']
            }
        
        # Define MockBar (Shared)
        class MockBar:
            def __init__(self, data):
                self.open = data.get('open')
                self.high = data.get('high')
                self.low = data.get('low')
                self.close = data.get('close')
                self.volume = data.get('volume', 0)
                self.ts_event = int(datetime.utcnow().timestamp() * 1e9)

        bar = MockBar(data)
        self.last_price = bar.close
        
        self.strategy_instance.bar_type = "1m"
        self.strategy_instance.on_bar(bar)


# Global runner management
_active_runner: Optional[StrategyRunner] = None
_runner_task: Optional[asyncio.Task] = None

async def start_strategy_runner(
    broker_client: Any,
    python_code: str, 
    symbol: str = "EURUSD",
    trade_size: float = 0.5,
    poll_interval: int = 60,
    broker_type: str = "ig",
    live_mode: bool = False
) -> Dict[str, Any]:
    global _active_runner, _runner_task
    
    if _active_runner:
        _active_runner.stop()
        if _runner_task: _runner_task.cancel()
    
    print(f"=== Starting Python Strategy Runner (LIVE={live_mode}) ===")
    
    _active_runner = StrategyRunner(
        broker_client=broker_client,
        broker_type=broker_type,
        strategy_code=python_code,
        symbol=symbol,
        trade_size=trade_size,
        poll_interval=poll_interval,
        live_mode=live_mode
    )
    
    _runner_task = asyncio.create_task(_active_runner.start())
    
    return {
        'success': True,
        'message': f'Strategy started on {symbol} via {broker_type} (Mode: {"LIVE" if live_mode else "PAPER"})',
        'status': _active_runner.get_status()
    }
    
# ... stop_strategy_runner, get_runner_status preserved ...
def stop_strategy_runner():
    global _active_runner
    if _active_runner:
        _active_runner.stop()
        _active_runner = None
        return {'success': True}
    return {'success': False, 'error': 'No runner active'}

def get_runner_status():
    global _active_runner
    if _active_runner:
        return _active_runner.get_status()
    return {'success': False, 'active': False}

def update_runner_parameters(trade_size: Optional[float] = None, safety_config: Optional[Dict[str, Any]] = None):
    """
    Global helper to update the active runner's parameters.
    """
    global _active_runner
    if _active_runner and _active_runner.is_running:
        return _active_runner.update_parameters(trade_size, safety_config)
    return {'success': False, 'error': 'No active runner'}


