#!/usr/bin/env python3
"""
Commodities & Crypto Data Fetcher - Download from yfinance and save to local database.

Usage:
    python fetch_commodities_crypto.py

This script fetches 700 days of daily candle data for:
- Commodities (Gold, Silver, Oil, etc.)
- Cryptocurrencies (Bitcoin, Ethereum, etc.)
- Indices (VIX, Dollar Index, etc.)
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
import yfinance as yf
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from database.connection import session_scope, init_db
from database.models import Asset, AssetMetadata, DailyPrice


# Commodities, Crypto, and other important non-stock tickers
TICKERS = {
    # Precious Metals (4)
    "GC=F": {"name": "Gold Futures", "type": "commodity"},
    "SI=F": {"name": "Silver Futures", "type": "commodity"},
    "PL=F": {"name": "Platinum Futures", "type": "commodity"},
    "PA=F": {"name": "Palladium Futures", "type": "commodity"},
    
    # Energy (4)
    "CL=F": {"name": "Crude Oil WTI Futures", "type": "commodity"},
    "BZ=F": {"name": "Brent Crude Oil Futures", "type": "commodity"},
    "NG=F": {"name": "Natural Gas Futures", "type": "commodity"},
    "HO=F": {"name": "Heating Oil Futures", "type": "commodity"},
    
    # Agriculture (4)
    "ZC=F": {"name": "Corn Futures", "type": "commodity"},
    "ZW=F": {"name": "Wheat Futures", "type": "commodity"},
    "ZS=F": {"name": "Soybean Futures", "type": "commodity"},
    "KC=F": {"name": "Coffee Futures", "type": "commodity"},
    
    # Crypto (8)
    "BTC-USD": {"name": "Bitcoin USD", "type": "crypto"},
    "ETH-USD": {"name": "Ethereum USD", "type": "crypto"},
    "BNB-USD": {"name": "Binance Coin USD", "type": "crypto"},
    "XRP-USD": {"name": "Ripple USD", "type": "crypto"},
    "SOL-USD": {"name": "Solana USD", "type": "crypto"},
    "ADA-USD": {"name": "Cardano USD", "type": "crypto"},
    "DOGE-USD": {"name": "Dogecoin USD", "type": "crypto"},
    "DOT-USD": {"name": "Polkadot USD", "type": "crypto"},
    
    # Market Indices (4)
    "^VIX": {"name": "CBOE Volatility Index", "type": "index"},
    "DX-Y.NYB": {"name": "US Dollar Index", "type": "index"},
    "^TNX": {"name": "10-Year Treasury Yield", "type": "index"},
    "^GSPC": {"name": "S&P 500 Index", "type": "index"},
}

DAYS_BACK = 700


def get_or_create_asset(session, symbol: str, info: dict) -> Asset:
    """Get existing asset or create new one."""
    asset = session.execute(
        select(Asset).where(Asset.symbol == symbol)
    ).scalar_one_or_none()
    
    if not asset:
        print(f"  Creating new asset: {symbol}")
        asset = Asset(
            symbol=symbol,
            name=info["name"],
            asset_type=info["type"],
            is_active=True
        )
        session.add(asset)
        session.flush()
        
        # Create metadata
        metadata = AssetMetadata(
            asset_id=asset.id,
            exchange="YFINANCE",
            currency="USD",
        )
        session.add(metadata)
        session.flush()
    
    return asset


def fetch_and_save_data(symbol: str, info: dict, days_back: int = DAYS_BACK):
    """Fetch data from yfinance and save to database."""
    print(f"\n{'='*60}")
    print(f"Fetching {symbol} ({info['name']})")
    print(f"Type: {info['type']}")
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
            auto_adjust=False
        )
        
        if df.empty:
            print(f"  ⚠️  No data available for {symbol}")
            return False
        
        print(f"  ✓ Downloaded {len(df)} candles")
        
        # Save to database
        with session_scope() as session:
            # Get or create asset
            asset = get_or_create_asset(session, symbol, info)
            
            # Prepare records for upsert
            records_inserted = 0
            
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
                
                # Upsert
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
                records_inserted += 1
            
            # Update metadata
            metadata = session.execute(
                select(AssetMetadata).where(AssetMetadata.asset_id == asset.id)
            ).scalar_one_or_none()
            
            if metadata:
                metadata.first_price_date = df.index.min().date()
                metadata.last_price_date = df.index.max().date()
                metadata.total_records = len(df)
                metadata.last_fetched_at = datetime.now(timezone.utc)
            
            session.commit()
            print(f"  ✓ Saved {records_inserted} records to database")
            
        return True
    
    except Exception as e:
        print(f"  ❌ Error fetching {symbol}: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main function to fetch all tickers."""
    print("\n" + "="*70)
    print("COMMODITIES & CRYPTO DATA FETCHER")
    print("="*70)
    print(f"Fetching {len(TICKERS)} tickers")
    print(f"Historical data: {DAYS_BACK} days back")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Initialize database
    print("\nInitializing database...")
    init_db()
    
    # Group tickers by type
    by_type = {}
    for symbol, info in TICKERS.items():
        asset_type = info["type"]
        if asset_type not in by_type:
            by_type[asset_type] = []
        by_type[asset_type].append((symbol, info))
    
    print("\nTickers by type:")
    for asset_type, items in by_type.items():
        print(f"  {asset_type}: {len(items)}")
    
    # Fetch each ticker
    total_success = 0
    total_failed = 0
    
    for symbol, info in TICKERS.items():
        if fetch_and_save_data(symbol, info, DAYS_BACK):
            total_success += 1
        else:
            total_failed += 1
    
    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"Total tickers processed: {len(TICKERS)}")
    print(f"✓ Successful: {total_success}")
    print(f"✗ Failed: {total_failed}")
    print(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70 + "\n")


if __name__ == "__main__":
    main()
