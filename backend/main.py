"""
Local Python Backend for Strategy Generation using DeepSeek API

This backend provides the same functionality as the Supabase Edge Functions
but uses DeepSeek API instead of Gemini.

Run with: uvicorn main:app --reload --port 8000
"""

import os
import re
import httpx
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Strategy Generator API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DeepSeek API configuration
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"


class StrategyRequest(BaseModel):
    message: str
    existingXml: Optional[str] = None


class StrategyResponse(BaseModel):
    xml: str
    ai_fixed: bool = False  # True if programmatic fix was applied


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


class BacktestResponse(BaseModel):
    success: bool
    symbol: str
    start_date: str
    end_date: str
    initial_balance: float
    final_balance: float
    metrics: dict
    trades: list
    equity_curve: list


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
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key or api_key == "your_deepseek_api_key_here":
        raise HTTPException(
            status_code=500,
            detail="DEEPSEEK_API_KEY not configured. Add your key to backend/.env"
        )

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            DEEPSEEK_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"DeepSeek API error: {response.text}"
            )

        data = response.json()
        return data["choices"][0]["message"]["content"]


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
                "model": "deepseek-reasoner",
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


# ============================================================
# Endpoints
# ============================================================

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "Strategy Generator (DeepSeek)",
        "endpoints": [
            "/generate-strategy",
            "/generate-mql",
            "/chat",
            "/backtest",
            "/ig/login",
            "/ig/positions",
            "/ig/position",
            "/ig/trade"
        ]
    }


class ValidateStrategyRequest(BaseModel):
    xml: str


class ValidateStrategyResponse(BaseModel):
    xml: str
    validated: bool
    ai_fixed: bool


@app.post("/validate-strategy", response_model=ValidateStrategyResponse)
async def validate_strategy(request: ValidateStrategyRequest):
    """
    Validate and polish Blockly XML strategy using DeepSeek Reasoning.
    
    Pipeline:
    1. DeepSeek Reasoning validates and fixes identical indicators
    2. Check for crossover issues
    3. Programmatic fallback to fix any remaining issues
    """
    print("=== Validating strategy with DeepSeek Reasoning ===")
    
    input_xml = request.xml
    ai_fixed = False
    
    # Pass 1: DeepSeek Reasoning validation
    try:
        reasoning_messages = [
            {"role": "system", "content": DEEPSEEK_REASONING_VALIDATION_PROMPT},
            {"role": "user", "content": f"Validate and fix this Blockly XML strategy:\n\n{input_xml}"}
        ]
        
        reasoning_response = await call_deepseek_reasoning(reasoning_messages)
        validated_xml = extract_xml(reasoning_response)
        
        if validated_xml:
            block_count = len(re.findall(r'<block ', validated_xml))
            print(f"DeepSeek Reasoning validated: {block_count} blocks")
            ai_fixed = True
        else:
            validated_xml = input_xml
    except Exception as e:
        print(f"DeepSeek Reasoning failed: {e}, using programmatic fix")
        validated_xml = input_xml
    
    # Pass 2: Check for remaining crossover issues
    is_valid, issues = check_crossover_valid(validated_xml)
    
    if not is_valid:
        print(f"Crossover issues found: {issues}, applying programmatic fix")
        fixed_xml, was_fixed = fix_crossover_indicators(validated_xml)
        
        if was_fixed:
            print("Programmatic fix applied")
            ai_fixed = True
            validated_xml = fixed_xml
    
    return ValidateStrategyResponse(
        xml=validated_xml,
        validated=True,
        ai_fixed=ai_fixed
    )


@app.post("/generate-strategy", response_model=StrategyResponse)
async def generate_strategy(request: StrategyRequest):
    """
    Generate Blockly XML strategy using DeepSeek API.
    Uses 4-pass pipeline:
    1. Generate strategy
    2. Validate & fix structure
    3. LLM parameter differentiation
    4. Programmatic fallback for identical indicators
    """
    ai_fixed = False
    
    print("=== PASS 1: Generating strategy ===")
    
    # Build user prompt
    user_prompt = request.message
    if request.existingXml:
        user_prompt = f"Modify this existing strategy:\n\n{request.existingXml}\n\nUser request: {request.message}"
    
    # First pass: Generate strategy
    first_messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]
    
    first_response = await call_deepseek(first_messages)
    first_xml = extract_xml(first_response)
    
    block_count = len(re.findall(r'<block ', first_xml))
    print(f"Pass 1 complete: {block_count} blocks, {len(first_xml)} chars")
    
    # Second pass: Validate and fix structure
    print("=== PASS 2: Validating and fixing strategy ===")
    
    second_messages = [
        {"role": "system", "content": VALIDATION_PROMPT},
        {"role": "user", "content": f"Validate and fix this Blockly XML strategy:\n\n{first_xml}"}
    ]
    
    try:
        second_response = await call_deepseek(second_messages, temperature=0.2)
        validated_xml = extract_xml(second_response)
        if validated_xml:
            block_count = len(re.findall(r'<block ', validated_xml))
            print(f"Pass 2 complete: {block_count} blocks, {len(validated_xml)} chars")
        else:
            validated_xml = first_xml
    except Exception as e:
        print(f"Pass 2 failed: {e}, continuing with Pass 1 result")
        validated_xml = first_xml
    
    # Check for identical crossover indicators
    is_valid, issues = check_crossover_valid(validated_xml)
    
    if not is_valid:
        print(f"=== PASS 3: Fixing indicator parameters (issues: {issues}) ===")
        
        # Third pass: LLM parameter differentiation
        third_messages = [
            {"role": "system", "content": PARAMETER_FIX_PROMPT},
            {"role": "user", "content": f"Fix the indicator parameters in this strategy:\n\n{validated_xml}"}
        ]
        
        try:
            third_response = await call_deepseek(third_messages, temperature=0.1)
            param_fixed_xml = extract_xml(third_response)
            
            if param_fixed_xml:
                # Verify LLM actually fixed it
                still_valid, remaining_issues = check_crossover_valid(param_fixed_xml)
                
                if still_valid:
                    block_count = len(re.findall(r'<block ', param_fixed_xml))
                    print(f"Pass 3 complete (LLM fixed): {block_count} blocks")
                    return StrategyResponse(xml=param_fixed_xml, ai_fixed=False)
                else:
                    print(f"Pass 3 failed to fix: {remaining_issues}, using fallback")
        except Exception as e:
            print(f"Pass 3 failed: {e}, using fallback")
        
        # Fourth pass: Programmatic fallback
        print("=== PASS 4: Programmatic fallback ===")
        fixed_xml, was_fixed = fix_crossover_indicators(validated_xml)
        
        if was_fixed:
            print(f"Pass 4 complete: Programmatically fixed identical indicators")
            ai_fixed = True
            return StrategyResponse(xml=fixed_xml, ai_fixed=True)
        else:
            print("Pass 4: No fixes needed or could not fix")
    
    return StrategyResponse(xml=validated_xml, ai_fixed=ai_fixed)


class ChatRequest(BaseModel):
    messages: list
    blockXml: Optional[str] = None
    currentWorkspace: Optional[str] = None


class ChatResponse(BaseModel):
    response: str


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Conversational chat about trading strategies.
    """
    print("=== Chat endpoint ===")
    
    # Build system prompt for trading assistant
    system_prompt = """You are a helpful trading strategy assistant. You can:
1. Explain trading concepts (RSI, MACD, moving averages, etc.)
2. Suggest strategy improvements
3. Answer questions about trading and technical analysis

Be concise and helpful. Use markdown formatting for better readability."""
    
    # Convert messages to format expected by DeepSeek
    formatted_messages = [{"role": "system", "content": system_prompt}]
    
    for msg in request.messages:
        formatted_messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", "")
        })
    
    # Add workspace context if available
    if request.currentWorkspace:
        block_count = request.currentWorkspace.count("<block ")
        context = f"\n\n[Context: User has {block_count} blocks in their workspace]"
        if formatted_messages:
            formatted_messages[-1]["content"] += context
    
    try:
        response = await call_deepseek(formatted_messages, temperature=0.7)
        return ChatResponse(response=response)
    except Exception as e:
        print(f"Chat error: {e}")
        return ChatResponse(response=f"Sorry, I encountered an error: {str(e)}")


@app.post("/generate-mql", response_model=MqlResponse)
async def generate_mql(request: MqlRequest):
    """
    Generate MQL5 code from Blockly XML using DeepSeek API.
    """
    print("=== Generating MQL code ===")
    
    system_prompt = """You are an expert MQL5 programmer specializing in creating production-quality MetaTrader 5 Expert Advisors.

Your task is to analyze a trading strategy represented as visual blocks (in XML format) and generate complete, compilable MQL5 Expert Advisor code.

REQUIREMENTS:
1. Generate complete, compilable MQL5 code for MetaTrader 5
2. Use proper MQL5 built-in functions
3. Include proper error handling with GetLastError()
4. Include #property directives at the top
5. Implement OnInit(), OnDeinit(), and OnTick() functions
6. Add clear comments explaining the strategy logic
7. Use a MagicNumber to identify orders from this EA
8. Use input variables for configurable parameters

IMPORTANT:
- Return ONLY the MQL5 code without markdown formatting or explanations
- Ensure all indicator calls use correct MQL5 function signatures"""

    user_prompt = f"""Generate a complete MQL5 Expert Advisor for: "{request.strategyName}"

WORKSPACE XML:
```xml
{request.workspaceXml}
```

Generate the complete MQL5 code."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    response = await call_deepseek(messages)
    
    # Clean up markdown formatting
    code = response.strip()
    if code.startswith('```'):
        code = re.sub(r'^```(?:mql5|mql)?\n', '', code)
        code = re.sub(r'\n```$', '', code)
    
    print(f"Generated MQL code: {len(code)} characters")
    
    return MqlResponse(
        mqlCode=code,
        analysis={"errors": [], "warnings": []}
    )


@app.post("/backtest", response_model=BacktestResponse)
async def run_backtest_endpoint(request: BacktestRequest):
    """
    Run backtest on a Blockly strategy.
    
    1. Converts Blockly XML to strategy code via LLM
    2. Tries to fetch real data from IG if authenticated
    3. Falls back to synthetic data if IG not available
    4. Returns metrics, trades, and equity curve
    """
    print(f"=== Running backtest for {request.symbol} ===")
    print(f"Period: {request.startDate} to {request.endDate}")
    
    # Import backtest runner (lazy import to avoid startup issues)
    from backtest_runner import run_backtest, fetch_real_data_from_ig
    from strategy_converter import convert_xml_to_strategy, get_fallback_strategy
    
    # Try to get real data from IG if client is authenticated
    historical_data = None
    data_source = "synthetic"
    
    client = get_ig_client()
    if client.is_authenticated:
        try:
            print("Fetching real data from IG...")
            historical_data = await fetch_real_data_from_ig(
                ig_client=client,
                symbol=request.symbol,
                start_date=request.startDate,
                end_date=request.endDate,
                resolution="HOUR"
            )
            data_source = "IG API"
            print(f"Fetched {len(historical_data)} bars from IG")
        except Exception as e:
            print(f"Failed to fetch IG data: {e}, using synthetic")
            historical_data = None
    else:
        print("IG not authenticated, using synthetic data")
    
    try:
        # Convert XML to strategy code
        print("Converting XML to strategy code...")
        strategy_code = await convert_xml_to_strategy(
            xml=request.workspaceXml,
            strategy_name="BlocklyStrategy",
            instrument_id=f"{request.symbol}.SIM"
        )
        print(f"Strategy code generated: {len(strategy_code)} chars")
    except Exception as e:
        print(f"Strategy conversion failed: {e}, using fallback")
        strategy_code = get_fallback_strategy()
    
    # Run backtest
    print(f"Running backtest simulation (data source: {data_source})...")
    result = run_backtest(
        strategy_code=strategy_code,
        symbol=request.symbol,
        start_date=request.startDate,
        end_date=request.endDate,
        initial_balance=request.initialBalance,
        trade_size=request.tradeSize,
        historical_data=historical_data
    )
    
    print(f"Backtest complete: {result['metrics']['total_trades']} trades")
    
    # Add data source to result
    result['data_source'] = data_source
    
    return BacktestResponse(
        success=result['success'],
        symbol=result['symbol'],
        start_date=result['start_date'],
        end_date=result['end_date'],
        initial_balance=result['initial_balance'],
        final_balance=result['final_balance'],
        metrics=result['metrics'],
        trades=result['trades'],
        equity_curve=result['equity_curve']
    )


# ============================================================
# IG Trading API Endpoints
# ============================================================

# Global IG client instance (lazy initialized)
_ig_client = None


def get_ig_client():
    """Get or create IG client instance."""
    global _ig_client
    if _ig_client is None:
        from ig_client import IGClient
        _ig_client = IGClient(use_demo=True)
    return _ig_client


@app.post("/ig/login")
async def ig_login(request: IGLoginRequest = None):
    """
    Authenticate with IG Trading API.
    Uses credentials from .env if not provided in request.
    """
    print("=== IG Login ===")
    client = get_ig_client()
    
    # Override credentials if provided in request
    if request:
        if request.api_key:
            client.api_key = request.api_key
        if request.username:
            client.username = request.username
        if request.password:
            client.password = request.password
    
    result = await client.login()
    
    if result.get("success"):
        print(f"Logged in to IG account: {result.get('account_id')}")
    else:
        print(f"Login failed: {result.get('error')}")
    
    return result


@app.get("/ig/positions")
async def ig_get_positions():
    """Get all open positions from IG account."""
    client = get_ig_client()
    
    if not client.is_authenticated:
        return {"success": False, "error": "Not authenticated. Call /ig/login first."}
    
    return await client.get_positions()


@app.post("/ig/position")
async def ig_create_position(request: IGPositionRequest):
    """
    Open a new position on IG.
    
    Epic examples:
    - CS.D.EURUSD.CFD.IP (EUR/USD)
    - CS.D.GBPUSD.CFD.IP (GBP/USD)
    """
    print(f"=== IG Create Position: {request.direction} {request.size} {request.epic} ===")
    client = get_ig_client()
    
    if not client.is_authenticated:
        return {"success": False, "error": "Not authenticated. Call /ig/login first."}
    
    result = await client.create_position(
        epic=request.epic,
        direction=request.direction,
        size=request.size,
        stop_distance=request.stop_distance,
        limit_distance=request.limit_distance
    )
    
    return result


@app.post("/ig/trade")
async def ig_trade_by_symbol(request: IGSymbolRequest):
    """
    Trade using symbol name instead of EPIC.
    
    Symbols: EURUSD, GBPUSD, USDJPY, AUDUSD, XAUUSD, BTCUSD
    """
    from ig_client import get_epic_for_symbol
    
    print(f"=== IG Trade: {request.direction} {request.size} {request.symbol} ===")
    
    epic = get_epic_for_symbol(request.symbol)
    if not epic:
        return {
            "success": False,
            "error": f"Unknown symbol: {request.symbol}. Use: EURUSD, GBPUSD, USDJPY, AUDUSD, XAUUSD, BTCUSD"
        }
    
    client = get_ig_client()
    
    if not client.is_authenticated:
        return {"success": False, "error": "Not authenticated. Call /ig/login first."}
    
    return await client.create_position(
        epic=epic,
        direction=request.direction,
        size=request.size
    )


@app.delete("/ig/position/{deal_id}")
async def ig_close_position(deal_id: str):
    """Close an existing position by deal ID."""
    print(f"=== IG Close Position: {deal_id} ===")
    client = get_ig_client()
    
    if not client.is_authenticated:
        return {"success": False, "error": "Not authenticated. Call /ig/login first."}
    
    return await client.close_position(deal_id)


@app.get("/ig/search/{term}")
async def ig_search_markets(term: str):
    """Search for markets by name or symbol."""
    client = get_ig_client()
    
    if not client.is_authenticated:
        return {"success": False, "error": "Not authenticated. Call /ig/login first."}
    
    return await client.search_markets(term)


# ============================================================
# Live Strategy Runner Endpoints
# ============================================================

class StrategyStartRequest(BaseModel):
    workspaceXml: str
    symbol: str = "EURUSD"
    tradeSize: float = 0.5
    pollInterval: int = 60


@app.post("/strategy/start")
async def start_strategy(request: StrategyStartRequest):
    """
    Start running a Blockly strategy against live market data.
    
    The strategy will poll IG for prices and execute trades automatically.
    """
    print(f"=== Starting Strategy Runner for {request.symbol} ===")
    
    client = get_ig_client()
    if not client.is_authenticated:
        return {"success": False, "error": "Not authenticated. Call /ig/login first."}
    
    from strategy_runner import start_strategy_runner
    
    result = await start_strategy_runner(
        ig_client=client,
        xml_strategy=request.workspaceXml,
        symbol=request.symbol,
        trade_size=request.tradeSize,
        poll_interval=request.pollInterval
    )
    
    return result


@app.post("/strategy/stop")
async def stop_strategy():
    """Stop the currently running strategy."""
    print("=== Stopping Strategy Runner ===")
    
    from strategy_runner import stop_strategy_runner
    return stop_strategy_runner()


@app.get("/strategy/status")
async def get_strategy_status():
    """Get the status of the currently running strategy."""
    from strategy_runner import get_runner_status
    return get_runner_status()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
