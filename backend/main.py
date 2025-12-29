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
from typing import List, Optional, Dict, Any, Tuple
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from datetime import datetime

# RAG & GCG Imports
from rag_system import block_library
from vector_rag import get_vector_rag, two_stage_retrieve, STRATEGY_TYPES
from strategy_compiler import strategy_compiler
from backtest_service import XML_TO_PYTHON_PROMPT
from strategy_store import hash_xml, save_strategy_version, load_by_id, load_latest_by_hash
from ai_strategy_reviewer import review_strategy

# Logging
from llm_logger import (
    log_llm_call, log_conversion, log_backtest, 
    log_strategy_generation, log_general, log_error, 
    log_api_request, get_log_stats
)

# Load environment variables
load_dotenv()

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
GEMINI_MODEL = "gemini-2.0-flash"  # Fast and capable (RECOMMENDED)
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
    if USE_DEEPSEEK_ONLY:
        print("  ⚠️  ALL LLM calls will use DeepSeek (Gemini disabled)")
    else:
        print("  ✓ Using DeepSeek + Gemini (normal mode)")
    print("=" * 60)

# DeepSeek API configuration
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"


class StrategyRequest(BaseModel):
    message: str
    existingXml: Optional[str] = None
    blockXml: Optional[str] = None  # Added for context from attached blocks
    use_rag: bool = False
    ai_model: str = "deepseek"


class StrategyResponse(BaseModel):
    xml: str
    ai_fixed: bool = False  # True if programmatic fix was applied
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
    codeLanguage: Optional[str] = "python"
    strategyId: Optional[str] = None
    templateId: Optional[str] = None  # Pre-built template ID (e.g., "rsi-oversold-reversal")
    precompiledCode: Optional[str] = None  # Pre-generated code (e.g., from nautilusGenerator)


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

SYSTEM_PROMPT = """You are a trading strategy expert that creates Blockly XML code for visual programming.

CRITICAL RULES:
1. You MUST ONLY use blocks listed below - NO OTHER BLOCKS EXIST
2. You MUST follow the EXACT XML structure shown for each block
3. Block IDs must only contain: letters, numbers, underscores, hyphens (NO special characters like (){}[]/#!)
4. All value inputs MUST use <shadow type="math_number"><field name="NUM">value</field></shadow>
5. NEVER invent new block types or modify existing block structures
6. For Stop Loss and Take Profit, ALWAYS use trade_entry_price block with ATR-based offsets for proper risk management
7. Stop Loss pattern: operator_subtract(trade_entry_price, ATR * multiplier) - Use ATR for volatility-adjusted stops
8. Take Profit pattern: operator_add(trade_entry_price, ATR * multiplier * risk_reward_ratio) - Use 2:1 or 3:1 risk-reward ratios
9. INDUSTRY STANDARD: Use ATR (Average True Range) with 14-period for dynamic stop losses that adapt to market volatility
10. RISK MANAGEMENT: Stop Loss = 1.5-2.5x ATR from entry | Take Profit = Stop Loss distance * 2-3 (risk-reward ratio)
11. NEVER use control_wait, control_wait_until, or control_repeat_until blocks. These cause infinite loops in the Strategy Tester. ALWAYS use control_if with environment_new_candle_open for timing logic.
12. ALWAYS set the "SIZE" field to 0.1 in trade_order blocks unless explicitly instructed otherwise. THIS IS CRITICAL. NEVER USE 100.
13. TIMEFRAME: ALL timeframe fields (for both environment blocks and indicators) MUST use minute values. NEVER use string codes like '1h' or '1d'.
    USE THIS MAPPING TABLE:
    - "1 Minute"   -> "1"
    - "5 Minutes"  -> "5"
    - "15 Minutes" -> "15"
    - "30 Minutes" -> "30"
    - "1 Hour"     -> "60"
    - "4 Hours"    -> "240"
    - "1 Day"      -> "1440"
    - "1 Week"     -> "10080"
    - "1 Month"    -> "43200"
    ALWAYS set this to the user's requested timeframe (default to 60 if unspecified).
14. Use ta_highest and ta_lowest blocks for finding highest/lowest values over a period.
15. For Donchian and Keltner blocks, the 'shift' attribute in mutation MUST be a positive integer (>= 1). NEVER use 0.
16. For ALL indicator blocks (including VidYa, AMA, etc.), you MUST explicitly set the 'PERIOD' field to the requested timeframe (in minutes). DO NOT rely on defaults.
17. CROSSOVER STRATEGIES: When comparing two indicators of the SAME type (e.g., SMA vs SMA, EMA vs EMA):
    - ALWAYS use DIFFERENT settings in the <mutation> element (ma_period, shift, etc.)
    - For moving average crossovers: use Fast (shorter period) vs Slow (longer period)
    - Standard patterns: Fast SMA (ma_period="10") vs Slow SMA (ma_period="20")
    - Standard patterns: Fast EMA (ma_period="12") vs Slow EMA (ma_period="26")
    - Set the NAME field to reflect the difference: "Fast SMA" vs "Slow SMA"
    - NEVER compare two identical indicators - this makes NO logical sense for trading

=== AVAILABLE BLOCK TYPES ===

CONTROL BLOCKS:
- control_forever: Main loop block. XML: <block type="control_forever" x="50" y="50"><statement name="DO">...</statement></block>
- control_if: Conditional block. XML: <block type="control_if"><value name="CONDITION">...</value><statement name="DO">...</statement></block>

ENVIRONMENT BLOCKS:
- environment_price: Current price. XML: <block type="environment_price"><field name="TYPE">close</field></block>
- environment_new_candle_open: New candle check. XML: <block type="environment_new_candle_open"><field name="TIMEFRAME">60</field></block>

INDICATOR BLOCKS:
- ta_sma: SMA. XML: <block type="ta_sma"><field name="PERIOD">60</field><mutation ma_period="14" shift="0" applied_price="0"></mutation><field name="NAME">SMA</field></block>
- ta_ema: EMA. XML: <block type="ta_ema"><field name="PERIOD">60</field><mutation ma_period="14" shift="0" applied_price="0"></mutation><field name="NAME">EMA</field></block>
- ta_rsi: RSI. XML: <block type="ta_rsi"><field name="PERIOD">60</field><mutation ma_period="14" applied_price="0"></mutation><field name="NAME">RSI</field></block>
- ta_atr: ATR. XML: <block type="ta_atr"><field name="PERIOD">60</field><mutation ma_period="14"></mutation><field name="NAME">ATR</field></block>
- ta_macd: MACD. XML: <block type="ta_macd"><field name="PERIOD">60</field><mutation fastEMA="12" slowEMA="26" signalSMA="9" applied_price="0"></mutation><field name="NAME">MACD</field><field name="COMPONENT">line</field></block>
- ta_bb: Bollinger Bands. XML: <block type="ta_bb"><field name="PERIOD">60</field><mutation ma_period="20" deviation="2" shift="0" applied_price="0"></mutation><field name="NAME">BB</field><field name="COMPONENT">upper</field></block>

OPERATOR BLOCKS:
- operator_greater: Greater than. XML: <block type="operator_greater"><value name="LEFT">...</value><value name="RIGHT">...</value></block>
- operator_less: Less than. XML: <block type="operator_less"><value name="LEFT">...</value><value name="RIGHT">...</value></block>
- operator_add: Addition. XML: <block type="operator_add"><value name="LEFT">...</value><value name="RIGHT">...</value></block>
- operator_subtract: Subtraction. XML: <block type="operator_subtract"><value name="LEFT">...</value><value name="RIGHT">...</value></block>
- operator_multiply: Multiplication. XML: <block type="operator_multiply"><value name="LEFT">...</value><value name="RIGHT">...</value></block>

TRADE BLOCKS:
- trade_order: Place order. XML: <block type="trade_order"><field name="TRADE_ID">my_trade</field><field name="DIRECTION">long</field><value name="SIZE"><shadow type="math_number"><field name="NUM">0.1</field></shadow></value><field name="LEVERAGE">1</field><field name="ORDER_TYPE">market</field></block>
- trade_stop_loss: Set SL. XML: <block type="trade_stop_loss"><field name="CLOSE_TYPE">full</field><field name="TRADE_ID">my_trade</field><value name="PRICE">...</value></block>
- trade_take_profit: Set TP. XML: <block type="trade_take_profit"><field name="CLOSE_TYPE">full</field><field name="TRADE_ID">my_trade</field><value name="PRICE">...</value></block>
- trade_entry_price: Entry price. XML: <block type="trade_entry_price"><field name="TRADE_ID">my_trade</field></block>

MATH BLOCKS:
- math_number: Number. XML: <shadow type="math_number"><field name="NUM">14</field></shadow>

IMPORTANT: Return ONLY the XML wrapped in <xml></xml> tags. NO explanations."""


VALIDATION_PROMPT = """You are a Blockly XML validator and fixer for trading strategies.

VALIDATION CHECKLIST:
1. BLOCK TYPES - Only these block types are valid:
   - Control: control_if, control_if_else, control_repeat, control_wait, control_forever, control_repeat_until, control_wait_until, control_stop
   - Environment: environment_price, environment_spread, environment_prev_candle_open, environment_prev_ticker_close, environment_is_market_open, environment_time, environment_day_of_week, environment_new_candle_open
   - Operators: operator_equals, operator_greater, operator_less, operator_greater_equals, operator_less_equals, operator_add, operator_subtract, operator_multiply, operator_divide, operator_and, operator_or, operator_not, operator_not_equals, operator_advanced_math
   - Technical Analysis: ac, ad, ta_adx, adxWilder, alligator, ama, ao, ta_atr, bearsPower, ta_bb, bullsPower, bwmfi, ta_cci, chaikin, dema, deMarker, envelopes, force, fractals, gator, ichimoku, ta_ma, ta_macd, mfi, momentum, obv, osma, rvi, parabolicSar, ta_rsi, stddev, stochastic, tema, trix, vidya, volumes, wpr
   - Trade: trade_open, trade_close, trade_stop_loss, trade_take_profit, trade_entry_price, trade_is_open, trade_profit, trade_modify_sl, trade_modify_tp
   - Math: math_number

2. XML STRUCTURE - Verify:
   - All <block> tags have matching </block>
   - All <value> tags have matching </value>
   - All <field> tags have matching </field>
   - Proper nesting (no overlapping tags)
   - First block has x="50" y="50" positioning

3. TRADE_IDs - Must contain only: letters, numbers, underscores, hyphens (NO special characters like (){}[]/#!)

4. RISK MANAGEMENT - Stop Loss and Take Profit should use:
   - trade_entry_price block as base
   - ATR-based offsets for volatility adjustment
   - Pattern: operator_subtract(trade_entry_price, ATR * multiplier) for SL
   - Pattern: operator_add(trade_entry_price, ATR * multiplier * RR) for TP

5. VALUE INPUTS - All numeric inputs must use: <shadow type="math_number"><field name="NUM">value</field></shadow>

6. CROSSOVER LOGIC - When two indicators of the SAME type are compared (inside operator_greater, operator_less, etc.):
   - Check the <mutation> attributes (ma_period, shift, applied_price, etc.)
   - If BOTH indicators have IDENTICAL mutation attributes, this is an ERROR - FIX IT
   - Standard crossover patterns to use:
     * SMA crossover: Fast SMA (ma_period="10") vs Slow SMA (ma_period="20")
     * EMA crossover: Fast EMA (ma_period="12") vs Slow EMA (ma_period="26")
     * RSI dual: Fast RSI (ma_period="7") vs Slow RSI (ma_period="14")
   - Update the NAME field to reflect the difference: "Fast SMA" vs "Slow SMA"
   - Two identical indicators compared makes NO trading sense and must be fixed

INSTRUCTIONS:
- If you find ANY errors, FIX THEM and return the corrected XML
- If the XML is correct, return it unchanged
- Return ONLY the XML wrapped in <xml></xml> tags
- NO explanations, NO comments, ONLY the XML"""


PARAMETER_FIX_PROMPT = """You are analyzing a Blockly XML trading strategy for INDICATOR PARAMETER issues.

YOUR TASK: Find comparison blocks (operator_greater, operator_less, operator_greater_equals, operator_less_equals) 
that compare TWO indicators of the SAME TYPE with IDENTICAL settings.

For example: SMA vs SMA where both have ma_period="14" - this is WRONG for a crossover strategy.

HOW TO FIX:
1. Identify the FIRST indicator in each comparison → Make it "Fast" with SHORTER period
2. Identify the SECOND indicator → Make it "Slow" with LONGER period

STANDARD CROSSOVER PERIODS:
- SMA: Fast ma_period="10", Slow ma_period="20"
- EMA: Fast ma_period="12", Slow ma_period="26"  
- RSI: Fast ma_period="7", Slow ma_period="14"

ALSO UPDATE THE NAME FIELD:
- First indicator: NAME="Fast SMA" (or Fast EMA, etc.)
- Second indicator: NAME="Slow SMA" (or Slow EMA, etc.)

Return ONLY the corrected XML wrapped in <xml></xml> tags. NO explanations."""

# DeepSeek Reasoning validation prompt (for Pass 2)
DEEPSEEK_REASONING_VALIDATION_PROMPT = """You are validating a Blockly XML trading strategy generated by another AI.

=== VALID BLOCK STRUCTURES ===

CONTROL BLOCKS:
- control_forever: <block type="control_forever" x="50" y="50"><statement name="DO">...</statement></block>
- control_if: <block type="control_if"><value name="CONDITION">...</value><statement name="DO">...</statement></block>
- control_if_else: <block type="control_if_else"><value name="CONDITION">...</value><statement name="DO">...</statement><statement name="ELSE">...</statement></block>

COMPARISON OPERATORS:
- operator_greater: <block type="operator_greater"><value name="LEFT">...</value><value name="RIGHT">...</value></block>
- operator_less: <block type="operator_less"><value name="LEFT">...</value><value name="RIGHT">...</value></block>
- operator_greater_equals: <block type="operator_greater_equals"><value name="LEFT">...</value><value name="RIGHT">...</value></block>
- operator_less_equals: <block type="operator_less_equals"><value name="LEFT">...</value><value name="RIGHT">...</value></block>
- operator_and: <block type="operator_and"><value name="LEFT">...</value><value name="RIGHT">...</value></block>
- operator_or: <block type="operator_or"><value name="LEFT">...</value><value name="RIGHT">...</value></block>

MATH OPERATORS:
- operator_add: <block type="operator_add"><value name="LEFT">...</value><value name="RIGHT">...</value></block>
- operator_subtract: <block type="operator_subtract"><value name="LEFT">...</value><value name="RIGHT">...</value></block>
- operator_multiply: <block type="operator_multiply"><value name="LEFT">...</value><value name="RIGHT">...</value></block>
- operator_divide: <block type="operator_divide"><value name="LEFT">...</value><value name="RIGHT">...</value></block>
- math_number: <shadow type="math_number"><field name="NUM">value</field></shadow>

INDICATOR BLOCKS:
- ta_sma: <block type="ta_sma"><mutation ma_period="14" shift="0" applied_price="0"></mutation><field name="NAME">SMA</field><field name="PERIOD">60</field></block>
- ta_ema: <block type="ta_ema"><mutation ma_period="14" shift="0" applied_price="0"></mutation><field name="NAME">EMA</field><field name="PERIOD">60</field></block>
- ta_rsi: <block type="ta_rsi"><mutation ma_period="14" applied_price="0"></mutation><field name="NAME">RSI</field><field name="PERIOD">60</field></block>
- ta_atr: <block type="ta_atr"><mutation ma_period="14"></mutation><field name="NAME">ATR</field><field name="PERIOD">60</field></block>
- ta_macd: <block type="ta_macd"><mutation fastEMA="12" slowEMA="26" signalSMA="9" applied_price="0"></mutation><field name="NAME">MACD</field><field name="PERIOD">60</field><field name="COMPONENT">line|signal|histogram</field></block>
- ta_bb: <block type="ta_bb"><mutation ma_period="20" deviation="2" shift="0" applied_price="0"></mutation><field name="NAME">BB</field><field name="PERIOD">60</field><field name="COMPONENT">upper|middle|lower</field></block>
- ta_cci: <block type="ta_cci"><mutation ma_period="14" applied_price="0"></mutation><field name="NAME">CCI</field><field name="PERIOD">60</field></block>
- ta_adx: <block type="ta_adx"><mutation ma_period="14"></mutation><field name="NAME">ADX</field><field name="PERIOD">60</field></block>

ENVIRONMENT BLOCKS:
- environment_price: <block type="environment_price"><field name="TYPE">close|open|high|low</field></block>
- environment_new_candle_open: <block type="environment_new_candle_open"><field name="TIMEFRAME">60</field></block>

TRADE BLOCKS:
- trade_order: <block type="trade_order"><field name="TRADE_ID">my_trade</field><field name="DIRECTION">long|short</field><value name="SIZE"><shadow type="math_number"><field name="NUM">0.1</field></shadow></value><field name="LEVERAGE">1</field><field name="ORDER_TYPE">market</field><next>...</next></block>
- trade_stop_loss: <block type="trade_stop_loss"><field name="CLOSE_TYPE">full</field><field name="TRADE_ID">my_trade</field><value name="PRICE">...</value><next>...</next></block>
- trade_take_profit: <block type="trade_take_profit"><field name="CLOSE_TYPE">full</field><field name="TRADE_ID">my_trade</field><value name="PRICE">...</value></block>
- trade_entry_price: <block type="trade_entry_price"><field name="TRADE_ID">my_trade</field></block>

=== VALIDATION TASKS ===

1. IDENTICAL INDICATORS: Find comparison blocks where TWO indicators of the SAME TYPE have IDENTICAL mutation parameters.
   - This is an ERROR for crossover strategies (e.g., SMA(ma_period="14") > SMA(ma_period="14") makes no sense)
   - FIX: Make one Fast (shorter period) and one Slow (longer period)
   - Standard periods: SMA Fast=10/Slow=20, EMA Fast=12/Slow=26, RSI Fast=7/Slow=14
   - for example: it should NOT be like this (mutation ma_period="14" shift="0") for every indicator

2. COMPARISON LOGIC: Ensure crossover comparisons are logical:
   - For bullish crossover (Fast crossing above Slow): Fast > Slow with operator_greater
   - For bearish crossover (Fast crossing below Slow): Fast < Slow with operator_less
   - If indicators are in wrong order (Slow on LEFT, Fast on RIGHT), swap the comparison operator

3. BLOCK STRUCTURE: Verify all blocks follow the structure above:
   - Correct nesting of <value>, <statement>, <next>, <field>
   - Proper mutation attributes for indicators
   - All TRADE_ID fields match between order and SL/TP blocks

4. POLISH:
   - Ensure NAME fields reflect Fast/Slow: "Fast SMA", "Slow SMA"
   - Timeframe fields should be in minutes (60 for 1 hour)
   - SIZE should be 0.1 (not 100)

Return ONLY the corrected XML wrapped in <xml></xml> tags. NO explanations, NO reasoning visible."""


def check_crossover_valid(xml: str) -> tuple[bool, list[str]]:
    """
    Check if comparison blocks have different indicator settings.
    
    Returns:
        (is_valid, list of issues found)
    """
    issues = []
    
    # Find all ta_sma, ta_ema, ta_rsi blocks and their ma_period values
    indicator_pattern = r'<block type="(ta_sma|ta_ema|ta_rsi)"[^>]*>.*?<mutation ma_period="(\d+)"'
    
    # Find comparison blocks
    comparison_pattern = r'<block type="(operator_greater|operator_less|operator_greater_equals|operator_less_equals)"[^>]*>(.*?)</block>'
    
    import re
    comparisons = re.findall(comparison_pattern, xml, re.DOTALL)
    
    for op_type, content in comparisons:
        # Find indicators in LEFT and RIGHT values
        left_match = re.search(r'<value name="LEFT">(.*?)</value>', content, re.DOTALL)
        right_match = re.search(r'<value name="RIGHT">(.*?)</value>', content, re.DOTALL)
        
        if left_match and right_match:
            left_content = left_match.group(1)
            right_content = right_match.group(1)
            
            # Check if both are same indicator type
            left_indicator = re.search(r'<block type="(ta_sma|ta_ema|ta_rsi)"', left_content)
            right_indicator = re.search(r'<block type="(ta_sma|ta_ema|ta_rsi)"', right_content)
            
            if left_indicator and right_indicator:
                if left_indicator.group(1) == right_indicator.group(1):
                    # Same indicator type - check if periods are identical
                    left_period = re.search(r'ma_period="(\d+)"', left_content)
                    right_period = re.search(r'ma_period="(\d+)"', right_content)
                    
                    if left_period and right_period:
                        if left_period.group(1) == right_period.group(1):
                            issues.append(f"Identical {left_indicator.group(1)} indicators with ma_period={left_period.group(1)}")
    
    return (len(issues) == 0, issues)


def fix_crossover_indicators(xml: str) -> tuple[str, bool]:
    """
    Programmatically fix identical indicators in comparison blocks.
    
    Enhanced to:
    1. Fix indicator periods (Fast vs Slow)
    2. Swap comparison operators if indicators are in wrong order
    3. Support more indicator types
    
    Returns:
        (fixed_xml, was_fixed)
    """
    import re
    
    # Default periods for fast/slow
    FAST_SLOW_PERIODS = {
        'ta_sma': ('10', '20'),
        'ta_ema': ('12', '26'),
        'ta_rsi': ('7', '14'),
        'ta_cci': ('10', '20'),
        'ta_adx': ('7', '14'),
        'ta_atr': ('7', '14'),
    }
    
    # Operator swap mapping
    OPERATOR_SWAP = {
        'operator_greater': 'operator_less',
        'operator_less': 'operator_greater',
        'operator_greater_equals': 'operator_less_equals',
        'operator_less_equals': 'operator_greater_equals',
    }
    
    was_fixed = False
    fixed_xml = xml
    
    # Find comparison blocks
    comparison_pattern = r'(<block type="(operator_greater|operator_less|operator_greater_equals|operator_less_equals)"[^>]*>)(.*?)(</block>)'
    
    def fix_comparison(match):
        nonlocal was_fixed
        opening_tag = match.group(1)
        operator_type = match.group(2)
        content = match.group(3)
        closing_tag = match.group(4)
        
        # Find LEFT and RIGHT values
        left_match = re.search(r'(<value name="LEFT">)(.*?)(</value>)', content, re.DOTALL)
        right_match = re.search(r'(<value name="RIGHT">)(.*?)(</value>)', content, re.DOTALL)
        
        if not left_match or not right_match:
            return match.group(0)
        
        left_content = left_match.group(2)
        right_content = right_match.group(2)
        
        # Check if both are same indicator type with same period
        for indicator_type, (fast_period, slow_period) in FAST_SLOW_PERIODS.items():
            left_indicator = re.search(rf'<block type="{indicator_type}"', left_content)
            right_indicator = re.search(rf'<block type="{indicator_type}"', right_content)
            
            if left_indicator and right_indicator:
                left_period_match = re.search(r'ma_period="(\d+)"', left_content)
                right_period_match = re.search(r'ma_period="(\d+)"', right_content)
                
                if left_period_match and right_period_match:
                    left_period = int(left_period_match.group(1))
                    right_period = int(right_period_match.group(1))
                    
                    # Case 1: Identical periods - fix them
                    if left_period == right_period:
                        indicator_name = indicator_type.replace('ta_', '').upper()
                        
                        # Update LEFT (Fast)
                        new_left = re.sub(r'ma_period="\d+"', f'ma_period="{fast_period}"', left_content)
                        new_left = re.sub(r'<field name="NAME">[^<]*</field>', f'<field name="NAME">Fast {indicator_name}</field>', new_left)
                        
                        # Update RIGHT (Slow)
                        new_right = re.sub(r'ma_period="\d+"', f'ma_period="{slow_period}"', right_content)
                        new_right = re.sub(r'<field name="NAME">[^<]*</field>', f'<field name="NAME">Slow {indicator_name}</field>', new_right)
                        
                        # Rebuild content
                        new_content = content.replace(left_content, new_left).replace(right_content, new_right)
                        was_fixed = True
                        return opening_tag + new_content + closing_tag
                    
                    # Case 2: LEFT period > RIGHT period (backwards for crossover)
                    # For bullish crossover with operator_greater, Fast should be on LEFT
                    # If LEFT has larger period, swap the operator
                    elif left_period > right_period:
                        indicator_name = indicator_type.replace('ta_', '').upper()
                        
                        # Swap operator type
                        swapped_operator = OPERATOR_SWAP.get(operator_type, operator_type)
                        new_opening_tag = opening_tag.replace(f'type="{operator_type}"', f'type="{swapped_operator}"')
                        
                        # Also update names to reflect Fast/Slow
                        new_left = re.sub(r'<field name="NAME">[^<]*</field>', f'<field name="NAME">Slow {indicator_name}</field>', left_content)
                        new_right = re.sub(r'<field name="NAME">[^<]*</field>', f'<field name="NAME">Fast {indicator_name}</field>', right_content)
                        
                        new_content = content.replace(left_content, new_left).replace(right_content, new_right)
                        was_fixed = True
                        return new_opening_tag + new_content + closing_tag
        
        return match.group(0)
    
    fixed_xml = re.sub(comparison_pattern, fix_comparison, xml, flags=re.DOTALL)
    
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
    max_tokens: int = 4000
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

    # Convert OpenAI-style messages to Gemini format
    contents = []
    system_instruction = None
    
    for msg in messages:
        if msg["role"] == "system":
            system_instruction = {"parts": [{"text": msg["content"]}]}
        elif msg["role"] == "user":
            contents.append({"role": "user", "parts": [{"text": msg["content"]}]})
        elif msg["role"] == "assistant":
            contents.append({"role": "model", "parts": [{"text": msg["content"]}]})

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens
        }
    }
    
    if system_instruction:
        payload["systemInstruction"] = system_instruction

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            url,
            headers={"Content-Type": "application/json"},
            json=payload
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Gemini API error: {response.text}"
            )

        data = response.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            return "Error: No content generated by Gemini"


async def call_lovable_gemini(
    messages: list[dict],
    temperature: float = 0.3,
    max_tokens: int = 8000
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
        "model": "google/gemini-3-pro",
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
    """Extract XML content from response."""
    content = content.strip()
    
    # Try to extract <xml>...</xml>
    xml_match = re.search(r'<xml[^>]*>[\s\S]*</xml>', content, re.IGNORECASE)
    if xml_match:
        return xml_match.group(0)
    
    # If no xml tags, try to find any content that looks like XML
    if content.startswith('<'):
        return content
    
    return content


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
    if cleaned.startswith("