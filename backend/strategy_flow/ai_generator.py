"""
AI Generator for Strategy Flow

Generates flow configurations from natural language using LLMs.
Supports 3 generation modes:
  - "fast" / "slow":   Classic prompt-based generation (dynamic prompt from catalog)
  - "tool-calling":    Gemini/OpenAI function calling for type-safe step-by-step building
"""

import json
import os
import re
import httpx
from typing import Any, Dict, List, Optional
from pathlib import Path

# ============================================================
# Prompt Loading
# ============================================================
PROMPTS_DIR = Path(__file__).parent / "prompts"


def load_prompt(name: str) -> str:
    """Load a prompt file."""
    path = PROMPTS_DIR / name
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return ""


# Dynamic prompt: auto-generated from TypeScript node catalog (single source of truth)
try:
    from .dynamic_prompt import get_system_prompt as _get_dynamic_prompt
    FLOW_SYSTEM_PROMPT = _get_dynamic_prompt()
    print(f"[ai_generator] Dynamic prompt loaded ({len(FLOW_SYSTEM_PROMPT)} chars)")
except Exception as e:
    # Fallback to static prompt file if dynamic generation fails
    print(f"[ai_generator] Dynamic prompt failed ({e}), using static prompt")
    FLOW_SYSTEM_PROMPT = load_prompt("flow_system_prompt.txt")

FLOW_VALIDATION_PROMPT = load_prompt("flow_validation_prompt.txt")

# Tool calling generator (lazy import to avoid circular deps)
_tool_calling_module = None


def _get_tool_calling():
    global _tool_calling_module
    if _tool_calling_module is None:
        from . import tool_calling as tc
        _tool_calling_module = tc
    return _tool_calling_module


# ============================================================
# Strategy-AI sidecar (Anthropic) — bridge to services/strategy-ai
# ============================================================

STRATEGY_AI_URL = os.getenv("STRATEGY_AI_URL", "http://127.0.0.1:3050")


async def _call_strategy_ai_sidecar(
    prompt: str,
    current_nodes: Optional[List[Dict[str, Any]]] = None,
    current_edges: Optional[List[Dict[str, Any]]] = None,
    history: Optional[List[Dict[str, str]]] = None,
) -> Optional[Dict[str, Any]]:
    """
    POST the user request to the Anthropic-backed strategy-ai sidecar
    (`services/strategy-ai`) and collect the final draft.

    The sidecar exposes `POST /agent/run` as Server-Sent Events. We don't
    surface the intermediate tool-call events here (the frontend's strategy
    transport is non-streaming today); we just wait for `run_complete` and
    return the final draft + summary in the shape `generate_flow_strategy`
    expects.

    Returns `None` if the sidecar is unreachable (caller falls back to
    Gemini). Returns `{success, nodes, edges, message, toolCalls}` otherwise.

    Why route here: the snapshot tests (`services/strategy-ai/tests/`)
    exercise this exact agent + prompt + tools. Routing the frontend
    through it means what the user sees in the chat matches what passes
    in CI — no model/prompt drift between test and prod.
    """
    payload = {
        "message": prompt,
        "draft": {
            "nodes": current_nodes or [],
            "edges": current_edges or [],
            "settings": {},
        },
        "history": history or [],
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=2.0)) as client:
            async with client.stream(
                "POST",
                f"{STRATEGY_AI_URL}/agent/run",
                json=payload,
                headers={"Accept": "text/event-stream"},
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    print(f"[ai_generator] sidecar HTTP {response.status_code}: {body[:200]!r}")
                    return None

                final_draft: Optional[Dict[str, Any]] = None
                final_summary: Optional[str] = None
                tool_calls = 0
                event_name: Optional[str] = None
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("event:"):
                        event_name = line[len("event:"):].strip()
                        continue
                    if line.startswith("data:"):
                        data_str = line[len("data:"):].strip()
                        if not data_str:
                            continue
                        try:
                            data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue
                        # Count tool-call events for telemetry parity with the
                        # Gemini path's `toolCalls` field.
                        if event_name in {
                            "node_added", "node_updated", "node_deleted",
                            "edge_added", "edge_deleted",
                            "validation_attempt", "verification_result",
                        }:
                            tool_calls += 1
                        elif event_name == "run_complete":
                            final_draft = data.get("draft")
                            final_summary = data.get("summary")
                        event_name = None

                if final_draft is None:
                    print("[ai_generator] sidecar finished without run_complete")
                    return None

                return {
                    "success": True,
                    "nodes": final_draft.get("nodes", []),
                    "edges": final_draft.get("edges", []),
                    "message": final_summary,
                    "toolCalls": tool_calls,
                }
    except (httpx.ConnectError, httpx.ConnectTimeout) as e:
        # Sidecar not running — silent fallback to Gemini path.
        print(f"[ai_generator] sidecar unreachable at {STRATEGY_AI_URL}: {e}")
        return None
    except Exception as e:
        print(f"[ai_generator] sidecar error: {e}")
        return None


# ============================================================
# LLM API Calls
# ============================================================

async def call_gemini(
    messages: List[Dict[str, str]], 
    temperature: float = 0.3,
    model: str = "gemini-2.5-flash"
) -> str:
    """Call Gemini API."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not configured")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    
    # Convert messages to Gemini format
    contents = []
    system_instruction = None
    
    for msg in messages:
        if msg["role"] == "system":
            system_instruction = msg["content"]
        else:
            contents.append({
                "role": "user" if msg["role"] == "user" else "model",
                "parts": [{"text": msg["content"]}]
            })
    
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": 8192,
        }
    }
    
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            url,
            headers={"Content-Type": "application/json"},
            params={"key": api_key},
            json=payload
        )
        
        if response.status_code == 503:
            # Gemini overloaded, will fallback to DeepSeek
            raise ConnectionError("Gemini overloaded")
        
        if response.status_code != 200:
            raise ValueError(f"Gemini API error: {response.status_code} - {response.text}")
        
        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise ValueError("No response from Gemini")
        
        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if not parts:
            raise ValueError("Empty response from Gemini")
        
        return parts[0].get("text", "")


async def call_deepseek(
    messages: List[Dict[str, str]], 
    temperature: float = 0.3
) -> str:
    """Call DeepSeek API as fallback."""
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise ValueError("DEEPSEEK_API_KEY not configured")
    
    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            "https://api.deepseek.com/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": messages,
                "temperature": temperature,
                "max_tokens": 8000
            }
        )
        
        if response.status_code != 200:
            raise ValueError(f"DeepSeek API error: {response.status_code} - {response.text}")
        
        data = response.json()
        return data["choices"][0]["message"]["content"]


async def call_llm(
    messages: List[Dict[str, str]], 
    temperature: float = 0.3,
    prefer_gemini: bool = True
) -> str:
    """Call LLM with fallback support."""
    if prefer_gemini:
        try:
            return await call_gemini(messages, temperature)
        except (ConnectionError, ValueError) as e:
            print(f"Gemini failed, falling back to DeepSeek: {e}")
            return await call_deepseek(messages, temperature)
    else:
        return await call_deepseek(messages, temperature)


# ============================================================
# JSON Extraction
# ============================================================

def extract_json(text: str) -> Dict[str, Any]:
    """Extract JSON from LLM response."""
    # Remove markdown code blocks
    cleaned = text.strip()
    
    # Try to find JSON in code blocks
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', cleaned)
    if json_match:
        cleaned = json_match.group(1).strip()
    
    # Try to find raw JSON object
    if not cleaned.startswith('{'):
        start = cleaned.find('{')
        if start != -1:
            # Find matching closing brace
            depth = 0
            end = start
            for i, char in enumerate(cleaned[start:], start):
                if char == '{':
                    depth += 1
                elif char == '}':
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            cleaned = cleaned[start:end]
    
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON: {e}\nText: {cleaned[:500]}")


# ============================================================
# Flow Generation
# ============================================================

async def generate_flow_strategy(
    prompt: str,
    current_nodes: Optional[List[Dict[str, Any]]] = None,
    current_edges: Optional[List[Dict[str, Any]]] = None,
    history: Optional[List[Dict[str, str]]] = None,
    mode: str = "fast"
) -> Dict[str, Any]:
    """
    Generate a flow strategy from natural language.

    Args:
        prompt: User's strategy description
        current_nodes: Existing nodes (for modification)
        current_edges: Existing edges (for modification)
        history: Prior chat turns ([{role, content}, ...]) — required for
            multi-turn edits ("add a 15 min trigger") to mutate the existing
            draft instead of regenerating from scratch.
        mode: "fast", "slow" (includes validation), or "tool-calling" (function calling)

    Returns:
        Dictionary with nodes, edges, message, and metadata
    """
    # ── Tool-calling mode ────────────────────────────────────────────────
    # Prefer the Anthropic-backed strategy-ai sidecar — it's the path the
    # headless snapshot tests exercise (same prompt, same tools, same model)
    # so the frontend builder result will match the verified behaviour.
    # Fall back to the legacy Gemini/OpenAI tool_calling.py implementation
    # only if the sidecar is unreachable.
    if mode == "tool-calling":
        sidecar_result = await _call_strategy_ai_sidecar(
            prompt=prompt,
            current_nodes=current_nodes,
            current_edges=current_edges,
            history=history,
        )
        if sidecar_result is not None:
            result = sidecar_result
            if result.get("success") and result.get("nodes"):
                nodes, edges, fixes = auto_fix_flow(result["nodes"], result["edges"])
                result["nodes"] = nodes
                result["edges"] = edges
                if fixes:
                    result["autoFixed"] = True
                    result.setdefault("fixes", []).extend(fixes)
            result["generationMode"] = "tool-calling"
            return result

        # Sidecar unreachable — fall back to Gemini/OpenAI tool calling.
        try:
            tc = _get_tool_calling()
            result = await tc.generate_with_tools(
                prompt=prompt,
                current_nodes=current_nodes,
                current_edges=current_edges,
                history=history,
            )
            if result.get("success") and result.get("nodes"):
                nodes, edges, fixes = auto_fix_flow(result["nodes"], result["edges"])
                result["nodes"] = nodes
                result["edges"] = edges
                if fixes:
                    result["autoFixed"] = True
                    result.setdefault("fixes", []).extend(fixes)
            result["generationMode"] = "tool-calling"
            return result
        except Exception as e:
            print(f"[ai_generator] Tool calling failed, falling back to prompt mode: {e}")
            mode = "fast"  # Fallback to prompt-based

    # ── Prompt-based mode (fast/slow) ──
    # Build context message
    context = ""
    if current_nodes:
        context = f"\n\nCurrent strategy has {len(current_nodes)} nodes. "
        context += "Modify or extend this strategy based on the request.\n"
        context += f"Existing nodes: {json.dumps(current_nodes, indent=2)}\n"
        if current_edges:
            context += f"Existing edges: {json.dumps(current_edges, indent=2)}"
    
    # Create messages
    messages = [
        {"role": "system", "content": FLOW_SYSTEM_PROMPT},
        {"role": "user", "content": f"{prompt}{context}"}
    ]
    
    # Generate with LLM
    try:
        response = await call_llm(messages, temperature=0.3)
        result = extract_json(response)
    except Exception as e:
        return {
            "success": False,
            "nodes": [],
            "edges": [],
            "errors": [str(e)],
            "message": f"Generation failed: {str(e)}"
        }
    
    # Extract nodes and edges
    nodes = result.get("nodes", [])
    edges = result.get("edges", [])
    message = result.get("message", "Strategy generated successfully")
    
    # Apply auto-fixes
    nodes, edges, fixes = auto_fix_flow(nodes, edges)
    
    # Validate in slow mode
    was_rationalized = False
    if mode == "slow" and nodes:
        try:
            validation_result = await validate_and_fix(nodes, edges)
            if validation_result.get("fixes"):
                nodes = validation_result.get("nodes", nodes)
                edges = validation_result.get("edges", edges)
                fixes.extend(validation_result.get("fixes", []))
                was_rationalized = True
        except Exception as e:
            print(f"Validation failed: {e}")
    
    return {
        "success": True,
        "nodes": nodes,
        "edges": edges,
        "message": message,
        "wasRationalized": was_rationalized,
        "autoFixed": len(fixes) > 0,
        "fixes": fixes,
        "warnings": result.get("warnings", []),
        "generationMode": "prompt"
    }


async def validate_and_fix(
    nodes: List[Dict[str, Any]], 
    edges: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Validate and fix a flow configuration using LLM."""
    messages = [
        {"role": "system", "content": FLOW_VALIDATION_PROMPT},
        {"role": "user", "content": json.dumps({"nodes": nodes, "edges": edges}, indent=2)}
    ]
    
    response = await call_llm(messages, temperature=0.2)
    return extract_json(response)


# ============================================================
# Topological Layout
# ============================================================

# Fallback layer for disconnected nodes (by type)
_TYPE_LAYER_HINT = {
    "environment": 0, "indicator": 0, "llm": 0, "trigger": 0,
    "math": 1, "variable": 1, "tradeInfo": 1,
    "condition": 2,
    "control": 3, "risk": 3,
    "action": 4, "integration": 4,
}

_LAYER_GAP_X = 260
_NODE_GAP_Y  = 160
_ORIGIN_X    = 80
_ORIGIN_Y    = 80

_TYPE_SORT_PRIORITY = {
    "environment": 0, "indicator": 1, "trigger": 2, "llm": 3,
    "math": 4, "variable": 5, "tradeInfo": 6,
    "condition": 7, "control": 8, "risk": 9,
    "action": 10, "integration": 11,
}


def _topological_layout(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Topologically sort nodes and assign layered positions so they
    flow left-to-right with no overlaps.
    """
    if len(nodes) <= 1:
        if nodes:
            nodes[0]["position"] = {"x": _ORIGIN_X, "y": _ORIGIN_Y}
        return nodes

    node_ids = [n["id"] for n in nodes]
    node_map = {n["id"]: n for n in nodes}
    id_set = set(node_ids)

    # Build adjacency
    adj: Dict[str, list] = {nid: [] for nid in node_ids}
    in_deg: Dict[str, int] = {nid: 0 for nid in node_ids}
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if s in id_set and t in id_set:
            adj[s].append(t)
            in_deg[t] = in_deg.get(t, 0) + 1

    # Kahn's topological sort
    queue = [nid for nid in node_ids if in_deg[nid] == 0]
    sorted_ids: List[str] = []
    while queue:
        nid = queue.pop(0)
        sorted_ids.append(nid)
        for nb in adj.get(nid, []):
            in_deg[nb] -= 1
            if in_deg[nb] == 0:
                queue.append(nb)
    # Append any remaining (cycles/disconnected)
    for nid in node_ids:
        if nid not in sorted_ids:
            sorted_ids.append(nid)

    # Assign layers via longest-path from sources
    layer: Dict[str, int] = {}
    for nid in node_ids:
        if in_deg.get(nid, 0) == 0 or all(
            e.get("target") != nid for e in edges if e.get("source") in id_set
        ):
            layer[nid] = _TYPE_LAYER_HINT.get(node_map[nid].get("type", ""), 0)
        else:
            layer[nid] = -1

    for nid in sorted_ids:
        cur = layer.get(nid, 0)
        for nb in adj.get(nid, []):
            layer[nb] = max(layer.get(nb, -1), cur + 1)

    # Fill any still-unassigned
    for nid in node_ids:
        if layer.get(nid, -1) < 0:
            layer[nid] = _TYPE_LAYER_HINT.get(node_map[nid].get("type", ""), 0)

    # Group by layer
    layer_groups: Dict[int, list] = {}
    for nid in node_ids:
        l = layer[nid]
        layer_groups.setdefault(l, []).append(nid)

    sorted_layers = sorted(layer_groups.keys())

    # Sort within each layer by type priority then label
    for l in sorted_layers:
        layer_groups[l].sort(key=lambda nid: (
            _TYPE_SORT_PRIORITY.get(node_map[nid].get("type", ""), 50),
            node_map[nid].get("data", {}).get("label", nid),
        ))

    # Compute positions
    max_group_size = max(len(g) for g in layer_groups.values())
    total_height = (max_group_size - 1) * _NODE_GAP_Y

    layer_index = {l: i for i, l in enumerate(sorted_layers)}

    for l in sorted_layers:
        group = layer_groups[l]
        col = layer_index[l]
        x = _ORIGIN_X + col * _LAYER_GAP_X
        group_height = (len(group) - 1) * _NODE_GAP_Y
        start_y = _ORIGIN_Y + (total_height - group_height) / 2

        for i, nid in enumerate(group):
            node_map[nid]["position"] = {"x": x, "y": start_y + i * _NODE_GAP_Y}

    # Return in topological order
    return [node_map[nid] for nid in sorted_ids]


def auto_fix_flow(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]]
) -> tuple:
    """
    Apply automatic fixes to a flow configuration.
    
    Returns: (fixed_nodes, fixed_edges, fixes_applied)
    """
    fixes = []
    
    # Ensure all nodes have required fields
    for i, node in enumerate(nodes):
        if "id" not in node or not node["id"]:
            node["id"] = f"node-{i}"
            fixes.append(f"Generated ID for node {i}")
        
        if "position" not in node:
            node["position"] = {"x": 100 + (i % 3) * 250, "y": 100 + (i // 3) * 150}
            fixes.append(f"Generated position for {node['id']}")
        
        if "data" not in node:
            node["data"] = {}
        
        if "label" not in node.get("data", {}):
            node_type = node.get("type", "node")
            node["data"]["label"] = f"{node_type.capitalize()} {i+1}"
            fixes.append(f"Generated label for {node['id']}")
        
        # Fix indicator defaults
        if node.get("type") == "indicator":
            data = node.get("data", {})
            if "params" not in data:
                data["params"] = {}
            
            ind_type = data.get("indicatorType", "")
            params = data["params"]
            
            # Set default periods
            if ind_type in ("sma", "ema", "dema", "tema", "rsi", "atr", "adx", "cci"):
                if "period" not in params or params["period"] < 1:
                    params["period"] = 14
                    fixes.append(f"Set default period=14 for {node['id']}")
            
            if ind_type == "macd":
                if "fastPeriod" not in params:
                    params["fastPeriod"] = 12
                if "slowPeriod" not in params:
                    params["slowPeriod"] = 26
                if "signalPeriod" not in params:
                    params["signalPeriod"] = 9
                    fixes.append(f"Set default MACD params for {node['id']}")
            
            if ind_type == "bb":
                if "period" not in params:
                    params["period"] = 20
                if "deviation" not in params:
                    params["deviation"] = 2
                    fixes.append(f"Set default BB params for {node['id']}")
            
            if ind_type == "stochastic":
                if "kPeriod" not in params:
                    params["kPeriod"] = 14
                if "dPeriod" not in params:
                    params["dPeriod"] = 3
                    fixes.append(f"Set default Stochastic params for {node['id']}")
        
        # Fix action defaults
        if node.get("type") == "action":
            data = node.get("data", {})
            if data.get("actionType") == "order":
                if "size" not in data or data["size"] <= 0:
                    data["size"] = 10
                    fixes.append(f"Set default size=10 for {node['id']}")
                if "direction" not in data:
                    data["direction"] = "buy"
                    fixes.append(f"Set default direction=buy for {node['id']}")
                if "broker" not in data:
                    data["broker"] = "paper"
                    fixes.append(f"Set default broker=paper for {node['id']}")
    
    # Ensure all edges reference valid nodes
    node_ids = {node["id"] for node in nodes}
    node_map = {node["id"]: node for node in nodes}
    valid_edges = []
    
    # Legacy handle ID mapping
    legacy_handle_map = {
        "inputA": "input-a",
        "inputB": "input-b",
        "input_a": "input-a",
        "input_b": "input-b",
    }
    
    # Source handle lookup: maps node type + subtype to valid source handles
    # Default single-output indicators use 'value', not 'output'
    multi_output_indicators = {
        "macd": ["line", "signal", "histogram"],
        "bb": ["upper", "middle", "lower"],
        "keltner": ["upper", "middle", "lower"],
        "donchian": ["upper", "middle", "lower"],
        "stochastic": ["main", "signal"],
        "ichimoku": ["tenkan", "kijun", "senkou_a", "senkou_b", "chikou"],
        "alligator": ["jaw", "teeth", "lips"],
        "dmi": ["plus_di", "minus_di", "adx"],
        "aroon": ["aroonup", "aroondown"],
    }
    
    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        
        if source in node_ids and target in node_ids:
            if "id" not in edge:
                edge["id"] = f"e-{source}-{target}"
            
            # Fix legacy handle IDs
            if edge.get("sourceHandle") in legacy_handle_map:
                old_handle = edge["sourceHandle"]
                edge["sourceHandle"] = legacy_handle_map[old_handle]
                fixes.append(f"Fixed legacy sourceHandle '{old_handle}' -> '{edge['sourceHandle']}' on edge {edge['id']}")
            if edge.get("targetHandle") in legacy_handle_map:
                old_handle = edge["targetHandle"]
                edge["targetHandle"] = legacy_handle_map[old_handle]
                fixes.append(f"Fixed legacy targetHandle '{old_handle}' -> '{edge['targetHandle']}' on edge {edge['id']}")
            
            # Fix sourceHandle for nodes where 'output' should be 'value'
            source_node = node_map.get(source, {})
            source_type = source_node.get("type", "")
            source_data = source_node.get("data", {})
            source_subtype = (
                source_data.get("indicatorType") or 
                source_data.get("environmentType") or
                source_data.get("conditionType") or
                source_data.get("actionType") or
                source_data.get("mathType") or
                source_data.get("triggerType") or ""
            )
            
            if source_type == "indicator":
                if source_subtype in multi_output_indicators:
                    valid_handles = multi_output_indicators[source_subtype]
                    if edge.get("sourceHandle") and edge["sourceHandle"] not in valid_handles:
                        edge["sourceHandle"] = valid_handles[0]
                        fixes.append(f"Fixed indicator sourceHandle to '{valid_handles[0]}' for {edge['id']}")
                else:
                    # Default indicator: should use 'value'
                    if edge.get("sourceHandle") == "output":
                        edge["sourceHandle"] = "value"
                        fixes.append(f"Fixed indicator sourceHandle 'output' -> 'value' for {edge['id']}")
            elif source_type == "environment":
                if edge.get("sourceHandle") == "output":
                    edge["sourceHandle"] = "value"
                    fixes.append(f"Fixed environment sourceHandle 'output' -> 'value' for {edge['id']}")
            elif source_type == "action":
                if edge.get("sourceHandle") == "output":
                    edge["sourceHandle"] = "next"
                    fixes.append(f"Fixed action sourceHandle 'output' -> 'next' for {edge['id']}")
            
            valid_edges.append(edge)
        else:
            fixes.append(f"Removed invalid edge: {source} -> {target}")

    # ── Topological layout pass ───────────────────────────────
    # Re-position nodes in a clean left-to-right DAG based on edges
    nodes = _topological_layout(nodes, valid_edges)
    fixes.append("Applied topological layout")

    return nodes, valid_edges, fixes


# ============================================================
# Chat About Strategy
# ============================================================

async def chat_about_strategy(
    message: str,
    current_nodes: Optional[List[Dict[str, Any]]] = None,
    current_edges: Optional[List[Dict[str, Any]]] = None,
    session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Answer questions about trading strategies without modifying the flow.
    
    Args:
        message: User's question
        current_nodes: Current strategy nodes for context
        current_edges: Current strategy edges for context
        session_id: Optional session ID for conversation continuity
    
    Returns:
        Dictionary with response text
    """
    # Build context
    context = ""
    if current_nodes:
        node_summary = []
        for node in current_nodes:
            node_type = node.get("type", "unknown")
            label = node.get("data", {}).get("label", node.get("id", ""))
            node_summary.append(f"- {label} ({node_type})")
        
        context = f"\n\nCurrent strategy has {len(current_nodes)} nodes:\n"
        context += "\n".join(node_summary)
    
    system_prompt = """You are a helpful trading strategy assistant. Answer questions about:
- Trading indicators (RSI, MACD, SMA, Bollinger Bands, etc.)
- Strategy concepts (entries, exits, risk management)
- The user's current strategy (if provided)
- How to use the Strategy Flow builder

Be concise and practical. Use markdown for formatting when helpful.
If discussing the current strategy, reference specific nodes by name."""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"{message}{context}"}
    ]
    
    try:
        response = await call_llm(messages, temperature=0.5)
        return {
            "response": response,
            "sessionId": session_id
        }
    except Exception as e:
        return {
            "response": f"Sorry, I encountered an error: {str(e)}",
            "sessionId": session_id
        }


# ============================================================
# Strategy Templates
# ============================================================

def get_strategy_template(template_id: str) -> Dict[str, Any]:
    """Get a pre-built strategy template."""
    templates = {
        "rsi_reversal": {
            "name": "RSI Reversal",
            "description": "Buy oversold, sell overbought",
            "nodes": [
                {
                    "id": "rsi-1",
                    "type": "indicator",
                    "position": {"x": 100, "y": 150},
                    "data": {
                        "label": "RSI(14)",
                        "indicatorType": "rsi",
                        "params": {"period": 14}
                    }
                },
                {
                    "id": "oversold",
                    "type": "condition",
                    "position": {"x": 350, "y": 100},
                    "data": {
                        "label": "RSI < 30",
                        "conditionType": "threshold",
                        "operator": "<",
                        "value": 30
                    }
                },
                {
                    "id": "overbought",
                    "type": "condition",
                    "position": {"x": 350, "y": 200},
                    "data": {
                        "label": "RSI > 70",
                        "conditionType": "threshold",
                        "operator": ">",
                        "value": 70
                    }
                },
                {
                    "id": "buy",
                    "type": "action",
                    "position": {"x": 600, "y": 100},
                    "data": {
                        "label": "Buy",
                        "actionType": "order",
                        "direction": "buy",
                        "size": 10,
                        "broker": "paper"
                    }
                },
                {
                    "id": "close",
                    "type": "action",
                    "position": {"x": 600, "y": 200},
                    "data": {
                        "label": "Close",
                        "actionType": "closePosition"
                    }
                }
            ],
            "edges": [
                {"id": "e1", "source": "rsi-1", "sourceHandle": "value", "target": "oversold", "targetHandle": "input-a"},
                {"id": "e2", "source": "rsi-1", "sourceHandle": "value", "target": "overbought", "targetHandle": "input-a"},
                {"id": "e3", "source": "oversold", "sourceHandle": "output", "target": "buy", "targetHandle": "trigger"},
                {"id": "e4", "source": "overbought", "sourceHandle": "output", "target": "close", "targetHandle": "trigger"}
            ]
        },
        "ma_crossover": {
            "name": "Moving Average Crossover",
            "description": "Buy when fast crosses above slow",
            "nodes": [
                {
                    "id": "ema-fast",
                    "type": "indicator",
                    "position": {"x": 100, "y": 100},
                    "data": {
                        "label": "EMA(12)",
                        "indicatorType": "ema",
                        "params": {"period": 12}
                    }
                },
                {
                    "id": "ema-slow",
                    "type": "indicator",
                    "position": {"x": 100, "y": 200},
                    "data": {
                        "label": "EMA(26)",
                        "indicatorType": "ema",
                        "params": {"period": 26}
                    }
                },
                {
                    "id": "crossover",
                    "type": "condition",
                    "position": {"x": 350, "y": 100},
                    "data": {
                        "label": "Golden Cross",
                        "conditionType": "crossover"
                    }
                },
                {
                    "id": "crossunder",
                    "type": "condition",
                    "position": {"x": 350, "y": 200},
                    "data": {
                        "label": "Death Cross",
                        "conditionType": "crossunder"
                    }
                },
                {
                    "id": "buy",
                    "type": "action",
                    "position": {"x": 600, "y": 100},
                    "data": {
                        "label": "Buy",
                        "actionType": "order",
                        "direction": "buy",
                        "size": 10,
                        "broker": "paper"
                    }
                },
                {
                    "id": "close",
                    "type": "action",
                    "position": {"x": 600, "y": 200},
                    "data": {
                        "label": "Close",
                        "actionType": "closePosition"
                    }
                }
            ],
            "edges": [
                {"id": "e1", "source": "ema-fast", "sourceHandle": "value", "target": "crossover", "targetHandle": "input-a"},
                {"id": "e2", "source": "ema-slow", "sourceHandle": "value", "target": "crossover", "targetHandle": "input-b"},
                {"id": "e3", "source": "ema-fast", "sourceHandle": "value", "target": "crossunder", "targetHandle": "input-a"},
                {"id": "e4", "source": "ema-slow", "sourceHandle": "value", "target": "crossunder", "targetHandle": "input-b"},
                {"id": "e5", "source": "crossover", "sourceHandle": "output", "target": "buy", "targetHandle": "trigger"},
                {"id": "e6", "source": "crossunder", "sourceHandle": "output", "target": "close", "targetHandle": "trigger"}
            ]
        }
    }
    
    return templates.get(template_id, {})
