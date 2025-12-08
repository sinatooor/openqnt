"""
XML Evaluator for Blockly Trading Strategies

Parses Blockly XML and evaluates trading conditions against market data.
"""

import re
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional, List, Tuple
import pandas as pd
import numpy as np


class IndicatorCalculator:
    """Calculate technical indicators from OHLCV data."""
    
    @staticmethod
    def sma(data: pd.Series, period: int) -> pd.Series:
        """Simple Moving Average"""
        return data.rolling(window=period).mean()
    
    @staticmethod
    def ema(data: pd.Series, period: int) -> pd.Series:
        """Exponential Moving Average"""
        return data.ewm(span=period, adjust=False).mean()
    
    @staticmethod
    def rsi(data: pd.Series, period: int = 14) -> pd.Series:
        """Relative Strength Index"""
        delta = data.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs))
    
    @staticmethod
    def macd(data: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> Tuple[pd.Series, pd.Series, pd.Series]:
        """MACD indicator"""
        exp1 = data.ewm(span=fast, adjust=False).mean()
        exp2 = data.ewm(span=slow, adjust=False).mean()
        macd_line = exp1 - exp2
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        histogram = macd_line - signal_line
        return macd_line, signal_line, histogram
    
    @staticmethod
    def bollinger_bands(data: pd.Series, period: int = 20, std_dev: float = 2.0) -> Tuple[pd.Series, pd.Series, pd.Series]:
        """Bollinger Bands"""
        sma = data.rolling(window=period).mean()
        std = data.rolling(window=period).std()
        upper = sma + (std * std_dev)
        lower = sma - (std * std_dev)
        return upper, sma, lower


class BlocklyXMLEvaluator:
    """
    Parse and evaluate Blockly XML trading strategies.
    
    Extracts buy/sell conditions and evaluates them against market data.
    """
    
    def __init__(self, xml_string: str):
        self.xml_string = xml_string
        self.root = None
        self.buy_conditions = []
        self.sell_conditions = []
        self.indicators_needed = []
        self._parse()
    
    def _parse(self):
        """Parse the XML and extract conditions."""
        try:
            # Clean XML string
            clean_xml = self.xml_string.strip()
            if not clean_xml.startswith('<?xml'):
                clean_xml = '<?xml version="1.0"?>' + clean_xml
            
            self.root = ET.fromstring(clean_xml)
            self._extract_conditions()
        except ET.ParseError as e:
            print(f"XML parse error: {e}")
            self.root = None
    
    def _extract_conditions(self):
        """Extract buy and sell conditions from blocks."""
        if self.root is None:
            return
        
        # Find buy_condition blocks
        for block in self.root.iter('block'):
            block_type = block.get('type', '')
            
            if block_type == 'buy_condition':
                condition = self._extract_condition_logic(block)
                if condition:
                    self.buy_conditions.append(condition)
            
            elif block_type == 'sell_condition':
                condition = self._extract_condition_logic(block)
                if condition:
                    self.sell_conditions.append(condition)
    
    def _extract_condition_logic(self, block) -> Optional[Dict]:
        """Extract the logic from a condition block."""
        condition = {
            'type': block.get('type'),
            'comparisons': []
        }
        
        # Look for comparison operators within the block
        for value in block.findall('.//value'):
            value_name = value.get('name', '')
            if 'CONDITION' in value_name or 'IF' in value_name:
                comp = self._parse_comparison(value)
                if comp:
                    condition['comparisons'].append(comp)
        
        # Also check direct children for comparisons
        for child_block in block.findall('.//block'):
            if child_block.get('type', '').startswith('operator_'):
                comp = self._parse_comparison_block(child_block)
                if comp:
                    condition['comparisons'].append(comp)
        
        return condition if condition['comparisons'] else None
    
    def _parse_comparison(self, value_elem) -> Optional[Dict]:
        """Parse a comparison from a value element."""
        block = value_elem.find('block')
        if block is not None:
            return self._parse_comparison_block(block)
        return None
    
    def _parse_comparison_block(self, block) -> Optional[Dict]:
        """Parse a comparison block (operator_greater, operator_less, etc.)."""
        block_type = block.get('type', '')
        
        comparison = {
            'operator': self._get_operator(block_type),
            'left': None,
            'right': None
        }
        
        # Get left and right values
        for value in block.findall('value'):
            name = value.get('name', '')
            parsed = self._parse_value(value)
            
            if name == 'A' or name == 'LEFT':
                comparison['left'] = parsed
            elif name == 'B' or name == 'RIGHT':
                comparison['right'] = parsed
        
        if comparison['left'] and comparison['right']:
            return comparison
        return None
    
    def _get_operator(self, block_type: str) -> str:
        """Convert block type to operator string."""
        operators = {
            'operator_greater': '>',
            'operator_less': '<',
            'operator_equals': '==',
            'operator_greater_equals': '>=',
            'operator_less_equals': '<=',
            'operator_crosses_above': 'crosses_above',
            'operator_crosses_below': 'crosses_below'
        }
        return operators.get(block_type, '==')
    
    def _parse_value(self, value_elem) -> Optional[Dict]:
        """Parse a value element to extract indicator or number."""
        block = value_elem.find('block')
        if block is None:
            return None
        
        block_type = block.get('type', '')
        
        # Check if it's an indicator
        if block_type.startswith('ta_'):
            return self._parse_indicator(block)
        
        # Check if it's a number
        if block_type == 'math_number':
            field = block.find('field[@name="NUM"]')
            if field is not None:
                return {'type': 'number', 'value': float(field.text or 0)}
        
        # Check if it's a price field
        if block_type == 'price_field':
            field = block.find('field[@name="FIELD"]')
            if field is not None:
                return {'type': 'price', 'field': field.text or 'close'}
        
        return None
    
    def _parse_indicator(self, block) -> Dict:
        """Parse a technical indicator block."""
        block_type = block.get('type', '')
        indicator = {
            'type': 'indicator',
            'name': block_type.replace('ta_', ''),
            'params': {}
        }
        
        # Extract parameters from fields
        for field in block.findall('field'):
            name = field.get('name', '')
            value = field.text or ''
            
            if name.lower() in ['period', 'ma_period', 'length']:
                indicator['params']['period'] = int(value) if value.isdigit() else 14
            elif name.lower() in ['source', 'price']:
                indicator['params']['source'] = value.lower()
        
        # Default period if not specified
        if 'period' not in indicator['params']:
            indicator['params']['period'] = 14
        
        self.indicators_needed.append(indicator)
        return indicator
    
    def calculate_indicators(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate all needed indicators and add to dataframe."""
        calc = IndicatorCalculator()
        
        for ind in self.indicators_needed:
            name = ind['name']
            period = ind['params'].get('period', 14)
            source = ind['params'].get('source', 'close')
            
            col_name = f"{name}_{period}"
            
            if source in data.columns:
                source_data = data[source]
            else:
                source_data = data['close']
            
            if name == 'sma':
                data[col_name] = calc.sma(source_data, period)
            elif name == 'ema':
                data[col_name] = calc.ema(source_data, period)
            elif name == 'rsi':
                data[col_name] = calc.rsi(source_data, period)
            elif name == 'macd':
                macd, signal, hist = calc.macd(source_data)
                data['macd_line'] = macd
                data['macd_signal'] = signal
                data['macd_hist'] = hist
        
        return data
    
    def evaluate_condition(self, conditions: List[Dict], data: pd.DataFrame, index: int) -> bool:
        """Evaluate conditions at a specific bar index."""
        if not conditions:
            return False
        
        for condition in conditions:
            for comp in condition.get('comparisons', []):
                left_val = self._get_value(comp['left'], data, index)
                right_val = self._get_value(comp['right'], data, index)
                
                if left_val is None or right_val is None:
                    continue
                
                operator = comp['operator']
                
                if operator == '>':
                    if left_val > right_val:
                        return True
                elif operator == '<':
                    if left_val < right_val:
                        return True
                elif operator == '>=':
                    if left_val >= right_val:
                        return True
                elif operator == '<=':
                    if left_val <= right_val:
                        return True
                elif operator == '==':
                    if abs(left_val - right_val) < 0.0001:
                        return True
                elif operator == 'crosses_above':
                    if index > 0:
                        prev_left = self._get_value(comp['left'], data, index - 1)
                        prev_right = self._get_value(comp['right'], data, index - 1)
                        if prev_left and prev_right:
                            if prev_left <= prev_right and left_val > right_val:
                                return True
                elif operator == 'crosses_below':
                    if index > 0:
                        prev_left = self._get_value(comp['left'], data, index - 1)
                        prev_right = self._get_value(comp['right'], data, index - 1)
                        if prev_left and prev_right:
                            if prev_left >= prev_right and left_val < right_val:
                                return True
        
        return False
    
    def _get_value(self, value_def: Optional[Dict], data: pd.DataFrame, index: int) -> Optional[float]:
        """Get the numeric value for a value definition at given index."""
        if value_def is None:
            return None
        
        val_type = value_def.get('type')
        
        if val_type == 'number':
            return value_def.get('value', 0)
        
        elif val_type == 'price':
            field = value_def.get('field', 'close')
            if field in data.columns and index < len(data):
                return float(data.iloc[index][field])
        
        elif val_type == 'indicator':
            name = value_def.get('name', '')
            period = value_def.get('params', {}).get('period', 14)
            col_name = f"{name}_{period}"
            
            if col_name in data.columns and index < len(data):
                val = data.iloc[index][col_name]
                if pd.notna(val):
                    return float(val)
        
        return None
    
    def should_buy(self, data: pd.DataFrame, index: int) -> bool:
        """Check if buy signal is triggered at given index."""
        return self.evaluate_condition(self.buy_conditions, data, index)
    
    def should_sell(self, data: pd.DataFrame, index: int) -> bool:
        """Check if sell signal is triggered at given index."""
        return self.evaluate_condition(self.sell_conditions, data, index)
    
    def to_python_logic(self) -> str:
        """
        Convert parsed conditions to human-readable Python logic.
        This is used for LLM verification.
        """
        lines = []
        lines.append("# Trading Strategy Logic (auto-generated from Blockly XML)")
        lines.append("")
        
        # Buy conditions
        lines.append("def should_buy(data, index):")
        if self.buy_conditions:
            for i, cond in enumerate(self.buy_conditions):
                for comp in cond.get('comparisons', []):
                    left = self._value_to_python(comp.get('left'))
                    right = self._value_to_python(comp.get('right'))
                    op = comp.get('operator', '==')
                    
                    if op == 'crosses_above':
                        lines.append(f"    # Condition {i+1}: {left} crosses above {right}")
                        lines.append(f"    if {left}[index-1] <= {right}[index-1] and {left}[index] > {right}[index]:")
                        lines.append(f"        return True")
                    elif op == 'crosses_below':
                        lines.append(f"    # Condition {i+1}: {left} crosses below {right}")
                        lines.append(f"    if {left}[index-1] >= {right}[index-1] and {left}[index] < {right}[index]:")
                        lines.append(f"        return True")
                    else:
                        lines.append(f"    # Condition {i+1}: {left} {op} {right}")
                        lines.append(f"    if {left}[index] {op} {right}[index]:")
                        lines.append(f"        return True")
        else:
            lines.append("    # No buy conditions defined")
            lines.append("    return False")
        lines.append("    return False")
        lines.append("")
        
        # Sell conditions
        lines.append("def should_sell(data, index):")
        if self.sell_conditions:
            for i, cond in enumerate(self.sell_conditions):
                for comp in cond.get('comparisons', []):
                    left = self._value_to_python(comp.get('left'))
                    right = self._value_to_python(comp.get('right'))
                    op = comp.get('operator', '==')
                    
                    if op == 'crosses_above':
                        lines.append(f"    # Condition {i+1}: {left} crosses above {right}")
                        lines.append(f"    if {left}[index-1] <= {right}[index-1] and {left}[index] > {right}[index]:")
                        lines.append(f"        return True")
                    elif op == 'crosses_below':
                        lines.append(f"    # Condition {i+1}: {left} crosses below {right}")
                        lines.append(f"    if {left}[index-1] >= {right}[index-1] and {left}[index] < {right}[index]:")
                        lines.append(f"        return True")
                    else:
                        lines.append(f"    # Condition {i+1}: {left} {op} {right}")
                        lines.append(f"    if {left}[index] {op} {right}[index]:")
                        lines.append(f"        return True")
        else:
            lines.append("    # No sell conditions defined")
            lines.append("    return False")
        lines.append("    return False")
        
        return "\n".join(lines)
    
    def _value_to_python(self, value_def: Optional[Dict]) -> str:
        """Convert a value definition to Python code string."""
        if value_def is None:
            return "None"
        
        val_type = value_def.get('type')
        
        if val_type == 'number':
            return str(value_def.get('value', 0))
        
        elif val_type == 'price':
            field = value_def.get('field', 'close')
            return f"data['{field}']"
        
        elif val_type == 'indicator':
            name = value_def.get('name', '')
            period = value_def.get('params', {}).get('period', 14)
            return f"data['{name}_{period}']"
        
        return "None"


async def verify_xml_to_python_with_llm(xml_string: str, python_logic: str) -> Dict[str, Any]:
    """
    Use LLM to verify that the XML was correctly translated to Python logic.
    
    Sends both the original XML and generated Python to the LLM for validation.
    Returns verified/corrected Python logic.
    """
    import httpx
    import os
    
    system_prompt = """You are a trading strategy validator. Your job is to verify that Blockly XML 
was correctly translated to Python trading logic.

Given:
1. The original Blockly XML
2. The generated Python logic

You must:
1. Analyze the XML to understand the intended trading conditions
2. Check if the Python logic correctly implements those conditions
3. If correct, return the Python logic unchanged with "VERIFIED: true"
4. If incorrect, fix the Python logic and return with "VERIFIED: false" and "CORRECTIONS: <list>"

Return your response in this format:
```python
# VERIFIED: true/false
# CORRECTIONS: <none or list of fixes made>

<the verified or corrected Python code>
```"""

    user_prompt = f"""Please verify this XML-to-Python translation:

## Original Blockly XML:
```xml
{xml_string}
```

## Generated Python Logic:
```python
{python_logic}
```

Verify the translation is correct. If not, provide the corrected Python code."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    # Call DeepSeek API
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        print("Warning: DEEPSEEK_API_KEY not set, skipping LLM verification")
        return {
            "verified": False,
            "skipped": True,
            "python_logic": python_logic,
            "message": "LLM verification skipped (no API key)"
        }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "deepseek-chat",
                    "messages": messages,
                    "temperature": 0.3,
                    "max_tokens": 2000
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                
                # Parse response
                verified = "VERIFIED: true" in content.lower() or "verified: true" in content.lower()
                
                # Extract Python code from response
                if "```python" in content:
                    code_start = content.find("```python") + 9
                    code_end = content.find("```", code_start)
                    if code_end > code_start:
                        verified_logic = content[code_start:code_end].strip()
                    else:
                        verified_logic = python_logic
                else:
                    verified_logic = python_logic
                
                print(f"LLM Verification: {'PASSED' if verified else 'CORRECTIONS MADE'}")
                
                return {
                    "verified": verified,
                    "skipped": False,
                    "python_logic": verified_logic,
                    "llm_response": content
                }
            else:
                print(f"LLM API error: {response.status_code}")
                return {
                    "verified": False,
                    "skipped": True,
                    "python_logic": python_logic,
                    "message": f"LLM API error: {response.status_code}"
                }
                
    except Exception as e:
        print(f"LLM verification error: {e}")
        return {
            "verified": False,
            "skipped": True,
            "python_logic": python_logic,
            "message": str(e)
        }


class LLMVerifiedEvaluator(BlocklyXMLEvaluator):
    """
    An evaluator that uses LLM to verify the XML-to-Python translation.
    """
    
    def __init__(self, xml_string: str):
        super().__init__(xml_string)
        self.verification_result = None
        self.verified_logic = None
    
    async def verify(self) -> Dict[str, Any]:
        """Run LLM verification on the parsed logic."""
        python_logic = self.to_python_logic()
        self.verification_result = await verify_xml_to_python_with_llm(
            self.xml_string, 
            python_logic
        )
        self.verified_logic = self.verification_result.get("python_logic", python_logic)
        return self.verification_result


# Test
if __name__ == "__main__":
    test_xml = """
    <xml>
        <block type="strategy_block">
            <statement name="BUY">
                <block type="buy_condition">
                    <value name="CONDITION">
                        <block type="operator_greater">
                            <value name="A">
                                <block type="ta_sma">
                                    <field name="PERIOD">10</field>
                                </block>
                            </value>
                            <value name="B">
                                <block type="ta_sma">
                                    <field name="PERIOD">20</field>
                                </block>
                            </value>
                        </block>
                    </value>
                </block>
            </statement>
        </block>
    </xml>
    """
    
    evaluator = BlocklyXMLEvaluator(test_xml)
    print(f"Buy conditions: {evaluator.buy_conditions}")
    print(f"Indicators needed: {evaluator.indicators_needed}")
