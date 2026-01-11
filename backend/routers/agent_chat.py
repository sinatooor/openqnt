"""
Agent Chat Router
Exposes the ADK Agent via REST API for frontend interaction.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from agent_service import get_agent_runner

router = APIRouter(prefix="/api/agent", tags=["agent"])

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default_session"
    context: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    response: str
    tool_calls: Optional[List[Dict[str, Any]]] = None

@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(req: ChatRequest):
    """
    Send a message to the Exploratory Trading Agent.
    """
    try:
        runner = get_agent_runner()
        
        # Run agent turn
        # Note: ADK Runner usually returns a Result object or string
        # We assume standard usage here. 
        # If asynchronous, we await it.
        
        result = runner.run(
            input_text=req.message,
            session_id=req.session_id
        )
        
        # Extract text response
        response_text = ""
        if hasattr(result, "text"):
            response_text = result.text
        elif isinstance(result, str):
            response_text = result
        elif isinstance(result, dict) and "text" in result:
            response_text = result["text"]
        else:
            response_text = str(result)
            
        return ChatResponse(
            response=response_text,
            tool_calls=[] # TODO: Extract tool calls if available
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent Error: {str(e)}")

@router.get("/status")
async def get_agent_status():
    return {"status": "active", "agent": "Exploratory Trading Agent"}
