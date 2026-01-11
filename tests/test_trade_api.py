
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

@pytest.fixture
def client_with_mock_db():
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
    mock_trade.pnl = 0.0
    mock_trade.execution_id = 10
    
    tags_mock = MagicMock()
    tags_mock.tags = "[]"
    mock_trade.tags = "[]"

    # Setup query return
    mock_query = MagicMock()
    mock_query.filter.return_value = mock_query
    mock_query.order_by.return_value = mock_query
    mock_query.offset.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.all.return_value = [mock_trade]
    
    mock_session.query.return_value = mock_query
    
    def override():
        try:
            yield mock_session
        finally:
            pass
            
    app.dependency_overrides[get_session] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides = {}

def test_get_trades(client_with_mock_db):
    response = client_with_mock_db.get("/api/trades/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["symbol"] == "EURUSD"
    assert data[0]["direction"] == "BUY"
    assert "id" in data[0]

def test_get_executions(client_with_mock_db):
    response = client_with_mock_db.get("/api/trades/executions")
    # Just check 200 OK as we are mocking query broadly
    assert response.status_code == 200
