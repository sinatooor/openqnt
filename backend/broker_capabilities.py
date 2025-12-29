from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime, time
import pytz

class OrderType(str, Enum):
    """Supported order types across various brokers."""
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP = "STOP"
    TRAILING_STOP = "TRAILING_STOP"
    GUARANTEED_STOP = "GUARANTEED_STOP"

class MarketHours(BaseModel):
    """Trading hours for a market in a specific timezone."""
    timezone: str
    # Format: "HH:MM-HH:MM" or "CLOSED"
    monday: str = "00:00-24:00"
    tuesday: str = "00:00-24:00"
    wednesday: str = "00:00-24:00"
    thursday: str = "00:00-24:00"
    friday: str = "00:00-24:00"
    saturday: str = "CLOSED"
    sunday: str = "CLOSED"

    def is_open(self, dt: datetime) -> bool:
        """Check if the market is open at the given datetime."""
        # Ensure we have a timezone-aware datetime
        tz = pytz.timezone(self.timezone)
        if dt.tzinfo is None:
            local_dt = tz.localize(dt)
        else:
            local_dt = dt.astimezone(tz)
            
        day_name = local_dt.strftime('%A').lower()
        hours_range = getattr(self, day_name, "CLOSED")
        
        if hours_range == "CLOSED":
            return False
        
        if hours_range == "00:00-24:00":
            return True
            
        try:
            start_str, end_str = hours_range.split('-')
            start_time = time.fromisoformat(start_str)
            end_time = time.fromisoformat(end_str)
            current_time = local_dt.time()
            return start_time <= current_time <= end_time
        except ValueError:
            return False

class BrokerCapabilities(BaseModel):
    """Abstraction of what a broker supports."""
    name: str
    supported_order_types: List[OrderType]
    min_lot_size: float
    max_lot_size: float
    lot_step: float
    market_hours: MarketHours

    def validate_order(self, order_type: OrderType, size: float, dt: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Validate if an order can be executed based on broker capabilities.
        Returns a dict with 'valid' (bool) and 'errors' (list of strings).
        """
        errors = []
        
        # Check order type support
        if order_type not in self.supported_order_types:
            errors.append(f"Order type {order_type} not supported by {self.name}")
            
        # Check lot size bounds
        if size < self.min_lot_size:
            errors.append(f"Size {size} below minimum {self.min_lot_size} for {self.name}")
        elif size > self.max_lot_size:
            errors.append(f"Size {size} above maximum {self.max_lot_size} for {self.name}")
        else:
            # Check lot step alignment
            # Using a small epsilon for floating point comparison
            remainder = (size - self.min_lot_size) % self.lot_step
            if not (abs(remainder) < 1e-9 or abs(remainder - self.lot_step) < 1e-9):
                errors.append(f"Size {size} does not align with lot step {self.lot_step} for {self.name}")
                
        # Check market hours if datetime is provided
        if dt:
            if not self.market_hours.is_open(dt):
                errors.append(f"Market is closed for {self.name} at {dt}")
                
        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

# Mock Broker Implementations

def get_ig_mock_capabilities() -> BrokerCapabilities:
    """Mock capabilities for IG Index (CFD Broker)."""
    return BrokerCapabilities(
        name="IG_Mock",
        supported_order_types=[
            OrderType.MARKET, 
            OrderType.LIMIT, 
            OrderType.STOP, 
            OrderType.TRAILING_STOP
        ],
        min_lot_size=0.1,
        max_lot_size=100.0,
        lot_step=0.1,
        market_hours=MarketHours(
            timezone="Europe/London",
            monday="00:00-24:00",
            tuesday="00:00-24:00",
            wednesday="00:00-24:00",
            thursday="00:00-24:00",
            friday="00:00-22:00", # Closes early Friday
            saturday="CLOSED",
            sunday="CLOSED"
        )
    )

def get_binance_mock_capabilities() -> BrokerCapabilities:
    """Mock capabilities for Binance (Crypto Exchange)."""
    return BrokerCapabilities(
        name="Binance_Mock",
        supported_order_types=[
            OrderType.MARKET, 
            OrderType.LIMIT, 
            OrderType.STOP
        ],
        min_lot_size=0.00001,
        max_lot_size=1000.0,
        lot_step=0.00001,
        market_hours=MarketHours(
            timezone="UTC",
            monday="00:00-24:00",
            tuesday="00:00-24:00",
            wednesday="00:00-24:00",
            thursday="00:00-24:00",
            friday="00:00-24:00",
            saturday="00:00-24:00",
            sunday="00:00-24:00"
        )
    )
