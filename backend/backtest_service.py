"""
Backtest Service - Real backtesting using backtesting.py and NautilusTrader

Pipeline:
1. Convert Blockly XML → Python Strategy class (using DeepSeek or AST parser)
2. Fetch historical data (local database, yfinance, or alphavantage)
3. Execute backtest (backtesting.py OR NautilusTrader)
4. Return results
"""

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import json
import re
import traceback
import sys
import math
from llm_logger import log_backtest
from strategy_store import (
    hash_xml,
    load_by_id,
    load_latest_by_hash,
    save_strategy_version,
)

# Import AST-based parser
try:
    from ast_parser import parse_xml_ast, BlocklyASTParser
    AST_PARSER_AVAILABLE = True
except ImportError:
    AST_PARSER_AVAILABLE = False
    print("Warning: AST parser not available, using regex-based parser")

# Import verification module
try:
    from verification import verify_parsed_strategy, verify_generated_code, run_verification_pipeline
    VERIFICATION_AVAILABLE = True
except ImportError:
    VERIFICATION_AVAILABLE = False
    print("Warning: Verification module not available")

# Import JSON-driven code generator (new approach)
try:
    from json_code_generator import generate_strategy_from_json
    JSON_GENERATOR_AVAILABLE = True
except ImportError:
    JSON_GENERATOR_AVAILABLE = False
    print("Warning: JSON code generator not available, using legacy generator")

# Import Rust backtest engine (high-performance)
try:
    import rust_backtest
    RUST_BACKTEST_AVAILABLE = True
    _rust_version = getattr(rust_backtest, '__version__', '0.1.0')
    print(f"Rust backtest engine available (v{_rust_version})")
except ImportError:
    RUST_BACKTEST_AVAILABLE = False
    print("Warning: Rust backtest engine not available, using Python fallback")

# Import Nautilus Adapter
try:
    from nautilus_adapter import run_nautilus_backtest as run_nautilus_adapter_backtest, NAUTILUS_INSTALLED
except ImportError:
    NAUTILUS_INSTALLED = False
    print("Nautilus Adapter not found")


def sanitize_for_json(obj):
    """
    Recursively sanitize an object for JSON serialization.
    Converts NaN, Infinity, -Infinity to None or 0.
    """
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(item) for item in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0  # or None
        return obj
    elif isinstance(obj, (np.floating, np.integer)):
        val = float(obj)
        if math.isnan(val) or math.isinf(val):
            return 0
        return val
    return obj

# backtesting.py imports
from backtesting import Backtest, Strategy
from backtesting.lib import crossover
from backtesting.test import SMA

# Custom EMA function since backtesting.test doesn't export EMA
import numpy as np

def EMA(values, n):
    """
    Exponential Moving Average.
    """
    values = np.asarray(values)
    alpha = 2 / (n + 1)
    ema = np.zeros_like(values, dtype=float)
    ema[0] = values[0]
    for i in range(1, len(values)):
        ema[i] = alpha * values[i] + (1 - alpha) * ema[i-1]
    return ema


# LLM Prompt for XML → Python conversion (Backtesting.py)
XML_TO_PYTHON_PROMPT = """You are a trading strategy code converter.

Convert the following Blockly XML strategy into a Python class compatible with the `backtesting.py` library.

INPUT XML:
{xml}

CRITICAL RULES:
1. Create a class that extends `Strategy` from backtesting.py
2. Use `self.I()` wrapper for ALL indicators
3. DO NOT IMPORT TALIB - it is not available! Use the custom indicator functions below.
4. DO NOT use .shift() on arrays - backtesting.py's _Array objects don't support it. Use indexing instead: array[-1], array[-2]
5. DO NOT use pandas methods on self.data - it's not a DataFrame!

INDICATOR MAPPING:
- ta_sma → use SMA from backtesting.test
- ta_ema → use custom EMA function (defined below)
- ta_rsi → use custom RSI function (defined below) 
- ta_atr → use custom ATR function (defined below)
- operator_greater → >
- operator_less → <
- trade_order direction=long → self.buy()
- trade_order direction=short → self.sell()

RULES:
1. Extract periods from mutation attributes (ma_period, period)
2. Use crossover() for comparing indicators
3. CRITICAL SL/TP RULES:
   - If the strategy XML doesn't specify explicit SL/TP values, DO NOT pass sl/tp to buy()/sell()
   - If using ATR for SL/TP: check that atr_value > 0 before using it
   - For Long: SL = price - atr_value, TP = price + atr_value (only if atr_value > 0)
   - DO NOT pass SL/TP if they would be equal to entry price
   - When in doubt, use self.buy() or self.sell() without sl/tp arguments
   - CRITICAL: Never use modulo (%) on self.data.index (it's DateTime). Use len(self.data) % n == 0 instead.
4. Access price data via: self.data.Close, self.data.Open, self.data.High, self.data.Low

OUTPUT FORMAT:
Return ONLY the Python code. No markdown, no explanation.

REQUIRED TEMPLATE:
