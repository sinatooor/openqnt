#!/usr/bin/env python
"""Test imports step by step to find where the hang is."""

import sys
import time

def test_import(name, import_statement):
    print(f"Testing: {name}...", flush=True)
    start = time.time()
    try:
        exec(import_statement, globals())
        elapsed = time.time() - start
        print(f"  OK ({elapsed:.1f}s)", flush=True)
        if elapsed > 5:
            print("  WARNING: Slow import!", flush=True)
        return True
    except Exception as e:
        print(f"  FAILED: {e}", flush=True)
        return False

# Test each import step by step
steps = [
    ("os & dotenv", "import os; from dotenv import load_dotenv; load_dotenv()"),
    ("FastAPI", "from fastapi import FastAPI, HTTPException, Request"),
    ("pydantic", "from pydantic import BaseModel"),
    ("json_code_generator", "from json_code_generator import generate_strategy_from_json"),
    ("backtest_service (partial)", "from backtest_service import XML_TO_PYTHON_PROMPT"),
    ("backtest_service (validate)", "from backtest_service import validate_nautilus_code"),
    ("backtest_runner", "from backtest_runner import run_backtest"),
]

print("=" * 50)
print("IMPORT DIAGNOSTIC TEST")
print("=" * 50)

for name, code in steps:
    if not test_import(name, code):
        print("Stopping due to import failure")
        break

print("\n" + "=" * 50)
print("DONE")
print("=" * 50)
