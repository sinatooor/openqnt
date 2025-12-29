"""
NautilusTrader Adapter Layer

Adapts NautilusTrader backtest engine to the project's UI representation contract.
Ensures headless execution and deterministic outputs matching backtesting.py UI shape.
"""

import sys
import inspect
import traceback
import pandas as pd
import numpy as np
from decimal import Decimal
from datetime import datetime
from typing import Dict, List, Any, Optional, Type

try:
    from nautilus_trader.backtest.engine import BacktestEngine
    from nautilus_trader.backtest.config import BacktestEngineConfig, LoggingConfig
    from nautilus_trader.config import InstrumentConfig
    from nautilus_trader.model.currencies import USD
    from nautilus_trader.model.enums import (
        AccountType, OmsType, PriceType, 
        BarAggregation, OrderSide, TimeInForce
    )
    from nautilus_trader.model.identifiers import TraderId, Venue, InstrumentId, ClientId
    from nautilus_trader.model.objects import Money, Quantity, Currency
    from nautilus_trader.model.data import Bar, BarType
    from nautilus_trader.model.instruments import Instrument, CurrencyPair
    from nautilus_trader.trading.strategy import Strategy
    from nautilus_trader.test_kit.providers import TestInstrumentProvider
    from nautilus_trader.common.component import TimeEvent
    NAUTILUS_INSTALLED = True
except ImportError:
    NAUTILUS_INSTALLED = False

def _create_instrument(symbol: str) -> Instrument:
    """Create a default instrument for testing."""
    # Simplified instrument creation
    # In a real scenario, this should match the asset class (FX, Crypto, Equity)
    # Assuming FX (EURUSD) or simple match for now
    if "USD" in symbol and len(symbol) == 6:
        base = symbol[:3]
        quote = symbol[3:]
        # Use TestInstrumentProvider if available or manual construction
        try:
            return TestInstrumentProvider.currency_pair(code=symbol, base=base, quote=quote)
        except:
            pass # Fallback
    
    # Fallback for others (e.g. AAPL) -> Generic
    # Note: Nautilus requires valid IDs and currencies.
    # We'll use a generic construction.
    
    return Instrument(
        id=InstrumentId.from_str(f"{symbol}.SIM"),
        symbol=symbol,
        asset_class="EQUITY",
        base_currency=USD,  # Simplified
        quote_currency=USD,
        price_precision=2,
        quantity_precision=2,
        lot_size=Quantity.from_str("1"),
        min_quantity=Quantity.from_str("1"),
        margin_init=Decimal("0.1"),
        margin_maint=Decimal("0.05"),
        maker_fee=Decimal("0"),
        taker_fee=Decimal("0"),
        ts_event=0,
        ts_init=0,
    )

def _dataframe_to_bars(df: pd.DataFrame, instrument: Instrument) -> List[Bar]:
    """Convert pandas DataFrame (OHLCV) to Nautilus Bar objects."""
    bars = []
    
    # Determine bar type (assuming 1-hour/daily based on data or config)
    # For now, default to daily if not specified, or infer?
    # backend/backtest_runner.py generates synthetic data with 'timestamp'
    # We'll treat them as bars.
    
    bar_type = BarType(
        instrument_id=instrument.id,
        bar_aggregation=BarAggregation.MINUTE, # Defaulting, needs to match strategy expectation
        bar_aggregation_count=60, # 1 Hour default
        price_type=PriceType.MID, # Backtesting.py usually uses Mid/Close
    )
    
    # Ensure timestamp is datetime
    if 'timestamp' not in df.columns:
         # Try index
         df = df.reset_index()
         if 'Date' in df.columns:
             df.rename(columns={'Date': 'timestamp'}, inplace=True)
    
    for _, row in df.iterrows():
        ts = row.get('timestamp')
        if isinstance(ts, str):
            ts = pd.Timestamp(ts)
        
        # Nautilus requires uint64 nanoseconds for timestamps
        ts_ns = int(ts.timestamp() * 1e9)
        
        bars.append(Bar(
            bar_type=bar_type,
            open=Decimal(str(row['open'] if 'open' in row else row['Open'])),
            high=Decimal(str(row['high'] if 'high' in row else row['High'])),
            low=Decimal(str(row['low'] if 'low' in row else row['Low'])),
            close=Decimal(str(row['close'] if 'close' in row else row['Close'])),
            volume=Decimal(str(row.get('volume', row.get('Volume', 0)))),
            ts_event=ts_ns,
            ts_init=ts_ns,
        ))
    return bars

def _load_strategy_class(strategy_code: str) -> Type[Strategy]:
    """Dynamically load the Strategy class from code string."""
    local_scope = {}
    
    # Prepare global scope with Nautilus imports to support the strategy code
    global_scope = globals().copy()
    
    try:
        exec(strategy_code, global_scope, local_scope)
    except Exception as e:
        raise ValueError(f"Failed to execute strategy code: {e}")
    
    strategy_cls = None
    for name, obj in local_scope.items():
        # Check if it's a class and subclass of Strategy (but not Strategy itself)
        # Note: Depending on how Strategy is imported in the code string, exact check might vary.
        if inspect.isclass(obj) and issubclass(obj, Strategy) and obj.__name__ != 'Strategy':
            strategy_cls = obj
            break
            
    if not strategy_cls:
        raise ValueError("No class inheriting from 'Strategy' found in provided code.")
        
    return strategy_cls

def run_nautilus_backtest(
    strategy_code: str,
    symbol: str = "EURUSD",
    start_date: str = "2024-01-01",
    end_date: str = "2024-03-31",
    initial_balance: float = 100000.0,
    historical_data: pd.DataFrame = None
) -> Dict[str, Any]:
    """
    Run a NautilusTrader backtest and return results in UI-compatible format.
    """
    if not NAUTILUS_INSTALLED:
        return {
            "success": False,
            "error": "NautilusTrader not installed",
            "fallback": True
        }

    try:
        # 1. Setup Engine Config
        trader_id = TraderId("BACKTESTER-001")
        config = BacktestEngineConfig(
            trader_id=trader_id,
            logging=LoggingConfig(log_level="ERROR") # Headless/Quiet
        )
        engine = BacktestEngine(config=config)
        
        # 2. Setup Instrument
        instrument = _create_instrument(symbol)
        engine.add_instrument(instrument)
        
        # 3. Load Data
        if historical_data is None:
            # Should have been provided by caller, but handle fallback
            raise ValueError("historical_data is required for Nautilus adapter")
            
        bars = _dataframe_to_bars(historical_data, instrument)
        engine.add_data(bars)
        
        # 4. Setup Venue & Account
        venue = Venue("SIM")
        engine.add_venue(
            venue=venue,
            oms_type=OmsType.NETTING,
            account_type=AccountType.MARGIN,
            base_currency=USD,
            starting_balances=[Money(initial_balance, USD)],
        )
        
        # 5. Load & Register Strategy
        strategy_cls = _load_strategy_class(strategy_code)
        
        # Basic strategy config - can be extended based on parsing params
        strategy_config = strategy_cls.config_class() if hasattr(strategy_cls, 'config_class') else None
        
        if strategy_config:
            # Instantiate with config
            # Here we might need to inject params if provided (not in this signature yet)
            engine.add_strategy(strategy_cls, config=strategy_config)
        else:
            # Try instantiating without config or with dict if supported
            # Nautilus strategies usually take a config object. 
            # If the generated code handles __init__(self, config), we need to pass something.
            # Assuming standard Nautilus pattern where we register the class and config.
            # If the class doesn't use a config class, we might need a dummy one.
            from nautilus_trader.config import StrategyConfig
            engine.add_strategy(strategy_cls, config=StrategyConfig())

        # 6. Run Backtest
        engine.run()
        
        # 7. Extract Results
        # Get the account to analyze performance
        account = engine.get_account(trader_id)
        
        # Extract Trades
        # Nautilus doesn't store a simple "trade list" like backtesting.py (entry/exit pair).
        # It has Orders and Fills. We need to reconstruct "Completed Trades" (round-trips) or list individual fills.
        # For UI compatibility, we ideally want Round Trips.
        # Since logic to reconstruct round-trips is complex, we will approximate or use Fills for now,
        # OR just list positions if we can match entry/exit.
        #
        # For this adapter, let's try to map Fills to "Trades" if possible, or just return Fills.
        # But `backtest_result.json` expects "entry_time", "exit_time", "pnl".
        # We'll use a simplified FIFO matcher here or just report Fills if PnL is hard.
        # Actually, Nautilus Account tracks PnL.
        
        # Let's try to get closed positions?
        # engine.get_result() returns a BacktestResult object.
        # stats = engine.get_stats() # If available in this version
        
        fills = engine.cache.fills()
        
        # Simplified Round-Trip Construction (FIFO)
        # This is a basic implementation to satisfy the UI contract.
        trades_list = []
        open_positions = [] # List of {'price', 'qty', 'time', 'side'}
        
        for fill in fills:
            # Convert nautilus objects to simple types
            qty = float(fill.quantity)
            price = float(fill.price)
            ts = pd.Timestamp(fill.ts_event / 1e9, unit='s')
            side = str(fill.order_side) # BUY or SELL
            
            # Simple FIFO Matching
            # Note: This is imperfect for partial fills or complex netting, but sufficient for simple strategies.
            
            if side == "BUY":
                # Check if we have shorts to cover
                shorts = [p for p in open_positions if p['side'] == "SELL"]
                if shorts:
                    # Closing a short
                    matched = shorts[0]
                    # Calculate PnL: (Entry - Exit) * Qty
                    pnl = (matched['price'] - price) * qty # simplified assuming full match
                    
                    trades_list.append({
                        "entry_time": matched['time'].strftime('%Y-%m-%d %H:%M:%S'),
                        "exit_time": ts.strftime('%Y-%m-%d %H:%M:%S'),
                        "entry_price": matched['price'],
                        "exit_price": price,
                        "pnl": round(pnl, 2),
                        "return_pct": round((matched['price'] - price) / matched['price'], 4),
                        "size": qty,
                        "type": "short"
                    })
                    open_positions.remove(matched) # Remove matched
                else:
                    # Open long
                    open_positions.append({'price': price, 'qty': qty, 'time': ts, 'side': "BUY"})
            
            elif side == "SELL":
                # Check if we have longs to cover
                longs = [p for p in open_positions if p['side'] == "BUY"]
                if longs:
                    # Closing a long
                    matched = longs[0]
                    # Calculate PnL: (Exit - Entry) * Qty
                    pnl = (price - matched['price']) * qty
                    
                    trades_list.append({
                        "entry_time": matched['time'].strftime('%Y-%m-%d %H:%M:%S'),
                        "exit_time": ts.strftime('%Y-%m-%d %H:%M:%S'),
                        "entry_price": matched['price'],
                        "exit_price": price,
                        "pnl": round(pnl, 2),
                        "return_pct": round((price - matched['price']) / matched['price'], 4),
                        "size": qty,
                        "type": "long"
                    })
                    open_positions.remove(matched)
                else:
                    # Open short
                    open_positions.append({'price': price, 'qty': qty, 'time': ts, 'side': "SELL"})

        # Equity Curve
        # Nautilus can emit account updates. Or we can sample it.
        # We'll assume the engine tracks equity history or we can reconstruct from bars?
        # Currently, let's take just start and end if history unavailable.
        # But UI needs a curve.
        # We can simulate the curve by iterating bars and checking account balance?
        # Better: Nautilus has `engine.get_account().balance(USD)`.
        
        final_balance = float(account.balance(USD).total)
        
        # Construct Metrics
        total_pnl = sum(t['pnl'] for t in trades_list)
        winning_trades = [t for t in trades_list if t['pnl'] > 0]
        losing_trades = [t for t in trades_list if t['pnl'] <= 0]
        
        win_rate = (len(winning_trades) / len(trades_list) * 100) if trades_list else 0.0
        
        metrics = {
            "total_trades": len(trades_list),
            "winning_trades": len(winning_trades),
            "losing_trades": len(losing_trades),
            "win_rate": round(win_rate, 2),
            "total_pnl": round(total_pnl, 2),
            "final_balance": round(final_balance, 2),
            "max_drawdown": 0.0, # Placeholder need equity curve for this
            "sharpe_ratio": 0.0, # Placeholder
        }
        
        # Equity Curve Placeholder (Start -> End)
        # Ideally we'd log equity at each step
        equity_curve = [
            {"time": start_date + " 00:00:00", "equity": initial_balance},
            {"time": end_date + " 23:59:59", "equity": final_balance}
        ]

        return {
            "success": True,
            "symbol": symbol,
            "start_date": start_date,
            "end_date": end_date,
            "initial_balance": initial_balance,
            "final_balance": round(final_balance, 2),
            "metrics": metrics,
            "trades": trades_list,
            "equity_curve": equity_curve
        }

    except Exception as e:
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
