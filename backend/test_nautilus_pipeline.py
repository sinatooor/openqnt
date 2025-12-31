#!/usr/bin/env python3
"""
Test the Nautilus backtest pipeline end-to-end without using curl.
"""

import asyncio
import sys

# Simple MA Crossover template XML (same as frontend template)
SIMPLE_MA_CROSSOVER_XML = """
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="strategy_main" id="main_strategy" x="50" y="50">
    <statement name="CONDITIONS">
      <block type="condition_block" id="cond1">
        <field name="DIRECTION">long</field>
        <statement name="ENTRY">
          <block type="ta_ma_crossover" id="cross1">
            <mutation fast_period="10" slow_period="20" ma_type="sma"></mutation>
            <field name="FAST_PERIOD">10</field>
            <field name="SLOW_PERIOD">20</field>
            <field name="MA_TYPE">sma</field>
          </block>
        </statement>
        <statement name="ACTION">
          <block type="trade_order" id="order1">
            <field name="DIRECTION">long</field>
            <field name="SIZE">0.1</field>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>
"""

async def test_nautilus_backtest():
    """Test the Nautilus backtest pipeline."""
    print("=" * 60)
    print("Testing Nautilus Backtest Pipeline")
    print("=" * 60)
    
    # Import functions
    from backtest_service import run_backtest_pipeline
    
    # Test with Nautilus engine
    result = await run_backtest_pipeline(
        xml=SIMPLE_MA_CROSSOVER_XML,
        symbol="EURUSD",
        data_source="local",
        start_date="2024-01-01",
        end_date="2024-03-31",
        engine="nautilus",
        initial_balance=10000.0
    )
    
    print("\n" + "=" * 60)
    print("RESULT:")
    print("=" * 60)
    print(f"  Success: {result.get('success')}")
    print(f"  Engine: {result.get('engine', 'unknown')}")
    print(f"  Symbol: {result.get('symbol')}")
    print(f"  Trades: {len(result.get('trades', []))}")
    print(f"  Final Balance: {result.get('final_balance')}")
    
    # Check visualization HTML
    viz_html = result.get('visualization_html')
    if viz_html:
        print(f"  Visualization HTML: Present ({len(viz_html)} chars)")
        print("  ✓ VIEW CHART BUTTON SHOULD BE VISIBLE")
    else:
        print(f"  Visualization HTML: MISSING")
        print("  ✗ VIEW CHART BUTTON WILL NOT BE VISIBLE")
    
    # Show error if any
    if result.get('error'):
        print(f"\n  ERROR: {result.get('error')}")
    if result.get('traceback'):
        print(f"\n  TRACEBACK:\n{result.get('traceback')}")
    
    # Show metrics
    metrics = result.get('metrics', {})
    if metrics:
        print("\n  Metrics:")
        for k, v in metrics.items():
            print(f"    {k}: {v}")
    
    print("\n" + "=" * 60)
    return result.get('success') and viz_html is not None


if __name__ == "__main__":
    success = asyncio.run(test_nautilus_backtest())
    sys.exit(0 if success else 1)
