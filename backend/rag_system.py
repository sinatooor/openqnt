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
                    else:
                        self.block_categories[block_type] = 'other'
                    
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


# Singleton instance
block_library = BlockLibrary()
