"""
Server-side portfolio-lots and realized-sales endpoints.

Mirrors the frontend portfolioStore. Persistence path:
  - Account, PortfolioLot, RealizedSale tables in backend/database/models.py
  - For now, this router exposes the contracts; wire in DB session DI per
    project conventions (the existing routers use a get_db() dep).

Implements the cost-basis selection for sells server-side so the canonical
math lives in one place.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/lots", tags=["portfolio-lots"])


# ── Schemas ─────────────────────────────────────────────────────────

CostBasisMethod = Literal["FIFO", "LIFO", "HIFO", "AVERAGE"]


class LotIn(BaseModel):
    account_id: str
    symbol: str
    qty: Decimal
    price: Decimal
    fees: Decimal = Decimal(0)
    currency: str = "USD"
    opened_at: datetime
    broker_lot_ref: str | None = None


class LotOut(LotIn):
    id: str
    closed_qty: Decimal = Decimal(0)
    wash_basis_addback: Decimal = Decimal(0)


class SellRequest(BaseModel):
    account_id: str
    symbol: str
    qty: Decimal = Field(..., gt=0)
    price: Decimal = Field(..., gt=0)
    fees: Decimal = Decimal(0)
    method: CostBasisMethod = "FIFO"
    closed_at: datetime | None = None
    notes: str | None = None


class ConsumedSlice(BaseModel):
    lot_id: str
    qty: Decimal
    price_per_unit: Decimal
    opened_at: datetime
    days_held: int
    long_term: bool


class SellResponse(BaseModel):
    sale_id: str
    proceeds: Decimal
    cost_basis: Decimal
    realized_pnl: Decimal
    short_term_pnl: Decimal
    long_term_pnl: Decimal
    wash_disallowed_loss: Decimal = Decimal(0)
    consumed: list[ConsumedSlice]


# ── Endpoints ───────────────────────────────────────────────────────


@router.get("/accounts/{account_id}/lots", response_model=list[LotOut])
async def list_lots(account_id: str, symbol: str | None = None) -> list[LotOut]:
    """List open & partially-closed lots for an account, optionally filtered by symbol."""
    # TODO: wire DB session
    return []


@router.post("/lots", response_model=LotOut)
async def create_lot(payload: LotIn) -> LotOut:
    """Record a new buy as a fresh tax lot."""
    # TODO: wire DB session
    return LotOut(id="lot-stub", **payload.model_dump())


@router.post("/sell", response_model=SellResponse)
async def sell(req: SellRequest) -> SellResponse:
    """
    Execute a sell: consume open lots under `method`, persist a RealizedSale,
    and return the lot-by-lot consumption breakdown for client rendering and
    audit.
    """
    raise HTTPException(
        status_code=501,
        detail="sell endpoint not yet wired to DB session — see frontend portfolioStore.sell() for canonical math",
    )


@router.get("/accounts/{account_id}/sales")
async def list_sales(account_id: str, year: int | None = None) -> list[dict]:
    """Realized-sales journal for an account, optionally year-scoped for tax reporting."""
    return []


@router.get("/accounts/{account_id}/wash-sales")
async def wash_sales(account_id: str) -> list[dict]:
    """List sales flagged as wash-sales (loss with replacement-buy in ±30d window)."""
    return []
