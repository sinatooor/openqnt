"""
Indicator Tools for ADK Trading Agent

Create, save, and manage custom technical indicators.
"""

import json
from pathlib import Path
from typing import Optional
from datetime import datetime


CUSTOM_BLOCKS_PATH = Path(__file__).parent.parent / "custom_blocks/saved_blocks.json"


def _load_blocks() -> list[dict]:
    """Load custom blocks from file."""
    if not CUSTOM_BLOCKS_PATH.exists():
        return []
    try:
        return json.loads(CUSTOM_BLOCKS_PATH.read_text())
    except json.JSONDecodeError:
        return []


def _save_blocks(blocks: list[dict]) -> None:
    """Save blocks to file."""
    CUSTOM_BLOCKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CUSTOM_BLOCKS_PATH.write_text(json.dumps(blocks, indent=2))


def create_custom_indicator(
    name: str,
    description: str,
    formula: str,
    parameters: dict,
    category: str = "Custom"
) -> dict:
    """
    Create and save a new custom technical indicator block.
    
    The indicator will be saved and available in the block library
    under the "Custom" category.
    
    Args:
        name: Unique indicator name (e.g., "sentiment_score", "volatility_ratio")
              Use snake_case, no spaces
        description: Human-readable description of what this indicator measures
        formula: Python code for calculating the indicator value.
                 Available variables: close, open, high, low, volume, data
                 Must assign result to 'value' variable.
                 Example: "value = (close - open) / open * 100"
        parameters: Dict of parameter names to default values.
                   Example: {"period": 14, "threshold": 0.5}
        category: Block category (default: "Custom")
        
    Returns:
        dict: Status and created block info
        
    Example:
        >>> create_custom_indicator(
        ...     name="momentum_score",
        ...     description="Rate of change momentum indicator",
        ...     formula="value = (close[-1] - close[-period]) / close[-period] * 100",
        ...     parameters={"period": 10}
        ... )
        {"status": "success", "block": {...}}
    """
    # Validate name
    if not name or not name.replace("_", "").isalnum():
        return {
            "status": "error",
            "error_message": "Name must be alphanumeric with underscores only"
        }
    
    # Load existing blocks
    blocks = _load_blocks()
    
    # Check for duplicate
    if any(b["name"] == name for b in blocks):
        return {
            "status": "error",
            "error_message": f"Indicator '{name}' already exists. Use update_custom_indicator to modify."
        }
    
    # Create block
    block = {
        "id": f"custom_{name}",
        "name": name,
        "display_name": name.replace("_", " ").title(),
        "description": description,
        "formula": formula,
        "parameters": parameters,
        "category": category,
        "type": "custom_indicator",
        "created_at": datetime.now().isoformat(),
        "version": 1
    }
    
    # Generate Blockly XML representation
    block["blockly_xml"] = _generate_blockly_xml(block)
    
    # Save
    blocks.append(block)
    _save_blocks(blocks)
    
    return {
        "status": "success",
        "message": f"Created custom indicator '{name}'",
        "block": block
    }


def _generate_blockly_xml(block: dict) -> str:
    """Generate Blockly XML for a custom indicator block."""
    params_xml = ""
    for param_name, default_value in block.get("parameters", {}).items():
        params_xml += f'''
        <value name="{param_name.upper()}">
            <shadow type="math_number">
                <field name="NUM">{default_value}</field>
            </shadow>
        </value>'''
    
    return f'''<block type="custom_indicator_{block['name']}">
    <field name="NAME">{block['display_name']}</field>{params_xml}
</block>'''


def update_custom_indicator(
    name: str,
    description: Optional[str] = None,
    formula: Optional[str] = None,
    parameters: Optional[dict] = None
) -> dict:
    """
    Update an existing custom indicator.
    
    Args:
        name: Name of the indicator to update
        description: New description (optional)
        formula: New formula (optional)
        parameters: New parameters dict (optional)
        
    Returns:
        dict: Status and updated block info
    """
    blocks = _load_blocks()
    
    # Find block
    block_idx = None
    for i, b in enumerate(blocks):
        if b["name"] == name:
            block_idx = i
            break
    
    if block_idx is None:
        return {
            "status": "error",
            "error_message": f"Indicator '{name}' not found"
        }
    
    # Update fields
    if description:
        blocks[block_idx]["description"] = description
    if formula:
        blocks[block_idx]["formula"] = formula
    if parameters:
        blocks[block_idx]["parameters"] = parameters
    
    blocks[block_idx]["updated_at"] = datetime.now().isoformat()
    blocks[block_idx]["version"] = blocks[block_idx].get("version", 1) + 1
    blocks[block_idx]["blockly_xml"] = _generate_blockly_xml(blocks[block_idx])
    
    _save_blocks(blocks)
    
    return {
        "status": "success",
        "message": f"Updated indicator '{name}'",
        "block": blocks[block_idx]
    }


def delete_custom_indicator(name: str) -> dict:
    """
    Delete a custom indicator.
    
    Args:
        name: Name of the indicator to delete
        
    Returns:
        dict: Status message
    """
    blocks = _load_blocks()
    new_blocks = [b for b in blocks if b["name"] != name]
    
    if len(new_blocks) == len(blocks):
        return {
            "status": "error",
            "error_message": f"Indicator '{name}' not found"
        }
    
    _save_blocks(new_blocks)
    
    return {
        "status": "success",
        "message": f"Deleted indicator '{name}'"
    }


def list_custom_indicators() -> dict:
    """
    List all saved custom indicators.
    
    Returns:
        dict: Status and list of all custom indicator blocks
        
    Example:
        >>> list_custom_indicators()
        {"status": "success", "count": 3, "blocks": [...]}
    """
    blocks = _load_blocks()
    indicators = [b for b in blocks if b.get("type") == "custom_indicator"]
    
    return {
        "status": "success",
        "count": len(indicators),
        "blocks": indicators
    }


def get_custom_indicator(name: str) -> dict:
    """
    Get details of a specific custom indicator.
    
    Args:
        name: Indicator name
        
    Returns:
        dict: Status and block details
    """
    blocks = _load_blocks()
    
    for block in blocks:
        if block["name"] == name:
            return {
                "status": "success",
                "block": block
            }
    
    return {
        "status": "error",
        "error_message": f"Indicator '{name}' not found"
    }
