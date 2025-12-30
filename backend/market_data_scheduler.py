"""
Market Data Scheduler - Automated data fetching for the trading platform.

Features:
- Runs on backend startup (initial fetch)
- Refreshes every 5 minutes (incremental updates only)
- Maintains only curated symbols (~40 symbols max)
- Cleans up unwanted symbols from database

Usage:
    # Import at backend startup to auto-start
    from market_data_scheduler import start_scheduler

    # Or run directly
    python market_data_scheduler.py
"""

import sys
import logging
import threading
import time
from pathlib import Path
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    import yfinance as yf
    import pandas as pd
    from sqlalchemy import select, func, delete
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    from database.connection import session_scope, init_db
    from database.models import Asset, AssetMetadata, DailyPrice, HourlyPrice
    DEPS_AVAILABLE = True
except ImportError as e:
    DEPS_AVAILABLE = False
    print(f"Warning: Market data scheduler dependencies not available: {e}")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("market_data")

# ============================================================================
# CURATED SYMBOL LIST - Only these symbols will be maintained
# ============================================================================

CURATED_SYMBOLS: Dict[str, Dict] = {
    # ========== FOREX (6 pairs) ==========
    "EURUSD=X": {"name": "EUR/USD", "type": "forex", "display": "EUR/USD"},
    "GBPUSD=X": {"name": "GBP/USD", "type": "forex", "display": "GBP/USD"},
    "USDJPY=X": {"name": "USD/JPY", "type": "forex", "display": "USD/JPY"},
    "AUDUSD=X": {"name": "AUD/USD", "type": "forex", "display": "AUD/USD"},
    "USDCAD=X": {"name": "USD/CAD", "type": "forex", "display": "USD/CAD"},
    "USDCHF=X": {"name": "USD/CHF", "type": "forex", "display": "USD/CHF"},
    
    # ========== US STOCKS (20 major) ==========
    "AAPL": {"name": "Apple Inc.", "type": "stock", "display": "Apple (AAPL)"},
    "MSFT": {"name": "Microsoft", "type": "stock", "display": "Microsoft (MSFT)"},
    "GOOGL": {"name": "Alphabet", "type": "stock", "display": "Google (GOOGL)"},
    "AMZN": {"name": "Amazon", "type": "stock", "display": "Amazon (AMZN)"},
    "TSLA": {"name": "Tesla", "type": "stock", "display": "Tesla (TSLA)"},
    "NVDA": {"name": "NVIDIA", "type": "stock", "display": "NVIDIA (NVDA)"},
    "META": {"name": "Meta Platforms", "type": "stock", "display": "Meta (META)"},
    "JPM": {"name": "JPMorgan Chase", "type": "stock", "display": "JPMorgan (JPM)"},
    "V": {"name": "Visa Inc.", "type": "stock", "display": "Visa (V)"},
    "XOM": {"name": "Exxon Mobil", "type": "stock", "display": "Exxon (XOM)"},
    "JNJ": {"name": "Johnson & Johnson", "type": "stock", "display": "J&J (JNJ)"},
    "WMT": {"name": "Walmart", "type": "stock", "display": "Walmart (WMT)"},
    "PG": {"name": "Procter & Gamble", "type": "stock", "display": "P&G (PG)"},
    "MA": {"name": "Mastercard", "type": "stock", "display": "Mastercard (MA)"},
    "HD": {"name": "Home Depot", "type": "stock", "display": "Home Depot (HD)"},
    "BAC": {"name": "Bank of America", "type": "stock", "display": "BofA (BAC)"},
    "DIS": {"name": "Walt Disney", "type": "stock", "display": "Disney (DIS)"},
    "NFLX": {"name": "Netflix", "type": "stock", "display": "Netflix (NFLX)"},
    "AMD": {"name": "AMD", "type": "stock", "display": "AMD"},
    "INTC": {"name": "Intel", "type": "stock", "display": "Intel (INTC)"},
    
    # ========== INDICES (5) ==========
    "^GSPC": {"name": "S&P 500", "type": "index", "display": "S&P 500"},
    "^DJI": {"name": "Dow Jones", "type": "index", "display": "Dow Jones"},
    "^IXIC": {"name": "NASDAQ", "type": "index", "display": "NASDAQ"},
    "^RUT": {"name": "Russell 2000", "type": "index", "display": "Russell 2000"},
    "^VIX": {"name": "VIX", "type": "index", "display": "VIX"},
    
    # ========== ETFs (3) ==========
    "SPY": {"name": "SPDR S&P 500 ETF", "type": "etf", "display": "S&P 500 ETF (SPY)"},
    "QQQ": {"name": "Invesco QQQ ETF", "type": "etf", "display": "NASDAQ ETF (QQQ)"},
    "GLD": {"name": "SPDR Gold ETF", "type": "etf", "display": "Gold ETF (GLD)"},
    
    # ========== CRYPTO (5) ==========
    "BTC-USD": {"name": "Bitcoin USD", "type": "crypto", "display": "Bitcoin (BTC)"},
    "ETH-USD": {"name": "Ethereum USD", "type": "crypto", "display": "Ethereum (ETH)"},
    "SOL-USD": {"name": "Solana USD", "type": "crypto", "display": "Solana (SOL)"},
    "XRP-USD": {"name": "Ripple USD", "type": "crypto", "display": "Ripple (XRP)"},
    "DOGE-USD": {"name": "Dogecoin USD", "type": "crypto", "display": "Dogecoin (DOGE)"},
    
    # ========== COMMODITIES (4) ==========
    "GC=F": {"name": "Gold Futures", "type": "commodity", "display": "Gold"},
    "SI=F": {"name": "Silver Futures", "type": "commodity", "display": "Silver"},
    "CL=F": {"name": "Crude Oil WTI", "type": "commodity", "display": "Crude Oil"},
    "NG=F": {"name": "Natural Gas", "type": "commodity", "display": "Natural Gas"},
}

# Total: ~43 symbols

# Global scheduler state
_scheduler_started = False
_scheduler_thread = None
_stop_event = threading.Event()


def get_last_date_for_symbol(symbol: str) -> Optional[date]:
    """Get the last date we have daily data for a symbol."""
    try:
        with session_scope() as session:
            result = session.execute(
                select(func.max(DailyPrice.date)).where(DailyPrice.symbol == symbol)
            ).scalar()
            return result
    except Exception:
        return None


def is_market_open() -> bool:
    """Check if it's a weekday (markets open)."""
    return datetime.now().weekday() < 5


def fetch_and_save_symbol(symbol: str, info: Dict, force_full: bool = False) -> int:
    """Fetch and save data for a single symbol. Returns number of records saved."""
    if not DEPS_AVAILABLE:
        return 0
    
    try:
        # Determine date range
        last_date = get_last_date_for_symbol(symbol)
        today = date.today()
        
        if force_full or last_date is None:
            # Fetch 2 years of data
            start_date = today - timedelta(days=730)
            logger.info(f"  {symbol}: Full fetch (2 years)")
        else:
            # Incremental: fetch from last date + 1 day
            if last_date >= today - timedelta(days=1):
                logger.debug(f"  {symbol}: Already up to date (last: {last_date})")
                return 0
            start_date = last_date + timedelta(days=1)
            logger.info(f"  {symbol}: Incremental from {start_date}")
        
        # Fetch from yfinance
        ticker = yf.Ticker(symbol)
        df = ticker.history(start=start_date, end=today + timedelta(days=1), interval="1d")
        
        if df.empty:
            logger.warning(f"  {symbol}: No data returned")
            return 0
        
        # Save to database
        with session_scope() as session:
            # Ensure asset exists
            asset = session.query(Asset).filter_by(symbol=symbol).first()
            if not asset:
                asset = Asset(
                    symbol=symbol,
                    name=info.get("name", symbol),
                    asset_type=info.get("type", "stock"),
                    is_active=True
                )
                session.add(asset)
                session.flush()
                
                # Create metadata
                metadata = AssetMetadata(
                    asset_id=asset.id,
                    exchange="YFINANCE",
                    currency="USD"
                )
                session.add(metadata)
            
            count = 0
            for idx, row in df.iterrows():
                price_date = idx.date() if hasattr(idx, 'date') else idx
                
                # Upsert price data
                stmt = sqlite_insert(DailyPrice).values(
                    asset_id=asset.id,
                    symbol=symbol,
                    date=price_date,
                    open=float(row['Open']),
                    high=float(row['High']),
                    low=float(row['Low']),
                    close=float(row['Close']),
                    volume=int(row['Volume']) if row['Volume'] > 0 else None,
                )
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
            
            session.commit()
            logger.info(f"  {symbol}: Saved {count} candles")
            return count
            
    except Exception as e:
        logger.error(f"  {symbol}: Error - {e}")
        return 0


def cleanup_unwanted_symbols():
    """Remove symbols from database that are not in CURATED_SYMBOLS."""
    if not DEPS_AVAILABLE:
        return
    
    try:
        with session_scope() as session:
            # Get all symbols in database
            all_assets = session.query(Asset).all()
            
            removed_count = 0
            for asset in all_assets:
                if asset.symbol not in CURATED_SYMBOLS:
                    # Delete price data first
                    session.execute(
                        delete(DailyPrice).where(DailyPrice.asset_id == asset.id)
                    )
                    session.execute(
                        delete(HourlyPrice).where(HourlyPrice.asset_id == asset.id)
                    )
                    session.execute(
                        delete(AssetMetadata).where(AssetMetadata.asset_id == asset.id)
                    )
                    session.delete(asset)
                    removed_count += 1
                    logger.info(f"  Removed: {asset.symbol}")
            
            session.commit()
            
            if removed_count > 0:
                logger.info(f"Cleaned up {removed_count} unwanted symbols")
                
    except Exception as e:
        logger.error(f"Error cleaning up symbols: {e}")


def run_update(force_full: bool = False):
    """Run a full update of all curated symbols."""
    if not DEPS_AVAILABLE:
        logger.warning("Market data scheduler: dependencies not available")
        return
    
    logger.info("=" * 50)
    logger.info(f"MARKET DATA UPDATE - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    logger.info("=" * 50)
    
    # First, clean up unwanted symbols
    cleanup_unwanted_symbols()
    
    # Then update all curated symbols
    total_records = 0
    success = 0
    failed = 0
    
    for symbol, info in CURATED_SYMBOLS.items():
        try:
            count = fetch_and_save_symbol(symbol, info, force_full)
            total_records += count
            success += 1
            
            # Rate limit: wait 2 seconds between requests to avoid API limits
            time.sleep(2)
        except Exception as e:
            logger.error(f"Failed to update {symbol}: {e}")
            failed += 1
    
    logger.info("-" * 50)
    logger.info(f"Update complete: {success} symbols, {total_records} records, {failed} errors")


def scheduler_loop():
    """Background loop that runs updates every 5 minutes."""
    global _stop_event
    
    logger.info("Market data scheduler started (5-minute interval)")
    
    # Initial update
    run_update(force_full=False)
    
    while not _stop_event.is_set():
        # Wait 5 minutes (checking stop event every second)
        for _ in range(300):
            if _stop_event.is_set():
                break
            time.sleep(1)
        
        if not _stop_event.is_set():
            # Only update on weekdays during market hours-ish
            # Or always for crypto
            run_update(force_full=False)
    
    logger.info("Market data scheduler stopped")


def start_scheduler():
    """Start the background data scheduler. Safe to call multiple times."""
    global _scheduler_started, _scheduler_thread, _stop_event
    
    if not DEPS_AVAILABLE:
        logger.warning("Cannot start scheduler: dependencies not available")
        return False
    
    if _scheduler_started:
        logger.debug("Scheduler already running")
        return True
    
    # Initialize database
    try:
        init_db()
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        return False
    
    # Start background thread
    _stop_event.clear()
    _scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True)
    _scheduler_thread.start()
    _scheduler_started = True
    
    return True


def stop_scheduler():
    """Stop the background scheduler."""
    global _scheduler_started, _stop_event
    
    if not _scheduler_started:
        return
    
    _stop_event.set()
    _scheduler_started = False
    logger.info("Scheduler stop requested")


# ============================================================================
# MAIN - Run directly for manual updates
# ============================================================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Market Data Scheduler")
    parser.add_argument("--force", "-f", action="store_true", help="Force full refresh (2 years)")
    parser.add_argument("--once", action="store_true", help="Run once and exit (no scheduling)")
    parser.add_argument("--cleanup", action="store_true", help="Only cleanup unwanted symbols")
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("MARKET DATA SCHEDULER")
    print("=" * 60)
    print(f"Curated symbols: {len(CURATED_SYMBOLS)}")
    print(f"  - Forex: {len([s for s, i in CURATED_SYMBOLS.items() if i['type'] == 'forex'])}")
    print(f"  - Stocks: {len([s for s, i in CURATED_SYMBOLS.items() if i['type'] == 'stock'])}")
    print(f"  - Indices: {len([s for s, i in CURATED_SYMBOLS.items() if i['type'] == 'index'])}")
    print(f"  - ETFs: {len([s for s, i in CURATED_SYMBOLS.items() if i['type'] == 'etf'])}")
    print(f"  - Crypto: {len([s for s, i in CURATED_SYMBOLS.items() if i['type'] == 'crypto'])}")
    print(f"  - Commodities: {len([s for s, i in CURATED_SYMBOLS.items() if i['type'] == 'commodity'])}")
    print()
    
    if args.cleanup:
        init_db()
        cleanup_unwanted_symbols()
        print("Cleanup complete!")
    elif args.once:
        init_db()
        run_update(force_full=args.force)
    else:
        # Start scheduler and wait
        start_scheduler()
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            stop_scheduler()
            print("\nStopped.")
