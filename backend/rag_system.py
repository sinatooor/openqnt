"""
RAG System for Block Retrieval
Enhanced with synonym mapping and smarter keyword detection.
"""
import xml.etree.ElementTree as ET
import re
import os
from typing import List, Dict, Optional, Set

# Synonym mappings for better retrieval
INDICATOR_SYNONYMS = {
    # Moving Averages
    'sma': ['ta_sma', 'simple moving average', 'moving average'],
    'ema': ['ta_ema', 'exponential moving average', 'ema'],
    'ma': ['ta_sma', 'ta_ema'],  # Generic "MA" could be either
    
    # Oscillators
    'rsi': ['ta_rsi', 'relative strength', 'overbought', 'oversold'],
    'macd': ['macd_value', 'moving average convergence'],
    'stochastic': ['ta_stochastic', 'stoch'],
    'cci': ['ta_cci', 'commodity channel'],
    
    # Volatility
    'atr': ['ta_atr', 'average true range', 'volatility'],
    'bollinger': ['ta_bb', 'bb', 'bands'],
    
    # Trend
    'adx': ['ta_adx', 'directional'],
    'supertrend': ['ta_supertrend'],
    'sar': ['ta_sar', 'parabolic'],
    
    # Volume
    'volume': ['ta_obv', 'ta_mfi', 'ta_vwap', 'volumes'],
    'vwap': ['ta_vwap'],
    
    # Price Action
    'price': ['environment_price'],
    'close': ['environment_price'],
    'high': ['environment_price', 'ta_highest'],
    'low': ['environment_price', 'ta_lowest'],
}

# Action keywords
ACTION_KEYWORDS = {
    'buy': ['trade_order'],
    'sell': ['trade_order'],
    'long': ['trade_order'],
    'short': ['trade_order'],
    'entry': ['trade_order'],
    'exit': ['trade_close_all'],
    'stop': ['trade_stop_loss'],
    'take profit': ['trade_take_profit'],
    'tp': ['trade_take_profit'],
    'sl': ['trade_stop_loss'],
}

# Condition keywords
CONDITION_KEYWORDS = {
    'cross': ['operator_greater', 'operator_less'],
    'above': ['operator_greater'],
    'below': ['operator_less'],
    'greater': ['operator_greater'],
    'less': ['operator_less'],
    'and': ['operator_and'],
    'or': ['operator_or'],
    'equals': ['operator_equals'],
}


class BlockLibrary:
    def __init__(self, catalog_path: str = "BLOCK_CATALOG.xml"):
        # Check multiple locations for the catalog
        possible_paths = [
            catalog_path,
            os.path.join(os.path.dirname(__file__), "..", catalog_path),
            os.path.join("..", catalog_path),
            os.path.join(os.path.dirname(__file__), catalog_path),
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                catalog_path = path
                break
                    
        self.catalog_path = catalog_path
        self.blocks: Dict[str, str] = {}
        self.block_descriptions: Dict[str, str] = {}
        self.block_categories: Dict[str, str] = {}
        self.rules: List[str] = []
        self.templates: List[Dict[str, str]] = []
        self.load_catalog()
        
        print(f"BlockLibrary loaded {len(self.blocks)} blocks from {catalog_path}")

    def load_catalog(self):
        """Load and index blocks from the XML catalog."""
        try:
            tree = ET.parse(self.catalog_path)
            root = tree.getroot()
            
            # Find all blocks and shadows
            for block in root.findall(".//block") + root.findall(".//shadow"):
                block_type = block.get("type")
                if block_type:
                    # Convert element back to string
                    xml_str = ET.tostring(block, encoding="unicode")
                    # Clean up namespaces if any
                    xml_str = re.sub(r'\sxmlns:ns0="[^"]+"', '', xml_str)
                    xml_str = re.sub(r'\sns0:', '', xml_str)
                    
                    self.blocks[block_type] = xml_str.strip()
                    
                    # Categorize blocks
                    if block_type.startswith('ta_') or block_type in ['macd_value', 'momentum']:
                        self.block_categories[block_type] = 'indicator'
                    elif block_type.startswith('trade_'):
                        self.block_categories[block_type] = 'trade'
                    elif block_type.startswith('operator_'):
                        self.block_categories[block_type] = 'operator'
                    elif block_type.startswith('control_'):
                        self.block_categories[block_type] = 'control'
                    elif block_type.startswith('environment_'):
                        self.block_categories[block_type] = 'environment'
                    elif block_type.startswith('variables_'):
                        self.block_categories[block_type] = 'variable'
                    elif block_type.startswith('function_'):
                        self.block_categories[block_type] = 'function'
                    else:
                        self.block_categories[block_type] = 'other'
            
            # Load Rules
            for rule in root.findall(".//rules/rule"):
                if rule.text:
                    self.rules.append(rule.text.strip())
                    
            # Load Templates
            for template in root.findall(".//templates/template"):
                temp_data = {
                    'name': template.get('name', 'Unnamed Strategy'),
                    'description': template.find('description').text.strip() if template.find('description') is not None else "",
                    'xml': ""
                }
                
                # Extract XML content
                xml_node = template.find('xml')
                if xml_node is not None:
                    # Get the inner XML string (the strategy definition)
                    # We need to be careful to get the content inside <xml>...</xml>
                    # The catalog has <xml><xml>...</xml></xml> structure based on my previous read
                    # Let's extract the inner text or the first child
                    
                    # Actually, let's just convert the whole xml node to string and clean it up
                    xml_str = ET.tostring(xml_node, encoding="unicode")
                    # Remove the outer <xml> tag from the catalog wrapper if present, 
                    # but we want the <xml> tag for the strategy itself.
                    # Based on catalog structure:
                    # <template ...>
                    #   <xml>
                    #     <xml xmlns="...">...</xml>
                    #   </xml>
                    # </template>
                    
                    # So we want the child of the <xml> node
                    if len(xml_node) > 0:
                        strategy_xml = ET.tostring(xml_node[0], encoding="unicode")
                        temp_data['xml'] = strategy_xml.strip()
                
                self.templates.append(temp_data)
                    
        except Exception as e:
            print(f"Error loading block catalog: {e}")
            # Fallback: create minimal block set
            self._create_fallback_blocks()

    def _create_fallback_blocks(self):
        """Create minimal block set if catalog fails to load."""
        self.blocks = {
            'ta_rsi': '<block type="ta_rsi"><mutation ma_period="14" applied_price="0"></mutation><field name="NAME">RSI</field><field name="PERIOD">60</field></block>',
            'ta_sma': '<block type="ta_sma"><mutation ma_period="14" shift="0" applied_price="0"></mutation><field name="NAME">SMA</field><field name="PERIOD">60</field></block>',
            'operator_less': '<block type="operator_less"><value name="LEFT"></value><value name="RIGHT"></value></block>',
            'operator_greater': '<block type="operator_greater"><value name="LEFT"></value><value name="RIGHT"></value></block>',
            'trade_order': '<block type="trade_order"><field name="TRADE_ID">trade_1</field><field name="DIRECTION">long</field></block>',
            'control_forever': '<block type="control_forever"><statement name="DO"></statement></block>',
            'control_if': '<block type="control_if"><value name="CONDITION"></value><statement name="DO"></statement></block>',
        }

    def get_block_xml(self, block_type: str) -> Optional[str]:
        """Get the XML template for a specific block type."""
        return self.blocks.get(block_type)

    def get_all_block_types(self) -> List[str]:
        """Get list of all available block types."""
        return list(self.blocks.keys())
    
    def get_blocks_by_category(self, category: str) -> List[str]:
        """Get block types by category."""
        return [b for b, c in self.block_categories.items() if c == category]

    def retrieve_relevant_blocks(self, query: str) -> Dict[str, str]:
        """
        Retrieve relevant block definitions based on user query.
        Returns a dict mapping block_type -> xml_template.
        """
        query_lower = query.lower()
        relevant_types: Set[str] = set()
        
        # Always include core blocks
        core_blocks = [
            'control_forever', 'control_if', 'control_if_else',
            'environment_new_candle_open', 'math_number'
        ]
        relevant_types.update(core_blocks)
        
        # Check indicator synonyms
        for keyword, related_blocks in INDICATOR_SYNONYMS.items():
            if keyword in query_lower:
                for block in related_blocks:
                    if block.startswith('ta_') or block.startswith('macd') or block.startswith('environment'):
                        relevant_types.add(block)
        
        # Check action keywords
        for keyword, related_blocks in ACTION_KEYWORDS.items():
            if keyword in query_lower:
                relevant_types.update(related_blocks)
        
        # Check condition keywords
        for keyword, related_blocks in CONDITION_KEYWORDS.items():
            if keyword in query_lower:
                relevant_types.update(related_blocks)
        
        # If trade_order is included, also include SL/TP helpers
        if 'trade_order' in relevant_types:
            relevant_types.add('trade_stop_loss')
            relevant_types.add('trade_take_profit')
            relevant_types.add('trade_entry_price')
            relevant_types.add('ta_atr')  # Often used for SL/TP calculation
        
        # If no specific indicators found, add common ones
        if not any(t.startswith('ta_') for t in relevant_types):
            relevant_types.update(['ta_sma', 'ta_rsi', 'operator_greater', 'operator_less'])
        
        # Build result
        result = {}
        for b_type in relevant_types:
            xml = self.get_block_xml(b_type)
            if xml:
                result[b_type] = xml
                
        return result
    
    def get_block_summary(self) -> str:
        """Get a compact summary of available blocks for the router."""
        categories = {}
        for b_type, cat in self.block_categories.items():
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(b_type)
        
        lines = []
        for cat, blocks in sorted(categories.items()):
            lines.append(f"{cat.upper()}: {', '.join(sorted(blocks))}")
        return "\n".join(lines)
    
    def build_full_system_prompt(self) -> str:
        """Build the complete system prompt with ALL block definitions (Legacy Mode)."""
        
        # 1. Build Rules Section
        rules_text = ""
        if self.rules:
            rules_text = "CRITICAL RULES:\n"
            for i, rule in enumerate(self.rules, 1):
                rules_text += f"{i}. {rule}\n"
        else:
            # Fallback if no rules loaded
            rules_text = "CRITICAL RULES:\n1. You MUST ONLY use blocks listed below\n2. Follow exact XML structure"

        # 2. Build Examples/Templates Section
        examples_text = "EXAMPLES:\n\n"
        for i, temp in enumerate(self.templates, 1):
            examples_text += f"Example {i} - {temp['name']}:\n"
            examples_text += f"Description: {temp['description']}\n"
            examples_text += "Output:\n"
            examples_text += f"{temp['xml']}\n\n"

        # 3. Build Catalog Section
        catalog_text = f"=== COMPLETE BLOCK CATALOG ({len(self.blocks)} blocks) ===\n\n"
        
        # Group blocks by category
        categories = {}
        for b_type, cat in self.block_categories.items():
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(b_type)
        
        category_names = {
            'control': 'CONTROL BLOCKS',
            'environment': 'ENVIRONMENT BLOCKS', 
            'operator': 'OPERATOR BLOCKS',
            'indicator': 'TECHNICAL INDICATOR BLOCKS',
            'trade': 'TRADE BLOCKS',
            'other': 'OTHER BLOCKS'
        }
        
        for cat in ['control', 'environment', 'operator', 'indicator', 'trade', 'other']:
            if cat in categories:
                catalog_text += f"\n--- {category_names.get(cat, cat.upper())} ---\n\n"
                for b_type in sorted(categories[cat]):
                    xml = self.blocks.get(b_type, '')
                    # Clean XML for prompt (remove id attributes, comments)
                    xml = re.sub(r' id="[^"]*"', '', xml)
                    xml = re.sub(r'<!--[^>]*-->', '', xml)
                    catalog_text += f"- {b_type}: {xml}\n\n"

        # Combine everything
        prompt = f"""You are a trading strategy expert that creates Blockly XML code for visual programming.

{rules_text}

{catalog_text}

{examples_text}

=== OUTPUT FORMAT ===

IMPORTANT: Return ONLY the XML wrapped in <xml></xml> tags. NO explanations.
The first block MUST have x="50" y="50" positioning.
Use control_forever as the main loop wrapper.
"""
        
        return prompt


# Singleton instance
block_library = BlockLibrary()
