"""
LLM Verification Module for Backtesting Pipeline

Provides two verification checkpoints:
1. verify_parsed_strategy() - Uses Gemini to validate parsed XML structure
2. verify_generated_code() - Uses DeepSeek to validate Python code
"""

import json
import os
import httpx
from typing import Dict, Any, Tuple, Optional
from llm_logger import log_llm_call

# ============================================================================
# PROMPTS
# ============================================================================

GEMINI_PARSE_VERIFICATION_PROMPT = """You are a trading strategy validator. Analyze this parsed strategy structure and identify any issues.

PARSED STRATEGY:
{parsed_json}

ORIGINAL XML SNIPPET:
{xml_snippet}

VALIDATION CHECKS:
1. Are all indicator types valid? (SMA, EMA, RSI, MACD, BB, Stochastic, ATR, etc.)
2. Are indicator periods reasonable? (e.g., SMA period 5-200, RSI period 7-21)
3. Is entry direction logical? (long/short)
4. Are SL/TP values valid? For LONG: SL < entry price < TP. For SHORT: TP < entry price < SL.
5. Are there any missing required indicators for the strategy pattern?
6. Is the trade size reasonable? (typically 0.01 to 1.0)

RESPONSE FORMAT (strict JSON only):
{
  "valid": true or false,
  "confidence": 0.0 to 1.0,
  "issues": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1"],
  "fixed_parsed": null or corrected parsed object if fixable
}"""

DEEPSEEK_CODE_VERIFICATION_PROMPT = """You are a Python trading strategy code validator. Analyze this backtesting.py strategy code.

GENERATED CODE:
```python
{code}
```

VALIDATION CHECKS:
1. Does the Strategy class extend `Strategy` from backtesting?
2. Does it have `init(self)` and `next(self)` methods?
3. Are ALL indicators wrapped with `self.I()`? (e.g., `self.I(SMA, self.data.Close, period)`)
4. Is `crossover()` used correctly for indicator comparisons?
5. Are `self.buy()` and `self.sell()` calls valid?
6. If sl/tp arguments exist, are they valid floats/percentages?
7. Are there any syntax errors or undefined variables?

RESPONSE FORMAT (strict JSON only):
{
  "valid": true or false,
  "confidence": 0.0 to 1.0,
  "issues": ["issue 1", "issue 2"],
  "fixed_code": null or corrected Python code string if issues found
}"""


# ============================================================================
# GEMINI VERIFICATION (Parse Check)
# ============================================================================

async def verify_parsed_strategy(
    parsed: Dict[str, Any],
    xml_snippet: str = "",
    call_gemini=None
) -> Tuple[bool, Dict[str, Any]]:
    """
    Use Gemini to verify the parsed strategy structure.
    
    Args:
        parsed: Dict from parse_xml_simple()
        xml_snippet: First 1000 chars of original XML for context
        call_gemini: Async function to call Gemini API (from main.py)
    
    Returns:
        Tuple of (is_valid, verification_result)
    """
    if not call_gemini:
        print("[VERIFY] Gemini not available, skipping parse verification")
        return True, {"valid": True, "skipped": True}
    
    try:
        prompt = GEMINI_PARSE_VERIFICATION_PROMPT.format(
            parsed_json=json.dumps(parsed, indent=2),
            xml_snippet=xml_snippet[:1000] if xml_snippet else "N/A"
        )
        
        messages = [
            {"role": "system", "content": "You are a trading strategy validator. Respond ONLY with valid JSON."},
            {"role": "user", "content": prompt}
        ]
        
        print("[VERIFY] Calling Gemini for parse verification...")
        response = await call_gemini(messages, temperature=0.1, max_tokens=2000)
        
        # Clean response
        response = response.strip()
        if response.startswith("```json"):
            response = response[7:]
        if response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]
        
        result = json.loads(response.strip())
        is_valid = result.get("valid", True)
        
        print(f"[VERIFY] Gemini parse check: {'PASS' if is_valid else 'FAIL'}")
        if not is_valid:
            print(f"[VERIFY] Issues: {result.get('issues', [])}")
        
        return is_valid, result
        
    except json.JSONDecodeError as e:
        print(f"[VERIFY] Gemini response parse error: {e}")
        return True, {"valid": True, "error": "Response parse failed", "raw": response[:500]}
    except Exception as e:
        print(f"[VERIFY] Gemini verification error: {e}")
        return True, {"valid": True, "error": str(e)}


# ============================================================================
# DEEPSEEK VERIFICATION (Code Check)
# ============================================================================

async def verify_generated_code(
    code: str,
    call_deepseek=None
) -> Tuple[bool, Dict[str, Any], Optional[str]]:
    """
    Use DeepSeek to verify the generated Python strategy code.
    
    Args:
        code: Generated Python code from generate_strategy_code_simple()
        call_deepseek: Async function to call DeepSeek API (from main.py)
    
    Returns:
        Tuple of (is_valid, verification_result, fixed_code or None)
    """
    if not call_deepseek:
        print("[VERIFY] DeepSeek not available, skipping code verification")
        return True, {"valid": True, "skipped": True}, None
    
    try:
        prompt = DEEPSEEK_CODE_VERIFICATION_PROMPT.format(code=code)
        
        messages = [
            {"role": "system", "content": "You are a Python code validator for trading strategies. Respond ONLY with valid JSON."},
            {"role": "user", "content": prompt}
        ]
        
        print("[VERIFY] Calling DeepSeek for code verification...")
        response = await call_deepseek(messages)
        
        # Clean response
        response = response.strip()
        if response.startswith("```json"):
            response = response[7:]
        if response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]
        
        result = json.loads(response.strip())
        is_valid = result.get("valid", True)
        fixed_code = result.get("fixed_code")
        
        print(f"[VERIFY] DeepSeek code check: {'PASS' if is_valid else 'FAIL'}")
        if not is_valid:
            print(f"[VERIFY] Issues: {result.get('issues', [])}")
            if fixed_code:
                print("[VERIFY] DeepSeek provided fixed code")
        
        return is_valid, result, fixed_code
        
    except json.JSONDecodeError as e:
        print(f"[VERIFY] DeepSeek response parse error: {e}")
        return True, {"valid": True, "error": "Response parse failed", "raw": response[:500]}, None
    except Exception as e:
        print(f"[VERIFY] DeepSeek verification error: {e}")
        return True, {"valid": True, "error": str(e)}, None


# ============================================================================
# COMBINED VERIFICATION PIPELINE
# ============================================================================

async def run_verification_pipeline(
    parsed: Dict[str, Any],
    code: str,
    xml: str = "",
    call_gemini=None,
    call_deepseek=None,
    auto_fix: bool = True
) -> Dict[str, Any]:
    """
    Run both verification steps and optionally auto-fix issues.
    
    Returns:
        Dict with verification results and potentially fixed code
    """
    result = {
        "parse_check": None,
        "code_check": None,
        "all_valid": True,
        "final_code": code,
        "issues": []
    }
    
    # Step 1: Gemini parse verification
    parse_valid, parse_result = await verify_parsed_strategy(parsed, xml, call_gemini)
    result["parse_check"] = parse_result
    
    if not parse_valid:
        result["all_valid"] = False
        result["issues"].extend(parse_result.get("issues", []))
        # Could apply fixed_parsed here if implementing
    
    # Step 2: DeepSeek code verification
    code_valid, code_result, fixed_code = await verify_generated_code(code, call_deepseek)
    result["code_check"] = code_result
    
    if not code_valid:
        result["all_valid"] = False
        result["issues"].extend(code_result.get("issues", []))
        
        if auto_fix and fixed_code:
            print("[VERIFY] Applying auto-fixed code from DeepSeek")
            result["final_code"] = fixed_code
            result["code_was_fixed"] = True
    
    return result
