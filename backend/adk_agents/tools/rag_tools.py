"""
RAG Tools for ADK Trading Agent

Leverage the block catalog for intelligent block suggestions.
"""

import sys
from pathlib import Path
from typing import Optional

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Lazy load VectorRAG to avoid import issues
_vector_rag = None
RAG_AVAILABLE = False

def _get_vector_rag():
    """Lazy load VectorRAG singleton."""
    global _vector_rag, RAG_AVAILABLE
    if _vector_rag is None:
        try:
            from vector_rag import get_vector_rag, BLOCK_DESCRIPTIONS as _BD
            _vector_rag = get_vector_rag()
            if not _vector_rag.initialized:
                _vector_rag.initialize()
            RAG_AVAILABLE = True
            print("[RAG-TOOLS] VectorRAG initialized successfully")
        except Exception as e:
            print(f"[RAG-TOOLS] Failed to load VectorRAG: {e}")
            RAG_AVAILABLE = False
    return _vector_rag

# Load block descriptions for fallback
try:
    from vector_rag import BLOCK_DESCRIPTIONS
except ImportError:
    BLOCK_DESCRIPTIONS = {}


def find_similar_blocks(query: str, top_k: int = 5) -> dict:
    """
    Find blocks from the catalog that match a natural language query.
    
    Uses vector similarity search to find the most relevant blocks
    for implementing a trading strategy concept.
    
    Args:
        query: Natural language description of what you want
               (e.g., "detect when price crosses moving average")
        top_k: Number of results to return (default: 5)
        
    Returns:
        dict: Status and list of matching blocks with descriptions
        
    Example:
        >>> find_similar_blocks("RSI overbought signal")
        {"status": "success", "blocks": [{"name": "ta_rsi", "description": "..."}]}
    """
    vector_rag = _get_vector_rag()
    
    if not RAG_AVAILABLE or vector_rag is None:
        # Fallback to simple keyword matching
        return _fallback_search(query, top_k)
    
    try:
        # Use VectorRAG's search_blocks method
        results = vector_rag.search_blocks(
            query=query,
            n_results=top_k,
            use_reranker=True
        )
        
        return {
            "status": "success",
            "query": query,
            "count": len(results),
            "blocks": [
                {
                    "block_type": r.get("block_type"),
                    "description": r.get("metadata", {}).get("raw_description", r.get("description", "")),
                    "category": r.get("metadata", {}).get("category", "Unknown"),
                    "relevance_score": r.get("re_rank_score", 1 - r.get("distance", 0))
                }
                for r in results
            ]
        }
    except Exception as e:
        print(f"[RAG-TOOLS] Search error: {e}")
        return _fallback_search(query, top_k)


def _fallback_search(query: str, top_k: int) -> dict:
    """Simple keyword-based fallback search."""
    query_lower = query.lower()
    matches = []
    
    for block_type, description in BLOCK_DESCRIPTIONS.items():
        score = 0
        block_lower = block_type.lower()
        desc_lower = description.lower()
        
        # Score based on keyword matches
        for word in query_lower.split():
            if word in block_lower:
                score += 3
            if word in desc_lower:
                score += 1
        
        if score > 0:
            matches.append({
                "block_type": block_type,
                "description": description,
                "relevance_score": score
            })
    
    # Sort by score
    matches.sort(key=lambda x: x["relevance_score"], reverse=True)
    
    return {
        "status": "success",
        "query": query,
        "count": min(len(matches), top_k),
        "blocks": matches[:top_k],
        "note": "Using fallback search (vector RAG not available)"
    }


def get_block_info(block_type: str) -> dict:
    """
    Get detailed information about a specific block type.
    
    Args:
        block_type: The block type name (e.g., "ta_rsi", "trade_order")
        
    Returns:
        dict: Block details including description, parameters, and usage
        
    Example:
        >>> get_block_info("ta_rsi")
        {"status": "success", "block": {"type": "ta_rsi", "description": "...", ...}}
    """
    # Try to load from BLOCK_CATALOG.xml
    catalog_path = Path(__file__).parent.parent.parent.parent / "BLOCK_CATALOG.xml"
    
    if catalog_path.exists():
        try:
            import xml.etree.ElementTree as ET
            tree = ET.parse(catalog_path)
            root = tree.getroot()
            
            for block in root.findall(".//block"):
                if block.get("type") == block_type:
                    # Extract fields
                    fields = {}
                    for field in block.findall(".//field"):
                        fields[field.get("name")] = field.text
                    
                    # Extract values (shadow blocks)
                    values = {}
                    for value in block.findall(".//value"):
                        shadow = value.find("shadow")
                        if shadow is not None:
                            field = shadow.find("field")
                            if field is not None:
                                values[value.get("name")] = {
                                    "type": shadow.get("type"),
                                    "default": field.text
                                }
                    
                    return {
                        "status": "success",
                        "block": {
                            "type": block_type,
                            "description": BLOCK_DESCRIPTIONS.get(block_type, "No description available"),
                            "fields": fields,
                            "values": values,
                            "xml": ET.tostring(block, encoding="unicode")
                        }
                    }
        except Exception as e:
            pass
    
    # Fallback to description lookup
    if block_type in BLOCK_DESCRIPTIONS:
        return {
            "status": "success",
            "block": {
                "type": block_type,
                "description": BLOCK_DESCRIPTIONS[block_type]
            }
        }
    
    return {
        "status": "error",
        "error_message": f"Block type '{block_type}' not found"
    }


def list_block_categories() -> dict:
    """
    List all available block categories.
    
    Returns:
        dict: List of categories with block counts
    """
    categories = {}
    
    for block_type in BLOCK_DESCRIPTIONS.keys():
        # Infer category from block type prefix
        if block_type.startswith("ta_"):
            cat = "Technical Analysis"
        elif block_type.startswith("trade_"):
            cat = "Trading"
        elif block_type.startswith("environment_"):
            cat = "Market Data"
        elif block_type.startswith("logic_"):
            cat = "Logic"
        elif block_type.startswith("math_"):
            cat = "Math"
        else:
            cat = "Other"
        
        categories[cat] = categories.get(cat, 0) + 1
    
    return {
        "status": "success",
        "categories": [
            {"name": name, "block_count": count}
            for name, count in sorted(categories.items())
        ]
    }
