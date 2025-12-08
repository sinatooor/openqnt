
import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from rag_system import block_library

def verify_prompt():
    print("Building full system prompt...")
    prompt = block_library.build_full_system_prompt()
    
    print(f"Prompt length: {len(prompt)} characters")
    
    # Check Rules
    if "CRITICAL RULES:" in prompt:
        print("[PASS] CRITICAL RULES section found")
        if "1. You MUST ONLY use blocks listed below" in prompt:
            print("[PASS] Rule 1 found")
        else:
            print("[FAIL] Rule 1 not found")
    else:
        print("[FAIL] CRITICAL RULES section not found")
        
    # Check Examples
    if "EXAMPLES:" in prompt:
        print("[PASS] EXAMPLES section found")
        if "Example 1 - RSI Oversold Reversal (Simple):" in prompt:
            print("[PASS] Example 1 found")
        else:
            print("[FAIL] Example 1 not found")
    else:
        print("[FAIL] EXAMPLES section not found")
        
    # Check Catalog
    if "=== COMPLETE BLOCK CATALOG" in prompt:
        print("[PASS] Catalog section found")
        if "ta_sma" in prompt:
            print("[PASS] ta_sma block found")
        else:
            print("[FAIL] ta_sma block not found")
    else:
        print("[FAIL] Catalog section not found")

    # Check specific block definition fixes
    if 'fastperiod="2"' in prompt and 'slowperiod="30"' in prompt:
        print("[PASS] AMA block definition fixed (fastperiod/slowperiod)")
    else:
        print("[FAIL] AMA block definition NOT fixed")

if __name__ == "__main__":
    verify_prompt()
