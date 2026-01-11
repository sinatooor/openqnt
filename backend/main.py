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
from strategy_compiler import strategy_compiler
from backtest_service import XML_TO_PYTHON_PROMPT, run_backtest_pipeline, validate_nautilus_code
from backtest_runner import run_backtest, run_backtest_simple
from strategy_store import hash_xml, save_strategy_version, load_by_id, load_latest_by_hash
from ai_strategy_reviewer import review_strategy
import local_database as database # Local DB module
from routers import live_trading # Live Trading Router
from risk_controls import PanicService

# Google ADK Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from adk_agents.trading_agent import trading_agent

# Logging
from llm_logger import (
    log_llm_call, log_conversion, log_backtest, 
    log_strategy_generation, log_general, log_error, 
    log_api_request, get_log_stats
)

# Initialize ADK session service
adk_session_service = InMemorySessionService()
adk_runner = Runner(
    agent=trading_agent,
    app_name="trading_chat",
    session_service=adk_session_service
)

# Load environment variables
load_dotenv()

# Initialize Database
try:
    database.init_db()
except Exception as e:
    print(f"DB Init Error: {e}")

# Start Market Data Scheduler (auto-refresh every 5 minutes)
try:
    from market_data_scheduler import start_scheduler
    start_scheduler()
except Exception as e:
    print(f"Warning: Market data scheduler failed to start: {e}")

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
# Change this to switch Gemini models:
GEMINI_MODEL = "gemini-3-flash-preview"  # Fast and capable (RECOMMENDED)
# GEMINI_MODEL = "gemini-1.5-pro"   # More capable but slower
# GEMINI_MODEL = "gemini-1.5-flash" # Fastest option

# Primary LLM Provider: "gemini" or "deepseek"
# This determines which model is used for strategy generation
PRIMARY_LLM = "gemini"  # <-- CHANGE THIS TO SWITCH PRIMARY MODEL

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


app = FastAPI(title="Strategy Generator API", version="1.0.0")

# Include Live Trading Router
app.include_router(live_trading.router)
from routers import trade_history
app.include_router(trade_history.router)

@app.post("/api/panic")
async def trigger_panic_endpoint():
    """
    Global Panic Button: Immediately halts trading and closes positions.
    """
    result = await PanicService.trigger_panic()
    return result

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

BLOCK_REFERENCE = load_prompt("block_reference.txt")
SYSTEM_PROMPT = load_prompt("system_prompt.txt", {"BLOCK_REFERENCE": BLOCK_REFERENCE})
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
    max_tokens: int = 4000,
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
        
        # Convert OpenAI-style messages to Gemini format (string concatenation for simplicity)
        # The SDK supports list of messages but string prompt is often more robust for simple generation
        # Let's reconstruct the conversation for the SDK
        
        # Simple approach: concatenate system + user messages
        # (For advanced chat, we should use client.chats.create, but here safe to just prompt)
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
        
        response = client.models.generate_content(
            model=target_model,
            contents=full_prompt,
            config={
                "temperature": temperature,
                "max_output_tokens": max_tokens
            }
        )
        
        return response.text

    except Exception as e:
        log_error(e, "call_gemini")
        raise HTTPException(
            status_code=500,
            detail=f"Gemini API error: {str(e)}"
        )


async def call_lovable_gemini(
    messages: list[dict],
    temperature: float = 0.3,
    max_tokens: int = 8000,
    model: str = "google/gemini-3-pro"
) -> str:
    """
    Call Lovable Gateway (proxies to Gemini) - matches original Supabase Edge Function.
    Uses https://ai.gateway.lovable.dev/v1/chat/completions
    """
    import time
    start_time = time.time()
    
    api_key = os.getenv("LOVABLE_API_KEY")
    if not api_key:
        log_error(ValueError("LOVABLE_API_KEY not configured"), "call_lovable_gemini")
        raise HTTPException(
            status_code=500,
            detail="LOVABLE_API_KEY not configured. Add your key to backend/.env"
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
                    detail=f"Lovable Gateway error: {response.text}"
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
                return "Error: No content generated by Lovable Gateway"
                
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
    """Extract XML content from response, handling markdown blocks."""
    if not content:
        return ""
        
    cleaned = content.strip()
    
    # Remove markdown code blocks if present
    if cleaned.startswith("```"):
        # Strip code block markers
        lines = cleaned.split("\n")
        if lines[0].strip().startswith("```"):
            lines = lines[1:]
        if lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines)
        
    return cleaned