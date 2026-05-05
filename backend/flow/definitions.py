"""Node and port definitions for Flow strategies."""

from dataclasses import dataclass
from typing import Dict, List


DATA_TYPES = {
    "number", "boolean", "signal", "any", "time",
    # New types introduced with the dataSource / portfolio / agent nodes.
    # The validator type-compatibility check uses _is_compatible() which
    # accepts identical types or 'any' on either side, so these new types
    # play nice with existing connections.
    "ohlcv", "series", "positions", "symbol_list",
}


@dataclass(frozen=True)
class PortDef:
    name: str
    data_type: str
    required: bool = True


@dataclass(frozen=True)
class NodeDefinition:
    inputs: List[PortDef]
    outputs: List[PortDef]


def _indicator_outputs(indicator_type: str) -> List[PortDef]:
    if indicator_type in {"macd"}:
        return [
            PortDef("line", "number"),
            PortDef("signal", "number"),
            PortDef("histogram", "number"),
        ]
    if indicator_type in {"bb", "keltner", "donchian"}:
        return [
            PortDef("upper", "number"),
            PortDef("middle", "number"),
            PortDef("lower", "number"),
        ]
    return [PortDef("output", "number")]


def _environment_output(env_type: str) -> PortDef:
    if env_type in {"newCandleOpen", "isMarketOpen"}:
        return PortDef("output", "boolean")
    if env_type in {"time"}:
        return PortDef("output", "time")
    return PortDef("output", "number")


def get_node_definition(node_type: str, node_data: Dict) -> NodeDefinition:
    subtype = (
        node_data.get("indicatorType")
        or node_data.get("conditionType")
        or node_data.get("actionType")
        or node_data.get("mathType")
        or node_data.get("controlType")
        or node_data.get("riskType")
        or node_data.get("variableType")
        or node_data.get("environmentType")
        or node_data.get("tradeInfoType")
    )

    if node_type == "indicator":
        return NodeDefinition(inputs=[], outputs=_indicator_outputs(str(subtype)))

    if node_type == "environment":
        return NodeDefinition(inputs=[], outputs=[_environment_output(str(subtype))])

    if node_type == "condition":
        if subtype in {"and", "or"}:
            return NodeDefinition(
                inputs=[PortDef("input-a", "boolean"), PortDef("input-b", "boolean")],
                outputs=[PortDef("output", "boolean")],
            )
        if subtype == "not":
            return NodeDefinition(
                inputs=[PortDef("input", "boolean")],
                outputs=[PortDef("output", "boolean")],
            )
        if subtype == "threshold":
            return NodeDefinition(
                inputs=[PortDef("input-a", "number")],
                outputs=[PortDef("output", "boolean")],
            )
        return NodeDefinition(
            inputs=[PortDef("input-a", "number"), PortDef("input-b", "number")],
            outputs=[PortDef("output", "boolean")],
        )

    if node_type == "math":
        if subtype == "number":
            return NodeDefinition(inputs=[], outputs=[PortDef("output", "number")])
        if subtype == "advancedMath":
            return NodeDefinition(
                inputs=[PortDef("input", "number")],
                outputs=[PortDef("output", "number")],
            )
        return NodeDefinition(
            inputs=[PortDef("input-a", "number"), PortDef("input-b", "number")],
            outputs=[PortDef("output", "number")],
        )

    if node_type == "variable":
        if subtype == "getVariable":
            return NodeDefinition(inputs=[], outputs=[PortDef("output", "any")])
        return NodeDefinition(
            inputs=[PortDef("input", "any")],
            outputs=[PortDef("output", "signal")],
        )

    if node_type == "risk":
        return NodeDefinition(inputs=[], outputs=[PortDef("output", "any")])

    if node_type == "tradeInfo":
        return NodeDefinition(inputs=[], outputs=[PortDef("output", "number")])

    if node_type == "control":
        if subtype in {"if", "ifElse"}:
            return NodeDefinition(
                inputs=[PortDef("condition", "boolean")],
                outputs=[PortDef("output", "signal")],
            )
        return NodeDefinition(
            inputs=[PortDef("trigger", "signal")],
            outputs=[PortDef("output", "signal")],
        )

    if node_type == "action":
        if subtype in {"stopLoss", "takeProfit"}:
            return NodeDefinition(
                inputs=[PortDef("trigger", "signal"), PortDef("price", "number")],
                outputs=[PortDef("output", "signal")],
            )
        if subtype == "order":
            return NodeDefinition(
                inputs=[PortDef("trigger", "signal"), PortDef("size", "number", required=False)],
                outputs=[PortDef("output", "signal")],
            )
        return NodeDefinition(
            inputs=[PortDef("trigger", "signal")],
            outputs=[PortDef("output", "signal")],
        )

    if node_type == "llm":
        return NodeDefinition(
            inputs=[PortDef("trigger", "signal", required=False)],
            outputs=[PortDef("output", "any")],
        )

    # ── New categories ───────────────────────────────────────────────
    # The compiler / runtime now formally recognises these instead of
    # silently dropping them via the empty-fallback at the end. The
    # output port type drives type-compatibility checks in validator.py.

    if node_type == "dataSource":
        kind = (node_data.get("kind") or "").lower()
        provider = (node_data.get("provider") or "").lower()
        # Provider-determined shape: positions / watchlist are not OHLCV
        if kind == "positions" or provider == "fred":
            out_type = "positions" if kind == "positions" else "series"
            return NodeDefinition(inputs=[], outputs=[PortDef("output", out_type)])
        if kind == "watchlist":
            return NodeDefinition(inputs=[], outputs=[PortDef("output", "symbol_list")])
        # Default: an OHLCV stream feeding indicators
        return NodeDefinition(inputs=[], outputs=[PortDef("ohlcv", "ohlcv")])

    if node_type == "trigger":
        return NodeDefinition(inputs=[], outputs=[PortDef("output", "signal")])

    if node_type == "integration":
        # Integrations consume a signal and (usually) emit one for
        # downstream chaining (e.g. send-Telegram-then-place-order).
        return NodeDefinition(
            inputs=[PortDef("trigger", "signal", required=False)],
            outputs=[PortDef("output", "signal")],
        )

    if node_type == "portfolio":
        return NodeDefinition(inputs=[], outputs=[PortDef("output", "any")])

    if node_type == "agent":
        return NodeDefinition(
            inputs=[PortDef("trigger", "signal", required=False)],
            outputs=[PortDef("output", "any")],
        )

    if node_type == "pineScript":
        # Pine Script blocks are typically standalone code; the export
        # path serialises them but they don't participate in compute graph.
        return NodeDefinition(inputs=[], outputs=[PortDef("output", "any")])

    return NodeDefinition(inputs=[], outputs=[])
