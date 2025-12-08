#!/usr/bin/env python3
"""
Test script for RSI backtest with ATR-based stop loss/take profit
Run from backend directory: python test_rsi_backtest.py
"""

import requests
import json
import subprocess
import time
import socket
import os
import sys

def is_server_running(port=8000):
    """Check if server is running on given port"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('localhost', port))
    sock.close()
    return result == 0

def start_server():
    """Start the server in background"""
    # Kill any existing server
    os.system("lsof -ti:8000 | xargs kill -9 2>/dev/null")
    time.sleep(1)
    
    # Start server with nohup
    proc = subprocess.Popen(
        ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        start_new_session=True
    )
    
    # Wait for server to be ready
    for _ in range(10):
        time.sleep(1)
        if is_server_running():
            return proc
    
    print("Failed to start server!")
    sys.exit(1)

# The RSI strategy XML from deletetext.txt
RSI_STRATEGY_XML = """
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_forever" x="50" y="50">
    <statement name="DO">
      <block type="control_if">
        <value name="CONDITION">
          <block type="operator_less">
            <value name="LEFT">
              <block type="ta_rsi">
                <field name="PERIOD">60</field>
                <mutation ma_period="14" applied_price="0"></mutation>
                <field name="NAME">RSI</field>
              </block>
            </value>
            <value name="RIGHT">
              <shadow type="math_number">
                <field name="NUM">30</field>
              </shadow>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_order">
            <field name="TRADE_ID">rsi_reversal_trade</field>
            <field name="DIRECTION">long</field>
            <value name="SIZE">
              <shadow type="math_number">
                <field name="NUM">0.1</field>
              </shadow>
            </value>
            <field name="LEVERAGE">1</field>
            <field name="ORDER_TYPE">market</field>
            <next>
              <block type="trade_stop_loss">
                <field name="CLOSE_TYPE">full</field>
                <field name="TRADE_ID">rsi_reversal_trade</field>
                <value name="PRICE">
                  <block type="operator_subtract">
                    <value name="LEFT">
                      <block type="trade_entry_price">
                        <field name="TRADE_ID">rsi_reversal_trade</field>
                      </block>
                    </value>
                    <value name="RIGHT">
                      <block type="operator_multiply">
                        <value name="LEFT">
                          <block type="ta_atr">
                            <field name="PERIOD">60</field>
                            <mutation ma_period="14"></mutation>
                            <field name="NAME">ATR</field>
                          </block>
                        </value>
                        <value name="RIGHT">
                          <shadow type="math_number">
                            <field name="NUM">1.5</field>
                          </shadow>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
                <next>
                  <block type="trade_take_profit">
                    <field name="CLOSE_TYPE">full</field>
                    <field name="TRADE_ID">rsi_reversal_trade</field>
                    <value name="PRICE">
                      <block type="operator_add">
                        <value name="LEFT">
                          <block type="trade_entry_price">
                            <field name="TRADE_ID">rsi_reversal_trade</field>
                          </block>
                        </value>
                        <value name="RIGHT">
                          <block type="operator_multiply">
                            <value name="LEFT">
                              <block type="operator_multiply">
                                <value name="LEFT">
                                  <block type="ta_atr">
                                    <field name="PERIOD">60</field>
                                    <mutation ma_period="14"></mutation>
                                    <field name="NAME">ATR</field>
                                  </block>
                                </value>
                                <value name="RIGHT">
                                  <shadow type="math_number">
                                    <field name="NUM">1.5</field>
                                  </shadow>
                                </value>
                              </block>
                            </value>
                            <value name="RIGHT">
                              <shadow type="math_number">
                                <field name="NUM">2</field>
                              </shadow>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>
"""

def test_backtest():
    """Test the backtest endpoint with RSI strategy"""
    
    url = "http://localhost:8000/backtest"
    
    payload = {
        "workspaceXml": RSI_STRATEGY_XML.strip(),
        "initialBalance": 10000,
        "tradeSize": 1000,
        "symbol": "AAPL",
        "interval": "1d",
        "startDate": "2023-01-01",
        "endDate": "2024-01-01",
        "data_source": "local",  # Use local database
        "engine": "backtesting.py"
    }
    
    print("=" * 60)
    print("Testing RSI Backtest with ATR-based SL/TP")
    print("=" * 60)
    print(f"Symbol: {payload['symbol']}")
    print(f"Interval: {payload['interval']}")
    print(f"Period: {payload['startDate']} to {payload['endDate']}")
    print(f"Initial Balance: ${payload['initialBalance']}")
    print(f"Trade Size: {payload['tradeSize']}")
    print(f"Data Source: {payload['data_source']}")
    print("=" * 60)
    
    try:
        print("\nSending request to backend...")
        response = requests.post(url, json=payload, timeout=600)  # 10 min timeout
        
        print(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            print("\n" + "=" * 60)
            print("BACKTEST RESULTS")
            print("=" * 60)
            
            # Check if we have metrics
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
            
            # Check for trades
            if "trades" in result:
                trades = result["trades"]
                print(f"\n📈 Trades: {len(trades)} total")
                if trades:
                    print("\nFirst 5 trades:")
                    for i, trade in enumerate(trades[:5]):
                        print(f"   {i+1}. {trade}")
            
            # Check for generated code
            if "generated_code" in result:
                print(f"\n💻 Generated Python Code:")
                print("-" * 40)
                print(result["generated_code"][:500] + "..." if len(result.get("generated_code", "")) > 500 else result.get("generated_code", ""))
                print("-" * 40)
            
            # Save full result
            with open("backtest_result.json", "w") as f:
                json.dump(result, f, indent=2)
            print("\n✅ Full result saved to backtest_result.json")
            
        else:
            print(f"\n❌ Error: {response.status_code}")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Connection Error: Is the backend server running?")
        print("   Start it with: uvicorn main:app --host 0.0.0.0 --port 8000")
    except requests.exceptions.Timeout:
        print("\n❌ Request timed out after 10 minutes")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    server_proc = None
    
    # Check if server is running, start if needed
    if not is_server_running():
        print("Starting backend server...")
        server_proc = start_server()
        print("Server started!")
    else:
        print("Server already running.")
    
    try:
        test_backtest()
    finally:
        # Don't kill server - leave it running for future tests
        pass
