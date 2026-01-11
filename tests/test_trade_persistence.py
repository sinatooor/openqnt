
import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock
from datetime import datetime
from backend.strategy_runner import StrategyRunner
from backend.database.models import StrategyExecution, Trade
from backend.database.connection import session_scope

class MockIGClient:
    def __init__(self):
        self.is_authenticated = True
        self.session_key = "mock_session"
    
    async def get_historical_prices(self, *args, **kwargs):
        return {
            "success": True,
            "prices": [{
                "snapshotTime": datetime.now().isoformat(),
                "openPrice": {"mid": 1.1000},
                "highPrice": {"mid": 1.1010},
                "lowPrice": {"mid": 1.0990},
                "closePrice": {"mid": 1.1005},
                "lastTradedVolume": 1000
            }]
        }

    async def create_position(self, *args, **kwargs):
        return {
            "success": True, 
            "deal_reference": "TEST_REF_123"
        }
    
    async def get_positions(self):
        return {"success": True, "positions": []}


@pytest.mark.asyncio
async def test_strategy_execution_and_trade_persistence():
    # 1. Start Strategy Runner with Mock Client
    mock_client = MockIGClient()
    
    # Simple strategy that buys immediately
    strategy_code = """
class GeneratedStrategy:
    def __init__(self, config): pass
    def on_start(self): 
        # Trigger buy via 'submit_order' which calls runner._handle_order
        self.submit_order({
            'instrument_id': 'EURUSD',
            'order_side': 'ORDERSIDE.BUY',
            'quantity': 1
        })
    def on_stop(self): pass
    def on_bar(self, bar): pass
"""
    
    runner = StrategyRunner(
        broker_client=mock_client,
        broker_type='ig',
        strategy_code=strategy_code,
        symbol="EURUSD",
        poll_interval=0  # Don't sleep
    )
    
    # Manually start parts to control flow without infinite loop
    # We call start() but cancel it quickly or mock the loop?
    # Better: Start it in a task, wait a bit, then stop.
    
    task = asyncio.create_task(runner.start())
    
    # Give it time to start and execute 'on_start'
    await asyncio.sleep(1)
    
    runner.stop()
    await task
    
    # 2. Verify DB Records
    with session_scope() as session:
        # Check Execution
        executions = session.query(StrategyExecution).all()
        assert len(executions) > 0
        latest_exec = executions[-1]
        assert latest_exec.symbol == "EURUSD"
        assert latest_exec.status == "stopped"
        
        # Check Trades (linked to execution)
        assert len(latest_exec.trades) == 1
        trade = latest_exec.trades[0]
        assert trade.direction == "BUY"
        assert trade.broker_ref == "TEST_REF_123"
        assert trade.symbol == "EURUSD"
        
        print(f"Verified Execution ID: {latest_exec.id} has Trade ID: {trade.id}")
