#!/usr/bin/env python3
"""
Test SuperTrend strategy backtest with the new indicator implementations.
"""

import requests
import json
import subprocess
import time
import socket
import os
import sys

def is_server_running(port=8000):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('localhost', port))
    sock.close()
    return result == 0

def start_server():
    os.system("lsof -ti:8000 | xargs kill -9 2>/dev/null")
    time.sleep(1)
    proc = subprocess.Popen(
        ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True
    )
    for _ in range(10):
        time.sleep(1)
        if is_server_running():
            return proc
    print("Failed to start server!")
    sys.exit(1)

# SuperTrend strategy XML
SUPERTREND_XML = """
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_forever" x="50" y="50">
    <statement name="DO">
      <block type="control_if">
        <value name="CONDITION">
          <block type="operator_greater">
            <value name="LEFT">
              <block type="environment_price">
                <field name="TYPE">close</field>
              </block>
            </value>
            <value name="RIGHT">
              <block type="ta_supertrend">
                <field name="PERIOD">10</field>
                <mutation ma_period="10" multiplier="3.0"></mutation>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_order">
            <field name="TRADE_ID">supertrend_trade</field>
            <field name="DIRECTION">long</field>
            <value name="SIZE">
              <shadow type="math_number">
                <field name="NUM">0.1</field>
              </shadow>
            </value>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>
"""

def test_supertrend():
    url = "http://localhost:8000/backtest"
    
    payload = {
        "workspaceXml": SUPERTREND_XML.strip(),
        "initialBalance": 10000,
        "tradeSize": 1000,
        "symbol": "AAPL",
        "interval": "1d",
        "startDate": "2023-01-01",
        "endDate": "2024-01-01",
        "data_source": "local",
        "engine": "backtesting.py"
    }
    
    print("=" * 60)
    print("Testing SuperTrend Strategy Backtest")
    print("=" * 60)
    print(f"Symbol: {payload['symbol']}")
    print(f"Period: {payload['startDate']} to {payload['endDate']}")
    print(f"Data Source: {payload['data_source']}")
    print("=" * 60)
    
    try:
        print("\nSending request to backend...")
        response = requests.post(url, json=payload, timeout=300)
        
        print(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            print("\n" + "=" * 60)
            print("SUPERTREND BACKTEST RESULTS")
            print("=" * 60)
            
            if "metrics" in result:
                metrics = result["metrics"]
                print(f"\n📊 Performance Metrics:")
                print(f"   Total Return: {metrics.get('total_return', 0):.2f}%")
                print(f"   Net Profit: ${metrics.get('net_profit', 0):,.2f}")
                print(f"   Total Trades: {metrics.get('total_trades', 0)}")
                print(f"   Win Rate: {metrics.get('win_rate', 0):.2f}%")
                print(f"   Max Drawdown: {metrics.get('max_drawdown', 0):.2f}%")
                print(f"   Sharpe Ratio: {metrics.get('sharpe_ratio', 0):.2f}")
                print(f"   Final Equity: ${metrics.get('equity_final', 0):,.2f}")
            
            if "trades" in result:
                trades = result["trades"]
                print(f"\n📈 Trades: {len(trades)} total")
                if trades:
                    print("\nFirst 5 trades:")
                    for i, trade in enumerate(trades[:5]):
                        print(f"   {i+1}. {trade['type'].upper()} @ ${trade['entry_price']:.2f} -> ${trade['exit_price']:.2f} = ${trade['pnl']:.2f}")
            
            if "generated_code" in result:
                print(f"\n💻 Strategy recognized: SuperTrend")
                # Check if SuperTrend function is in the code
                if "SuperTrend" in result.get("generated_code", ""):
                    print("✓ SuperTrend indicator correctly generated")
            
            with open("supertrend_result.json", "w") as f:
                json.dump(result, f, indent=2)
            print("\n✅ Full result saved to supertrend_result.json")
            
            return result.get("success", False)
            
        else:
            print(f"\n❌ Error: {response.status_code}")
            print(response.text[:500])
            return False
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    if not is_server_running():
        print("Starting backend server...")
        start_server()
        print("Server started!")
    else:
        print("Server already running.")
    
    success = test_supertrend()
    sys.exit(0 if success else 1)
