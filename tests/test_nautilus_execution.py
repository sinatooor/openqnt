
import pytest
import pandas as pd
import numpy as np
from unittest.mock import MagicMock, patch, ANY
import sys
import os
from datetime import datetime

# Add root directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# -------------------------------------------------------------------------
# MOCKING NAUTILUS TRADER
# Since Nautilus is complex and might not be installed, we mock it entirely
# for the purpose of testing the ADAPTER logic.
# -------------------------------------------------------------------------

# Create Mock Classes that mimic Nautilus objects
class MockBarType:
    @staticmethod
    def from_str(s): return f"BAR_TYPE({s})"

class MockBar:
    def __init__(self, bar_type, open, high, low, close, volume, ts_event, ts_init):
        self.bar_type = bar_type
        self.open = open
        self.high = high
        self.low = low
        self.close = close
        self.volume = volume
        self.ts_event = ts_event
        self.ts_init = ts_init

class MockMoney:
    def __init__(self, amount, currency):
        self.amount = amount
        self.currency = currency

class MockQuantity:
    def __init__(self, amount):
        self.amount = amount

class MockStrategy:
    def __init__(self, config): pass

class MockStrategyConfig:
    pass

class MockVenue:
    def __init__(self, name): self.name = name

class MockTraderId:
    def __init__(self, id): self.id = id

class MockInstrument:
    def __init__(self, id="EUR/USD", symbol="EURUSD"):
        self.id = id
        self.symbol = symbol
    def make_price(self, p): return float(p)
    def make_qty(self, q): return int(q) if q >= 1 else float(q)

class MockPosition:
    def __init__(self, is_long, avg_px_open, avg_px_close, quantity, realized_pnl, ts_opened, ts_closed):
        self.is_long = is_long
        self.avg_px_open = avg_px_open
        self.avg_px_close = avg_px_close
        self.quantity = quantity
        self.realized_pnl = realized_pnl
        self.ts_opened = ts_opened
        self.ts_closed = ts_closed

class MockOrder:
    def __init__(self, is_buy, avg_px, filled_qty, ts_last, is_filled=True):
        self.is_buy = is_buy
        self.avg_px = avg_px
        self.filled_qty = filled_qty
        self.ts_last = ts_last
        self.is_filled = is_filled

class MockAccount:
    def balance_total(self, currency): return 100500.0

@pytest.fixture
def mock_nautilus_modules():
    """
    Patches sys.modules to simulate nautilus_trader presence and
    injects mocks into backend.nautilus_adapter.
    """
    with patch.dict(sys.modules, {
        "nautilus_trader": MagicMock(),
        "nautilus_trader.backtest.engine": MagicMock(),
        "nautilus_trader.backtest.config": MagicMock(),
        "nautilus_trader.model.data": MagicMock(),
        "nautilus_trader.model.instruments": MagicMock(),
        "nautilus_trader.model.identifiers": MagicMock(),
        "nautilus_trader.model.enums": MagicMock(),
        "nautilus_trader.model.objects": MagicMock(),
        "nautilus_trader.model.currencies": MagicMock(),
        "nautilus_trader.trading.strategy": MagicMock(),
        "nautilus_trader.config": MagicMock(),
        "nautilus_trader.test_kit.providers": MagicMock(),
        "nautilus_trader.core.datetime": MagicMock(),
    }):
        # We also need to patch the IMPORTS inside nautilus_adapter 
        # because they might have already failed or been skipped.
        # But patching 'NAUTILUS_INSTALLED' to True is most important.
        yield

# -------------------------------------------------------------------------
# TESTS
# -------------------------------------------------------------------------

def test_dataframe_to_bars_conversion(mock_nautilus_modules):
    """Test data conversion logic."""
    from backend import nautilus_adapter
    
    # Inject Mock dependencies into the module
    nautilus_adapter.NAUTILUS_INSTALLED = True
    nautilus_adapter.Bar = MockBar
    nautilus_adapter.BarType = MockBarType
    nautilus_adapter.dt_to_unix_nanos = lambda d: int(d.timestamp() * 1e9)
    
    # Create sample Data
    df = pd.DataFrame({
        "timestamp": [datetime(2024, 1, 1, 10, 0), datetime(2024, 1, 1, 11, 0)],
        "open": [1.1, 1.2],
        "high": [1.15, 1.25],
        "low": [1.05, 1.15],
        "close": [1.12, 1.22],
        "volume": [1000, 2000]
    })
    
    instrument = MockInstrument()
    bars = nautilus_adapter._dataframe_to_bars(df, instrument)
    
    assert len(bars) == 2
    assert bars[0].open == 1.1
    assert bars[1].close == 1.22
    assert bars[0].bar_type == "BAR_TYPE(EUR/USD-60-MINUTE-MID-EXTERNAL)"

def test_run_nautilus_backtest_success(mock_nautilus_modules):
    """Test full backtest execution flow (mocked)."""
    from backend import nautilus_adapter
    
    # Setup Logic Mocks (mimicking the imports inside the try block)
    nautilus_adapter.NAUTILUS_INSTALLED = True
    nautilus_adapter.BacktestEngine = MagicMock()
    nautilus_adapter.BacktestEngineConfig = MagicMock()
    nautilus_adapter.LoggingConfig = MagicMock()
    nautilus_adapter.StrategyConfig = MagicMock()
    nautilus_adapter.AccountType = MagicMock()
    nautilus_adapter.OmsType = MagicMock()
    nautilus_adapter.Venue = MockVenue
    nautilus_adapter.Money = MockMoney
    nautilus_adapter.TestInstrumentProvider = MagicMock()
    nautilus_adapter.TestInstrumentProvider.default_fx_ccy.return_value = MockInstrument(id="EUR/USD")
    nautilus_adapter.dt_to_unix_nanos = lambda d: int(d.timestamp() * 1e9)
    nautilus_adapter.Bar = MockBar
    nautilus_adapter.BarType = MockBarType
    nautilus_adapter.Strategy = MockStrategy # Base class for the strategy code
    nautilus_adapter.USD = MagicMock()
    
    # Mock the Strategy Code Loading
    # The adapter uses 'exec' to define a class. We need that class to inherit from MockStrategy.
    strategy_code = """
class MyTestStrategy(Strategy):
    def on_bar(self, bar):
        pass
"""
    
    # Mock the Engine instance and its cache
    mock_engine = MagicMock()
    nautilus_adapter.BacktestEngine.return_value = mock_engine
    
    # Setup Cache return values (Trades/Positions)
    # Scenario: 1 Closed Position (Winner)
    mock_pos = MockPosition(
        is_long=True,
        avg_px_open=1.1000,
        avg_px_close=1.1050,
        quantity=1000,
        realized_pnl=5.0, # (1.1050 - 1.1000) * 1000 = 5.0
        ts_opened=int(datetime(2024, 1, 1, 10, 0).timestamp() * 1e9),
        ts_closed=int(datetime(2024, 1, 1, 14, 0).timestamp() * 1e9)
    )
    mock_engine.cache.positions_closed.return_value = [mock_pos]
    
    # Mock Account Balance
    mock_account = MockAccount()
    mock_engine.cache.accounts.return_value = [mock_account]
    
    # Input Data
    df = pd.DataFrame({
        "timestamp": [datetime(2024, 1, 1, 10, 0)],
        "open": [1.1], "high": [1.2], "low": [1.0], "close": [1.1], "volume": [1000]
    })
    
    # Execute
    result = nautilus_adapter.run_nautilus_backtest(
        strategy_code=strategy_code,
        historical_data=df
    )
    
    # Verify
    assert result['success'] is True
    assert result['engine'] == 'nautilus'
    assert result['final_balance'] == 100500.0
    assert result['metrics']['total_pnl'] == 5.0
    assert len(result['trades']) == 1
    
    trade = result['trades'][0]
    assert trade['pnl'] == 5.0
    assert trade['entry_price'] == 1.1000
    assert trade['exit_price'] == 1.1050
    assert trade['type'] == 'long'

def test_run_nautilus_backtest_no_positions_fallback(mock_nautilus_modules):
    """Test fallback logic when positions are empty but orders exist (FIFO matching)."""
    from backend import nautilus_adapter
    
    # Setup Mocks (Simpler setup)
    nautilus_adapter.NAUTILUS_INSTALLED = True
    nautilus_adapter.BacktestEngine = MagicMock()
    nautilus_adapter.TestInstrumentProvider.default_fx_ccy.return_value = MockInstrument()
    nautilus_adapter.Strategy = MockStrategy
    nautilus_adapter.dt_to_unix_nanos = lambda d: int(d.timestamp() * 1e9)
    
    mock_engine = MagicMock()
    nautilus_adapter.BacktestEngine.return_value = mock_engine
    
    # Empty positions, but we have matched orders
    mock_engine.cache.positions_closed.return_value = []
    
    # Orders: Buy then Sell (Matched)
    ts1 = int(datetime(2024, 1, 1, 10, 0).timestamp() * 1e9)
    ts2 = int(datetime(2024, 1, 1, 11, 0).timestamp() * 1e9)
    
    o1 = MockOrder(is_buy=True, avg_px=1.0, filled_qty=100, ts_last=ts1)
    o2 = MockOrder(is_buy=False, avg_px=1.1, filled_qty=100, ts_last=ts2)
    
    mock_engine.cache.orders_closed.return_value = [o1, o2]
    mock_engine.cache.accounts.return_value = [MockAccount()]
    
    result = nautilus_adapter.run_nautilus_backtest(
        strategy_code="class S(Strategy): pass",
        historical_data=pd.DataFrame({"timestamp": [datetime.now()], "close": [1.0]})
    )
    
    assert result['success'] is True
    assert len(result['trades']) == 1
    t = result['trades'][0]
    assert t['entry_price'] == 1.0
    assert t['exit_price'] == 1.1
    assert t['pnl'] == 10.0 # (1.1 - 1.0) * 100
