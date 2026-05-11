"""
Local Python Backend for Strategy Generation using DeepSeek API

This backend provides the same functionality as the Supabase Edge Functions
but uses DeepSeek API instead of Gemini.

Run with: uvicorn main:app --reload --port 8000
"""

import os
import re
import json
import httpx
import asyncio
from google import genai
from typing import List, Optional, Dict, Any, Tuple
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from datetime import datetime
from pathlib import Path

# RAG & GCG Imports
from rag_system import block_library
from vector_rag import get_vector_rag, two_stage_retrieve, STRATEGY_TYPES
# from strategy_compiler import strategy_compiler
# from backtest_service import XML_TO_PYTHON_PROMPT, run_backtest_pipeline, validate_nautilus_code
from backtest_runner import run_backtest, run_backtest_simple
from strategy_store import hash_xml, save_strategy_version, load_by_id, load_latest_by_hash
# from ai_strategy_reviewer import review_strategy
import local_database as database # Local DB module
from routers import live_trading # Live Trading Router
from risk_controls import PanicService

# Google ADK Agent (Moved to agent_service.py)
# from google.adk.runners import Runner
# from google.adk.sessions import InMemorySessionService
# from adk_agents.trading_agent import trading_agent

# Logging
from llm_logger import (
    log_llm_call, log_conversion, log_backtest, 
    log_strategy_generation, log_general, log_error, 
    log_api_request, get_log_stats
)

# Initialize ADK session service (Refactored)
# See backend/agent_service.py

# Load environment variables
load_dotenv()

# Initialize Database
try:
    database.init_db()
except Exception as e:
    print(f"DB Init Error: {e}")

# Start Market Data Scheduler (auto-refresh every 5 minutes).
# Skip in desktop mode — many users on residential IPs hammering yfinance every
# 5 min trips rate limits and isn't useful for a single-user desktop session.
if os.environ.get("OPENQWNT_DESKTOP_MODE") != "true":
    try:
        from market_data_scheduler import start_scheduler
        start_scheduler()
    except Exception as e:
        print(f"Warning: Market data scheduler failed to start: {e}")
else:
    print("[desktop] Market data scheduler disabled (OPENQWNT_DESKTOP_MODE=true)")

# ============================================================
# LLM PROVIDER CONFIGURATION
# ============================================================
# Set USE_DEEPSEEK_ONLY = True to use DeepSeek for ALL LLM calls
# Set USE_DEEPSEEK_ONLY = False to use DeepSeek + Gemini (default)
#
# When True:
#   - Gemini calls are replaced with DeepSeek
#   - All verification uses DeepSeek
#   - Useful for testing/cost control
# When False:
#   - Uses DeepSeek for code generation/fixing
#   - Uses Gemini for verification (via Lovable)
# ============================================================

USE_DEEPSEEK_ONLY = False  # <-- CHANGE THIS TO SWITCH MODES

# ============================================================
# DeepSeek Model Configuration
# ============================================================
# Comment/uncomment to switch between models:

# DEEPSEEK_MODEL = "deepseek-reasoner"     # Reasoning model - better for complex logic
DEEPSEEK_MODEL = "deepseek-chat"       # Fast, cheaper - good for code generation (TESTING)

# ============================================================
# Gemini Model Configuration  
# ============================================================
# Available models (updated 2026-03-29):
# - gemini-3.1-pro-preview (latest, best capability)
# - gemini-3.1-flash-lite-preview (latest, lightweight)
# - gemini-3-flash-preview (fast preview)
# - gemini-2.5-pro (stable, strong capability)
# - gemini-2.5-flash (stable, fast)
GEMINI_MODEL = "gemini-2.5-pro"  # Best capability with large context window

# Primary LLM Provider: "gemini" or "deepseek"
# This determines which model is used for strategy generation
PRIMARY_LLM = "gemini"  # <-- Using working Gemini Flash model

# ============================================================
# RAG + GCG Prompts
# ============================================================

RAG_ROUTER_PROMPT = """You are a Trading Strategy Architect. Identify the building blocks needed.

AVAILABLE BLOCKS:
{available_blocks}

USER REQUEST: "{user_request}"

TASK: Select the MINIMUM block types needed. Always include:
- 'trade_order' for any buy/sell action
- Comparison operators (operator_less, operator_greater) for conditions
- The specific indicator mentioned (ta_rsi, ta_sma, ta_ema, etc.)

OUTPUT: JSON array of block type strings only.
Example: ["ta_rsi", "operator_less", "trade_order"]"""

GCG_PLANNER_PROMPT = """You are a Trading Strategy Planner. Create a structured execution plan.

USER REQUEST: "{user_request}"
AVAILABLE BLOCKS:
{block_list}

CREATE A JSON PLAN using this schema:
{{
    "timeframe": 60,
    "variables": [
        {{"id": "rsi", "type": "ta_rsi", "params": {{"period": 14, "timeframe": 60}}}}
    ],
    "entry_conditions": [
        {{"operator": "operator_less", "left": "rsi", "right": 30}}
    ],
    "exit_conditions": [
        {{"operator": "operator_greater", "left": "rsi", "right": 70}}
    ],
    "entry_action": {{
        "direction": "long",
        "size": 0.1,
        "sl_pips": 50,
        "tp_pips": 100
    }},
    "exit_action": {{
        "type": "close_all"
    }}
}}

RULES:
1. Use ONLY block types from AVAILABLE BLOCKS
2. "left"/"right" can be a variable ID (string) or number
3. "operator" must be: operator_less, operator_greater, operator_less_equals, operator_greater_equals
4. Common indicator params: period (14), timeframe (60 = 1 hour)
5. If user mentions "cross above" = operator_greater, "cross below" = operator_less
6. sl_pips/tp_pips are optional, omit if not specified
7. CRITICAL GRAMMAR RULE: NEVER compare two identical indicators (same type AND same params).
   - WRONG: SMA(period=14) > SMA(period=14) - makes no sense
   - CORRECT: SMA(period=10) > SMA(period=20) - Fast vs Slow
   - For crossovers, use different periods: Fast (shorter) vs Slow (longer)
   - Default Fast/Slow: SMA(10/20), EMA(12/26), RSI(7/14)
8. CRITICAL GRAMMAR RULE: SCALE COMPATIBILITY
   - NEVER compare Price (SMA, EMA, BB, Price) with Oscillators (RSI, Stoch, 0-100).
   - WRONG: Price > RSI (e.g. 1.0500 > 30) - impossible
   - WRONG: SMA > Stoch
   - CORRECT: RSI > 30 (Oscillator vs Level)
   - CORRECT: Price > SMA (Price vs Price)
   - CORRECT: SMA(10) > SMA(20) (Price vs Price)

9. CRITICAL GRAMMAR RULE: TYPE SAFETY
   - Comparison operators (<, >, =) need NUMBERS on both sides.
   - WRONG: (RSI > 30) > 50 (Boolean > Number)
   - WRONG: (SMA > EMA) AND (RSI) (Boolean AND Number)
   - CORRECT: (RSI > 30) AND (SMA > EMA) (Boolean AND Boolean)

OUTPUT: Valid JSON only, no markdown."""


app = FastAPI(
    title="StrategyFlow Compute Service",
    version="2.0.0",
    description="Internal compute service — called by the Node.js orchestrator, not by the frontend directly.",
)

# Deprecation middleware: tag legacy user-facing routes with a warning header
# so consumers know to migrate to the orchestrator API.
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response

class DeprecationMiddleware(BaseHTTPMiddleware):
    """Adds Deprecation header to all non-/compute endpoints."""
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        path = request.url.path
        if not path.startswith("/compute") and path != "/health":
            response.headers["Deprecation"] = "true"
            response.headers["Sunset"] = "2026-06-01"
            response.headers["X-Deprecation-Notice"] = (
                "This endpoint is deprecated. Use the Node.js orchestrator API at port 3000 instead."
            )
        return response

app.add_middleware(DeprecationMiddleware)

# Include Live Trading Router
app.include_router(live_trading.router)
from routers import trade_history
app.include_router(trade_history.router)
from routers import data_export
app.include_router(data_export.router)
from routers import templates
app.include_router(templates.router)
from routers import health
app.include_router(health.router)
from routers import symbols
from routers import symbols
app.include_router(symbols.router)
from routers import agent_chat
app.include_router(agent_chat.router)
from routers import strategies_v2
from routers import strategies_v2
app.include_router(strategies_v2.router)
from routers import mcpt
app.include_router(mcpt.router)
from routers import strategy_flow
app.include_router(strategy_flow.router)
# New Strategy Flow v2 module with backtrader
from strategy_flow.router import router as strategy_flow_v2_router
app.include_router(strategy_flow_v2_router)

# Compute-only endpoints for orchestrator
from routers.compute import router as compute_router
app.include_router(compute_router)

# Agent runner endpoints for orchestrator
from routers.agent_runner import router as agent_runner_router
app.include_router(agent_runner_router)

from routers.portfolio import router as portfolio_router
app.include_router(portfolio_router)

from routers import news
app.include_router(news.router)

from routers.adk_web import router as adk_web_router
app.include_router(adk_web_router)

from routers.ai_assistant import router as ai_assistant_router
app.include_router(ai_assistant_router)

# Terminal-function real-data router (HDS / DES / GIP / SPLC / WEI)
from routers.terminal_data import router as terminal_data_router
app.include_router(terminal_data_router)

# Live agent runtime (REST + WebSocket) — Phase B
from routers import agent_live
app.include_router(agent_live.router)

# Canonical backtest API — Phase D
from routers import backtest as backtest_router
app.include_router(backtest_router.router)

# Sandbox + dynamic tools — Phase G
from routers import tools as tools_router
app.include_router(tools_router.router)

# Live execution path (paper / Alpaca) — Phase H
from routers import execution as execution_router
app.include_router(execution_router.router)

# Strategy self-improvement loop — Phase I
from routers import improvement as improvement_router
app.include_router(improvement_router.router)

# Telemetry counters — Phase J3
from routers import telemetry as telemetry_router
app.include_router(telemetry_router.router)
import telemetry as _telemetry
_telemetry.hook_into_context()

# Boss orchestration (REST + WebSocket) — Phase C
from routers import boss as boss_router
app.include_router(boss_router.router)

# Voice — Twilio / browser WebRTC / iOS / SIP bridges to Gemini Live
try:
    from routers import voice as voice_router
    app.include_router(voice_router.router)
except Exception as _e:
    print(f"Warning: voice router failed to load: {_e}")

# iOS standard (non-VoIP) push notifications for trade/risk/strategy alerts
try:
    from routers import ios_push as ios_push_router
    app.include_router(ios_push_router.router)
except Exception as _e:
    print(f"Warning: ios_push router failed to load: {_e}")

# Equity research — DCF valuation, fundamentals snapshot, ad-hoc case studies
try:
    from routers import equity_research as equity_research_router
    app.include_router(equity_research_router.router)
except Exception as _e:
    print(f"Warning: equity_research router failed to load: {_e}")

# External integrations (Avanza first; Nordnet/IBKR later)
try:
    from routers import integrations as integrations_router
    app.include_router(integrations_router.router)
except Exception as _e:
    print(f"Warning: integrations router failed to load: {_e}")

# Realtime / public-API proxies (USGS, NOAA, OpenSky, EIA, OpenAQ, AISStream)
try:
    from routers import realtime as realtime_router
    app.include_router(realtime_router.router)
except Exception as _e:
    print(f"Warning: realtime router failed to load: {_e}")


# ============================================================
# Root-level health and custom-blocks endpoints
# ============================================================
@app.get("/health")
async def root_health_check():
    """Root-level health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/custom-blocks")
async def get_custom_blocks():
    """Return custom blocks (empty for now - can be extended later)."""
    return {"blocks": []}


@app.post("/api/panic")
async def trigger_panic_endpoint():
    """
    Global Panic Button: Immediately halts trading and closes positions.
    """
    result = await PanicService.trigger_panic()
    return result


class ExportRequest(BaseModel):
    format: str  # "python", "json", "markdown", "pinescript"
    workspaceXml: str


@app.post("/api/export")
async def export_strategy(req: ExportRequest):
    """
    Export strategy to various formats (Python, JSON, Markdown, Pine Script).
    """
    from strategy_exporter import StrategyExporter
    from xml_evaluator import xml_to_strategy_ir  # We need to create this bridge

    try:
        # Parse XML to IR (placeholder - in a real impl, parse Blockly XML to IR)
        # For now, we'll create a dummy IR if no proper parser exists
        from strategy_ir import StrategyIR, Rule, Condition, MarketComponent, ActionType, ComparisonOperator, PositionSizing

        # TODO: Implement proper XML to IR parsing.
        # For now, create a placeholder IR from XML
        ir = StrategyIR(
            name="Exported Strategy",
            timeframe="1d",
            position_sizing=PositionSizing(),
            rules=[]
        )

        exporter = StrategyExporter()

        if req.format == "python":
            content = exporter.export_python(ir)
            return {"success": True, "content": content, "filename": "strategy.py"}
        elif req.format == "json":
            content = exporter.export_json(ir)
            return {"success": True, "content": content, "filename": "strategy.json"}
        elif req.format == "markdown":
            content = exporter.export_markdown(ir)
            return {"success": True, "content": content, "filename": "strategy.md"}
        elif req.format == "pinescript":
            content = exporter.export_pinescript(ir)
            return {"success": True, "content": content, "filename": "strategy.pine"}
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {req.format}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# CORS configuration — restricted to orchestrator and internal Docker network
# Frontend should NEVER call the Python backend directly; always go through the orchestrator.
# Exception: desktop builds load the renderer from app:// or file:// (Origin: "null")
# and the backend binds 127.0.0.1, so allow-all is safe there.
ALLOWED_ORIGINS = [
    os.getenv("ORCHESTRATOR_URL", "http://localhost:3000"),
    "http://openqwnt-orchestrator:3000",   # Docker internal
    "http://orchestrator:3000",            # Docker service name
    "http://localhost:5173",               # Allow frontend in dev for backwards compat
    "app://localhost",                     # Electron custom protocol
    "null",                                # file:// renderer
]

if os.environ.get("OPENQWNT_DESKTOP_MODE") == "true":
    _cors_kwargs = dict(allow_origins=["*"], allow_credentials=False)
else:
    _cors_kwargs = dict(allow_origins=ALLOWED_ORIGINS, allow_credentials=True)

app.add_middleware(
    CORSMiddleware,
    allow_methods=["*"],
    allow_headers=["*"],
    **_cors_kwargs,
)

# Log LLM configuration on startup
@app.on_event("startup")
async def log_llm_config():
    print("=" * 60)
    print("LLM CONFIGURATION")
    print("=" * 60)
    print(f"  USE_DEEPSEEK_ONLY: {USE_DEEPSEEK_ONLY}")
    print(f"  DEEPSEEK_MODEL: {DEEPSEEK_MODEL}")
    print(f"  USE_RAG_FOR_BLOCKS: {USE_RAG_FOR_BLOCKS}")
    if USE_DEEPSEEK_ONLY:
        print("  ⚠️  ALL LLM calls will use DeepSeek (Gemini disabled)")
    else:
        print("  ✓ Using DeepSeek + Gemini (normal mode)")
    if USE_RAG_FOR_BLOCKS:
        print("  ✓ RAG Mode: Selective block retrieval enabled")
    else:
        print("  ✓ All Blocks Mode: Full block reference sent to LLM")
    print("=" * 60)

# DeepSeek API configuration
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"

# ============================================================
# RAG CONFIGURATION
# ============================================================
# Toggle between RAG (selective blocks) and ALL BLOCKS mode
# Set USE_RAG_FOR_BLOCKS=true in .env to enable RAG
# Default: False (send all blocks to LLM for guaranteed coverage)
USE_RAG_FOR_BLOCKS = os.getenv("USE_RAG_FOR_BLOCKS", "false").lower() == "true"

# Lazy load VectorRAG to avoid startup overhead if not used
_vector_rag = None
_block_library = None

def get_rag_system():
    """Lazy load RAG system components."""
    global _vector_rag, _block_library
    if _vector_rag is None:
        from vector_rag import get_vector_rag, VectorRAG
        from rag_system import block_library
        _vector_rag = get_vector_rag()
        _block_library = block_library
        print("[RAG] Initialized VectorRAG and BlockLibrary")
    return _vector_rag, _block_library

async def get_rag_blocks(query: str, n_results: int = 20) -> str:
    """Retrieve relevant block reference using RAG."""
    vector_rag, block_library = get_rag_system()
    
    # Initialize if needed
    if not vector_rag.initialized:
        vector_rag.initialize()
    
    # Search for relevant blocks
    search_results = vector_rag.search_blocks(
        query=query,
        n_results=n_results,
        use_reranker=True
    )
    
    # Build block reference from search results
    block_xml_parts = []
    retrieved_types = set()
    
    for result in search_results:
        block_type = result["block_type"]
        if block_type not in retrieved_types:
            xml = block_library.get_block_xml(block_type)
            if xml:
                block_xml_parts.append(f"<!-- {block_type} -->\n{xml}")
                retrieved_types.add(block_type)
    
    # Always include core blocks
    core_blocks = ["control_forever", "control_if", "control_if_else", 
                   "trade_order", "trade_stop_loss", "trade_take_profit",
                   "environment_new_candle_open", "environment_price",
                   "operator_greater", "operator_less", "operator_and",
                   "math_number"]
    
    for core_block in core_blocks:
        if core_block not in retrieved_types:
            xml = block_library.get_block_xml(core_block)
            if xml:
                block_xml_parts.append(f"<!-- {core_block} (core) -->\n{xml}")
                retrieved_types.add(core_block)
    
    print(f"[RAG] Retrieved {len(retrieved_types)} blocks for query: {query[:50]}...")
    return "\n\n".join(block_xml_parts)


class StrategyRequest(BaseModel):
    message: str
    existingXml: Optional[str] = None
    blockXml: Optional[str] = None  # Added for context from attached blocks
    use_rag: bool = False
    ai_model: str = "deepseek"


class StrategyResponse(BaseModel):
    xml: str
    ai_fixed: bool = Field(default=False, serialization_alias="autoFixed")
    was_rationalized: bool = Field(default=False, serialization_alias="wasRationalized")
    code: Optional[str] = None
    code_language: Optional[str] = None
    strategy_id: Optional[str] = None


class MqlRequest(BaseModel):
    workspaceXml: str
    strategyName: Optional[str] = "Trading Strategy"


class MqlResponse(BaseModel):
    mqlCode: str
    analysis: dict


class BacktestRequest(BaseModel):
    workspaceXml: str
    symbol: str = "EURUSD"
    startDate: str = "2024-01-01"
    endDate: str = "2024-03-31"
    initialBalance: float = 100000.0
    tradeSize: int = 100000
    leverage: float = 1.0  # Account leverage multiplier (1.0 = no leverage, 10.0 = 10:1, etc.)
    engine: str = "backtesting.py"  # "backtesting.py" (recommended), "rust" (fastest), "nautilus" (institutional)
    optimize: bool = False
    opt_metric: str = "Return [%]"
    opt_method: str = "grid"
    ai_model: str = "deepseek"
    use_llm: bool = True
    data_source: str = "alphavantage"  # "local" (database), "alphavantage", or "yfinance"
    interval: str = "1d"  # "1d" (daily) or "1h" (hourly)
    generatedCode: Optional[str] = None
    codeLanguage: Optional[str] = None
    strategyId: Optional[str] = None
    templateId: Optional[str] = None  # Pre-built template ID (e.g., "rsi-oversold-reversal")
    precompiledCode: Optional[str] = None  # Pre-generated code (e.g., from nautilusGenerator)

class VerifyRequest(BaseModel):
    xml: str
    python_code: Optional[str] = None  # Added for code-level verification

class VerifyResponse(BaseModel):
    valid: bool
    issues: List[str]


class BacktestResponse(BaseModel):
    success: bool
    symbol: str
    start_date: str
    end_date: str
    initial_balance: float = 10000
    final_balance: Optional[float] = None
    # Optimization results
    best_params: Optional[Dict[str, Any]] = None
    best_metric_value: Optional[float] = None
    params_tested: Optional[Dict[str, str]] = None
    metrics: dict
    trades: list
    equity_curve: list
    visualization_html: Optional[str] = None
    raw_stats: Optional[str] = None


class IGLoginRequest(BaseModel):
    api_key: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


class IGPositionRequest(BaseModel):
    epic: str
    direction: str  # "BUY" or "SELL"
    size: float = 0.5
    stop_distance: Optional[float] = None
    limit_distance: Optional[float] = None


class IGSymbolRequest(BaseModel):
    symbol: str  # e.g., "EURUSD"
    direction: str  # "BUY" or "SELL"
    size: float = 0.5


class ScreeningRequest(BaseModel):
    symbols: List[str]
    filter: str  # "uptrend_sma200", "rsi_oversold", etc.
    days_back: int = 365


class GenerateStrategyRequest(BaseModel):
    message: str
    currentWorkspace: Optional[str] = None
    blockXml: Optional[str] = None
    mode: str = "fast"  # "fast" or "slow"


# ============================================================
# GENERATE STRATEGY ENDPOINT
# ============================================================

@app.post("/generate-strategy")
async def generate_strategy(req: GenerateStrategyRequest):
    """
    Generate a Blockly XML strategy from natural language.
    This is the main AI-powered strategy generation endpoint.
    """
    import time
    start_time = time.time()
    
    try:
        # Log request details (matching original edge function)
        block_count = len(re.findall(r'<block ', req.currentWorkspace or ''))
        workspace_size_kb = len(req.currentWorkspace or '') / 1024
        print(f"Generating strategy for: {req.message[:100]}...")
        print(f"Has existing workspace: {bool(req.currentWorkspace)} ({block_count} blocks, {workspace_size_kb:.1f}KB)")
        print(f"Has specific block attached: {bool(req.blockXml)}")
        print(f"Is modification request: {bool(req.currentWorkspace)}")
        
        # Determine which block reference to use and build system prompt
        if USE_RAG_FOR_BLOCKS:
            # Use RAG-retrieved blocks (subset based on query)
            block_ref = await get_rag_blocks(req.message, n_results=25)
            system_prompt = SYSTEM_PROMPT_TEMPLATE.replace("{{BLOCK_REFERENCE}}", block_ref)
            print(f"[RAG] Using {len(block_ref)} chars of selective block reference")
        else:
            # Use full block reference (matches original edge function behavior)
            system_prompt = SYSTEM_PROMPT
            print(f"[FULL] Using complete block reference ({len(BLOCK_REFERENCE)} chars)")
        
        # Build user message - MUST match original Supabase edge function format
        if req.currentWorkspace:
            # Modification request - matches original edge function
            user_message = f"""Here is my current trading strategy workspace:

{req.currentWorkspace}

Please modify it according to this request: {req.message}

IMPORTANT: You MUST only use blocks from the list provided in the system prompt. Do not invent new blocks. Return ONLY the complete updated XML wrapped in <xml></xml> tags. No explanations."""
        else:
            # New strategy request - matches original edge function with step-by-step thinking
            user_message = f"""Generate Blockly XML for this trading strategy: {req.message}

IMPORTANT: You MUST only use the blocks listed in the system prompt. Do not invent new blocks. Return ONLY the XML wrapped in <xml></xml> tags. No explanations.

BEFORE GENERATING XML, THINK STEP-BY-STEP:
1. What is the requested timeframe? (Set 'period' attribute to this value in minutes, e.g., 60 for 1h)
2. What is the trade size? (Set 'SIZE' to 0.1 unless specified)
3. What indicators are needed?"""
        
        # Add context from attached block (matches original edge function)
        if req.blockXml:
            user_message += f"\n\nThe user has shared a specific Blockly block with you. Here is the XML structure:\n\n{req.blockXml}\n\nPlease focus on this block when generating or modifying the strategy."
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        
        # Call LLM based on configuration, with fallback to DeepSeek if Gemini overloaded
        if PRIMARY_LLM == "gemini":
            try:
                response_text = await call_gemini(messages, temperature=0.3)
            except HTTPException as e:
                if e.status_code == 503:
                    print("[LLM] Gemini overloaded, falling back to DeepSeek...")
                    response_text = await call_deepseek(messages, temperature=0.3)
                else:
                    raise
        else:
            response_text = await call_deepseek(messages, temperature=0.3)
        
        # Extract XML from response
        xml_content = extract_xml(response_text)
        
        if not xml_content:
            raise HTTPException(status_code=400, detail="Failed to generate valid XML")
        
        # Apply common fixes
        xml_content = apply_common_fixes(xml_content)
        
        # Validate XML structure
        is_valid, issues = validate_xml_structure(xml_content)
        
        # Check for crossover issues
        crossover_valid, crossover_issues = check_crossover_valid(xml_content)
        
        # Check for scale compatibility issues
        scale_valid, scale_issues = check_scale_compatibility(xml_content)
        if not scale_valid:
            print(f"[VALIDATION] Scale compatibility warnings: {scale_issues}")
            issues.extend(scale_issues)
        
        # Check for duplicate TRADE_IDs
        trade_id_valid, trade_id_issues = check_duplicate_trade_ids(xml_content)
        if not trade_id_valid:
            print(f"[VALIDATION] Duplicate TRADE_ID warnings: {trade_id_issues}")
            issues.extend(trade_id_issues)
        
        was_rationalized = False
        
        # Fix crossover issues if found
        if not crossover_valid:
            xml_content, was_fixed = fix_crossover_indicators(xml_content)
            if was_fixed:
                was_rationalized = True
        
        # Log generated XML details (matching original edge function)
        generated_block_count = len(re.findall(r'<block ', xml_content))
        print(f"Generated XML validated: {generated_block_count} blocks, {len(xml_content)} chars")
        print(f"XML preview: {xml_content[:200]}...")
        
        # For slow mode, run rationalization pass
        if req.mode == "slow" and is_valid:
            try:
                rationalize_messages = [
                    {"role": "system", "content": RATIONALIZATION_PROMPT},
                    {"role": "user", "content": f"Review and optimize this strategy XML:\n\n{xml_content}"}
                ]
                
                rationalized_response = await call_deepseek(rationalize_messages, temperature=0.2)
                rationalized_xml = extract_xml(rationalized_response)
                
                if rationalized_xml:
                    rat_valid, _ = validate_xml_structure(rationalized_xml)
                    if rat_valid:
                        xml_content = rationalized_xml
                        was_rationalized = True
            except Exception as e:
                print(f"Rationalization failed (non-fatal): {e}")
        
        duration_ms = (time.time() - start_time) * 1000
        
        # Log successful generation
        log_strategy_generation(
            mode=req.mode,
            user_prompt=req.message[:200],
            generated_xml=xml_content[:500],
            ai_model=PRIMARY_LLM,
            duration_ms=duration_ms,
            success=True,
            ai_fixed=was_rationalized
        )
        
        return {
            "xml": xml_content,
            "autoFixed": not is_valid,
            "wasRationalized": was_rationalized,
            "issues": issues if not is_valid else []
        }
        
    except HTTPException:
        raise
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        log_error(e, "generate_strategy")
        log_strategy_generation(
            mode=req.mode,
            user_prompt=req.message[:200],
            generated_xml="",
            ai_model=PRIMARY_LLM,
            duration_ms=duration_ms,
            success=False,
            error=str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/screen")
async def screen_market(req: ScreeningRequest):
    """
    Screen the market for symbols matching criteria.
    """
    try:
        from market_screener import MarketScreener
        
        # Run in thread pool to avoid blocking asyncio loop
        loop = asyncio.get_event_loop()
        screener = MarketScreener()
        
        results = await loop.run_in_executor(
            None, 
            screener.screen, 
            req.symbols, 
            req.filter, 
            req.days_back
        )
        
        return {"success": True, "results": results}
    except Exception as e:
        log_error(e, "screen_market")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# LLM NODE EXECUTION ENDPOINT
# ============================================================

from llm_service import LLMNodeRequest, LLMNodeResponse, execute_llm_node

@app.post("/api/llm/execute", response_model=LLMNodeResponse)
async def execute_llm_node_endpoint(req: LLMNodeRequest):
    """
    Execute an LLM node for strategy flow.
    Supports multiple node types: sentiment analysis, regime detection, NL rules, etc.
    
    API keys are passed from the frontend (stored in browser localStorage).
    Alternatively, can use environment variables as fallback.
    """
    try:
        log_api_request("/api/llm/execute", {"nodeType": req.nodeType, "model": req.model})
        result = await execute_llm_node(req)
        return result
    except Exception as e:
        log_error(e, "execute_llm_node")
        return LLMNodeResponse(
            success=False,
            error=str(e),
            model=req.model,
            result=req.fallback
        )




# ============================================================
# BACKTEST ENDPOINT (Python Code)
# ============================================================

class BacktestPyCodeRequest(BaseModel):
    pythonCode: str
    symbol: str = "EURUSD"
    startDate: str = "2024-01-01"
    endDate: str = "2024-12-31"
    initialBalance: float = 10000.0
    commission: float = 0.001
    leverage: float = 1.0
    engine: str = "backtesting.py"


@app.post("/backtest-py-code")
async def backtest_py_code(req: BacktestPyCodeRequest):
    """
    Run backtest with pre-generated Python code.
    Used by Strategy Flow to test generated strategies.
    """
    import time
    start_time = time.time()
    
    try:
        # Run backtest with the provided Python code
        result = run_backtest(
            strategy_code=req.pythonCode,
            symbol=req.symbol,
            start_date=req.startDate,
            end_date=req.endDate,
            initial_balance=req.initialBalance,
            use_nautilus=False,  # Use backtesting.py for simplicity
        )
        
        duration_ms = (time.time() - start_time) * 1000
        
        if result.get("success"):
            metrics = result.get("metrics", {})
            log_backtest(
                symbol=req.symbol,
                engine=req.engine,
                period=f"{req.startDate} to {req.endDate}",
                duration_ms=duration_ms,
                success=True,
                trades=metrics.get("total_trades", 0),
                return_pct=metrics.get("return_pct", 0),
                full_metrics=metrics
            )
            
            return {
                "success": True,
                "metrics": result.get("metrics", {}),
                "final_balance": result.get("final_balance", req.initialBalance),
                "trades": result.get("trades", []),
                "equity_curve": result.get("equity_curve", []),
                "visualization_html": result.get("visualization_html"),
            }
        else:
            error_msg = result.get("error", "Unknown error")
            log_backtest(
                symbol=req.symbol,
                engine=req.engine,
                period=f"{req.startDate} to {req.endDate}",
                duration_ms=duration_ms,
                success=False,
                error=error_msg
            )
            raise HTTPException(status_code=400, detail=error_msg)
            
    except Exception as e:
        log_error(e, "backtest_py_code")
        raise HTTPException(status_code=500, detail=str(e))


class ReviewRequest(BaseModel):
    xml: str
    ai_model: str = "deepseek"


# ============================================================
# PROMPTS (copied from Supabase Edge Functions)
# ============================================================

# Load prompts from external files
PROMPTS_DIR = Path(__file__).parent / "prompts"

def load_prompt(filename: str, replacements: Optional[Dict[str, str]] = None) -> str:
    """Load a prompt file from the prompts directory and apply replacements."""
    try:
        if not PROMPTS_DIR.exists():
            print(f"Warning: Prompts directory not found at {PROMPTS_DIR}")
            return ""
        
        file_path = PROMPTS_DIR / filename
        if not file_path.exists():
            print(f"Warning: Prompt file {filename} not found at {file_path}")
            return ""
            
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        if replacements:
            for key, value in replacements.items():
                content = content.replace(f"{{{{{key}}}}}", value)
                
        return content
    except Exception as e:
        print(f"Error loading prompt {filename}: {e}")
        return ""

# Load block reference for full-blocks mode
BLOCK_REFERENCE = load_prompt("block_reference.txt")
# Load system prompt template (keep {{BLOCK_REFERENCE}} placeholder for runtime replacement)
SYSTEM_PROMPT_TEMPLATE = load_prompt("system_prompt.txt")
# Pre-build full system prompt for non-RAG mode
SYSTEM_PROMPT = SYSTEM_PROMPT_TEMPLATE.replace("{{BLOCK_REFERENCE}}", BLOCK_REFERENCE)
RATIONALIZATION_PROMPT = load_prompt("rationalization_prompt.txt", {"BLOCK_REFERENCE": BLOCK_REFERENCE})



# ============================================================
# VALIDATION UTILITIES
# ============================================================

def validate_xml_structure(xml: str) -> Tuple[bool, List[str]]:
    """Verify basic XML structure and required blocks."""
    issues = []
    
    # Check for root XML tags
    if not re.search(r'<xml[\s\S]*?>', xml) or not re.search(r'</xml>', xml):
        issues.append("Missing <xml>...</xml> root tags")
        
    # Check for at least one block
    if not re.search(r'<block', xml):
        issues.append("No blocks found in XML")
        
    # Check for required main loop
    if not re.search(r'type="control_forever"', xml):
        issues.append("High Severity: Missing 'control_forever' main loop block")
        
    # Check for basic tag balance (rough check)
    open_tags = len(re.findall(r'<block', xml))
    close_tags = len(re.findall(r'</block>', xml))
    if open_tags != close_tags:
        issues.append(f"Block tag mismatch: {open_tags} opened, {close_tags} closed")
        
    return (len(issues) == 0, issues)

def apply_common_fixes(xml: str) -> str:
    """Apply common programmatic fixes to XML."""
    fixed_xml = xml
    
    # 1. Fix Timeframes: "1h" -> "60", "4h" -> "240", "1d" -> "1440"
    timeframe_map = {
        '1m': '1', '5m': '5', '15m': '15', '30m': '30',
        '1h': '60', '4h': '240', '1d': '1440', '1w': '10080'
    }
    
    def replace_timeframe(match):
        tf = match.group(2)
        if tf in timeframe_map:
            return f'{match.group(1)}"{timeframe_map[tf]}"{match.group(3)}'
        return match.group(0)

    # Regex for TIMEFRAME fields
    fixed_xml = re.sub(r'(<field name="TIMEFRAME">)([^<]+)(</field>)', replace_timeframe, fixed_xml)
    # Regex for PERIOD fields (sometimes used)
    fixed_xml = re.sub(r'(<field name="PERIOD">)([^<]+)(</field>)', replace_timeframe, fixed_xml)
    
    # 2. Fix generic 'ta_ma' -> 'ta_sma' (common hallucination)
    fixed_xml = fixed_xml.replace('type="ta_ma"', 'type="ta_sma"')
    
    # 3. Fix 'ta_macd' -> 'macd_value' (common hallucination)
    fixed_xml = fixed_xml.replace('type="ta_macd"', 'type="macd_value"')
    
    return fixed_xml

def check_crossover_valid(xml: str) -> Tuple[bool, List[str]]:
    """Check for identical indicators in comparisons."""
    issues = []
    comparison_pattern = r'<block type="(operator_greater|operator_less|operator_greater_equals|operator_less_equals)"[^>]*>([\s\S]*?)</block>'
    
    for match in re.finditer(comparison_pattern, xml):
        content = match.group(2)
        
        # Extract LEFT and RIGHT
        left_match = re.search(r'<value name="LEFT">([\s\S]*?)</value>', content)
        right_match = re.search(r'<value name="RIGHT">([\s\S]*?)</value>', content)
        
        if left_match and right_match:
            left_content = left_match.group(1)
            right_content = right_match.group(1)
            
            # Check for same indicator type
            left_ind = re.search(r'<block type="(ta_sma|ta_ema|ta_rsi|ta_cci|ta_adx|ta_atr)"', left_content)
            right_ind = re.search(r'<block type="(ta_sma|ta_ema|ta_rsi|ta_cci|ta_adx|ta_atr)"', right_content)
            
            if left_ind and right_ind and left_ind.group(1) == right_ind.group(1):
                # Check periods
                left_p = re.search(r'ma_period="(\d+)"', left_content)
                right_p = re.search(r'ma_period="(\d+)"', right_content)
                
                if left_p and right_p and left_p.group(1) == right_p.group(1):
                    issues.append(f"Identical {left_ind.group(1)} indicators with ma_period={left_p.group(1)}")
                    
    return (len(issues) == 0, issues)


def check_duplicate_trade_ids(xml: str) -> Tuple[bool, List[str]]:
    """Check for duplicate TRADE_IDs which would cause trade management issues."""
    issues = []
    
    # Find all TRADE_ID definitions in trade_order blocks
    trade_order_ids = re.findall(
        r'<block type="trade_order"[^>]*>[\s\S]*?<field name="TRADE_ID">([^<]+)</field>',
        xml
    )
    
    # Check for duplicates
    seen = {}
    for trade_id in trade_order_ids:
        if trade_id in seen:
            seen[trade_id] += 1
        else:
            seen[trade_id] = 1
    
    duplicates = {k: v for k, v in seen.items() if v > 1}
    if duplicates:
        for trade_id, count in duplicates.items():
            issues.append(f"Duplicate TRADE_ID '{trade_id}' used {count} times - each trade should have a unique ID")
    
    return (len(issues) == 0, issues)


def check_scale_compatibility(xml: str) -> Tuple[bool, List[str]]:
    """Check for scale compatibility issues (e.g., comparing price vs oscillator).
    
    PRICE-BASED indicators (values in price range, e.g., 1.0500 for EURUSD):
    - ta_sma, ta_ema, ta_smma, ta_lwma, ta_dema, ta_tema, ta_frama, ta_vidya, ta_ama
    - ta_bb (all components), ta_envelopes, ta_donchian, ta_keltner
    - ta_ichimoku (all components), alligator, ta_sar, ta_vwap
    - environment_price, environment_prev_*_price
    
    OSCILLATOR indicators (fixed range, e.g., 0-100 or -100 to 0):
    - ta_rsi (0-100), ta_stochastic (0-100), ta_mfi (0-100)
    - ta_williams_r (-100 to 0), ta_cci (unbounded but centered at 0)
    - ta_demarker (0-1), ta_adx (0-100), ta_momentum (centered at 100)
    """
    issues = []
    
    PRICE_BASED = {
        'ta_sma', 'ta_ema', 'ta_smma', 'ta_lwma', 'ta_dema', 'ta_tema', 
        'ta_frama', 'ta_vidya', 'ta_ama', 'ta_bb', 'ta_envelopes', 
        'ta_donchian', 'ta_keltner', 'ta_ichimoku', 'alligator', 'ta_sar', 
        'ta_vwap', 'ta_highest', 'ta_lowest', 'environment_price',
        'environment_prev_open_price', 'environment_prev_close_price',
        'environment_prev_high_price', 'environment_prev_low_price',
        'trade_entry_price'
    }
    
    OSCILLATORS = {
        'ta_rsi', 'ta_stochastic', 'ta_mfi', 'ta_williams_r', 'ta_cci',
        'ta_demarker', 'ta_adx', 'ta_adxwilder', 'ta_momentum', 'ta_rvi',
        'ta_ao', 'ta_ac', 'ta_trix', 'ta_force', 'ta_chaikin', 'gator',
        'ta_dmi', 'ta_osma', 'macd_value', 'ta_bearspower', 'ta_bullspower'
    }
    
    # Find comparison blocks
    comparison_pattern = r'<block type="(operator_greater|operator_less|operator_greater_equals|operator_less_equals)"[^>]*>([\s\S]*?)</block>'
    
    for match in re.finditer(comparison_pattern, xml):
        content = match.group(2)
        
        left_match = re.search(r'<value name="LEFT">([\s\S]*?)</value>', content)
        right_match = re.search(r'<value name="RIGHT">([\s\S]*?)</value>', content)
        
        if left_match and right_match:
            left_content = left_match.group(1)
            right_content = right_match.group(1)
            
            # Extract block types from each side
            left_blocks = set(re.findall(r'<block type="([^"]+)"', left_content))
            right_blocks = set(re.findall(r'<block type="([^"]+)"', right_content))
            
            left_is_price = bool(left_blocks & PRICE_BASED)
            left_is_osc = bool(left_blocks & OSCILLATORS)
            right_is_price = bool(right_blocks & PRICE_BASED)
            right_is_osc = bool(right_blocks & OSCILLATORS)
            
            # Check for mismatched scales
            if (left_is_price and right_is_osc) or (left_is_osc and right_is_price):
                left_type = next(iter(left_blocks & (PRICE_BASED | OSCILLATORS)), 'unknown')
                right_type = next(iter(right_blocks & (PRICE_BASED | OSCILLATORS)), 'unknown')
                issues.append(f"Scale mismatch: comparing {left_type} (price-based) with {right_type} (oscillator)")
    
    return (len(issues) == 0, issues)


def fix_crossover_indicators(xml: str) -> Tuple[str, bool]:
    """Fix identical indicators by assigning fast/slow periods."""
    FAST_SLOW_PERIODS = {
        'ta_sma': ('10', '20'),
        'ta_ema': ('12', '26'),
        'ta_rsi': ('7', '14'),
        'ta_cci': ('10', '20'),
        'ta_adx': ('7', '14'),
        'ta_atr': ('7', '14'),
    }
    
    was_fixed = False
    
    def replacer(match):
        nonlocal was_fixed
        full_block = match.group(0)
        open_tag = match.group(1)
        content = match.group(3)
        close_tag = match.group(4)
        
        left_match = re.search(r'(<value name="LEFT">)([\s\S]*?)(</value>)', content)
        right_match = re.search(r'(<value name="RIGHT">)([\s\S]*?)(</value>)', content)
        
        if not left_match or not right_match:
            return full_block
            
        left_content = left_match.group(2)
        right_content = right_match.group(2)
        
        left_ind = re.search(r'<block type="(ta_sma|ta_ema|ta_rsi|ta_cci|ta_adx|ta_atr)"', left_content)
        right_ind = re.search(r'<block type="(ta_sma|ta_ema|ta_rsi|ta_cci|ta_adx|ta_atr)"', right_content)
        
        if not left_ind or not right_ind or left_ind.group(1) != right_ind.group(1):
            return full_block
            
        indicator = left_ind.group(1)
        left_p = re.search(r'ma_period="(\d+)"', left_content)
        right_p = re.search(r'ma_period="(\d+)"', right_content)
        
        if not left_p or not right_p or left_p.group(1) != right_p.group(1):
            return full_block
            
        # They are identical - FIX THEM
        fast, slow = FAST_SLOW_PERIODS.get(indicator, ('10', '20'))
        ind_name = indicator.replace('ta_', '').upper()
        
        # Update Left (Fast)
        new_left = re.sub(r'ma_period="\d+"', f'ma_period="{fast}"', left_content)
        new_left = re.sub(r'<field name="NAME">[^<]*</field>', f'<field name="NAME">Fast {ind_name}</field>', new_left)
        
        # Update Right (Slow)
        new_right = re.sub(r'ma_period="\d+"', f'ma_period="{slow}"', right_content)
        new_right = re.sub(r'<field name="NAME">[^<]*</field>', f'<field name="NAME">Slow {ind_name}</field>', new_right)
        
        was_fixed = True
        return f'{open_tag}{left_match.group(1)}{new_left}{left_match.group(3)}{right_match.group(1)}{new_right}{right_match.group(3)}{close_tag}'

    comparison_pattern = r'(<block type="(operator_greater|operator_less|operator_greater_equals|operator_less_equals)"[^>]*>)([\s\S]*?)(</block>)'
    
    fixed_xml = re.sub(comparison_pattern, replacer, xml)
    return (fixed_xml, was_fixed)


# ============================================================
# DeepSeek API Helper
# ============================================================

async def call_deepseek(
    messages: list[dict],
    temperature: float = 0.3,
    max_tokens: int = 4000
) -> str:
    """Call DeepSeek API and return the response content."""
    import time
    start_time = time.time()
    
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key or api_key == "your_deepseek_api_key_here":
        log_error(ValueError("DEEPSEEK_API_KEY not configured"), "call_deepseek")
        raise HTTPException(
            status_code=500,
            detail="DEEPSEEK_API_KEY not configured. Add your key to backend/.env"
        )

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                DEEPSEEK_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": DEEPSEEK_MODEL,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens
                }
            )

            duration_ms = (time.time() - start_time) * 1000

            if response.status_code != 200:
                log_llm_call(
                    model=DEEPSEEK_MODEL,
                    endpoint=DEEPSEEK_API_URL,
                    messages=messages,
                    response="",
                    duration_ms=duration_ms,
                    temperature=temperature,
                    success=False,
                    error=f"HTTP {response.status_code}: {response.text[:500]}"
                )
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"DeepSeek API error: {response.text}"
                )

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            
            # Extract token counts if available
            tokens_input = data.get("usage", {}).get("prompt_tokens")
            tokens_output = data.get("usage", {}).get("completion_tokens")
            
            # Log successful call
            log_llm_call(
                model=DEEPSEEK_MODEL,
                endpoint=DEEPSEEK_API_URL,
                messages=messages,
                response=content,
                duration_ms=duration_ms,
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                temperature=temperature,
                success=True
            )
            
            return content
            
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        log_llm_call(
            model=DEEPSEEK_MODEL,
            endpoint=DEEPSEEK_API_URL,
            messages=messages,
            response="",
            duration_ms=duration_ms,
            temperature=temperature,
            success=False,
            error=str(e)
        )
        raise



async def call_gemini(
    messages: list[dict],
    temperature: float = 0.3,
    max_tokens: int = 8192,  # Increased for complex strategy generation
    model: str = None
) -> str:
    """Call Google Gemini API and return the response content.
    
    If USE_DEEPSEEK_ONLY is True, redirects to DeepSeek instead.
    """
    # Check if we should redirect to DeepSeek
    if USE_DEEPSEEK_ONLY:
        print("[LLM] USE_DEEPSEEK_ONLY=True, redirecting Gemini call to DeepSeek")
        return await call_deepseek(messages, temperature=temperature)
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY not configured. Add your key to backend/.env"
        )

    # Use provided model or fall back to global default
    target_model = model or GEMINI_MODEL

    try:
        client = genai.Client(api_key=api_key)
        
        # Convert OpenAI-style messages to Gemini format
        full_prompt = ""
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            if role == "system":
                full_prompt += f"System: {content}\n\n"
            elif role == "user":
                full_prompt += f"User: {content}\n\n"
            elif role == "assistant":
                full_prompt += f"Model: {content}\n\n"
        
        fallback_models = [
            target_model,
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-3-flash-preview",
            "gemini-3.1-flash-lite-preview",
        ]
        
        # Remove duplicates while preserving order
        unique_models = []
        seen = set()
        for m in fallback_models:
            if m not in seen:
                unique_models.append(m)
                seen.add(m)
        
        last_error = None
        
        # Try each model in sequence
        for current_model in unique_models:
            try:
                # Run synchronous Gemini API call in thread pool with timeout
                def _sync_generate():
                    return client.models.generate_content(
                        model=current_model,
                        contents=full_prompt,
                        config={
                            "temperature": temperature,
                            "max_output_tokens": max_tokens
                        }
                    )
                
                loop = asyncio.get_event_loop()
                # 180 second timeout for large prompts (matching DeepSeek timeout)
                response = await asyncio.wait_for(
                    loop.run_in_executor(None, _sync_generate),
                    timeout=180.0
                )
                
                print(f"[LLM] Successfully generated with {current_model}")
                return response.text
                
            except asyncio.TimeoutError:
                last_error = TimeoutError(f"Timeout waiting for {current_model}")
                print(f"⚠️ {current_model} timed out after 180s, trying next model...")
                continue
                
            except Exception as e:
                last_error = e
                error_msg = str(e)
                
                # Check for overload/availability errors (503, 500, 429)
                is_overloaded = "503" in error_msg or "overloaded" in error_msg.lower() or "429" in error_msg
                
                if is_overloaded:
                    print(f"⚠️ {current_model} overloaded/unavailable, trying next model... (Error: {error_msg[:100]})")
                    continue
                
                # If it's a different error (e.g. auth), raise immediately
                log_error(e, f"call_gemini({current_model})")
                raise HTTPException(
                    status_code=500,
                    detail=f"Gemini API error ({current_model}): {error_msg}"
                )
        
        # If all models failed
        if last_error:
            log_error(last_error, "call_gemini_all_failed")
            raise HTTPException(
                status_code=503,
                detail=f"All Gemini models overloaded. Last error: {str(last_error)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        log_error(e, "call_gemini_fatal")
        raise HTTPException(
            status_code=500,
            detail=f"Gemini API error: {str(e)}"
        )


async def call_gateway_gemini(
    messages: list[dict],
    temperature: float = 0.3,
    max_tokens: int = 8000,
    model: str = "google/gemini-3-pro"
) -> str:
    """
    Call AI Gateway (proxies to Gemini).
    Uses https://ai.gateway.lovable.dev/v1/chat/completions
    """
    import time
    start_time = time.time()
    
    api_key = os.getenv("AI_GATEWAY_API_KEY")
    if not api_key:
        log_error(ValueError("AI_GATEWAY_API_KEY not configured"), "call_gateway_gemini")
        raise HTTPException(
            status_code=500,
            detail="AI_GATEWAY_API_KEY not configured. Add your key to backend/.env"
        )

    url = "https://ai.gateway.lovable.dev/v1/chat/completions"
    
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json=payload
            )

            duration_ms = (time.time() - start_time) * 1000

            if response.status_code == 429:
                log_llm_call(
                    model="google/gemini-3-pro",
                    endpoint=url,
                    messages=messages,
                    response="",
                    duration_ms=duration_ms,
                    temperature=temperature,
                    success=False,
                    error="Rate limit exceeded (429)"
                )
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded. Please try again in a moment."
                )
            
            if response.status_code == 402:
                log_llm_call(
                    model="google/gemini-3-pro",
                    endpoint=url,
                    messages=messages,
                    response="",
                    duration_ms=duration_ms,
                    temperature=temperature,
                    success=False,
                    error="AI credits exhausted (402)"
                )
                raise HTTPException(
                    status_code=402,
                    detail="AI credits exhausted. Please add credits to continue."
                )

            if response.status_code != 200:
                log_llm_call(
                    model="google/gemini-3-pro",
                    endpoint=url,
                    messages=messages,
                    response="",
                    duration_ms=duration_ms,
                    temperature=temperature,
                    success=False,
                    error=f"HTTP {response.status_code}: {response.text[:500]}"
                )
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"AI Gateway error: {response.text}"
                )

            data = response.json()
            try:
                content = data["choices"][0]["message"]["content"]
                
                # Extract token counts if available
                tokens_input = data.get("usage", {}).get("prompt_tokens")
                tokens_output = data.get("usage", {}).get("completion_tokens")
                
                log_llm_call(
                    model="google/gemini-3-pro",
                    endpoint=url,
                    messages=messages,
                    response=content,
                    duration_ms=duration_ms,
                    tokens_input=tokens_input,
                    tokens_output=tokens_output,
                    temperature=temperature,
                    success=True
                )
                
                return content
            except (KeyError, IndexError):
                log_llm_call(
                    model="google/gemini-3-pro",
                    endpoint=url,
                    messages=messages,
                    response="",
                    duration_ms=duration_ms,
                    temperature=temperature,
                    success=False,
                    error="No content in response"
                )
                return "Error: No content generated by AI Gateway"
                
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        log_llm_call(
            model="google/gemini-3-pro",
            endpoint=url,
            messages=messages,
            response="",
            duration_ms=duration_ms,
            temperature=temperature,
            success=False,
            error=str(e)
        )
        raise


async def call_deepseek_reasoning(
    messages: list[dict],
    max_tokens: int = 8000
) -> str:
    """Call DeepSeek Reasoning model for validation tasks."""
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key or api_key == "your_deepseek_api_key_here":
        raise HTTPException(
            status_code=500,
            detail="DEEPSEEK_API_KEY not configured"
        )

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            DEEPSEEK_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": messages,
                "max_tokens": max_tokens
            }
        )

        if response.status_code != 200:
            print(f"DeepSeek Reasoning API error: {response.status_code}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"DeepSeek Reasoning API error: {response.text}"
            )

        data = response.json()
        return data["choices"][0]["message"]["content"]


def extract_xml(content: str) -> str:
    """Extract XML content from response, handling markdown blocks.
    
    Matches original Supabase edge function behavior:
    - Validates response isn't just whitespace
    - Validates response size (max 1MB)
    - Extracts XML from markdown code blocks
    - Extracts XML using regex if needed
    """
    if not content:
        return ""
    
    cleaned = content.strip()
    
    # Validate response isn't just whitespace (matching original)
    if not cleaned:
        print("Warning: AI returned empty response")
        return ""
    
    # Validate response size (max 1MB, matching original)
    if len(cleaned) > 1024 * 1024:
        print("Warning: AI response is too large (>1MB)")
        return ""
    
    # Remove markdown code blocks if present
    if cleaned.startswith("```"):
        # Strip code block markers
        lines = cleaned.split("\n")
        if lines[0].strip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines)
    
    # Extract XML content from response using regex (matching original)
    # In case AI added explanation text before/after
    xml_match = re.search(r'<xml[^>]*>[\s\S]*</xml>', cleaned, re.IGNORECASE)
    if xml_match:
        cleaned = xml_match.group(0)
    
    return cleaned