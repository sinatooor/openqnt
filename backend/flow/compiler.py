"""Flow strategy compiler and validator."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
import json

from .definitions import get_node_definition


@dataclass
class FlowNode:
    id: str
    type: str
    position: Dict[str, float]
    data: Dict[str, Any]


@dataclass
class FlowEdge:
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None


@dataclass
class ValidationResult:
    is_valid: bool
    errors: List[str]
    warnings: List[str]


@dataclass
class CompilationResult:
    compiled: Dict[str, Any]
    python_code: str
    validation: ValidationResult


def _node_map(nodes: List[FlowNode]) -> Dict[str, FlowNode]:
    return {node.id: node for node in nodes}


def _edge_adjacency(edges: List[FlowEdge]) -> Dict[str, List[str]]:
    adjacency: Dict[str, List[str]] = {}
    for edge in edges:
        adjacency.setdefault(edge.source, []).append(edge.target)
    return adjacency


def _topological_sort(nodes: List[FlowNode], edges: List[FlowEdge]) -> Tuple[List[str], bool]:
    in_degree = {node.id: 0 for node in nodes}
    adjacency = _edge_adjacency(edges)

    for edge in edges:
        in_degree[edge.target] = in_degree.get(edge.target, 0) + 1

    queue = [node_id for node_id, degree in in_degree.items() if degree == 0]
    order: List[str] = []

    while queue:
        node_id = queue.pop(0)
        order.append(node_id)
        for neighbor in adjacency.get(node_id, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    has_cycle = len(order) != len(nodes)
    if has_cycle:
        # Append remaining nodes deterministically
        remaining = [n.id for n in nodes if n.id not in order]
        order.extend(remaining)
    return order, has_cycle


def _resolve_port_type(node: FlowNode, handle: Optional[str], is_output: bool) -> str:
    definition = get_node_definition(node.type, node.data)
    ports = definition.outputs if is_output else definition.inputs
    if not ports:
        return "any"
    if handle:
        for port in ports:
            if port.name == handle:
                return port.data_type
    return ports[0].data_type


def _is_type_compatible(source_type: str, target_type: str) -> bool:
    if source_type == "any" or target_type == "any":
        return True
    if source_type == target_type:
        return True
    if source_type == "signal" and target_type == "boolean":
        return True
    if source_type == "boolean" and target_type == "signal":
        return True
    return False


def validate_flow_strategy(raw_nodes: List[Dict[str, Any]], raw_edges: List[Dict[str, Any]], settings: Optional[Dict[str, Any]] = None) -> ValidationResult:
    nodes = [FlowNode(**node) for node in raw_nodes]
    edges = [FlowEdge(**edge) for edge in raw_edges]
    node_map = _node_map(nodes)
    errors: List[str] = []
    warnings: List[str] = []

    if not nodes:
        errors.append("Strategy has no nodes.")
        return ValidationResult(False, errors, warnings)

    # Required node types
    has_action = any(n.type == "action" for n in nodes)
    has_signal = any(n.type in {"condition", "control"} for n in nodes)
    has_data = any(n.type in {"indicator", "environment"} for n in nodes)
    if not has_action:
        errors.append("Strategy must include at least one action node.")
    if not has_data:
        errors.append("Strategy must include at least one indicator or environment node.")
    if not has_signal and len(nodes) > 1:
        warnings.append("No condition/control nodes found; strategy may always execute.")

    # Type checking and missing inputs
    incoming_by_target: Dict[str, List[FlowEdge]] = {}
    for edge in edges:
        incoming_by_target.setdefault(edge.target, []).append(edge)
        source = node_map.get(edge.source)
        target = node_map.get(edge.target)
        if not source or not target:
            errors.append(f"Edge {edge.id} references missing nodes.")
            continue
        source_type = _resolve_port_type(source, edge.sourceHandle, True)
        target_type = _resolve_port_type(target, edge.targetHandle, False)
        if not _is_type_compatible(source_type, target_type):
            errors.append(
                f"Type mismatch: {source.id}({source_type}) -> {target.id}({target_type})"
            )

    for node in nodes:
        definition = get_node_definition(node.type, node.data)
        required_inputs = [p for p in definition.inputs if p.required]
        for port in required_inputs:
            edges_for_node = incoming_by_target.get(node.id, [])
            has_port = any((e.targetHandle == port.name) or (e.targetHandle is None) for e in edges_for_node)
            if not has_port:
                warnings.append(f"Node {node.id} missing required input: {port.name}")
        if node.type == "llm" and not node.data.get("prompt"):
            warnings.append(f"LLM node {node.id} is missing a prompt.")

    # Cycle detection
    allow_cycles = bool((settings or {}).get("allowCycles", False))
    _, has_cycle = _topological_sort(nodes, edges)
    if has_cycle and not allow_cycles:
        errors.append("Cycle detected in strategy graph. Enable allowCycles to permit loops.")

    return ValidationResult(len(errors) == 0, errors, warnings)


def _build_inputs_map(nodes: List[FlowNode], edges: List[FlowEdge]) -> Dict[str, Dict[str, List[Dict[str, Optional[str]]]]]:
    inputs: Dict[str, Dict[str, List[Dict[str, Optional[str]]]]] = {}
    for node in nodes:
        inputs[node.id] = {}
    for edge in edges:
        inputs.setdefault(edge.target, {})
        handle = edge.targetHandle or "input"
        inputs[edge.target].setdefault(handle, []).append(
            {"nodeId": edge.source, "sourceHandle": edge.sourceHandle}
        )
    return inputs


def _collect_indicator_defs(nodes: List[FlowNode]) -> List[Dict[str, Any]]:
    defs = []
    for node in nodes:
        if node.type != "indicator":
            continue
        data = node.data or {}
        defs.append(
            {
                "node_id": node.id,
                "indicatorType": data.get("indicatorType"),
                "params": data.get("params", {}),
            }
        )
    return defs


def compile_flow_strategy(
    raw_nodes: List[Dict[str, Any]],
    raw_edges: List[Dict[str, Any]],
    settings: Optional[Dict[str, Any]] = None,
) -> CompilationResult:
    nodes = [FlowNode(**node) for node in raw_nodes]
    edges = [FlowEdge(**edge) for edge in raw_edges]
    validation = validate_flow_strategy(raw_nodes, raw_edges, settings=settings)
    node_order, _ = _topological_sort(nodes, edges)
    inputs_map = _build_inputs_map(nodes, edges)

    compiled = {
        "version": "2.0.0",
        "settings": settings or {},
        "name": (settings or {}).get("name", "FlowStrategy"),
        "description": (settings or {}).get("description", ""),
        "nodes": [node.__dict__ for node in nodes],
        "edges": [edge.__dict__ for edge in edges],
        "node_order": node_order,
        "inputs": inputs_map,
        "indicator_defs": _collect_indicator_defs(nodes),
    }

    python_code = _generate_python_code(compiled)
    return CompilationResult(compiled=compiled, python_code=python_code, validation=validation)


def _generate_python_code(compiled: Dict[str, Any]) -> str:
    payload = json.dumps(compiled, indent=2)
    return f'''"""
Flow Strategy (Compiled)
Version: {compiled.get("version")}
"""

try:
    from backend.flow.runtime import FlowStrategy
except ImportError:
    from flow.runtime import FlowStrategy

COMPILED_FLOW = {payload}


class GeneratedStrategy(FlowStrategy):
    def __init__(self, config=None):
        super().__init__(compiled=COMPILED_FLOW, config=config)


Strategy = GeneratedStrategy
'''
