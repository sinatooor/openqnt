
import logging
import concurrent.futures
import pandas as pd
import numpy as np
import yfinance as yf
import sqlite3
import datetime
from typing import List, Dict, Optional, Any, Callable
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add backend to path (if needed later for imports)
import sys
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Import database models (assuming these exist from inspection of fetch_forex_data.py)
from database.connection import session_scope
from database.models import Asset, AssetMetadata, DailyPrice
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

class MarketScreener:
    def __init__(self, db_path: str = 'data/market_data.db'):
        """
        Initialize the Market Screener.
        """
        self.db_path = db_path
        
    def _fetch_single_ticker(self, symbol: str, days_back: int) -> Optional[pd.DataFrame]:
        """
        Fetch data for a single ticker using yfinance.
        """
        try:
            end_date = datetime.datetime.now()
            start_date = end_date - datetime.timedelta(days=days_back)
            
            ticker = yf.Ticker(symbol)
            df = ticker.history(start=start_date, end=end_date, interval="1d", auto_adjust=False)
            
            if df.empty:
                logger.warning(f"No data for {symbol}")
                return None
                
            return df
        except Exception as e:
            logger.error(f"Error fetching {symbol}: {e}")
            return None

    def fetch_data_parallel(self, symbols: List[str], days_back: int = 365, max_workers: int = 10, save_to_db: bool = True) -> Dict[str, pd.DataFrame]:
        """
        Fetch market data for multiple symbols in parallel.
        
        Args:
            symbols: List of ticker symbols (e.g. ['AAPL', 'MSFT', 'EURUSD=X'])
            days_back: Number of days of historical data to fetch
            max_workers: Number of parallel threads
            save_to_db: Whether to save fetched data to the local SQLite database
            
        Returns:
            Dictionary mapping symbol -> DataFrame
        """
        results = {}
        logger.info(f"Starting parallel fetch for {len(symbols)} symbols with {max_workers} workers...")
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Create a map of future -> symbol
            future_to_symbol = {
                executor.submit(self._fetch_single_ticker, symbol, days_back): symbol 
                for symbol in symbols
            }
            
            for future in concurrent.futures.as_completed(future_to_symbol):
                symbol = future_to_symbol[future]
                try:
                    df = future.result()
                    if df is not None and not df.empty:
                        results[symbol] = df
                        if save_to_db:
                            self._save_to_db(symbol, df)
                except Exception as e:
                    logger.error(f"Exception for {symbol}: {e}")
                    
        logger.info(f"Fetch complete. Got data for {len(results)}/{len(symbols)} symbols.")
        return results

    def _save_to_db(self, symbol: str, df: pd.DataFrame):
        """
        Save DataFrame to SQLite using SQLAlchemy (upsert).
        """
        try:
            with session_scope() as session:
                # Get or create Asset
                asset = session.execute(select(Asset).where(Asset.symbol == symbol)).scalar_one_or_none()
                if not asset:
                    asset = Asset(symbol=symbol, name=symbol, asset_type='unknown', is_active=True)
                    session.add(asset)
                    session.flush()
                    
                    # Create default metadata
                    metadata = AssetMetadata(asset_id=asset.id, exchange="UNKNOWN", currency="USD")
                    session.add(metadata)
                    session.flush()

                # Optimized Upsert
                # Note: This follows the pattern in backend/fetch_forex_data.py but could be optimized further with bulk inserts
                # For now, we iterate to ensure correctness with existing schema
                for date_idx, row in df.iterrows():
                    date_val = date_idx.date() if hasattr(date_idx, 'date') else date_idx
                    
                    price_data = {
                        'asset_id': asset.id,
                        'symbol': symbol,
                        'date': date_val,
                        'open': float(row.get('Open', 0)),
                        'high': float(row.get('High', 0)),
                        'low': float(row.get('Low', 0)),
                        'close': float(row.get('Close', 0)),
                        'volume': int(row.get('Volume', 0)) if row.get('Volume', 0) > 0 else None,
                    }
                    
                    stmt = sqlite_insert(DailyPrice).values(**price_data)
                    stmt = stmt.on_conflict_do_update(
                        index_elements=['symbol', 'date'],
                        set_={
                            'open': stmt.excluded.open,
                            'high': stmt.excluded.high,
                            'low': stmt.excluded.low,
                            'close': stmt.excluded.close,
                            'volume': stmt.excluded.volume,
                        }
                    )
                    session.execute(stmt)
                
                # Update Metadata
                meta_stmt = select(AssetMetadata).where(AssetMetadata.asset_id == asset.id)
                metadata = session.execute(meta_stmt).scalar_one_or_none()
                if metadata:
                    metadata.last_fetched_at = datetime.datetime.utcnow()
                
        except Exception as e:
            logger.error(f"Failed to save {symbol} to DB: {e}")

    def load_from_db(self, symbols: Optional[List[str]] = None) -> Dict[str, pd.DataFrame]:
        """
        Load data from local database.
        """
        results = {}
        query = "SELECT symbol, date, open, high, low, close, volume FROM daily_prices"
        
        if symbols:
            joined_symbols = "', '".join(symbols)
            query += f" WHERE symbol IN ('{joined_symbols}')"
            
        try:
            conn = sqlite3.connect(self.db_path)
            df_all = pd.read_sql_query(query, conn)
            conn.close()
            
            if df_all.empty:
                return {}
                
            df_all['date'] = pd.to_datetime(df_all['date'])
            
            # Group by symbol key
            for symbol, group in df_all.groupby('symbol'):
                group.set_index('date', inplace=True)
                results[symbol] = group.sort_index()
                
            return results
        except Exception as e:
            logger.error(f"Error loading from DB: {e}")
            return {}

    def apply_filter(self, data: Dict[str, pd.DataFrame], criteria_func: Callable[[pd.DataFrame], bool]) -> List[str]:
        """
        Apply a filtering function to the dataset.
        
        Args:
            data: Dictionary of {symbol: DataFrame}
            criteria_func: Function that takes a DataFrame and returns True (pass) or False (fail)
            
        Returns:
            List of symbols that passed the criteria
        """
        passed_symbols = []
        for symbol, df in data.items():
            if df.empty:
                continue
            try:
                if criteria_func(df):
                    passed_symbols.append(symbol)
            except Exception as e:
                logger.error(f"Error filtering {symbol}: {e}")
                
        return passed_symbols

    # --- Built-in Technical Indicators for easy screening ---
    
    @staticmethod
    def calculate_sma(series: pd.Series, window: int) -> pd.Series:
        return series.rolling(window=window).mean()

    @staticmethod
    def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
        delta = series.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs))

    @staticmethod
    def calculate_macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
        exp1 = series.ewm(span=fast, adjust=False).mean()
        exp2 = series.ewm(span=slow, adjust=False).mean()
        macd = exp1 - exp2
        signal_line = macd.ewm(span=signal, adjust=False).mean()
        return pd.DataFrame({'macd': macd, 'signal': signal_line})

    @staticmethod
    def calculate_bollinger_bands(series: pd.Series, window: int = 20, num_std: float = 2.0) -> pd.DataFrame:
        rolling_mean = series.rolling(window=window).mean()
        rolling_std = series.rolling(window=window).std()
        upper_band = rolling_mean + (rolling_std * num_std)
        lower_band = rolling_mean - (rolling_std * num_std)
        return pd.DataFrame({'upper': upper_band, 'middle': rolling_mean, 'lower': lower_band})

    # --- Preset Filters ---
    
    @staticmethod
    def filter_uptrend_sma200(df: pd.DataFrame) -> bool:
        if len(df) < 200: return False
        sma200 = df['Close'].rolling(200).mean()
        return df['Close'].iloc[-1] > sma200.iloc[-1]

    @staticmethod
    def filter_downtrend_sma200(df: pd.DataFrame) -> bool:
        if len(df) < 200: return False
        sma200 = df['Close'].rolling(200).mean()
        return df['Close'].iloc[-1] < sma200.iloc[-1]

    @staticmethod
    def filter_rsi_oversold(df: pd.DataFrame) -> bool:
        if len(df) < 15: return False
        rsi = MarketScreener.calculate_rsi(df['Close'], 14)
        return rsi.iloc[-1] < 30

    @staticmethod
    def filter_rsi_overbought(df: pd.DataFrame) -> bool:
        if len(df) < 15: return False
        rsi = MarketScreener.calculate_rsi(df['Close'], 14)
        return rsi.iloc[-1] > 70

    @staticmethod
    def filter_macd_bullish(df: pd.DataFrame) -> bool:
        if len(df) < 26: return False
        macd_df = MarketScreener.calculate_macd(df['Close'])
        # Crossover: MACD > Signal AND prev MACD < prev Signal
        return macd_df['macd'].iloc[-1] > macd_df['signal'].iloc[-1] and \
               macd_df['macd'].iloc[-2] <= macd_df['signal'].iloc[-2]

    @staticmethod
    def filter_macd_bearish(df: pd.DataFrame) -> bool:
        if len(df) < 26: return False
        macd_df = MarketScreener.calculate_macd(df['Close'])
        return macd_df['macd'].iloc[-1] < macd_df['signal'].iloc[-1] and \
               macd_df['macd'].iloc[-2] >= macd_df['signal'].iloc[-2]

    @staticmethod
    def filter_bb_squeeze(df: pd.DataFrame) -> bool:
        if len(df) < 20: return False
        bb = MarketScreener.calculate_bollinger_bands(df['Close'])
        bandwidth = (bb['upper'] - bb['lower']) / bb['middle']
        # Simple definition: Bandwidth is in the lowest 20th percentile of last 6 months (approx 126 days)
        lookback = min(len(bandwidth), 126)
        recent_bandwidth = bandwidth.tail(lookback)
        current_bw = bandwidth.iloc[-1]
        return current_bw <= recent_bandwidth.quantile(0.2)

    @staticmethod
    def filter_volume_breakout(df: pd.DataFrame) -> bool:
        if len(df) < 20: return False
        vol_sma20 = df['Volume'].rolling(20).mean()
        # Volume > 200% of average
        return df['Volume'].iloc[-1] > (vol_sma20.iloc[-1] * 2)

    def screen(self, symbols: List[str], filter_name: str, days_back: int = 365) -> List[Dict[str, Any]]:
        """
        High-level screening method.
        """
        FILTERS = {
            "uptrend_sma200": self.filter_uptrend_sma200,
            "downtrend_sma200": self.filter_downtrend_sma200,
            "rsi_oversold": self.filter_rsi_oversold,
            "rsi_overbought": self.filter_rsi_overbought,
            "macd_bullish_crossover": self.filter_macd_bullish,
            "macd_bearish_crossover": self.filter_macd_bearish,
            "bollinger_squeeze": self.filter_bb_squeeze,
            "volume_breakout": self.filter_volume_breakout,
        }
        
        criteria_func = FILTERS.get(filter_name)
        
        # If no filter matches, maybe return all (or handle None gracefully) -> For now, return empty if invalid
        # But maybe user wants "No Filter" just to get data?
        if filter_name == "all":
            criteria_func = lambda x: True
        elif not criteria_func:
            logger.warning(f"Unknown filter: {filter_name}")
            return []

        # Fetch Data
        data = self.fetch_data_parallel(symbols, days_back=days_back, save_to_db=False)
        
        # Apply Filter
        passed_symbols = self.apply_filter(data, criteria_func)
        
        # Build Results
        results = []
        for sym in passed_symbols:
            df = data[sym]
            latest = df.iloc[-1]
            prev = df.iloc[-2] if len(df) > 1 else latest
            
            change_pct = ((latest['Close'] - prev['Close']) / prev['Close']) * 100
            
            # Determine "Signal" (Basic algo)
            signal = "Neutral"
            rsi = self.calculate_rsi(df['Close']).iloc[-1] if len(df) > 15 else 50
            if rsi < 30: signal = "Strong Buy"
            elif rsi > 70: signal = "Strong Sell"
            elif change_pct > 2: signal = "Buy"
            elif change_pct < -2: signal = "Sell"

            # Prepare Sparkline Data (Last 20 closes, normalized)
            sparkline_data = df['Close'].tail(20).tolist()
            
            results.append({
                "symbol": sym,
                "close": round(latest['Close'], 5),
                "change_pct": round(change_pct, 2),
                "volume": int(latest['Volume']),
                "market_cap": "N/A", # Placeholder, yfinance history doesn't provide this easily in bulk
                "sector": "Unknown", # Would need metadata fetch
                "signal": signal,
                "sparkline": sparkline_data
            })
            
        return results

# Example Usage
if __name__ == "__main__":
    screener = MarketScreener()
    
    # Example: Forex Majors
    forex_pairs = ["EURUSD=X", "GBPUSD=X", "USDJPY=X", "AUDUSD=X"]
    
    # Screen
    results = screener.screen(forex_pairs, "uptrend_sma200")
    print(f"Results: {results}")
