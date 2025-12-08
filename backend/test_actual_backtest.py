"""
Actually run the backtest with the user's XML to see why 0 trades
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# User's XML that produces 0 trades
USER_XML = '''<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_forever" id="Xig;7=xZx?5cQ*PzM$g(" x="97" y="27">
    <statement name="DO">
      <block type="control_if" id="=5I]B69XEGxp=tpz~M#u">
        <value name="CONDITION">
          <block type="operator_less" id="sS!k3.FMR{;!bkbbNVg]">
            <value name="A">
              <block type="ta_rsi" id="ZH/f`uQ0eSdj~i+.~_hf">
                <field name="PERIOD">14</field>
              </block>
            </value>
            <value name="B">
              <block type="math_number" id="5U6%sCQJCqc}1YH],FVe">
                <field name="NUM">30</field>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_order" id="E[*tnQX+C:j/|9q:mhBu">
            <field name="DIRECTION">long</field>
            <field name="AMOUNT">100</field>
            <field name="UNIT">percent</field>
            <next>
              <block type="trade_stop_loss" id="e%^8;!UNm[sNJHaE/,n7">
                <value name="PRICE">
                  <block type="operator_subtract" id="gQ.-[1CJKfQf/@I-*`x%">
                    <value name="A">
                      <block type="trade_entry_price" id="}i^)2*F-MG$x/{V|Ds?P"></block>
                    </value>
                    <value name="B">
                      <block type="operator_multiply" id="=3i1mTaIlm{]W]c.YBXP">
                        <value name="A">
                          <block type="ta_atr" id="7CdQEzwz@8dD,}S9[o3B">
                            <field name="PERIOD">14</field>
                          </block>
                        </value>
                        <value name="B">
                          <block type="math_number" id="B`^T~(2EL1!BG|PJa=:n">
                            <field name="NUM">1.5</field>
                          </block>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
                <next>
                  <block type="trade_take_profit" id="[oIkz-O+K=+A@_r%yb}L">
                    <value name="PRICE">
                      <block type="operator_add" id="G|?p0;mCE$Gqzrh1hY,0">
                        <value name="A">
                          <block type="trade_entry_price" id="LbS~vl1;q`3^oGIXfq{p"></block>
                        </value>
                        <value name="B">
                          <block type="operator_multiply" id="sXVSMC1;m/K-oCfUUvDz">
                            <value name="A">
                              <block type="operator_multiply" id="(7K_jz*C}F+sI8$M}?|i">
                                <value name="A">
                                  <block type="ta_atr" id="d|.g@:LS/NG]R(6sEDM,">
                                    <field name="PERIOD">14</field>
                                  </block>
                                </value>
                                <value name="B">
                                  <block type="math_number" id="b|yq[|b,G1*aX*_pJB(,">
                                    <field name="NUM">1.5</field>
                                  </block>
                                </value>
                              </block>
                            </value>
                            <value name="B">
                              <block type="math_number" id="r$^HlZ+d!-XFlMh-+G}c">
                                <field name="NUM">2</field>
                              </block>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                    <next>
                      <block type="control_wait_until" id="k8F5*oe3X}c_d(~GHW@v">
                        <value name="CONDITION">
                          <block type="operator_greater" id="TsM+PH8sAnT7F;RK,{rQ">
                            <value name="A">
                              <block type="ta_rsi" id="6(7r/7qfZ.kT|Tv/Q4T~">
                                <field name="PERIOD">14</field>
                              </block>
                            </value>
                            <value name="B">
                              <block type="math_number" id="wD)4b+aNN$Ww%sYJ~5m/">
                                <field name="NUM">70</field>
                              </block>
                            </value>
                          </block>
                        </value>
                        <next>
                          <block type="trade_close" id="M?A~0X@F;n1a5nGqZJe9">
                            <field name="AMOUNT">100</field>
                            <field name="UNIT">percent</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>'''

from backtest_service import run_backtest_pipeline, generate_strategy_code_simple, parse_xml_simple
import json
import asyncio

print("=" * 70)
print("RUNNING ACTUAL BACKTEST WITH USER'S XML")
print("=" * 70)

# First, let's test just the code generation
print("\n📋 Step 1: Testing Code Generation")
print("-" * 50)
parsed = parse_xml_simple(USER_XML)
print(f"Parsed strategy type: {parsed.get('strategy_type')}")
print(f"Parsed indicators: {parsed.get('indicators')}")
print(f"Parsed entry_direction: {parsed.get('entry_direction')}")
print(f"Parsed ATR SL mult: {parsed.get('atr_sl_mult')}")
print(f"Parsed ATR TP mult: {parsed.get('atr_tp_mult')}")
print(f"Parsed oversold: {parsed.get('oversold')}")
print(f"Parsed overbought: {parsed.get('overbought')}")

strategy_code = generate_strategy_code_simple(parsed)
print("\nGenerated strategy code (class part):")
# Find the class definition
class_start = strategy_code.find("class GeneratedStrategy")
if class_start != -1:
    print(strategy_code[class_start:])
else:
    print(strategy_code[-1500:])  # Last part with the class

# Run backtest using async wrapper
async def run_test():
    result = await run_backtest_pipeline(
        xml=USER_XML,
        symbol="AAPL",
        data_source="local",
        start_date="2024-01-01",
        end_date="2024-06-01"
    )
    return result

result = asyncio.run(run_test())

print("\n📊 Backtest Result:")
print("-" * 50)
print(json.dumps(result, indent=2))

# Check the equity curve to see what's happening
if "equity_curve" in result:
    equity = result["equity_curve"]
    print(f"\n📈 Equity curve length: {len(equity)}")
    if len(equity) > 0:
        print(f"   First equity: {equity[0]}")
        print(f"   Last equity: {equity[-1]}")
        print(f"   Min equity: {min(equity)}")
        print(f"   Max equity: {max(equity)}")

if "trades" in result and len(result["trades"]) > 0:
    print(f"\n📈 Trades:")
    for trade in result["trades"]:
        print(f"   {trade}")
else:
    print("\n⚠️ NO TRADES DETECTED!")
    print("\nLet me check the RSI values during the backtest period...")
    
    # Load data and calculate RSI to see if conditions were ever met
    import sqlite3
    import pandas as pd
    import numpy as np
    
    db_path = os.path.join(os.path.dirname(__file__), "data", "market_data.db")
    conn = sqlite3.connect(db_path)
    
    df = pd.read_sql_query("""
        SELECT date, open, high, low, close, volume
        FROM ohlcv 
        WHERE symbol = 'AAPL'
        AND date BETWEEN '2024-01-01' AND '2024-06-01'
        ORDER BY date
    """, conn)
    conn.close()
    
    if len(df) > 0:
        print(f"\n📊 Data loaded: {len(df)} rows")
        print(f"   Date range: {df['date'].iloc[0]} to {df['date'].iloc[-1]}")
        
        # Calculate RSI
        def calc_rsi(arr, period=14):
            arr = np.asarray(arr, dtype=float)
            deltas = np.diff(arr)
            gains = np.where(deltas > 0, deltas, 0)
            losses = np.where(deltas < 0, -deltas, 0)
            
            avg_gain = np.zeros(len(arr))
            avg_loss = np.zeros(len(arr))
            if period < len(arr):
                avg_gain[period] = np.mean(gains[:period])
                avg_loss[period] = np.mean(losses[:period])
            
            for i in range(period + 1, len(arr)):
                avg_gain[i] = (avg_gain[i-1] * (period - 1) + gains[i-1]) / period
                avg_loss[i] = (avg_loss[i-1] * (period - 1) + losses[i-1]) / period
            
            rs = avg_gain / (avg_loss + 1e-10)
            rsi = 100 - (100 / (1 + rs))
            rsi[:period] = 50
            return rsi
        
        rsi = calc_rsi(df['close'].values, 14)
        df['rsi'] = rsi
        
        # Check if RSI ever goes below 30
        oversold = df[df['rsi'] < 30]
        overbought = df[df['rsi'] > 70]
        
        print(f"\n📉 RSI Analysis:")
        print(f"   RSI min: {df['rsi'].min():.2f}")
        print(f"   RSI max: {df['rsi'].max():.2f}")
        print(f"   RSI mean: {df['rsi'].mean():.2f}")
        print(f"   Days RSI < 30 (oversold): {len(oversold)}")
        print(f"   Days RSI > 70 (overbought): {len(overbought)}")
        
        if len(oversold) > 0:
            print(f"\n   First oversold days:")
            for _, row in oversold.head(5).iterrows():
                print(f"      {row['date']}: RSI = {row['rsi']:.2f}, Close = {row['close']:.2f}")
    else:
        print("   No data found for AAPL in the date range!")
