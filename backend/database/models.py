"""
SQLAlchemy ORM models for FMP market data.

Tables:
- assets: Core symbol information and classification
- asset_metadata: Extended metadata for each asset
- daily_prices: Historical OHLCV price data with symbol+date index
- hourly_prices: Historical hourly OHLCV price data
"""
import datetime as dt
from decimal import Decimal
from sqlalchemy import (
    Column, Integer, String, Date, DateTime, Boolean, 
    Numeric, BigInteger, Text, ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


class Asset(Base):
    """
    Core asset/symbol information.
    
    Stores the primary identifier and classification for each tradeable instrument.
    """
    __tablename__ = "assets"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=True)
    asset_type = Column(String(20), nullable=False)  # 'stock', 'forex', 'commodity', 'index', 'crypto'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)
    
    # Relationships
    metadata_info = relationship("AssetMetadata", back_populates="asset", uselist=False, cascade="all, delete-orphan")
    prices = relationship("DailyPrice", back_populates="asset", cascade="all, delete-orphan")
    hourly_prices = relationship("HourlyPrice", back_populates="asset", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Asset(symbol='{self.symbol}', type='{self.asset_type}')>"


class AssetMetadata(Base):
    """
    Extended metadata for each asset.
    
    Stores additional information like exchange, currency, sector, etc.
    """
    __tablename__ = "asset_metadata"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, unique=True)
    exchange = Column(String(50), nullable=True)
    currency = Column(String(10), nullable=True)
    sector = Column(String(100), nullable=True)
    industry = Column(String(100), nullable=True)
    country = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    
    # Data tracking
    first_price_date = Column(Date, nullable=True)
    last_price_date = Column(Date, nullable=True)
    total_records = Column(Integer, default=0)
    last_fetched_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)
    
    # Relationship
    asset = relationship("Asset", back_populates="metadata_info")
    
    def __repr__(self):
        return f"<AssetMetadata(asset_id={self.asset_id}, exchange='{self.exchange}')>"


class DailyPrice(Base):
    """
    Historical daily OHLCV price data.
    
    Stores end-of-day price data for all asset types with uniform schema.
    Uses Numeric types for precision with financial data.
    """
    __tablename__ = "daily_prices"
    
    # SQLite requires INTEGER (not BIGINT) for proper ROWID autoincrement
    id = Column(Integer, primary_key=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    symbol = Column(String(20), nullable=False)  # Denormalized for faster queries
    date = Column(Date, nullable=False)
    
    # OHLCV data
    open = Column(Numeric(20, 8), nullable=False)
    high = Column(Numeric(20, 8), nullable=False)
    low = Column(Numeric(20, 8), nullable=False)
    close = Column(Numeric(20, 8), nullable=False)
    volume = Column(BigInteger, nullable=True)  # Some assets don't have volume
    
    # Additional FMP fields
    change = Column(Numeric(20, 8), nullable=True)
    change_percent = Column(Numeric(10, 6), nullable=True)
    vwap = Column(Numeric(20, 8), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    
    # Relationship
    asset = relationship("Asset", back_populates="prices")
    
    # Table constraints and indexes
    __table_args__ = (
        # Unique constraint on symbol + date to prevent duplicates
        UniqueConstraint('symbol', 'date', name='uix_symbol_date'),
        # Composite index for common queries
        Index('idx_symbol_date', 'symbol', 'date'),
        # Index for date range queries
        Index('idx_date', 'date'),
        # Index for asset_id lookups
        Index('idx_asset_id', 'asset_id'),
    )
    
    def __repr__(self):
        return f"<DailyPrice(symbol='{self.symbol}', date='{self.date}', close={self.close})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            "symbol": self.symbol,
            "date": self.date.isoformat() if self.date else None,
            "open": float(self.open) if self.open else None,
            "high": float(self.high) if self.high else None,
            "low": float(self.low) if self.low else None,
            "close": float(self.close) if self.close else None,
            "volume": self.volume,
            "change": float(self.change) if self.change else None,
            "change_percent": float(self.change_percent) if self.change_percent else None,
            "vwap": float(self.vwap) if self.vwap else None,
        }


class HourlyPrice(Base):
    """
    Historical hourly OHLCV price data.
    
    Stores hourly price data for intraday analysis.
    Uses Numeric types for precision with financial data.
    """
    __tablename__ = "hourly_prices"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    symbol = Column(String(20), nullable=False)
    datetime = Column(DateTime, nullable=False)  # Full timestamp for hourly data
    
    # OHLCV data
    open = Column(Numeric(20, 8), nullable=False)
    high = Column(Numeric(20, 8), nullable=False)
    low = Column(Numeric(20, 8), nullable=False)
    close = Column(Numeric(20, 8), nullable=False)
    volume = Column(BigInteger, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    
    # Relationship
    asset = relationship("Asset", back_populates="hourly_prices")
    
    # Table constraints and indexes
    __table_args__ = (
        UniqueConstraint('symbol', 'datetime', name='uix_symbol_datetime_hourly'),
        Index('idx_hourly_symbol_datetime', 'symbol', 'datetime'),
        Index('idx_hourly_datetime', 'datetime'),
        Index('idx_hourly_asset_id', 'asset_id'),
    )
    
    def __repr__(self):
        return f"<HourlyPrice(symbol='{self.symbol}', datetime='{self.datetime}', close={self.close})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            "symbol": self.symbol,
            "datetime": self.datetime.isoformat() if self.datetime else None,
            "open": float(self.open) if self.open else None,
            "high": float(self.high) if self.high else None,
            "low": float(self.low) if self.low else None,
            "close": float(self.close) if self.close else None,
            "volume": self.volume,
        }
