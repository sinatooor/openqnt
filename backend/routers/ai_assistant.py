"""
Global AI Assistant Router
Full-featured AI chat with Anthropic tool-use and SSE streaming.
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
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

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
    },
    {
        "name": "create_custom_node",
        "description": (
            "Add a single custom node to the user's strategy flow canvas. Use when the user asks "
            "for a specific node (e.g. 'add a custom RSI divergence indicator', 'add a Telegram alert', "
            "'create a custom code block that does X', 'add an Avanza data source for Volvo B'). "
            "This tool appends one node to the existing canvas — it does NOT replace the whole flow. "
            "For full strategies, use build_strategy instead."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "node_type": {
                    "type": "string",
                    "description": (
                        "The node category. Must be one of: indicator, condition, action, environment, "
                        "math, control, variable, risk, tradeInfo, llm, trigger, integration, "
                        "dataSource, portfolio, agent."
                    ),
                },
                "subtype": {
                    "type": "string",
                    "description": (
                        "The subtype identifier within the category, e.g. 'rsi' for indicator, "
                        "'avanzaData' for dataSource, 'customCode' for llm, 'telegram' for integration."
                    ),
                },
                "label": {
                    "type": "string",
                    "description": "Human-friendly display label, e.g. 'RSI Divergence'.",
                },
                "config": {
                    "type": "object",
                    "description": (
                        "Node configuration as a JSON object. Goes into the node's `data` block. "
                        "For indicators put params under {params: {period: 14}}. For dataSource: "
                        "{provider, symbol, timeframe}. For llm/customCode: {prompt, model, code}. "
                        "For integration: {channel, message}. The frontend persists this verbatim."
                    ),
                },
            },
            "required": ["node_type", "subtype"],
        },
    },
]

# ============================================================
# System Prompt
# ============================================================

SYSTEM_PROMPT = """You are the AI assistant for Fyer, a professional trading strategy platform. You help users with everything in the app:

**Your Capabilities:**
1. **Build Strategies** - You can generate visual trading strategies using flow nodes. When a user asks you to build a strategy, use the `build_strategy` tool. The strategy will appear as nodes on the visual canvas.
2. **Add Custom Nodes** - When the user asks for a single node (e.g. "add a Telegram alert", "add a custom RSI divergence indicator", "add an Avanza data source for VOLV-B.ST", "add a custom code block that does X"), use the `create_custom_node` tool. Pick the right `node_type` and `subtype`, fill `config` with everything the node needs (params, prompt, code, provider, symbol, etc.). The node is appended to the canvas without disturbing what's already there.
3. **Run Backtests** - Test strategies on historical data to see how they would have performed.
4. **Monte Carlo Analysis** - Run statistical tests to validate strategy robustness.
5. **Portfolio Management** - View and analyze portfolio holdings and performance.
6. **Market Research** - Access market news, data events, and analysis tools.
7. **Navigation** - Guide users to the right part of the app for their task.
8. **Education** - Explain trading concepts, indicators, risk management, etc.

**Custom-node cheat sheet (for `create_custom_node`):**
- Indicators: subtype = sma | ema | rsi | macd | bb | atr | stochastic | adx | …; config = {params: {period: 14, priceType: "close"}, timeframe: "60"}.
- Conditions: subtype = compare | crossover | crossunder | threshold | range | and | or | not.
- Actions: subtype = order | closePosition | stopLoss | takeProfit | trailingStop | notification.
- Data sources: subtype = yfinanceData | avanzaData | fmpData | avanzaPositions | avanzaWatchlist | fredMacro; config = {provider, symbol, timeframe}.
- LLM / Custom code: subtype = customCode | llmDecision | sentimentAnalysis; config = {prompt, model: "gpt-4o-mini", code, language: "python"}.
- Integrations: subtype = telegram | slack | email | sms | discord | webhook; config = {channel, message}.
- Triggers: subtype = heartbeat | webhook | priceAlert | news | cron; config = {interval, condition}.

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

# Phase 4+ — TS sidecar (services/strategy-ai/) that runs the n8n-inspired
# Builder agent. When `AI_BUILDER_VIA_SIDECAR` is on, `build_strategy` tool
# calls stream events from the sidecar instead of the legacy one-shot
# generator. Default ON because Phase 4 is verified end-to-end.
STRATEGY_AI_URL = os.getenv("STRATEGY_AI_URL", "http://127.0.0.1:3050")
AI_BUILDER_VIA_SIDECAR = os.getenv("AI_BUILDER_VIA_SIDECAR", "true").lower() in {"1", "true", "yes", "on"}

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

        elif tool_name == "create_custom_node":
            node_type = (args.get("node_type") or "").strip()
            subtype = (args.get("subtype") or "").strip()
            label = args.get("label") or subtype or node_type or "Custom Node"
            config = args.get("config") or {}

            valid_types = {
                "indicator", "condition", "action", "environment", "math",
                "control", "variable", "risk", "tradeInfo", "llm", "trigger",
                "integration", "dataSource", "portfolio", "agent", "pineScript",
            }
            if node_type not in valid_types:
                return {
                    "success": False,
                    "error": f"node_type must be one of {sorted(valid_types)}",
                }
            if not subtype:
                return {"success": False, "error": "subtype required"}

            # Build a node payload the canvas can consume directly. The
            # discriminator field name varies by category — match it so the
            # PropertyPanel and compiler can resolve the correct subtype.
            disc_key = {
                "indicator": "indicatorType",
                "condition": "conditionType",
                "action": "actionType",
                "environment": "environmentType",
                "math": "mathType",
                "control": "controlType",
                "variable": "variableType",
                "risk": "riskType",
                "tradeInfo": "tradeInfoType",
                "llm": "llmType",
                "trigger": "triggerType",
                "integration": "integrationType",
                "agent": "agentType",
                "portfolio": "portfolioType",
                "dataSource": "kind",
                "pineScript": "pineScriptType",
            }[node_type]

            data: Dict[str, Any] = {"label": label, disc_key: subtype, **config}
            node_id = f"node_{int(datetime.utcnow().timestamp() * 1000) % 10_000_000}"
            node = {
                "id": node_id,
                "type": node_type,
                "position": {"x": 320, "y": 200},
                "data": data,
            }
            return {
                "success": True,
                "nodes": [node],
                "edges": [],
                "node_count": 1,
                "message": f"Added custom {node_type} node ({subtype}) to your canvas.",
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
# Sidecar bridge — forward Builder agent events to chat SSE
# ============================================================

async def stream_builder_via_sidecar(
    args: Dict[str, Any],
    current_nodes: Optional[List[Dict[str, Any]]] = None,
    current_edges: Optional[List[Dict[str, Any]]] = None,
    settings: Optional[Dict[str, Any]] = None,
):
    """Stream a Builder agent run from the TS sidecar at STRATEGY_AI_URL.

    Yields tuples of `(chat_event_dict, final_result_or_none)`. The final tuple
    contains the synthesized result that the caller folds back into the Gemini
    function-response (so the orchestrating LLM sees what was built).

    Translation rules — sidecar event → chat event:
        node_added         → strategy_node  (existing UI handler)
        edge_added         → strategy_edges (single-item batch)
        validation_attempt → builder_event (kind=validate)
        failure_signature_repeat → builder_event (kind=loop_guard)
        verification_result → builder_event (kind=verify)
        node_updated / node_deleted / edge_deleted → builder_event (kind=mutate)
        submit / run_complete → builder_event (kind=complete) + final result
        error → error (existing UI handler)
    """
    import httpx

    payload = {
        "message": args.get("description", ""),
        "draft": {
            "nodes": current_nodes or [],
            "edges": current_edges or [],
            "settings": settings or {},
        },
    }

    final_draft: Optional[Dict[str, Any]] = None
    final_summary: Optional[str] = None
    node_count = 0
    edge_count = 0

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            async with client.stream(
                "POST",
                f"{STRATEGY_AI_URL}/agent/run",
                json=payload,
                headers={"accept": "text/event-stream"},
            ) as resp:
                if resp.status_code != 200:
                    body = (await resp.aread()).decode("utf-8", errors="replace")
                    yield ({"type": "error", "message": f"sidecar {resp.status_code}: {body[:300]}"}, None)
                    return

                event_name = "message"
                async for raw_line in resp.aiter_lines():
                    if not raw_line:
                        event_name = "message"
                        continue
                    if raw_line.startswith("event:"):
                        event_name = raw_line.split(":", 1)[1].strip()
                        continue
                    if not raw_line.startswith("data:"):
                        continue
                    payload_str = raw_line.split(":", 1)[1].strip()
                    try:
                        data = json.loads(payload_str)
                    except json.JSONDecodeError:
                        continue

                    if event_name == "node_added":
                        node = data.get("node")
                        if node:
                            node_count += 1
                            yield (
                                {
                                    "type": "strategy_node",
                                    "node": node,
                                    "index": node_count - 1,
                                    "total": -1,  # unknown until run_complete
                                },
                                None,
                            )

                    elif event_name == "edge_added":
                        edge = data.get("edge")
                        if edge:
                            edge_count += 1
                            yield ({"type": "strategy_edges", "edges": [edge]}, None)

                    elif event_name in {"node_updated", "node_deleted", "edge_deleted"}:
                        yield (
                            {
                                "type": "builder_event",
                                "kind": "mutate",
                                "op": event_name,
                                "detail": data,
                            },
                            None,
                        )

                    elif event_name == "validation_attempt":
                        result = data.get("result", {})
                        yield (
                            {
                                "type": "builder_event",
                                "kind": "validate",
                                "valid": bool(result.get("valid")),
                                "errors": result.get("errors", []),
                                "warnings": result.get("warnings", []),
                                "failureSignature": result.get("failureSignature", ""),
                            },
                            None,
                        )

                    elif event_name == "failure_signature_repeat":
                        yield (
                            {
                                "type": "builder_event",
                                "kind": "loop_guard",
                                "signature": data.get("signature", ""),
                                "count": data.get("count", 2),
                            },
                            None,
                        )

                    elif event_name == "verification_result":
                        result = data.get("result", {})
                        yield (
                            {
                                "type": "builder_event",
                                "kind": "verify",
                                "compiles": bool(result.get("compiles")),
                                "errors": result.get("errors", []),
                                "warnings": result.get("warnings", []),
                            },
                            None,
                        )

                    elif event_name == "submit":
                        final_summary = data.get("summary")
                        yield (
                            {
                                "type": "builder_event",
                                "kind": "submit",
                                "summary": final_summary,
                            },
                            None,
                        )

                    elif event_name == "run_complete":
                        final_draft = data.get("draft")
                        final_summary = final_summary or data.get("summary")
                        yield (
                            {
                                "type": "builder_event",
                                "kind": "complete",
                                "summary": final_summary,
                                "validateCount": data.get("validateCount", 0),
                                "blockedByLoopGuard": bool(data.get("blockedByLoopGuard")),
                            },
                            None,
                        )

                    elif event_name == "error":
                        yield ({"type": "error", "message": data.get("message", "sidecar error")}, None)

                    elif event_name == "run_start":
                        # Surface provider/model so the UI can show which LLM the sidecar used.
                        yield (
                            {
                                "type": "builder_event",
                                "kind": "start",
                                "provider": data.get("provider"),
                                "modelId": data.get("modelId"),
                            },
                            None,
                        )
    except Exception as exc:
        yield ({"type": "error", "message": f"sidecar transport: {exc}"}, None)
        return

    # Final synthesized result for the LLM's function-response.
    if final_draft is not None:
        result = {
            "success": True,
            "nodes": final_draft.get("nodes", []),
            "edges": final_draft.get("edges", []),
            "node_count": len(final_draft.get("nodes", [])),
            "message": final_summary or f"Builder produced {len(final_draft.get('nodes', []))} nodes.",
            "viaSidecar": True,
        }
    else:
        result = {
            "success": False,
            "error": "Builder run completed without a final draft.",
            "viaSidecar": True,
        }
    yield (None, result)


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
    if not ANTHROPIC_AVAILABLE:
        raise HTTPException(status_code=500, detail="anthropic SDK not installed")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    model_id = os.getenv("ANTHROPIC_MODEL", "claude-opus-4-7")

    # Anthropic tool definitions — the existing TOOL_DEFINITIONS list uses
    # `parameters` keyed JSON Schema (Gemini's shape), which is identical to
    # what Anthropic expects under `input_schema`. Translate once at startup.
    anthropic_tools = [
        {
            "name": tool["name"],
            "description": tool["description"],
            "input_schema": tool["parameters"],
        }
        for tool in TOOL_DEFINITIONS
    ]

    async def event_stream():
        try:
            client = anthropic.Anthropic(api_key=api_key)

            # Build conversation history (Anthropic shape — string content for
            # plain history turns; the agent loop later appends structured
            # content blocks for tool-use rounds).
            messages: List[Dict[str, Any]] = []
            for msg in req.history:
                role = "user" if msg.role == "user" else "assistant"
                if msg.content:
                    messages.append({"role": role, "content": msg.content})

            messages.append({"role": "user", "content": req.message})

            context_str = ""
            if req.context:
                context_str = f"\n\nCurrent context: {json.dumps(req.context)}"

            max_tool_rounds = 5
            for round_num in range(max_tool_rounds):
                # Opus 4.7: adaptive thinking. No temperature / top_p / top_k /
                # budget_tokens — those return 400 on 4.7. The `output_config`
                # effort knob is GA on the wire but not yet in this SDK
                # version's typed kwargs; the API default (effort=high) is
                # already the right choice for this orchestrator.
                response = client.messages.create(
                    model=model_id,
                    max_tokens=16000,
                    system=SYSTEM_PROMPT + context_str,
                    tools=anthropic_tools,
                    messages=messages,
                    thinking={"type": "adaptive"},
                )

                # Stream any text blocks the model emitted this round (these
                # may appear before, between, or after tool_use blocks).
                for block in response.content:
                    if block.type == "text":
                        text = block.text or ""
                        chunk_size = 12
                        for i in range(0, len(text), chunk_size):
                            chunk = text[i:i + chunk_size]
                            yield f"data: {json.dumps({'type': 'text_delta', 'content': chunk})}\n\n"
                            await asyncio.sleep(0.02)

                stop_reason = response.stop_reason

                if stop_reason == "end_turn":
                    break

                if stop_reason in {"max_tokens", "refusal"}:
                    detail = "Response truncated at max_tokens." if stop_reason == "max_tokens" else "The assistant declined this request."
                    yield f"data: {json.dumps({'type': 'error', 'message': detail})}\n\n"
                    break

                if stop_reason != "tool_use":
                    # Unknown terminal state — surface and break rather than loop.
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Unexpected stop_reason: {stop_reason}'})}\n\n"
                    break

                # Process tool calls in order; collect tool_result blocks to
                # send back as the next user message.
                tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
                tool_result_blocks: List[Dict[str, Any]] = []

                for block in tool_use_blocks:
                    tool_name = block.name
                    tool_args = dict(block.input) if block.input else {}

                    yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool_name, 'args': tool_args})}\n\n"
                    await asyncio.sleep(0.1)

                    # Route build_strategy through the TS sidecar (Phase 4) when enabled.
                    # The sidecar streams its own progress events — we forward them
                    # live to the chat SSE so the user sees nodes append in real time
                    # rather than waiting for a single blob at the end.
                    if tool_name == "build_strategy" and AI_BUILDER_VIA_SIDECAR:
                        ctx_snapshot = (req.context or {}).get("visibleData", {}).get("snapshot", {}) if req.context else {}
                        strategy_ctx = ctx_snapshot.get("context") if isinstance(ctx_snapshot, dict) else None
                        draft_settings = {"context": strategy_ctx} if strategy_ctx else {}
                        result: Optional[Dict[str, Any]] = None
                        async for chat_event, final_result in stream_builder_via_sidecar(
                            tool_args,
                            current_nodes=(req.context or {}).get("nodes") if req.context else None,
                            current_edges=(req.context or {}).get("edges") if req.context else None,
                            settings=draft_settings,
                        ):
                            if chat_event is not None:
                                yield f"data: {json.dumps(chat_event)}\n\n"
                            if final_result is not None:
                                result = final_result
                        if result is None:
                            result = {"success": False, "error": "Sidecar stream ended without a result.", "viaSidecar": True}
                        # Tool-result event sent to the UI omits the heavy nodes
                        # payload (it was already streamed live).
                        yield f"data: {json.dumps({'type': 'tool_result', 'tool': tool_name, 'result': {'success': result.get('success', False), 'node_count': result.get('node_count', 0), 'message': result.get('message', ''), 'viaSidecar': True}})}\n\n"
                    else:
                        result = await execute_tool(tool_name, tool_args)
                        yield f"data: {json.dumps({'type': 'tool_result', 'tool': tool_name, 'result': result})}\n\n"

                    # Re-emit strategy nodes for non-sidecar tool paths.
                    if (
                        tool_name in ("build_strategy", "create_custom_node")
                        and result.get("success")
                        and result.get("nodes")
                        and not result.get("viaSidecar")
                    ):
                        nodes = result["nodes"]
                        edges = result.get("edges", [])
                        for i, node in enumerate(nodes):
                            yield f"data: {json.dumps({'type': 'strategy_node', 'node': node, 'index': i, 'total': len(nodes)})}\n\n"
                            await asyncio.sleep(0.05 if tool_name == "create_custom_node" else 0.15)
                        if edges:
                            yield f"data: {json.dumps({'type': 'strategy_edges', 'edges': edges})}\n\n"

                    if result.get("action"):
                        yield f"data: {json.dumps({'type': 'action', 'action': result['action'], 'data': result})}\n\n"

                    # Feed the result back to the model. Anthropic tool_result
                    # content accepts a string; JSON-encode dicts so the model
                    # can parse structured fields if it needs them.
                    if isinstance(result, (dict, list)):
                        tool_result_content = json.dumps(result)
                    else:
                        tool_result_content = str(result)
                    tool_result_blocks.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": tool_result_content,
                    })

                # Append the assistant turn (full content — preserves text +
                # tool_use blocks the API needs to thread the next turn) and
                # our tool results, then loop.
                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_result_blocks})

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except anthropic.RateLimitError as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Rate limited: {e}'})}\n\n"
        except anthropic.APIStatusError as e:
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': f'API error {e.status_code}: {e.message}'})}\n\n"
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


@router.get("/tools")
async def list_tools():
    """List available tools for the AI assistant."""
    return {
        "tools": [
            {"name": t["name"], "description": t["description"]}
            for t in TOOL_DEFINITIONS
        ]
    }
