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


def generate_strategy_from_json(parsed: Dict[str, Any]) -> str:
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
        Complete Python code string for a Strategy class
    """
    block_map = _load_block_map()
    
    # Track what we need to include
    imports: Set[str] = set(block_map.get("imports", {}).get("base", []))
    helpers_needed: Set[str] = set()
    class_params: List[str] = []
    init_lines: List[str] = []
    indicator_vars: Dict[str, str] = {}  # Maps indicator type to value expression
    
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
            print(f"Warning: Unknown indicator type '{ind_type}', skipping")
            continue
        
        spec = block_map.get("indicators", {}).get(block_type)
        if not spec:
            print(f"Warning: No spec found for block type '{block_type}'")
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
    
    return "\n\n".join(code_parts)


def _build_condition_code(parsed: Dict[str, Any], indicator_vars: Dict[str, str], block_map: Dict) -> str:
    """Build the condition/trading logic code for the next() method."""
    
    direction = parsed.get("entry_direction", "long")
    buy_action = "buy" if direction == "long" else "sell"
    sell_action = "sell" if direction == "long" else "buy"
    
    conditions = parsed.get("conditions", [])
    indicators = parsed.get("indicators", [])
    
    # Determine strategy type based on indicators
    has_rsi = any(i["type"] == "RSI" for i in indicators)
    has_sma = any(i["type"] == "SMA" for i in indicators)
    has_ema = any(i["type"] == "EMA" for i in indicators)
    has_macd = any(i["type"] == "MACD" for i in indicators)
    has_bb = any(i["type"] == "BOLLINGER" for i in indicators)
    has_stoch = any(i["type"] == "STOCHASTIC" for i in indicators)
    
    # Count MAs for crossover detection
    sma_count = sum(1 for i in indicators if i["type"] == "SMA")
    ema_count = sum(1 for i in indicators if i["type"] == "EMA")
    
    lines = []
    
    # RSI strategy
    if has_rsi and not (sma_count >= 2 or ema_count >= 2):
        rsi_expr = indicator_vars.get("RSI", "self.rsi[-1]")
        lines.append(f"        # RSI-based entry/exit")
        lines.append(f"        if {rsi_expr} < 30:")
        lines.append(f"            if not self.position:")
        lines.append(f"                self.{buy_action}()")
        lines.append(f"        elif {rsi_expr} > 70:")
        lines.append(f"            if self.position:")
        lines.append(f"                self.position.close()")
    
    # MA Crossover strategy
    elif sma_count >= 2:
        lines.append(f"        # SMA Crossover strategy")
        lines.append(f"        if crossover(self.sma0, self.sma1):")
        lines.append(f"            self.{buy_action}()")
        lines.append(f"        elif crossover(self.sma1, self.sma0):")
        lines.append(f"            if self.position:")
        lines.append(f"                self.position.close()")
    
    elif ema_count >= 2:
        lines.append(f"        # EMA Crossover strategy")
        lines.append(f"        if crossover(self.ema0, self.ema1):")
        lines.append(f"            self.{buy_action}()")
        lines.append(f"        elif crossover(self.ema1, self.ema0):")
        lines.append(f"            if self.position:")
        lines.append(f"                self.position.close()")
    
    # MACD strategy
    elif has_macd:
        lines.append(f"        # MACD crossover strategy")
        lines.append(f"        if crossover(self.macd_line, self.macd_signal):")
        lines.append(f"            if not self.position:")
        lines.append(f"                self.{buy_action}()")
        lines.append(f"        elif crossover(self.macd_signal, self.macd_line):")
        lines.append(f"            if self.position:")
        lines.append(f"                self.position.close()")
    
    # Bollinger Bands strategy
    elif has_bb:
        lines.append(f"        # Bollinger Bands mean reversion")
        lines.append(f"        if self.data.Close[-1] < self.bb_lower[-1]:")
        lines.append(f"            if not self.position:")
        lines.append(f"                self.{buy_action}()")
        lines.append(f"        elif self.data.Close[-1] > self.bb_upper[-1]:")
        lines.append(f"            if self.position:")
        lines.append(f"                self.position.close()")
    
    # Stochastic strategy
    elif has_stoch:
        lines.append(f"        # Stochastic oversold/overbought")
        lines.append(f"        if self.stoch_k[-1] < 20:")
        lines.append(f"            if not self.position:")
        lines.append(f"                self.{buy_action}()")
        lines.append(f"        elif self.stoch_k[-1] > 80:")
        lines.append(f"            if self.position:")
        lines.append(f"                self.position.close()")
    
    # Default: Simple MA strategy
    elif has_sma or has_ema:
        ma_expr = indicator_vars.get("SMA") or indicator_vars.get("EMA", "self.sma0[-1]")
        lines.append(f"        # Price vs MA strategy")
        lines.append(f"        if self.data.Close[-1] > {ma_expr}:")
        lines.append(f"            if not self.position:")
        lines.append(f"                self.{buy_action}()")
        lines.append(f"        elif self.data.Close[-1] < {ma_expr}:")
        lines.append(f"            if self.position:")
        lines.append(f"                self.position.close()")
    
    else:
        # Fallback
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
    # Example parsed data
    test_parsed = {
        "indicators": [
            {"type": "RSI", "period": 14},
        ],
        "entry_direction": "long",
        "conditions": [{"type": "less"}],
    }
    
    code = generate_strategy_from_json(test_parsed)
    print("=" * 60)
    print("Generated Strategy Code:")
    print("=" * 60)
    print(code)
