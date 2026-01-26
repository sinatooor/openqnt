
import sys
import os
import asyncio
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend import local_database as db
from backend.routers import strategies_v2

# Wrapper for request objects since router expects Pydantic models
class MockRequest:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

async def test_all():
    print("--- Starting Verification of Strategies V2 ---")
    
    # Setup
    db.init_db()
    test_user_id = "verify_test_user_" + datetime.now().strftime("%Y%m%d%H%M%S")
    
    # 1. Save V1
    print("\n[1] Saving Strategy V1...")
    req1 = strategies_v2.SaveStrategyRequest(
        user_id=test_user_id,
        name="TestStrat",
        xml="<xml>v1</xml>",
        python_code="print('v1')",
        block_count=1
    )
    res1 = await strategies_v2.save_strategy(req1)
    id1 = res1["id"]
    print(f"    Saved V1 with ID: {id1}")

    # 2. Save V2 (Same name, different content)
    print("\n[2] Saving Strategy V2...")
    req2 = strategies_v2.SaveStrategyRequest(
        user_id=test_user_id,
        name="TestStrat",
        xml="<xml>v2</xml>",
        python_code="print('v2')",
        block_count=2
    )
    res2 = await strategies_v2.save_strategy(req2)
    id2 = res2["id"]
    print(f"    Saved V2 with ID: {id2}")

    # 3. Get All Strategies (Should see only LATEST)
    print("\n[3] Getting All Strategies (Expect 1 distinct)...")
    strategies = await strategies_v2.get_strategies(test_user_id)
    print(f"    Found {len(strategies)} strategies.")
    assert len(strategies) == 1, f"Expected 1 strategy, got {len(strategies)}"
    assert strategies[0]["xml"] == "<xml>v2</xml>", "Expected latest version (v2)"
    print("    PASSED: Grouping logic works.")

    # 4. Get History (Should see 2 versions)
    print("\n[4] Getting History for V2 ID...")
    history = await strategies_v2.get_strategy_history(id2, test_user_id)
    print(f"    Found {len(history)} versions.")
    assert len(history) == 2, f"Expected 2 versions, got {len(history)}"
    print("    PASSED: History logic works.")

    # 5. Restore V1
    print("\n[5] Restoring V1...")
    res3 = await strategies_v2.restore_strategy_version(id2, id1, test_user_id) # Strategy ID (any version id works for lookup), Target Version ID
    id3 = res3["id"]
    print(f"    Restored as new ID: {id3}")
    
    # Verify V3 is copy of V1
    strategies_after = await strategies_v2.get_strategies(test_user_id)
    current = strategies_after[0]
    assert current["xml"] == "<xml>v1</xml>", "Current version should handle XML from V1"
    print("    PASSED: Restore created new version with V1 content.")

    # Cleanup
    print("\n[6] Cleanup...")
    await strategies_v2.delete_strategy(id1, test_user_id)
    await strategies_v2.delete_strategy(id2, test_user_id)
    await strategies_v2.delete_strategy(id3, test_user_id)
    
    print("\n--- ALL TESTS PASSED ---")

if __name__ == "__main__":
    asyncio.run(test_all())
