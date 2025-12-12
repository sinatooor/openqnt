#!/usr/bin/env python3
"""
Forex Data Fetcher - Download forex pairs from yfinance and save to local database.

Usage:
    python fetch_forex_data.py

This script:
- Fetches 700 days of daily candle data for 15 major forex pairs
- Saves data to the local SQLite database
- Updates existing data if already present (upsert behavior)
- Can be run repeatedly to keep data fresh
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta
import yfinance as yf
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from database.connection import session_scope, init_db
from database.models import Asset, AssetMetadata, DailyPrice


# 15 Most Important Forex Pairs
FOREX_PAIRS = [
    # Major Pairs (7)
    "EURUSD=X",  # Euro / US Dollar
    "USDJPY=X",  # US Dollar / Japanese Yen
    "GBPUSD=X",  # British Pound / US Dollar
    "USDCHF=X",  # US Dollar / Swiss Franc
    "AUDUSD=X",  # Australian Dollar / US Dollar
    "USDCAD=X",  # US Dollar / Canadian Dollar
    "NZDUSD=X",  # New Zealand Dollar / US Dollar
    
    # Major Cross Pairs (5)
    "EURGBP=X",  # Euro / British Pound
    "EURJPY=X",  # Euro / Japanese Yen
    "GBPJPY=X",  # British Pound / Japanese Yen
    "EURCHF=X",  # Euro / Swiss Franc
    "AUDJPY=X",  # Australian Dollar / Japanese Yen
    
    # Emerging Market Pairs (3)
    "USDCNH=X",  # US Dollar / Chinese Yuan
    "USDZAR=X",  # US Dollar / South African Rand
    "USDMXN=X",  # US Dollar / Mexican Peso
]

FOREX_NAMES = {
    "EURUSD=X": "Euro / US Dollar",
    "USDJPY=X": "US Dollar / Japanese Yen",
    "GBPUSD=X": "British Pound / US Dollar",
    "USDCHF=X": "US Dollar / Swiss Franc",
    "AUDUSD=X": "Australian Dollar / US Dollar",
    "USDCAD=X": "US Dollar / Canadian Dollar",
    "NZDUSD=X": "New Zealand Dollar / US Dollar",
    "EURGBP=X": "Euro / British Pound",
    "EURJPY=X": "Euro / Japanese Yen",
    "GBPJPY=X": "British Pound / Japanese Yen",
    "EURCHF=X": "Euro / Swiss Franc",
    "AUDJPY=X": "Australian Dollar / Japanese Yen",
    "USDCNH=X": "US Dollar / Chinese Yuan",
    "USDZAR=X": "US Dollar / South African Rand",
    "USDMXN=X": "US Dollar / Mexican Peso",
}

DAYS_BACK = 700


def get_or_create_asset(session, symbol: str) -> Asset:
    """Get existing asset or create new one."""
    asset = session.execute(
        select(Asset).where(Asset.symbol == symbol)
    ).scalar_one_or_none()
    
    if not asset:
        print(f"  Creating new asset: {symbol}")
        asset = Asset(
            symbol=symbol,
            name=FOREX_NAMES.get(symbol, symbol),
            asset_type="forex",
            is_active=True
        )
        session.add(asset)
        session.flush()  # Get the ID
        
        # Create metadata
        metadata = AssetMetadata(
            asset_id=asset.id,
            exchange="FOREX",
            currency="USD",
        )
        session.add(metadata)
        session.flush()
    
    return asset


def fetch_and_save_forex_data(symbol: str, days_back: int = DAYS_BACK):
    """Fetch forex data from yfinance and save to database."""
    print(f"\n{'='*60}")
    print(f"Fetching {symbol} ({FOREX_NAMES.get(symbol, symbol)})")
    print(f"{'='*60}")
    
    try:
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        
        print(f"  Date range: {start_date.date()} to {end_date.date()}")
        
        # Download data from yfinance
        ticker = yf.Ticker(symbol)
        df = ticker.history(
            start=start_date,
            end=end_date,
            interval="1d",
            auto_adjust=False  # Keep raw OHLC data
        )
        
        if df.empty:
            print(f"  ⚠️  No data available for {symbol}")
            return
        
        print(f"  ✓ Downloaded {len(df)} candles")
        
        # Save to database
        with session_scope() as session:
            # Get or create asset
            asset = get_or_create_asset(session, symbol)
            
            # Prepare records for upsert
            records_inserted = 0
            records_updated = 0
            
            for date, row in df.iterrows():
                # Convert date
                if hasattr(date, 'date'):
                    date_value = date.date()
                else:
                    date_value = date
                
                # Prepare data
                price_data = {
                    'asset_id': asset.id,
                    'symbol': symbol,
                    'date': date_value,
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'volume': int(row['Volume']) if row['Volume'] > 0 else None,
                }
                
                # Upsert (insert or update if exists)
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
                
                result = session.execute(stmt)
                
                # Track if inserted or updated
                if result.rowcount > 0:
                    records_inserted += 1
                else:
                    records_updated += 1
            
            # Update metadata
            metadata = session.execute(
                select(AssetMetadata).where(AssetMetadata.asset_id == asset.id)
            ).scalar_one_or_none()
            
            if metadata:
                metadata.first_price_date = df.index.min().date()
                metadata.last_price_date = df.index.max().date()
                metadata.total_records = len(df)
                metadata.last_fetched_at = datetime.utcnow()
            
            session.commit()
            print(f"  ✓ Saved to database:")
            print(f"    - New records: {records_inserted}")
            print(f"    - Updated records: {records_updated}")
            print(f"    - Total: {len(df)}")
    
    except Exception as e:
        print(f"  ❌ Error fetching {symbol}: {e}")
        import traceback
        traceback.print_exc()


def main():
    """Main function to fetch all forex pairs."""
    print("\n" + "="*70)
    print("FOREX DATA FETCHER - yfinance to Local Database")
    print("="*70)
    print(f"Fetching {len(FOREX_PAIRS)} forex pairs")
    print(f"Historical data: {DAYS_BACK} days back")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Initialize database
    print("\nInitializing database...")
    init_db()
    
    # Fetch each forex pair
    total_success = 0
    total_failed = 0
    
    for symbol in FOREX_PAIRS:
        try:
            fetch_and_save_forex_data(symbol, DAYS_BACK)
            total_success += 1
        except Exception as e:
            print(f"❌ Failed to process {symbol}: {e}")
            total_failed += 1
    
    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"Total pairs processed: {len(FOREX_PAIRS)}")
    print(f"✓ Successful: {total_success}")
    print(f"✗ Failed: {total_failed}")
    print(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70 + "\n")


if __name__ == "__main__":
    main()
