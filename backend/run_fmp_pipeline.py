#!/usr/bin/env python3
"""
FMP Historical Data Pipeline Runner.

Fetches 10 years of daily historical price data from Financial Modeling Prep API
and stores it in a local SQLite database.

Assets fetched:
- 10 major global stocks (AAPL, MSFT, GOOGL, AMZN, META, TSLA, NVDA, BRK-B, JPM, XOM)
- 5 key commodities (Gold, Silver, WTI Crude, Brent, Natural Gas)
- 10 major forex pairs (EURUSD, USDJPY, GBPUSD, AUDUSD, USDCAD, USDCHF, NZDUSD, EURGBP, EURJPY, GBPJPY)
- 1 equity index (S&P 500)

Usage:
    python run_fmp_pipeline.py

The database will be created at: backend/data/market_data.db
"""
import asyncio
import logging
import sys
import os
from datetime import date, timedelta
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from pipelines.fetcher import FMPDataFetcher
from fmp.client import ALL_SYMBOLS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(Path(__file__).parent / "logs" / "fmp_pipeline.log", mode="a"),
    ]
)
logger = logging.getLogger(__name__)

# FMP API Key
FMP_API_KEY = "A0yYTRGlzMFKjJfOHKpqkqqiazHM4Ieo"

# Date range: Last 10 years
END_DATE = date.today()
START_DATE = END_DATE - timedelta(days=365 * 10)  # ~10 years ago


async def main():
    """Run the FMP data pipeline."""
    logger.info("=" * 60)
    logger.info("FMP HISTORICAL DATA PIPELINE")
    logger.info("=" * 60)
    logger.info(f"Date range: {START_DATE} to {END_DATE}")
    logger.info(f"Total symbols: {len(ALL_SYMBOLS)}")
    logger.info("")
    
    # List all symbols
    logger.info("Symbols to fetch:")
    for i, sym in enumerate(ALL_SYMBOLS, 1):
        logger.info(f"  {i:2}. {sym.symbol:10} ({sym.asset_type.value:10}) - {sym.name}")
    logger.info("")
    
    # Create and run fetcher
    fetcher = FMPDataFetcher(api_key=FMP_API_KEY)
    
    try:
        stats = await fetcher.fetch_and_store(
            from_date=START_DATE,
            to_date=END_DATE,
        )
        
        logger.info("\n" + "=" * 60)
        logger.info("PIPELINE COMPLETE")
        logger.info("=" * 60)
        logger.info(f"Database location: backend/data/market_data.db")
        
        return stats
        
    except KeyboardInterrupt:
        logger.warning("\nPipeline interrupted by user")
        return fetcher.stats
    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        raise


def show_database_summary():
    """Show a summary of data in the database."""
    from database import get_session
    from database.models import Asset, DailyPrice
    
    session = get_session()
    try:
        assets = session.query(Asset).all()
        
        print("\n" + "=" * 60)
        print("DATABASE SUMMARY")
        print("=" * 60)
        print(f"{'Symbol':<10} {'Type':<10} {'Records':<10} {'Date Range'}")
        print("-" * 60)
        
        for asset in assets:
            count = session.query(DailyPrice).filter(DailyPrice.asset_id == asset.id).count()
            
            first = session.query(DailyPrice).filter(
                DailyPrice.asset_id == asset.id
            ).order_by(DailyPrice.date.asc()).first()
            
            last = session.query(DailyPrice).filter(
                DailyPrice.asset_id == asset.id
            ).order_by(DailyPrice.date.desc()).first()
            
            date_range = f"{first.date} to {last.date}" if first and last else "N/A"
            print(f"{asset.symbol:<10} {asset.asset_type:<10} {count:<10} {date_range}")
        
        total = session.query(DailyPrice).count()
        print("-" * 60)
        print(f"Total records: {total:,}")
        
    finally:
        session.close()


if __name__ == "__main__":
    # Ensure logs directory exists
    (Path(__file__).parent / "logs").mkdir(exist_ok=True)
    
    # Run the pipeline
    asyncio.run(main())
    
    # Show summary
    show_database_summary()
