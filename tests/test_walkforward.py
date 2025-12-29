import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from backend.walkforward import WalkforwardValidator, WalkforwardConfig
from backend.backtest_engine import create_sample_strategy
from backend.strategy_ir import StrategyIR

# Mock Data Generation
def generate_trend_data(n=500):
    dates = pd.date_range(start="2024-01-01", periods=n, freq="H")
    df = pd.DataFrame(index=dates)
    # Clear uptrend
    df['close'] = np.linspace(100, 200, n) + np.random.normal(0, 0.5, n)
    df['open'] = df['close'] - 0.2
    df['high'] = df['close'] + 0.5
    df['low'] = df['close'] - 0.5
    df['volume'] = 1000
    return df

def test_walkforward_initialization():
    validator = WalkforwardValidator()
    assert validator.engine is not None

def test_walkforward_validation_flow():
    # Setup
    data = generate_trend_data(600)
    strategy = create_sample_strategy() # Simple SMA crossover
    
    config = WalkforwardConfig(
        train_window=200,
        test_window=100,
        step_size=100,
        anchored=False
    )
    
    validator = WalkforwardValidator()
    
    # Execution
    result = validator.validate(
        strategy=strategy,
        data=data,
        config=config,
        metric='return_pct'
    )
    
    # Assertions
    assert len(result.windows) > 0
    # For 600 bars with above config:
    # 0: Train [0:200], Test [200:300]
    # 1: Train [100:300], Test [300:400]
    # 2: Train [200:400], Test [400:500]
    # 3: Train [300:500], Test [500:600]
    assert len(result.windows) == 4
    
    # Check degradation calculation
    assert 'avg_is_return_pct' in result.aggregate_metrics
    assert 'avg_oos_return_pct' in result.aggregate_metrics
    
    # SMA Crossover on Uptrend should be positive
    assert result.aggregate_metrics['avg_is_return_pct'] > 0
    
    # Check structure of window results
    window_0 = result.windows[0]
    assert 'train_period' in window_0
    assert 'is_metrics' in window_0
    assert 'oos_metrics' in window_0
    
def test_insufficient_data():
    data = generate_trend_data(100)
    config = WalkforwardConfig(train_window=200, test_window=100)
    validator = WalkforwardValidator()
    
    with pytest.raises(ValueError):
        validator.validate(create_sample_strategy(), data, config)

def test_anchored_walkforward():
    data = generate_trend_data(600)
    strategy = create_sample_strategy()
    
    config = WalkforwardConfig(
        train_window=200,
        test_window=100,
        step_size=100,
        anchored=True
    )
    
    validator = WalkforwardValidator()
    result = validator.validate(strategy, data, config)
    
    assert len(result.windows) == 4
