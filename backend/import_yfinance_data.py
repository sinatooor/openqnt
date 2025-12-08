"""
Import historical data from yfinance for forex and commodities.
Downloads 700 days of daily OHLCV data.
"""

import sys
import logging
from pathlib import Path
from datetime import datetime, timedelta

import yfinance as yf
import pandas as pd

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from database.connection import init_db, session_scope
from database.models import Asset, AssetMetadata, DailyPrice

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ============================================================================
# SYMBOLS TO DOWNLOAD
# ============================================================================

# Major Forex Pairs (yfinance format: XXXYYY=X)
FOREX_SYMBOLS = {
    "EURUSD=X": {"name": "EUR/USD", "description": "Euro to US Dollar"},
    "GBPUSD=X": {"name": "GBP/USD", "description": "British Pound to US Dollar"},
    "USDJPY=X": {"name": "USD/JPY", "description": "US Dollar to Japanese Yen"},
    "AUDUSD=X": {"name": "AUD/USD", "description": "Australian Dollar to US Dollar"},
    "USDCAD=X": {"name": "USD/CAD", "description": "US Dollar to Canadian Dollar"},
    "USDCHF=X": {"name": "USD/CHF", "description": "US Dollar to Swiss Franc"},
    "NZDUSD=X": {"name": "NZD/USD", "description": "New Zealand Dollar to US Dollar"},
    "EURGBP=X": {"name": "EUR/GBP", "description": "Euro to British Pound"},
    "EURJPY=X": {"name": "EUR/JPY", "description": "Euro to Japanese Yen"},
    "GBPJPY=X": {"name": "GBP/JPY", "description": "British Pound to Japanese Yen"},
}

# Major Commodities (yfinance format: XX=F for futures)
COMMODITY_SYMBOLS = {
    "GC=F": {"name": "Gold Futures", "description": "COMEX Gold Futures"},
    "SI=F": {"name": "Silver Futures", "description": "COMEX Silver Futures"},
    "CL=F": {"name": "Crude Oil WTI", "description": "NYMEX WTI Crude Oil Futures"},
    "BZ=F": {"name": "Brent Crude", "description": "ICE Brent Crude Oil Futures"},
    "NG=F": {"name": "Natural Gas", "description": "NYMEX Natural Gas Futures"},
    "HG=F": {"name": "Copper Futures", "description": "COMEX Copper Futures"},
    "PL=F": {"name": "Platinum Futures", "description": "NYMEX Platinum Futures"},
    "PA=F": {"name": "Palladium Futures", "description": "NYMEX Palladium Futures"},
    "ZW=F": {"name": "Wheat Futures", "description": "CBOT Wheat Futures"},
    "ZC=F": {"name": "Corn Futures", "description": "CBOT Corn Futures"},
}

# Major Indices
INDEX_SYMBOLS = {
    "^GSPC": {"name": "S&P 500", "description": "S&P 500 Index"},
    "^DJI": {"name": "Dow Jones", "description": "Dow Jones Industrial Average"},
    "^IXIC": {"name": "NASDAQ", "description": "NASDAQ Composite"},
    "^RUT": {"name": "Russell 2000", "description": "Russell 2000 Index"},
    "^VIX": {"name": "VIX", "description": "CBOE Volatility Index"},
}

# Major Stocks (for completeness)
STOCK_SYMBOLS = {
    "AAPL": {"name": "Apple Inc.", "description": "Apple Inc. Common Stock"},
    "MSFT": {"name": "Microsoft", "description": "Microsoft Corporation"},
    "GOOGL": {"name": "Alphabet", "description": "Alphabet Inc. Class A"},
    "AMZN": {"name": "Amazon", "description": "Amazon.com Inc."},
    "NVDA": {"name": "NVIDIA", "description": "NVIDIA Corporation"},
    "META": {"name": "Meta Platforms", "description": "Meta Platforms Inc."},
    "TSLA": {"name": "Tesla", "description": "Tesla Inc."},
    "JPM": {"name": "JPMorgan Chase", "description": "JPMorgan Chase & Co."},
    "V": {"name": "Visa", "description": "Visa Inc."},
    "XOM": {"name": "Exxon Mobil", "description": "Exxon Mobil Corporation"},
}


def get_asset_type(symbol: str) -> str:
    """Determine asset type from symbol."""
    if symbol in FOREX_SYMBOLS:
        return "forex"
    elif symbol in COMMODITY_SYMBOLS:
        return "commodity"
    elif symbol in INDEX_SYMBOLS:
        return "index"
    else:
        return "stock"


def get_or_create_asset(session, symbol: str, info: dict, asset_type: str) -> Asset:
    """Get existing asset or create new one."""
    asset = session.query(Asset).filter_by(symbol=symbol).first()
    
    if not asset:
        asset = Asset(
            symbol=symbol,
            name=info.get("name", symbol),
            asset_type=asset_type,
            is_active=True
        )
        session.add(asset)
        session.flush()  # Get the ID
        
        # Create metadata
        metadata = AssetMetadata(
            asset_id=asset.id,
            description=info.get("description", ""),
            exchange="YFINANCE",
            currency="USD"
        )
        session.add(metadata)
        logger.info(f"  Created new asset: {symbol} ({info.get('name', symbol)})")
    
    return asset


def download_and_import(symbols_dict: dict, days: int = 700):
    """Download data from yfinance and import to database."""
    
    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    logger.info(f"Downloading {days} days of data from {start_date.date()} to {end_date.date()}")
    logger.info(f"Total symbols to process: {len(symbols_dict)}")
    
    stats = {
        "symbols_processed": 0,
        "records_inserted": 0,
        "records_updated": 0,
        "errors": 0
    }
    
    for symbol, info in symbols_dict.items():
        try:
            logger.info(f"\nProcessing {symbol} ({info.get('name', symbol)})...")
            
            # Download data from yfinance
            ticker = yf.Ticker(symbol)
            df = ticker.history(start=start_date, end=end_date, interval="1d")
            
            if df.empty:
                logger.warning(f"  No data returned for {symbol}")
                stats["errors"] += 1
                continue
            
            logger.info(f"  Downloaded {len(df)} records")
            
            # Determine asset type
            asset_type = get_asset_type(symbol)
            
            with session_scope() as session:
                # Get or create asset
                asset = get_or_create_asset(session, symbol, info, asset_type)
                
                # Import price data
                for date_idx, row in df.iterrows():
                    # Convert timezone-aware datetime to date
                    if hasattr(date_idx, 'date'):
                        price_date = date_idx.date()
                    else:
                        price_date = pd.to_datetime(date_idx).date()
                    
                    # Check for existing record
                    existing = session.query(DailyPrice).filter_by(
                        asset_id=asset.id,
                        date=price_date
                    ).first()
                    
                    if existing:
                        # Update existing record
                        existing.open = float(row['Open']) if pd.notna(row['Open']) else None
                        existing.high = float(row['High']) if pd.notna(row['High']) else None
                        existing.low = float(row['Low']) if pd.notna(row['Low']) else None
                        existing.close = float(row['Close']) if pd.notna(row['Close']) else None
                        existing.volume = int(row['Volume']) if pd.notna(row.get('Volume', 0)) and row.get('Volume', 0) > 0 else None
                        stats["records_updated"] += 1
                    else:
                        # Insert new record
                        price = DailyPrice(
                            asset_id=asset.id,
                            symbol=symbol,
                            date=price_date,
                            open=float(row['Open']) if pd.notna(row['Open']) else 0,
                            high=float(row['High']) if pd.notna(row['High']) else 0,
                            low=float(row['Low']) if pd.notna(row['Low']) else 0,
                            close=float(row['Close']) if pd.notna(row['Close']) else 0,
                            volume=int(row['Volume']) if pd.notna(row.get('Volume', 0)) and row.get('Volume', 0) > 0 else None
                        )
                        session.add(price)
                        stats["records_inserted"] += 1
                
                session.commit()
                stats["symbols_processed"] += 1
                logger.info(f"  ✓ Imported {len(df)} records for {symbol}")
                
        except Exception as e:
            logger.error(f"  ✗ Error processing {symbol}: {e}")
            stats["errors"] += 1
            continue
    
    return stats


def main():
    """Main entry point."""
    logger.info("=" * 70)
    logger.info("YFINANCE DATA IMPORT")
    logger.info("=" * 70)
    
    # Initialize database
    init_db()
    
    # Combine all symbols
    all_symbols = {}
    all_symbols.update(FOREX_SYMBOLS)
    all_symbols.update(COMMODITY_SYMBOLS)
    all_symbols.update(INDEX_SYMBOLS)
    all_symbols.update(STOCK_SYMBOLS)
    
    logger.info(f"\nSymbol Categories:")
    logger.info(f"  Forex pairs: {len(FOREX_SYMBOLS)}")
    logger.info(f"  Commodities: {len(COMMODITY_SYMBOLS)}")
    logger.info(f"  Indices: {len(INDEX_SYMBOLS)}")
    logger.info(f"  Stocks: {len(STOCK_SYMBOLS)}")
    logger.info(f"  Total: {len(all_symbols)}")
    
    # Download and import
    stats = download_and_import(all_symbols, days=700)
    
    # Print summary
    logger.info("\n" + "=" * 70)
    logger.info("IMPORT COMPLETE")
    logger.info("=" * 70)
    logger.info(f"Symbols processed: {stats['symbols_processed']}")
    logger.info(f"Records inserted: {stats['records_inserted']}")
    logger.info(f"Records updated: {stats['records_updated']}")
    logger.info(f"Errors: {stats['errors']}")
    
    # Print database summary
    with session_scope() as session:
        total_assets = session.query(Asset).count()
        total_prices = session.query(DailyPrice).count()
        
        forex_count = session.query(Asset).filter_by(asset_type="forex").count()
        commodity_count = session.query(Asset).filter_by(asset_type="commodity").count()
        index_count = session.query(Asset).filter_by(asset_type="index").count()
        stock_count = session.query(Asset).filter_by(asset_type="stock").count()
        
        logger.info("\n" + "=" * 70)
        logger.info("DATABASE SUMMARY")
        logger.info("=" * 70)
        logger.info(f"Total assets: {total_assets}")
        logger.info(f"  - Forex: {forex_count}")
        logger.info(f"  - Commodities: {commodity_count}")
        logger.info(f"  - Indices: {index_count}")
        logger.info(f"  - Stocks: {stock_count}")
        logger.info(f"Total daily price records: {total_prices}")


if __name__ == "__main__":
    main()
