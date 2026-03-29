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
    mode: str = "fast"
) -> Dict[str, Any]:
    """
    Generate a flow strategy from natural language.
    
    Args:
        prompt: User's strategy description
        current_nodes: Existing nodes (for modification)
        current_edges: Existing edges (for modification)
        mode: "fast", "slow" (includes validation), or "tool-calling" (function calling)
    
    Returns:
        Dictionary with nodes, edges, message, and metadata
    """
    # ── Tool-calling mode: use function calling instead of prompt-based ──
    if mode == "tool-calling":
        try:
            tc = _get_tool_calling()
            result = await tc.generate_with_tools(
                prompt=prompt,
                current_nodes=current_nodes,
                current_edges=current_edges,
            )
            # Apply auto-fixes on top of tool-calling result
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
                        "size": 10
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
                        "size": 10
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
