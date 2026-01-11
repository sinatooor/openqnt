
import pytest
import pandas as pd
from unittest.mock import MagicMock, patch
from backend.market_screener import MarketScreener

class TestMarketScreener:
    
    @pytest.fixture
    def screener(self):
        return MarketScreener(db_path=':memory:')

    @patch('backend.market_screener.yf.Ticker')
    def test_fetch_single_ticker(self, mock_ticker, screener):
        # Setup mock
        mock_instance = MagicMock()
        mock_ticker.return_value = mock_instance
        
        # Mock DataFrame
        dates = pd.date_range(start='2024-01-01', periods=10)
        df = pd.DataFrame({
            'Open': [100.0] * 10,
            'High': [110.0] * 10,
            'Low': [90.0] * 10,
            'Close': [105.0] * 10,
            'Volume': [1000] * 10
        }, index=dates)
        mock_instance.history.return_value = df
        
        result = screener._fetch_single_ticker('AAPL', 10)
        assert result is not None
        assert not result.empty
        assert len(result) == 10

    @patch('backend.market_screener.MarketScreener._fetch_single_ticker')
    @patch('backend.market_screener.MarketScreener._save_to_db')
    def test_fetch_data_parallel(self, mock_save, mock_fetch, screener):
        # Setup mock return
        df = pd.DataFrame({'Close': [100, 101, 102]})
        mock_fetch.return_value = df
        
        symbols = ['AAPL', 'GOOGL', 'MSFT']
        results = screener.fetch_data_parallel(symbols, days_back=10, max_workers=2, save_to_db=True)
        
        assert len(results) == 3
        assert 'AAPL' in results
        assert mock_fetch.call_count == 3
        assert mock_save.call_count == 3

    def test_apply_filter(self, screener):
        # Create DataFrames
        df_pass = pd.DataFrame({'Close': [100, 110, 120]})
        df_fail = pd.DataFrame({'Close': [100, 90, 80]})
        
        data = {
            'PASS': df_pass,
            'FAIL': df_fail
        }
        
        # Criteria: Last price > First price
        def is_positive(df):
            return df['Close'].iloc[-1] > df['Close'].iloc[0]
            
        filtered = screener.apply_filter(data, is_positive)
        
        assert len(filtered) == 1
        assert filtered[0] == 'PASS'

    def test_calculate_sma(self):
        s = pd.Series([10, 20, 30, 40, 50])
        sma = MarketScreener.calculate_sma(s, window=3)
        # First 2 should be NaN, 3rd is (10+20+30)/3 = 20
        assert pd.isna(sma.iloc[0])
        assert pd.isna(sma.iloc[1])
        assert sma.iloc[2] == 20.0
        assert sma.iloc[4] == 40.0
