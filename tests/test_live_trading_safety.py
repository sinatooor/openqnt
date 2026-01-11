
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from backend.strategy_runner import StrategyRunner

class MockBrokerClient:
    def __init__(self):
        self.create_position = AsyncMock(return_value={"success": True, "deal_reference": "REF123"})
        self.get_positions = AsyncMock(return_value={"success": True, "positions": []})
        self.close_position = AsyncMock(return_value={"success": True})
        self.is_authenticated = True
        self.get_historical_prices = AsyncMock(return_value={
             "success": True, 
             "prices": [{"open": 1.1, "high": 1.2, "low": 1.0, "close": 1.1, "volume": 100}]
        })

@pytest.mark.asyncio
async def test_paper_trading_does_not_execute():
    client = MockBrokerClient()
    # Simple strategy that buys immediately
    # We patch _compile_and_load_strategy to return a mock strategy or use a simple string?
    # Actually, StrategyRunner runs actual python code. Let's provide valid simple code.
    
    code = """
class GeneratedStrategy:
    def __init__(self, config): pass
    def on_start(self): 
        # Immediate buy
        self.submit_order({"order_side": "BUY"})
    def on_bar(self, bar): pass
    def on_stop(self): pass
"""
    
    runner = StrategyRunner(
        broker_client=client,
        broker_type="ig",
        strategy_code=code,
        live_mode=False
    )
    
    # Mock strategy instance and portfolio for _record_trade
    runner.strategy_instance = MagicMock()
    runner.strategy_instance.portfolio = MagicMock()
    runner.strategy_instance.portfolio.positions = {}
    
    # We need to manually trigger the order logic since we aren't starting the full loop or we can mock _compile
    # But let's try to run start() for a short time?
    # Easier: Interact with _handle_order directly.
    
    runner._handle_order({"order_side": "BUY"})
    
    # Assert create_position was NOT called
    client.create_position.assert_not_called()
    
    # Assert trade WAS recorded in runner.trades with 'PAPER' ref
    assert len(runner.trades) == 1
    assert "PAPER" in runner.trades[0]['deal_ref']
    assert runner.trades[0]['action'] == "BUY"

@pytest.mark.asyncio
async def test_live_trading_executes():
    client = MockBrokerClient()
    runner = StrategyRunner(
        broker_client=client,
        broker_type="ig",
        strategy_code="",
        live_mode=True
    )
    
    # Inject correct ID
    runner.instrument_id = "CS.D.EURUSD.TODAY.IP"
    
    # Trigger order
    runner._handle_order({"order_side": "BUY"})
    
    # Wait for async task? _handle_order creates task.
    # In test environment, we might need to yield to event loop.
    await asyncio.sleep(0.1)
    
    # Assert create_position WAS called
    client.create_position.assert_called_once()
    
@pytest.mark.asyncio
async def test_safety_max_size():
    client = MockBrokerClient()
    runner = StrategyRunner(
        broker_client=client,
        broker_type="ig",
        strategy_code="",
        live_mode=True,
        trade_size=10.0, # Huge size
        safety_config={"max_size": 5.0}
    )
    
    runner._handle_order({"order_side": "BUY"})
    await asyncio.sleep(0.1)
    
    # Should be rejected
    client.create_position.assert_not_called()
