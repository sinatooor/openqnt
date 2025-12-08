#!/usr/bin/env python3
"""
Test the backtest endpoint with the SP500 Trend Strategy XML.
Run this after starting the backend: uvicorn main:app --reload --port 8000
"""

import requests
import json

BACKTEST_URL = "http://localhost:8000/backtest"

# The full XML strategy (simplified for testing)
STRATEGY_XML = """
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="ta_ema">
    <mutation ma_period="20" shift="0" applied_price="0"></mutation>
    <field name="NAME">Fast EMA</field>
    <field name="PERIOD">60</field>
  </block>
  <block type="ta_sma">
    <mutation ma_period="50" shift="0" applied_price="0"></mutation>
    <field name="NAME">Slow SMA</field>
    <field name="PERIOD">60</field>
  </block>
  <block type="ta_rsi">
    <mutation ma_period="14" applied_price="0"></mutation>
    <field name="NAME">RSI</field>
    <field name="PERIOD">60</field>
  </block>
  <block type="macd_value">
    <mutation fastema="12" slowema="26" signalsma="9" applied_price="0"></mutation>
    <field name="NAME">MACD</field>
    <field name="COMPONENT">line</field>
    <field name="PERIOD">60</field>
  </block>
  <block type="trade_order">
    <field name="TRADE_ID">sp500_bullish_trend</field>
    <field name="DIRECTION">long</field>
    <field name="SIZE">0.1</field>
    <field name="SIZE_TYPE">lots</field>
    <field name="ORDER_TYPE">market</field>
  </block>
</xml>
"""

def test_backtest():
    """Test the backtest endpoint."""
    print("Testing /backtest endpoint...")
    print(f"URL: {BACKTEST_URL}")
    
    payload = {
        "workspaceXml": STRATEGY_XML,
        "symbol": "SPY",
        "startDate": "2024-01-01",
        "endDate": "2024-12-01",
        "initialBalance": 100000,
        "engine": "backtesting.py",
        "use_llm": False
    }
    
    try:
        response = requests.post(BACKTEST_URL, json=payload, timeout=60)
        response.raise_for_status()
        
        result = response.json()
        
        print("\n" + "="*60)
        print("RESPONSE:")
        print("="*60)
        
        if result.get("success"):
            print("✅ Backtest successful!")
            metrics = result.get("metrics", {})
            print(f"\n📈 Results:")
            print(f"   Total Return: {metrics.get('total_return', 'N/A'):.2f}%")
            print(f"   Win Rate: {metrics.get('win_rate', 'N/A'):.1f}%")
            print(f"   Max Drawdown: {metrics.get('max_drawdown', 'N/A'):.2f}%")
            print(f"   Total Trades: {metrics.get('total_trades', 'N/A')}")
            print(f"   Sharpe Ratio: {metrics.get('sharpe_ratio', 'N/A'):.2f}")
            print(f"   Final Equity: ${metrics.get('equity_final', 0):,.2f}")
        else:
            print(f"❌ Backtest failed: {result.get('error')}")
        
        print("\n" + "="*60)
        print("Full response:")
        print(json.dumps(result, indent=2, default=str)[:2000])
        
        return result
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to backend. Make sure it's running:")
        print("   cd backend && uvicorn main:app --reload --port 8000")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    test_backtest()
