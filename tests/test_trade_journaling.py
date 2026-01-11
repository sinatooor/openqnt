"""
Tests for Trade Journaling and Tagging (Objective 19).
"""
import pytest
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from database.models import Trade, Base
from database.connection import get_engine
from sqlalchemy.orm import Session


@pytest.fixture
def db_session():
    """Create a test database session."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


def test_trade_tags_set_and_get():
    """Test Trade.get_tags() and Trade.set_tags() methods."""
    from datetime import datetime
    trade = Trade(
        symbol="EURUSD",
        direction="BUY",
        entry_time=datetime(2024, 1, 1, 10, 0, 0),
        entry_price=1.1000,
        size=1.0,
        status="OPEN"
    )
    
    # Initially no tags
    assert trade.get_tags() == {}
    
    # Set tags
    trade.set_tags({
        "entry_reason": "RSI oversold",
        "regime": "trending",
        "custom": "test_tag"
    })
    
    # Verify tags stored as JSON
    assert trade.tags is not None
    assert "RSI oversold" in trade.tags
    
    # Verify get_tags returns dict
    tags = trade.get_tags()
    assert tags["entry_reason"] == "RSI oversold"
    assert tags["regime"] == "trending"
    assert tags["custom"] == "test_tag"


def test_trade_tags_persisted(db_session):
    """Test tags are persisted to database."""
    from datetime import datetime
    trade = Trade(
        symbol="AAPL",
        direction="SELL",
        entry_time=datetime(2024, 1, 2, 15, 30, 0),
        entry_price=150.00,
        size=10.0,
        status="CLOSED"
    )
    trade.set_tags({"strategy": "momentum", "confidence": "high"})
    
    db_session.add(trade)
    db_session.commit()
    
    # Reload from DB
    loaded = db_session.query(Trade).filter(Trade.symbol == "AAPL").first()
    assert loaded is not None
    
    tags = loaded.get_tags()
    assert tags["strategy"] == "momentum"
    assert tags["confidence"] == "high"


def test_empty_tags():
    """Test empty/null tags handling."""
    from datetime import datetime
    trade = Trade(
        symbol="BTCUSD",
        direction="BUY",
        entry_time=datetime(2024, 1, 3),
        entry_price=40000,
        size=0.1,
        status="OPEN"
    )
    
    # No tags set
    assert trade.get_tags() == {}
    
    # Set empty dict
    trade.set_tags({})
    assert trade.get_tags() == {}
    
    # Set None
    trade.set_tags(None)
    assert trade.get_tags() == {}
