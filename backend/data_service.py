"""
Market Data Service

Handles data fetching, caching, and serving for backtesting.
Checks local database first, then falls back to external providers (FMP, yfinance).
"""
import logging
import asyncio
import pandas as pd
import numpy as np
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Union
from sqlalchemy import select, and_
import os

from database.connection import get_session, session_scope
from database.models import Asset, DailyPrice, HourlyPrice, AssetMetadata
from fmp.client import FMPClient

# Try to import yfinance
try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False

logger = logging.getLogger(__name__)

class MarketDataService:
    def __init__(self, fmp_api_key: Optional[str] = None):
        self.fmp_api_key = fmp_api_key

    def get_data(
        self, 
        symbol: str, 
        start_date: str, 
        end_date: str, 
        timeframe: str = "1d",
        expiry_days: Optional[int] = None
    ) -> pd.DataFrame:
        """
        Get historical data for a symbol.
        
        Args:
            symbol: Symbol name (e.g. "AAPL", "EURUSD")
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            timeframe: "1d" for daily, "1h" for hourly
            expiry_days: Optional number of days after which cache is considered stale
            
        Returns:
            DataFrame with OHLCV data indexed by timestamp
        """
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            # Handle timestamps if passed
            start_dt = pd.to_datetime(start_date)
            end_dt = pd.to_datetime(end_date)
        
        # 1. Check Local DB
        df = self._get_from_db(symbol, start_dt, end_dt, timeframe)
        
        # 2. Check coverage and freshness
        is_sufficient = self._is_data_sufficient(df, start_dt, end_dt)
        is_fresh = True
        if expiry_days is not None:
             is_fresh = self._is_cache_fresh(symbol, expiry_days)
        
        if is_sufficient and is_fresh:
            logger.info(f"Found sufficient and fresh cached data for {symbol}")
            return df
            
        # 3. Fetch Missing Data
        logger.info(f"Insufficient or stale local data for {symbol}, fetching from external sources...")
        self._fetch_and_store(symbol, start_dt, end_dt, timeframe)
        
        # 4. Return from DB (now populated)
        return self._get_from_db(symbol, start_dt, end_dt, timeframe)

    def _get_from_db(
        self, 
        symbol: str, 
        start_dt: datetime, 
        end_dt: datetime, 
        timeframe: str
    ) -> pd.DataFrame:
        session = get_session()
        try:
            # Resolve Asset
            asset = session.query(Asset).filter(Asset.symbol == symbol).first()
            if not asset:
                return pd.DataFrame()
                
            if timeframe == "1d":
                query = select(DailyPrice).where(
                    and_(
                        DailyPrice.asset_id == asset.id,
                        DailyPrice.date >= start_dt.date(),
                        DailyPrice.date <= end_dt.date()
                    )
                ).order_by(DailyPrice.date)
                
                result = session.execute(query).scalars().all()
                data = [r.to_dict() for r in result]
                df = pd.DataFrame(data)
                if not df.empty:
                    # Convert date to timestamp for consistency
                    df['timestamp'] = pd.to_datetime(df['date'])
                    df.set_index('timestamp', inplace=True)
                    df.drop(columns=['date'], inplace=True, errors='ignore')
                    
            elif timeframe == "1h":
                query = select(HourlyPrice).where(
                    and_(
                        HourlyPrice.asset_id == asset.id,
                        HourlyPrice.datetime >= start_dt,
                        HourlyPrice.datetime <= end_dt
                    )
                ).order_by(HourlyPrice.datetime)
                
                result = session.execute(query).scalars().all()
                data = [r.to_dict() for r in result]
                df = pd.DataFrame(data)
                if not df.empty:
                    df['timestamp'] = pd.to_datetime(df['datetime'])
                    df.set_index('timestamp', inplace=True)
                    df.drop(columns=['datetime'], inplace=True, errors='ignore')
            else:
                logger.error(f"Unsupported timeframe: {timeframe}")
                return pd.DataFrame()
                
            return df
        except Exception as e:
            logger.error(f"Error reading from DB: {e}")
            return pd.DataFrame()
        finally:
            session.close()

    def _is_data_sufficient(
        self, 
        df: pd.DataFrame, 
        start_dt: datetime, 
        end_dt: datetime
    ) -> bool:
        if df.empty:
            return False
            
        data_start = df.index.min()
        data_end = df.index.max()
        
        # Allow 5 days buffer for start and end (e.g. weekends)
        # Ensure data starts before or near requested start
        # and ends after or near requested end
        
        start_ok = data_start <= (start_dt + timedelta(days=5))
        end_ok = data_end >= (end_dt - timedelta(days=5))
        
        return start_ok and end_ok

    def _is_cache_fresh(self, symbol: str, expiry_days: int) -> bool:
        session = get_session()
        try:
            asset = session.query(Asset).filter(Asset.symbol == symbol).first()
            if not asset or not asset.metadata_info:
                return False
            
            last_fetched = asset.metadata_info.last_fetched_at
            if not last_fetched:
                return False
                
            age = datetime.utcnow() - last_fetched
            return age.days < expiry_days
        except Exception as e:
            logger.error(f"Error checking cache freshness: {e}")
            return False
        finally:
            session.close()

    def _fetch_and_store(
        self, 
        symbol: str, 
        start_dt: datetime, 
        end_dt: datetime, 
        timeframe: str
    ):
        # Extend fetch range slightly to ensure coverage
        fetch_start = start_dt - timedelta(days=10)
        fetch_end = end_dt + timedelta(days=5) 
        
        success = False
        
        # Try FMP first (only for daily)
        if self.fmp_api_key and timeframe == "1d":
            try:
                # Run async FMP fetch in sync context
                asyncio.run(self._fetch_fmp(symbol, fetch_start, fetch_end))
                success = True
            except Exception as e:
                logger.warning(f"FMP fetch failed for {symbol}: {e}")
        
        # Fallback to YFinance
        if not success and YFINANCE_AVAILABLE:
            try:
                self._fetch_yfinance(symbol, fetch_start, fetch_end, timeframe)
            except Exception as e:
                logger.error(f"YFinance fetch failed for {symbol}: {e}")
        elif not YFINANCE_AVAILABLE:
            logger.warning("YFinance not available for fallback")

    async def _fetch_fmp(self, symbol: str, start_dt: datetime, end_dt: datetime):
        async with FMPClient(self.fmp_api_key) as client:
            prices = await client.fetch_historical_prices(
                symbol, start_dt.date(), end_dt.date()
            )
            
            if not prices:
                return

            with session_scope() as session:
                asset = self._ensure_asset(session, symbol)
                
                for p in prices:
                    price_date = datetime.strptime(p['date'], "%Y-%m-%d").date()
                    
                    # Upsert logic
                    existing = session.query(DailyPrice).filter_by(
                        asset_id=asset.id, date=price_date
                    ).first()
                    
                    if not existing:
                        new_price = DailyPrice(
                            asset_id=asset.id,
                            symbol=symbol,
                            date=price_date,
                            open=p.get('open'),
                            high=p.get('high'),
                            low=p.get('low'),
                            close=p.get('close'),
                            volume=p.get('volume'),
                            vwap=p.get('vwap'),
                            change=p.get('change'),
                            change_percent=p.get('changePercent')
                        )
                        session.add(new_price)
                    else:
                        # Update existing
                        existing.open = p.get('open')
                        existing.high = p.get('high')
                        existing.low = p.get('low')
                        existing.close = p.get('close')
                        existing.volume = p.get('volume')
                
                # Update metadata
                if asset.metadata_info:
                    asset.metadata_info.last_fetched_at = datetime.utcnow()
    
    def _fetch_yfinance(
        self, 
        symbol: str, 
        start_dt: datetime, 
        end_dt: datetime, 
        timeframe: str
    ):
        yf_interval = "1d" if timeframe == "1d" else "1h"
        
        # YFinance symbol adjustment logic
        yf_symbol = symbol
        # Common Forex format fix
        if len(symbol) == 6 and symbol.isalpha() and not symbol.endswith("=X"):
             # We check if it fetches, if not retry with =X
             pass

        ticker = yf.Ticker(yf_symbol)
        df = ticker.history(start=start_dt, end=end_dt, interval=yf_interval)
        
        if df.empty:
            # Retry with =X for forex
            if len(symbol) == 6 and symbol.isalpha():
                yf_symbol = f"{symbol}=X"
                logger.info(f"Retrying with {yf_symbol}")
                ticker = yf.Ticker(yf_symbol)
                df = ticker.history(start=start_dt, end=end_dt, interval=yf_interval)
        
        if df.empty:
            raise ValueError(f"No data found for {symbol} on YFinance")

        with session_scope() as session:
            asset = self._ensure_asset(session, symbol)
            
            for idx, row in df.iterrows():
                ts = pd.to_datetime(idx)
                
                if timeframe == "1d":
                    price_date = ts.date()
                    existing = session.query(DailyPrice).filter_by(
                        asset_id=asset.id, date=price_date
                    ).first()
                    
                    if not existing:
                        new_price = DailyPrice(
                            asset_id=asset.id,
                            symbol=symbol,
                            date=price_date,
                            open=float(row['Open']),
                            high=float(row['High']),
                            low=float(row['Low']),
                            close=float(row['Close']),
                            volume=int(row['Volume']) if row['Volume'] > 0 else None
                        )
                        session.add(new_price)
                        
                elif timeframe == "1h":
                    ts_naive = ts.tz_localize(None) if ts.tzinfo else ts
                    existing = session.query(HourlyPrice).filter_by(
                        asset_id=asset.id, datetime=ts_naive
                    ).first()
                    
                    if not existing:
                        new_price = HourlyPrice(
                            asset_id=asset.id,
                            symbol=symbol,
                            datetime=ts_naive,
                            open=float(row['Open']),
                            high=float(row['High']),
                            low=float(row['Low']),
                            close=float(row['Close']),
                            volume=int(row['Volume']) if row['Volume'] > 0 else None
                        )
                        session.add(new_price)
            
            # Update metadata
            if asset.metadata_info:
                asset.metadata_info.last_fetched_at = datetime.utcnow()

    def _ensure_asset(self, session, symbol: str) -> Asset:
        asset = session.query(Asset).filter_by(symbol=symbol).first()
        if not asset:
            asset = Asset(
                symbol=symbol,
                asset_type="unknown",
                name=symbol,
                is_active=True
            )
            session.add(asset)
            session.flush()
            
            meta = AssetMetadata(asset_id=asset.id)
            session.add(meta)
            asset.metadata_info = meta # Ensure relationship is populated
        
        elif not asset.metadata_info:
             meta = AssetMetadata(asset_id=asset.id)
             session.add(meta)
             asset.metadata_info = meta
            
        return asset
