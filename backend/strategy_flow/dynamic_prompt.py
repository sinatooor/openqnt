"""
Dynamic Prompt Generator for Strategy Flow

Reads node catalog TypeScript files from the frontend source and
auto-generates the LLM system prompt. This ensures the prompt is
always in sync with the actual available nodes — single source of truth.

Usage:
    from strategy_flow.dynamic_prompt import build_system_prompt
    prompt = build_system_prompt()
"""

import re
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from functools import lru_cache


import os

# Path to the frontend node catalog (relative to backend/) — read-only.
CATALOG_DIR = Path(__file__).parent.parent.parent / "src" / "features" / "strategy-flow" / "catalog" / "nodes"

# Fallback: if no TS files found, use a cached JSON export. Read first from the
# read-only bundle (alongside this file); writes go to OPENQWNT_DATA_DIR in
# desktop builds so the read-only resources tree isn't touched.
_BUNDLED_CACHE = Path(__file__).parent / "node_catalog_cache.json"
_DATA_DIR = Path(os.environ.get("OPENQWNT_DATA_DIR", str(Path(__file__).parent)))
CACHED_CATALOG_PATH = _DATA_DIR / "node_catalog_cache.json"
if not CACHED_CATALOG_PATH.exists() and _BUNDLED_CACHE.exists():
    # First-run seed: copy from bundle into writable data dir.
    try:
        CACHED_CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHED_CATALOG_PATH.write_bytes(_BUNDLED_CACHE.read_bytes())
    except Exception:
        # Fall back to read-only path; writes will fail loudly later, which is fine.
        CACHED_CATALOG_PATH = _BUNDLED_CACHE


# ============================================================
# TypeScript Parser — extract node definitions from .ts files
# ============================================================

def parse_ts_node_file(filepath: Path) -> List[Dict[str, Any]]:
    """
    Parse a single TypeScript node catalog file and extract
    NodeCatalogItem objects as Python dicts.
    """
    content = filepath.read_text(encoding="utf-8")
    nodes: List[Dict[str, Any]] = []

    # Match each object literal in the exported array
    # Pattern: { type: '...', nodeType: '...', ... },
    # We match balanced braces at depth-1 inside the array
    array_match = re.search(
        r'export\s+const\s+\w+\s*:\s*NodeCatalogItem\[\]\s*=\s*\[(.*)\]',
        content,
        re.DOTALL
    )
    if not array_match:
        return nodes

    array_body = array_match.group(1)

    # Extract each { ... } block (supporting nested objects like defaultData)
    depth = 0
    start = None
    for i, ch in enumerate(array_body):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start is not None:
                block = array_body[start:i + 1]
                node = _parse_ts_object(block)
                if node and "type" in node:
                    nodes.append(node)
                start = None

    return nodes


def _parse_ts_object(block: str) -> Dict[str, Any]:
    """
    Parse a TypeScript object literal string into a Python dict.
    Handles nested objects, arrays, and string/number values.
    """
    result: Dict[str, Any] = {}

    # Remove outer braces
    inner = block.strip()
    if inner.startswith('{'):
        inner = inner[1:]
    if inner.endswith('}'):
        inner = inner[:-1]

    # Tokenize key-value pairs at the top level
    # We need to be careful about nested braces/brackets
    pairs = _split_top_level(inner)

    for pair in pairs:
        pair = pair.strip()
        if not pair or pair.startswith('//') or pair.startswith('/*'):
            continue

        # Match key: value
        kv_match = re.match(r'(\w+)\s*:\s*(.*)', pair, re.DOTALL)
        if not kv_match:
            continue

        key = kv_match.group(1).strip()
        raw_value = kv_match.group(2).strip()

        # Remove trailing comma
        if raw_value.endswith(','):
            raw_value = raw_value[:-1].strip()

        result[key] = _parse_ts_value(raw_value)

    return result


def _parse_ts_value(raw: str) -> Any:
    """Parse a single TypeScript value (string, number, bool, array, object)."""
    raw = raw.strip()

    # String (single or double quotes)
    if (raw.startswith("'") and raw.endswith("'")) or \
       (raw.startswith('"') and raw.endswith('"')):
        return raw[1:-1]

    # Boolean
    if raw == 'true':
        return True
    if raw == 'false':
        return False

    # Number
    try:
        if '.' in raw:
            return float(raw)
        return int(raw)
    except ValueError:
        pass

    # Array: [...]
    if raw.startswith('[') and raw.endswith(']'):
        inner = raw[1:-1].strip()
        if not inner:
            return []
        items = _split_top_level(inner)
        return [_parse_ts_value(item.strip().rstrip(',')) for item in items if item.strip()]

    # Nested object: { ... }
    if raw.startswith('{') and raw.endswith('}'):
        return _parse_ts_object(raw)

    # Fallback: return as string
    return raw


def _split_top_level(text: str) -> List[str]:
    """
    Split text by commas, but only at the top brace/bracket level.
    Handles nested objects and arrays properly.
    """
    parts: List[str] = []
    depth_brace = 0
    depth_bracket = 0
    in_string = False
    string_char = None
    current: List[str] = []

    i = 0
    while i < len(text):
        ch = text[i]

        # Handle strings
        if in_string:
            current.append(ch)
            if ch == string_char and (i == 0 or text[i - 1] != '\\'):
                in_string = False
            i += 1
            continue

        if ch in ("'", '"'):
            in_string = True
            string_char = ch
            current.append(ch)
            i += 1
            continue

        # Skip line comments
        if ch == '/' and i + 1 < len(text) and text[i + 1] == '/':
            # Skip to end of line
            while i < len(text) and text[i] != '\n':
                i += 1
            continue

        # Track depth
        if ch == '{':
            depth_brace += 1
        elif ch == '}':
            depth_brace -= 1
        elif ch == '[':
            depth_bracket += 1
        elif ch == ']':
            depth_bracket -= 1

        # Split on comma at top level
        if ch == ',' and depth_brace == 0 and depth_bracket == 0:
            parts.append(''.join(current))
            current = []
        else:
            current.append(ch)

        i += 1

    if current:
        parts.append(''.join(current))

    return parts


# ============================================================
# Load full catalog
# ============================================================

def load_catalog_from_typescript() -> Dict[str, List[Dict[str, Any]]]:
    """
    Load all node definitions from frontend TypeScript catalog files.
    Returns dict keyed by category name.
    """
    catalog: Dict[str, List[Dict[str, Any]]] = {}

    if not CATALOG_DIR.exists():
        # Fallback to cached catalog
        if CACHED_CATALOG_PATH.exists():
            return json.loads(CACHED_CATALOG_PATH.read_text(encoding="utf-8"))
        return {}

    for ts_file in sorted(CATALOG_DIR.glob("*.ts")):
        if ts_file.name.startswith("_") or ts_file.name == "index.ts":
            continue

        nodes = parse_ts_node_file(ts_file)
        if nodes:
            # Derive category from filename: indicatorNodes.ts → indicator
            cat_name = ts_file.stem.replace("Nodes", "")
            catalog[cat_name] = nodes

    return catalog


def save_catalog_cache(catalog: Dict[str, List[Dict[str, Any]]]) -> None:
    """Save catalog to JSON cache for environments without TS source."""
    CACHED_CATALOG_PATH.write_text(
        json.dumps(catalog, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )


# ============================================================
# Prompt Builder
# ============================================================

# Category display names and descriptions
CATEGORY_META = {
    "indicator": ("INDICATOR NODES", "indicator", "indicatorType",
                  "Technical analysis indicators. Compute values from price/volume data."),
    "condition": ("CONDITION NODES", "condition", "conditionType",
                  "Logic and comparison nodes. Evaluate to true/false."),
    "action": ("ACTION NODES", "action", "actionType",
               "Trading execution nodes. Place orders, set stops, send alerts."),
    "environment": ("ENVIRONMENT NODES", "environment", "environmentType",
                    "Market data and time inputs. Access price, spread, time info."),
    "control": ("CONTROL NODES", "control", "controlType",
                "Flow control and logic. Branching, loops, delays."),
    "variable": ("VARIABLE NODES", "variable", "variableType",
                 "State management. Store and retrieve values between ticks."),
    "math": ("MATH NODES", "math", "mathType",
             "Mathematical operations. Arithmetic and functions."),
    "risk": ("RISK NODES", "risk", "riskType",
             "Risk management. Position sizing, drawdown limits, stops."),
    "tradeInfo": ("TRADE INFO NODES", "tradeInfo", "tradeInfoType",
                  "Position and trade data. Entry price, PnL, duration."),
    "llm": ("LLM NODES", "llm", "llmType",
            "AI-powered analysis. Sentiment, regime detection, AI decisions."),
}


def _build_node_table(nodes: List[Dict[str, Any]], type_field: str) -> str:
    """Build a markdown table for a list of nodes."""
    # Determine which columns we have
    has_default_data = any("defaultData" in n for n in nodes)
    has_inputs = any("inputs" in n for n in nodes)

    lines = []
    lines.append("| Type | Label | Description | Default Data |")
    lines.append("|------|-------|-------------|-------------|")

    for node in nodes:
        ntype = node.get("type", "?")
        label = node.get("label", ntype)
        desc = node.get("description", "")
        tooltip = node.get("tooltip", "")

        # Build default data summary from defaultData
        defaults = node.get("defaultData", {})
        # Remove the type-identifying field from display
        defaults_display = {
            k: v for k, v in defaults.items()
            if k != type_field and k != "nodeType"
        }
        if defaults_display:
            defaults_str = ", ".join(
                f"{k}: {json.dumps(v) if isinstance(v, (dict, list)) else v}"
                for k, v in defaults_display.items()
            )
        else:
            defaults_str = "—"

        # Use tooltip for description if available (more detailed)
        display_desc = tooltip if tooltip else desc
        # Truncate long tooltips
        if len(display_desc) > 80:
            display_desc = display_desc[:77] + "..."
        lines.append(f"| {ntype} | {label} | {display_desc} | {defaults_str} |")

    return "\n".join(lines)


def _build_category_section(
    cat_key: str,
    nodes: List[Dict[str, Any]]
) -> str:
    """Build a full markdown section for a node category."""
    meta = CATEGORY_META.get(cat_key)
    if not meta:
        title = cat_key.upper() + " NODES"
        node_type_str = cat_key
        type_field = cat_key + "Type"
        desc = ""
    else:
        title, node_type_str, type_field, desc = meta

    parts = []
    parts.append(f"## {title} (type: \"{node_type_str}\")\n")
    if desc:
        parts.append(f"{desc}\n")
    parts.append(f"Set `data.{type_field}` to one of:\n")

    # Group by subcategory if present
    subcategories: Dict[str, List[Dict[str, Any]]] = {}
    for node in nodes:
        sub = node.get("subcategory", "General")
        subcategories.setdefault(sub, []).append(node)

    if len(subcategories) > 1:
        for sub_name, sub_nodes in subcategories.items():
            parts.append(f"\n### {sub_name}")
            parts.append(_build_node_table(sub_nodes, type_field))
    else:
        parts.append(_build_node_table(nodes, type_field))

    return "\n".join(parts)


def build_system_prompt(catalog: Optional[Dict[str, List[Dict[str, Any]]]] = None) -> str:
    """
    Build the complete system prompt dynamically from the node catalog.

    If no catalog is provided, reads from TypeScript source files.
    Falls back to cached JSON if TS files are unavailable.
    """
    if catalog is None:
        catalog = load_catalog_from_typescript()
        # Cache for Docker/deployment environments without TS source
        if catalog:
            try:
                save_catalog_cache(catalog)
            except Exception:
                pass

    # Count total nodes
    total_nodes = sum(len(nodes) for nodes in catalog.values())

    # Build node sections
    node_sections = []
    # Preferred ordering
    order = [
        "indicator", "condition", "action", "environment",
        "control", "variable", "math", "risk", "tradeInfo", "llm"
    ]
    for cat_key in order:
        if cat_key in catalog:
            node_sections.append(
                _build_category_section(cat_key, catalog[cat_key])
            )
    # Any remaining categories
    for cat_key, nodes in catalog.items():
        if cat_key not in order:
            node_sections.append(
                _build_category_section(cat_key, nodes)
            )

    all_node_sections = "\n\n---\n\n".join(node_sections)

    prompt = f"""You are an expert trading strategy builder that creates visual node-based strategies for the Strategy Flow system.

Your task is to convert natural language descriptions of trading strategies into JSON configurations containing nodes and edges that can be rendered in a ReactFlow canvas.

The system has {total_nodes} available node types across {len(catalog)} categories.

## Output Format

You MUST return a valid JSON object with this structure:
```json
{{
  "nodes": [...],
  "edges": [...],
  "message": "Brief description of the strategy created"
}}
```

## Node Structure

Each node must have:
- `id`: Unique string identifier (e.g., "sma-1", "rsi-entry", "buy-action")
- `type`: The node category type (e.g., "indicator", "condition", "action")
- `position`: Object with `x` and `y` coordinates for layout
- `data`: Object containing node-specific configuration (including the subtype field)

---

{all_node_sections}

---

## Edge Structure

Edges connect nodes:
```json
{{
  "id": "e-sma-fast-crossover",
  "source": "sma-fast",
  "target": "crossover-1",
  "sourceHandle": "value",
  "targetHandle": "input-a"
}}
```

- `id`: Unique edge identifier
- `source`: ID of the source node
- `target`: ID of the target node
- `sourceHandle`: Output handle name — MUST match the node's actual output handle ID:
  - Indicators (default: sma, ema, rsi, atr, etc.): `"value"`
  - Indicators (macd): `"line"`, `"signal"`, `"histogram"`
  - Indicators (bb/keltner/donchian): `"upper"`, `"middle"`, `"lower"`
  - Indicators (stochastic): `"main"`, `"signal"`
  - Indicators (ichimoku): `"tenkan"`, `"kijun"`, `"senkou_a"`, `"senkou_b"`, `"chikou"`
  - Conditions (all): `"output"`
  - Math nodes: `"output"`
  - Environment nodes: `"value"`
  - Action nodes: `"next"`
  - Trigger nodes: `"output"`
  - Control (if/ifElse): `"then"`, `"else"`
  - Risk nodes: `"size"` or `"output"`
- `targetHandle`: Input handle name — MUST match the node's actual input handle ID:
  - Conditions (compare/crossover/and/or): `"input-a"`, `"input-b"`
  - Conditions (not): `"input"`
  - Actions: `"trigger"`
  - Control (if/ifElse): `"condition"`
  - Math (binary ops): `"input-a"`, `"input-b"`

---

## Layout Guidelines

1. Arrange nodes left-to-right in logical flow:
   - Environment/Indicators (x: 100-200)
   - Math/Variables (x: 250-350)
   - Conditions (x: 400-500)
   - Control (x: 550-650)
   - Actions (x: 700-800)

2. Space nodes vertically with 120-150px gaps

3. Keep related nodes grouped together

---

## Strategy Best Practices

1. **Entry Conditions**: Connect indicators → conditions → actions
2. **Exit Conditions**: Create separate condition chains for exit signals
3. **Risk Management**: Include stopLoss, takeProfit, or risk nodes
4. **Common Parameters**:
   - RSI: period 14, oversold < 30, overbought > 70
   - SMA/EMA crossover: fast 10-20, slow 50-200
   - MACD: fast 12, slow 26, signal 9
   - Bollinger Bands: period 20, stdDev 2
   - ATR: period 14

---

## Common Strategy Patterns

### RSI Oversold Reversal
```
RSI(14) → Threshold(< 30) → Buy Order
RSI(14) → Threshold(> 70) → Close Position
```

### Moving Average Crossover
```
Fast EMA(10) ──┐
               ├→ Crossover → Buy Order
Slow EMA(50) ──┘
```

### Multi-Condition Entry
```
RSI → Threshold(< 40) ──┐
                        ├→ AND → Buy Order
EMA Crossover ──────────┘
```

---

## Rules

1. ALWAYS return valid JSON
2. ALWAYS include at least one indicator and one action node
3. ALWAYS connect nodes logically with edges
4. Use descriptive labels for nodes
5. Position nodes for clear visual flow (left-to-right)
6. Include a helpful `message` describing the strategy
7. Use ONLY node types listed in the catalog above
8. For complex strategies, use Control nodes (if, ifElse) for branching
9. For advanced strategies, consider Risk nodes and Variable nodes

Now generate a strategy based on the user's request."""

    return prompt


# ============================================================
# Cached version for performance
# ============================================================

_cached_prompt: Optional[str] = None


def get_system_prompt() -> str:
    """Get the system prompt, cached after first build."""
    global _cached_prompt
    if _cached_prompt is None:
        _cached_prompt = build_system_prompt()
    return _cached_prompt


def invalidate_prompt_cache() -> None:
    """Force rebuild of the system prompt on next call."""
    global _cached_prompt
    _cached_prompt = None
