import pytest
import pandas as pd
import numpy as np
from datetime import datetime
from backend.monte_carlo import MonteCarloSimulator
from backend.ir_simulator import SimulationResult, Trade

def create_dummy_trade(pnl: float) -> Trade:
    return Trade(
        entry_time=datetime.now(),
        entry_price=100.0,
        direction="LONG",
        size=1.0,
        exit_time=datetime.now(),
        exit_price=100.0 + pnl,
        pnl=pnl,
        status="CLOSED"
    )

def test_monte_carlo_empty():
    """Test with no trades returns empty result."""
    sim_result = SimulationResult(
        trades=[],
        initial_equity=10000.0,
        final_equity=10000.0,
        equity_curve=pd.DataFrame(),
        metrics={},
        processed_data=pd.DataFrame()
    )
    
    mc = MonteCarloSimulator(iterations=10)
    result = mc.run(sim_result)
    
    assert result.iterations == 10
    assert result.drawdown_distribution['p50'] == 0.0
    assert result.return_distribution['p50'] == 0.0
    assert len(result.simulated_drawdowns) == 0

def test_monte_carlo_deterministic():
    """Test with identical trades (shuffling shouldn't change return)."""
    # 10 trades, each +100
    trades = [create_dummy_trade(100.0) for _ in range(10)]
    
    sim_result = SimulationResult(
        trades=trades,
        initial_equity=1000.0,
        final_equity=2000.0,
        equity_curve=pd.DataFrame(),
        metrics={},
        processed_data=pd.DataFrame()
    )
    
    mc = MonteCarloSimulator(iterations=50)
    result = mc.run(sim_result)
    
    # Return should always be (2000 - 1000)/1000 = 100%
    assert result.return_distribution['p50'] == 100.0
    assert result.return_distribution['p05'] == 100.0
    assert result.return_distribution['p95'] == 100.0
    
    # Drawdown should be 0 as all trades are winners
    assert result.drawdown_distribution['p50'] == 0.0

def test_monte_carlo_distribution():
    """Test with mixed trades where sequence matters for drawdown."""
    # One big loss (-500) and one big win (+500)
    # Start equity 1000
    # Sequence A: -500 (Equity 500, DD 50%), then +500 (Equity 1000) -> Max DD 50%
    # Sequence B: +500 (Equity 1500), then -500 (Equity 1000, DD 33%) -> Max DD 33%
    
    trades = [
        create_dummy_trade(-500.0),
        create_dummy_trade(500.0)
    ]
    
    sim_result = SimulationResult(
        trades=trades,
        initial_equity=1000.0,
        final_equity=1000.0,
        equity_curve=pd.DataFrame(),
        metrics={},
        processed_data=pd.DataFrame()
    )
    
    mc = MonteCarloSimulator(iterations=100)
    result = mc.run(sim_result)
    
    # Return should always be 0%
    assert abs(result.return_distribution['p50']) < 0.001
    
    # Drawdown should vary between ~33.3% and 50%
    # We expect p05 to be close to 33.3% and p95 to be close to 50%
    assert result.drawdown_distribution['p05'] >= 33.0
    assert result.drawdown_distribution['p95'] <= 50.0
    
    # Check structure
    assert 'median' in result.confidence_intervals['drawdown']
    assert len(result.simulated_drawdowns) == 100
