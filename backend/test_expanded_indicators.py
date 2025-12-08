#!/usr/bin/env python3
"""
Test script for expanded indicator parsing and strategy generation.
Tests: CCI, Williams %R, ADX/DMI, Donchian, Keltner, SAR, SuperTrend
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backtest_service import parse_xml_simple, generate_strategy_code_simple

# Test XMLs for each new indicator type
TEST_CASES = {
    "CCI": '''
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_forever">
    <statement name="DO">
      <block type="control_if">
        <value name="CONDITION">
          <block type="operator_less">
            <value name="LEFT">
              <block type="ta_cci">
                <field name="PERIOD">20</field>
                <mutation ma_period="20" applied_price="0"></mutation>
              </block>
            </value>
            <value name="RIGHT">
              <shadow type="math_number"><field name="NUM">-100</field></shadow>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_order">
            <field name="DIRECTION">long</field>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>
''',

    "Williams_R": '''
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_forever">
    <statement name="DO">
      <block type="control_if">
        <value name="CONDITION">
          <block type="operator_less">
            <value name="LEFT">
              <block type="ta_williams_r">
                <field name="PERIOD">14</field>
                <mutation ma_period="14"></mutation>
              </block>
            </value>
            <value name="RIGHT">
              <shadow type="math_number"><field name="NUM">-80</field></shadow>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_order">
            <field name="DIRECTION">long</field>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>
''',

    "ADX": '''
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_forever">
    <statement name="DO">
      <block type="control_if">
        <value name="CONDITION">
          <block type="operator_greater">
            <value name="LEFT">
              <block type="ta_adx">
                <field name="PERIOD">14</field>
                <mutation ma_period="14"></mutation>
              </block>
            </value>
            <value name="RIGHT">
              <shadow type="math_number"><field name="NUM">25</field></shadow>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_order">
            <field name="DIRECTION">long</field>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>
''',

    "Donchian": '''
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_forever">
    <statement name="DO">
      <block type="control_if">
        <value name="CONDITION">
          <block type="operator_greater_equals">
            <value name="LEFT">
              <block type="environment_price"><field name="TYPE">close</field></block>
            </value>
            <value name="RIGHT">
              <block type="donchian">
                <field name="PERIOD">20</field>
                <field name="COMPONENT">upper</field>
                <mutation ma_period="20"></mutation>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_order">
            <field name="DIRECTION">long</field>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>
''',

    "Keltner": '''
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_forever">
    <statement name="DO">
      <block type="control_if">
        <value name="CONDITION">
          <block type="operator_less_equals">
            <value name="LEFT">
              <block type="environment_price"><field name="TYPE">close</field></block>
            </value>
            <value name="RIGHT">
              <block type="ta_keltner">
                <field name="PERIOD">20</field>
                <field name="COMPONENT">lower</field>
                <mutation ma_period="20" deviation="2.0"></mutation>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_order">
            <field name="DIRECTION">long</field>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>
''',

    "ParabolicSAR": '''
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_forever">
    <statement name="DO">
      <block type="control_if">
        <value name="CONDITION">
          <block type="operator_greater">
            <value name="LEFT">
              <block type="environment_price"><field name="TYPE">close</field></block>
            </value>
            <value name="RIGHT">
              <block type="ta_sar">
                <mutation step="0.02" maximum="0.2"></mutation>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_order">
            <field name="DIRECTION">long</field>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>
''',

    "SuperTrend": '''
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_forever">
    <statement name="DO">
      <block type="control_if">
        <value name="CONDITION">
          <block type="operator_greater">
            <value name="LEFT">
              <block type="environment_price"><field name="TYPE">close</field></block>
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
            <field name="DIRECTION">long</field>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>
''',

    "Compound_AND": '''
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_forever">
    <statement name="DO">
      <block type="control_if">
        <value name="CONDITION">
          <block type="operator_and">
            <value name="LEFT">
              <block type="operator_less">
                <value name="LEFT">
                  <block type="ta_rsi">
                    <field name="PERIOD">14</field>
                    <mutation ma_period="14"></mutation>
                  </block>
                </value>
                <value name="RIGHT">
                  <shadow type="math_number"><field name="NUM">30</field></shadow>
                </value>
              </block>
            </value>
            <value name="RIGHT">
              <block type="operator_greater">
                <value name="LEFT">
                  <block type="ta_adx">
                    <field name="PERIOD">14</field>
                    <mutation ma_period="14"></mutation>
                  </block>
                </value>
                <value name="RIGHT">
                  <shadow type="math_number"><field name="NUM">25</field></shadow>
                </value>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_order">
            <field name="DIRECTION">long</field>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>
'''
}


def run_tests():
    """Run all indicator parsing tests"""
    print("=" * 60)
    print("TESTING EXPANDED INDICATOR PARSING")
    print("=" * 60)
    
    results = {"passed": 0, "failed": 0}
    
    for name, xml in TEST_CASES.items():
        print(f"\n{'='*40}")
        print(f"Testing: {name}")
        print("=" * 40)
        
        try:
            # Parse the XML
            parsed = parse_xml_simple(xml)
            
            print(f"✓ Parsed indicators: {[i['type'] for i in parsed['indicators']]}")
            print(f"✓ Conditions: {[c['type'] for c in parsed['conditions']]}")
            print(f"✓ Direction: {parsed['entry_direction']}")
            
            if parsed.get('has_compound_condition'):
                print(f"✓ Has compound condition (AND/OR)")
            
            if parsed.get('thresholds'):
                print(f"✓ Thresholds: {parsed['thresholds']}")
            
            # Generate strategy code
            code = generate_strategy_code_simple(parsed)
            
            # Check code was generated
            if "class GeneratedStrategy" in code:
                print(f"✓ Strategy code generated ({len(code)} chars)")
                
                # Show a preview
                lines = code.split('\n')
                class_line = next((i for i, l in enumerate(lines) if 'class GeneratedStrategy' in l), 0)
                preview = '\n'.join(lines[class_line:class_line+10])
                print(f"\nCode preview:")
                print("-" * 40)
                print(preview[:500])
                print("-" * 40)
                
                results["passed"] += 1
            else:
                print(f"✗ No strategy class in generated code")
                results["failed"] += 1
                
        except Exception as e:
            print(f"✗ Error: {e}")
            import traceback
            traceback.print_exc()
            results["failed"] += 1
    
    print("\n" + "=" * 60)
    print("TEST RESULTS")
    print("=" * 60)
    print(f"Passed: {results['passed']}/{len(TEST_CASES)}")
    print(f"Failed: {results['failed']}/{len(TEST_CASES)}")
    
    return results["failed"] == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
