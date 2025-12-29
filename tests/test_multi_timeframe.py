import pytest
import pandas as pd
from datetime import datetime
from backend.strategy_ir import StrategyIR, Rule, Condition, ActionType, MarketComponent, ComparisonOperator, PositionSizing
from backend.ir_simulator import IRSimulator

def create_dummy_data(length=120):
    # 2 hours of 1-minute data
    dates = pd.date_range(start="2023-01-01 09:00", periods=length, freq="1min")
    # Linear trend
    close = [100.0 + i for i in range(length)]
    data = pd.DataFrame({
        'timestamp': dates,
        'open': close,
        'high': close,
        'low': close,
        'close': close,
        'volume': 1000
    })
    data.set_index('timestamp', inplace=True)
    return data

def test_higher_timeframe_indicator():
    # Strategy:
    # SMA(Period=5) on 5m timeframe
    # Data is 1m.
    # At 09:00-09:05, SMA is calc from 5 bars of 5m (which we don't have enough history for initially)
    # Let's use a shorter SMA or verify simple resampling.
    
    # Let's say we use SMA(2) on 5m.
    # 5m bars:
    # 09:00-09:05 (Close approx 104)
    # 09:05-09:10 (Close approx 109)
    # 09:10-09:15 (Close approx 114)
    # SMA(2) at 09:10 (end) = Avg(104, 109) = 106.5.
    # This value 106.5 should be available from 09:10 onwards (or 09:11 in 1m bars).
    
    sma_5m = MarketComponent(type="SMA", params={'period': 2}, timeframe="5m")
    
    # Trigger: Close > SMA_5m (which will be true as Close is rising)
    rule = Rule(
        action=ActionType.ENTER_LONG,
        conditions=[
            Condition(left=MarketComponent(type="Close"), operator=ComparisonOperator.GT, right=sma_5m)
        ]
    )
    
    strategy = StrategyIR(
        name="MTF_Strategy",
        rules=[rule],
        timeframe="1m"
    )
    
    data = create_dummy_data(60) # 1 hour
    sim = IRSimulator()
    result = sim.run(strategy, data)
    
    # Check if column exists
    # Name should be sma_period2_5m
    cols = result.processed_data.columns
    assert "sma_period2_5m" in cols
    
    # Check values
    # The first valid SMA(2) on 5m requires 2 5m bars.
    # Bar 1: 09:00-09:05
    # Bar 2: 09:05-09:10
    # So at 09:10 we have a value.
    # In 1m data, 09:10 is index 10.
    
    series = result.processed_data["sma_period2_5m"]
    
    # It should be NaN initially
    assert pd.isna(series.iloc[0])
    
    # It should have values later
    assert not pd.isna(series.iloc[-1])
    
    # Check "step" nature.
    # Value should be constant for 5 minutes (09:10, 11, 12, 13, 14)
    val_10 = series.loc[pd.Timestamp("2023-01-01 09:10:00")]
    val_11 = series.loc[pd.Timestamp("2023-01-01 09:11:00")]
    val_14 = series.loc[pd.Timestamp("2023-01-01 09:14:00")]
    
    assert val_10 == val_11
    assert val_10 == val_14
    
    # Should change at 09:15
    val_15 = series.loc[pd.Timestamp("2023-01-01 09:15:00")]
    assert val_15 != val_14

def test_explicit_base_timeframe():
    # Test that timeframe="1m" is treated as base
    comp = MarketComponent(type="SMA", params={'period': 5}, timeframe="1m")
    # Should result in 'sma_period5_1m' or 'sma_period5' depending on implementation details?
    # Logic: if comp.timeframe is set, name includes it.
    
    strategy = StrategyIR(name="Test", rules=[], timeframe="1m")
    sim = IRSimulator()
    
    # We just want to check naming, can inspect private method or run
    name = sim._get_component_name(comp)
    assert "1m" in name

