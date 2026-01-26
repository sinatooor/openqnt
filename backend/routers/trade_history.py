
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database.connection import get_session
from database.models import Trade, StrategyExecution, DailyPrice

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
    tag_key: Optional[str] = None,  # Filter by tag key
    tag_value: Optional[str] = None,  # Filter by tag value
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
    
    result = []
    for t in trades:
        trade_dict = {
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
            "broker_ref": t.broker_ref,
            "tags": t.get_tags()
        }
        
        # Filter by tag if specified
        if tag_key and tag_value:
            tags = trade_dict.get("tags", {})
            if tags.get(tag_key) != tag_value:
                continue  # Skip this trade
        elif tag_key:
            tags = trade_dict.get("tags", {})
            if tag_key not in tags:
                continue
        
        result.append(trade_dict)
    
    return result

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

@router.get("/executions/{execution_id}")
async def get_execution_detail(
    execution_id: int,
    db: Session = Depends(get_session)
):
    """
    Get detailed info for a specific strategy execution session.
    """
    execution = db.query(StrategyExecution).filter(StrategyExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
        
    return {
        "id": execution.id,
        "strategy_name": execution.strategy_name,
        "symbol": execution.symbol,
        "start_time": execution.start_time,
        "end_time": execution.end_time,
        "status": execution.status,
        "trade_count": len(execution.trades),
        "settings": execution.settings  # Assuming this field exists or we add it later
    }

@router.get("/summary")
async def get_trade_summary(
    timeframe: Optional[str] = "all",  # "7d", "30d", "all"
    db: Session = Depends(get_session)
):
    """
    Get comprehensive performance statistics.
    """
    from datetime import datetime, timedelta
    
    query = db.query(Trade).filter(Trade.status == "CLOSED")
    
    # Apply timeframe filter
    if timeframe == "7d":
        cutoff = datetime.utcnow() - timedelta(days=7)
        query = query.filter(Trade.entry_time >= cutoff)
    elif timeframe == "30d":
        cutoff = datetime.utcnow() - timedelta(days=30)
        query = query.filter(Trade.entry_time >= cutoff)
    
    trades = query.all()
    
    total_trades = len(trades)
    if total_trades == 0:
        return {
            "total_trades": 0,
            "win_rate": 0,
            "total_pnl": 0,
            "avg_win": 0,
            "avg_loss": 0,
            "best_trade": 0,
            "worst_trade": 0,
            "profit_factor": 0,
            "max_drawdown": 0,
            "avg_holding_time": "N/A"
        }
    
    # Separate wins and losses
    wins = [float(t.pnl) for t in trades if t.pnl and float(t.pnl) > 0]
    losses = [float(t.pnl) for t in trades if t.pnl and float(t.pnl) < 0]
    all_pnl = [float(t.pnl) for t in trades if t.pnl]
    
    total_pnl = sum(all_pnl)
    avg_win = sum(wins) / len(wins) if wins else 0
    avg_loss = sum(losses) / len(losses) if losses else 0
    best_trade = max(all_pnl) if all_pnl else 0
    worst_trade = min(all_pnl) if all_pnl else 0
    
    # Profit factor = gross profit / gross loss
    gross_profit = sum(wins) if wins else 0
    gross_loss = abs(sum(losses)) if losses else 1  # Avoid division by zero
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
    
    # Calculate max drawdown (simplified - based on cumulative PnL)
    cumulative = 0
    peak = 0
    max_drawdown = 0
    for pnl in all_pnl:
        cumulative += pnl
        if cumulative > peak:
            peak = cumulative
        drawdown = peak - cumulative
        if drawdown > max_drawdown:
            max_drawdown = drawdown
    
    # Calculate average holding time
    holding_times = []
    for t in trades:
        if t.entry_time and t.exit_time:
            delta = t.exit_time - t.entry_time
            holding_times.append(delta.total_seconds())
    
    if holding_times:
        avg_seconds = sum(holding_times) / len(holding_times)
        if avg_seconds < 3600:
            avg_holding_time = f"{int(avg_seconds / 60)}m"
        elif avg_seconds < 86400:
            avg_holding_time = f"{avg_seconds / 3600:.1f}h"
        else:
            avg_holding_time = f"{avg_seconds / 86400:.1f}d"
    else:
        avg_holding_time = "N/A"
    
    return {
        "total_trades": total_trades,
        "win_rate": len(wins) / total_trades if total_trades > 0 else 0,
        "total_pnl": float(total_pnl),
        "avg_win": float(avg_win),
        "avg_loss": float(avg_loss),
        "best_trade": float(best_trade),
        "worst_trade": float(worst_trade),
        "profit_factor": float(profit_factor),
        "max_drawdown": float(max_drawdown),
        "avg_holding_time": avg_holding_time
    }

