#!/usr/bin/env python3
"""Quick test of the Nautilus adapter."""

import pandas as pd
import json
from backend.nautilus_adapter import run_nautilus_backtest, get_nautilus_status

print('=== Nautilus Status ===')
print(json.dumps(get_nautilus_status(), indent=2))

# Create test data
dates = pd.date_range('2024-01-01', '2024-01-31', freq='1h')
data = pd.DataFrame({
    'timestamp': dates,
    'open': [1.1 + 0.001 * (i % 10) for i in range(len(dates))],
    'high': [1.11 + 0.001 * (i % 10) for i in range(len(dates))],
    'low': [1.09 + 0.001 * (i % 10) for i in range(len(dates))],
    'close': [1.105 + 0.001 * (i % 10) for i in range(len(dates))],
    'volume': 1000
})

# Minimal strategy
strategy = '''
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.config import StrategyConfig

class SimpleStrategy(Strategy):
    def __init__(self, config: StrategyConfig):
        super().__init__(config)
    def on_start(self):
        pass
    def on_bar(self, bar):
        pass
    def on_stop(self):
        pass
'''

print()
print('=== Running Backtest ===')
result = run_nautilus_backtest(
    strategy_code=strategy,
    symbol='EURUSD',
    start_date='2024-01-01',
    end_date='2024-01-31',
    initial_balance=100000,
    historical_data=data
)

print('Success:', result['success'])
if result['success']:
    print('Engine:', result.get('engine', 'unknown'))
    print('Metrics:', json.dumps(result['metrics'], indent=2))
    print('Trades:', len(result['trades']))
    print('Equity Curve Points:', len(result['equity_curve']))
else:
    print('Error:', result.get('error'))
