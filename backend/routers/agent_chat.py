"""
Agent Chat Router
Exposes AI chat via REST API for frontend interaction.
Uses Gemini API directly (via GenAI SDK) when Google ADK is not available.
"""
import os
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

# Try to import Google GenAI for fallback
try:
    from google import genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

# Try to import ADK (optional)
try:
    from agent_service import get_agent_runner
    ADK_AVAILABLE = True
except (ImportError, RuntimeError):
    ADK_AVAILABLE = False

router = APIRouter(prefix="/api/agent", tags=["agent"])

# Chat system prompt for trading assistant
CHAT_SYSTEM_PROMPT = """You are a helpful trading assistant. You can:
- Answer questions about trading strategies and technical analysis
- Explain how indicators work (RSI, SMA, EMA, MACD, Bollinger Bands, etc.)
- Help users understand their trading strategies
- Provide educational information about trading concepts

Keep responses concise and helpful. If asked to generate a strategy, suggest using the "Generate" tab instead."""

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default_session"
    context: Optional[Dict[str, Any]] = None
    current_workspace: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    tool_calls: Optional[List[Dict[str, Any]]] = None

async def chat_with_gemini(message: str, context: Optional[str] = None) -> str:
    """Fallback chat using Gemini GenAI SDK"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    
    client = genai.Client(api_key=api_key)
    
    # Build prompt
    full_prompt = f"{CHAT_SYSTEM_PROMPT}\n\n"
    if context:
        full_prompt += f"Current workspace context: {context[:500]}...\n\n"
    full_prompt += f"User: {message}\n\nAssistant:"
    
    # Run in thread pool (genai is synchronous)
    def _sync_generate():
        return client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=full_prompt,
            config={
                "temperature": 0.7,
                "max_output_tokens": 1000
            }
        )
    
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(None, _sync_generate)
    return response.text

@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(req: ChatRequest):
    """
    Send a message to the AI Trading Assistant.
    Uses ADK if available, falls back to Gemini GenAI SDK.
    """
    try:
        # Try ADK first if available
        if ADK_AVAILABLE:
            try:
                runner = get_agent_runner()
                result = runner.run(
                    input_text=req.message,
                    session_id=req.session_id
                )
                
                response_text = ""
                if hasattr(result, "text"):
                    response_text = result.text
                elif isinstance(result, str):
                    response_text = result
                elif isinstance(result, dict) and "text" in result:
                    response_text = result["text"]
                else:
                    response_text = str(result)
                    
                return ChatResponse(response=response_text, tool_calls=[])
            except Exception as e:
                print(f"ADK failed, falling back to GenAI: {e}")
        
        # Fallback to Gemini GenAI SDK
        if GENAI_AVAILABLE:
            response_text = await chat_with_gemini(
                req.message, 
                req.current_workspace
            )
            return ChatResponse(response=response_text, tool_calls=[])
        
        raise HTTPException(
            status_code=500, 
            detail="No AI backend available. Install google-genai or google-adk."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat Error: {str(e)}")

@router.get("/status")
async def get_agent_status():
    return {
        "status": "active", 
        "agent": "Trading Assistant",
        "backend": "ADK" if ADK_AVAILABLE else ("GenAI" if GENAI_AVAILABLE else "None"),
        "model": "gemini-3-flash-preview"
    }
