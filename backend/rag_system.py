import xml.etree.ElementTree as ET
import re
from typing import List, Dict, Optional

import os

class BlockLibrary:
    def __init__(self, catalog_path: str = "BLOCK_CATALOG.xml"):
        # Check if file exists, if not try parent directory
        if not os.path.exists(catalog_path):
            parent_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), catalog_path)
            if os.path.exists(parent_path):
                catalog_path = parent_path
            else:
                # Try one level up from CWD
                parent_cwd = os.path.join("..", catalog_path)
                if os.path.exists(parent_cwd):
                    catalog_path = parent_cwd
                    
        self.catalog_path = catalog_path
        self.blocks: Dict[str, str] = {}
        self.block_descriptions: Dict[str, str] = {}
        self.load_catalog()

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
                    
                    # Store a simple description (can be enhanced)
                    self.block_descriptions[block_type] = f"Block type: {block_type}"
                    
        except Exception as e:
            print(f"Error loading block catalog: {e}")

    def get_block_xml(self, block_type: str) -> Optional[str]:
        """Get the XML template for a specific block type."""
        return self.blocks.get(block_type)

    def get_all_block_types(self) -> List[str]:
        """Get list of all available block types."""
        return list(self.blocks.keys())

    def retrieve_relevant_blocks(self, query: str, llm_client=None) -> List[str]:
        """
        Retrieve relevant block definitions based on user query.
        
        Args:
            query: User's natural language request
            llm_client: Optional LLM client for semantic retrieval (future)
            
        Returns:
            List of XML strings for the relevant blocks
        """
        # Always include core blocks
        core_blocks = [
            'control_forever', 'control_if', 'control_if_else', 
            'trade_order', 'trade_stop_loss', 'trade_take_profit', 'trade_entry_price',
            'environment_new_candle_open', 'math_number'
        ]
        
        # Keyword-based retrieval (simple baseline)
        relevant_types = set(core_blocks)
        query_lower = query.lower()
        
        # Map keywords to block types
        keyword_map = {
            'rsi': ['ta_rsi', 'operator_less', 'operator_greater'],
            'sma': ['ta_sma', 'operator_greater', 'operator_less'],
            'ema': ['ta_ema', 'operator_greater', 'operator_less'],
            'macd': ['macd_value', 'operator_greater', 'operator_less'],
            'atr': ['ta_atr'],
            'bollinger': ['ta_bb'],
            'cross': ['operator_greater', 'operator_less', 'operator_and'],
            'above': ['operator_greater'],
            'below': ['operator_less'],
            'and': ['operator_and'],
            'or': ['operator_or']
        }
        
        for keyword, types in keyword_map.items():
            if keyword in query_lower:
                relevant_types.update(types)
                
        # If no specific indicators found, add common ones
        if len(relevant_types) == len(core_blocks):
            relevant_types.update(['ta_sma', 'ta_rsi', 'operator_greater', 'operator_less'])
            
        # Retrieve XML for identified types
        retrieved_xml = []
        for b_type in relevant_types:
            xml = self.get_block_xml(b_type)
            if xml:
                retrieved_xml.append(xml)
                
        return retrieved_xml

# Singleton instance
block_library = BlockLibrary()
