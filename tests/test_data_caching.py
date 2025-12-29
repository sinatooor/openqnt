import pytest
import pandas as pd
import sys
import os
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

# Ensure backend is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.data_service import MarketDataService

class TestDataCaching:
    @pytest.fixture
    def service(self):
        return MarketDataService()

    def test_get_data_empty_db_fetch_fallback(self, service):
        """Test that missing data triggers fetch and returns data."""
        symbol = "TEST_SYM"
        start = "2024-01-01"
        end = "2024-01-05"
        
        # Mock DB response (empty first, then populated)
        with patch.object(service, '_get_from_db') as mock_db:
            # First call returns empty, second returns data
            mock_data = pd.DataFrame({
                'open': [100.0] * 5,
                'high': [105.0] * 5,
                'low': [95.0] * 5,
                'close': [101.0] * 5,
                'volume': [1000] * 5
            }, index=pd.to_datetime(pd.date_range(start, periods=5)))
            
            mock_db.side_effect = [pd.DataFrame(), mock_data]
            
            # Mock fetch
            with patch.object(service, '_fetch_and_store') as mock_fetch:
                df = service.get_data(symbol, start, end)
                
                assert not df.empty
                assert len(df) == 5
                mock_fetch.assert_called_once()
                assert mock_db.call_count == 2

    def test_get_data_cached(self, service):
        """Test that cached data is used without fetching."""
        symbol = "TEST_CACHED"
        start = "2024-01-01"
        end = "2024-01-05"
        
        mock_data = pd.DataFrame({
            'open': [100.0] * 5,
            'close': [101.0] * 5
        }, index=pd.to_datetime(pd.date_range(start, periods=5)))
        
        with patch.object(service, '_get_from_db', return_value=mock_data):
            with patch.object(service, '_fetch_and_store') as mock_fetch:
                df = service.get_data(symbol, start, end)
                
                assert not df.empty
                mock_fetch.assert_not_called()

    def test_get_data_expired(self, service):
        """Test that expired cache triggers refetch."""
        symbol = "TEST_EXPIRED"
        start = "2024-01-01"
        end = "2024-01-05"
        expiry = 1 # 1 day expiry
        
        mock_data = pd.DataFrame({
            'open': [100.0] * 5,
            'close': [101.0] * 5
        }, index=pd.to_datetime(pd.date_range(start, periods=5)))
        
        # Mock DB to return data
        with patch.object(service, '_get_from_db', return_value=mock_data):
            # Mock freshness to return False
            with patch.object(service, '_is_cache_fresh', return_value=False) as mock_fresh:
                with patch.object(service, '_fetch_and_store') as mock_fetch:
                    df = service.get_data(symbol, start, end, expiry_days=expiry)
                    
                    mock_fresh.assert_called_once()
                    mock_fetch.assert_called_once()

    def test_is_data_sufficient(self, service):
        """Test coverage logic."""
        start = datetime(2024, 1, 10)
        end = datetime(2024, 1, 20)
        
        # 1. Perfect coverage
        # Fix: Add columns to ensure df is not empty
        df = pd.DataFrame({'close': [100]*11}, index=pd.date_range("2024-01-10", "2024-01-20"))
        assert service._is_data_sufficient(df, start, end)
        
        # 2. Good coverage (with buffer)
        df = pd.DataFrame({'close': [100]*7}, index=pd.date_range("2024-01-12", "2024-01-18"))
        assert service._is_data_sufficient(df, start, end)
        
        # 3. Bad coverage (too late start)
        df = pd.DataFrame({'close': [100]*5}, index=pd.date_range("2024-01-16", "2024-01-20"))
        assert not service._is_data_sufficient(df, start, end)
        
        # 4. Bad coverage (too early end)
        df = pd.DataFrame({'close': [100]*5}, index=pd.date_range("2024-01-10", "2024-01-14"))
        assert not service._is_data_sufficient(df, start, end)
