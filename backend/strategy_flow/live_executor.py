"""
Live Trading Executor for Strategy Flow

Executes trading strategies in real-time using broker APIs.
Currently supports Binance (spot and futures).
"""

from __future__ import annotations
import asyncio
from typing import Any, Dict, List, Optional
from datetime import datetime
import json


# Global state for live trading
_live_trading_state = {
    "running": False,
    "symbol": None,
    "positions": [],
    "orders": [],
    "client": None,
    "strategy_task": None
}


class FlowLiveExecutor:
    """
    Live trading executor for Strategy Flow strategies.
    
    Connects to Binance API and executes trades based on
    the compiled flow configuration.
    """
    
    def __init__(
        self,
        api_key: str,
        api_secret: str,
        testnet: bool = True,
        position_size: float = 1.0
    ):
        """
        Initialize the live executor.
        
        Args:
            api_key: Binance API key
            api_secret: Binance API secret
            testnet: Use testnet (paper trading) if True
            position_size: Position size as % of balance
        """
        self.api_key = api_key
        self.api_secret = api_secret
        self.testnet = testnet
        self.position_size = position_size
        self.client = None
        self.running = False
        self.positions: List[Dict[str, Any]] = []
        self.orders: List[Dict[str, Any]] = []
        
    async def connect(self) -> bool:
        """Connect to Binance API."""
        try:
            from binance.client import Client
            from binance.exceptions import BinanceAPIException
            
            # Initialize client
            self.client = Client(
                self.api_key, 
                self.api_secret,
                testnet=self.testnet
            )
            
            # Test connection
            self.client.ping()
            account = self.client.get_account()
            
            print(f"Connected to Binance {'Testnet' if self.testnet else 'Live'}")
            print(f"Account status: {account.get('accountType', 'unknown')}")
            
            return True
            
        except ImportError:
            raise ImportError("python-binance not installed. Run: pip install python-binance")
        except Exception as e:
            print(f"Failed to connect to Binance: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from Binance."""
        self.running = False
        self.client = None
        print("Disconnected from Binance")
    
    def get_balance(self, asset: str = "USDT") -> float:
        """Get balance for an asset."""
        if not self.client:
            return 0.0
        
        try:
            account = self.client.get_account()
            balances = account.get("balances", [])
            
            for balance in balances:
                if balance["asset"] == asset:
                    return float(balance["free"])
            
            return 0.0
        except Exception as e:
            print(f"Failed to get balance: {e}")
            return 0.0
    
    def get_price(self, symbol: str) -> float:
        """Get current price for a symbol."""
        if not self.client:
            return 0.0
        
        try:
            ticker = self.client.get_symbol_ticker(symbol=symbol)
            return float(ticker["price"])
        except Exception as e:
            print(f"Failed to get price: {e}")
            return 0.0
    
    async def place_order(
        self,
        symbol: str,
        side: str,  # "BUY" or "SELL"
        quantity: float,
        order_type: str = "MARKET",
        price: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Place an order on Binance.
        
        Args:
            symbol: Trading pair (e.g., "BTCUSDT")
            side: "BUY" or "SELL"
            quantity: Order quantity
            order_type: "MARKET" or "LIMIT"
            price: Limit price (required for LIMIT orders)
        
        Returns:
            Order result dictionary
        """
        if not self.client:
            raise ValueError("Not connected to Binance")
        
        try:
            if order_type == "MARKET":
                order = self.client.create_order(
                    symbol=symbol,
                    side=side,
                    type=order_type,
                    quantity=quantity
                )
            else:
                order = self.client.create_order(
                    symbol=symbol,
                    side=side,
                    type=order_type,
                    quantity=quantity,
                    price=str(price),
                    timeInForce="GTC"
                )
            
            # Track order
            self.orders.append({
                "id": order["orderId"],
                "symbol": symbol,
                "side": side,
                "quantity": quantity,
                "price": price or order.get("fills", [{}])[0].get("price"),
                "status": order["status"],
                "time": datetime.now().isoformat()
            })
            
            return order
            
        except Exception as e:
            print(f"Order failed: {e}")
            raise
    
    async def close_position(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Close all positions for a symbol."""
        if not self.client:
            return None
        
        try:
            # Get current position
            account = self.client.get_account()
            balances = account.get("balances", [])
            
            base_asset = symbol.replace("USDT", "")
            position_size = 0.0
            
            for balance in balances:
                if balance["asset"] == base_asset:
                    position_size = float(balance["free"])
                    break
            
            if position_size > 0:
                # Sell to close
                return await self.place_order(
                    symbol=symbol,
                    side="SELL",
                    quantity=position_size,
                    order_type="MARKET"
                )
            
            return None
            
        except Exception as e:
            print(f"Failed to close position: {e}")
            return None
    
    async def execute_strategy(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        symbol: str,
        interval_seconds: int = 60
    ):
        """
        Execute a strategy in a loop.
        
        Args:
            nodes: Flow nodes
            edges: Flow edges
            symbol: Trading symbol
            interval_seconds: Seconds between checks
        """
        self.running = True
        
        # Build flow configuration
        flow_config = {
            "nodes": nodes,
            "edges": edges,
            "symbol": symbol
        }
        
        print(f"Starting live execution for {symbol}")
        print(f"Checking every {interval_seconds} seconds")
        
        while self.running:
            try:
                # Get current price
                current_price = self.get_price(symbol)
                
                # Evaluate strategy signals
                entry_signal, exit_signal = self._evaluate_signals(
                    flow_config, 
                    symbol, 
                    current_price
                )
                
                # Get current position
                has_position = self._has_position(symbol)
                
                # Execute trades
                if entry_signal and not has_position:
                    # Calculate position size
                    balance = self.get_balance("USDT")
                    trade_amount = balance * (self.position_size / 100)
                    quantity = trade_amount / current_price
                    
                    # Round quantity to valid precision
                    quantity = round(quantity, 5)
                    
                    if quantity > 0:
                        print(f"Entry signal: Buying {quantity} {symbol} at {current_price}")
                        await self.place_order(
                            symbol=symbol,
                            side="BUY",
                            quantity=quantity
                        )
                
                elif exit_signal and has_position:
                    print(f"Exit signal: Closing position for {symbol}")
                    await self.close_position(symbol)
                
                # Wait for next interval
                await asyncio.sleep(interval_seconds)
                
            except Exception as e:
                print(f"Strategy execution error: {e}")
                await asyncio.sleep(interval_seconds)
        
        print("Live execution stopped")
    
    def _has_position(self, symbol: str) -> bool:
        """Check if we have an open position."""
        if not self.client:
            return False
        
        try:
            base_asset = symbol.replace("USDT", "")
            account = self.client.get_account()
            
            for balance in account.get("balances", []):
                if balance["asset"] == base_asset:
                    free = float(balance["free"])
                    locked = float(balance["locked"])
                    if free + locked > 0.0001:  # Minimum position
                        return True
            
            return False
        except Exception:
            return False
    
    def _evaluate_signals(
        self,
        flow_config: Dict[str, Any],
        symbol: str,
        current_price: float
    ) -> tuple:
        """
        Evaluate entry/exit signals from the flow.
        
        This is a simplified evaluation - full evaluation would use
        historical data and proper indicator calculations.
        
        Returns: (entry_signal, exit_signal)
        """
        # For now, return no signals
        # Full implementation would:
        # 1. Fetch historical OHLCV data
        # 2. Calculate indicator values
        # 3. Evaluate condition chains
        # 4. Return signals
        
        return False, False


# ============================================================
# Module-level Functions
# ============================================================

async def start_live_execution(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    symbol: str,
    api_key: str,
    api_secret: str,
    testnet: bool = True,
    position_size: float = 1.0
) -> Dict[str, Any]:
    """
    Start live trading execution.
    
    Args:
        nodes: Flow nodes
        edges: Flow edges  
        symbol: Trading symbol (e.g., "BTCUSDT")
        api_key: Binance API key
        api_secret: Binance API secret
        testnet: Use testnet for paper trading
        position_size: Position size as % of balance
    
    Returns:
        Status dictionary
    """
    global _live_trading_state
    
    # Stop any existing execution
    if _live_trading_state["running"]:
        await stop_live_execution()
    
    # Create executor
    executor = FlowLiveExecutor(
        api_key=api_key,
        api_secret=api_secret,
        testnet=testnet,
        position_size=position_size
    )
    
    # Connect
    connected = await executor.connect()
    if not connected:
        return {
            "success": False,
            "error": "Failed to connect to Binance"
        }
    
    # Update state
    _live_trading_state["running"] = True
    _live_trading_state["symbol"] = symbol
    _live_trading_state["client"] = executor
    
    # Start strategy execution in background
    _live_trading_state["strategy_task"] = asyncio.create_task(
        executor.execute_strategy(nodes, edges, symbol)
    )
    
    return {
        "success": True,
        "status": "running",
        "symbol": symbol,
        "testnet": testnet
    }


async def stop_live_execution() -> Dict[str, Any]:
    """Stop live trading execution."""
    global _live_trading_state
    
    if _live_trading_state["client"]:
        _live_trading_state["client"].running = False
        await _live_trading_state["client"].disconnect()
    
    if _live_trading_state["strategy_task"]:
        _live_trading_state["strategy_task"].cancel()
        try:
            await _live_trading_state["strategy_task"]
        except asyncio.CancelledError:
            pass
    
    _live_trading_state["running"] = False
    _live_trading_state["symbol"] = None
    _live_trading_state["client"] = None
    _live_trading_state["strategy_task"] = None
    
    return {
        "success": True,
        "status": "stopped"
    }


async def get_status() -> Dict[str, Any]:
    """Get current live trading status."""
    global _live_trading_state
    
    status = "stopped"
    positions = []
    orders = []
    
    if _live_trading_state["running"] and _live_trading_state["client"]:
        status = "running"
        positions = _live_trading_state["client"].positions
        orders = _live_trading_state["client"].orders[-10:]  # Last 10 orders
    
    return {
        "status": status,
        "symbol": _live_trading_state["symbol"],
        "positions": positions,
        "orders": orders
    }


async def emergency_stop() -> Dict[str, Any]:
    """
    Emergency stop - close all positions and stop trading.
    """
    global _live_trading_state
    
    if _live_trading_state["client"] and _live_trading_state["symbol"]:
        try:
            await _live_trading_state["client"].close_position(
                _live_trading_state["symbol"]
            )
        except Exception as e:
            print(f"Error closing positions: {e}")
    
    return await stop_live_execution()
