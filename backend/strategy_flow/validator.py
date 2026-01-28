"""
Flow Validator

Validates Strategy Flow configurations for correctness and trading logic.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Tuple
import json


@dataclass
class ValidationResult:
    """Result of flow validation."""
    is_valid: bool
    errors: List[str]
    warnings: List[str]


# Data type compatibility matrix
TYPE_COMPATIBILITY = {
    "number": {"number", "any"},
    "boolean": {"boolean", "signal", "any"},
    "signal": {"signal", "boolean", "any"},
    "any": {"number", "boolean", "signal", "any"},
}

# Node type to output data type mapping
NODE_OUTPUT_TYPES = {
    "indicator": "number",
    "environment": "number",
    "math": "number",
    "condition": "boolean",
    "control": "signal",
    "variable": "any",
    "risk": "number",
    "tradeInfo": "number",
    "llm": "any",
}

# Node type to expected input types
NODE_INPUT_TYPES = {
    "indicator": {"number"},
    "condition": {"number", "boolean"},
    "action": {"boolean", "signal"},
    "control": {"boolean", "signal"},
    "math": {"number"},
    "risk": {"number"},
    "variable": {"any"},
}

# Scale categories for compatibility checking
PRICE_SCALE_INDICATORS = {
    "sma", "ema", "dema", "tema", "smma", "lwma",
    "bb", "keltner", "donchian", "envelopes",
    "sar", "supertrend", "ichimoku", "alligator",
    "vwap", "support", "resistance"
}

OSCILLATOR_INDICATORS = {
    "rsi", "stochastic", "cci", "mfi", "williamsR",
    "momentum", "rvi", "demarker", "force",
    "adx", "ao", "ac"
}


def validate_flow(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    settings: Optional[Dict[str, Any]] = None
) -> ValidationResult:
    """
    Validate a flow configuration.
    
    Checks:
    1. Required node types exist
    2. Connection type compatibility
    3. Required inputs are connected
    4. No invalid cycles
    5. Scale compatibility (price vs oscillator)
    6. Parameter validation
    """
    errors: List[str] = []
    warnings: List[str] = []
    
    if not nodes:
        errors.append("Strategy has no nodes.")
        return ValidationResult(False, errors, warnings)
    
    # Build node map for quick lookup
    node_map = {node["id"]: node for node in nodes}
    
    # Check 1: Required node types
    node_types = {node.get("type") for node in nodes}
    has_data_source = bool(node_types & {"indicator", "environment"})
    has_action = "action" in node_types
    has_condition = bool(node_types & {"condition", "control"})
    
    if not has_data_source:
        errors.append("Strategy must include at least one indicator or environment node.")
    
    if not has_action:
        errors.append("Strategy must include at least one action node.")
    
    if not has_condition and len(nodes) > 1:
        warnings.append("No condition nodes found. Strategy may always execute actions.")
    
    # Check 2: Connection type compatibility
    for edge in edges:
        source_node = node_map.get(edge.get("source"))
        target_node = node_map.get(edge.get("target"))
        
        if not source_node or not target_node:
            errors.append(f"Edge {edge.get('id')} references missing nodes.")
            continue
        
        source_type = source_node.get("type", "unknown")
        target_type = target_node.get("type", "unknown")
        
        # Get output type from source
        source_output_type = get_output_type(source_node, edge.get("sourceHandle"))
        
        # Get expected input type from target
        target_input_types = NODE_INPUT_TYPES.get(target_type, {"any"})
        
        # Check compatibility
        if not is_type_compatible(source_output_type, target_input_types):
            errors.append(
                f"Type mismatch: {source_node.get('data', {}).get('label', source_node['id'])} "
                f"({source_output_type}) cannot connect to "
                f"{target_node.get('data', {}).get('label', target_node['id'])} "
                f"(expects {target_input_types})"
            )
    
    # Check 3: Required inputs
    incoming_edges = build_incoming_edges_map(edges)
    
    for node in nodes:
        node_type = node.get("type")
        node_id = node["id"]
        node_data = node.get("data", {})
        
        # Action nodes should have at least one incoming edge
        if node_type == "action":
            if node_id not in incoming_edges:
                warnings.append(
                    f"Action node '{node_data.get('label', node_id)}' has no input connections. "
                    "It will always execute."
                )
        
        # Condition nodes should have inputs
        if node_type == "condition":
            condition_type = node_data.get("conditionType", "")
            required_inputs = get_required_inputs(condition_type)
            actual_inputs = len(incoming_edges.get(node_id, []))
            
            if actual_inputs < required_inputs:
                warnings.append(
                    f"Condition node '{node_data.get('label', node_id)}' needs {required_inputs} "
                    f"input(s) but only has {actual_inputs}."
                )
    
    # Check 4: Cycle detection
    allow_cycles = (settings or {}).get("allowCycles", False)
    has_cycle, cycle_nodes = detect_cycles(nodes, edges)
    
    if has_cycle and not allow_cycles:
        errors.append(
            f"Cycle detected in strategy graph: {' -> '.join(cycle_nodes)}. "
            "Enable 'allowCycles' in settings to permit loops."
        )
    
    # Check 5: Scale compatibility
    scale_issues = check_scale_compatibility(nodes, edges, node_map)
    warnings.extend(scale_issues)
    
    # Check 6: Parameter validation
    param_issues = validate_parameters(nodes)
    warnings.extend(param_issues)
    
    return ValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings
    )


def get_output_type(node: Dict[str, Any], handle: Optional[str]) -> str:
    """Get the output data type for a node."""
    node_type = node.get("type", "unknown")
    node_data = node.get("data", {})
    
    # Special handling for multi-output nodes
    if node_type == "indicator":
        indicator_type = node_data.get("indicatorType", "")
        
        # MACD outputs
        if indicator_type == "macd":
            if handle == "signal":
                return "number"
            if handle == "histogram":
                return "number"
            return "number"  # line
        
        # Bollinger Bands outputs
        if indicator_type == "bb":
            return "number"  # All bands are numbers
        
        # Stochastic outputs
        if indicator_type == "stochastic":
            return "number"  # %K and %D are numbers
    
    return NODE_OUTPUT_TYPES.get(node_type, "any")


def is_type_compatible(source_type: str, target_types: Set[str]) -> bool:
    """Check if source type is compatible with any target type."""
    if "any" in target_types:
        return True
    
    compatible_types = TYPE_COMPATIBILITY.get(source_type, {source_type})
    return bool(compatible_types & target_types)


def build_incoming_edges_map(edges: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Build a map of node ID to incoming edges."""
    incoming: Dict[str, List[Dict[str, Any]]] = {}
    for edge in edges:
        target = edge.get("target")
        if target:
            incoming.setdefault(target, []).append(edge)
    return incoming


def get_required_inputs(condition_type: str) -> int:
    """Get the number of required inputs for a condition type."""
    two_input_conditions = {"crossover", "crossunder", "compare", "and", "or"}
    if condition_type in two_input_conditions:
        return 2
    if condition_type in {"not", "threshold"}:
        return 1
    return 1


def detect_cycles(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]]
) -> Tuple[bool, List[str]]:
    """
    Detect cycles in the graph using DFS.
    Returns (has_cycle, cycle_path).
    """
    # Build adjacency list
    adjacency: Dict[str, List[str]] = {}
    for node in nodes:
        adjacency[node["id"]] = []
    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        if source and target:
            adjacency.setdefault(source, []).append(target)
    
    visited: Set[str] = set()
    rec_stack: Set[str] = set()
    cycle_path: List[str] = []
    
    def dfs(node_id: str, path: List[str]) -> bool:
        visited.add(node_id)
        rec_stack.add(node_id)
        path.append(node_id)
        
        for neighbor in adjacency.get(node_id, []):
            if neighbor not in visited:
                if dfs(neighbor, path):
                    return True
            elif neighbor in rec_stack:
                # Found cycle
                cycle_start = path.index(neighbor)
                cycle_path.extend(path[cycle_start:])
                cycle_path.append(neighbor)
                return True
        
        path.pop()
        rec_stack.remove(node_id)
        return False
    
    for node in nodes:
        if node["id"] not in visited:
            if dfs(node["id"], []):
                return True, cycle_path
    
    return False, []


def check_scale_compatibility(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    node_map: Dict[str, Dict[str, Any]]
) -> List[str]:
    """
    Check for scale compatibility issues.
    
    Warns when comparing price-scale indicators with oscillators directly.
    """
    warnings: List[str] = []
    
    # Find comparison/condition nodes
    condition_nodes = [n for n in nodes if n.get("type") == "condition"]
    
    for cond_node in condition_nodes:
        cond_type = cond_node.get("data", {}).get("conditionType", "")
        if cond_type not in {"compare", "crossover", "crossunder"}:
            continue
        
        # Find inputs to this condition
        inputs = []
        for edge in edges:
            if edge.get("target") == cond_node["id"]:
                source_node = node_map.get(edge.get("source"))
                if source_node:
                    inputs.append(source_node)
        
        if len(inputs) < 2:
            continue
        
        # Check scale compatibility
        scales = []
        for input_node in inputs:
            if input_node.get("type") == "indicator":
                ind_type = input_node.get("data", {}).get("indicatorType", "")
                if ind_type in PRICE_SCALE_INDICATORS:
                    scales.append("price")
                elif ind_type in OSCILLATOR_INDICATORS:
                    scales.append("oscillator")
                else:
                    scales.append("unknown")
            elif input_node.get("type") == "environment":
                scales.append("price")
            else:
                scales.append("unknown")
        
        # Warn if mixing scales
        if "price" in scales and "oscillator" in scales:
            input_labels = [n.get("data", {}).get("label", n["id"]) for n in inputs]
            warnings.append(
                f"Scale mismatch in condition '{cond_node.get('data', {}).get('label', cond_node['id'])}': "
                f"Comparing {input_labels[0]} (price-scale) with {input_labels[1]} (oscillator). "
                "Consider using a threshold condition instead."
            )
    
    return warnings


def validate_parameters(nodes: List[Dict[str, Any]]) -> List[str]:
    """Validate node parameters for reasonable values."""
    warnings: List[str] = []
    
    for node in nodes:
        node_data = node.get("data", {})
        params = node_data.get("params", {})
        label = node_data.get("label", node["id"])
        
        # Check indicator periods
        if node.get("type") == "indicator":
            period = params.get("period")
            if period is not None:
                if period < 1:
                    warnings.append(f"Indicator '{label}' has period < 1. This may cause errors.")
                elif period > 500:
                    warnings.append(f"Indicator '{label}' has very large period ({period}). This may need more data.")
        
        # Check action sizes
        if node.get("type") == "action":
            size = node_data.get("size", 0)
            if size > 100:
                warnings.append(f"Action '{label}' has position size > 100%. This may use leverage.")
            if size <= 0:
                warnings.append(f"Action '{label}' has position size <= 0. No trades will be placed.")
        
        # Check stop loss / take profit
        if node.get("type") == "action":
            stop_loss = node_data.get("stopPrice")
            take_profit = node_data.get("takeProfitPrice")
            
            if stop_loss and take_profit:
                # Warn if stop loss is larger than take profit (bad risk/reward)
                if abs(stop_loss) > abs(take_profit):
                    warnings.append(
                        f"Action '{label}' has stop loss larger than take profit. "
                        "Consider improving risk/reward ratio."
                    )
    
    return warnings


def auto_fix_flow(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[str]]:
    """
    Attempt to auto-fix common issues in a flow configuration.
    
    Returns: (fixed_nodes, fixed_edges, fixes_applied)
    """
    fixes_applied: List[str] = []
    fixed_nodes = [dict(node) for node in nodes]  # Deep copy
    fixed_edges = [dict(edge) for edge in edges]
    
    # Fix 1: Ensure unique node IDs
    seen_ids: Set[str] = set()
    for node in fixed_nodes:
        if node["id"] in seen_ids:
            old_id = node["id"]
            new_id = f"{old_id}_{len(seen_ids)}"
            node["id"] = new_id
            
            # Update edges
            for edge in fixed_edges:
                if edge.get("source") == old_id:
                    edge["source"] = new_id
                if edge.get("target") == old_id:
                    edge["target"] = new_id
            
            fixes_applied.append(f"Renamed duplicate node ID '{old_id}' to '{new_id}'")
        seen_ids.add(node["id"])
    
    # Fix 2: Remove edges to non-existent nodes
    valid_ids = {node["id"] for node in fixed_nodes}
    original_edge_count = len(fixed_edges)
    fixed_edges = [
        edge for edge in fixed_edges
        if edge.get("source") in valid_ids and edge.get("target") in valid_ids
    ]
    if len(fixed_edges) < original_edge_count:
        fixes_applied.append(f"Removed {original_edge_count - len(fixed_edges)} invalid edges")
    
    # Fix 3: Set default values for missing required params
    for node in fixed_nodes:
        node_data = node.get("data", {})
        
        if node.get("type") == "indicator":
            if "params" not in node_data:
                node_data["params"] = {}
            if "period" not in node_data["params"]:
                node_data["params"]["period"] = 14
                fixes_applied.append(f"Set default period=14 for indicator '{node_data.get('label', node['id'])}'")
        
        if node.get("type") == "action":
            if "size" not in node_data or node_data.get("size", 0) <= 0:
                node_data["size"] = 10
                fixes_applied.append(f"Set default size=10% for action '{node_data.get('label', node['id'])}'")
    
    return fixed_nodes, fixed_edges, fixes_applied
