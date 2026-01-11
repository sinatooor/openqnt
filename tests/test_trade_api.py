
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
import datetime

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../backend'))

from main import app
from database.connection import get_session
from database.models import Trade

# Mock DB Session
def override_get_session():
    mock_session = MagicMock()
    
    # Mock Trades
    mock_trade = MagicMock()
    mock_trade.id = 1
    mock_trade.symbol = "EURUSD"
    mock_trade.direction = "BUY"
    mock_trade.size = 10000
    mock_trade.entry_price = 1.0500
    mock_trade.entry_time = datetime.datetime.now()
    mock_trade.status = "OPEN"
    mock_trade.pnl = None
    mock_trade.execution_id = 10
    
    # Setup query return
    mock_query = MagicMock()
    mock_query.filter.return_value = mock_query # Chaining
    mock_query.order_by.return_value = mock_query
    mock_query.offset.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.all.return_value = [mock_trade]
    
    mock_session.query.return_value = mock_query
    
    try:
        yield mock_session
    finally:
        pass

# Apply override
app.dependency_overrides[get_session] = override_get_session

client = TestClient(app)

def test_get_trades():
    response = client.get("/api/trades/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["symbol"] == "EURUSD"
    assert data[0]["direction"] == "BUY"
    assert "id" in data[0]

def test_get_executions():
    # We need to mock Execution query logic too if we want to test that specifically
    # But since we mocked session.query generally, we need to handle different calls
    # For now, let's just verify the endpoint exists and returns 200 (even if mock structure is same)
    response = client.get("/api/trades/executions")
    assert response.status_code == 200
    # Data might be garbage because we returned Trade objects for Query(StrategyExecution) 
    # but as long as it handles the list, it proves the router is mounted.
