#!/usr/bin/env python3
"""
Test Risk Management Block Parsing and Code Generation
Validates:
1. Trailing stop parsing
2. Max drawdown parsing  
3. Scale in/out parsing
4. Daily loss limit parsing
5. Code generation with trailing stops
"""

import sys
sys.path.insert(0, '/Users/sina/project-fire/PPM/backend')

from backtest_service import parse_xml_simple, generate_strategy_code_simple

def test_trailing_stop_parsing():
    """Test trailing stop block is parsed correctly"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_rsi">
        <field name="PERIOD">14</field>
      </block>
      <block type="risk_trailing_stop">
        <field name="PERCENT">3.5</field>
      </block>
    </xml>
    '''
    result = parse_xml_simple(xml)
    assert "risk_management" in result, "Should have risk_management section"
    assert result["risk_management"].get("trailing_stop_pct") == 3.5, f"Trailing stop should be 3.5, got {result['risk_management'].get('trailing_stop_pct')}"
    print("✅ Trailing stop parsing works")

def test_max_drawdown_parsing():
    """Test max drawdown block is parsed correctly"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_rsi">
        <field name="PERIOD">14</field>
      </block>
      <block type="risk_max_drawdown">
        <field name="PERCENT">15</field>
      </block>
    </xml>
    '''
    result = parse_xml_simple(xml)
    assert "risk_management" in result, "Should have risk_management section"
    assert result["risk_management"].get("max_drawdown_pct") == 15.0, f"Max drawdown should be 15, got {result['risk_management'].get('max_drawdown_pct')}"
    print("✅ Max drawdown parsing works")

def test_daily_loss_limit_parsing():
    """Test daily loss limit block is parsed correctly"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_rsi">
        <field name="PERIOD">14</field>
      </block>
      <block type="risk_daily_loss_limit">
        <field name="AMOUNT">500</field>
      </block>
    </xml>
    '''
    result = parse_xml_simple(xml)
    assert "risk_management" in result, "Should have risk_management section"
    assert result["risk_management"].get("daily_loss_limit") == 500.0, f"Daily loss should be 500, got {result['risk_management'].get('daily_loss_limit')}"
    print("✅ Daily loss limit parsing works")

def test_scale_in_parsing():
    """Test scale in block is parsed correctly"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_rsi">
        <field name="PERIOD">14</field>
      </block>
      <block type="risk_scale_in">
        <field name="AMOUNT">0.25</field>
        <field name="INTERVALS">4</field>
      </block>
    </xml>
    '''
    result = parse_xml_simple(xml)
    assert "risk_management" in result, "Should have risk_management section"
    scale_in = result["risk_management"].get("scale_in", {})
    assert scale_in.get("intervals") == 4, f"Scale in intervals should be 4, got {scale_in.get('intervals')}"
    assert scale_in.get("amount") == 0.25, f"Scale in amount should be 0.25, got {scale_in.get('amount')}"
    print("✅ Scale in parsing works")

def test_scale_out_parsing():
    """Test scale out block is parsed correctly"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_rsi">
        <field name="PERIOD">14</field>
      </block>
      <block type="risk_scale_out">
        <field name="AMOUNT">0.25</field>
        <field name="INTERVALS">4</field>
      </block>
    </xml>
    '''
    result = parse_xml_simple(xml)
    assert "risk_management" in result, "Should have risk_management section"
    scale_out = result["risk_management"].get("scale_out", {})
    assert scale_out.get("intervals") == 4, f"Scale out intervals should be 4, got {scale_out.get('intervals')}"
    assert scale_out.get("amount") == 0.25, f"Scale out amount should be 0.25, got {scale_out.get('amount')}"
    print("✅ Scale out parsing works")

def test_combined_risk_management():
    """Test multiple risk management blocks together"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_rsi">
        <field name="PERIOD">14</field>
      </block>
      <block type="risk_trailing_stop">
        <field name="PERCENT">2.5</field>
      </block>
      <block type="risk_max_drawdown">
        <field name="PERCENT">10</field>
      </block>
      <block type="risk_daily_loss_limit">
        <field name="AMOUNT">500</field>
      </block>
    </xml>
    '''
    result = parse_xml_simple(xml)
    rm = result["risk_management"]
    assert rm.get("trailing_stop_pct") == 2.5, "Trailing stop should be 2.5"
    assert rm.get("max_drawdown_pct") == 10.0, "Max drawdown should be 10"
    assert rm.get("daily_loss_limit") == 500.0, "Daily loss should be 500"
    print("✅ Combined risk management parsing works")

def test_rsi_with_trailing_stop_code_generation():
    """Test that RSI with trailing stop generates correct code"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_rsi">
        <field name="PERIOD">14</field>
      </block>
      <block type="risk_trailing_stop">
        <field name="PERCENT">2.0</field>
      </block>
    </xml>
    '''
    parsed = parse_xml_simple(xml)
    code = generate_strategy_code_simple(parsed)
    
    # Verify trailing stop is in the code
    assert "trailing_stop_pct" in code, "Code should have trailing_stop_pct parameter"
    assert "highest_since_entry" in code, "Code should track highest_since_entry"
    assert "trailing_sl" in code, "Code should calculate trailing_sl"
    print("✅ RSI with trailing stop code generation works")

def test_supertrend_with_trailing_stop_code_generation():
    """Test that SuperTrend with trailing stop generates correct code"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_supertrend">
        <field name="PERIOD">10</field>
        <field name="MULTIPLIER">3.0</field>
      </block>
      <block type="risk_trailing_stop">
        <field name="PERCENT">3.5</field>
      </block>
    </xml>
    '''
    parsed = parse_xml_simple(xml)
    code = generate_strategy_code_simple(parsed)
    
    # Verify trailing stop is in the code
    assert "trailing_stop_pct" in code, "Code should have trailing_stop_pct parameter"
    assert "highest_since_entry" in code, "Code should track highest_since_entry"
    assert "3.5" in code, "Code should have the 3.5% trailing stop"
    print("✅ SuperTrend with trailing stop code generation works")

def test_rsi_without_trailing_stop():
    """Test that RSI without trailing stop uses standard template"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_rsi">
        <field name="PERIOD">14</field>
      </block>
    </xml>
    '''
    parsed = parse_xml_simple(xml)
    code = generate_strategy_code_simple(parsed)
    
    # Should NOT have trailing stop code
    assert "highest_since_entry" not in code, "Code should NOT have trailing stop tracking"
    assert "trailing_sl" not in code, "Code should NOT have trailing_sl calculation"
    print("✅ RSI without trailing stop uses standard template")

if __name__ == "__main__":
    print("\n" + "="*60)
    print("Testing Risk Management Block Parsing & Code Generation")
    print("="*60 + "\n")
    
    tests = [
        test_trailing_stop_parsing,
        test_max_drawdown_parsing,
        test_daily_loss_limit_parsing,
        test_scale_in_parsing,
        test_scale_out_parsing,
        test_combined_risk_management,
        test_rsi_with_trailing_stop_code_generation,
        test_supertrend_with_trailing_stop_code_generation,
        test_rsi_without_trailing_stop,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"❌ {test.__name__} failed: {e}")
            failed += 1
    
    print("\n" + "="*60)
    print(f"Results: {passed}/{len(tests)} tests passed")
    if failed > 0:
        print(f"⚠️  {failed} tests failed")
    else:
        print("✅ All tests passed!")
    print("="*60)
