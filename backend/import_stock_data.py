#!/usr/bin/env python3
"""
Import historical OHLC data from CSV files into the SQLite database.

Handles both daily (1d) and hourly (1h) OHLC data from the stock-data folder.
"""
import csv
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from database.connection import init_db, session_scope
from database.models import Asset, AssetMetadata, DailyPrice, HourlyPrice

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

# Data folder paths
STOCK_DATA_DIR = Path(__file__).parent.parent / "stock-data"
DAILY_DATA_DIR = STOCK_DATA_DIR / "XNAS-20251208-KWUNHHXXC8"
HOURLY_DATA_DIR = STOCK_DATA_DIR / "XNAS-20251208-MC87YTHXUH"

DAILY_CSV = DAILY_DATA_DIR / "xnas-itch-20180501-20251205.ohlcv-1d.csv"
HOURLY_CSV = HOURLY_DATA_DIR / "xnas-itch-20180501-20251205.ohlcv-1h.csv"

# Symbol name mapping
SYMBOL_NAMES = {
    "AAPL": "Apple Inc.",
    "AMD": "Advanced Micro Devices Inc.",
    "AMZN": "Amazon.com Inc.",
    "GDX": "VanEck Gold Miners ETF",
    "GOOGL": "Alphabet Inc.",
    "META": "Meta Platforms Inc.",
    "MSFT": "Microsoft Corporation",
    "NFLX": "Netflix Inc.",
    "NVDA": "NVIDIA Corporation",
    "ORCL": "Oracle Corporation",
    "RSP": "Invesco S&P 500 Equal Weight ETF",
    "SPY": "SPDR S&P 500 ETF Trust",
    "TSLA": "Tesla Inc.",
}


def get_or_create_asset(session, symbol: str) -> Asset:
    """Get existing asset or create a new one."""
    asset = session.query(Asset).filter(Asset.symbol == symbol).first()
    
    if not asset:
        # Determine asset type
        if symbol in ["SPY", "RSP", "GDX"]:
            asset_type = "etf"
        else:
            asset_type = "stock"
        
        asset = Asset(
            symbol=symbol,
            name=SYMBOL_NAMES.get(symbol, symbol),
            asset_type=asset_type,
            is_active=True
        )
        session.add(asset)
        session.flush()  # Get the ID
        
        # Create metadata record
        metadata = AssetMetadata(
            asset_id=asset.id,
            exchange="NASDAQ",
            currency="USD",
        )
        session.add(metadata)
        logger.info(f"Created asset record for {symbol}")
    
    return asset


def parse_timestamp(ts_str: str) -> datetime:
    """Parse ISO timestamp from CSV."""
    # Format: 2018-05-01T00:00:00.000000000Z
    # Remove nanoseconds and Z, parse as datetime
    ts_clean = ts_str.replace("Z", "").split(".")[0]
    return datetime.strptime(ts_clean, "%Y-%m-%dT%H:%M:%S")


def import_daily_data(csv_path: Path, batch_size: int = 1000) -> Dict[str, int]:
    """
    Import daily OHLC data from CSV file.
    
    Returns:
        Dict with import statistics
    """
    stats = {"inserted": 0, "updated": 0, "skipped": 0, "errors": 0}
    
    if not csv_path.exists():
        logger.error(f"Daily CSV file not found: {csv_path}")
        return stats
    
    logger.info(f"Importing daily data from: {csv_path}")
    
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    total_rows = len(rows)
    logger.info(f"Total rows to process: {total_rows}")
    
    # Group by symbol for efficient processing
    symbol_data: Dict[str, List[dict]] = {}
    for row in rows:
        symbol = row["symbol"].strip()
        if symbol not in symbol_data:
            symbol_data[symbol] = []
        symbol_data[symbol].append(row)
    
    logger.info(f"Unique symbols: {len(symbol_data)}")
    
    with session_scope() as session:
        for symbol, data_rows in symbol_data.items():
            asset = get_or_create_asset(session, symbol)
            
            batch = []
            for row in data_rows:
                try:
                    ts = parse_timestamp(row["ts_event"])
                    price_date = ts.date()
                    
                    # Check if already exists
                    existing = session.query(DailyPrice).filter(
                        DailyPrice.symbol == symbol,
                        DailyPrice.date == price_date
                    ).first()
                    
                    if existing:
                        # Update existing record
                        existing.open = float(row["open"])
                        existing.high = float(row["high"])
                        existing.low = float(row["low"])
                        existing.close = float(row["close"])
                        existing.volume = int(row["volume"]) if row["volume"] else None
                        stats["updated"] += 1
                    else:
                        # Create new record
                        price = DailyPrice(
                            asset_id=asset.id,
                            symbol=symbol,
                            date=price_date,
                            open=float(row["open"]),
                            high=float(row["high"]),
                            low=float(row["low"]),
                            close=float(row["close"]),
                            volume=int(row["volume"]) if row["volume"] else None,
                        )
                        session.add(price)
                        stats["inserted"] += 1
                    
                except Exception as e:
                    logger.error(f"Error processing row for {symbol}: {e}")
                    stats["errors"] += 1
                    continue
            
            # Commit after each symbol
            session.commit()
            logger.info(f"  {symbol}: processed {len(data_rows)} records")
        
        # Update metadata for all assets
        for symbol in symbol_data.keys():
            asset = session.query(Asset).filter(Asset.symbol == symbol).first()
            if asset and asset.metadata_info:
                # Get date range
                first = session.query(DailyPrice).filter(
                    DailyPrice.asset_id == asset.id
                ).order_by(DailyPrice.date.asc()).first()
                
                last = session.query(DailyPrice).filter(
                    DailyPrice.asset_id == asset.id
                ).order_by(DailyPrice.date.desc()).first()
                
                count = session.query(DailyPrice).filter(
                    DailyPrice.asset_id == asset.id
                ).count()
                
                if first and last:
                    asset.metadata_info.first_price_date = first.date
                    asset.metadata_info.last_price_date = last.date
                    asset.metadata_info.total_records = count
                    asset.metadata_info.last_fetched_at = datetime.utcnow()
        
        session.commit()
    
    return stats


def import_hourly_data(csv_path: Path, batch_size: int = 5000) -> Dict[str, int]:
    """
    Import hourly OHLC data from CSV file.
    
    Returns:
        Dict with import statistics
    """
    stats = {"inserted": 0, "updated": 0, "skipped": 0, "errors": 0}
    
    if not csv_path.exists():
        logger.error(f"Hourly CSV file not found: {csv_path}")
        return stats
    
    logger.info(f"Importing hourly data from: {csv_path}")
    
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    total_rows = len(rows)
    logger.info(f"Total rows to process: {total_rows}")
    
    # Group by symbol for efficient processing
    symbol_data: Dict[str, List[dict]] = {}
    for row in rows:
        symbol = row["symbol"].strip()
        if symbol not in symbol_data:
            symbol_data[symbol] = []
        symbol_data[symbol].append(row)
    
    logger.info(f"Unique symbols: {len(symbol_data)}")
    
    with session_scope() as session:
        for symbol, data_rows in symbol_data.items():
            asset = get_or_create_asset(session, symbol)
            
            processed = 0
            for row in data_rows:
                try:
                    dt = parse_timestamp(row["ts_event"])
                    
                    # Check if already exists
                    existing = session.query(HourlyPrice).filter(
                        HourlyPrice.symbol == symbol,
                        HourlyPrice.datetime == dt
                    ).first()
                    
                    if existing:
                        # Update existing record
                        existing.open = float(row["open"])
                        existing.high = float(row["high"])
                        existing.low = float(row["low"])
                        existing.close = float(row["close"])
                        existing.volume = int(row["volume"]) if row["volume"] else None
                        stats["updated"] += 1
                    else:
                        # Create new record
                        price = HourlyPrice(
                            asset_id=asset.id,
                            symbol=symbol,
                            datetime=dt,
                            open=float(row["open"]),
                            high=float(row["high"]),
                            low=float(row["low"]),
                            close=float(row["close"]),
                            volume=int(row["volume"]) if row["volume"] else None,
                        )
                        session.add(price)
                        stats["inserted"] += 1
                    
                    processed += 1
                    
                    # Commit in batches
                    if processed % batch_size == 0:
                        session.commit()
                        logger.info(f"  {symbol}: {processed}/{len(data_rows)} records...")
                    
                except Exception as e:
                    logger.error(f"Error processing row for {symbol}: {e}")
                    stats["errors"] += 1
                    continue
            
            # Final commit for this symbol
            session.commit()
            logger.info(f"  {symbol}: processed {len(data_rows)} records")
    
    return stats


def print_database_summary():
    """Print summary of data in the database."""
    from database.connection import get_session
    
    session = get_session()
    
    print("\n" + "=" * 70)
    print("DATABASE SUMMARY")
    print("=" * 70)
    
    # Daily prices summary
    print("\nDAILY PRICES:")
    print("-" * 70)
    print(f"{'Symbol':<12} {'Type':<10} {'Records':>10} {'Date Range':<30}")
    print("-" * 70)
    
    assets = session.query(Asset).order_by(Asset.symbol).all()
    total_daily = 0
    for asset in assets:
        daily_count = session.query(DailyPrice).filter(
            DailyPrice.asset_id == asset.id
        ).count()
        
        if daily_count > 0:
            first = session.query(DailyPrice).filter(
                DailyPrice.asset_id == asset.id
            ).order_by(DailyPrice.date.asc()).first()
            
            last = session.query(DailyPrice).filter(
                DailyPrice.asset_id == asset.id
            ).order_by(DailyPrice.date.desc()).first()
            
            date_range = f"{first.date} to {last.date}" if first and last else "N/A"
            print(f"{asset.symbol:<12} {asset.asset_type:<10} {daily_count:>10} {date_range:<30}")
            total_daily += daily_count
    
    print("-" * 70)
    print(f"{'TOTAL':<22} {total_daily:>10}")
    
    # Hourly prices summary
    print("\nHOURLY PRICES:")
    print("-" * 70)
    print(f"{'Symbol':<12} {'Type':<10} {'Records':>10} {'Date Range':<30}")
    print("-" * 70)
    
    total_hourly = 0
    for asset in assets:
        hourly_count = session.query(HourlyPrice).filter(
            HourlyPrice.asset_id == asset.id
        ).count()
        
        if hourly_count > 0:
            first = session.query(HourlyPrice).filter(
                HourlyPrice.asset_id == asset.id
            ).order_by(HourlyPrice.datetime.asc()).first()
            
            last = session.query(HourlyPrice).filter(
                HourlyPrice.asset_id == asset.id
            ).order_by(HourlyPrice.datetime.desc()).first()
            
            date_range = f"{first.datetime.date()} to {last.datetime.date()}" if first and last else "N/A"
            print(f"{asset.symbol:<12} {asset.asset_type:<10} {hourly_count:>10} {date_range:<30}")
            total_hourly += hourly_count
    
    print("-" * 70)
    print(f"{'TOTAL':<22} {total_hourly:>10}")
    print("=" * 70)
    
    session.close()


def main():
    """Main entry point for the import script."""
    logger.info("=" * 60)
    logger.info("STOCK DATA IMPORT PIPELINE")
    logger.info("=" * 60)
    
    # Initialize database (create tables if needed)
    init_db()
    
    # Import daily data
    logger.info("\n" + "=" * 40)
    logger.info("IMPORTING DAILY OHLC DATA")
    logger.info("=" * 40)
    daily_stats = import_daily_data(DAILY_CSV)
    logger.info(f"Daily import complete: {daily_stats}")
    
    # Import hourly data
    logger.info("\n" + "=" * 40)
    logger.info("IMPORTING HOURLY OHLC DATA")
    logger.info("=" * 40)
    hourly_stats = import_hourly_data(HOURLY_CSV)
    logger.info(f"Hourly import complete: {hourly_stats}")
    
    # Print summary
    print_database_summary()
    
    logger.info("\nImport complete!")


if __name__ == "__main__":
    main()
