"""
Custom Block Tools — CRUD for user-defined strategy building blocks.

These tools let the trading agent create and manage reusable
strategy blocks that can be composed in the visual strategy builder.
"""

from google.adk.tools import FunctionTool

# In-memory store (replace with DB in production)
_blocks: dict[str, dict] = {}


def create_custom_block(
    name: str,
    block_type: str,
    definition: dict,
    description: str = "",
) -> dict:
    """Create a new custom strategy block.

    Args:
        name: Unique name for the block.
        block_type: Category (e.g. 'indicator', 'condition', 'action').
        definition: Block definition dict with inputs, outputs, and logic.
        description: Human-readable description.

    Returns:
        The created block record.
    """
    if name in _blocks:
        return {"error": f"Block '{name}' already exists."}
    _blocks[name] = {
        "name": name,
        "block_type": block_type,
        "definition": definition,
        "description": description,
    }
    return {"success": True, "block": _blocks[name]}


def list_custom_blocks() -> dict:
    """List all custom blocks.

    Returns:
        Dict with list of all custom block definitions.
    """
    return {
        "blocks": list(_blocks.values()),
        "count": len(_blocks),
    }


def get_custom_block(name: str) -> dict:
    """Get details of a specific custom block.

    Args:
        name: Name of the block.

    Returns:
        The block record or error.
    """
    if name not in _blocks:
        return {"error": f"Block '{name}' not found."}
    return {"block": _blocks[name]}


def delete_custom_block(name: str) -> dict:
    """Delete a custom block by name.

    Args:
        name: Name of the block to delete.

    Returns:
        Confirmation message.
    """
    if name not in _blocks:
        return {"error": f"Block '{name}' not found."}
    del _blocks[name]
    return {"success": True, "message": f"Block '{name}' deleted."}
