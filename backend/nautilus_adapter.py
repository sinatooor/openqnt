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

# Attempt Nautilus imports - all functions depend on this
NAUTILUS_INSTALLED = False

try:
    from nautilus_trader.backtest.engine import BacktestEngine
    from nautilus_trader.backtest.config import BacktestEngineConfig
    from nautilus_trader.config import LoggingConfig, StrategyConfig
    from nautilus_trader.model.currencies import USD
    from nautilus_trader.model.enums import (
        AccountType, OmsType, PriceType, 
        BarAggregation, OrderSide, TimeInForce
    )
    from nautilus_trader.model.identifiers import TraderId, Venue, InstrumentId
    from nautilus_trader.model.objects import Money, Quantity
    from nautilus_trader.model.data import Bar, BarType
    from nautilus_trader.model.instruments import CurrencyPair
    from nautilus_trader.trading.strategy import Strategy
    from nautilus_trader.test_kit.providers import TestInstrumentProvider
    from nautilus_trader.core.datetime import dt_to_unix_nanos
    import pytz
    
    NAUTILUS_INSTALLED = True
except ImportError as e:
    print(f"NautilusTrader not available: {e}")
    NAUTILUS_INSTALLED = False


def _create_instrument(symbol: str) -> Any:
    """
    Create a default instrument for testing.
    
    Returns a Nautilus CurrencyPair or Equity instrument.
    """
    if not NAUTILUS_INSTALLED:
        raise RuntimeError("NautilusTrader not installed")
    
    # Handle FX pairs like EURUSD, GBPUSD, etc.
    symbol_upper = symbol.upper().replace("/", "")
    
    # Common FX pairs
    fx_pairs = {
        "EURUSD": ("EUR", "USD"),
        "GBPUSD": ("GBP", "USD"),
        "USDJPY": ("USD", "JPY"),
        "AUDUSD": ("AUD", "USD"),
        "USDCAD": ("USD", "CAD"),
        "USDCHF": ("USD", "CHF"),
        "NZDUSD": ("NZD", "USD"),
    }
    
    if symbol_upper in fx_pairs:
        base, quote = fx_pairs[symbol_upper]
        # Use standardized format for TestInstrumentProvider
        formatted = f"{base}/{quote}"
        return TestInstrumentProvider.default_fx_ccy(formatted)
    
    # For other symbols (equities, etc.), try the default provider
    # This provides a simulated FX pair which works for testing
    try:
        return TestInstrumentProvider.default_fx_ccy("EUR/USD")
    except Exception:
        # Ultimate fallback
        return TestInstrumentProvider.default_fx_ccy("EUR/USD")

def _dataframe_to_bars(df: pd.DataFrame, instrument: Any, timeframe_minutes: int = 60) -> List[Any]:
    """
    Convert pandas DataFrame (OHLCV) to Nautilus Bar objects.
    
    Args:
        df: DataFrame with OHLCV data
        instrument: Nautilus instrument object
        timeframe_minutes: Bar timeframe in minutes (default 60 = 1 hour)
    
    Returns:
        List of Nautilus Bar objects
    """
    if not NAUTILUS_INSTALLED:
        raise RuntimeError("NautilusTrader not installed")
    
    bars = []
    
    # Create bar type string for this instrument
    # Format: {instrument_id}-{step}-{aggregation}-{price_type}-{source}
    bar_type = BarType.from_str(f"{instrument.id}-{timeframe_minutes}-MINUTE-MID-EXTERNAL")
    
    # Normalize column names to lowercase
    df = df.copy()
    df.columns = [c.lower() for c in df.columns]
    
    # Ensure timestamp column exists
    if 'timestamp' not in df.columns:
        df = df.reset_index()
        if 'date' in df.columns:
            df.rename(columns={'date': 'timestamp'}, inplace=True)
        elif 'index' in df.columns:
            df.rename(columns={'index': 'timestamp'}, inplace=True)
    
    for _, row in df.iterrows():
        ts = row.get('timestamp')
        if ts is None:
            continue
            
        if isinstance(ts, str):
            ts = pd.Timestamp(ts)
        elif not isinstance(ts, pd.Timestamp):
            ts = pd.Timestamp(ts)
        
        # Ensure timezone awareness for dt_to_unix_nanos
        if ts.tzinfo is None:
            ts = ts.tz_localize('UTC')
        
        # Convert to nanoseconds
        ts_ns = dt_to_unix_nanos(ts.to_pydatetime())
        
        # Get OHLCV values
        open_price = float(row.get('open', row.get('Open', 1.0)))
        high_price = float(row.get('high', row.get('High', 1.0)))
        low_price = float(row.get('low', row.get('Low', 1.0)))
        close_price = float(row.get('close', row.get('Close', 1.0)))
        volume = float(row.get('volume', row.get('Volume', 1000)))
        
        # Create bar using instrument's make_price/make_qty methods
        bar = Bar(
            bar_type=bar_type,
            open=instrument.make_price(open_price),
            high=instrument.make_price(high_price),
            low=instrument.make_price(low_price),
            close=instrument.make_price(close_price),
            volume=instrument.make_qty(volume),
            ts_event=ts_ns,
            ts_init=ts_ns,
        )
        bars.append(bar)
    
    return bars

def _load_strategy_class(strategy_code: str) -> Type[Any]:
    """
    Dynamically load the Strategy class from code string.
    
    Args:
        strategy_code: Python code containing a Strategy subclass
    
    Returns:
        The Strategy class (not an instance)
    """
    if not NAUTILUS_INSTALLED:
        raise RuntimeError("NautilusTrader not installed")
    
    # Prepare execution environment with Nautilus imports
    exec_globals = {
        '__builtins__': __builtins__,
        'Strategy': Strategy,
        'StrategyConfig': StrategyConfig,
        'OrderSide': OrderSide,
        'TimeInForce': TimeInForce,
        'Quantity': Quantity,
        'pd': pd,
        'np': np,
    }
    
    local_scope = {}
    
    try:
        exec(strategy_code, exec_globals, local_scope)
    except Exception as e:
        raise ValueError(f"Failed to execute strategy code: {e}")
    
    # Find the Strategy subclass
    strategy_cls = None
    for name, obj in local_scope.items():
        if inspect.isclass(obj):
            try:
                if issubclass(obj, Strategy) and obj is not Strategy:
                    strategy_cls = obj
                    break
            except TypeError:
                continue
    
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
    
    Args:
        strategy_code: Python code containing a Nautilus Strategy class
        symbol: Trading symbol (e.g., "EURUSD")
        start_date: Backtest start date (YYYY-MM-DD)
        end_date: Backtest end date (YYYY-MM-DD)
        initial_balance: Starting account balance
        historical_data: DataFrame with OHLCV data
    
    Returns:
        Dict with backtest results matching the UI representation contract
    """
    if not NAUTILUS_INSTALLED:
        return {
            "success": False,
            "error": "NautilusTrader not installed. Install with: pip install nautilus_trader",
            "fallback": True
        }

    try:
        # 1. Setup Engine Config
        trader_id = TraderId("BACKTESTER-001")
        config = BacktestEngineConfig(
            trader_id=trader_id,
            logging=LoggingConfig(log_level="ERROR"),  # Headless/Quiet
        )
        engine = BacktestEngine(config=config)
        
        # 2. Setup Venue & Account (must be done before adding data)
        venue = Venue("SIM")
        engine.add_venue(
            venue=venue,
            oms_type=OmsType.NETTING,
            account_type=AccountType.MARGIN,
            base_currency=USD,
            starting_balances=[Money(initial_balance, USD)],
        )
        
        # 3. Setup Instrument
        instrument = _create_instrument(symbol)
        engine.add_instrument(instrument)
        
        # 4. Load Data
        if historical_data is None or historical_data.empty:
            return {
                "success": False,
                "error": "historical_data is required for Nautilus adapter",
                "fallback": True
            }
        
        bars = _dataframe_to_bars(historical_data, instrument)
        if not bars:
            return {
                "success": False,
                "error": "No valid bars could be created from historical_data",
                "fallback": True
            }
        
        engine.add_data(bars)
        
        # 5. Load & Register Strategy
        strategy_cls = _load_strategy_class(strategy_code)
        
        # Create strategy config if the class has a config_class attribute
        if hasattr(strategy_cls, 'config_class') and strategy_cls.config_class:
            strategy_config = strategy_cls.config_class()
        else:
            strategy_config = StrategyConfig()
        
        strategy = strategy_cls(config=strategy_config)
        engine.add_strategy(strategy)

        # 6. Run Backtest
        engine.run()
        
        # 7. Extract Results
        # Get closed orders to reconstruct trades
        closed_orders = list(engine.cache.orders_closed())
        closed_positions = list(engine.cache.positions_closed())
        
        # Build trades from closed positions (each position is a round-trip)
        trades_list = []
        
        for position in closed_positions:
            # Extract position details
            entry_price = float(position.avg_px_open) if position.avg_px_open else 0.0
            exit_price = float(position.avg_px_close) if position.avg_px_close else 0.0
            qty = float(position.quantity)
            realized_pnl = float(position.realized_pnl) if position.realized_pnl else 0.0
            
            # Get timestamps
            ts_opened = pd.Timestamp(position.ts_opened, unit='ns', tz='UTC')
            ts_closed = pd.Timestamp(position.ts_closed, unit='ns', tz='UTC')
            
            # Determine position type
            pos_type = "long" if position.is_long else "short"
            
            trades_list.append({
                "entry_time": ts_opened.strftime('%Y-%m-%d %H:%M:%S'),
                "exit_time": ts_closed.strftime('%Y-%m-%d %H:%M:%S'),
                "entry_price": round(entry_price, 5),
                "exit_price": round(exit_price, 5),
                "pnl": round(realized_pnl, 2),
                "return_pct": round((exit_price - entry_price) / entry_price * 100, 4) if entry_price > 0 else 0,
                "size": qty,
                "type": pos_type
            })
        
        # If no closed positions, try to build trades from orders (FIFO matching)
        if not trades_list and closed_orders:
            open_positions_fifo: List[Dict] = []
            
            for order in sorted(closed_orders, key=lambda o: o.ts_last):
                if not order.is_filled:
                    continue
                    
                qty = float(order.filled_qty)
                price = float(order.avg_px) if order.avg_px else 0.0
                ts = pd.Timestamp(order.ts_last, unit='ns', tz='UTC')
                side = "BUY" if order.is_buy else "SELL"
                
                if side == "BUY":
                    shorts = [p for p in open_positions_fifo if p['side'] == "SELL"]
                    if shorts:
                        matched = shorts[0]
                        pnl = (matched['price'] - price) * qty
                        trades_list.append({
                            "entry_time": matched['time'].strftime('%Y-%m-%d %H:%M:%S'),
                            "exit_time": ts.strftime('%Y-%m-%d %H:%M:%S'),
                            "entry_price": round(matched['price'], 5),
                            "exit_price": round(price, 5),
                            "pnl": round(pnl, 2),
                            "return_pct": round((matched['price'] - price) / matched['price'] * 100, 4) if matched['price'] > 0 else 0,
                            "size": qty,
                            "type": "short"
                        })
                        open_positions_fifo.remove(matched)
                    else:
                        open_positions_fifo.append({'price': price, 'qty': qty, 'time': ts, 'side': "BUY"})
                else:
                    longs = [p for p in open_positions_fifo if p['side'] == "BUY"]
                    if longs:
                        matched = longs[0]
                        pnl = (price - matched['price']) * qty
                        trades_list.append({
                            "entry_time": matched['time'].strftime('%Y-%m-%d %H:%M:%S'),
                            "exit_time": ts.strftime('%Y-%m-%d %H:%M:%S'),
                            "entry_price": round(matched['price'], 5),
                            "exit_price": round(price, 5),
                            "pnl": round(pnl, 2),
                            "return_pct": round((price - matched['price']) / matched['price'] * 100, 4) if matched['price'] > 0 else 0,
                            "size": qty,
                            "type": "long"
                        })
                        open_positions_fifo.remove(matched)
                    else:
                        open_positions_fifo.append({'price': price, 'qty': qty, 'time': ts, 'side': "SELL"})

        # Get final balance
        accounts = list(engine.cache.accounts())
        if accounts:
            account = accounts[0]
            final_balance = float(account.balance_total(USD))
        else:
            final_balance = initial_balance
        
        # Calculate Metrics
        total_pnl = sum(t['pnl'] for t in trades_list)
        winning_trades = [t for t in trades_list if t['pnl'] > 0]
        losing_trades = [t for t in trades_list if t['pnl'] <= 0]
        
        win_rate = (len(winning_trades) / len(trades_list) * 100) if trades_list else 0.0
        
        # Calculate profit factor
        gross_profit = sum(t['pnl'] for t in winning_trades)
        gross_loss = abs(sum(t['pnl'] for t in losing_trades))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')
        if profit_factor == float('inf'):
            profit_factor = 999.99
        
        # Calculate max drawdown from equity curve
        equity_values = [initial_balance]
        running_equity = initial_balance
        for t in trades_list:
            running_equity += t['pnl']
            equity_values.append(running_equity)
        
        max_dd = 0.0
        peak = equity_values[0]
        for eq in equity_values:
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak * 100 if peak > 0 else 0
            if dd > max_dd:
                max_dd = dd
        
        # Calculate Sharpe ratio (simplified)
        sharpe_ratio = 0.0
        if len(trades_list) > 1:
            returns = [t['return_pct'] for t in trades_list]
            if np.std(returns) > 0:
                sharpe_ratio = np.mean(returns) / np.std(returns) * np.sqrt(252)
        
        metrics = {
            "total_trades": len(trades_list),
            "winning_trades": len(winning_trades),
            "losing_trades": len(losing_trades),
            "win_rate": round(win_rate, 2),
            "total_pnl": round(total_pnl, 2),
            "profit_factor": round(profit_factor, 2),
            "max_drawdown": round(max_dd, 2),
            "sharpe_ratio": round(sharpe_ratio, 2),
            "final_balance": round(final_balance, 2),
            "avg_win": round(np.mean([t['pnl'] for t in winning_trades]), 2) if winning_trades else 0,
            "avg_loss": round(np.mean([t['pnl'] for t in losing_trades]), 2) if losing_trades else 0,
        }
        
        # Build proper equity curve
        equity_curve = [{"timestamp": start_date + " 00:00:00", "equity": initial_balance}]
        running_eq = initial_balance
        for t in trades_list:
            running_eq += t['pnl']
            equity_curve.append({
                "timestamp": t['exit_time'],
                "equity": round(running_eq, 2)
            })
        
        # Ensure we have the final point
        if equity_curve[-1]['equity'] != final_balance:
            equity_curve.append({"timestamp": end_date + " 23:59:59", "equity": round(final_balance, 2)})

        # Generate HTML Visualization
        visualization_html = None
        try:
            from backend.nautilus_visualizer import generate_nautilus_chart
            visualization_html = generate_nautilus_chart(
                ohlcv_data=historical_data,
                trades=trades_list,
                equity_curve=equity_curve,
                metrics=metrics,
                symbol=symbol
            )
        except ImportError:
            try:
                # Try fallback import if running from different context
                from nautilus_visualizer import generate_nautilus_chart
                visualization_html = generate_nautilus_chart(
                    ohlcv_data=historical_data,
                    trades=trades_list,
                    equity_curve=equity_curve,
                    metrics=metrics,
                    symbol=symbol
                )
            except Exception as viz_err:
                print(f"Visualization generation failed: {viz_err}")
        except Exception as e:
            print(f"Visualization generation failed: {e}")

        return {
            "success": True,
            "engine": "nautilus",
            "symbol": symbol,
            "start_date": start_date,
            "end_date": end_date,
            "initial_balance": initial_balance,
            "final_balance": round(final_balance, 2),
            "metrics": metrics,
            "trades": trades_list,
            "equity_curve": equity_curve,
            "visualization_html": visualization_html
        }

    except Exception as e:
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "fallback": True
        }


def get_nautilus_status() -> Dict[str, Any]:
    """
    Get the status of NautilusTrader installation.
    
    Returns:
        Dict with installation status and version info
    """
    if not NAUTILUS_INSTALLED:
        return {
            "installed": False,
            "error": "NautilusTrader not installed"
        }
    
    try:
        import nautilus_trader
        version = getattr(nautilus_trader, '__version__', 'unknown')
        return {
            "installed": True,
            "version": version
        }
    except Exception as e:
        return {
            "installed": False,
            "error": str(e)
        }