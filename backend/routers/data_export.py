"""
Data Export Router

Provides endpoints to export market data and trade history as CSV files.
"""
from fastapi import APIRouter, Depends, Query, Response, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
import csv
import io

from backend.database.connection import get_session
from backend.database.models import Trade, DailyPrice, HourlyPrice

router = APIRouter(
    prefix="/api/export",
    tags=["export"]
)


@router.get("/trades/csv")
async def export_trades_csv(
    symbol: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_session)
):
    """
    Export trades as CSV file.
    """
    query = db.query(Trade)
    
    if symbol:
        query = query.filter(Trade.symbol == symbol)
    if start_date:
        try:
            query = query.filter(Trade.entry_time >= datetime.fromisoformat(start_date))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid start_date format: {start_date}")
    if end_date:
        try:
            query = query.filter(Trade.entry_time <= datetime.fromisoformat(end_date))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid end_date format: {end_date}")
    
    trades = query.order_by(Trade.entry_time.desc()).all()
    
    if not trades:
        raise HTTPException(status_code=404, detail="No trades found for the specified criteria")
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "ID", "Symbol", "Direction", "Entry Time", "Entry Price", 
        "Size", "Exit Time", "Exit Price", "PnL", "PnL %", 
        "Status", "Broker Ref", "Tags"
    ])
    
    # Data
    for t in trades:
        tags_json = t.tags if t.tags else ""
        writer.writerow([
            t.id,
            t.symbol,
            t.direction,
            t.entry_time.isoformat() if t.entry_time else "",
            float(t.entry_price) if t.entry_price else "",
            float(t.size) if t.size else "",
            t.exit_time.isoformat() if t.exit_time else "",
            float(t.exit_price) if t.exit_price else "",
            float(t.pnl) if t.pnl else "",
            float(t.pnl_percent) if t.pnl_percent else "",
            t.status,
            t.broker_ref or "",
            tags_json
        ])
    
    csv_content = output.getvalue()
    output.close()
    
    filename = f"trades_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/market-data/csv")
async def export_market_data_csv(
    symbol: str = Query(..., description="Symbol to export"),
    interval: str = Query("daily", description="Interval: 'daily' or 'hourly'"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_session)
):
    """
    Export historical market data as CSV file.
    """
    if interval == "hourly":
        Model = HourlyPrice
        date_col = HourlyPrice.datetime
    else:
        Model = DailyPrice
        date_col = DailyPrice.date
    
    query = db.query(Model).filter(Model.symbol == symbol)
    
    if start_date:
        query = query.filter(date_col >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(date_col <= datetime.fromisoformat(end_date))
    
    data = query.order_by(date_col.desc()).all()
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["Symbol", "Date", "Open", "High", "Low", "Close", "Volume"])
    
    # Data
    for row in data:
        date_value = row.datetime if interval == "hourly" else row.date
        writer.writerow([
            row.symbol,
            date_value.isoformat() if date_value else "",
            float(row.open) if row.open else "",
            float(row.high) if row.high else "",
            float(row.low) if row.low else "",
            float(row.close) if row.close else "",
            row.volume or ""
        ])
    
    csv_content = output.getvalue()
    output.close()
    
    filename = f"{symbol}_{interval}_{datetime.now().strftime('%Y%m%d')}.csv"
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/summary")
async def get_export_options(db: Session = Depends(get_session)):
    """
    Get available export options (symbols, date ranges).
    """
    # Get unique symbols from trades
    trade_symbols = db.query(Trade.symbol).distinct().all()
    trade_symbols = [s[0] for s in trade_symbols if s[0]]
    
    # Get unique symbols from daily prices
    price_symbols = db.query(DailyPrice.symbol).distinct().all()
    price_symbols = [s[0] for s in price_symbols if s[0]]
    
    return {
        "trade_symbols": trade_symbols,
        "market_data_symbols": price_symbols,
        "supported_formats": ["csv"],
        "intervals": ["daily", "hourly"]
    }
