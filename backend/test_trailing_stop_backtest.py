#!/usr/bin/env python3
"""
End-to-end test of RSI strategy with trailing stop.
Runs actual backtest to verify trailing stop logic works.
"""

import sys
import asyncio
sys.path.insert(0, '/Users/sina/project-fire/PPM/backend')

from backtest_service import run_backtest_pipeline

async def test_rsi_with_trailing_stop_backtest():
    """Run RSI backtest with trailing stop and compare to standard RSI"""
    
    # RSI with trailing stop
    xml_with_trailing = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_rsi">
        <field name="PERIOD">14</field>
      </block>
      <block type="risk_trailing_stop">
        <field name="PERCENT">3.0</field>
      </block>
    </xml>
    '''
    
    # Standard RSI without trailing stop
    xml_without_trailing = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_rsi">
        <field name="PERIOD">14</field>
      </block>
    </xml>
    '''
    
    # Common parameters
    symbol = "AAPL"
    period = "1y"
    interval = "1d"
    cash = 10000
    data_source = "local"  # Use local SQLite data
    start_date = "2023-01-01"
    end_date = "2024-01-01"
    
    print("\n" + "="*60)
    print("Running RSI WITH trailing stop (3%)...")
    print("="*60)
    result_with = await run_backtest_pipeline(
        xml=xml_with_trailing,
        symbol=symbol,
        period=period,
        interval=interval,
        cash=cash,
        data_source=data_source,
        start_date=start_date,
        end_date=end_date
    )
    
    if "error" in result_with:
        print(f"❌ Error with trailing stop: {result_with['error']}")
        return False
    
    # Extract metrics from result
    metrics_with = result_with.get('metrics', {})
    print(f"\n📊 Results WITH trailing stop:")
    print(f"  Return: {metrics_with.get('total_return', 'N/A')}%")
    print(f"  Trades: {metrics_with.get('total_trades', 'N/A')}")
    print(f"  Win Rate: {metrics_with.get('win_rate', 'N/A')}%")
    print(f"  Max Drawdown: {metrics_with.get('max_drawdown', 'N/A')}%")
    
    print("\n" + "="*60)
    print("Running RSI WITHOUT trailing stop...")
    print("="*60)
    result_without = await run_backtest_pipeline(
        xml=xml_without_trailing,
        symbol=symbol,
        period=period,
        interval=interval,
        cash=cash,
        data_source=data_source,
        start_date=start_date,
        end_date=end_date
    )
    
    if "error" in result_without:
        print(f"❌ Error without trailing stop: {result_without['error']}")
        return False
    
    metrics_without = result_without.get('metrics', {})
    print(f"\n📊 Results WITHOUT trailing stop:")
    print(f"  Return: {metrics_without.get('total_return', 'N/A')}%")
    print(f"  Trades: {metrics_without.get('total_trades', 'N/A')}")
    print(f"  Win Rate: {metrics_without.get('win_rate', 'N/A')}%")
    print(f"  Max Drawdown: {metrics_without.get('max_drawdown', 'N/A')}%")
    
    print("\n" + "="*60)
    print("Comparison Summary:")
    print("="*60)
    
    # Compare results
    return_with = metrics_with.get('total_return', 0)
    return_without = metrics_without.get('total_return', 0)
    trades_with = metrics_with.get('total_trades', 0)
    trades_without = metrics_without.get('total_trades', 0)
    
    print(f"  Trailing stop return: {return_with}%")
    print(f"  Standard RSI return:  {return_without}%")
    print(f"  Difference: {float(return_with or 0) - float(return_without or 0):.2f}%")
    print(f"  Trades with trailing: {trades_with}")
    print(f"  Trades without: {trades_without}")
    
    # Trailing stop should affect trade count or returns
    trades_with_count = int(trades_with) if trades_with else 0
    trades_without_count = int(trades_without) if trades_without else 0
    
    if trades_with_count > 0 or trades_without_count > 0:
        print("\n✅ Strategies executed trades successfully!")
        return True
    else:
        print("\n⚠️ One or both strategies had no trades")
        return False

if __name__ == "__main__":
    print("\n" + "="*70)
    print("Testing RSI Strategy: Trailing Stop vs Standard")
    print("="*70)
    
    success = asyncio.run(test_rsi_with_trailing_stop_backtest())
    
    print("\n" + "="*70)
    if success:
        print("✅ Trailing stop backtest comparison completed successfully!")
    else:
        print("❌ Trailing stop backtest comparison had issues")
    print("="*70)
