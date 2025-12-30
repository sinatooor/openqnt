"""
Custom Block Tools for ADK Trading Agent

Create, save, and manage custom Blockly blocks dynamically.
These blocks can be used in trading strategies after creation.

Safety Features:
- All custom blocks are prefixed with 'custom_'
- Core blocks are blacklisted and cannot be overridden
- Formula validation prevents dangerous code injection
- Maximum 50 custom blocks limit
"""

import json
import re
from pathlib import Path
from typing import Optional, Literal
from datetime import datetime


CUSTOM_BLOCKS_PATH = Path(__file__).parent.parent / "custom_blocks/saved_blocks.json"

# Core block types that CANNOT be overridden
BLACKLISTED_BLOCK_NAMES = [
    # Environment
    "environment_price", "environment_spread", "environment_time",
    "environment_day_of_week", "environment_is_market_open",
    # Control
    "control_if", "control_if_else", "control_repeat", "control_forever",
    "control_wait", "control_stop",
    # Operators
    "operator_equals", "operator_greater", "operator_less", "operator_and",
    "operator_or", "operator_not", "operator_add", "operator_subtract",
    "operator_multiply", "operator_divide",
    # Trade
    "trade_order", "trade_close", "trade_close_all", "trade_stop_loss",
    "trade_take_profit", "trade_pnl_of", "trade_entry_price",
    # TA Tools
    "ta_sma", "ta_ema", "ta_rsi", "ta_macd", "ta_bb", "ta_atr",
    "ta_stochastic", "ta_ichimoku", "ta_adx", "ta_sar", "ta_obv",
]

# Dangerous patterns that cannot appear in formulas
FORBIDDEN_PATTERNS = [
    r'\bimport\b',
    r'\bexec\b',
    r'\beval\b',
    r'\bopen\b',
    r'\bcompile\b',
    r'\b__\w+__\b',  # Dunder methods
    r'\bos\.',
    r'\bsys\.',
    r'\bsubprocess\b',
    r'\bglobals\b',
    r'\blocals\b',
    r'\bgetattr\b',
    r'\bsetattr\b',
    r'\bdelattr\b',
]

MAX_CUSTOM_BLOCKS = 50


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


def _validate_formula(formula: str) -> tuple[bool, str]:
    """
    Validate that a formula doesn't contain dangerous code.
    Returns (is_valid, error_message).
    """
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, formula, re.IGNORECASE):
            return False, f"Formula contains forbidden pattern: {pattern}"
    return True, ""


def _validate_block_name(name: str) -> tuple[bool, str]:
    """
    Validate block name.
    Returns (is_valid, error_message).
    """
    # Must be alphanumeric with underscores
    if not name or not re.match(r'^[a-z][a-z0-9_]*$', name):
        return False, "Name must start with lowercase letter and contain only lowercase letters, numbers, and underscores"
    
    # Must not be a blacklisted name
    if name in BLACKLISTED_BLOCK_NAMES or f"custom_{name}" in BLACKLISTED_BLOCK_NAMES:
        return False, f"Cannot override core block: {name}"
    
    return True, ""


def create_custom_block(
    name: str,
    display_name: str,
    description: str,
    block_type: Literal["value", "condition", "action"] = "value",
    inputs_json: Optional[str] = None,
    output_type: Optional[str] = "Number",
    python_code: str = "",
    color: str = "#ef4444",
    category: str = "Custom"
) -> dict:
    """
    Create and save a new custom Blockly block.
    
    The block will be available in the "My Blocks" category after creation.
    Users can drag it into their workspace just like any other block.
    
    IMPORTANT: You can ONLY create NEW blocks. You CANNOT modify existing 
    core blocks like trade_order, ta_rsi, control_if, etc.
    
    Args:
        name: Unique block name in snake_case (e.g., "momentum_5day")
              Will be automatically prefixed with "custom_"
        display_name: Human-readable name shown in UI (e.g., "5-Day Momentum")
        description: What this block does
        block_type: Type of block:
            - "value": Outputs a number (e.g., indicator value)
            - "condition": Outputs true/false (e.g., RSI > 70)
            - "action": Performs an action (e.g., send alert)
        inputs: List of input definitions. Each input is a dict with:
            - name: Input name (e.g., "PERIOD")
            - type: "number", "boolean", or "any"
            - default: Default value
        output_type: What the block outputs:
            - "Number" for numeric values
            - "Boolean" for true/false
            - "TAValue" for indicator values
            - None for action blocks
        python_code: Python expression for backtest execution.
            Available variables: close, open, high, low, volume, data
            For value blocks: must produce a number
            For condition blocks: must produce True/False
            Example: "(close[-1] - close[-5]) / close[-5] * 100"
        color: Block color as hex string (default: red #ef4444)
        category: Category name (default: "Custom")
        
    Returns:
        dict: Status and created block info
        
    Example:
        >>> create_custom_block(
        ...     name="daily_momentum",
        ...     display_name="Daily Momentum",
        ...     description="Calculates percentage change from yesterday",
        ...     block_type="value",
        ...     output_type="Number",
        ...     python_code="(close[-1] - close[-2]) / close[-2] * 100"
        ... )
        {"status": "success", "block": {...}}
    """
    # Validate name
    is_valid, error = _validate_block_name(name)
    if not is_valid:
        return {"status": "error", "error_message": error}
    
    # Validate formula
    is_valid, error = _validate_formula(python_code)
    if not is_valid:
        return {"status": "error", "error_message": error}
    
    # Load existing blocks
    blocks = _load_blocks()
    
    # Check limit
    if len(blocks) >= MAX_CUSTOM_BLOCKS:
        return {
            "status": "error",
            "error_message": f"Maximum of {MAX_CUSTOM_BLOCKS} custom blocks reached. Delete some blocks first."
        }
    
    # Ensure name is prefixed
    block_id = f"custom_{name}" if not name.startswith("custom_") else name
    
    # Check for duplicate
    if any(b["id"] == block_id for b in blocks):
        return {
            "status": "error",
            "error_message": f"Block '{block_id}' already exists. Use a different name or delete the existing block."
        }
    
    # Normalize inputs - parse JSON string if provided
    inputs = []
    if inputs_json:
        try:
            inputs = json.loads(inputs_json)
        except json.JSONDecodeError:
            inputs = []
    
    # Create block definition
    block = {
        "id": block_id,
        "name": name,
        "display_name": display_name,
        "description": description,
        "block_type": block_type,
        "inputs": inputs,
        "output_type": output_type if block_type != "action" else None,
        "python_code": python_code,
        "color": color,
        "category": category,
        "created_at": datetime.now().isoformat(),
        "version": 1
    }
    
    # Generate Blockly definition
    block["blockly_definition"] = _generate_blockly_definition(block)
    
    # Save
    blocks.append(block)
    _save_blocks(blocks)
    
    return {
        "status": "success",
        "message": f"✅ Created custom block '{display_name}'! Refresh the page or click 'My Blocks' category to use it.",
        "block": block
    }


def _generate_blockly_definition(block: dict) -> dict:
    """
    Generate Blockly block definition JSON.
    This is used by the frontend to register the block.
    """
    definition = {
        "type": block["id"],
        "message0": block["display_name"],
        "colour": block["color"],
        "tooltip": block["description"],
        "helpUrl": "",
    }
    
    # Add inputs
    args = []
    message_parts = [block["display_name"]]
    
    for i, inp in enumerate(block.get("inputs", [])):
        input_name = inp.get("name", f"INPUT{i}")
        message_parts.append(f"%{i + 1}")
        
        if inp.get("type") == "number":
            args.append({
                "type": "input_value",
                "name": input_name,
                "check": "Number"
            })
        elif inp.get("type") == "boolean":
            args.append({
                "type": "input_value",
                "name": input_name,
                "check": "Boolean"
            })
        else:
            args.append({
                "type": "input_value",
                "name": input_name
            })
    
    if args:
        definition["message0"] = " ".join(message_parts)
        definition["args0"] = args
    
    # Set output/connection type
    if block["block_type"] == "value":
        definition["output"] = block.get("output_type", "Number")
    elif block["block_type"] == "condition":
        definition["output"] = "Boolean"
    elif block["block_type"] == "action":
        definition["previousStatement"] = None
        definition["nextStatement"] = None
    
    return definition


def list_custom_blocks() -> dict:
    """
    List all saved custom blocks.
    
    Returns:
        dict: Status and list of all custom blocks with their details
        
    Example:
        >>> list_custom_blocks()
        {"status": "success", "count": 3, "blocks": [...]}
    """
    blocks = _load_blocks()
    
    # Format for display
    block_summaries = []
    for b in blocks:
        block_summaries.append({
            "id": b["id"],
            "display_name": b["display_name"],
            "description": b["description"],
            "block_type": b.get("block_type", "value"),
            "created_at": b.get("created_at", "Unknown")
        })
    
    return {
        "status": "success",
        "count": len(blocks),
        "blocks": block_summaries,
        "limit": MAX_CUSTOM_BLOCKS,
        "remaining": MAX_CUSTOM_BLOCKS - len(blocks)
    }


def get_custom_block(name: str) -> dict:
    """
    Get details of a specific custom block.
    
    Args:
        name: Block name (with or without 'custom_' prefix)
        
    Returns:
        dict: Status and block details including the Python code
    """
    blocks = _load_blocks()
    
    # Handle both prefixed and non-prefixed names
    search_id = f"custom_{name}" if not name.startswith("custom_") else name
    
    for block in blocks:
        if block["id"] == search_id or block["name"] == name:
            return {
                "status": "success",
                "block": block
            }
    
    return {
        "status": "error",
        "error_message": f"Block '{name}' not found"
    }


def delete_custom_block(name: str) -> dict:
    """
    Delete a custom block.
    
    Args:
        name: Block name (with or without 'custom_' prefix)
        
    Returns:
        dict: Status message
        
    Note:
        This only deletes the block definition. Any strategies using this
        block will show an error until the block is recreated or removed.
    """
    blocks = _load_blocks()
    
    # Handle both prefixed and non-prefixed names
    search_id = f"custom_{name}" if not name.startswith("custom_") else name
    
    new_blocks = [b for b in blocks if b["id"] != search_id and b["name"] != name]
    
    if len(new_blocks) == len(blocks):
        return {
            "status": "error",
            "error_message": f"Block '{name}' not found"
        }
    
    _save_blocks(new_blocks)
    
    return {
        "status": "success",
        "message": f"Deleted block '{name}'"
    }
