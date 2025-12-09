"""
JSON-Driven Strategy Code Generator

This module generates Python strategy code for backtesting.py by reading
block definitions from block_python_map.json instead of hardcoded templates.

Benefits:
- Single source of truth for block-to-Python mapping
- Easy to add new indicators without changing Python code
- Only includes helper functions that are actually needed
- Testable and maintainable
"""

import json
import os
from typing import Dict, Any, List, Set

# Load the block mapping JSON once at module import
_BLOCK_MAP_PATH = os.path.join(os.path.dirname(__file__), "block_python_map.json")
_BLOCK_MAP = None

def _load_block_map() -> Dict[str, Any]:
    """Load the block mapping JSON file (cached)."""
    global _BLOCK_MAP
    if _BLOCK_MAP is None:
        with open(_BLOCK_MAP_PATH, "r") as f:
            _BLOCK_MAP = json.load(f)
    return _BLOCK_MAP


def get_helper_function(name: str) -> str:
    """Get a helper function's code by name."""
    block_map = _load_block_map()
    return block_map.get("helper_functions", {}).get(name, "")


def get_indicator_spec(block_type: str) -> Dict[str, Any]:
    """Get the specification for an indicator block type."""
    block_map = _load_block_map()
    return block_map.get("indicators", {}).get(block_type, {})


def get_strategy_parameters(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract the strategy parameters (as a dictionary of variable_name -> value)
    from the parsed XML, matching the variable names used in the generated code.
    
    This enables injecting new parameter values into cached code.
    """
    block_map = _load_block_map()
    params = {}
    
    indicators = parsed.get("indicators", [])
    
    for idx, indicator in enumerate(indicators):
        ind_type = indicator.get("type", "").upper()
        
        # Map parsed type to block type (same mapping as generate_strategy)
        # TODO: Refactor this mapping to share with generate_strategy if it grows complexity
        # For now, manually synced with generate_strategy lines 79-99
        block_type_mapping = {
            "SMA": "ta_sma", "EMA": "ta_ema", "RSI": "ta_rsi", "ATR": "ta_atr",
            "MACD": "ta_macd", "BOLLINGER": "ta_bb", "STOCHASTIC": "ta_stochastic",
            "CCI": "ta_cci", "WILLIAMS_R": "ta_williams_r", "ADX": "ta_adx",
            "VWAP": "ta_vwap", "SUPERTREND": "ta_supertrend", "SAR": "ta_sar",
            "DONCHIAN": "donchian", "KELTNER": "ta_keltner", "MFI": "ta_mfi",
            "OBV": "ta_obv", "MOMENTUM": "momentum", "DEMA": "dema", "TEMA": "tema",
            "LWMA": "ta_lwma", "SMMA": "ta_smma", "VIDYA": "vidya",
            "ICHIMOKU": "ta_ichimoku", "HIGHEST": "ta_highest", "LOWEST": "ta_lowest",
            "DMI": "ta_dmi", "STDDEV": "stddev", "TRIX": "trix", "RVI": "rvi",
            "CHAIKIN": "chaikin", "FORCE": "force", "AO": "ao", "AC": "ac",
            "ENVELOPES": "envelopes", "AD": "ad", "ADXWILDER": "adxWilder",
            "ALLIGATOR": "alligator", "AMA": "ama", "BEARSPOWER": "bearsPower",
            "BULLSPOWER": "bullsPower", "BWMFI": "bwmfi", "DEMARKER": "demarker",
            "FRAMA": "frama", "GATOR": "gator", "OSMA": "osma",
            "SUPPORT": "ta_support", "RESISTANCE": "ta_resistance", "VOLUMES": "volumes"
        }
        
        block_type = block_type_mapping.get(ind_type, ind_type.lower())
        spec = get_indicator_spec(block_type)
        if not spec:
            continue
            
        param_template = spec.get("class_param", "")
        if not param_template:
            continue
            
        # Parse template to extract variable names and values
        for line in param_template.split("\n"):
            line = line.strip()
            if not line or "=" not in line:
                continue
                
            name_tmpl, val_tmpl = line.split("=", 1)
            name_tmpl = name_tmpl.strip()
            val_tmpl = val_tmpl.strip()
            
            # Extract variable name (replace {idx})
            var_name = name_tmpl.replace("{idx}", str(idx))
            
            # Extract value key (replace {key} -> key)
            # Assumption: val_tmpl is simple like "{period}" or "{fast}"
            if val_tmpl.startswith("{") and val_tmpl.endswith("}"):
                key = val_tmpl[1:-1]
                default_key = f"default_{key}"
                default_val = spec.get(default_key, 14) # fallback
                
                # Get value from indicator dict or default
                val = indicator.get(key, default_val)
                
                # Convert to number if possible
                try:
                    if "." in str(val):
                        val = float(val)
                    else:
                        val = int(val)
                except (ValueError, TypeError):
                    pass
                    
                params[var_name] = val

    return params


def generate_strategy_from_json(parsed: Dict[str, Any]) -> tuple:
    """
    Generate a backtesting.py Strategy class from parsed XML data.
    
    This function uses block_python_map.json to look up the Python code
    for each block type, only including helper functions that are needed.
    
    Args:
        parsed: Dictionary from parse_xml_simple() containing:
            - indicators: List of indicator dicts with type and period
            - entry_direction: "long" or "short"
            - conditions: List of condition types
            - risk_management: Optional risk management settings
    
    Returns:
        Tuple of:
            - code: Complete Python code string for a Strategy class
            - unknown_blocks: List of blocks that couldn't be parsed (for LLM to fill)
    """
    block_map = _load_block_map()
    
    # Track what we need to include
    imports: Set[str] = set(block_map.get("imports", {}).get("base", []))
    helpers_needed: Set[str] = set()
    class_params: List[str] = []
    init_lines: List[str] = []
    indicator_vars: Dict[str, str] = {}  # Maps indicator type to value expression
    unknown_blocks: List[Dict[str, Any]] = []  # Track blocks we couldn't parse
    
    # Process each indicator from parsed XML
    indicators = parsed.get("indicators", [])
    
    for idx, indicator in enumerate(indicators):
        ind_type = indicator.get("type", "").upper()
        
        # Map parsed type to block type
        block_type_mapping = {
            "SMA": "ta_sma",
            "EMA": "ta_ema",
            "RSI": "ta_rsi",
            "ATR": "ta_atr",
            "MACD": "ta_macd",
            "BOLLINGER": "ta_bb",
            "STOCHASTIC": "ta_stochastic",
            "CCI": "ta_cci",
            "WILLIAMS_R": "ta_williams_r",
            "ADX": "ta_adx",
            "VWAP": "ta_vwap",
            "SUPERTREND": "ta_supertrend",
            # New indicators
            "SAR": "ta_sar",
            "DONCHIAN": "donchian",
            "KELTNER": "ta_keltner",
            "MFI": "ta_mfi",
            "OBV": "ta_obv",
            "MOMENTUM": "momentum",
            "DEMA": "dema",
            "TEMA": "tema",
            "LWMA": "ta_lwma",
            "SMMA": "ta_smma",
            "VIDYA": "vidya",
            "ICHIMOKU": "ta_ichimoku",
            "HIGHEST": "ta_highest",
            "LOWEST": "ta_lowest",
            "DMI": "ta_dmi",
            "STDDEV": "stddev",
            "TRIX": "trix",
            "RVI": "rvi",
            "CHAIKIN": "chaikin",
            "FORCE": "force",
            "AO": "ao",
            "AC": "ac",
            "ENVELOPES": "envelopes",
            # New indicators (final batch)
            "AD": "ad",
            "ADXWILDER": "adxWilder",
            "ALLIGATOR": "alligator",
            "AMA": "ama",
            "BEARSPOWER": "bearsPower",
            "BULLSPOWER": "bullsPower",
            "BWMFI": "bwmfi",
            "DEMARKER": "demarker",
            "FRAMA": "frama",
            "GATOR": "gator",
            "OSMA": "osma",
            "SUPPORT": "ta_support",
            "RESISTANCE": "ta_resistance",
            "VOLUMES": "volumes",
        }
        
        block_type = block_type_mapping.get(ind_type)
        if not block_type:
            # Unknown indicator - add placeholder for LLM to fill
            print(f"WARNING: Unknown indicator type '{ind_type}' - adding placeholder for LLM")
            unknown_blocks.append({
                "type": ind_type,
                "original_params": indicator,
                "index": idx
            })
            # Add placeholder in init code for LLM to fill
            init_lines.append(f"# TODO: LLM_FILL - Unknown indicator '{ind_type}' - params: {indicator}")
            init_lines.append(f"# self.unknown_{ind_type.lower()}_{idx} = self.I(???, self.data.Close, ???)  # PLACEHOLDER - LLM must implement")
            continue
        
        spec = block_map.get("indicators", {}).get(block_type)
        if not spec:
            # Block type exists but no spec - also add placeholder
            print(f"WARNING: No spec found for block type '{block_type}' - adding placeholder")
            unknown_blocks.append({
                "type": ind_type,
                "block_type": block_type,
                "original_params": indicator,
                "index": idx,
                "reason": "no_spec"
            })
            init_lines.append(f"# TODO: LLM_FILL - Indicator '{block_type}' has no implementation - params: {indicator}")
            init_lines.append(f"# self.{block_type}_{idx} = self.I(???, self.data.Close, ???)  # PLACEHOLDER - LLM must implement")
            continue
        
        # Collect helper functions needed
        helper = spec.get("helper")
        if helper:
            if isinstance(helper, list):
                helpers_needed.update(helper)
            else:
                helpers_needed.add(helper)
        
        # Collect extra imports
        for imp in spec.get("extra_imports", []):
            imports.add(imp)
        
        # Build class parameter
        param_template = spec.get("class_param", "")
        if param_template:
            # Substitute values
            param = param_template.format(
                idx=idx if "{idx}" in param_template else "",
                period=indicator.get("period", spec.get("default_period", 14)),
                fast=indicator.get("fast", spec.get("default_fast", 12)),
                slow=indicator.get("slow", spec.get("default_slow", 26)),
                signal=indicator.get("signal", spec.get("default_signal", 9)),
                std=indicator.get("std", spec.get("default_std", 2.0)),
                k_period=indicator.get("k_period", spec.get("default_k_period", 14)),
                d_period=indicator.get("d_period", spec.get("default_d_period", 3)),
                multiplier=indicator.get("multiplier", spec.get("default_multiplier", 3.0)),
            )
            # Handle multi-line params
            for line in param.split("\n"):
                if line.strip():
                    class_params.append(line.strip())
        
        # Build init code
        init_template = spec.get("init_code", "")
        if init_template:
            init_code = init_template.format(
                idx=idx if "{idx}" in init_template else "",
            )
            for line in init_code.split("\n"):
                if line.strip():
                    init_lines.append(line.strip())
        
        # Store value expression for conditions
        value_expr = spec.get("value_expr", "")
        if value_expr:
            indicator_vars[ind_type] = value_expr.format(idx=idx if "{idx}" in value_expr else "")
    
    # Build the final code
    code_parts = []
    
    # 1. Imports
    code_parts.append("\n".join(sorted(imports)))
    
    # 2. Helper functions (only those needed)
    helper_funcs = block_map.get("helper_functions", {})
    for helper_name in sorted(helpers_needed):
        if helper_name in helper_funcs:
            code_parts.append(helper_funcs[helper_name])
    
    # 3. Strategy class
    direction = parsed.get("entry_direction", "long")
    buy_action = "buy" if direction == "long" else "sell"
    sell_action = "sell" if direction == "long" else "buy"
    
    # Build condition logic based on indicator types
    condition_code = _build_condition_code(parsed, indicator_vars, block_map)
    
    # Format class parameters with proper indentation
    if class_params:
        params_str = "\n    ".join(class_params)
    else:
        params_str = "pass"
    
    class_code = f"""
class GeneratedStrategy(Strategy):
    # Strategy parameters
    {params_str}
    
    def init(self):
        \"\"\"Initialize indicators\"\"\"
{chr(10).join('        ' + line for line in init_lines) if init_lines else '        pass'}
    
    def next(self):
        \"\"\"Execute trading logic on each bar\"\"\"
{condition_code}
"""
    code_parts.append(class_code)
    
    # Log if there were unknown blocks
    if unknown_blocks:
        print(f"WARNING: {len(unknown_blocks)} block(s) could not be parsed and have placeholders for LLM")
    
    return "\n\n".join(code_parts), unknown_blocks


def _build_compound_condition(conditions: List[Dict], indicator_vars: Dict[str, str]) -> str:
    """
    Build a compound condition expression from parsed conditions.
    Handles AND, OR, NOT operators and comparison operators.
    
    Args:
        conditions: List of condition dicts from parser
        indicator_vars: Dict mapping indicator types to value expressions
    
    Returns:
        Python condition expression string
    """
    # Extract operators from conditions
    has_and = any(c.get("type") == "and" for c in conditions)
    has_or = any(c.get("type") == "or" for c in conditions)
    has_not = any(c.get("type") == "not" for c in conditions)
    
    # Extract comparison type
    comparison_type = None
    for c in conditions:
        if c.get("type") in ("less", "greater", "equals", "less_equals", "greater_equals"):
            comparison_type = c.get("type")
            break
    
    # Build individual indicator conditions
    indicator_conditions = []
    for ind_type, expr in indicator_vars.items():
        if ind_type == "RSI":
            # RSI oversold/overbought
            indicator_conditions.append(f"{expr} < 30")
        elif ind_type in ("CCI", "WILLIAMS_R"):
            indicator_conditions.append(f"{expr} < -80")
        elif ind_type == "MFI":
            indicator_conditions.append(f"{expr} < 20")
        elif ind_type == "STOCHASTIC":
            indicator_conditions.append(f"{expr} < 20")
    
    if not indicator_conditions:
        return ""
    
    # Combine conditions based on operators
    if has_and and len(indicator_conditions) > 1:
        return " and ".join(f"({c})" for c in indicator_conditions)
    elif has_or and len(indicator_conditions) > 1:
        return " or ".join(f"({c})" for c in indicator_conditions)
    else:
        return indicator_conditions[0] if indicator_conditions else "True"


def _detect_strategy_type(parsed: Dict[str, Any]) -> str:
    """
    Detect the strategy type from parsed indicators and conditions.
    Returns: 'crossover', 'oscillator', 'breakout', 'trend', or 'default'
    """
    indicators = parsed.get("indicators", [])
    conditions = parsed.get("conditions", [])
    
    indicator_types = [i.get("type", "").upper() for i in indicators]
    
    # MA Crossover detection
    sma_count = sum(1 for t in indicator_types if t == "SMA")
    ema_count = sum(1 for t in indicator_types if t == "EMA")
    if sma_count >= 2 or ema_count >= 2:
        return "crossover"
    
    # MACD crossover
    if "MACD" in indicator_types:
        return "macd_crossover"
    
    # Oscillator strategy (RSI, Stochastic, CCI)
    oscillators = {"RSI", "STOCHASTIC", "CCI", "WILLIAMS_R", "MFI"}
    if any(t in oscillators for t in indicator_types):
        return "oscillator"
    
    # Breakout (Bollinger, Donchian, Keltner)
    breakout_indicators = {"BOLLINGER", "DONCHIAN", "KELTNER", "SUPPORT", "RESISTANCE"}
    if any(t in breakout_indicators for t in indicator_types):
        return "breakout"
    
    # Trend following (ADX, SuperTrend)
    trend_indicators = {"ADX", "SUPERTREND", "ICHIMOKU"}
    if any(t in trend_indicators for t in indicator_types):
        return "trend"
    
    return "default"


def _build_condition_code(parsed: Dict[str, Any], indicator_vars: Dict[str, str], block_map: Dict) -> str:
    """Build the condition/trading logic code for the next() method.
    
    Improvements:
    - Detects strategy type automatically
    - Handles AND/OR compound conditions
    - Uses thresholds from parsed data when available
    """
    
    direction = parsed.get("entry_direction", "long")
    buy_action = "buy" if direction == "long" else "sell"
    sell_action = "sell" if direction == "long" else "buy"
    
    conditions = parsed.get("conditions", [])
    indicators = parsed.get("indicators", [])
    thresholds = parsed.get("thresholds", {})
    
    # Detect strategy type
    strategy_type = _detect_strategy_type(parsed)
    
    # Check for compound operators
    has_and = any(c.get("type") == "and" for c in conditions)
    has_or = any(c.get("type") == "or" for c in conditions)
    
    lines = []
    
    # Build based on strategy type
    if strategy_type == "crossover":
        # MA Crossover
        sma_count = sum(1 for i in indicators if i.get("type") == "SMA")
        if sma_count >= 2:
            lines.append(f"        # SMA Crossover strategy")
            lines.append(f"        if crossover(self.sma0, self.sma1):")
            lines.append(f"            self.{buy_action}()")
            lines.append(f"        elif crossover(self.sma1, self.sma0):")
            lines.append(f"            if self.position:")
            lines.append(f"                self.position.close()")
        else:  # EMA crossover
            lines.append(f"        # EMA Crossover strategy")
            lines.append(f"        if crossover(self.ema0, self.ema1):")
            lines.append(f"            self.{buy_action}()")
            lines.append(f"        elif crossover(self.ema1, self.ema0):")
            lines.append(f"            if self.position:")
            lines.append(f"                self.position.close()")
    
    elif strategy_type == "macd_crossover":
        lines.append(f"        # MACD crossover strategy")
        lines.append(f"        if crossover(self.macd_line, self.macd_signal):")
        lines.append(f"            if not self.position:")
        lines.append(f"                self.{buy_action}()")
        lines.append(f"        elif crossover(self.macd_signal, self.macd_line):")
        lines.append(f"            if self.position:")
        lines.append(f"                self.position.close()")
    
    elif strategy_type == "oscillator":
        # Build oscillator conditions (RSI, Stoch, CCI, etc.)
        osc_conditions_buy = []
        osc_conditions_sell = []
        
        for ind_type, expr in indicator_vars.items():
            if ind_type == "RSI":
                buy_thresh = thresholds.get("ta_rsi", 30)
                osc_conditions_buy.append(f"{expr} < {buy_thresh}")
                osc_conditions_sell.append(f"{expr} > {100 - buy_thresh}")
            elif ind_type == "STOCHASTIC":
                osc_conditions_buy.append(f"{expr} < 20")
                osc_conditions_sell.append(f"{expr} > 80")
            elif ind_type == "CCI":
                buy_thresh = thresholds.get("ta_cci", -100)
                osc_conditions_buy.append(f"{expr} < {buy_thresh}")
                osc_conditions_sell.append(f"{expr} > {-buy_thresh}")
            elif ind_type == "MFI":
                buy_thresh = thresholds.get("ta_mfi", 20)
                osc_conditions_buy.append(f"{expr} < {buy_thresh}")
                osc_conditions_sell.append(f"{expr} > {100 - buy_thresh}")
            elif ind_type == "WILLIAMS_R":
                buy_thresh = thresholds.get("ta_williams_r", -80)
                osc_conditions_buy.append(f"{expr} < {buy_thresh}")
                osc_conditions_sell.append(f"{expr} > {-100 - buy_thresh}")
        
        # Combine conditions with AND/OR
        if osc_conditions_buy:
            if has_and and len(osc_conditions_buy) > 1:
                buy_cond = " and ".join(f"({c})" for c in osc_conditions_buy)
                sell_cond = " and ".join(f"({c})" for c in osc_conditions_sell)
            elif has_or and len(osc_conditions_buy) > 1:
                buy_cond = " or ".join(f"({c})" for c in osc_conditions_buy)
                sell_cond = " or ".join(f"({c})" for c in osc_conditions_sell)
            else:
                buy_cond = osc_conditions_buy[0]
                sell_cond = osc_conditions_sell[0] if osc_conditions_sell else f"not ({buy_cond})"
            
            lines.append(f"        # Oscillator-based entry/exit")
            lines.append(f"        if {buy_cond}:")
            lines.append(f"            if not self.position:")
            lines.append(f"                self.{buy_action}()")
            lines.append(f"        elif {sell_cond}:")
            lines.append(f"            if self.position:")
            lines.append(f"                self.position.close()")
    
    elif strategy_type == "breakout":
        # Bollinger/Donchian/Keltner breakout
        if any(i.get("type") == "BOLLINGER" for i in indicators):
            lines.append(f"        # Bollinger Bands mean reversion")
            lines.append(f"        if self.data.Close[-1] < self.bb_lower[-1]:")
            lines.append(f"            if not self.position:")
            lines.append(f"                self.{buy_action}()")
            lines.append(f"        elif self.data.Close[-1] > self.bb_upper[-1]:")
            lines.append(f"            if self.position:")
            lines.append(f"                self.position.close()")
        elif any(i.get("type") == "DONCHIAN" for i in indicators):
            lines.append(f"        # Donchian Channel breakout")
            lines.append(f"        if self.data.Close[-1] > self.donchian_upper[-1]:")
            lines.append(f"            if not self.position:")
            lines.append(f"                self.{buy_action}()")
            lines.append(f"        elif self.data.Close[-1] < self.donchian_lower[-1]:")
            lines.append(f"            if self.position:")
            lines.append(f"                self.position.close()")
        else:
            lines.append(f"        # Breakout strategy")
            lines.append(f"        pass  # TODO: Add breakout logic")
    
    elif strategy_type == "trend":
        # ADX/SuperTrend trend following
        if any(i.get("type") == "ADX" for i in indicators):
            lines.append(f"        # ADX trend following")
            lines.append(f"        if self.adx[-1] > 25 and self.plus_di[-1] > self.minus_di[-1]:")
            lines.append(f"            if not self.position:")
            lines.append(f"                self.{buy_action}()")
            lines.append(f"        elif self.adx[-1] > 25 and self.minus_di[-1] > self.plus_di[-1]:")
            lines.append(f"            if self.position:")
            lines.append(f"                self.position.close()")
        elif any(i.get("type") == "SUPERTREND" for i in indicators):
            lines.append(f"        # SuperTrend following")
            lines.append(f"        if self.supertrend[-1] < self.data.Close[-1]:")
            lines.append(f"            if not self.position:")
            lines.append(f"                self.{buy_action}()")
            lines.append(f"        elif self.supertrend[-1] > self.data.Close[-1]:")
            lines.append(f"            if self.position:")
            lines.append(f"                self.position.close()")
        else:
            lines.append(f"        # Trend strategy")
            lines.append(f"        pass  # TODO: Add trend logic")
    
    else:
        # Default: Simple MA if available
        has_sma = any(i.get("type") == "SMA" for i in indicators)
        has_ema = any(i.get("type") == "EMA" for i in indicators)
        if has_sma or has_ema:
            ma_expr = indicator_vars.get("SMA") or indicator_vars.get("EMA", "self.sma0[-1]")
            lines.append(f"        # Price vs MA strategy")
            lines.append(f"        if self.data.Close[-1] > {ma_expr}:")
            lines.append(f"            if not self.position:")
            lines.append(f"                self.{buy_action}()")
            lines.append(f"        elif self.data.Close[-1] < {ma_expr}:")
            lines.append(f"            if self.position:")
            lines.append(f"                self.position.close()")
        else:
            lines.append(f"        # Default strategy (no indicators detected)")
            lines.append(f"        pass")
    
    return "\n".join(lines)


def reload_block_map():
    """Force reload of the block mapping (useful for development)."""
    global _BLOCK_MAP
    _BLOCK_MAP = None
    _load_block_map()


# Test the generator
if __name__ == "__main__":
    # Example parsed data with known indicator
    test_parsed = {
        "indicators": [
            {"type": "RSI", "period": 14},
        ],
        "entry_direction": "long",
        "conditions": [{"type": "less"}],
    }
    
    code, unknown = generate_strategy_from_json(test_parsed)
    print("=" * 60)
    print("Generated Strategy Code (known indicator):")
    print("=" * 60)
    print(code)
    print(f"\nUnknown blocks: {unknown}")
    
    # Test with unknown indicator
    print("\n" + "=" * 60)
    print("Testing with UNKNOWN indicator:")
    print("=" * 60)
    test_unknown = {
        "indicators": [
            {"type": "RSI", "period": 14},
            {"type": "UNKNOWN_XYZ", "period": 10},  # This doesn't exist
        ],
        "entry_direction": "long",
    }
    code2, unknown2 = generate_strategy_from_json(test_unknown)
    print(code2)
    print(f"\nUnknown blocks: {unknown2}")
    
    # Test with compound AND condition (RSI + Stochastic)
    print("\n" + "=" * 60)
    print("Testing COMPOUND condition (RSI AND Stochastic):")
    print("=" * 60)
    test_compound = {
        "indicators": [
            {"type": "RSI", "period": 14},
            {"type": "STOCHASTIC", "k_period": 14, "d_period": 3},
        ],
        "entry_direction": "long",
        "conditions": [
            {"type": "and", "operator": "and"},
            {"type": "less"}
        ],
    }
    code3, unknown3 = generate_strategy_from_json(test_compound)
    print(code3)
    print(f"\nUnknown blocks: {unknown3}")

