"""
Live Strategy Runner

Executes Blockly trading strategies against live market data from IG.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Callable
import pandas as pd

from ig_client import IGClient, get_epic_for_symbol
from xml_evaluator import BlocklyXMLEvaluator


class StrategyRunner:
    """
    Runs a Blockly strategy against live market data.
    
    Features:
    - Polls IG for latest prices at configurable interval
    - Evaluates buy/sell conditions from parsed Blockly XML
    - Executes trades automatically via IG API
    - Tracks open positions and P&L
    """
    
    def __init__(
        self,
        ig_client: IGClient,
        xml_strategy: str,
        symbol: str = "EURUSD",
        trade_size: float = 0.5,
        poll_interval: int = 60,  # seconds
        lookback_bars: int = 100
    ):
        self.ig_client = ig_client
        self.symbol = symbol
        self.epic = get_epic_for_symbol(symbol)
        self.trade_size = trade_size
        self.poll_interval = poll_interval
        self.lookback_bars = lookback_bars
        
        # Parse strategy
        self.evaluator = BlocklyXMLEvaluator(xml_strategy)
        
        # State
        self.is_running = False
        self.current_position: Optional[str] = None  # "long", "short", or None
        self.position_deal_id: Optional[str] = None
        self.trades: List[Dict] = []
        self.last_signal: Optional[str] = None
        self.last_price: Optional[float] = None
        
        # Callbacks
        self.on_trade: Optional[Callable] = None
        self.on_signal: Optional[Callable] = None
        self.on_error: Optional[Callable] = None
    
    async def start(self):
        """Start the strategy runner loop."""
        if not self.ig_client.is_authenticated:
            raise Exception("IG client not authenticated")
        
        if not self.epic:
            raise Exception(f"Unknown symbol: {self.symbol}")
        
        self.is_running = True
        print(f"Strategy runner started for {self.symbol} ({self.epic})")
        print(f"Trade size: {self.trade_size}, Poll interval: {self.poll_interval}s")
        
        while self.is_running:
            try:
                await self._tick()
            except Exception as e:
                print(f"Strategy runner error: {e}")
                if self.on_error:
                    self.on_error(str(e))
            
            await asyncio.sleep(self.poll_interval)
    
    def stop(self):
        """Stop the strategy runner."""
        self.is_running = False
        print("Strategy runner stopped")
    
    async def _tick(self):
        """Single tick of the strategy loop."""
        # Fetch latest prices
        result = await self.ig_client.get_historical_prices(
            epic=self.epic,
            resolution="MINUTE_5",
            num_points=self.lookback_bars
        )
        
        if not result.get("success"):
            print(f"Failed to fetch prices: {result.get('error')}")
            return
        
        prices = result.get("prices", [])
        if not prices:
            return
        
        # Convert to DataFrame
        data = pd.DataFrame(prices)
        data['timestamp'] = pd.to_datetime(data['timestamp'])
        
        # Calculate indicators
        data = self.evaluator.calculate_indicators(data)
        
        # Get latest bar index
        latest_idx = len(data) - 1
        self.last_price = data.iloc[latest_idx]['close']
        
        # Evaluate conditions
        should_buy = self.evaluator.should_buy(data, latest_idx)
        should_sell = self.evaluator.should_sell(data, latest_idx)
        
        # Log signals
        if should_buy and self.last_signal != 'buy':
            print(f"[{datetime.now()}] BUY signal @ {self.last_price}")
            self.last_signal = 'buy'
            if self.on_signal:
                self.on_signal('buy', self.last_price)
        
        if should_sell and self.last_signal != 'sell':
            print(f"[{datetime.now()}] SELL signal @ {self.last_price}")
            self.last_signal = 'sell'
            if self.on_signal:
                self.on_signal('sell', self.last_price)
        
        # Execute trades
        await self._execute_signals(should_buy, should_sell)
    
    async def _execute_signals(self, should_buy: bool, should_sell: bool):
        """Execute trades based on signals."""
        
        # Buy signal - open long or close short
        if should_buy and self.current_position != 'long':
            # Close existing short position
            if self.current_position == 'short' and self.position_deal_id:
                await self._close_position()
            
            # Open long
            result = await self.ig_client.create_position(
                epic=self.epic,
                direction="BUY",
                size=self.trade_size
            )
            
            if result.get("success"):
                self.current_position = 'long'
                self.position_deal_id = result.get("deal_reference")
                trade = {
                    'time': datetime.now().isoformat(),
                    'action': 'BUY',
                    'price': self.last_price,
                    'size': self.trade_size,
                    'deal_ref': self.position_deal_id
                }
                self.trades.append(trade)
                print(f"Opened LONG position @ {self.last_price}")
                
                if self.on_trade:
                    self.on_trade(trade)
            else:
                print(f"Failed to open position: {result.get('error')}")
        
        # Sell signal - open short or close long
        elif should_sell and self.current_position != 'short':
            # Close existing long position
            if self.current_position == 'long' and self.position_deal_id:
                await self._close_position()
            
            # Open short
            result = await self.ig_client.create_position(
                epic=self.epic,
                direction="SELL",
                size=self.trade_size
            )
            
            if result.get("success"):
                self.current_position = 'short'
                self.position_deal_id = result.get("deal_reference")
                trade = {
                    'time': datetime.now().isoformat(),
                    'action': 'SELL',
                    'price': self.last_price,
                    'size': self.trade_size,
                    'deal_ref': self.position_deal_id
                }
                self.trades.append(trade)
                print(f"Opened SHORT position @ {self.last_price}")
                
                if self.on_trade:
                    self.on_trade(trade)
            else:
                print(f"Failed to open position: {result.get('error')}")
    
    async def _close_position(self):
        """Close the current position."""
        if not self.position_deal_id:
            return
        
        direction = "SELL" if self.current_position == 'long' else "BUY"
        
        result = await self.ig_client.close_position(
            deal_id=self.position_deal_id,
            direction=direction,
            size=self.trade_size
        )
        
        if result.get("success"):
            trade = {
                'time': datetime.now().isoformat(),
                'action': f'CLOSE_{self.current_position.upper()}',
                'price': self.last_price,
                'size': self.trade_size,
                'deal_ref': self.position_deal_id
            }
            self.trades.append(trade)
            print(f"Closed {self.current_position} position @ {self.last_price}")
            
            if self.on_trade:
                self.on_trade(trade)
        else:
            print(f"Failed to close position: {result.get('error')}")
        
        self.current_position = None
        self.position_deal_id = None
    
    def get_status(self) -> Dict[str, Any]:
        """Get current status of the runner."""
        return {
            'is_running': self.is_running,
            'symbol': self.symbol,
            'epic': self.epic,
            'current_position': self.current_position,
            'last_signal': self.last_signal,
            'last_price': self.last_price,
            'trade_count': len(self.trades),
            'recent_trades': self.trades[-5:] if self.trades else []
        }


# Global runner instance
_active_runner: Optional[StrategyRunner] = None
_runner_task: Optional[asyncio.Task] = None


async def start_strategy_runner(
    ig_client: IGClient,
    xml_strategy: str,
    symbol: str = "EURUSD",
    trade_size: float = 0.5,
    poll_interval: int = 60
) -> Dict[str, Any]:
    """Start a strategy runner (global singleton)."""
    global _active_runner, _runner_task
    
    # Stop existing runner
    if _active_runner:
        _active_runner.stop()
        if _runner_task:
            _runner_task.cancel()
    
    # Create new runner
    _active_runner = StrategyRunner(
        ig_client=ig_client,
        xml_strategy=xml_strategy,
        symbol=symbol,
        trade_size=trade_size,
        poll_interval=poll_interval
    )
    
    # Start in background
    _runner_task = asyncio.create_task(_active_runner.start())
    
    return {
        'success': True,
        'message': f'Strategy runner started for {symbol}',
        'status': _active_runner.get_status()
    }


def stop_strategy_runner() -> Dict[str, Any]:
    """Stop the active strategy runner."""
    global _active_runner, _runner_task
    
    if _active_runner:
        _active_runner.stop()
        if _runner_task:
            _runner_task.cancel()
        
        status = _active_runner.get_status()
        _active_runner = None
        _runner_task = None
        
        return {
            'success': True,
            'message': 'Strategy runner stopped',
            'final_status': status
        }
    
    return {
        'success': False,
        'error': 'No active strategy runner'
    }


def get_runner_status() -> Dict[str, Any]:
    """Get status of the active strategy runner."""
    global _active_runner
    
    if _active_runner:
        return {
            'success': True,
            'active': True,
            'status': _active_runner.get_status()
        }
    
    return {
        'success': True,
        'active': False,
        'status': None
    }
