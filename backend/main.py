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
import database # Local DB module
from routers import live_trading # Live Trading Router

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
    if cleaned.startswith("```xml"):
        cleaned = re.sub(r'^```xml\n?', '', cleaned)
        cleaned = re.sub(r'\n?```$', '', cleaned)
    elif cleaned.startswith("```"):
        cleaned = re.sub(r'^```\n?', '', cleaned)
        cleaned = re.sub(r'\n?```$', '', cleaned)
        
    cleaned = cleaned.strip()
    
    # Try to extract <xml>...</xml>
    # logic: find first <xml...> and last </xml>
    xml_match = re.search(r'<xml[\s\S]*?>[\s\S]*?</xml>', cleaned, re.IGNORECASE | re.DOTALL)
    if xml_match:
        return xml_match.group(0)
    
    # If no xml tags but starts with <, might be raw XML
    if cleaned.startswith('<'):
        return cleaned
    
    return cleaned


async def generate_python_code_from_xml(xml: str, llm_func) -> Optional[str]:
    """LLM helper to create executable Python strategy from Blockly XML."""
    if not llm_func:
        return None
    prompt = XML_TO_PYTHON_PROMPT.format(xml=xml)
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Generate the strategy code."}
    ]
    code = await llm_func(messages, temperature=0.1)

    if not code:
        return None

    cleaned = code.strip()
    if cleaned.startswith("```python"):
        cleaned = cleaned[9:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    
    return cleaned.strip()


# ============================================================
# API ROUTES
# ============================================================

class ConversationalChatRequest(BaseModel):
    messages: list
    blockXml: Optional[str] = None
    currentWorkspace: Optional[str] = None


class ConversationalChatResponse(BaseModel):
    response: str


class GenerateStrategyRequest(BaseModel):
    message: str
    currentWorkspace: Optional[str] = None
    blockXml: Optional[str] = None
    mode: str = "fast"  # "fast" or "slow"


class ValidateStrategyRequest(BaseModel):
    xml: str
    mode: str = "fast"


CONVERSATIONAL_SYSTEM_PROMPT = """You are a helpful trading strategy assistant with expertise in technical analysis, trading strategies, and financial markets. You provide clear, educational responses about trading concepts, indicators, and strategies.

You help users understand:
- Technical indicators (RSI, MACD, Moving Averages, Bollinger Bands, etc.)
- Trading strategies and their applications
- Risk management principles
- Market analysis concepts
- Best practices for algorithmic trading

Be conversational, friendly, and educational. If users ask about implementing strategies, remind them they can switch to "Generate" mode to create actual trading blocks."""


@app.post("/conversational-chat", response_model=ConversationalChatResponse)
async def conversational_chat(request: ConversationalChatRequest):
    """
    Conversational AI chat for trading questions using Google ADK.
    Uses the trading_agent as the orchestrator with access to tools.
    """
    try:
        # Build the user message with context
        user_content = request.messages[-1]["content"] if request.messages else ""
        
        # Add block context if provided
        if request.blockXml:
            user_content += f"\n\n[CONTEXT: User shared a Blockly block]\n{request.blockXml}"
        
        # Add workspace context if provided
        if request.currentWorkspace:
            block_count = request.currentWorkspace.count("<block ")
            user_content += f"\n\n[CONTEXT: Current workspace has {block_count} blocks]"
        
        # Use ADK trading_agent as orchestrator
        print(f"[ADK CHAT] Processing: {user_content[:100]}...")
        
        # Get or create session
        session_id = "default_session"  # TODO: Use user-specific sessions
        
        try:
            session = await adk_session_service.get_session(
                app_name="trading_chat",
                user_id="default_user",
                session_id=session_id
            )
        except:
            session = await adk_session_service.create_session(
                app_name="trading_chat",
                user_id="default_user",
                session_id=session_id
            )
        
        # Run the agent
        response_text = ""
        async for event in adk_runner.run_async(
            user_id="default_user",
            session_id=session_id,
            new_message=user_content
        ):
            if hasattr(event, 'content') and event.content:
                if hasattr(event.content, 'parts'):
                    for part in event.content.parts:
                        if hasattr(part, 'text') and part.text:
                            response_text += part.text
        
        if not response_text:
            # Fallback to direct LLM if ADK returns empty
            print("[ADK CHAT] Empty response, falling back to direct LLM")
            messages = [
                {"role": "system", "content": CONVERSATIONAL_SYSTEM_PROMPT},
                {"role": "user", "content": user_content}
            ]
            response_text = await call_gemini(messages, temperature=0.7)
        
        print(f"[ADK CHAT] Response: {len(response_text)} chars")
        return ConversationalChatResponse(response=response_text)
        
    except Exception as e:
        print(f"Error in ADK conversational chat: {e}")
        # Fallback to direct LLM call on any ADK error
        try:
            user_content = request.messages[-1]["content"] if request.messages else ""
            messages = [
                {"role": "system", "content": CONVERSATIONAL_SYSTEM_PROMPT},
                {"role": "user", "content": user_content}
            ]
            response_text = await call_gemini(messages, temperature=0.7)
            return ConversationalChatResponse(response=response_text)
        except Exception as fallback_e:
            print(f"Fallback also failed: {fallback_e}")
            raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-strategy", response_model=StrategyResponse)
async def generate_strategy(request: GenerateStrategyRequest):
    """
    Generate Blockly XML from natural language description.
    Ported from Supabase Edge Function: generate-strategy-validated
    """
    try:
        block_count = request.currentWorkspace.count("<block ") if request.currentWorkspace else 0
        print(f"[GENERATE] Message: {request.message[:100]}...")
        print(f"[GENERATE] Workspace: {block_count} blocks, Mode: {request.mode}")
        
        # 1. Build prompts (conditionally use RAG or all blocks)
        if USE_RAG_FOR_BLOCKS:
            # RAG Mode: Retrieve only relevant blocks
            print("[GENERATE] Using RAG mode (selective blocks)")
            rag_blocks = await get_rag_blocks(request.message, n_results=25)
            # Load template without full block reference
            system_prompt_template = load_prompt("system_prompt.txt", {"BLOCK_REFERENCE": ""})
            # Inject RAG-retrieved blocks
            system_prompt = system_prompt_template + f"\n\n=== AVAILABLE BLOCKS (Retrieved via RAG) ===\n{rag_blocks}\n"
        else:
            # All Blocks Mode: Send complete block reference
            print("[GENERATE] Using ALL BLOCKS mode (full reference)")
            system_prompt = SYSTEM_PROMPT
            
        if request.blockXml:
            system_prompt += f"\n\nThe user has shared a specific Blockly block with you. Here is the XML structure:\n\n{request.blockXml}\n\nPlease focus on this block when generating or modifying the strategy. Analyze what this block does and incorporate it or provide context about it in your response."
        
        if request.currentWorkspace:
            user_prompt = f"""Here is my current trading strategy workspace:

{request.currentWorkspace}

Please modify it according to this request: {request.message}

IMPORTANT: You MUST only use blocks from the list provided in the system prompt. Do not invent new blocks. Return ONLY the complete updated XML wrapped in <xml></xml> tags. No explanations."""
        else:
            user_prompt = f"""Generate Blockly XML for this trading strategy: {request.message}

IMPORTANT: You MUST only use the blocks listed in the system prompt. Do not invent new blocks. Return ONLY the XML wrapped in <xml></xml> tags. No explanations.

BEFORE GENERATING XML, THINK STEP-BY-STEP:
1. What is the requested timeframe? (Set 'period' attribute to this value in minutes, e.g., 60 for 1h)
2. What is the trade size? (Set 'SIZE' to 0.1 unless specified)
3. What indicators are needed?"""
        
        
        # Determine model based on mode
        # User requested gemini-3 models
        model_name = "gemini-3-flash-preview" if request.mode == "fast" else "gemini-3-pro-preview"
        print(f"[GENERATE] Using model: {model_name}")

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        # 2. Generate (Pass 1) - Use PRIMARY_LLM setting
        if PRIMARY_LLM == "gemini":
            response_text = await call_gemini(messages, temperature=0.3, model=model_name)
        else:
            response_text = await call_deepseek(messages, temperature=0.3)
        xml_content = extract_xml(response_text)
        
        # 3. Apply Common Programmatic Fixes (Pass 1)
        xml_content = apply_common_fixes(xml_content)
        
        # 4. Validate Structure (Pass 1)
        is_structure_valid, struct_issues = validate_xml_structure(xml_content)
        if not is_structure_valid:
            print(f"[GENERATE] Structural issues found (Pass 1): {struct_issues}")
            
        # 5. Fix Crossovers (Pass 1)
        was_fixed = False
        is_crossover_valid, crossover_issues = check_crossover_valid(xml_content)
        if not is_crossover_valid:
            print(f"[GENERATE] Crossover issues found: {crossover_issues}")
            xml_content, was_fixed = fix_crossover_indicators(xml_content)
            if was_fixed:
                print("[GENERATE] Applied programmatic fix for crossover indicators")
        
        # 6. Rationalization (Pass 2 - Slow Mode Only)
        was_rationalized = False
        if request.mode == "slow":
            print("[GENERATE] Slow mode active - Rationalizing...")
            validation_messages = [
                {"role": "system", "content": RATIONALIZATION_PROMPT},
                {"role": "user", "content": f"Validate and fix this XML:\n\n{xml_content}"}
            ]
            
            # Use lower temperature for validation. Use PRO model for reasoning.
            if PRIMARY_LLM == "gemini":
                validated_content = await call_gemini(validation_messages, temperature=0.1, model="gemini-3-pro-preview")
            else:
                validated_content = await call_deepseek(validation_messages, temperature=0.1)
            validated_xml = extract_xml(validated_content)
            
            if validated_xml and "<block" in validated_xml:
                 validated_xml = apply_common_fixes(validated_xml)
                 is_struct_valid_2, _ = validate_xml_structure(validated_xml)
                 
                 if is_struct_valid_2:
                     xml_content = validated_xml
                     was_rationalized = True
                     print("[GENERATE] LLM rationalization applied")
                     
                     # Check crossover fixes AGAIN on rationalized output
                     is_cross_valid_2, _ = check_crossover_valid(xml_content)
                     if not is_cross_valid_2:
                          xml_content, fixed_again = fix_crossover_indicators(xml_content)
                          if fixed_again:
                               was_fixed = True
                               print("[GENERATE] Applied crossover fix after rationalization")
                 else:
                     print("[GENERATE] Rationalized XML had invalid structure, discarded")
        
        generated_block_count = xml_content.count("<block ")
        print(f"[GENERATE] Result: {generated_block_count} blocks, {len(xml_content)} chars, fixed={was_fixed}, rationalized={was_rationalized}")
        
        return StrategyResponse(
            xml=xml_content, 
            ai_fixed=was_fixed,
            was_rationalized=was_rationalized
        )
        
    except Exception as e:
        print(f"Error in generate strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/validate-strategy")
async def validate_strategy(request: ValidateStrategyRequest):
    """
    Validate and optionally rationalize Blockly XML strategy.
    Ported from Supabase Edge Function: validate-strategy
    """
    try:
        print(f"[VALIDATE] Mode: {request.mode}")
        
        # Step 1: Programmatic validation (Pass 1)
        # Apply common fixes first
        xml_content = apply_common_fixes(request.xml)
        
        # Validate structure
        is_struct_valid, struct_issues = validate_xml_structure(xml_content)
        if not is_struct_valid:
            print(f"[VALIDATE] Structural issues found: {struct_issues}")
            
        # Check crossovers
        is_valid, issues = check_crossover_valid(xml_content)
        auto_fixed = False
        
        if not is_valid:
            print(f"[VALIDATE] Issues found: {issues}")
            xml_content, auto_fixed = fix_crossover_indicators(xml_content)
            if auto_fixed:
                print("[VALIDATE] Applied programmatic fix")
        
        # Step 2: LLM rationalization (slow mode only)
        was_rationalized = False
        if request.mode == "slow":
            print("[VALIDATE] Slow mode active - Rationalizing...")
            messages = [
                {"role": "system", "content": RATIONALIZATION_PROMPT},
                {"role": "user", "content": f"Validate and fix this XML:\n\n{xml_content}"}
            ]
            
            # Use Pro model for reasoning/validation
            validated_content = await call_lovable_gemini(messages, temperature=0.1, model="google/gemini-2.5-pro")
            validated_xml = extract_xml(validated_content)
            
            if validated_xml and "<block" in validated_xml:
                validated_xml = apply_common_fixes(validated_xml)
                is_struct_valid_2, _ = validate_xml_structure(validated_xml)
                
                if is_struct_valid_2:
                    xml_content = validated_xml
                    was_rationalized = True
                    print("[VALIDATE] LLM rationalization applied")
                    
                    # Check crossover fixes AGAIN
                    is_cross_valid_2, _ = check_crossover_valid(xml_content)
                    if not is_cross_valid_2:
                        xml_content, fixed_again = fix_crossover_indicators(xml_content)
                        if fixed_again:
                            auto_fixed = True
                            print("[VALIDATE] Applied crossover fix after rationalization")
                else:
                    print("[VALIDATE] Rationalized XML had invalid structure, discarded")
        
        block_count = xml_content.count("<block ")
        
        return {
            "xml": xml_content,
            "blockCount": block_count,
            "autoFixed": auto_fixed,
            "wasRationalized": was_rationalized,
            "valid": True
        }
        
    except Exception as e:
        print(f"Error in validate strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Legacy endpoint for backward compatibility
@app.post("/strategy/legacy", response_model=StrategyResponse)
async def generate_strategy_legacy(request: StrategyRequest):
    """Legacy endpoint - redirects to /generate-strategy"""
    return await generate_strategy(GenerateStrategyRequest(
        message=request.message,
        currentWorkspace=request.existingXml,
        blockXml=request.blockXml,
        mode="fast" if request.ai_model == "deepseek" else "slow"
    ))


# ============================================================
# MARKET DATA ENDPOINTS
# ============================================================

import sqlite3
from pathlib import Path

MARKET_DATA_DB = Path(__file__).parent / "data" / "market_data.db"


def get_db_connection():
    """Get a connection to the market data SQLite database."""
    if not MARKET_DATA_DB.exists():
        raise HTTPException(status_code=500, detail="Market data database not found")
    conn = sqlite3.connect(str(MARKET_DATA_DB))
    conn.row_factory = sqlite3.Row
    return conn


@app.get("/symbols")
async def get_symbols():
    """
    Get all available symbols from the local database.
    Returns grouped by asset type.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get unique symbols with their asset info
        cursor.execute("""
            SELECT DISTINCT 
                a.symbol,
                a.name,
                a.asset_type,
                a.is_active,
                (SELECT COUNT(*) FROM daily_prices WHERE symbol = a.symbol) as record_count,
                (SELECT MIN(date) FROM daily_prices WHERE symbol = a.symbol) as first_date,
                (SELECT MAX(date) FROM daily_prices WHERE symbol = a.symbol) as last_date
            FROM assets a
            WHERE a.is_active = 1
            ORDER BY a.symbol
        """)
        
        rows = cursor.fetchall()
        conn.close()
        
        symbols = []
        grouped = {
            "stocks": [],
            "forex": [],
            "indices": [],
            "commodities": [],
            "crypto": [],
            "futures": [],
            "etf": []
        }
        
        for row in rows:
            symbol_info = {
                "symbol": row["symbol"],
                "name": row["name"],
                "asset_type": row["asset_type"],
                "is_active": row["is_active"],
                "record_count": row["record_count"],
                "first_date": row["first_date"],
                "last_date": row["last_date"]
            }
            symbols.append(symbol_info)
            
            # Group by asset type
            asset_type = (row["asset_type"] or "stocks").lower()
            if asset_type in grouped:
                grouped[asset_type].append(symbol_info)
            else:
                grouped["stocks"].append(symbol_info)
        
        return {
            "success": True,
            "total": len(symbols),
            "symbols": symbols,
            "grouped": grouped
        }
        
    except Exception as e:
        log_error("get_symbols", str(e))
        return {
            "success": False,
            "total": 0,
            "symbols": [],
            "grouped": {"stocks": [], "forex": [], "indices": [], "commodities": [], "crypto": [], "futures": [], "etf": []},
            "error": str(e)
        }


@app.post("/verify-backtest", response_model=VerifyResponse)
async def verify_backtest_endpoint(request: VerifyRequest):
    """
    Verify strategy XML using LLM (Gemini/DeepSeek)
    Returns { valid: bool, issues: [] }
    """
    try:
        if request.python_code:
            # Code-level verification (More strict)
            log_api_request("verify-backtest", {"type": "code", "len": len(request.python_code)})
            system_prompt = """You are an expert Python Developer specializing in NautilusTrader.
            Verify the provided Python strategy code for:
            1. Syntax errors
            2. Correct NautilusTrader API usage (on_bar, on_quote methods)
            3. Logical flaws (infinite loops, invalid order logic)
            
            Return JSON: { "valid": boolean, "issues": ["issue 1"] }
            """
            user_prompt = f"Verify this NautilusTrader Strategy Code:\n\n{request.python_code}"
        else:
            # XML-level verification
            log_api_request("verify-backtest", {"type": "xml", "len": len(request.xml)})
            system_prompt = """You are an expert trading strategy validator. 
            Analyze the provided Blockly XML snippet for a trading strategy.
            Check for:
            1. Logical completeness
            2. Missing parameters
            3. Potential logical errors
            
            Return JSON: { "valid": boolean, "issues": ["issue 1", "issue 2"] }
            """
            
        user_prompt = f"Verify this strategy XML:\n\n{request.xml}"
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        # Use PRIMARY_LLM choice
        if PRIMARY_LLM == "gemini":
            # Using fast model for quick verification
            response_text = await call_gemini(messages, temperature=0.1, model="gemini-3-flash-preview")
        else:
            response_text = await call_deepseek(messages, temperature=0.1)
            
        # Parse JSON from response
        try:
            # Clean markdown code blocks if present
            cleaned = response_text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
                
            data = json.loads(cleaned.strip())
            return VerifyResponse(valid=data.get("valid", False), issues=data.get("issues", []))
        except json.JSONDecodeError:
            log_error(ValueError(f"Failed to parse LLM verification response: {response_text}"), "verify_backtest")
            # Fallback to invalid with raw text as issue
            return VerifyResponse(valid=False, issues=["Could not parse validation response"])
            
    except Exception as e:
        log_error(e, "verify_backtest")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# AUTH & PERSISTENCE ENDPOINTS
# ==========================================

class LoginRequest(BaseModel):
    email: str
    password: str

class StrategySaveRequest(BaseModel):
    user_id: str
    name: str
    xml: str
    python_code: Optional[str] = ""
    block_count: int = 0

@app.post("/api/login")
async def login_endpoint(creds: LoginRequest):
    user = database.get_user_by_credentials(creds.email, creds.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"user": user}

@app.get("/api/strategies")
async def list_strategies_endpoint(user_id: str):
    return database.get_user_strategies(user_id)

@app.post("/api/strategies")
async def save_strategy_endpoint(req: StrategySaveRequest):
    try:
        sid = database.save_user_strategy(
            req.user_id, req.name, req.xml, req.python_code, req.block_count
        )
        return {"success": True, "id": sid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/strategies/{strategy_id}")
async def delete_strategy_endpoint(strategy_id: str, user_id: str):
    database.delete_user_strategy(strategy_id, user_id)
    return {"success": True}



@app.get("/market-data")
async def get_market_data(
    symbol: str,
    interval: str = "1d",
    limit: int = 500,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Get historical market data for a symbol from the local database.
    
    Args:
        symbol: Stock/forex symbol (e.g., "AAPL", "EURUSD")
        interval: "1d" for daily, "1h" for hourly
        limit: Maximum number of candles to return
        start_date: Optional start date (YYYY-MM-DD)
        end_date: Optional end date (YYYY-MM-DD)
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Choose table based on interval
        if interval == "1h" or interval == "hourly":
            table = "hourly_prices"
            date_col = "datetime"
        else:
            table = "daily_prices"
            date_col = "date"
        
        # Build query
        query = f"""
            SELECT {date_col}, open, high, low, close, volume
            FROM {table}
            WHERE symbol = ?
        """
        params = [symbol.upper()]
        
        if start_date:
            query += f" AND {date_col} >= ?"
            params.append(start_date)
        if end_date:
            query += f" AND {date_col} <= ?"
            params.append(end_date)
        
        query += f" ORDER BY {date_col} DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            return {
                "success": False,
                "symbol": symbol,
                "error": f"No data found for {symbol}",
                "data": []
            }
        
        # Convert to list and reverse to ascending order
        data = []
        for row in reversed(rows):
            data.append({
                "date": row[date_col],
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": row["volume"]
            })
        
        return {
            "success": True,
            "symbol": symbol,
            "interval": interval,
            "count": len(data),
            "source": "local_database",
            "data": data
        }
        
    except Exception as e:
        log_error("get_market_data", f"Error fetching {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch market data: {str(e)}")


# ============================================================
# CUSTOM BLOCKS ENDPOINT
# ============================================================

@app.get("/custom-blocks")
async def get_custom_blocks():
    """
    Get all custom block definitions for frontend registration.
    These are blocks created by users via the ADK agent.
    """
    try:
        from adk_agents.tools.custom_block_tools import _load_blocks
        blocks = _load_blocks()
        
        return {
            "success": True,
            "count": len(blocks),
            "blocks": blocks
        }
    except Exception as e:
        log_error("get_custom_blocks", f"Error loading blocks: {str(e)}")
        return {
            "success": False,
            "count": 0,
            "blocks": [],
            "error": str(e)
        }


# ============================================================
# ADK AGENT CHAT ENDPOINT
# ============================================================

class AgentChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    current_workspace: Optional[str] = None

class AgentChatResponse(BaseModel):
    response: str
    session_id: str
    tool_calls: Optional[List[Dict[str, Any]]] = None

@app.post("/agent/chat", response_model=AgentChatResponse)
async def agent_chat(request: AgentChatRequest):
    """
    Chat endpoint that uses the ADK trading_agent.
    This agent can create custom blocks, search market news, execute trades, etc.
    """
    try:
        # Use provided session_id or create new one
        session_id = request.session_id or f"session_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        user_id = "default_user"
        
        # Create or get session using async methods
        session = await adk_session_service.get_session(
            app_name="trading_chat",
            user_id=user_id,
            session_id=session_id
        )
        
        if session is None:
            session = await adk_session_service.create_session(
                app_name="trading_chat",
                user_id=user_id,
                session_id=session_id
            )
        
        # Add workspace context to message if provided
        user_message = request.message
        if request.current_workspace:
            block_count = len(re.findall(r'<block ', request.current_workspace))
            if block_count > 0:
                user_message = f"[Context: User has {block_count} blocks in workspace]\n\n{request.message}"
        
        # Run the agent
        response_text = ""
        tool_calls = []
        
        # Import Content and Part for message formatting
        from google.genai import types
        user_content = types.Content(
            role="user",
            parts=[types.Part(text=user_message)]
        )
        
        async for event in adk_runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=user_content
        ):
            # Collect response parts
            if hasattr(event, 'content') and event.content:
                if hasattr(event.content, 'parts'):
                    for part in event.content.parts:
                        if hasattr(part, 'text') and part.text:
                            response_text += part.text
                        if hasattr(part, 'function_call') and part.function_call:
                            fc = part.function_call
                            if hasattr(fc, 'name') and fc.name:
                                tool_calls.append({
                                    "name": fc.name,
                                    "args": dict(fc.args) if hasattr(fc, 'args') and fc.args else {}
                                })
        
        if not response_text:
            response_text = "I'm ready to help! You can ask me to create custom blocks, search market news, or help with trading strategies."
        
        return AgentChatResponse(
            response=response_text,
            session_id=session_id,
            tool_calls=tool_calls if tool_calls else None
        )
        
    except Exception as e:
        log_error("agent_chat", f"Error in agent chat: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# BACKTEST ENDPOINTS
# ============================================================

class BacktestPyCodeRequest(BaseModel):
    """Request for backtesting.py engine with pre-generated Python code."""
    pythonCode: Optional[str] = None
    symbol: str = "EURUSD"
    startDate: str = "2024-01-01"
    endDate: str = "2024-03-31"
    initialBalance: float = 10000.0
    commission: float = 0.001
    polishWithLLM: bool = False
    templateId: Optional[str] = None


@app.post("/backtest-py-code")
async def run_backtest_py_code(request: BacktestPyCodeRequest):
    """
    Run backtest using backtesting.py engine with pre-generated Python code.
    
    This endpoint expects Python code compatible with backtesting.py library.
    """
    try:
        log_api_request("/backtest-py-code", request.model_dump())
        
        # Get Python code (from request or template)
        python_code = request.pythonCode
        
        if not python_code and request.templateId:
            # Load pre-built code from template
            from strategy_templates import get_template_code
            python_code = get_template_code(request.templateId)
            if not python_code:
                raise HTTPException(status_code=400, detail=f"Template not found: {request.templateId}")
        
        if not python_code:
            raise HTTPException(status_code=400, detail="No Python code provided and no template specified")
        
        # Execute backtest using backtesting.py
        from backtesting import Backtest, Strategy
        from backtesting.lib import crossover
        from backtesting.test import SMA
        import pandas as pd
        import yfinance as yf
        
        # Fetch historical data
        print(f"[BACKTEST-PY] Fetching data for {request.symbol}...")
        ticker = yf.Ticker(request.symbol)
        df = ticker.history(start=request.startDate, end=request.endDate)
        
        if df.empty:
            raise HTTPException(status_code=400, detail=f"No data available for {request.symbol}")
        
        # Prepare data for backtesting.py
        df = df.rename(columns={"Open": "Open", "High": "High", "Low": "Low", "Close": "Close", "Volume": "Volume"})
        
        # Execute the strategy code to get the Strategy class
        local_namespace = {
            "Strategy": Strategy,
            "crossover": crossover,
            "SMA": SMA,
        }
        try:
            exec(python_code, local_namespace)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to execute strategy code: {str(e)}")
        
        # Find the Strategy subclass
        strategy_class = None
        for name, obj in local_namespace.items():
            if isinstance(obj, type) and issubclass(obj, Strategy) and obj != Strategy:
                strategy_class = obj
                break
        
        if not strategy_class:
            raise HTTPException(status_code=400, detail="No Strategy class found in provided code")
        
        # Run backtest
        bt = Backtest(df, strategy_class, cash=request.initialBalance, commission=request.commission)
        stats = bt.run()
        
        # Extract metrics
        metrics = {
            "total_return": float(stats["Return [%]"]) if pd.notna(stats["Return [%]"]) else 0,
            "win_rate": float(stats["Win Rate [%]"]) if pd.notna(stats.get("Win Rate [%]", 0)) else 0,
            "total_trades": int(stats["# Trades"]) if pd.notna(stats["# Trades"]) else 0,
            "max_drawdown": float(stats["Max. Drawdown [%]"]) if pd.notna(stats["Max. Drawdown [%]"]) else 0,
            "sharpe_ratio": float(stats["Sharpe Ratio"]) if pd.notna(stats.get("Sharpe Ratio", 0)) else 0,
            "profit_factor": float(stats.get("Profit Factor", 0)) if pd.notna(stats.get("Profit Factor", 0)) else 0,
        }
        
        # Generate HTML visualization
        visualization_html = None
        raw_stats = None
        try:
            import tempfile
            import os as temp_os
            
            # Create temp file for HTML output
            with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as tmp:
                tmp_path = tmp.name
            
            # Generate plot to file (don't open browser)
            bt.plot(filename=tmp_path, open_browser=False)
            
            # Read the HTML content
            with open(tmp_path, 'r', encoding='utf-8') as f:
                visualization_html = f.read()
            
            # Clean up temp file
            temp_os.unlink(tmp_path)
            
            # Generate raw stats string
            raw_stats = str(stats)
            print(f"[BACKTEST-PY] Generated HTML visualization ({len(visualization_html)} chars)")
            
        except Exception as viz_error:
            print(f"[BACKTEST-PY] Warning: Could not generate visualization: {viz_error}")
            # Continue without visualization - it's optional
        
        return {
            "success": True,
            "metrics": metrics,
            "final_balance": request.initialBalance * (1 + metrics["total_return"] / 100),
            "symbol": request.symbol,
            "start_date": request.startDate,
            "end_date": request.endDate,
            "visualization_html": visualization_html,
            "raw_stats": raw_stats
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("run_backtest_py_code", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/backtest", response_model=BacktestResponse)
async def run_backtest_endpoint(request: BacktestRequest):
    """
    Run backtest using the specified engine (NautilusTrader, Rust, or backtesting.py).
    
    This endpoint handles the full pipeline: XML -> Code -> Backtest.
    """
    try:
        log_api_request("/backtest", request.model_dump())
        print(f"[BACKTEST] Starting backtest for {request.symbol} using engine: {request.engine}")
        
        # Check for pre-compiled code (from frontend)
        if request.precompiledCode:
            strategy_code = request.precompiledCode
            print(f"[BACKTEST] Using precompiled code ({len(strategy_code)} chars)")
        elif request.generatedCode:
            strategy_code = request.generatedCode
            print(f"[BACKTEST] Using generated code ({len(strategy_code)} chars)")
        else:
            # Generate code from XML using the pipeline
            print("[BACKTEST] Generating strategy code from XML...")
            
            # Use the pipeline to convert XML to code
            result = await run_backtest_pipeline(
                xml=request.workspaceXml,
                symbol=request.symbol,
                data_source=request.data_source,
                start_date=request.startDate,
                end_date=request.endDate,
                engine=request.engine,
                initial_balance=request.initialBalance
            )
            
            if not result.get("success"):
                return BacktestResponse(
                    success=False,
                    symbol=request.symbol,
                    start_date=request.startDate,
                    end_date=request.endDate,
                    metrics={"error": result.get("error", "Unknown error")},
                    trades=[],
                    equity_curve=[]
                )
            
            # Return the pipeline result directly if it succeeded
            return BacktestResponse(
                success=True,
                symbol=request.symbol,
                start_date=request.startDate,
                end_date=request.endDate,
                initial_balance=request.initialBalance,
                final_balance=result.get("final_balance", request.initialBalance),
                metrics=result.get("metrics", {}),
                trades=result.get("trades", []),
                equity_curve=result.get("equity_curve", []),
                visualization_html=result.get("visualization_html"),
                raw_stats=result.get("raw_stats")
            )
        
        # Run backtest with pre-compiled code
        use_nautilus = request.engine in ["nautilus", "rust"]
        
        # Validate Nautilus code via LLM if using Nautilus engine
        if use_nautilus and strategy_code:
            print("[BACKTEST] Validating Nautilus code via LLM...")
            strategy_code, was_fixed = await validate_nautilus_code(
                strategy_code, 
                llm_caller=call_gemini
            )
            if was_fixed:
                print("[BACKTEST] Nautilus code was fixed by LLM")
        
        result = run_backtest(
            strategy_code=strategy_code,
            symbol=request.symbol,
            start_date=request.startDate,
            end_date=request.endDate,
            initial_balance=request.initialBalance,
            trade_size=request.tradeSize,
            use_nautilus=use_nautilus
        )
        
        log_backtest(
            request.symbol,
            request.engine,
            result.get("success", False),
            result.get("metrics", {})
        )
        
        return BacktestResponse(
            success=result.get("success", False),
            symbol=result.get("symbol", request.symbol),
            start_date=result.get("start_date", request.startDate),
            end_date=result.get("end_date", request.endDate),
            initial_balance=result.get("initial_balance", request.initialBalance),
            final_balance=result.get("final_balance"),
            best_params=result.get("best_params"),
            best_metric_value=result.get("best_metric_value"),
            params_tested=result.get("params_tested"),
            metrics=result.get("metrics", {}),
            trades=result.get("trades", []),
            equity_curve=result.get("equity_curve", []),
            visualization_html=result.get("visualization_html"),
            raw_stats=result.get("raw_stats")
        )
        
    except Exception as e:
        log_error("run_backtest_endpoint", str(e))
        import traceback
        traceback.print_exc()
        return BacktestResponse(
            success=False,
            symbol=request.symbol,
            start_date=request.startDate,
            end_date=request.endDate,
            metrics={"error": str(e)},
            trades=[],
            equity_curve=[]
        )