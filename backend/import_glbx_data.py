"""
Import GLBX (CME Globex) futures data into the database.
Source: stock-data/GLBX-20251208-WK4D4HNKCF/glbx-mdp3-20200108-20251207.ohlcv-1d.csv
"""

import csv
import logging
import sys
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from database.connection import init_db, session_scope
from database.models import Asset, AssetMetadata, DailyPrice

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Path to GLBX data
GLBX_DIR = Path(__file__).parent.parent / "stock-data" / "GLBX-20251208-WK4D4HNKCF"
GLBX_CSV = GLBX_DIR / "glbx-mdp3-20200108-20251207.ohlcv-1d.csv"


def parse_futures_symbol(raw_symbol: str) -> dict:
    """
    Parse a CME Globex futures symbol.

    Examples:
    - "CLG0" -> base="CL", month="G", year="0" (Crude Oil Feb 2020)
    - "GCG0-GCV1" -> spread between Gold Feb 2020 and Oct 2021
    - "CL:BF G0-H0-J0" -> butterfly spread
    """
    # Extract base commodity code (first 2-3 letters before month code)
    base_symbol = ""
    for char in raw_symbol:
        if char.isalpha():
            base_symbol += char
        else:
            break

    # Common commodity codes
    commodity_names = {
        "CL": "Crude Oil",
        "GC": "Gold",
        "SI": "Silver",
        "NG": "Natural Gas",
        "HO": "Heating Oil",
        "RB": "RBOB Gasoline",
        "BZ": "Brent Crude",
        "HG": "Copper",
        "PL": "Platinum",
        "PA": "Palladium",
        "ZC": "Corn",
        "ZS": "Soybeans",
        "ZW": "Wheat",
        "ZB": "30-Year Bond",
        "ZN": "10-Year Note",
        "ZF": "5-Year Note",
        "ZT": "2-Year Note",
        "ES": "E-mini S&P 500",
        "NQ": "E-mini NASDAQ-100",
        "RTY": "E-mini Russell 2000",
        "YM": "E-mini Dow",
        "6E": "Euro FX",
        "6J": "Japanese Yen",
        "6B": "British Pound",
        "6A": "Australian Dollar",
        "6C": "Canadian Dollar",
        "6S": "Swiss Franc",
        "LE": "Live Cattle",
        "HE": "Lean Hogs",
        "GE": "Eurodollar",
    }

    return {
        "base_symbol": base_symbol[:2] if len(base_symbol) >= 2 else base_symbol,
        "full_symbol": raw_symbol,
        "commodity_name": commodity_names.get(
            base_symbol[:2], f"Futures ({base_symbol})"
        ),
    }


def get_or_create_futures_asset(session, symbol: str) -> Asset:
    """Get existing futures asset or create new one."""
    asset = session.query(Asset).filter_by(symbol=symbol).first()

    if not asset:
        parsed = parse_futures_symbol(symbol)

        asset = Asset(
            symbol=symbol,
            name=f"{parsed['commodity_name']} - {symbol}",
            asset_type="futures",
            is_active=True,
        )
        session.add(asset)
        session.flush()

        # Create metadata
        metadata = AssetMetadata(
            asset_id=asset.id,
            exchange="GLBX",
            currency="USD",
            description=f"CME Globex {parsed['commodity_name']} futures contract",
        )
        session.add(metadata)

    return asset


def import_glbx_data():
    """Import GLBX futures data from CSV."""

    if not GLBX_CSV.exists():
        logger.error(f"GLBX CSV file not found: {GLBX_CSV}")
        return

    # Initialize database
    init_db()

    logger.info(f"Importing GLBX futures data from: {GLBX_CSV}")

    stats = {
        "symbols_processed": 0,
        "records_inserted": 0,
        "records_updated": 0,
        "errors": 0,
    }

    # Read CSV in streaming fashion
    with open(GLBX_CSV, "r") as f:
        reader = csv.DictReader(f)

        # Track current symbol for batching
        current_symbol = None
        batch_records = []
        row_count = 0
        total_rows = 394203  # Known from earlier analysis

        with session_scope() as session:
            for row in reader:
                row_count += 1

                try:
                    symbol = row["symbol"]
                    ts_event = row["ts_event"]

                    # Parse date from timestamp (format: 2020-01-08T00:00:00.000000000Z)
                    price_date = datetime.strptime(
                        ts_event[:10], "%Y-%m-%d"
                    ).date()

                    # Parse OHLCV
                    open_price = float(row["open"]) if row["open"] else 0
                    high_price = float(row["high"]) if row["high"] else 0
                    low_price = float(row["low"]) if row["low"] else 0
                    close_price = float(row["close"]) if row["close"] else 0
                    volume = int(row["volume"]) if row["volume"] else None

                    # Get or create asset
                    if symbol != current_symbol:
                        if current_symbol is not None:
                            stats["symbols_processed"] += 1
                            if stats["symbols_processed"] % 100 == 0:
                                logger.info(
                                    f"  Processed {stats['symbols_processed']} symbols, {row_count}/{total_rows} rows..."
                                )
                                session.commit()

                        current_symbol = symbol
                        asset = get_or_create_futures_asset(session, symbol)

                    # Check for existing record
                    existing = (
                        session.query(DailyPrice)
                        .filter_by(asset_id=asset.id, date=price_date)
                        .first()
                    )

                    if existing:
                        existing.open = open_price
                        existing.high = high_price
                        existing.low = low_price
                        existing.close = close_price
                        existing.volume = volume
                        stats["records_updated"] += 1
                    else:
                        price = DailyPrice(
                            asset_id=asset.id,
                            symbol=symbol,
                            date=price_date,
                            open=open_price,
                            high=high_price,
                            low=low_price,
                            close=close_price,
                            volume=volume,
                        )
                        session.add(price)
                        stats["records_inserted"] += 1

                    # Progress logging
                    if row_count % 5000 == 0:
                        logger.info(
                            f"  Progress: {row_count}/{total_rows} rows ({100*row_count/total_rows:.1f}%)"
                        )

                except Exception as e:
                    stats["errors"] += 1
                    if stats["errors"] <= 10:
                        logger.error(f"  Error on row {row_count}: {e}")

            # Final commit
            session.commit()
            stats["symbols_processed"] += 1

    logger.info("\nImport complete!")
    logger.info(f"  Symbols processed: {stats['symbols_processed']}")
    logger.info(f"  Records inserted: {stats['records_inserted']}")
    logger.info(f"  Records updated: {stats['records_updated']}")
    logger.info(f"  Errors: {stats['errors']}")

    # Print summary
    with session_scope() as session:
        futures_count = session.query(Asset).filter_by(asset_type="futures").count()
        futures_prices = (
            session.query(DailyPrice)
            .join(Asset)
            .filter(Asset.asset_type == "futures")
            .count()
        )

        print("\n" + "=" * 70)
        print("GLBX FUTURES DATABASE SUMMARY")
        print("=" * 70)
        print(f"\nTotal futures symbols: {futures_count}")
        print(f"Total futures price records: {futures_prices}")

        # Sample symbols
        print("\nSample symbols by commodity:")
        print("-" * 70)

        sample_symbols = ["CL", "GC"]
        for base in sample_symbols:
            count = (
                session.query(Asset)
                .filter(Asset.symbol.like(f"{base}%"))
                .filter(Asset.asset_type == "futures")
                .count()
            )
            parsed = parse_futures_symbol(base)
            print(f"  {base}: {parsed['commodity_name']} Futures - {count} contracts")

        print("=" * 70)


if __name__ == "__main__":
    import_glbx_data()
