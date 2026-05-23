#!/usr/bin/env python3
"""
check_strategy.py — local structural validator for exported strategy JSON.

The Python `backend/strategy_flow/validator.py` is the source of truth at
runtime; this script is the local, offline equivalent you can run on a
strategy file straight from the canvas's "Export" button.

What it catches (the kinds of bugs you've been seeing):

  E001  Edge endpoint refers to a node id that doesn't exist
  E002  sourceHandle id is not in the source node's outputs
  E003  targetHandle id is not in the target node's inputs
  E004  Edge connects incompatible dataTypes (signal → number, etc.)
  E005  Trigger source (startTrigger / heartbeatTrigger / cronTrigger /
        webhookTrigger / manualTrigger / priceAlertTrigger / brokerEventTrigger)
        has zero outgoing edges — strategy can never fire
  E006  Action node's `trigger` input handle is not wired — node never fires
  E007  Chain action node (stopLoss / takeProfit / trailingStop) wires its
        scalar input to a `trigger` handle instead of its price/size handle
  W101  Node is orphaned (no incoming AND no outgoing edges)
  W102  Indicator's `data` handle is not wired — uses fallback dataSource
  W103  Strategy has more than one Start node
  W104  Strategy declares a recurring interval but no Trigger node fires it
  W105  Action that needs size has no size input AND zero default

Usage:
  ./scripts/check_strategy.py path/to/strategy.json
  cat strategy.json | ./scripts/check_strategy.py -
  ./scripts/check_strategy.py path/to/strategy.json --json   # machine-readable

Exit code: 0 if no errors (warnings are OK), 1 if errors present.
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# ── catalog ─────────────────────────────────────────────────────────────

CATALOG_PATH = (
    Path(__file__).resolve().parent.parent
    / "backend" / "strategy_flow" / "node_catalog_cache.json"
)


def load_catalog() -> Dict[str, Any]:
    if not CATALOG_PATH.exists():
        sys.exit(f"catalog not found at {CATALOG_PATH} — run the backend once to seed it")
    return json.loads(CATALOG_PATH.read_text())


def build_handle_index(catalog: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Map `type` (or subtype for triggers) → handle metadata.

    The catalog stores handles per top-level node `type` (e.g. `rsi`,
    `order`, `startTrigger`, `heartbeatTrigger`). The exported reactflow
    JSON keys things differently — top-level `type` is the React component
    class (`trigger`, `indicator`, `action`, ...) and the specific kind
    sits in `data.{triggerType,indicatorType,actionType,...}`. We index
    by the schema-level `type` so a lookup needs a small resolver below.
    """
    out: Dict[str, Dict[str, Any]] = {}
    for cat_list in catalog.values():
        if not isinstance(cat_list, list):
            continue
        for entry in cat_list:
            t = entry.get("type")
            if not t:
                continue
            out[t] = {
                "handles": entry.get("handles", []),
                "defaultData": entry.get("defaultData", {}),
                "category": entry.get("category"),
                "nodeType": entry.get("nodeType"),
            }
    return out


# Map exported `type` → which `data.*Type` field carries the schema-level id.
_NODE_TYPE_SUBTYPE_KEY: Dict[str, str] = {
    "trigger": "triggerType",
    "indicator": "indicatorType",
    "action": "actionType",
    "condition": "conditionType",
    "math": "mathType",
    "environment": "environmentType",
    "risk": "riskType",
    "control": "controlType",
    "tradeInfo": "tradeInfoType",
    "portfolio": "portfolioType",
    "dataSource": "dataSourceType",
    "integration": "integrationType",
    "llm": "llmType",
    "agent": "agentNodeType",
}


def resolve_schema_type(node: Dict[str, Any]) -> Optional[str]:
    """Map an exported node to its schema-level `type` key (the one used
    in the catalog). Returns None if it can't be resolved."""
    t = node.get("type")
    data = node.get("data") or {}
    if not t:
        return None
    subtype_key = _NODE_TYPE_SUBTYPE_KEY.get(t)
    if subtype_key and data.get(subtype_key):
        return data[subtype_key]
    return t  # fallback


def handles_of(node: Dict[str, Any], index: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    schema_type = resolve_schema_type(node) or ""
    entry = index.get(schema_type)
    if not entry:
        return []
    return entry.get("handles", []) or []


def inputs_of(node: Dict[str, Any], index: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [h for h in handles_of(node, index) if h.get("type") == "target"]


def outputs_of(node: Dict[str, Any], index: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [h for h in handles_of(node, index) if h.get("type") == "source"]


# ── findings ────────────────────────────────────────────────────────────

@dataclass
class Finding:
    severity: str  # "error" | "warning"
    code: str
    message: str
    node_id: Optional[str] = None
    edge_id: Optional[str] = None


@dataclass
class Report:
    errors: List[Finding] = field(default_factory=list)
    warnings: List[Finding] = field(default_factory=list)

    def add(self, finding: Finding) -> None:
        (self.errors if finding.severity == "error" else self.warnings).append(finding)

    def is_valid(self) -> bool:
        return not self.errors


# ── checks ──────────────────────────────────────────────────────────────

_TRIGGER_SUBTYPES = {
    "startTrigger", "heartbeatTrigger", "cronTrigger", "webhookTrigger",
    "manualTrigger", "priceAlertTrigger", "newsTrigger",
    "brokerEventTrigger", "conditionTrigger",
}
_CHAIN_ACTION_SUBTYPES = {"stopLoss", "takeProfit", "trailingStop"}


# Coarse compatibility — same as the backend's spirit but locally restated
# so this script has no runtime dep on the backend. `signal` is the universal
# trigger type; `number` flows wherever a numeric is expected.
_COMPATIBLE: Dict[str, Set[str]] = {
    "signal": {"signal", "any"},
    "number": {"number", "any"},
    "string": {"string", "any"},
    "ohlcv": {"ohlcv", "any"},
    "candles": {"candles", "ohlcv", "any"},
    "json": {"json", "any"},
    "boolean": {"signal", "boolean", "any"},
    "any": {"signal", "number", "string", "ohlcv", "candles", "json", "boolean", "any"},
}


def _compatible(src: str, tgt: str) -> bool:
    return tgt in _COMPATIBLE.get(src, {src, "any"}) or src == "any" or tgt == "any"


def check_strategy(strategy: Dict[str, Any], catalog_index: Dict[str, Dict[str, Any]]) -> Report:
    report = Report()
    nodes: List[Dict[str, Any]] = strategy.get("nodes", []) or []
    edges: List[Dict[str, Any]] = strategy.get("edges", []) or []
    settings: Dict[str, Any] = strategy.get("settings", {}) or {}

    nodes_by_id = {n["id"]: n for n in nodes if "id" in n}

    # ── E001: edges reference existing nodes ──
    for edge in edges:
        src, tgt = edge.get("source"), edge.get("target")
        if src not in nodes_by_id:
            report.add(Finding("error", "E001",
                f"Edge {edge.get('id')} source '{src}' not found", edge_id=edge.get("id")))
        if tgt not in nodes_by_id:
            report.add(Finding("error", "E001",
                f"Edge {edge.get('id')} target '{tgt}' not found", edge_id=edge.get("id")))

    # ── E002 / E003: handles exist on the right side ──
    for edge in edges:
        src_node = nodes_by_id.get(edge.get("source"))
        tgt_node = nodes_by_id.get(edge.get("target"))
        if not src_node or not tgt_node:
            continue
        src_outs = outputs_of(src_node, catalog_index)
        tgt_ins = inputs_of(tgt_node, catalog_index)
        sh = edge.get("sourceHandle")
        th = edge.get("targetHandle")
        if src_outs and sh and sh not in {h.get("id") for h in src_outs}:
            report.add(Finding("error", "E002",
                f"sourceHandle '{sh}' not in {src_node['id']} ({resolve_schema_type(src_node)}) "
                f"outputs {[h.get('id') for h in src_outs]}",
                edge_id=edge.get("id"), node_id=src_node["id"]))
        if tgt_ins and th and th not in {h.get("id") for h in tgt_ins}:
            report.add(Finding("error", "E003",
                f"targetHandle '{th}' not in {tgt_node['id']} ({resolve_schema_type(tgt_node)}) "
                f"inputs {[h.get('id') for h in tgt_ins]}",
                edge_id=edge.get("id"), node_id=tgt_node["id"]))

    # ── E004: dataType compatibility ──
    for edge in edges:
        src_node = nodes_by_id.get(edge.get("source"))
        tgt_node = nodes_by_id.get(edge.get("target"))
        if not src_node or not tgt_node:
            continue
        sh = edge.get("sourceHandle")
        th = edge.get("targetHandle")
        src_h = next((h for h in outputs_of(src_node, catalog_index) if h.get("id") == sh), None)
        tgt_h = next((h for h in inputs_of(tgt_node, catalog_index) if h.get("id") == th), None)
        if src_h and tgt_h:
            sd = src_h.get("dataType", "any")
            td = tgt_h.get("dataType", "any")
            if not _compatible(sd, td):
                report.add(Finding("error", "E004",
                    f"Type mismatch: {src_node['id']}:{sh} ({sd}) → {tgt_node['id']}:{th} ({td})",
                    edge_id=edge.get("id"), node_id=tgt_node["id"]))

    # ── edge index for the remaining checks ──
    out_edges: Dict[str, List[Dict[str, Any]]] = {n["id"]: [] for n in nodes}
    in_edges: Dict[str, List[Dict[str, Any]]] = {n["id"]: [] for n in nodes}
    for e in edges:
        if e.get("source") in out_edges:
            out_edges[e["source"]].append(e)
        if e.get("target") in in_edges:
            in_edges[e["target"]].append(e)

    # ── E005: trigger source nodes have outgoing edges ──
    trigger_ids: List[Tuple[str, str]] = []
    for n in nodes:
        sub = resolve_schema_type(n)
        if sub in _TRIGGER_SUBTYPES:
            trigger_ids.append((n["id"], sub))
            if not out_edges.get(n["id"]) and len(nodes) > 1:
                report.add(Finding("error", "E005",
                    f"Trigger '{n['id']}' ({sub}) has no outgoing edges — "
                    "nothing downstream will fire",
                    node_id=n["id"]))

    # ── W103: more than one Start node ──
    start_nodes = [(nid, sub) for nid, sub in trigger_ids if sub == "startTrigger"]
    if len(start_nodes) > 1:
        for nid, _ in start_nodes[1:]:
            report.add(Finding("warning", "W103",
                f"Multiple Start nodes detected — only one is allowed", node_id=nid))

    # ── W104: user asked for recurring run but no recurring trigger ──
    has_recurring_trigger = any(
        sub in {"heartbeatTrigger", "cronTrigger"} for _, sub in trigger_ids
    )
    interval_hint = any(
        (n.get("data", {}).get("timeframe") and n.get("type") == "indicator")
        for n in nodes
    )
    if interval_hint and not has_recurring_trigger:
        report.add(Finding("warning", "W104",
            "Strategy uses a timeframe but has no heartbeatTrigger/cronTrigger — "
            "it will only fire when the Start node is hit (one-shot)."))

    # ── E006: action `trigger` input wired ──
    for n in nodes:
        if n.get("type") != "action":
            continue
        nid = n["id"]
        # collect target handle ids actually wired
        wired_targets = {e.get("targetHandle") for e in in_edges.get(nid, [])}
        action_inputs = {h.get("id") for h in inputs_of(n, catalog_index)}
        if "trigger" in action_inputs and "trigger" not in wired_targets:
            report.add(Finding("error", "E006",
                f"Action '{nid}' ({resolve_schema_type(n)}) `trigger` input not wired — never fires",
                node_id=nid))

    # ── E007: chain action mis-wires scalar input to `trigger` ──
    for n in nodes:
        sub = resolve_schema_type(n)
        if sub not in _CHAIN_ACTION_SUBTYPES:
            continue
        nid = n["id"]
        # The expected scalar handle: stopLoss → stopPrice, takeProfit → takeProfitPrice
        expected = {
            "stopLoss": "stopPrice",
            "takeProfit": "takeProfitPrice",
            "trailingStop": "stopPrice",
        }[sub]
        wired = {e.get("targetHandle"): e for e in in_edges.get(nid, [])}
        if expected not in wired:
            # Look for a number/scalar edge mis-wired to `trigger`
            for e in in_edges.get(nid, []):
                if e.get("targetHandle") == "trigger":
                    src_node = nodes_by_id.get(e.get("source"))
                    src_h = next(
                        (h for h in outputs_of(src_node or {}, catalog_index)
                         if h.get("id") == e.get("sourceHandle")),
                        None,
                    )
                    if src_h and src_h.get("dataType") == "number":
                        report.add(Finding("error", "E007",
                            f"{sub} '{nid}' has a `number` source wired to its `trigger` input — "
                            f"likely meant `{expected}`",
                            edge_id=e.get("id"), node_id=nid))

    # ── W101: orphan nodes ──
    for n in nodes:
        nid = n["id"]
        sub = resolve_schema_type(n)
        # Start nodes are allowed to have no incoming
        # Action nodes are allowed to have no outgoing
        no_in = not in_edges.get(nid)
        no_out = not out_edges.get(nid)
        if no_in and no_out and len(nodes) > 1 and sub != "startTrigger":
            report.add(Finding("warning", "W101",
                f"Node '{nid}' ({sub}) has no incoming AND no outgoing edges — orphan",
                node_id=nid))

    # ── W102: indicator `data` handle not wired ──
    for n in nodes:
        if n.get("type") != "indicator":
            continue
        nid = n["id"]
        ins = {h.get("id") for h in inputs_of(n, catalog_index)}
        wired = {e.get("targetHandle") for e in in_edges.get(nid, [])}
        if "data" in ins and "data" not in wired:
            report.add(Finding("warning", "W102",
                f"Indicator '{nid}' ({resolve_schema_type(n)}) `data` input not wired — "
                "falls back to the strategy's default dataSource",
                node_id=nid))

    # ── W105: order needs size ──
    for n in nodes:
        if resolve_schema_type(n) != "order":
            continue
        nid = n["id"]
        wired = {e.get("targetHandle") for e in in_edges.get(nid, [])}
        data = n.get("data", {})
        default_size = float(data.get("size") or 0)
        if "size" not in wired and default_size == 0:
            report.add(Finding("warning", "W105",
                f"Order '{nid}' has no `size` input wired and `size` default is 0 — "
                "will be rejected by the risk gate",
                node_id=nid))

    return report


# ── CLI ─────────────────────────────────────────────────────────────────

def main() -> int:
    args = sys.argv[1:]
    json_mode = "--json" in args
    args = [a for a in args if a != "--json"]
    if not args:
        sys.stderr.write("usage: check_strategy.py <path|-> [--json]\n")
        return 2

    raw = sys.stdin.read() if args[0] == "-" else Path(args[0]).read_text()
    strategy = json.loads(raw)

    catalog = load_catalog()
    index = build_handle_index(catalog)
    report = check_strategy(strategy, index)

    if json_mode:
        payload = {
            "is_valid": report.is_valid(),
            "errors": [f.__dict__ for f in report.errors],
            "warnings": [f.__dict__ for f in report.warnings],
        }
        print(json.dumps(payload, indent=2))
        return 0 if report.is_valid() else 1

    print(f"{'─' * 60}")
    print(f"  Strategy: {strategy.get('name', '<unnamed>')}")
    print(f"  Nodes:    {len(strategy.get('nodes', []))}")
    print(f"  Edges:    {len(strategy.get('edges', []))}")
    print(f"{'─' * 60}")
    if not report.errors and not report.warnings:
        print("\n  ✓ no issues found.\n")
        return 0
    for f in report.errors:
        ref = f.node_id or f.edge_id or ""
        print(f"  [ERROR  {f.code}] {f.message}  ({ref})")
    for f in report.warnings:
        ref = f.node_id or f.edge_id or ""
        print(f"  [warn   {f.code}] {f.message}  ({ref})")
    print()
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
