import pytest
import pandas as pd
from backend.backtest_engine import BacktestEngine, BacktestRequest, create_sample_strategy
from backend.strategy_ir import StrategyIR

def test_run_backtest_smoke():
    engine = BacktestEngine()
    strategy = create_sample_strategy()
    
    # Use a short period to make it fast
    req = BacktestRequest(
        strategy=strategy,
        symbol="EURUSD",
        start_date="2024-01-01",
        end_date="2024-02-01"
    )
    
    result = engine.run_backtest(req)
    
    assert result.metrics['total_trades'] >= 0
    assert 'return_pct' in result.metrics
    assert not result.simulation_result.equity_curve.empty
    assert isinstance(result.metrics['max_drawdown'], float)

def test_compare_strategies():
    engine = BacktestEngine()
    s1 = create_sample_strategy()
    s1.name = "Strategy A"
    
    s2 = create_sample_strategy()
    s2.name = "Strategy B"
    # Make s2 different (e.g. different sizing)
    s2.position_sizing.value = 0.2
    
    df = engine.compare_strategies(
        strategies=[s1, s2],
        symbol="EURUSD",
        start_date="2024-01-01",
        end_date="2024-02-01"
    )
    
    assert len(df) == 2
    assert "Strategy A" in df.index
    assert "Strategy B" in df.index
    assert "return_pct" in df.columns
    assert "sharpe_ratio" in df.columns

def test_run_multi_period():
    engine = BacktestEngine()
    strategy = create_sample_strategy()
    
    periods = [
        {'start': '2024-01-01', 'end': '2024-02-01'},
        {'start': '2024-02-01', 'end': '2024-03-01'}
    ]
    
    df = engine.run_multi_period(
        strategy=strategy,
        symbol="EURUSD",
        periods=periods
    )
    
    assert len(df) == 2
    assert '2024-01-01 to 2024-02-01' in df.index
    assert 'return_pct' in df.columns

def test_calculate_metrics_zeros():
    # Test metrics when no trades occur
    engine = BacktestEngine()
    
    # Create a result with no trades
    from backend.ir_simulator import SimulationResult
    
    sim_result = SimulationResult(
        trades=[],
        initial_equity=10000.0,
        final_equity=10000.0,
        equity_curve=pd.DataFrame(),
        metrics={},
        processed_data=pd.DataFrame()
    )
    
    metrics = engine._calculate_metrics(sim_result)
    assert metrics['total_trades'] == 0
    assert metrics['return_pct'] == 0.0
    assert metrics['max_drawdown'] == 0.0
