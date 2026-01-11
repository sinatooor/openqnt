
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from backend.database.connection import get_session
from backend.database.models import Trade, StrategyExecution, DailyPrice

router = APIRouter(
    prefix="/api/trades",
    tags=["trades"]
)

@router.get("/", response_model=list[dict])
async def get_trades(
    skip: int = 0, 
    limit: int = 100,
    symbol: Optional[str] = None,
    status: Optional[str] = None,
    execution_id: Optional[int] = None,
    db: Session = Depends(get_session)
):
    """
    Get list of executed trades.
    """
    query = db.query(Trade)
    
    if symbol:
        query = query.filter(Trade.symbol == symbol)
    if status:
        query = query.filter(Trade.status == status)
    if execution_id:
        query = query.filter(Trade.execution_id == execution_id)
        
    trades = query.order_by(Trade.entry_time.desc()).offset(skip).limit(limit).all()
    
    # Simple serialization manual for now to avoid Pydantic schema duplication
    return [
        {
            "id": t.id,
            "execution_id": t.execution_id,
            "symbol": t.symbol,
            "direction": t.direction,
            "entry_time": t.entry_time,
            "entry_price": float(t.entry_price) if t.entry_price else 0,
            "size": float(t.size) if t.size else 0,
            "exit_time": t.exit_time,
            "exit_price": float(t.exit_price) if t.exit_price else None,
            "pnl": float(t.pnl) if t.pnl else None,
            "pnl_percent": float(t.pnl_percent) if t.pnl_percent else None,
            "status": t.status,
            "broker_ref": t.broker_ref
        }
        for t in trades
    ]

@router.get("/executions", response_model=list[dict])
async def get_executions(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_session)
):
    """
    Get list of strategy execution sessions.
    """
    executions = db.query(StrategyExecution).order_by(StrategyExecution.start_time.desc()).offset(skip).limit(limit).all()
    
    return [
        {
            "id": e.id,
            "strategy_name": e.strategy_name,
            "symbol": e.symbol,
            "start_time": e.start_time,
            "end_time": e.end_time,
            "status": e.status,
            "trade_count": len(e.trades)
        }
        for e in executions
    ]

@router.get("/summary")
async def get_trade_summary(db: Session = Depends(get_session)):
    """
    Get high-level stats (Total PnL, Win Rate).
    """
    trades = db.query(Trade).filter(Trade.status == "CLOSED").all()
    
    total_trades = len(trades)
    if total_trades == 0:
        return {"total_trades": 0, "win_rate": 0, "total_pnl": 0}
        
    winning_trades = [t for t in trades if t.pnl and t.pnl > 0]
    total_pnl = sum([t.pnl for t in trades if t.pnl])
    
    return {
        "total_trades": total_trades,
        "win_rate": len(winning_trades) / total_trades,
        "total_pnl": float(total_pnl)
    }
