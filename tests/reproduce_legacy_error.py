
import sys
import os
import asyncio
from unittest.mock import MagicMock

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Mock environment variables before importing main
os.environ["DEEPSEEK_API_KEY"] = "mock_key"
os.environ["GEMINI_API_KEY"] = "mock_key" 

from main import generate_strategy, StrategyRequest

async def test_legacy_deepseek():
    print("Testing Legacy Mode with DeepSeek...")
    
    # "Legacy Mode" is implied by the code structure in generate_strategy 
    # (it seems to be the default path if use_rag is False, or maybe it's just the main path now?)
    # Looking at step 193 output: 
    # generate_strategy docstring says: "Generate Blockly XML strategy using DeepSeek API..."
    # And logic calls it "Legacy Mode" in comments.
    
    req = StrategyRequest(
        message="Create a simple SMA crossover strategy",
        ai_model="deepseek",
        use_rag=False, # Assuming legacy mode means NO RAG or specific flag?
        existingXml=None
    )
    
    try:
        # We expect this might fail with "not found" if the user is right, 
        # or maybe we see the real error.
        # Since we use a mock key, we expect an API error, but "not found" suggests file system or URL.
        
        result = await generate_strategy(req)
        print("Result:", result)
        
    except Exception as e:
        print(f"Caught Exception: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_legacy_deepseek())
