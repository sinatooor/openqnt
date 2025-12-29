import pytest
import pandas as pd
from datetime import datetime
from backend.strategy_ir import StrategyIR, Rule, Condition, ActionType, MarketComponent, ComparisonOperator, PositionSizing
from backend.ir_simulator import IRSimulator

def create_dummy_data(length=100):
    dates = pd.date_range(start="2023-01-01", periods=length, freq="1min")
    # Create a simple trend
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

def test_simple_long_strategy():
    # Rule: IF Close > 105 THEN ENTER_LONG
    # Rule: IF Close > 110 THEN EXIT_LONG
    
    close_price = MarketComponent(type="Close")
    
    rule_entry = Rule(
        action=ActionType.ENTER_LONG,
        conditions=[
            Condition(left=close_price, operator=ComparisonOperator.GT, right=105.0)
        ]
    )
    
    rule_exit = Rule(
        action=ActionType.EXIT_LONG,
        conditions=[
            Condition(left=close_price, operator=ComparisonOperator.GT, right=110.0)
        ]
    )
    
    strategy = StrategyIR(
        name="TestStrategy",
        rules=[rule_entry, rule_exit],
        position_sizing=PositionSizing(method="fixed_amount", value=1.0)
    )
    
    data = create_dummy_data(20) # 100..119
    # 100, 101, ... 105, 106 (Entry > 105), ... 110, 111 (Exit > 110)
    
    sim = IRSimulator(initial_equity=10000)
    result = sim.run(strategy, data)
    
    assert len(result.trades) >= 1
    trade = result.trades[0]
    assert trade.direction == 'LONG'
    assert trade.entry_price >= 106.0
    assert trade.exit_price >= 111.0
    assert trade.pnl > 0

def test_rsi_calculation():
    data = create_dummy_data(50)
    # Add some volatility to generate RSI movement
    data['close'] = [100 + (i%10)*2 for i in range(50)]
    
    # Just checking if RSI column is created
    rsi_comp = MarketComponent(type="RSI", params={'period': 14})
    
    # Create a dummy rule to force RSI calculation
    rule = Rule(
        action=ActionType.ENTER_LONG,
        conditions=[Condition(left=rsi_comp, operator=ComparisonOperator.GT, right=50)]
    )
    strategy = StrategyIR(name="RSI_Test", rules=[rule])
    
    sim = IRSimulator()
    result = sim.run(strategy, data)
    
    # Check if 'rsi_period14' or similar exists in processed_data
    cols = [c for c in result.processed_data.columns if 'rsi' in c]
    assert len(cols) > 0
    assert not result.processed_data[cols[0]].isnull().all()
