"""
Flow Validator

Validates Strategy Flow configurations for correctness and trading logic.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple
import hashlib
import json


# (error_class, node_id, param_path) — captured for failure signature hashing.
# Mirrors n8n's failureSignature pattern (workflow-loop-controller.ts:364):
# same logical failure on the same node and param produces the same hash,
# letting an AI builder detect "I already tried fixing this same thing."
StructuredError = Tuple[str, str, str]


@dataclass
class ValidationResult:
    """Result of flow validation."""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    # Deterministic hash of all structured errors. Stable across runs;
    # identical for identical failures. Empty string when there are no errors.
    failure_signature: str = ""
    structured_errors: List[StructuredError] = field(default_factory=list)


def compute_failure_signature(structured: List[StructuredError]) -> str:
    """Stable 16-char hash of sorted (error_class, node_id, param_path) tuples."""
    if not structured:
        return ""
    payload = "|".join(f"{cls}:{nid}:{path}" for cls, nid, path in sorted(structured))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


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
    # Strategy Context start node: emits a signal (trigger) and a context bundle.
    # Structurally exempt — no inputs required, undeletable, always id="start".
    "start": "signal",
    "trigger": "signal",
    # n8n-style pattern nodes added in Phase 2.
    "switch": "signal",
    "merge": "any",
    "splitInBatches": "any",
    "wait": "signal",
    "httpRequest": "any",
    "subStrategy": "any",
}

# Node type to expected input types — the COARSE fallback used when the
# target handle isn't recognised. Action/risk/math etc. legitimately accept
# numbers on size/price handles, so this set is the union of everything the
# node can plausibly receive. The fine-grained check below uses the catalog's
# per-handle dataType to reject e.g. `number → action.trigger`.
NODE_INPUT_TYPES = {
    "indicator": {"number", "candles", "any"},
    "condition": {"number", "boolean"},
    "action": {"boolean", "signal", "number"},
    "control": {"boolean", "signal", "number"},
    "math": {"number"},
    "risk": {"number", "signal"},
    "tradeInfo": {"signal", "number", "any"},
    "variable": {"any"},
    # start has no inputs (it IS the entry point); listing here for symmetry.
    "start": set(),
    "trigger": {"any"},
    "switch": {"any"},
    "merge": {"any"},
    "splitInBatches": {"any"},
    "wait": {"signal", "boolean", "any"},
    "httpRequest": {"any"},
    "subStrategy": {"any"},
}

# Per-(nodeType, handleId) override map. When a handle is in this map, we use
# THIS dataType instead of the coarse node-type set above. Lets us flag
# "number → action.trigger" while letting "number → action.size" through.
HANDLE_INPUT_TYPES: Dict[Tuple[str, str], Set[str]] = {
    # actions
    ("action", "trigger"): {"signal", "boolean"},
    ("action", "size"): {"number"},
    ("action", "limitPrice"): {"number"},
    ("action", "stopPrice"): {"number"},
    ("action", "takeProfitPrice"): {"number"},
    # indicator
    ("indicator", "trigger"): {"signal", "boolean"},
    ("indicator", "data"): {"candles", "ohlcv", "any"},
    # risk / tradeInfo
    ("risk", "trigger"): {"signal", "boolean"},
    ("tradeInfo", "trigger"): {"signal", "boolean"},
    # condition (input-a / input-b)
    ("condition", "input-a"): {"number", "boolean"},
    ("condition", "input-b"): {"number", "boolean"},
}

# Node types that satisfy the "data source" requirement: indicators, environment
# readings, or an explicit Strategy Context Start/Trigger node. Mirrors n8n's
# MISSING_TRIGGER informational pattern — having any of these makes a strategy
# structurally executable.
DATA_SOURCE_TYPES = {"indicator", "environment", "start", "trigger"}

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
    structured: List[StructuredError] = []

    def fail(msg: str, error_class: str, node_id: str = "", param_path: str = "") -> None:
        errors.append(msg)
        structured.append((error_class, node_id, param_path))

    if not nodes:
        fail("Strategy has no nodes.", "no_nodes")
        return ValidationResult(
            is_valid=False,
            errors=errors,
            warnings=warnings,
            failure_signature=compute_failure_signature(structured),
            structured_errors=structured,
        )

    # Build node map for quick lookup
    node_map = {node["id"]: node for node in nodes}

    # Check 1: Required node types
    node_types = {node.get("type") for node in nodes}
    has_data_source = bool(node_types & DATA_SOURCE_TYPES)
    has_action = "action" in node_types
    has_condition = bool(node_types & {"condition", "control"})

    if not has_data_source:
        fail(
            "Strategy must include at least one indicator, environment, or start/trigger node.",
            "missing_data_source",
        )

    if not has_action:
        fail("Strategy must include at least one action node.", "missing_action")

    if not has_condition and len(nodes) > 1:
        warnings.append("No condition nodes found. Strategy may always execute actions.")

    # Check 2: Connection type compatibility
    for edge in edges:
        source_node = node_map.get(edge.get("source"))
        target_node = node_map.get(edge.get("target"))

        if not source_node or not target_node:
            fail(
                f"Edge {edge.get('id')} references missing nodes.",
                "dangling_edge",
                node_id=str(edge.get("id", "")),
            )
            continue

        source_type = source_node.get("type", "unknown")
        target_type = target_node.get("type", "unknown")

        # Get output type from source
        source_output_type = get_output_type(source_node, edge.get("sourceHandle"))

        # Prefer the per-handle dataType when we know it — that's how we
        # distinguish e.g. action.trigger (must be signal) from action.size
        # (must be number). Fall back to the coarse node-type set.
        target_handle = edge.get("targetHandle") or ""
        target_input_types = HANDLE_INPUT_TYPES.get(
            (target_type, target_handle),
            NODE_INPUT_TYPES.get(target_type, {"any"}),
        )

        # Empty input set means this target accepts no inputs (e.g. start nodes).
        if not target_input_types:
            fail(
                f"Node '{target_node.get('data', {}).get('label', target_node['id'])}' "
                f"is a {target_type} node and cannot receive inputs.",
                "input_into_source_node",
                node_id=target_node["id"],
            )
            continue

        if not is_type_compatible(source_output_type, target_input_types):
            fail(
                f"Type mismatch: {source_node.get('data', {}).get('label', source_node['id'])} "
                f"({source_output_type}) cannot connect to "
                f"{target_node.get('data', {}).get('label', target_node['id'])} "
                f"(expects {target_input_types})",
                "type_mismatch",
                node_id=target_node["id"],
                param_path=edge.get("targetHandle") or "input",
            )
    
    # Check 3: Required inputs
    incoming_edges = build_incoming_edges_map(edges)

    # Structural rule: at most one Start node, fixed id "start".
    start_nodes = [n for n in nodes if n.get("type") == "start"]
    if len(start_nodes) > 1:
        for sn in start_nodes[1:]:
            fail(
                f"Multiple start nodes detected ('{sn['id']}'). A strategy may have only one.",
                "multiple_starts",
                node_id=sn["id"],
            )
    for sn in start_nodes:
        if sn["id"] != "start":
            warnings.append(
                f"Start node id is '{sn['id']}' (expected 'start'). "
                "Renamed automatically on save."
            )

    # Build outgoing-edge map alongside the incoming one — needed for the
    # trigger / orphan checks below.
    outgoing_edges: Dict[str, List[Dict[str, Any]]] = {}
    for edge in edges:
        src = edge.get("source")
        if src:
            outgoing_edges.setdefault(src, []).append(edge)

    # Trigger-source subtypes whose `output` handle must connect to
    # SOMETHING for the strategy to actually fire downstream. The full
    # list mirrors `triggerNodes.ts` in the frontend catalog.
    _TRIGGER_SUBTYPES = {
        "startTrigger", "heartbeatTrigger", "cronTrigger", "webhookTrigger",
        "manualTrigger", "priceAlertTrigger", "newsTrigger",
        "brokerEventTrigger", "conditionTrigger",
    }
    # The exported reactflow JSON puts the schema-level type in
    # `data.triggerType`, while `node.type` is the React component class
    # (`trigger`). We need both to identify triggers correctly.
    def _trigger_subtype(node: Dict[str, Any]) -> Optional[str]:
        data = node.get("data") or {}
        sub = data.get("triggerType") or node.get("type")
        return sub if sub in _TRIGGER_SUBTYPES else None

    for node in nodes:
        node_type = node.get("type")
        node_id = node["id"]
        node_data = node.get("data", {})

        # Trigger source nodes MUST have outgoing edges when other nodes
        # exist — otherwise the strategy can never fire. Promoted from
        # silent pass to a hard error so the AI's `validate` tool sees it.
        sub = _trigger_subtype(node)
        if sub and len(nodes) > 1 and node_id not in outgoing_edges:
            fail(
                f"Trigger '{node_data.get('label', node_id)}' ({sub}) has no "
                f"outgoing edges. Nothing downstream will fire.",
                "trigger_no_outgoing",
                node_id=node_id,
            )

        # Action nodes MUST have their `trigger` input wired — otherwise
        # they never fire. Was a silent warning; now an error.
        if node_type == "action":
            wired_targets = {
                e.get("targetHandle") for e in incoming_edges.get(node_id, [])
            }
            if "trigger" not in wired_targets:
                fail(
                    f"Action '{node_data.get('label', node_id)}' has no `trigger` input "
                    "wired. It will never fire.",
                    "action_no_trigger",
                    node_id=node_id,
                    param_path="trigger",
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

        # Orphan check — no incoming AND no outgoing edges. Allowed for
        # Start trigger (it's the seed) and not for anything else.
        if (
            node_id not in incoming_edges
            and node_id not in outgoing_edges
            and len(nodes) > 1
            and sub != "startTrigger"
        ):
            warnings.append(
                f"Node '{node_data.get('label', node_id)}' ({node_type}) is orphaned "
                "— no edges in or out. Wire it or remove it."
            )

    # Check 4: Cycle detection
    allow_cycles = (settings or {}).get("allowCycles", False)
    has_cycle, cycle_nodes = detect_cycles(nodes, edges)

    if has_cycle and not allow_cycles:
        fail(
            f"Cycle detected in strategy graph: {' -> '.join(cycle_nodes)}. "
            "Enable 'allowCycles' in settings to permit loops.",
            "cycle",
            node_id=cycle_nodes[0] if cycle_nodes else "",
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
        warnings=warnings,
        failure_signature=compute_failure_signature(structured),
        structured_errors=structured,
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
