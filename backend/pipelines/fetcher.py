"""
FMP Data Fetcher Pipeline.

Orchestrates fetching historical market data from FMP API and storing in SQLite database.
"""
import logging
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy import select

from database import init_db, get_session
from database.models import Asset, AssetMetadata, DailyPrice
from fmp.client import FMPClient, ALL_SYMBOLS, SymbolConfig, AssetType

logger = logging.getLogger(__name__)


class FMPDataFetcher:
    """
    Pipeline for fetching FMP data and storing in database.
    
    Handles:
    - Creating/updating asset records
    - Upserting price data (insert or update on conflict)
    - Tracking fetch metadata
    """
    
    def __init__(self, api_key: str):
        """
        Initialize the data fetcher.
        
        Args:
            api_key: FMP API key
        """
        self.api_key = api_key
        self._stats = {
            "symbols_processed": 0,
            "records_inserted": 0,
            "records_updated": 0,
            "errors": 0,
        }
    
    def _ensure_asset_exists(self, session, config: SymbolConfig) -> Asset:
        """
        Ensure an asset record exists in the database.
        
        Args:
            session: Database session
            config: Symbol configuration
            
        Returns:
            Asset record
        """
        # Check if asset exists
        asset = session.query(Asset).filter(Asset.symbol == config.symbol).first()
        
        if not asset:
            # Create new asset
            asset = Asset(
                symbol=config.symbol,
                name=config.name,
                asset_type=config.asset_type.value,
                is_active=True,
            )
            session.add(asset)
            session.flush()  # Get the ID
            
            # Create metadata record
            metadata = AssetMetadata(
                asset_id=asset.id,
                exchange=config.exchange,
                currency=config.currency,
            )
            session.add(metadata)
            session.flush()
            
            logger.info(f"Created asset record for {config.symbol}")
        
        return asset
    
    def _upsert_prices(
        self, 
        session, 
        asset: Asset, 
        prices: List[Dict[str, Any]]
    ) -> tuple:
        """
        Insert or update price records.
        
        Uses SQLite's ON CONFLICT for upsert behavior.
        
        Args:
            session: Database session
            asset: Asset record
            prices: List of price dictionaries from FMP API
            
        Returns:
            Tuple of (inserted_count, updated_count)
        """
        if not prices:
            return 0, 0
        
        inserted = 0
        updated = 0
        
        for price_data in prices:
            try:
                price_date = datetime.strptime(price_data["date"], "%Y-%m-%d").date()
                
                # Check if record exists
                existing = session.query(DailyPrice).filter(
                    DailyPrice.symbol == asset.symbol,
                    DailyPrice.date == price_date
                ).first()
                
                if existing:
                    # Update existing record
                    existing.open = price_data.get("open")
                    existing.high = price_data.get("high")
                    existing.low = price_data.get("low")
                    existing.close = price_data.get("close")
                    existing.volume = price_data.get("volume")
                    existing.change = price_data.get("change")
                    existing.change_percent = price_data.get("changePercent")
                    existing.vwap = price_data.get("vwap")
                    updated += 1
                else:
                    # Insert new record
                    new_price = DailyPrice(
                        asset_id=asset.id,
                        symbol=asset.symbol,
                        date=price_date,
                        open=price_data.get("open"),
                        high=price_data.get("high"),
                        low=price_data.get("low"),
                        close=price_data.get("close"),
                        volume=price_data.get("volume"),
                        change=price_data.get("change"),
                        change_percent=price_data.get("changePercent"),
                        vwap=price_data.get("vwap"),
                    )
                    session.add(new_price)
                    inserted += 1
                    
            except Exception as e:
                logger.error(f"Error processing price record: {e}")
                self._stats["errors"] += 1
                continue
        
        return inserted, updated
    
    def _update_metadata(
        self, 
        session, 
        asset: Asset, 
        prices: List[Dict[str, Any]]
    ):
        """
        Update asset metadata with fetch information.
        
        Args:
            session: Database session
            asset: Asset record
            prices: List of price records
        """
        if not prices:
            return
        
        metadata = session.query(AssetMetadata).filter(
            AssetMetadata.asset_id == asset.id
        ).first()
        
        if metadata:
            # Sort prices by date
            sorted_prices = sorted(prices, key=lambda x: x.get("date", ""))
            
            if sorted_prices:
                first_date = datetime.strptime(sorted_prices[0]["date"], "%Y-%m-%d").date()
                last_date = datetime.strptime(sorted_prices[-1]["date"], "%Y-%m-%d").date()
                
                # Update only if we have earlier/later dates
                if metadata.first_price_date is None or first_date < metadata.first_price_date:
                    metadata.first_price_date = first_date
                if metadata.last_price_date is None or last_date > metadata.last_price_date:
                    metadata.last_price_date = last_date
                
                metadata.total_records = session.query(DailyPrice).filter(
                    DailyPrice.asset_id == asset.id
                ).count()
                metadata.last_fetched_at = datetime.utcnow()
    
    async def fetch_and_store(
        self,
        from_date: date,
        to_date: date,
        symbols: Optional[List[SymbolConfig]] = None,
    ) -> Dict[str, Any]:
        """
        Fetch data from FMP API and store in database.
        
        Args:
            from_date: Start date for historical data
            to_date: End date for historical data
            symbols: Optional list of symbols to fetch (defaults to ALL_SYMBOLS)
            
        Returns:
            Statistics dictionary
        """
        if symbols is None:
            symbols = ALL_SYMBOLS
        
        # Initialize database
        init_db()
        
        logger.info(f"Starting FMP data fetch: {from_date} to {to_date}")
        logger.info(f"Symbols to fetch: {len(symbols)}")
        
        async with FMPClient(self.api_key) as client:
            for i, config in enumerate(symbols, 1):
                logger.info(f"\n[{i}/{len(symbols)}] Processing {config.symbol} ({config.name})")
                
                try:
                    # Fetch data from FMP
                    prices = await client.fetch_historical_prices(
                        config.symbol,
                        from_date,
                        to_date,
                    )
                    
                    if not prices:
                        logger.warning(f"No data received for {config.symbol}")
                        continue
                    
                    # Store in database
                    session = get_session()
                    try:
                        # Ensure asset exists
                        asset = self._ensure_asset_exists(session, config)
                        
                        # Upsert prices
                        inserted, updated = self._upsert_prices(session, asset, prices)
                        
                        # Update metadata
                        self._update_metadata(session, asset, prices)
                        
                        session.commit()
                        
                        self._stats["symbols_processed"] += 1
                        self._stats["records_inserted"] += inserted
                        self._stats["records_updated"] += updated
                        
                        logger.info(f"  → Stored {inserted} new, {updated} updated records")
                        
                    except Exception as e:
                        session.rollback()
                        logger.error(f"Database error for {config.symbol}: {e}")
                        self._stats["errors"] += 1
                    finally:
                        session.close()
                        
                except Exception as e:
                    logger.error(f"Error fetching {config.symbol}: {e}")
                    self._stats["errors"] += 1
        
        logger.info("\n" + "=" * 50)
        logger.info("FETCH COMPLETE")
        logger.info(f"  Symbols processed: {self._stats['symbols_processed']}")
        logger.info(f"  Records inserted: {self._stats['records_inserted']}")
        logger.info(f"  Records updated: {self._stats['records_updated']}")
        logger.info(f"  Errors: {self._stats['errors']}")
        logger.info(f"  API requests made: {client.request_count}")
        logger.info("=" * 50)
        
        return self._stats
    
    @property
    def stats(self) -> Dict[str, Any]:
        """Return current statistics."""
        return self._stats.copy()
