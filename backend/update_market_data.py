#!/usr/bin/env python3
"""
Smart Data Updater - Check database and fetch missing/outdated data from yfinance.

Usage:
    python update_market_data.py              # Update all symbols
    python update_market_data.py --symbol AAPL  # Update specific symbol
    python update_market_data.py --force       # Force full refresh

This script:
- Checks all existing symbols in database
- Determines what data is missing or outdated
- Fetches from yfinance for all timeframes:
  - 1min: Last 7 days (yfinance limit)
  - 1hour: Last 730 days (yfinance limit) 
  - 1day: Max available (~20 years)
  - 1week: Max available

  examples:
# Update all symbols (daily + hourly)
python update_market_data.py
# Full refresh (force re-download all)
python update_market_data.py --force
# Update specific symbol only
python update_market_data.py -s AAPL
# Include all timeframes (1m, 1h, 1d, 1wk)
python update_market_data.py -i 1m 1h 1d 1wk
# Just daily data
python update_market_data.py -i 1d

Run this daily to keep your data fresh!
"""
import sys
import argparse
from pathlib import Path
from datetime import datetime, timedelta, timezone, date
from typing import List, Dict, Optional, Tuple
import yfinance as yf
import pandas as pd
from sqlalchemy import select, func
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from database.connection import session_scope, init_db, get_session
from database.models import Asset, AssetMetadata, DailyPrice, HourlyPrice

# yfinance interval limits (max history available)
INTERVAL_LIMITS = {
    "1m": 7,       # 7 days max
    "1h": 730,     # ~2 years max
    "1d": 7300,    # ~20 years
    "1wk": 7300,   # ~20 years
}

# Map our intervals to yfinance intervals
YF_INTERVAL_MAP = {
    "1m": "1m",
    "1h": "1h", 
    "1d": "1d",
    "1wk": "1wk",
}


def get_all_symbols() -> List[Dict]:
    """Get all symbols from database with their metadata."""
    with session_scope() as session:
        assets = session.execute(
            select(Asset, AssetMetadata)
            .outerjoin(AssetMetadata, Asset.id == AssetMetadata.asset_id)
            .where(Asset.is_active == True)
        ).all()
        
        result = []
        for asset, metadata in assets:
            result.append({
                "id": asset.id,
                "symbol": asset.symbol,
                "name": asset.name,
                "asset_type": asset.asset_type,
                "last_price_date": metadata.last_price_date if metadata else None,
                "total_records": metadata.total_records if metadata else 0,
            })
        
        return result


def get_last_date_for_symbol(symbol: str, interval: str) -> Optional[date]:
    """Get the last date we have data for a symbol and interval."""
    with session_scope() as session:
        if interval in ["1m", "1h"]:
            # Use HourlyPrice table (we'll store minute data here too for simplicity)
            result = session.execute(
                select(func.max(HourlyPrice.datetime))
                .where(HourlyPrice.symbol == symbol)
            ).scalar()
            return result.date() if result else None
        else:
            # Use DailyPrice table
            result = session.execute(
                select(func.max(DailyPrice.date))
                .where(DailyPrice.symbol == symbol)
            ).scalar()
            return result


def is_market_day(d: date) -> bool:
    """Check if a date is a market day (weekday)."""
    return d.weekday() < 5  # Monday = 0, Friday = 4


def get_last_market_day() -> date:
    """Get the last market day (today if weekday, last Friday if weekend)."""
    today = date.today()
    if today.weekday() == 5:  # Saturday
        return today - timedelta(days=1)
    elif today.weekday() == 6:  # Sunday
        return today - timedelta(days=2)
    return today


def needs_update(last_date: Optional[date], interval: str) -> Tuple[bool, str]:
    """
    Check if data needs updating.
    Returns (needs_update, reason).
    """
    if last_date is None:
        return True, "No data exists"
    
    last_market_day = get_last_market_day()
    
    if interval in ["1m", "1h"]:
        # For intraday, we need today's data if market is open
        # Otherwise yesterday's is fine
        if last_date < last_market_day - timedelta(days=1):
            return True, f"Last data: {last_date}, need at least {last_market_day - timedelta(days=1)}"
    else:
        # For daily/weekly, we want yesterday's or today's close
        if last_date < last_market_day - timedelta(days=1):
            return True, f"Last data: {last_date}, need at least {last_market_day - timedelta(days=1)}"
    
    return False, f"Up to date (last: {last_date})"


def fetch_yfinance_data(symbol: str, interval: str, start_date: Optional[date] = None) -> Optional[pd.DataFrame]:
    """
    Fetch data from yfinance for a symbol and interval.
    """
    try:
        ticker = yf.Ticker(symbol)
        
        # Calculate period/start based on interval limits
        max_days = INTERVAL_LIMITS.get(interval, 365)
        
        if start_date:
            # Fetch from start_date to now
            end_date = datetime.now()
            df = ticker.history(
                start=start_date,
                end=end_date,
                interval=YF_INTERVAL_MAP[interval],
                auto_adjust=False
            )
        else:
            # Fetch max available
            period = "max" if interval in ["1d", "1wk"] else f"{max_days}d"
            df = ticker.history(
                period=period,
                interval=YF_INTERVAL_MAP[interval],
                auto_adjust=False
            )
        
        if df.empty:
            return None
            
        return df
        
    except Exception as e:
        print(f"    Error fetching {symbol} ({interval}): {e}")
        return None


def save_daily_data(symbol: str, asset_id: int, df: pd.DataFrame):
    """Save daily/weekly OHLCV data to database."""
    with session_scope() as session:
        count = 0
        for idx, row in df.iterrows():
            date_value = idx.date() if hasattr(idx, 'date') else idx
            
            price_data = {
                'asset_id': asset_id,
                'symbol': symbol,
                'date': date_value,
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'volume': int(row['Volume']) if row['Volume'] > 0 else None,
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
            count += 1
        
        # Update metadata
        metadata = session.execute(
            select(AssetMetadata).where(AssetMetadata.asset_id == asset_id)
        ).scalar_one_or_none()
        
        if metadata:
            if df.index.min():
                first_date = df.index.min()
                if hasattr(first_date, 'date'):
                    first_date = first_date.date()
                if metadata.first_price_date is None or first_date < metadata.first_price_date:
                    metadata.first_price_date = first_date
            
            if df.index.max():
                last_date = df.index.max()
                if hasattr(last_date, 'date'):
                    last_date = last_date.date()
                metadata.last_price_date = last_date
            
            metadata.total_records = count
            metadata.last_fetched_at = datetime.now(timezone.utc)
        
        session.commit()
        return count


def save_hourly_data(symbol: str, asset_id: int, df: pd.DataFrame):
    """Save hourly/minute OHLCV data to database."""
    with session_scope() as session:
        count = 0
        for idx, row in df.iterrows():
            datetime_value = idx.to_pydatetime() if hasattr(idx, 'to_pydatetime') else idx
            
            # Make timezone aware if not already
            if datetime_value.tzinfo is None:
                datetime_value = datetime_value.replace(tzinfo=timezone.utc)
            
            price_data = {
                'asset_id': asset_id,
                'symbol': symbol,
                'datetime': datetime_value,
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'volume': int(row['Volume']) if row['Volume'] > 0 else None,
            }
            
            stmt = sqlite_insert(HourlyPrice).values(**price_data)
            stmt = stmt.on_conflict_do_update(
                index_elements=['symbol', 'datetime'],
                set_={
                    'open': stmt.excluded.open,
                    'high': stmt.excluded.high,
                    'low': stmt.excluded.low,
                    'close': stmt.excluded.close,
                    'volume': stmt.excluded.volume,
                }
            )
            session.execute(stmt)
            count += 1
        
        session.commit()
        return count


def update_symbol(symbol: str, asset_id: int, intervals: List[str], force: bool = False):
    """Update data for a single symbol across all intervals."""
    print(f"\n{'='*60}")
    print(f"Updating: {symbol}")
    print(f"{'='*60}")
    
    for interval in intervals:
        print(f"\n  [{interval.upper()}] ", end="")
        
        # Check if update needed
        last_date = get_last_date_for_symbol(symbol, interval)
        needs, reason = needs_update(last_date, interval)
        
        if not force and not needs:
            print(f"✓ {reason}")
            continue
        
        print(f"⟳ {reason}")
        
        # Determine start date for incremental update
        start_date = None
        if last_date and not force:
            # Start from day after last date
            start_date = last_date + timedelta(days=1)
            print(f"    Fetching from {start_date}...")
        else:
            print(f"    Fetching full history (max {INTERVAL_LIMITS.get(interval, 'N/A')} days)...")
        
        # Fetch data
        df = fetch_yfinance_data(symbol, interval, start_date)
        
        if df is None or df.empty:
            print(f"    ⚠ No new data available")
            continue
        
        # Save data
        if interval in ["1m", "1h"]:
            count = save_hourly_data(symbol, asset_id, df)
        else:
            count = save_daily_data(symbol, asset_id, df)
        
        print(f"    ✓ Saved {count} candles")


def main():
    parser = argparse.ArgumentParser(description="Update market data from yfinance")
    parser.add_argument("--symbol", "-s", help="Update specific symbol only")
    parser.add_argument("--force", "-f", action="store_true", help="Force full refresh")
    parser.add_argument("--intervals", "-i", nargs="+", 
                       default=["1d", "1h"], 
                       choices=["1m", "1h", "1d", "1wk"],
                       help="Intervals to update (default: 1d, 1h)")
    args = parser.parse_args()
    
    print("\n" + "="*70)
    print("SMART MARKET DATA UPDATER")
    print("="*70)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Mode: {'Force refresh' if args.force else 'Incremental update'}")
    print(f"Intervals: {', '.join(args.intervals)}")
    
    # Initialize database
    print("\nInitializing database...")
    init_db()
    
    # Get symbols to update
    symbols = get_all_symbols()
    
    if args.symbol:
        # Filter to specific symbol
        symbols = [s for s in symbols if s["symbol"] == args.symbol]
        if not symbols:
            print(f"\n❌ Symbol '{args.symbol}' not found in database!")
            print("Available symbols:")
            all_symbols = get_all_symbols()
            for s in all_symbols[:20]:
                print(f"  - {s['symbol']}")
            if len(all_symbols) > 20:
                print(f"  ... and {len(all_symbols) - 20} more")
            return
    
    print(f"\nSymbols to update: {len(symbols)}")
    
    # Update each symbol
    success = 0
    failed = 0
    
    for sym in symbols:
        try:
            update_symbol(
                symbol=sym["symbol"],
                asset_id=sym["id"],
                intervals=args.intervals,
                force=args.force
            )
            success += 1
        except Exception as e:
            print(f"\n❌ Error updating {sym['symbol']}: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"Symbols processed: {len(symbols)}")
    print(f"✓ Successful: {success}")
    print(f"✗ Failed: {failed}")
    print(f"Intervals updated: {', '.join(args.intervals)}")
    print(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    # Tips
    print("\n💡 Tips:")
    print("  - Run daily:     python update_market_data.py")
    print("  - Full refresh:  python update_market_data.py --force")
    print("  - One symbol:    python update_market_data.py -s AAPL")
    print("  - With 1-min:    python update_market_data.py -i 1m 1h 1d")
    print("")


if __name__ == "__main__":
    main()
