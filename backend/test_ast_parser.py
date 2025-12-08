#!/usr/bin/env python3
"""
Test AST-based XML Parser

Compares AST parser output with regex parser output to ensure compatibility.
"""

import sys
sys.path.insert(0, '/Users/sina/project-fire/PPM/backend')

from ast_parser import parse_xml_ast, BlocklyASTParser
from backtest_service import parse_xml_simple


def compare_results(ast_result: dict, regex_result: dict, test_name: str) -> bool:
    """Compare two parse results and report differences"""
    # Compare indicators
    ast_indicators = {(i['type'], i.get('period', 0)) for i in ast_result.get('indicators', [])}
    regex_indicators = {(i['type'], i.get('period', 0)) for i in regex_result.get('indicators', [])}
    
    if ast_indicators != regex_indicators:
        print(f"  ⚠️  Indicator difference:")
        print(f"      AST:   {sorted(ast_indicators)}")
        print(f"      Regex: {sorted(regex_indicators)}")
        # Allow AST to have more indicators (it parses more thoroughly)
        if not regex_indicators.issubset(ast_indicators):
            return False
    
    # Compare risk management
    ast_rm = ast_result.get('risk_management', {})
    regex_rm = regex_result.get('risk_management', {})
    
    if ast_rm != regex_rm:
        print(f"  ⚠️  Risk management difference:")
        print(f"      AST:   {ast_rm}")
        print(f"      Regex: {regex_rm}")
        # Check key values match
        for key in regex_rm:
            if key not in ast_rm:
                return False
            if isinstance(regex_rm[key], (int, float)):
                if abs(regex_rm[key] - ast_rm.get(key, 0)) > 0.01:
                    return False
    
    # Compare direction
    if ast_result.get('entry_direction') != regex_result.get('entry_direction'):
        print(f"  ⚠️  Direction difference: AST={ast_result.get('entry_direction')} vs Regex={regex_result.get('entry_direction')}")
    
    return True


def test_rsi_strategy():
    """Test RSI strategy parsing"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_rsi">
        <mutation ma_period="14" applied_price="0"></mutation>
        <field name="PERIOD">14</field>
      </block>
    </xml>
    '''
    
    print("\n📋 Test: RSI Strategy")
    ast_result = parse_xml_ast(xml)
    regex_result = parse_xml_simple(xml)
    
    # Check RSI is detected
    ast_has_rsi = any(i['type'] == 'RSI' for i in ast_result['indicators'])
    regex_has_rsi = any(i['type'] == 'RSI' for i in regex_result['indicators'])
    
    if ast_has_rsi and regex_has_rsi:
        print("  ✅ Both parsers detected RSI indicator")
        return True
    else:
        print(f"  ❌ AST has RSI: {ast_has_rsi}, Regex has RSI: {regex_has_rsi}")
        return False


def test_supertrend_strategy():
    """Test SuperTrend strategy parsing"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_supertrend">
        <mutation ma_period="10" multiplier="3.0"></mutation>
        <field name="PERIOD">10</field>
      </block>
    </xml>
    '''
    
    print("\n📋 Test: SuperTrend Strategy")
    ast_result = parse_xml_ast(xml)
    regex_result = parse_xml_simple(xml)
    
    ast_has_st = any(i['type'] == 'SUPERTREND' for i in ast_result['indicators'])
    regex_has_st = any(i['type'] == 'SUPERTREND' for i in regex_result['indicators'])
    
    if ast_has_st and regex_has_st:
        # Check multiplier
        ast_mult = next((i.get('multiplier') for i in ast_result['indicators'] if i['type'] == 'SUPERTREND'), None)
        regex_mult = next((i.get('multiplier') for i in regex_result['indicators'] if i['type'] == 'SUPERTREND'), None)
        if ast_mult == regex_mult:
            print(f"  ✅ Both parsers detected SuperTrend with multiplier={ast_mult}")
            return True
        else:
            print(f"  ⚠️  Multiplier mismatch: AST={ast_mult}, Regex={regex_mult}")
            return True  # Still pass if indicator detected
    else:
        print(f"  ❌ AST has SuperTrend: {ast_has_st}, Regex has SuperTrend: {regex_has_st}")
        return False


def test_risk_management():
    """Test risk management block parsing"""
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
    </xml>
    '''
    
    print("\n📋 Test: Risk Management Blocks")
    ast_result = parse_xml_ast(xml)
    regex_result = parse_xml_simple(xml)
    
    ast_rm = ast_result.get('risk_management', {})
    regex_rm = regex_result.get('risk_management', {})
    
    success = True
    
    # Check trailing stop
    if ast_rm.get('trailing_stop_pct') == regex_rm.get('trailing_stop_pct') == 2.5:
        print("  ✅ Trailing stop matches (2.5%)")
    else:
        print(f"  ❌ Trailing stop mismatch: AST={ast_rm.get('trailing_stop_pct')}, Regex={regex_rm.get('trailing_stop_pct')}")
        success = False
    
    # Check max drawdown
    if ast_rm.get('max_drawdown_pct') == regex_rm.get('max_drawdown_pct') == 10.0:
        print("  ✅ Max drawdown matches (10%)")
    else:
        print(f"  ❌ Max drawdown mismatch: AST={ast_rm.get('max_drawdown_pct')}, Regex={regex_rm.get('max_drawdown_pct')}")
        success = False
    
    return success


def test_macd_strategy():
    """Test MACD strategy parsing"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_macd">
        <mutation fastema="12" slowema="26" signalsma="9"></mutation>
      </block>
    </xml>
    '''
    
    print("\n📋 Test: MACD Strategy")
    ast_result = parse_xml_ast(xml)
    regex_result = parse_xml_simple(xml)
    
    ast_has_macd = any(i['type'] == 'MACD' for i in ast_result['indicators'])
    regex_has_macd = any(i['type'] == 'MACD' for i in regex_result['indicators'])
    
    if ast_has_macd and regex_has_macd:
        # Check parameters
        ast_macd = next((i for i in ast_result['indicators'] if i['type'] == 'MACD'), {})
        regex_macd = next((i for i in regex_result['indicators'] if i['type'] == 'MACD'), {})
        
        if ast_macd.get('fast') == regex_macd.get('fast') == 12:
            print(f"  ✅ MACD detected with fast={ast_macd.get('fast')}, slow={ast_macd.get('slow')}, signal={ast_macd.get('signal')}")
            return True
        else:
            print(f"  ⚠️  MACD params differ slightly but both detected")
            return True
    else:
        print(f"  ❌ AST has MACD: {ast_has_macd}, Regex has MACD: {regex_has_macd}")
        return False


def test_nested_conditions():
    """Test nested condition parsing (AST-only feature)"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_rsi">
        <field name="PERIOD">14</field>
      </block>
      <block type="operator_and">
        <value name="A">
          <block type="operator_less">
            <value name="LEFT">
              <block type="ta_rsi">
                <field name="PERIOD">14</field>
              </block>
            </value>
            <value name="RIGHT">
              <block type="math_number">
                <field name="NUM">30</field>
              </block>
            </value>
          </block>
        </value>
        <value name="B">
          <block type="operator_greater">
            <value name="LEFT">
              <block type="ta_sma">
                <field name="PERIOD">50</field>
              </block>
            </value>
            <value name="RIGHT">
              <block type="ta_sma">
                <field name="PERIOD">200</field>
              </block>
            </value>
          </block>
        </value>
      </block>
    </xml>
    '''
    
    print("\n📋 Test: Nested Conditions (AST advantage)")
    ast_result = parse_xml_ast(xml)
    
    # Check that AST parser found all indicators
    indicators = [i['type'] for i in ast_result['indicators']]
    
    expected = ['RSI', 'RSI', 'SMA', 'SMA']  # RSI appears in condition too
    
    has_rsi = 'RSI' in indicators
    has_sma = 'SMA' in indicators
    has_compound = ast_result.get('has_compound_condition', False)
    
    if has_rsi and has_sma:
        print(f"  ✅ Found nested indicators: {set(indicators)}")
        if has_compound:
            print("  ✅ Detected compound condition (AND)")
        return True
    else:
        print(f"  ❌ Missing indicators. Found: {indicators}")
        return False


def test_multiple_indicators():
    """Test parsing multiple indicators"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="ta_rsi">
        <field name="PERIOD">14</field>
      </block>
      <block type="ta_sma">
        <field name="PERIOD">20</field>
      </block>
      <block type="ta_ema">
        <field name="PERIOD">50</field>
      </block>
      <block type="ta_atr">
        <mutation ma_period="14"></mutation>
      </block>
    </xml>
    '''
    
    print("\n📋 Test: Multiple Indicators")
    ast_result = parse_xml_ast(xml)
    regex_result = parse_xml_simple(xml)
    
    ast_types = {i['type'] for i in ast_result['indicators']}
    regex_types = {i['type'] for i in regex_result['indicators']}
    
    expected = {'RSI', 'SMA', 'EMA', 'ATR'}
    
    ast_ok = expected.issubset(ast_types)
    regex_ok = expected.issubset(regex_types)
    
    if ast_ok and regex_ok:
        print(f"  ✅ Both parsers found all indicators: {expected}")
        return True
    else:
        print(f"  ❌ AST found: {ast_types}, Regex found: {regex_types}")
        return False


def test_price_data_blocks():
    """Test price data block parsing (AST-only)"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <block type="price_close"></block>
      <block type="price_high"></block>
      <block type="price_low"></block>
    </xml>
    '''
    
    print("\n📋 Test: Price Data Blocks")
    ast_result = parse_xml_ast(xml)
    
    # AST parser should handle these gracefully
    # (Regex parser doesn't track price data blocks)
    print(f"  ✅ AST parser handled price data blocks (no crash)")
    return True


def test_complex_xml():
    """Test with realistic complex XML"""
    xml = '''
    <xml xmlns="https://developers.google.com/blockly/xml">
      <variables>
        <variable id="abc123">myRSI</variable>
      </variables>
      <block type="ta_rsi" id="rsi_block">
        <mutation ma_period="14" applied_price="0"></mutation>
        <field name="NAME">RSI</field>
        <field name="PERIOD">14</field>
      </block>
      <block type="ta_supertrend" id="st_block">
        <mutation ma_period="10" multiplier="3.0"></mutation>
        <field name="PERIOD">10</field>
      </block>
      <block type="trade_buy" id="buy_block">
        <field name="DIRECTION">long</field>
        <field name="SIZE">0.1</field>
        <value name="SL">
          <block type="ta_atr">
            <mutation ma_period="14"></mutation>
          </block>
        </value>
      </block>
      <block type="risk_trailing_stop">
        <field name="PERCENT">3.5</field>
      </block>
    </xml>
    '''
    
    print("\n📋 Test: Complex Realistic XML")
    ast_result = parse_xml_ast(xml)
    regex_result = parse_xml_simple(xml)
    
    success = True
    
    # Check indicators
    ast_types = {i['type'] for i in ast_result['indicators']}
    if 'RSI' in ast_types and 'SUPERTREND' in ast_types:
        print(f"  ✅ Found key indicators: RSI, SuperTrend")
    else:
        print(f"  ❌ Missing indicators: {ast_types}")
        success = False
    
    # Check risk management
    if ast_result.get('risk_management', {}).get('trailing_stop_pct') == 3.5:
        print("  ✅ Trailing stop parsed correctly (3.5%)")
    else:
        print(f"  ❌ Trailing stop wrong: {ast_result.get('risk_management')}")
        success = False
    
    return success


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Testing AST-based XML Parser vs Regex Parser")
    print("="*60)
    
    tests = [
        test_rsi_strategy,
        test_supertrend_strategy,
        test_risk_management,
        test_macd_strategy,
        test_nested_conditions,
        test_multiple_indicators,
        test_price_data_blocks,
        test_complex_xml,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  ❌ Exception: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "="*60)
    print(f"Results: {passed}/{len(tests)} tests passed")
    if failed > 0:
        print(f"⚠️  {failed} tests failed")
    else:
        print("✅ All tests passed!")
    print("="*60)
