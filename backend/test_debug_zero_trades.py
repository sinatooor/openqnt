#!/usr/bin/env python3
"""
Debug specific XML strategy that produces 0 trades
"""

import sys
sys.path.insert(0, '/Users/sina/project-fire/PPM/backend')

from ast_parser import parse_xml_ast, BlocklyASTParser
from backtest_service import parse_xml_simple, generate_strategy_code_simple

# The problematic XML
xml = '''<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_forever" id="8Dp@;[kZz(}zyrAzU`_:" x="50" y="50">
  <statement name="DO">
  <block type="control_if" id="#zs##D)K{3[AiSdt)6ak">
  <value name="CONDITION">
  <block type="operator_less" id="}.;b8)qb%K0|d${?4K%2">
  <value name="LEFT">
  <block type="ta_rsi" id="ID#B83Ltvw5u,(nh`5S{">
  <mutation ma_period="14" applied_price="0">
</mutation>

  <field name="NAME">RSI</field>

  <field name="PERIOD">60</field>

</block>

</value>

  <value name="RIGHT">
  <shadow type="math_number" id="qLs[q~M(*)8+9`Yh,YOT">
  <field name="NUM">30</field>

</shadow>

</value>

</block>

</value>

  <statement name="DO">
  <block type="trade_order" id="eOlC$!ERXGgoM$Na3K~B">
  <field name="TRADE_ID">rsi_long_trade</field>

  <field name="DIRECTION">long</field>

  <field name="SIZE">100</field>

  <field name="SIZE_TYPE">percent</field>

  <field name="ORDER_TYPE">market</field>

  <next>
  <block type="trade_stop_loss" id=".CN*+xmwzdJ|l{o;-].0">
  <field name="CLOSE_TYPE">full</field>

  <field name="TRADE_ID">rsi_long_trade</field>

  <value name="PRICE">
  <block type="operator_subtract" id="$OE_McQY7/hXZ|!P)$(/">
  <value name="LEFT">
  <block type="trade_entry_price" id="~KF.^TKS_@;fh.Zh{uNn">
  <field name="TRADE_ID">rsi_long_trade</field>

</block>

</value>

  <value name="RIGHT">
  <block type="operator_multiply" id="+iBSxQTjIq`8.y}FR_T%">
  <value name="LEFT">
  <block type="ta_atr" id="J(yq:@yb;!0OsTnofT!e">
  <mutation ma_period="14">
</mutation>

  <field name="NAME">ATR</field>

  <field name="PERIOD">60</field>

</block>

</value>

  <value name="RIGHT">
  <shadow type="math_number" id="Mhx(?i,0Kua{:z3/wQiv">
  <field name="NUM">1.5</field>

</shadow>

</value>

</block>

</value>

</block>

</value>

  <next>
  <block type="trade_take_profit" id="CH(Nika(s`T)K28}q6Xp">
  <field name="CLOSE_TYPE">full</field>

  <field name="TRADE_ID">rsi_long_trade</field>

  <value name="PRICE">
  <block type="operator_add" id="9UE?cl2aSR~[,3tNAD6C">
  <value name="LEFT">
  <block type="trade_entry_price" id="$63+=J%)@Z`l5:5X[et}">
  <field name="TRADE_ID">rsi_long_trade</field>

</block>

</value>

  <value name="RIGHT">
  <block type="operator_multiply" id="xR7h$lGq)`%Lodq$~dOX">
  <value name="LEFT">
  <block type="operator_multiply" id="%-ATwPh2%V2%Zdco0w0m">
  <value name="LEFT">
  <block type="ta_atr" id="7d|{?U6fE9s]ym1*eBf!">
  <mutation ma_period="14">
</mutation>

  <field name="NAME">ATR</field>

  <field name="PERIOD">60</field>

</block>

</value>

  <value name="RIGHT">
  <shadow type="math_number" id="40DTR}sBoJ},{(~tE0(v">
  <field name="NUM">1.5</field>

</shadow>

</value>

</block>

</value>

  <value name="RIGHT">
  <shadow type="math_number" id="FQjL#5-#JL|8K}YYFT-d">
  <field name="NUM">2</field>

</shadow>

</value>

</block>

</value>

</block>

</value>

  <next>
  <block type="control_wait_until" id="ENGoXvZw3|dhZ.[Wr_#m">
  <value name="CONDITION">
  <block type="operator_greater" id="8dW+S/4n--+w{$EbD0F7">
  <value name="LEFT">
  <block type="ta_rsi" id="F4*I%:Pn,2*b},?Jpr!1">
  <mutation ma_period="14" applied_price="0">
</mutation>

  <field name="NAME">RSI</field>

  <field name="PERIOD">60</field>

</block>

</value>

  <value name="RIGHT">
  <shadow type="math_number" id="n6]vIall]$?L6CN@T4Lc">
  <field name="NUM">70</field>

</shadow>

</value>

</block>

</value>

  <next>
  <block type="trade_close" id="G.A0h]SDS~aAZ$(lNp-v">
  <field name="TRADE_ID">rsi_long_trade</field>

  <value name="PERCENT">
  <shadow type="math_number" id=".P/H}xanXfo1=5C(!:GE">
  <field name="NUM">100</field>

</shadow>

</value>

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

print("="*70)
print("DEBUGGING XML STRATEGY - 0 TRADES ISSUE")
print("="*70)

# Step 1: Parse with AST parser
print("\n📋 Step 1: AST Parser Results")
print("-"*50)
try:
    ast_result = parse_xml_ast(xml)
    print(f"Indicators: {ast_result.get('indicators', [])}")
    print(f"Conditions: {ast_result.get('conditions', [])}")
    print(f"Entry Direction: {ast_result.get('entry_direction')}")
    print(f"Risk Management: {ast_result.get('risk_management', {})}")
except Exception as e:
    print(f"AST Parser Error: {e}")
    import traceback
    traceback.print_exc()

# Step 2: Parse with regex parser
print("\n📋 Step 2: Regex Parser Results")
print("-"*50)
try:
    regex_result = parse_xml_simple(xml)
    print(f"Indicators: {regex_result.get('indicators', [])}")
    print(f"Conditions: {regex_result.get('conditions', [])}")
    print(f"Entry Direction: {regex_result.get('entry_direction')}")
    print(f"ATR SL Mult: {regex_result.get('atr_sl_mult')}")
    print(f"ATR TP Mult: {regex_result.get('atr_tp_mult')}")
except Exception as e:
    print(f"Regex Parser Error: {e}")
    import traceback
    traceback.print_exc()

# Step 3: Generate strategy code
print("\n📋 Step 3: Generated Strategy Code")
print("-"*50)
try:
    # Use regex result which has the thresholds extracted
    code = generate_strategy_code_simple(regex_result)
    print(code)
except Exception as e:
    print(f"Code Generation Error: {e}")
    import traceback
    traceback.print_exc()

# Step 4: Analyze the issue
print("\n📋 Step 4: Analysis")
print("-"*50)

# Check RSI period
rsi_indicators = [i for i in regex_result.get('indicators', []) if i.get('type') == 'RSI']
if rsi_indicators:
    rsi_period = rsi_indicators[0].get('period', 14)
    print(f"RSI Period from XML: {rsi_period}")
    if rsi_period == 60:
        print("⚠️  RSI period is 60 - this is very long!")
        print("   The RSI with 60-period smoothing rarely goes below 30 or above 70")
        print("   This could be why there are 0 trades")
else:
    print("❌ No RSI indicator found!")

# Check thresholds
thresholds = regex_result.get('thresholds', {})
print(f"Thresholds extracted: {thresholds}")

# Check if trade_order block was detected
if 'trade_order' in xml:
    print("✅ trade_order block found in XML")
else:
    print("❌ trade_order block NOT found")

# Check conditions
conditions = regex_result.get('conditions', [])
print(f"Conditions detected: {conditions}")
