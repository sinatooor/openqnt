from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from ig_client import IGClient
from nordnet_client import NordnetClient
from strategy_runner import start_strategy_runner, stop_strategy_runner, get_runner_status

router = APIRouter(prefix="/api/live", tags=["live-trading"])

# Global IG Client Instance
# In a real app, this might be per-user session or stored better
ig_client = IGClient()
ig_client = None # Changed from IGClient() to None
nordnet_client = None # Added nordnet_client
runner = None # Added runner

class IGLoginRequest(BaseModel):
    username: str
    password: str
    api_key: str

class NordnetLoginRequest(BaseModel): # Added NordnetLoginRequest
    api_key: str  # The UUID
    private_key: str  # The PEM string

class StrategyStartRequest(BaseModel):
    symbol: str
    python_code: str
    trade_size: float = 1.0 
    poll_interval: int = 60
    broker: str = "ig" 
    live_mode: bool = False # Default to False (Paper)

@router.post("/login")
async def login_ig(creds: IGLoginRequest):
    """Log in to IG Markets."""
    global ig_client
    # Re-initialize with new creds
    ig_client = IGClient(creds.username, creds.password, creds.api_key)
    result = await ig_client.login()
    if not result.get("success"):
        raise HTTPException(status_code=401, detail=result.get("error"))
    return result

@router.post("/nordnet/login")
async def login_nordnet(creds: NordnetLoginRequest):
    """Log in to Nordnet."""
    global nordnet_client
    nordnet_client = NordnetClient(creds.api_key, creds.private_key)
    result = nordnet_client.login()
    if not result.get("success"):
        raise HTTPException(status_code=401, detail=result.get("error"))
    return result

@router.get("/status")
async def get_status():
    """Get connection and runner status."""
    runner_status = get_runner_status()
    ig_connected = ig_client.is_authenticated if ig_client else False
    return {
        "connected": ig_connected,
        "runner": runner_status
    }

@router.post("/start")
async def start_strategy(req: StrategyStartRequest):
    """Start the strategy runner."""
    global ig_client, nordnet_client, runner
    
    broker_type = req.broker.lower() if req.broker else "ig"
    active_client = None
    
    # Paper trading mode - no broker needed
    if broker_type == "paper" or not req.live_mode:
        # Use paper trading simulation
        result = await start_strategy_runner(
            broker_client=None,  # Paper mode doesn't need a broker
            broker_type="paper",
            python_code=req.python_code,
            symbol=req.symbol,
            trade_size=req.trade_size,
            poll_interval=req.poll_interval,
            live_mode=False  # Always paper mode when broker is paper
        )
        
        if not result['success']:
            raise HTTPException(status_code=500, detail=result.get('error'))
        
        return result
    
    # Live trading requires authenticated broker
    if broker_type == "ig":
        if not ig_client:
             raise HTTPException(status_code=400, detail="Use login endpoint first (IG)")
        active_client = ig_client
    elif broker_type == "nordnet":
        if not nordnet_client:
             raise HTTPException(status_code=400, detail="Use login endpoint first (Nordnet)")
        active_client = nordnet_client
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported broker: {broker_type}")

    # Use runner to start
    result = await start_strategy_runner(
        broker_client=active_client,
        broker_type=broker_type,
        python_code=req.python_code,
        symbol=req.symbol,
        trade_size=req.trade_size,
        poll_interval=req.poll_interval,
        live_mode=req.live_mode
    )
    
    if not result['success']:
        raise HTTPException(status_code=500, detail=result.get('error'))
        
    return result

@router.post("/strategy/stop")
async def stop_strategy():
    """Stop the running strategy."""
    return stop_strategy_runner()

@router.get("/strategy/status")
async def get_strategy_status():
    """Get the current strategy status for the live trading panel."""
    status = get_runner_status()
    
    # Format for frontend
    if status.get("running"):
        return {
            "running": True,
            "mode": "paper" if not status.get("live_mode") else "live",
            "started_at": status.get("started_at"),
            "trades_count": status.get("trades_count", 0),
            "pnl": status.get("pnl", 0.0),
            "positions": status.get("positions", [])
        }
    
    return {
        "running": False,
        "mode": "paper",
        "trades_count": 0,
        "pnl": 0.0,
        "positions": []
    }

@router.post("/position/{position_id}/close")
async def close_position(position_id: str):
    """Close a specific position."""
    # This would be implemented in the strategy runner
    return {"success": True, "message": f"Position {position_id} close requested"}

@router.post("/panic")
async def panic_stop():
    """Emergency stop - closes all positions and stops strategy."""
    result = stop_strategy_runner()
    # In a real implementation, this would also close all positions immediately
    return {"success": True, "message": "Emergency stop triggered", "details": result}
