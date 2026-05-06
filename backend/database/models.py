"""
SQLAlchemy ORM models.

Tables:
- assets: Core symbol information and classification
- asset_metadata: Extended metadata for each asset
- daily_prices: Historical OHLCV price data with symbol+date index
- hourly_prices: Historical hourly OHLCV price data
- accounts: User/household/client account separation (taxable, IRA, Roth, etc.)
- portfolio_lots: Tax-lot accounting unit; each buy creates one row
- realized_sales: Sell events with full lot consumption breakdown for tax reporting
"""
import datetime as dt
import uuid
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


class StrategyExecution(Base):
    """
    Records a strategy execution session.
    """
    __tablename__ = "strategy_executions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    strategy_name = Column(String(100), nullable=False)
    symbol = Column(String(20), nullable=False)
    start_time = Column(DateTime, default=dt.datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    status = Column(String(20), default="running")  # running, stopped, error
    configuration = Column(Text, nullable=True)  # JSON string of params

    trades = relationship("Trade", back_populates="execution", cascade="all, delete-orphan")


class Trade(Base):
    """
    Records an executed trade.
    """
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    execution_id = Column(Integer, ForeignKey("strategy_executions.id", ondelete="CASCADE"), nullable=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True) # Optional link to asset table
    symbol = Column(String(20), nullable=False)
    
    direction = Column(String(10), nullable=False)  # BUY, SELL
    entry_time = Column(DateTime, nullable=False)
    entry_price = Column(Numeric(20, 8), nullable=False)
    size = Column(Numeric(20, 8), nullable=False)
    
    exit_time = Column(DateTime, nullable=True)
    exit_price = Column(Numeric(20, 8), nullable=True)
    
    pnl = Column(Numeric(20, 8), nullable=True)
    pnl_percent = Column(Numeric(10, 6), nullable=True)
    
    broker_ref = Column(String(100), nullable=True)  # Deal ID from broker
    status = Column(String(20), default="OPEN")  # OPEN, CLOSED
    
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)
    
    # Trade Journaling - JSON field for tags like {"entry_reason": "RSI oversold", "regime": "trending"}
    tags = Column(Text, nullable=True)  # JSON string

    execution = relationship("StrategyExecution", back_populates="trades")
    
    def get_tags(self):
        """Return tags as a dictionary."""
        import json
        if self.tags:
            try:
                return json.loads(self.tags)
            except:
                return {}
        return {}

    def set_tags(self, tags_dict):
        """Set tags from a dictionary."""
        import json
        self.tags = json.dumps(tags_dict) if tags_dict else None


# ───────────────────────────────────────────────────────────
# Multi-account / tax-lot accounting
# ───────────────────────────────────────────────────────────


def _uuid() -> str:
    return uuid.uuid4().hex


class Account(Base):
    """
    A tradeable bucket (taxable / IRA / Roth / 529 / managed-client / etc).

    Holdings, lots, and realized sales reference an account so reporting can be
    scoped to a single account or aggregated across all accounts owned by the
    user/household.
    """
    __tablename__ = "accounts"

    id = Column(String(48), primary_key=True, default=_uuid)
    user_id = Column(String(64), nullable=True, index=True)  # Supabase UID; null in single-user mode
    name = Column(String(120), nullable=False)
    type = Column(String(32), nullable=False)  # taxable, traditional_ira, roth_ira, 401k, ...
    owner = Column(String(120), nullable=False)
    broker = Column(String(64), nullable=True)
    last4 = Column(String(8), nullable=True)
    tax_status = Column(String(32), nullable=False)  # taxable | tax_deferred | tax_free | non_taxable
    currency = Column(String(8), nullable=False, default="USD")
    archived = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=dt.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)

    lots = relationship("PortfolioLot", back_populates="account", cascade="all, delete-orphan")
    sales = relationship("RealizedSale", back_populates="account", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_accounts_user", "user_id", "archived"),
    )

    def __repr__(self):
        return f"<Account(id={self.id}, name='{self.name}', type='{self.type}')>"


class PortfolioLot(Base):
    """
    Tax-lot accounting unit. Every buy creates a Lot; sells consume from one
    or more lots under the active cost-basis method. closed_qty tracks how
    many units have already been sold from the lot — when closed_qty == qty,
    the lot is fully closed.

    `replacement_for_sale_id` is set when this lot was opened within ±30 days
    of a loss sale (a US wash-sale match): the disallowed loss is added to
    this lot's basis (`wash_basis_addback`) so future sells use the adjusted
    cost basis.
    """
    __tablename__ = "portfolio_lots"

    id = Column(String(48), primary_key=True, default=_uuid)
    account_id = Column(String(48), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    symbol = Column(String(20), nullable=False, index=True)

    qty = Column(Numeric(28, 12), nullable=False)
    closed_qty = Column(Numeric(28, 12), nullable=False, default=0)
    price = Column(Numeric(20, 8), nullable=False)  # cost basis per unit (excl. fees)
    fees = Column(Numeric(20, 8), nullable=False, default=0)  # capitalized into per-unit basis pro-rata
    currency = Column(String(8), nullable=False, default="USD")
    opened_at = Column(DateTime, nullable=False)

    # Wash-sale adjustments
    wash_basis_addback = Column(Numeric(20, 8), nullable=False, default=0)
    replacement_for_sale_id = Column(String(48), ForeignKey("realized_sales.id"), nullable=True)

    # Optional broker reference for reconciliation
    broker_lot_ref = Column(String(120), nullable=True)

    created_at = Column(DateTime, default=dt.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)

    account = relationship("Account", back_populates="lots")

    __table_args__ = (
        Index("ix_lots_account_symbol_open", "account_id", "symbol", "opened_at"),
    )

    @property
    def open_qty(self) -> Decimal:
        return Decimal(self.qty) - Decimal(self.closed_qty)

    @property
    def basis_per_unit(self) -> Decimal:
        if not self.qty:
            return Decimal(0)
        fees_per_unit = Decimal(self.fees) / Decimal(self.qty)
        addback_per_unit = Decimal(self.wash_basis_addback) / Decimal(self.qty)
        return Decimal(self.price) + fees_per_unit + addback_per_unit

    def __repr__(self):
        return f"<Lot(symbol='{self.symbol}', qty={self.qty}, open={self.open_qty})>"


class RealizedSale(Base):
    """
    A sell event. The `consumed` JSON column captures lot-by-lot detail for
    tax reporting (per-slice qty, basis, days held, ST/LT). Wash-sale flagging
    is materialized into `wash_disallowed_loss` so reports don't have to
    recompute on every read.
    """
    __tablename__ = "realized_sales"

    id = Column(String(48), primary_key=True, default=_uuid)
    account_id = Column(String(48), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    symbol = Column(String(20), nullable=False, index=True)

    qty = Column(Numeric(28, 12), nullable=False)
    sale_price = Column(Numeric(20, 8), nullable=False)
    fees = Column(Numeric(20, 8), nullable=False, default=0)
    proceeds = Column(Numeric(28, 8), nullable=False)  # qty * sale_price - fees
    cost_basis = Column(Numeric(28, 8), nullable=False)  # sum across consumed lot slices
    realized_pnl = Column(Numeric(28, 8), nullable=False)
    short_term_pnl = Column(Numeric(28, 8), nullable=False, default=0)
    long_term_pnl = Column(Numeric(28, 8), nullable=False, default=0)

    # Wash-sale: amount of realized loss disallowed and re-added to a replacement lot's basis.
    wash_disallowed_loss = Column(Numeric(28, 8), nullable=False, default=0)

    closed_at = Column(DateTime, nullable=False)
    cost_basis_method = Column(String(16), nullable=False)  # FIFO|LIFO|HIFO|AVERAGE|SPECID

    # Per-lot consumption detail; JSON-serialized list of dicts:
    # [{"lot_id":..., "qty":..., "price_per_unit":..., "opened_at":..., "days_held":..., "long_term":bool}, ...]
    consumed = Column(Text, nullable=False, default="[]")

    broker_ref = Column(String(120), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=dt.datetime.utcnow, nullable=False)

    account = relationship("Account", back_populates="sales")

    __table_args__ = (
        Index("ix_sales_account_closed", "account_id", "closed_at"),
        Index("ix_sales_symbol_closed", "symbol", "closed_at"),
    )

    def get_consumed(self):
        """Return consumed lot-slice list as Python objects."""
        import json
        if not self.consumed:
            return []
        try:
            return json.loads(self.consumed)
        except Exception:
            return []

    def set_consumed(self, slices):
        """Persist consumed slices."""
        import json
        self.consumed = json.dumps(slices)

    def __repr__(self):
        return f"<RealizedSale(symbol='{self.symbol}', qty={self.qty}, pnl={self.realized_pnl})>"


class CorporateAction(Base):
    """
    Corporate-action record (split, dividend, spin-off, merger, ticker change).

    Ingested from data providers and applied to lots in `applied=False` rows
    by a deferred job. After application, lot quantities/cost-bases are
    adjusted and the row is marked applied=True.
    """
    __tablename__ = "corporate_actions"

    id = Column(String(48), primary_key=True, default=_uuid)
    symbol = Column(String(20), nullable=False, index=True)
    action_type = Column(String(32), nullable=False)  # split, reverse_split, cash_dividend, stock_dividend, spin_off, merger, ticker_change
    ex_date = Column(Date, nullable=False, index=True)
    pay_date = Column(Date, nullable=True)

    # Numeric ratio for splits (e.g. 3.0 for a 3-for-1) or factor for stock dividends
    ratio_numerator = Column(Numeric(20, 8), nullable=True)
    ratio_denominator = Column(Numeric(20, 8), nullable=True)

    # Cash amount per share for cash dividends
    cash_amount = Column(Numeric(20, 8), nullable=True)
    currency = Column(String(8), nullable=True)

    # For ticker-change / mergers
    new_symbol = Column(String(20), nullable=True)

    source = Column(String(32), nullable=False, default="manual")  # fmp | yfinance | manual | edgar
    applied = Column(Boolean, default=False, nullable=False)
    applied_at = Column(DateTime, nullable=True)
    raw = Column(Text, nullable=True)  # JSON blob from provider

    created_at = Column(DateTime, default=dt.datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_corp_actions_pending", "applied", "ex_date"),
        UniqueConstraint("symbol", "ex_date", "action_type", name="uix_corp_action_dedupe"),
    )

    def __repr__(self):
        return f"<CorporateAction(symbol='{self.symbol}', type='{self.action_type}', ex={self.ex_date})>"

