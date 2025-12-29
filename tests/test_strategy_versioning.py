import pytest
from backend.strategy_version_manager import StrategyVersionManager
from backend.strategy_ir import StrategyIR

def test_create_and_update_strategy():
    manager = StrategyVersionManager()
    ir = StrategyIR(name="TestStrat")
    
    # Create
    strat_id = manager.create_strategy(ir)
    assert strat_id is not None
    
    # Update
    ir.name = "TestStrat_V2"
    manager.update_strategy(strat_id, ir)
    
    # Check history
    history = manager.get_history(strat_id)
    assert len(history) == 2
    assert history[0]["metadata"]["ir"]["name"] == "TestStrat"
    assert history[1]["metadata"]["ir"]["name"] == "TestStrat_V2"

def test_clone_strategy():
    manager = StrategyVersionManager()
    ir = StrategyIR(name="Original")
    orig_id = manager.create_strategy(ir)
    
    # Clone
    new_id = manager.clone_strategy(orig_id)
    assert new_id != orig_id
    
    history = manager.get_history(new_id)
    assert len(history) == 1
    assert history[0]["metadata"]["ir"]["name"] == "Original" 

def test_diff_versions():
    manager = StrategyVersionManager()
    ir = StrategyIR(name="V1")
    s_id = manager.create_strategy(ir)
    
    ir.timeframe = "5m"
    manager.update_strategy(s_id, ir)
    
    history = manager.get_history(s_id)
    # diff between v1 (index 0) and v2 (index 1)
    diff = manager.diff_versions(history[0], history[1])
    
    assert "timeframe" in diff
    assert diff["timeframe"]["old"] == "1m" # Default
    assert diff["timeframe"]["new"] == "5m"
