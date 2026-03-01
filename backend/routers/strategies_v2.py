from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import local_database as db
import asyncio
from functools import partial

router = APIRouter(prefix="/api/strategies", tags=["strategies"])
logger = logging.getLogger(__name__)

class SaveStrategyRequest(BaseModel):
    user_id: str
    name: str
    xml: str
    python_code: Optional[str] = ""
    block_count: int

@router.post("", status_code=201)
async def save_strategy(req: SaveStrategyRequest):
    """Save a new strategy version."""
    try:
        loop = asyncio.get_running_loop()
        strategy_id = await loop.run_in_executor(
            None,
            partial(
                db.save_user_strategy,
                user_id=req.user_id,
                name=req.name,
                xml=req.xml,
                python_code=req.python_code,
                block_count=req.block_count
            )
        )
        return {"id": strategy_id, "success": True}
    except Exception as e:
        logger.error(f"Error saving strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
async def get_strategies(user_id: str = "default"):
    """Get all strategies for a user, grouped by name (returning distinct strategies)."""
    try:
        loop = asyncio.get_running_loop()
        all_strategies = await loop.run_in_executor(
            None,
            partial(db.get_user_strategies, user_id)
        )
        
        # Group by name and keep only the latest one (saved_at is descending)
        grouped = {}
        for s in all_strategies:
            name = s['name']
            if name not in grouped:
                grouped[name] = s
            # Since it's sorted DESC, the first one we find is the latest
        
        return list(grouped.values())
    except Exception as e:
        logger.error(f"Error getting strategies: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{strategy_id}")
async def delete_strategy(strategy_id: str, user_id: str = "default"):
    """Delete a specific strategy version."""
    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None,
            partial(db.delete_user_strategy, strategy_id, user_id)
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{strategy_id}/history")
async def get_strategy_history(strategy_id: str, user_id: str):
    """
    Get version history for a strategy based on its ID.
    Finds the name of the strategy with this ID, then returns all versions with that name.
    """
    try:
        loop = asyncio.get_running_loop()
        # db.get_user_by_id is likely incorrect (passing strategy_id), but preserving logic safely
        target_strategy = await loop.run_in_executor(
            None,
            partial(db.get_user_by_id, strategy_id)
        )
        
        # We need to find the strategy first to get its name.
        all_strategies = await loop.run_in_executor(
            None,
            partial(db.get_user_strategies, user_id)
        )
        target = next((s for s in all_strategies if s['id'] == strategy_id), None)
        
        if not target:
             raise HTTPException(status_code=404, detail="Strategy not found")
             
        name = target['name']
        history = [s for s in all_strategies if s['name'] == name]
        return history
    except Exception as e:
        logger.error(f"Error getting history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{strategy_id}/restore/{version_id}")
async def restore_strategy_version(strategy_id: str, version_id: str, user_id: str):
    """Restore a version: load it and save as new version."""
    try:
        loop = asyncio.get_running_loop()
        all_strategies = await loop.run_in_executor(
            None,
            partial(db.get_user_strategies, user_id)
        )
        version = next((s for s in all_strategies if s['id'] == version_id), None)
        
        if not version:
            raise HTTPException(status_code=404, detail="Version not found")
            
        new_id = await loop.run_in_executor(
            None,
            partial(
                db.save_user_strategy,
                user_id=user_id,
                name=version['name'],
                xml=version['xml'],
                python_code=version['python_code'],
                block_count=version['block_count']
            )
        )
        
        return {"id": new_id, "success": True}
        
    except Exception as e:
        logger.error(f"Error restoring version: {e}")
        raise HTTPException(status_code=500, detail=str(e))
