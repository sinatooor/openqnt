#!/usr/bin/env python3
"""
Simple script to test Gemini API with different models
Tests which models are available and working
"""

import os
import sys
import asyncio
from dotenv import load_dotenv
from google import genai

# Load environment variables
load_dotenv()

# Get API key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("❌ GEMINI_API_KEY not found in .env file")
    sys.exit(1)

print(f"✓ Found API key: {GEMINI_API_KEY[:20]}...")
print()

# Models to test
MODELS_TO_TEST = [
    "gemini-3-pro-preview",
    "gemini-3-flash-preview", 
    "gemini-2.0-flash-exp",
    "gemini-2.0-pro-exp",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
]

TEST_PROMPT = "Hi! Please respond with 'Hello, I am working!' if you can read this."


async def test_model(client, model_name, timeout=15):
    """Test a single model with timeout"""
    try:
        print(f"Testing {model_name}...", end=" ", flush=True)
        
        # Run with timeout
        async def _generate():
            def _sync_call():
                return client.models.generate_content(
                    model=model_name,
                    contents=TEST_PROMPT,
                    config={"temperature": 0.3, "max_output_tokens": 100}
                )
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, _sync_call)
        
        response = await asyncio.wait_for(_generate(), timeout=timeout)
        
        print(f"✅ SUCCESS")
        print(f"   Response: {response.text[:100]}")
        print()
        return True
        
    except asyncio.TimeoutError:
        print(f"⏱️  TIMEOUT (>{timeout}s)")
        print()
        return False
        
    except Exception as e:
        error_msg = str(e)
        
        if "503" in error_msg or "overloaded" in error_msg.lower():
            print(f"⚠️  OVERLOADED")
            print(f"   Error: {error_msg[:80]}")
        elif "404" in error_msg or "not found" in error_msg.lower():
            print(f"❌ NOT FOUND (model doesn't exist)")
        elif "401" in error_msg or "unauthorized" in error_msg.lower():
            print(f"❌ UNAUTHORIZED (bad API key)")
        else:
            print(f"❌ ERROR")
            print(f"   Error: {error_msg[:80]}")
        print()
        return False


async def main():
    print("=" * 60)
    print("Gemini API Model Tester")
    print("=" * 60)
    print()
    
    client = genai.Client(api_key=GEMINI_API_KEY)
    
    results = {}
    for model in MODELS_TO_TEST:
        results[model] = await test_model(client, model, timeout=15)
        await asyncio.sleep(0.5)  # Small delay between tests
    
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    working_models = [m for m, success in results.items() if success]
    failed_models = [m for m, success in results.items() if not success]
    
    if working_models:
        print(f"\n✅ Working models ({len(working_models)}):")
        for model in working_models:
            print(f"   - {model}")
    
    if failed_models:
        print(f"\n❌ Failed/Unavailable models ({len(failed_models)}):")
        for model in failed_models:
            print(f"   - {model}")
    
    print()
    
    if working_models:
        print(f"✓ Recommended model to use: {working_models[0]}")
    else:
        print("⚠️  No models are currently available. Try again later.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(0)
