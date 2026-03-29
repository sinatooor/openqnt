"""
Tool/Function Calling Strategy Generator

Instead of asking the LLM to produce raw JSON, we define each node
operation as a "tool" the LLM can call. The LLM builds the strategy
step-by-step via tool calls:

  1. add_indicator(...)
  2. add_condition(...)
  3. add_action(...)
  4. connect_nodes(source, target, ...)
  5. set_layout(...)

This approach is:
  - Type-safe: each tool has a strict schema
  - Validated: invalid calls are rejected immediately
  - Incremental: LLM builds the strategy piece by piece
  - Reliable: no need to parse freeform JSON

Works with Gemini's function calling and OpenAI-compatible APIs.
"""

import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple
from copy import deepcopy


# ============================================================
# Tool Definitions  
# ============================================================

# These map to Gemini's function declaration format.
# The LLM will call these tools to build the strategy.

STRATEGY_TOOLS = [
    {
        "name": "add_indicator",
        "description": "Add a technical indicator node to the strategy canvas. Use this to add SMA, EMA, RSI, MACD, Bollinger Bands, and other indicators.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Unique identifier for this node (e.g., 'sma-fast', 'rsi-1')"
                },
                "label": {
                    "type": "string",
                    "description": "Display label (e.g., 'SMA(10)', 'RSI(14)')"
                },
                "indicatorType": {
                    "type": "string",
                    "enum": ["sma", "ema", "dema", "tema", "rsi", "stochastic", "cci", "mfi",
                             "macd", "adx", "sar", "bb", "keltner", "atr", "obv", "vwap"],
                    "description": "The type of technical indicator"
                },
                "timeframe": {
                    "type": "string",
                    "enum": ["1", "5", "15", "30", "60", "240", "1440"],
                    "description": "Candle timeframe in minutes. Default: '60'"
                },
                "params": {
                    "type": "object",
                    "description": "Indicator-specific parameters (e.g., {period: 14} for RSI, {fastPeriod: 12, slowPeriod: 26, signalPeriod: 9} for MACD)",
                    "properties": {
                        "period": {"type": "number"},
                        "priceType": {"type": "string", "enum": ["open", "high", "low", "close"]},
                        "fastPeriod": {"type": "number"},
                        "slowPeriod": {"type": "number"},
                        "signalPeriod": {"type": "number"},
                        "kPeriod": {"type": "number"},
                        "dPeriod": {"type": "number"},
                        "slowing": {"type": "number"},
                        "deviation": {"type": "number"},
                        "multiplier": {"type": "number"},
                        "band": {"type": "string", "enum": ["upper", "middle", "lower"]},
                        "step": {"type": "number"},
                        "max": {"type": "number"},
                    }
                },
            },
            "required": ["id", "label", "indicatorType"]
        }
    },
    {
        "name": "add_condition",
        "description": "Add a condition/logic node. Use for comparisons, crossovers, thresholds, and boolean logic (AND/OR/NOT).",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Unique identifier (e.g., 'oversold', 'cross-1')"
                },
                "label": {
                    "type": "string",
                    "description": "Display label (e.g., 'RSI < 30', 'Golden Cross')"
                },
                "conditionType": {
                    "type": "string",
                    "enum": ["compare", "crossover", "crossunder", "threshold", "range", "and", "or", "not"],
                    "description": "Type of condition"
                },
                "operator": {
                    "type": "string",
                    "enum": [">", "<", ">=", "<=", "==", "!="],
                    "description": "Comparison operator (for compare/threshold types)"
                },
                "value": {
                    "type": "number",
                    "description": "Threshold value (for threshold type)"
                },
                "minValue": {
                    "type": "number",
                    "description": "Minimum value (for range type)"
                },
                "maxValue": {
                    "type": "number",
                    "description": "Maximum value (for range type)"
                },
            },
            "required": ["id", "label", "conditionType"]
        }
    },
    {
        "name": "add_action",
        "description": "Add a trading action node. Use for placing orders, closing positions, setting stops, and notifications.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Unique identifier (e.g., 'buy-order', 'stop-loss')"
                },
                "label": {
                    "type": "string",
                    "description": "Display label (e.g., 'Buy Market', 'Stop Loss 2%')"
                },
                "actionType": {
                    "type": "string",
                    "enum": ["order", "closePosition", "closeAll", "stopLoss", "takeProfit",
                             "trailingStop", "notification", "log"],
                    "description": "Type of action"
                },
                "direction": {
                    "type": "string",
                    "enum": ["long", "short"],
                    "description": "Trade direction (for order type)"
                },
                "orderType": {
                    "type": "string",
                    "enum": ["market", "limit", "stop"],
                    "description": "Order type (for order type)"
                },
                "size": {
                    "type": "number",
                    "description": "Position size"
                },
                "sizeType": {
                    "type": "string",
                    "enum": ["lots", "percent"],
                    "description": "Size unit"
                },
                "stopPrice": {"type": "number", "description": "Stop loss price level"},
                "takeProfitPrice": {"type": "number", "description": "Take profit price level"},
                "trailingDistance": {"type": "number", "description": "Trailing stop distance"},
                "message": {"type": "string", "description": "Notification/log message"},
                "channel": {
                    "type": "string",
                    "enum": ["telegram", "discord", "email"],
                    "description": "Notification channel"
                },
            },
            "required": ["id", "label", "actionType"]
        }
    },
    {
        "name": "add_environment",
        "description": "Add an environment/market data node. Use for current price, spread, time, previous candle data.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Unique identifier"},
                "label": {"type": "string", "description": "Display label"},
                "environmentType": {
                    "type": "string",
                    "enum": ["price", "spread", "prevCandleOpen", "prevCandleClose",
                             "time", "dayOfWeek", "newCandleOpen", "isMarketOpen"],
                    "description": "Type of environment data"
                },
                "priceType": {
                    "type": "string",
                    "enum": ["bid", "ask", "mid"],
                    "description": "Price type (for price node)"
                },
                "shift": {"type": "number", "description": "Candle lookback offset"},
            },
            "required": ["id", "label", "environmentType"]
        }
    },
    {
        "name": "add_control",
        "description": "Add a control flow node. Use for if/else branching, loops, waits, and strategy stops.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Unique identifier"},
                "label": {"type": "string", "description": "Display label"},
                "controlType": {
                    "type": "string",
                    "enum": ["if", "ifElse", "repeat", "wait", "waitUntil", "stop"],
                    "description": "Type of control flow"
                },
                "repeatCount": {"type": "number", "description": "Number of repetitions (for repeat)"},
                "waitSeconds": {"type": "number", "description": "Wait duration in seconds (for wait)"},
            },
            "required": ["id", "label", "controlType"]
        }
    },
    {
        "name": "add_variable",
        "description": "Add a variable node. Use to store, retrieve, or modify state values between ticks.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Unique identifier"},
                "label": {"type": "string", "description": "Display label"},
                "variableType": {
                    "type": "string",
                    "enum": ["setVariable", "getVariable", "changeVariable", "number"],
                    "description": "Type of variable operation"
                },
                "variableName": {"type": "string", "description": "Variable name to store/retrieve"},
                "value": {"type": "number", "description": "Value to set or constant number"},
            },
            "required": ["id", "label", "variableType"]
        }
    },
    {
        "name": "add_math",
        "description": "Add a math operation node. Use for arithmetic (+, -, ×, ÷) and advanced math functions.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Unique identifier"},
                "label": {"type": "string", "description": "Display label"},
                "mathType": {
                    "type": "string",
                    "enum": ["number", "add", "subtract", "multiply", "divide", "advancedMath"],
                    "description": "Type of math operation"
                },
                "value": {"type": "number", "description": "Constant value (for number type)"},
                "mathFunction": {
                    "type": "string",
                    "enum": ["sqrt", "abs", "sin", "cos", "log", "exp"],
                    "description": "Math function (for advancedMath type)"
                },
            },
            "required": ["id", "label", "mathType"]
        }
    },
    {
        "name": "add_risk",
        "description": "Add a risk management node. Use for drawdown limits, position sizing, and stop strategies.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Unique identifier"},
                "label": {"type": "string", "description": "Display label"},
                "riskType": {
                    "type": "string",
                    "enum": ["maxDrawdown", "dailyLossLimit", "positionPercent", "kellyCriterion", "trailingStop"],
                    "description": "Type of risk management"
                },
                "value": {"type": "number", "description": "Risk parameter value (%, distance, etc.)"},
                "percentage": {"type": "number", "description": "Position size percentage (for positionPercent)"},
            },
            "required": ["id", "label", "riskType"]
        }
    },
    {
        "name": "add_trade_info",
        "description": "Add a trade info node. Use to access entry price, position size, PnL, or duration of current trade.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Unique identifier"},
                "label": {"type": "string", "description": "Display label"},
                "tradeInfoType": {
                    "type": "string",
                    "enum": ["entryPrice", "positionSize", "pnl", "tradeDuration"],
                    "description": "Type of trade info"
                },
            },
            "required": ["id", "label", "tradeInfoType"]
        }
    },
    {
        "name": "add_llm",
        "description": "Add an AI/LLM-powered analysis node. Use for sentiment analysis, regime detection, or AI-driven decisions.",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Unique identifier"},
                "label": {"type": "string", "description": "Display label"},
                "llmType": {
                    "type": "string",
                    "enum": ["llmDecision", "sentimentAnalysis", "regimeDetection", "nlStrategyRules"],
                    "description": "Type of LLM analysis"
                },
                "prompt": {"type": "string", "description": "Prompt for the LLM"},
                "model": {"type": "string", "description": "Model to use (e.g., 'gpt-4o-mini')"},
                "temperature": {"type": "number", "description": "LLM temperature (0-1)"},
            },
            "required": ["id", "label", "llmType"]
        }
    },
    {
        "name": "connect_nodes",
        "description": "Connect two nodes with an edge. ALWAYS call this after adding nodes to wire them together logically.",
        "parameters": {
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "description": "ID of the source node (output)"
                },
                "target": {
                    "type": "string",
                    "description": "ID of the target node (input)"
                },
                "sourceHandle": {
                    "type": "string",
                    "description": "Output handle name (optional, e.g., 'value', 'signal', 'then', 'else')"
                },
                "targetHandle": {
                    "type": "string",
                    "description": "Input handle name (optional, e.g., 'input-a', 'input-b', 'trigger')"
                },
            },
            "required": ["source", "target"]
        }
    },
    {
        "name": "finish_strategy",
        "description": "Call this LAST when the strategy is complete. Provide a summary message.",
        "parameters": {
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "Brief human-readable summary of the strategy (e.g., 'RSI oversold reversal with EMA filter')"
                }
            },
            "required": ["message"]
        }
    },
]


# ============================================================
# Tool -> Node Type Mapping
# ============================================================

TOOL_TO_NODE_TYPE = {
    "add_indicator": "indicator",
    "add_condition": "condition",
    "add_action": "action",
    "add_environment": "environment",
    "add_control": "control",
    "add_variable": "variable",
    "add_math": "math",
    "add_risk": "risk",
    "add_trade_info": "tradeInfo",
    "add_llm": "llm",
}

# Fields that go into `data` (everything except id, label, position)
POSITION_FIELDS = {"id", "label"}


# ============================================================
# Tool Executor — process tool calls into nodes/edges
# ============================================================

class StrategyBuilder:
    """
    Processes LLM tool calls and builds a strategy incrementally.
    Tracks nodes, edges, and handles auto-layout.
    """

    def __init__(self):
        self.nodes: List[Dict[str, Any]] = []
        self.edges: List[Dict[str, Any]] = []
        self.message: str = ""
        self.node_ids: set = set()
        self._position_counter: Dict[str, int] = {}
        self.errors: List[str] = []

    def execute_tool_call(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single tool call and return result."""
        if tool_name == "connect_nodes":
            return self._connect_nodes(args)
        elif tool_name == "finish_strategy":
            return self._finish(args)
        elif tool_name in TOOL_TO_NODE_TYPE:
            return self._add_node(tool_name, args)
        else:
            self.errors.append(f"Unknown tool: {tool_name}")
            return {"error": f"Unknown tool: {tool_name}"}

    def _add_node(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Add a node from a tool call."""
        node_type = TOOL_TO_NODE_TYPE[tool_name]
        node_id = args.get("id", f"{node_type}-{len(self.nodes) + 1}")
        label = args.get("label", node_id)

        # Auto-detect duplicate IDs
        if node_id in self.node_ids:
            original = node_id
            node_id = f"{node_id}-{len(self.nodes) + 1}"
            self.errors.append(f"Duplicate ID '{original}', renamed to '{node_id}'")

        self.node_ids.add(node_id)

        # Auto-layout: assign positions based on node type
        position = self._auto_position(node_type)

        # Build data dict from remaining args
        data = {"label": label}
        for key, value in args.items():
            if key not in POSITION_FIELDS:
                data[key] = value

        node = {
            "id": node_id,
            "type": node_type,
            "position": position,
            "data": data,
        }

        self.nodes.append(node)
        return {"success": True, "nodeId": node_id}

    def _connect_nodes(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Connect two nodes with an edge."""
        source = args.get("source", "")
        target = args.get("target", "")

        if source not in self.node_ids:
            self.errors.append(f"Edge source '{source}' not found")
            return {"error": f"Source node '{source}' does not exist"}

        if target not in self.node_ids:
            self.errors.append(f"Edge target '{target}' not found")
            return {"error": f"Target node '{target}' does not exist"}

        edge = {
            "id": f"e-{source}-{target}",
            "source": source,
            "target": target,
        }

        if args.get("sourceHandle"):
            edge["sourceHandle"] = args["sourceHandle"]
        if args.get("targetHandle"):
            edge["targetHandle"] = args["targetHandle"]

        self.edges.append(edge)
        return {"success": True, "edgeId": edge["id"]}

    def _finish(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Finalize the strategy."""
        self.message = args.get("message", f"Strategy with {len(self.nodes)} nodes")
        return {"success": True, "message": self.message}

    def _auto_position(self, node_type: str) -> Dict[str, float]:
        """Auto-assign position based on node type category."""
        # X position by type (left-to-right flow)
        x_map = {
            "environment": 100,
            "indicator": 100,
            "math": 300,
            "variable": 300,
            "tradeInfo": 300,
            "condition": 500,
            "control": 650,
            "risk": 650,
            "action": 800,
            "llm": 100,
        }
        x = x_map.get(node_type, 400)

        # Y position: increment per type
        count = self._position_counter.get(node_type, 0)
        self._position_counter[node_type] = count + 1
        y = 80 + count * 140

        return {"x": x, "y": y}

    def get_result(self) -> Dict[str, Any]:
        """Get the final strategy result."""
        return {
            "success": len(self.nodes) > 0,
            "nodes": self.nodes,
            "edges": self.edges,
            "message": self.message or f"Generated strategy with {len(self.nodes)} nodes",
            "errors": self.errors,
            "toolCalls": len(self.nodes) + len(self.edges),
        }


# ============================================================
# Gemini Function Calling  
# ============================================================

def _build_gemini_tools() -> List[Dict[str, Any]]:
    """Convert our tool definitions to Gemini's function declaration format."""
    declarations = []
    for tool in STRATEGY_TOOLS:
        decl = {
            "name": tool["name"],
            "description": tool["description"],
            "parameters": _clean_schema_for_gemini(tool["parameters"]),
        }
        declarations.append(decl)
    return [{"functionDeclarations": declarations}]


def _clean_schema_for_gemini(schema: Dict[str, Any]) -> Dict[str, Any]:
    """
    Clean JSON Schema for Gemini compatibility.
    Gemini doesn't support all JSON Schema features.
    """
    cleaned = {}
    for key, value in schema.items():
        if key == "enum":
            # Gemini uses "enum" directly on STRING type
            cleaned["enum"] = value
        elif key == "properties":
            cleaned["properties"] = {
                k: _clean_schema_for_gemini(v)
                for k, v in value.items()
            }
        elif isinstance(value, dict):
            cleaned[key] = _clean_schema_for_gemini(value)
        else:
            cleaned[key] = value
    return cleaned


TOOL_CALLING_SYSTEM_PROMPT = """You are an expert trading strategy builder. Build strategies by calling the provided tools.

INSTRUCTIONS:
1. Analyze the user's strategy description
2. Call add_indicator, add_condition, add_action, etc. to create nodes
3. Call connect_nodes to wire them together logically
4. Call finish_strategy with a summary message when done

IMPORTANT RULES:
- Create nodes FIRST, then connect them with connect_nodes
- Always include entry AND exit conditions
- Always include risk management (stopLoss or risk nodes)
- Use descriptive IDs and labels
- Connect indicators → conditions → actions in logical flow
- For crossovers: connect both inputs to the crossover condition

Think step by step about what nodes are needed, then build the strategy."""


async def generate_with_tool_calling(
    prompt: str,
    current_nodes: Optional[List[Dict[str, Any]]] = None,
    current_edges: Optional[List[Dict[str, Any]]] = None,
    max_turns: int = 10,
) -> Dict[str, Any]:
    """
    Generate a strategy using Gemini's function calling.
    
    The LLM calls tools to build the strategy step-by-step,
    with each tool call validated and executed immediately.
    
    Args:
        prompt: User's strategy description
        current_nodes: Existing nodes (for modification)
        current_edges: Existing edges (for modification)
        max_turns: Maximum number of LLM turns to prevent infinite loops
        
    Returns:
        Dictionary with nodes, edges, message, and metadata
    """
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not configured")

    builder = StrategyBuilder()
    
    # If modifying existing strategy, pre-populate
    if current_nodes:
        for node in current_nodes:
            builder.nodes.append(node)
            builder.node_ids.add(node["id"])
        if current_edges:
            builder.edges = list(current_edges)

    # Build context
    context = ""
    if current_nodes:
        context = f"\n\nExisting strategy has {len(current_nodes)} nodes. Modify or extend it."

    # Initial message
    contents = [
        {
            "role": "user",
            "parts": [{"text": f"{prompt}{context}"}]
        }
    ]

    import httpx

    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    tools_payload = _build_gemini_tools()

    async with httpx.AsyncClient(timeout=120.0) as client:
        for turn in range(max_turns):
            payload = {
                "contents": contents,
                "tools": tools_payload,
                "systemInstruction": {
                    "parts": [{"text": TOOL_CALLING_SYSTEM_PROMPT}]
                },
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 8192,
                },
                "toolConfig": {
                    "functionCallingConfig": {
                        "mode": "AUTO"
                    }
                }
            }

            response = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                params={"key": api_key},
                json=payload,
            )

            if response.status_code != 200:
                error_text = response.text[:500]
                raise ValueError(f"Gemini API error {response.status_code}: {error_text}")

            data = response.json()
            candidates = data.get("candidates", [])
            if not candidates:
                break

            candidate = candidates[0]
            content = candidate.get("content", {})
            parts = content.get("parts", [])

            if not parts:
                break

            # Check for function calls
            function_calls = [p for p in parts if "functionCall" in p]
            
            if not function_calls:
                # LLM returned text (maybe summary) — check if it also called finish
                text_parts = [p.get("text", "") for p in parts if "text" in p]
                if text_parts and not builder.message:
                    builder.message = text_parts[0][:200]
                break

            # Add model's response to conversation
            contents.append({"role": "model", "parts": parts})

            # Execute each function call
            function_responses = []
            finished = False

            for part in function_calls:
                fc = part["functionCall"]
                tool_name = fc["name"]
                tool_args = fc.get("args", {})

                # Execute the tool
                result = builder.execute_tool_call(tool_name, tool_args)
                
                function_responses.append({
                    "functionResponse": {
                        "name": tool_name,
                        "response": result,
                    }
                })

                if tool_name == "finish_strategy":
                    finished = True

            # Add tool responses to conversation
            contents.append({"role": "user", "parts": function_responses})

            if finished:
                break

    return builder.get_result()


# ============================================================
# DeepSeek / OpenAI-compatible fallback (non-streaming tools)
# ============================================================

def _build_openai_tools() -> List[Dict[str, Any]]:
    """Convert our tool definitions to OpenAI function calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["parameters"],
            }
        }
        for tool in STRATEGY_TOOLS
    ]


async def generate_with_tool_calling_openai(
    prompt: str,
    current_nodes: Optional[List[Dict[str, Any]]] = None,
    current_edges: Optional[List[Dict[str, Any]]] = None,
    max_turns: int = 10,
) -> Dict[str, Any]:
    """
    Generate a strategy using OpenAI-compatible function calling.
    Works with DeepSeek, OpenAI, etc.
    """
    api_key = os.getenv("DEEPSEEK_API_KEY")
    api_url = "https://api.deepseek.com/chat/completions"
    model = "deepseek-chat"
    
    if not api_key:
        # Try OpenAI
        api_key = os.getenv("OPENAI_API_KEY")
        api_url = "https://api.openai.com/v1/chat/completions"
        model = "gpt-4o-mini"
    
    if not api_key:
        raise ValueError("No API key configured for tool calling fallback")

    builder = StrategyBuilder()
    
    if current_nodes:
        for node in current_nodes:
            builder.nodes.append(node)
            builder.node_ids.add(node["id"])
        if current_edges:
            builder.edges = list(current_edges)

    context = ""
    if current_nodes:
        context = f"\n\nExisting strategy has {len(current_nodes)} nodes. Modify or extend it."

    messages = [
        {"role": "system", "content": TOOL_CALLING_SYSTEM_PROMPT},
        {"role": "user", "content": f"{prompt}{context}"},
    ]

    import httpx

    tools = _build_openai_tools()

    async with httpx.AsyncClient(timeout=180.0) as client:
        for turn in range(max_turns):
            payload = {
                "model": model,
                "messages": messages,
                "tools": tools,
                "tool_choice": "auto",
                "temperature": 0.2,
                "max_tokens": 8000,
            }

            response = await client.post(
                api_url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

            if response.status_code != 200:
                raise ValueError(f"API error {response.status_code}: {response.text[:500]}")

            data = response.json()
            choice = data["choices"][0]
            message = choice["message"]

            # Add assistant message to history
            messages.append(message)

            tool_calls = message.get("tool_calls", [])
            if not tool_calls:
                # No more tool calls — done
                if message.get("content") and not builder.message:
                    builder.message = message["content"][:200]
                break

            # Execute tool calls
            finished = False
            for tc in tool_calls:
                tool_name = tc["function"]["name"]
                try:
                    tool_args = json.loads(tc["function"]["arguments"])
                except json.JSONDecodeError:
                    tool_args = {}

                result = builder.execute_tool_call(tool_name, tool_args)

                # Add tool response
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(result),
                })

                if tool_name == "finish_strategy":
                    finished = True

            if finished:
                break

    return builder.get_result()


# ============================================================
# Unified entry point with fallback
# ============================================================

async def generate_with_tools(
    prompt: str,
    current_nodes: Optional[List[Dict[str, Any]]] = None,
    current_edges: Optional[List[Dict[str, Any]]] = None,
    max_turns: int = 10,
) -> Dict[str, Any]:
    """
    Generate strategy using tool/function calling with automatic fallback.
    Tries Gemini first, falls back to DeepSeek/OpenAI.
    """
    # Try Gemini first
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if gemini_key:
        try:
            return await generate_with_tool_calling(
                prompt, current_nodes, current_edges, max_turns
            )
        except Exception as e:
            print(f"[tool-calling] Gemini failed, trying fallback: {e}")

    # Fallback to DeepSeek/OpenAI
    try:
        return await generate_with_tool_calling_openai(
            prompt, current_nodes, current_edges, max_turns
        )
    except Exception as e:
        return {
            "success": False,
            "nodes": [],
            "edges": [],
            "message": f"Tool calling generation failed: {str(e)}",
            "errors": [str(e)],
            "toolCalls": 0,
        }
