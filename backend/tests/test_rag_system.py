import sys
import os
import pytest

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from rag_system import block_library

def test_verify_prompt_generation():
    """Verify that the system prompt generation includes critical components."""
    print("Building full system prompt...")
    prompt = block_library.build_full_system_prompt()

    # Basic check
    assert len(prompt) > 0, "Prompt is empty"

    # Check Rules
    assert "CRITICAL RULES:" in prompt, "CRITICAL RULES section not found"
    assert "1. You MUST ONLY use blocks listed below" in prompt, "Rule 1 not found"

    # Check Examples
    assert "EXAMPLES:" in prompt, "EXAMPLES section not found"
    assert "Example 1 - RSI Oversold Reversal (Simple):" in prompt, "Example 1 not found"

    # Check Catalog
    assert "=== COMPLETE BLOCK CATALOG" in prompt, "Catalog section not found"
    assert "ta_sma" in prompt, "ta_sma block not found"

    # Check specific block definition fixes
    # AMA block definition fixed (fastperiod/slowperiod)
    assert 'fastperiod="2"' in prompt, "AMA block definition NOT fixed (fastperiod)"
    assert 'slowperiod="30"' in prompt, "AMA block definition NOT fixed (slowperiod)"
