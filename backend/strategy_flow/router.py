"""
Strategy Flow API Router

Handles all API endpoints for the Strategy Flow visual strategy builder.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import json
import os
from datetime import datetime

router = APIRouter(prefix="/api/strategy-flow", tags=["strategy-flow"])


# ============================================================
# Request/Response Models
# ============================================================

class FlowNode(BaseModel):
    id: str
    type: str
    position: Dict[str, float]
    data: Dict[str, Any]


class FlowEdge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None


class GenerateFlowRequest(BaseModel):
    """Request to generate a flow strategy from natural language."""
    message: str
    currentNodes: Optional[List[Dict[str, Any]]] = None
    currentEdges: Optional[List[Dict[str, Any]]] = None
    mode: str = "fast"  # "fast" or "slow"


class GenerateFlowResponse(BaseModel):
    """Response containing generated flow configuration."""
    success: bool
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    message: Optional[str] = None
    wasRationalized: bool = False
    autoFixed: bool = False
    errors: List[str] = []
    warnings: List[str] = []


class ChatRequest(BaseModel):
    """Request for conversational chat about strategies."""
    message: str
    currentNodes: Optional[List[Dict[str, Any]]] = None
    currentEdges: Optional[List[Dict[str, Any]]] = None
    sessionId: Optional[str] = None


class ChatResponse(BaseModel):
    """Response from chat endpoint."""
    response: str
    sessionId: Optional[str] = None


class ValidateFlowRequest(BaseModel):
    """Request to validate a flow configuration."""
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    settings: Optional[Dict[str, Any]] = None


class ValidateFlowResponse(BaseModel):
    """Validation result response."""
    isValid: bool
    errors: List[str] = []
    warnings: List[str] = []


class CompileFlowRequest(BaseModel):
    """Request to compile flow to Python code."""
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    settings: Optional[Dict[str, Any]] = None
    target: str = "backtrader"  # "backtrader" or "backtesting.py"


class CompileFlowResponse(BaseModel):
    """Compiled code response."""
    success: bool
    code: str
    target: str
    errors: List[str] = []


class BacktestRequest(BaseModel):
    """Request to run a backtest."""
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    symbol: str = "BTCUSDT"
    startDate: str = Field(default_factory=lambda: "2024-01-01")
    endDate: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))
    initialCapital: float = 10000.0
    positionSize: float = 10.0  # Percentage
    commission: float = 0.1  # Percentage
    slippage: float = 0.05  # Percentage
    leverage: int = 1
    timeframe: str = "1d"


class BacktestResponse(BaseModel):
    """Backtest results response."""
    success: bool
    metrics: Optional[Dict[str, Any]] = None
    trades: Optional[List[Dict[str, Any]]] = None
    equityCurve: Optional[List[Dict[str, Any]]] = None
    visualizationHtml: Optional[str] = None
    error: Optional[str] = None


class LiveTradingRequest(BaseModel):
    """Request to start/manage live trading."""
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    symbol: str
    apiKey: str
    apiSecret: str
    testnet: bool = True
    positionSize: float = 1.0  # Percentage of balance


class LiveTradingResponse(BaseModel):
    """Live trading status response."""
    success: bool
    status: str  # "running", "stopped", "error"
    message: Optional[str] = None
    positions: Optional[List[Dict[str, Any]]] = None
    orders: Optional[List[Dict[str, Any]]] = None


# ============================================================
# Endpoints
# ============================================================

@router.post("/generate", response_model=GenerateFlowResponse)
async def generate_flow(req: GenerateFlowRequest):
    """
    Generate a Strategy Flow configuration from natural language.
    
    Uses LLM to interpret the user's intent and generate appropriate
    nodes and edges that can be loaded into the ReactFlow canvas.
    """
    try:
        from .ai_generator import generate_flow_strategy
        
        result = await generate_flow_strategy(
            prompt=req.message,
            current_nodes=req.currentNodes,
            current_edges=req.currentEdges,
            mode=req.mode
        )
        
        return GenerateFlowResponse(
            success=True,
            nodes=result.get("nodes", []),
            edges=result.get("edges", []),
            message=result.get("message"),
            wasRationalized=result.get("wasRationalized", False),
            autoFixed=result.get("autoFixed", False),
            warnings=result.get("warnings", [])
        )
        
    except Exception as e:
        return GenerateFlowResponse(
            success=False,
            errors=[str(e)]
        )


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    Conversational chat endpoint for Q&A about strategies.
    
    Answers questions about trading concepts, explains the current
    strategy, and provides suggestions without modifying the flow.
    """
    try:
        from .ai_generator import chat_about_strategy
        
        response = await chat_about_strategy(
            message=req.message,
            current_nodes=req.currentNodes,
            current_edges=req.currentEdges,
            session_id=req.sessionId
        )
        
        return ChatResponse(
            response=response.get("response", ""),
            sessionId=response.get("sessionId")
        )
        
    except Exception as e:
        return ChatResponse(
            response=f"Sorry, I encountered an error: {str(e)}"
        )


@router.post("/validate", response_model=ValidateFlowResponse)
async def validate_flow_endpoint(req: ValidateFlowRequest):
    """
    Validate a flow configuration.
    
    Checks for:
    - Required node types (indicator/environment + action)
    - Connection type compatibility
    - Required inputs are connected
    - No invalid cycles
    - Parameter validation
    """
    try:
        from .validator import validate_flow
        
        result = validate_flow(
            nodes=req.nodes,
            edges=req.edges,
            settings=req.settings
        )
        
        return ValidateFlowResponse(
            isValid=result.is_valid,
            errors=result.errors,
            warnings=result.warnings
        )
        
    except Exception as e:
        return ValidateFlowResponse(
            isValid=False,
            errors=[str(e)]
        )


@router.post("/compile", response_model=CompileFlowResponse)
async def compile_flow(req: CompileFlowRequest):
    """
    Compile flow nodes and edges to executable Python code.
    
    Supports multiple targets:
    - backtrader: For backtesting and live trading
    - backtesting.py: For backtesting.py library
    """
    try:
        from .backtrader_engine import compile_to_backtrader
        
        if req.target == "backtrader":
            code = compile_to_backtrader(req.nodes, req.edges, req.settings)
        else:
            # Fallback to backtesting.py format
            from flow.compiler import compile_flow_strategy
            result = compile_flow_strategy(req.nodes, req.edges, req.settings)
            code = result.python_code
        
        return CompileFlowResponse(
            success=True,
            code=code,
            target=req.target
        )
        
    except Exception as e:
        return CompileFlowResponse(
            success=False,
            code="",
            target=req.target,
            errors=[str(e)]
        )


@router.post("/backtest", response_model=BacktestResponse)
async def run_backtest_endpoint(req: BacktestRequest):
    """
    Run a backtest using backtrader.
    
    Compiles the flow to a backtrader strategy, fetches historical data,
    runs the backtest, and returns comprehensive results.
    """
    try:
        from .backtrader_engine import run_backtest
        
        result = run_backtest(
            nodes=req.nodes,
            edges=req.edges,
            symbol=req.symbol,
            start_date=req.startDate,
            end_date=req.endDate,
            initial_capital=req.initialCapital,
            position_size=req.positionSize,
            commission=req.commission / 100,  # Convert percentage
            slippage=req.slippage / 100,
            leverage=req.leverage,
            timeframe=req.timeframe
        )
        
        return BacktestResponse(
            success=True,
            metrics=result.get("metrics"),
            trades=result.get("trades"),
            equityCurve=result.get("equity_curve"),
            visualizationHtml=result.get("visualization_html")
        )
        
    except Exception as e:
        return BacktestResponse(
            success=False,
            error=str(e)
        )


@router.post("/live/start", response_model=LiveTradingResponse)
async def start_live_trading(req: LiveTradingRequest, background_tasks: BackgroundTasks):
    """
    Start live trading with a broker.
    
    Currently supports Binance (spot and futures).
    Use testnet=True for paper trading.
    """
    try:
        from .live_executor import start_live_execution
        
        # Start live trading in background
        result = await start_live_execution(
            nodes=req.nodes,
            edges=req.edges,
            symbol=req.symbol,
            api_key=req.apiKey,
            api_secret=req.apiSecret,
            testnet=req.testnet,
            position_size=req.positionSize
        )
        
        return LiveTradingResponse(
            success=True,
            status="running",
            message=f"Live trading started for {req.symbol}"
        )
        
    except Exception as e:
        return LiveTradingResponse(
            success=False,
            status="error",
            message=str(e)
        )


@router.post("/live/stop", response_model=LiveTradingResponse)
async def stop_live_trading():
    """
    Stop all live trading.
    
    Closes all open positions and cancels pending orders.
    """
    try:
        from .live_executor import stop_live_execution
        
        await stop_live_execution()
        
        return LiveTradingResponse(
            success=True,
            status="stopped",
            message="Live trading stopped"
        )
        
    except Exception as e:
        return LiveTradingResponse(
            success=False,
            status="error",
            message=str(e)
        )


@router.get("/live/status", response_model=LiveTradingResponse)
async def get_live_status():
    """
    Get current live trading status.
    
    Returns active positions, recent orders, and system status.
    """
    try:
        from .live_executor import get_status
        
        status = await get_status()
        
        return LiveTradingResponse(
            success=True,
            status=status.get("status", "stopped"),
            positions=status.get("positions"),
            orders=status.get("orders")
        )
        
    except Exception as e:
        return LiveTradingResponse(
            success=False,
            status="error",
            message=str(e)
        )


@router.get("/node-definitions")
async def get_node_definitions():
    """
    Return the complete node definitions JSON.
    
    Used by AI generator to understand available nodes and their structure.
    """
    try:
        # Try to load from frontend data file
        frontend_path = os.path.join(
            os.path.dirname(__file__),
            "../../src/features/strategy-flow/data/nodeDefinitions.json"
        )
        
        if os.path.exists(frontend_path):
            with open(frontend_path, "r") as f:
                return json.load(f)
        
        # Fallback to embedded definitions
        return {"nodes": {}, "version": "1.0.0"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates")
async def get_flow_templates():
    """
    Return pre-built strategy flow templates.
    """
    templates = [
        {
            "id": "rsi_reversal",
            "name": "RSI Reversal",
            "description": "Buy when RSI < 30, sell when RSI > 70",
            "category": "Mean Reversion",
            "difficulty": "Beginner"
        },
        {
            "id": "ma_crossover",
            "name": "Moving Average Crossover",
            "description": "Buy when fast EMA crosses above slow EMA",
            "category": "Trend Following",
            "difficulty": "Beginner"
        },
        {
            "id": "bollinger_breakout",
            "name": "Bollinger Band Breakout",
            "description": "Trade breakouts from Bollinger Bands",
            "category": "Volatility",
            "difficulty": "Intermediate"
        },
        {
            "id": "macd_momentum",
            "name": "MACD Momentum",
            "description": "Trade MACD signal line crossovers",
            "category": "Momentum",
            "difficulty": "Intermediate"
        }
    ]
    
    return {"templates": templates}


@router.get("/status")
async def get_status():
    """
    Health check for the Strategy Flow API.
    """
    return {
        "status": "active",
        "version": "2.0.0",
        "features": [
            "generate",
            "chat",
            "validate",
            "compile",
            "backtest",
            "live-trading"
        ],
        "engine": "backtrader"
    }
