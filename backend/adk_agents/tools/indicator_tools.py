"""
Custom Indicator Tools — CRUD for user-defined technical indicators.

These tools let the trading agent create, update, and manage
custom indicator definitions that can be used in strategies.
"""

from google.adk.tools import FunctionTool

# In-memory store (replace with DB in production)
_indicators: dict[str, dict] = {}


def create_custom_indicator(
    name: str,
    formula: str,
    description: str = "",
    params: dict | None = None,
) -> dict:
    """Create a new custom technical indicator.

    Args:
        name: Unique name for the indicator (e.g. 'my_rsi_divergence').
        formula: Python expression or formula string.
        description: Human-readable description of what the indicator measures.
        params: Default parameters dict (e.g. {"period": 14}).

    Returns:
        The created indicator record.
    """
    if name in _indicators:
        return {"error": f"Indicator '{name}' already exists. Use update to modify it."}
    _indicators[name] = {
        "name": name,
        "formula": formula,
        "description": description,
        "params": params or {},
    }
    return {"success": True, "indicator": _indicators[name]}


def update_custom_indicator(
    name: str,
    formula: str | None = None,
    description: str | None = None,
    params: dict | None = None,
) -> dict:
    """Update an existing custom indicator.

    Args:
        name: Name of the indicator to update.
        formula: New formula (optional).
        description: New description (optional).
        params: New default params (optional).

    Returns:
        The updated indicator record.
    """
    if name not in _indicators:
        return {"error": f"Indicator '{name}' not found."}
    if formula is not None:
        _indicators[name]["formula"] = formula
    if description is not None:
        _indicators[name]["description"] = description
    if params is not None:
        _indicators[name]["params"] = params
    return {"success": True, "indicator": _indicators[name]}


def delete_custom_indicator(name: str) -> dict:
    """Delete a custom indicator by name.

    Args:
        name: Name of the indicator to delete.

    Returns:
        Confirmation message.
    """
    if name not in _indicators:
        return {"error": f"Indicator '{name}' not found."}
    del _indicators[name]
    return {"success": True, "message": f"Indicator '{name}' deleted."}


def list_custom_indicators() -> dict:
    """List all custom indicators.

    Returns:
        Dict with list of all indicator names and definitions.
    """
    return {
        "indicators": list(_indicators.values()),
        "count": len(_indicators),
    }


def get_custom_indicator(name: str) -> dict:
    """Get details of a specific custom indicator.

    Args:
        name: Name of the indicator.

    Returns:
        The indicator record or error.
    """
    if name not in _indicators:
        return {"error": f"Indicator '{name}' not found."}
    return {"indicator": _indicators[name]}
