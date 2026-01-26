
import sys
import os
import re
import json

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from strategy_store import hash_xml_structure, hash_xml
from backtest_service import parse_xml_simple

def test_structure_hashing():
    print("=== Testing Structure Hashing ===")
    
    # XML 1: SMA Period 14
    xml1 = """<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="trade_setup" id="setup1" x="10" y="10">
    <statement name="CONDITIONS">
      <block type="logic_compare" id="comp1">
        <field name="OP">GT</field>
        <value name="A">
          <block type="ta_sma" id="sma1">
            <field name="PERIOD">14</field>
          </block>
        </value>
        <value name="B">
          <block type="math_number" id="num1">
            <field name="NUM">100</field>
          </block>
        </value>
      </block>
    </statement>
  </block>
</xml>"""

    # XML 2: SMA Period 20 (Same structure, different value)
    xml2 = """<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="trade_setup" id="setup1" x="10" y="10">
    <statement name="CONDITIONS">
      <block type="logic_compare" id="comp1">
        <field name="OP">GT</field>
        <value name="A">
          <block type="ta_sma" id="sma1">
            <field name="PERIOD">20</field>
          </block>
        </value>
        <value name="B">
          <block type="math_number" id="num1">
            <field name="NUM">100</field>
          </block>
        </value>
      </block>
    </statement>
  </block>
</xml>"""

    # XML 3: Different Structure (e.g. EMA instead of SMA)
    xml3 = """<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="trade_setup" id="setup1" x="10" y="10">
    <statement name="CONDITIONS">
      <block type="logic_compare" id="comp1">
        <field name="OP">GT</field>
        <value name="A">
          <block type="ta_ema" id="ema1">
            <field name="PERIOD">14</field>
          </block>
        </value>
        <value name="B">
          <block type="math_number" id="num1">
            <field name="NUM">100</field>
          </block>
        </value>
      </block>
    </statement>
  </block>
</xml>"""

    hash1 = hash_xml_structure(xml1)
    hash2 = hash_xml_structure(xml2)
    hash3 = hash_xml_structure(xml3)
    
    print(f"Hash 1 (SMA 14): {hash1}")
    print(f"Hash 2 (SMA 20): {hash2}")
    print(f"Hash 3 (EMA 14): {hash3}")
    
    assert hash1 == hash2, "ERROR: Structure hash should be identical for different parameters!"
    assert hash1 != hash3, "ERROR: Structure hash should be different for different block types!"
    print("SUCCESS: Structure hashing works correctly.\n")




if __name__ == "__main__":
    try:
        test_structure_hashing()
        # test_param_extraction()
        print("ALL TESTS PASSED.")
    except AssertionError as e:
        print(e)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
