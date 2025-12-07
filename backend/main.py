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


class MqlRequest(BaseModel):
    workspaceXml: str
    strategyName: Optional[str] = "Trading Strategy"


class MqlResponse(BaseModel):
    mqlCode: str
    analysis: dict


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
        "endpoints": ["/generate-strategy", "/generate-mql"]
    }


@app.post("/generate-strategy", response_model=StrategyResponse)
async def generate_strategy(request: StrategyRequest):
    """
    Generate Blockly XML strategy using DeepSeek API.
    Uses 2-pass pipeline: Generate -> Validate & Fix
    """
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
    
    # Second pass: Validate and fix
    print("=== PASS 2: Validating and fixing strategy ===")
    
    second_messages = [
        {"role": "system", "content": VALIDATION_PROMPT},
        {"role": "user", "content": f"Validate and fix this Blockly XML strategy:\n\n{first_xml}"}
    ]
    
    try:
        second_response = await call_deepseek(second_messages, temperature=0.2)
        final_xml = extract_xml(second_response)
        
        if final_xml:
            final_block_count = len(re.findall(r'<block ', final_xml))
            print(f"Pass 2 complete: {final_block_count} blocks, {len(final_xml)} chars")
            return StrategyResponse(xml=final_xml)
    except Exception as e:
        print(f"Pass 2 failed: {e}, returning Pass 1 result")
    
    return StrategyResponse(xml=first_xml)


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
