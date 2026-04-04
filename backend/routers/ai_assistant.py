"""
Global AI Assistant Router
Full-featured AI chat with Gemini function-calling and SSE streaming.
This powers the /ai-chat page — the single global AI interface for the entire app.

Tools available to the AI:
- build_strategy: Generate a trading strategy as flow nodes
- run_backtest: Run a backtest on a strategy
- run_monte_carlo: Run Monte Carlo permutation test
- navigate_to_page: Navigate user to a specific app page
- get_portfolio_summary: Get portfolio overview
- list_user_strategies: List user's saved strategies
- get_execution_history: Get recent execution runs
- get_market_news: Get latest market news
- analyze_strategy: Run AI analysis on a strategy
- explain_trading_concept: Explain a trading/finance concept
"""

import os
import json
import asyncio
import traceback
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from datetime import datetime

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

router = APIRouter(prefix="/api/ai-assistant", tags=["ai-assistant"])

# ============================================================
# Models
# ============================================================

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class AssistantChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = Field(default_factory=list)
    context: Optional[Dict[str, Any]] = None  # e.g. current page, selected strategy

# ============================================================
# Tool Definitions for Gemini Function Calling
# ============================================================

TOOL_DEFINITIONS = [
    {
        "name": "build_strategy",
        "description": "Build a trading strategy by generating flow nodes and edges for the visual strategy builder. Use this when the user wants to create, design, or build a trading strategy. The strategy will be displayed incrementally as nodes on the canvas.",
        "parameters": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Natural language description of the strategy to build, e.g. 'RSI oversold buy strategy with 14 period RSI, buy when RSI < 30, sell when RSI > 70'"
                },
                "mode": {
                    "type": "string",
                    "enum": ["fast", "slow", "tool-calling"],
                    "description": "Generation speed: fast for quick generation, slow for more precise, tool-calling for step-by-step"
                }
            },
            "required": ["description"]
        }
    },
    {
        "name": "run_backtest",
        "description": "Run a backtest on a trading strategy using historical market data. Use when the user wants to test a strategy's historical performance.",
        "parameters": {
            "type": "object",
            "properties": {
                "strategy_description": {
                    "type": "string",
                    "description": "Description of the strategy to backtest"
                },
                "symbol": {
                    "type": "string",
                    "description": "Trading symbol, e.g. 'AAPL', 'EURUSD', 'SPY'"
                },
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format"
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format"
                },
                "initial_cash": {
                    "type": "number",
                    "description": "Initial portfolio cash, default 100000"
                }
            },
            "required": ["strategy_description", "symbol"]
        }
    },
    {
        "name": "run_monte_carlo",
        "description": "Run a Monte Carlo Permutation Test (MCPT) to assess whether a strategy's performance is statistically significant or could be due to random chance. Use when the user asks about Monte Carlo analysis, statistical significance, or strategy validation.",
        "parameters": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Trading symbol to test on"
                },
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format"
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format"
                },
                "timeframe": {
                    "type": "string",
                    "description": "Data timeframe: '1d', '1h', '4h', etc.",
                    "enum": ["1m", "5m", "15m", "1h", "4h", "1d"]
                },
                "permutations": {
                    "type": "integer",
                    "description": "Number of permutations to run (default 100)"
                }
            },
            "required": ["symbol", "start_date", "end_date"]
        }
    },
    {
        "name": "navigate_to_page",
        "description": "Navigate the user to a specific page in the application. Use when the user wants to go to a particular section.",
        "parameters": {
            "type": "object",
            "properties": {
                "page": {
                    "type": "string",
                    "enum": ["dashboard", "builder", "portfolio", "executions", "research", "news", "terminal", "agents", "settings"],
                    "description": "The page to navigate to"
                },
                "reason": {
                    "type": "string",
                    "description": "Brief reason for the navigation suggestion"
                }
            },
            "required": ["page"]
        }
    },
    {
        "name": "get_portfolio_summary",
        "description": "Get the user's portfolio summary including holdings, total value, and performance metrics. Use when the user asks about their portfolio, positions, or holdings.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "list_user_strategies",
        "description": "List the user's saved trading strategies. Use when the user asks about their strategies or wants to see what they've built.",
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Max number of strategies to return"
                }
            },
            "required": []
        }
    },
    {
        "name": "get_execution_history",
        "description": "Get recent strategy execution history including backtests and live trading runs. Use when the user asks about past performance or execution results.",
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Max number of executions to return"
                }
            },
            "required": []
        }
    },
    {
        "name": "get_market_news",
        "description": "Get latest market news and data events. Use when the user asks about market news, events, or what's happening in the markets.",
        "parameters": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Optional symbol to filter news for"
                },
                "limit": {
                    "type": "integer",
                    "description": "Max number of news items to return"
                }
            },
            "required": []
        }
    },
    {
        "name": "analyze_strategy",
        "description": "Run AI-powered analysis on a trading strategy to get insights, risk assessment, and optimization suggestions.",
        "parameters": {
            "type": "object",
            "properties": {
                "strategy_name": {
                    "type": "string",
                    "description": "Name of the strategy to analyze"
                },
                "analysis_type": {
                    "type": "string",
                    "enum": ["risk", "optimization", "comparison", "general"],
                    "description": "Type of analysis to perform"
                }
            },
            "required": ["strategy_name"]
        }
    },
    {
        "name": "explain_trading_concept",
        "description": "Explain a trading or financial concept in detail. Use for educational questions about indicators, strategies, risk management, market mechanics, etc.",
        "parameters": {
            "type": "object",
            "properties": {
                "concept": {
                    "type": "string",
                    "description": "The concept to explain, e.g. 'RSI divergence', 'Kelly criterion', 'Sharpe ratio'"
                },
                "depth": {
                    "type": "string",
                    "enum": ["beginner", "intermediate", "advanced"],
                    "description": "Level of detail"
                }
            },
            "required": ["concept"]
        }
    }
]

# ============================================================
# System Prompt
# ============================================================

SYSTEM_PROMPT = """You are the AI assistant for Fyer, a professional trading strategy platform. You help users with everything in the app:

**Your Capabilities:**
1. **Build Strategies** - You can generate visual trading strategies using flow nodes. When a user asks you to build a strategy, use the `build_strategy` tool. The strategy will appear as nodes on the visual canvas.
2. **Run Backtests** - Test strategies on historical data to see how they would have performed.
3. **Monte Carlo Analysis** - Run statistical tests to validate strategy robustness.
4. **Portfolio Management** - View and analyze portfolio holdings and performance.
5. **Market Research** - Access market news, data events, and analysis tools.
6. **Navigation** - Guide users to the right part of the app for their task.
7. **Education** - Explain trading concepts, indicators, risk management, etc.

**How you work:**
- When building strategies, you call tools and the user sees the strategy being built incrementally on the canvas — like a stream of nodes appearing.
- You are proactive: if the user's request involves multiple steps, explain what you'll do, then do it.
- You adapt your answers based on context (what page the user is on, what strategies they have, etc.)
- Keep responses conversational but professional. Use markdown for formatting.
- If a tool call fails, explain what happened and suggest alternatives.

**Platform Features the user might ask about:**
- Strategy Builder: Visual node-based editor for trading strategies (RSI, SMA, EMA, MACD, Bollinger Bands, etc.)
- Backtesting: Test strategies on historical OHLCV data
- Live Trading: Deploy strategies to brokers (Alpaca, IBKR, Nordnet, IG)
- Portfolio Tracking: Monitor positions and P&L
- Monte Carlo Permutation Test: Statistical validation of strategies
- Risk Management: Position sizing, stop-loss, take-profit nodes
- Code Export: Export strategies to Pine Script, Python, MQL5, Nautilus

**Important:** Always be helpful and guide the user. If they seem lost, suggest what they can do. If they ask something outside your tools, still answer from your knowledge."""

# ============================================================
# Tool Execution
# ============================================================

BACKEND_URL = os.getenv("BACKEND_SELF_URL", "http://localhost:8000")
ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://localhost:3000")

async def execute_tool(tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a tool call and return the result."""
    import httpx

    try:
        if tool_name == "build_strategy":
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{BACKEND_URL}/api/strategy-flow/generate",
                    json={
                        "message": args.get("description", ""),
                        "currentNodes": None,
                        "currentEdges": None,
                        "mode": args.get("mode", "fast"),
                    }
                )
                data = resp.json()
                if data.get("success") and data.get("nodes"):
                    return {
                        "success": True,
                        "nodes": data["nodes"],
                        "edges": data.get("edges", []),
                        "node_count": len(data["nodes"]),
                        "message": data.get("message", f"Generated {len(data['nodes'])} nodes"),
                    }
                return {"success": False, "error": data.get("errors", ["Generation failed"])}

        elif tool_name == "run_backtest":
            # First generate strategy, then backtest
            return {
                "success": True,
                "action": "open_backtest_modal",
                "symbol": args.get("symbol", "SPY"),
                "start_date": args.get("start_date", "2024-01-01"),
                "end_date": args.get("end_date", "2024-12-31"),
                "initial_cash": args.get("initial_cash", 100000),
                "message": f"Ready to backtest on {args.get('symbol', 'SPY')}. I'll open the backtest panel for you."
            }

        elif tool_name == "run_monte_carlo":
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{BACKEND_URL}/api/mcpt/run",
                    json={
                        "symbol": args.get("symbol"),
                        "startDate": args.get("start_date"),
                        "endDate": args.get("end_date"),
                        "timeframe": args.get("timeframe", "1d"),
                        "permutations": args.get("permutations", 100),
                    }
                )
                data = resp.json()
                return {
                    "success": data.get("success", False),
                    "p_value": data.get("pValue"),
                    "real_profit_factor": data.get("realPf"),
                    "permuted_profit_factors": data.get("permutedPfs", [])[:10],  # Only send first 10
                    "plot_image": data.get("plotImage"),
                    "message": f"Monte Carlo test complete. p-value: {data.get('pValue', 'N/A')}"
                }

        elif tool_name == "navigate_to_page":
            page_routes = {
                "dashboard": "/dashboard",
                "builder": "/",
                "portfolio": "/portfolio",
                "executions": "/executions",
                "research": "/research",
                "news": "/news",
                "terminal": "/terminal",
                "agents": "/agents",
                "settings": "/settings",
            }
            page = args.get("page", "dashboard")
            return {
                "success": True,
                "action": "navigate",
                "route": page_routes.get(page, "/dashboard"),
                "page": page,
                "reason": args.get("reason", ""),
            }

        elif tool_name == "get_portfolio_summary":
            # Call orchestrator for portfolio data
            async with httpx.AsyncClient(timeout=15.0) as client:
                try:
                    resp = await client.get(f"{ORCHESTRATOR_URL}/api/portfolio")
                    data = resp.json()
                    return {"success": True, "portfolio": data}
                except Exception:
                    return {"success": True, "portfolio": {"message": "Portfolio data unavailable. Navigate to the Portfolio page to see your holdings."}, "action": "navigate", "route": "/portfolio"}

        elif tool_name == "list_user_strategies":
            async with httpx.AsyncClient(timeout=15.0) as client:
                try:
                    resp = await client.get(f"{ORCHESTRATOR_URL}/api/strategies")
                    data = resp.json()
                    strategies = data.get("strategies", data) if isinstance(data, dict) else data
                    return {"success": True, "strategies": strategies[:args.get("limit", 10)] if isinstance(strategies, list) else strategies}
                except Exception:
                    return {"success": False, "message": "Could not fetch strategies. The orchestrator service may be offline."}

        elif tool_name == "get_execution_history":
            async with httpx.AsyncClient(timeout=15.0) as client:
                try:
                    resp = await client.get(f"{ORCHESTRATOR_URL}/api/executions", params={"page": "1"})
                    data = resp.json()
                    return {"success": True, "executions": data}
                except Exception:
                    return {"success": False, "message": "Could not fetch execution history."}

        elif tool_name == "get_market_news":
            async with httpx.AsyncClient(timeout=15.0) as client:
                try:
                    params = {}
                    if args.get("symbol"):
                        params["symbol"] = args["symbol"]
                    params["limit"] = str(args.get("limit", 10))
                    resp = await client.get(f"{ORCHESTRATOR_URL}/api/data-events", params=params)
                    data = resp.json()
                    return {"success": True, "news": data}
                except Exception:
                    return {"success": False, "message": "Could not fetch market news."}

        elif tool_name == "analyze_strategy":
            return {
                "success": True,
                "action": "analyze",
                "strategy_name": args.get("strategy_name"),
                "analysis_type": args.get("analysis_type", "general"),
                "message": f"Analysis requested for '{args.get('strategy_name')}'."
            }

        elif tool_name == "explain_trading_concept":
            # Let Gemini handle this from its own knowledge - just pass back context
            return {
                "success": True,
                "concept": args.get("concept"),
                "depth": args.get("depth", "intermediate"),
                "message": f"Explaining {args.get('concept')} at {args.get('depth', 'intermediate')} level."
            }

        else:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

    except Exception as e:
        return {"success": False, "error": str(e)}

# ============================================================
# Streaming Chat Endpoint
# ============================================================

@router.post("/chat/stream")
async def chat_stream(req: AssistantChatRequest):
    """
    SSE streaming chat endpoint with tool calling.

    Event types:
    - text_delta: Incremental text from the AI
    - tool_call: AI is calling a tool (shows in UI as a card)
    - tool_result: Result of a tool execution
    - strategy_nodes: Strategy nodes generated (for canvas rendering)
    - action: Frontend action to execute (navigate, open modal, etc.)
    - done: Stream complete
    - error: An error occurred
    """
    if not GENAI_AVAILABLE:
        raise HTTPException(status_code=500, detail="Google GenAI not available")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    async def event_stream():
        try:
            client = genai.Client(api_key=api_key)

            # Build conversation history
            contents = []
            for msg in req.history:
                contents.append(types.Content(
                    role="user" if msg.role == "user" else "model",
                    parts=[types.Part.from_text(text=msg.content)]
                ))

            # Add current message
            contents.append(types.Content(
                role="user",
                parts=[types.Part.from_text(text=req.message)]
            ))

            # Add context if available
            context_str = ""
            if req.context:
                context_str = f"\n\nCurrent context: {json.dumps(req.context)}"

            # Build tool declarations
            tool_declarations = []
            for tool_def in TOOL_DEFINITIONS:
                tool_declarations.append(types.Tool(
                    function_declarations=[
                        types.FunctionDeclaration(
                            name=tool_def["name"],
                            description=tool_def["description"],
                            parameters=tool_def["parameters"]
                        )
                    ]
                ))

            # Call Gemini with function calling
            config = types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT + context_str,
                tools=tool_declarations,
                temperature=0.7,
                max_output_tokens=4096,
            )

            # Use non-streaming first call to handle tool calling loop
            max_tool_rounds = 5
            for round_num in range(max_tool_rounds):
                response = client.models.generate_content(
                    model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
                    contents=contents,
                    config=config,
                )

                # Check if the response has function calls
                has_function_calls = False
                if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
                    for part in response.candidates[0].content.parts:
                        if part.function_call:
                            has_function_calls = True
                            break

                if not has_function_calls:
                    # No tool calls — stream the text response
                    if response.candidates and response.candidates[0].content:
                        for part in response.candidates[0].content.parts:
                            if part.text:
                                # Stream text in chunks for a streaming feel
                                text = part.text
                                chunk_size = 12  # characters per chunk
                                for i in range(0, len(text), chunk_size):
                                    chunk = text[i:i+chunk_size]
                                    yield f"data: {json.dumps({'type': 'text_delta', 'content': chunk})}\n\n"
                                    await asyncio.sleep(0.02)
                    break
                else:
                    # Process tool calls
                    function_response_parts = []
                    for part in response.candidates[0].content.parts:
                        if part.function_call:
                            tool_name = part.function_call.name
                            tool_args = dict(part.function_call.args) if part.function_call.args else {}

                            # Notify frontend that a tool is being called
                            yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool_name, 'args': tool_args})}\n\n"
                            await asyncio.sleep(0.1)

                            # Execute the tool
                            result = await execute_tool(tool_name, tool_args)

                            # Send tool result to frontend
                            yield f"data: {json.dumps({'type': 'tool_result', 'tool': tool_name, 'result': result})}\n\n"

                            # If strategy nodes were generated, send them separately
                            if tool_name == "build_strategy" and result.get("success") and result.get("nodes"):
                                # Stream nodes one by one for incremental building effect
                                nodes = result["nodes"]
                                edges = result.get("edges", [])
                                for i, node in enumerate(nodes):
                                    yield f"data: {json.dumps({'type': 'strategy_node', 'node': node, 'index': i, 'total': len(nodes)})}\n\n"
                                    await asyncio.sleep(0.15)  # Delay for visual effect
                                # Send all edges at once after nodes
                                if edges:
                                    yield f"data: {json.dumps({'type': 'strategy_edges', 'edges': edges})}\n\n"

                            # If there's a frontend action, send it
                            if result.get("action"):
                                yield f"data: {json.dumps({'type': 'action', 'action': result['action'], 'data': result})}\n\n"

                            function_response_parts.append(
                                types.Part.from_function_response(
                                    name=tool_name,
                                    response=result,
                                )
                            )

                        elif part.text:
                            # Mixed text + tool calls: stream the text part
                            text = part.text
                            chunk_size = 12
                            for i in range(0, len(text), chunk_size):
                                chunk = text[i:i+chunk_size]
                                yield f"data: {json.dumps({'type': 'text_delta', 'content': chunk})}\n\n"
                                await asyncio.sleep(0.02)

                    # Add the assistant response and function results to the conversation
                    contents.append(response.candidates[0].content)
                    contents.append(types.Content(
                        role="user",
                        parts=function_response_parts,
                    ))

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# Non-streaming fallback
@router.post("/chat")
async def chat_non_streaming(req: AssistantChatRequest):
    """Non-streaming fallback for environments that don't support SSE."""
    if not GENAI_AVAILABLE:
        raise HTTPException(status_code=500, detail="Google GenAI not available")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    try:
        client = genai.Client(api_key=api_key)

        contents = []
        for msg in req.history:
            contents.append(types.Content(
                role="user" if msg.role == "user" else "model",
                parts=[types.Part.from_text(text=msg.content)]
            ))
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=req.message)]
        ))

        tool_declarations = []
        for tool_def in TOOL_DEFINITIONS:
            tool_declarations.append(types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(
                        name=tool_def["name"],
                        description=tool_def["description"],
                        parameters=tool_def["parameters"]
                    )
                ]
            ))

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            tools=tool_declarations,
            temperature=0.7,
            max_output_tokens=4096,
        )

        all_text = ""
        tool_results = []
        actions = []

        for _ in range(5):
            response = client.models.generate_content(
                model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
                contents=contents,
                config=config,
            )

            has_function_calls = False
            function_response_parts = []

            if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if part.function_call:
                        has_function_calls = True
                        result = await execute_tool(
                            part.function_call.name,
                            dict(part.function_call.args) if part.function_call.args else {}
                        )
                        tool_results.append({"tool": part.function_call.name, "result": result})
                        if result.get("action"):
                            actions.append({"action": result["action"], "data": result})

                        function_response_parts.append(
                            types.Part.from_function_response(
                                name=part.function_call.name,
                                response=result,
                            )
                        )
                    elif part.text:
                        all_text += part.text

            if not has_function_calls:
                break

            contents.append(response.candidates[0].content)
            contents.append(types.Content(role="user", parts=function_response_parts))

        return {
            "response": all_text,
            "tool_results": tool_results,
            "actions": actions,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools")
async def list_tools():
    """List available tools for the AI assistant."""
    return {
        "tools": [
            {"name": t["name"], "description": t["description"]}
            for t in TOOL_DEFINITIONS
        ]
    }
