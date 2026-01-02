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

from ig_client import IGClient, get_epic_for_symbol
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
        lookback_bars: int = 100
    ):
        self.broker_client = broker_client
        self.broker_type = broker_type
        self.strategy_code = strategy_code
        self.symbol = symbol
        
        # Resolving ID/EPIC
        if self.broker_type == 'ig':
            self.instrument_id = get_epic_for_symbol(symbol)
        elif self.broker_type == 'nordnet':
            self.instrument_id = symbol # For Nordnet, user typically provides 'ID' directly for now? Or we need mapping.
            # Assuming 'symbol' passed is the ID.
            
        self.trade_size = trade_size
        self.poll_interval = poll_interval
        self.lookback_bars = lookback_bars
        
        self.is_running = False
        self.strategy_instance = None
        
        self.trades: List[Dict] = []
        self.last_signal: Optional[str] = None
        self.last_price: Optional[float] = None
        
        # Callbacks
        self.on_trade: Optional[Callable] = None
        self.on_error: Optional[Callable] = None

    def _compile_and_load_strategy(self):
        # ... (same as before) ...
        try:
            # Create a new module to execute code in
            module = types.ModuleType("dynamic_strategy")
            
            # Execute the code in the module's namespace
            exec(self.strategy_code, module.__dict__)
            
            # Find the Strategy class
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

            # Instantiate
            instance = target_class(config=None)
            
            # Inject Mock Environment
            instance.log = MockLogger()
            instance.cache = MockCache(self.symbol)
            instance.order_factory = MockOrderFactory()
            instance.portfolio = MockPortfolio(self.symbol)
            instance.clock = type("MockClock", (), {"utc_now": lambda: datetime.utcnow()})()
            
            # Patch submit_order
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
        
        if self.broker_type == 'ig':
            asyncio.create_task(self._execute_ig_trade(direction, size))
        elif self.broker_type == 'nordnet':
            asyncio.create_task(self._execute_nordnet_trade(direction, size))

    def _handle_close_all(self, instrument_id):
        print("[STRATEGY EXECUTOR] Intercepted Close All")
        if self.broker_type == 'ig':
            asyncio.create_task(self._close_ig_position())
        # Nordnet close logic TODO

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
        print(f"[NORDNET EXECUTION] executing {direction} {size}...")
        try:
            # Need account ID. Assuming client manages one default account or we pick first?
            accounts = self.broker_client.get_accounts()
            if not accounts:
                print("[NORDNET ERROR] No accounts found")
                return
            
            acc_id = accounts[0]['accid'] # Pick first
            
            # place_order(self, account_id, market_id, identifier, side, volume, price, currency="SEK")
            # For LIMIT. But standard strat often uses MARKET or simple entry.
            # Nordnet might require LIMIT price even for "market"?
            # If API supports 'MARKET' order_type, fine.
            # Our client defaults to LIMIT.
            # We need a price.
            price = self.last_price
            
            result = self.broker_client.place_order(
                account_id=acc_id,
                market_id=1, # Hack? Need proper market lookup
                identifier=self.instrument_id, 
                side=direction,
                volume=int(size) if size >= 1 else 1, # Nordnet usually integer shares?
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
        if self.on_trade: self.on_trade(trade)

    async def start(self):
        try:
            # Check auth
            if self.broker_type == 'ig' and not self.broker_client.is_authenticated:
                await self.broker_client.login()
            elif self.broker_type == 'nordnet' and not self.broker_client.session_key:
                # Login handled outside?
                pass
            
            self.strategy_instance = self._compile_and_load_strategy()
            self.strategy_instance.on_start()
            
            self.is_running = True
            print(f"[RUNNER] Started Python Strategy for {self.symbol} ({self.broker_type})")
            
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
        if self.strategy_instance:
            self.strategy_instance.on_stop()

    def get_status(self) -> Dict[str, Any]:
        return {
            'is_running': self.is_running,
            'symbol': self.symbol,
            'broker': self.broker_type,
            'last_price': self.last_price,
            'active_trades': len(self.strategy_instance.portfolio.positions) if self.strategy_instance and hasattr(self.strategy_instance, 'portfolio') else 0,
            'total_trades': len(self.trades),
            'recent_trades': self.trades[-5:] if self.trades else []
        }

    async def _tick(self):
        # Fetch Data
        if self.broker_type == 'ig':
            hist = await self.broker_client.get_historical_prices(self.instrument_id, resolution="MINUTE_1", num_points=self.lookback_bars)
            if not hist.get("success"): return
            prices = hist.get("prices", [])
            if not prices: return
            last_price_data = prices[-1]
            # Construct mock data dict
            data = last_price_data # already has open, high, low, close...
            
        elif self.broker_type == 'nordnet':
            # Use get_market_price implementation
            # We assume polling last trade
            trade = self.broker_client.get_market_price(market_id=11, identifier=self.instrument_id) 
            if not trade: 
                 print("No Nordnet trade data")
                 return
            
            # Construct pseudo-candle from last trade price
            # This is NOT perfect but "works" for functional connectivity testing
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
    broker_type: str = "ig"
) -> Dict[str, Any]:
    global _active_runner, _runner_task
    
    if _active_runner:
        _active_runner.stop()
        if _runner_task: _runner_task.cancel()
    
    print("=== Starting Python Strategy Runner ===")
    
    _active_runner = StrategyRunner(
        broker_client=broker_client,
        broker_type=broker_type,
        strategy_code=python_code,
        symbol=symbol,
        trade_size=trade_size,
        poll_interval=poll_interval
    )
    
    _runner_task = asyncio.create_task(_active_runner.start())
    
    return {
        'success': True,
        'message': f'Strategy started on {symbol} via {broker_type}',
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

