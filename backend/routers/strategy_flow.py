"""
Strategy Flow Router
Handles Flow-based strategy generation, conversion, and management.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import os
import httpx
from pathlib import Path

from flow.compiler import compile_flow_strategy, validate_flow_strategy
from engine.backtester import BacktestEngine
from engine.monte_carlo import run_monte_carlo
from data_service import MarketDataService

router = APIRouter(prefix="/api/flow", tags=["flow"])

# ============================================================
# Request/Response Models
# ============================================================

class FlowNode(BaseModel):
    id: str
    type: str
    position: Dict[str, float]
    data: Dict[str, Any]

class FlowEdge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None

class FlowStrategy(BaseModel):
    nodes: List[FlowNode]
    edges: List[FlowEdge]
    settings: Optional[Dict[str, Any]] = None

class GenerateFlowRequest(BaseModel):
    prompt: str
    model: str = "deepseek"  # "deepseek" or "gemini"

class ConvertFlowRequest(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    target: str = "python"  # "python", "mql5", "nautilus"
    settings: Optional[Dict[str, Any]] = None

class SaveFlowStrategyRequest(BaseModel):
    user_id: str
    name: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    settings: Optional[Dict[str, Any]] = None


class CompileFlowRequest(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    settings: Optional[Dict[str, Any]] = None


class BacktestFlowRequest(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    settings: Optional[Dict[str, Any]] = None
    symbol: str = "EURUSD"
    start_date: str = "2024-01-01"
    end_date: str = "2024-06-30"
    initial_cash: float = 100000.0


class MonteCarloRequest(BaseModel):
    equity_curve: List[Dict[str, Any]]
    trades: List[Dict[str, Any]]
    iterations: int = 1000
    method: str = "trade_shuffle"

# ============================================================
# Load Flow System Prompt
# ============================================================

def load_flow_prompt() -> str:
    """Load the Flow system prompt from file."""
    prompt_path = Path(__file__).parent.parent / "FLOW_SYSTEM_PROMPT.txt"
    if prompt_path.exists():
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()
    return ""

FLOW_SYSTEM_PROMPT = load_flow_prompt()

# ============================================================
# LLM Helpers
# ============================================================

async def call_deepseek(messages: list, temperature: float = 0.3) -> str:
    """Call DeepSeek API."""
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="DEEPSEEK_API_KEY not configured")
    
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
            raise HTTPException(
                status_code=response.status_code,
                detail=f"DeepSeek API error: {response.text}"
            )
        
        data = response.json()
        return data["choices"][0]["message"]["content"]

# ============================================================
# Endpoints
# ============================================================

@router.post("/generate")
async def generate_flow_strategy(req: GenerateFlowRequest):
    """
    Generate a Strategy Flow configuration from natural language prompt.
    Returns nodes and edges that can be loaded into ReactFlow.
    """
    try:
        messages = [
            {"role": "system", "content": FLOW_SYSTEM_PROMPT},
            {"role": "user", "content": f"Create a trading strategy for: {req.prompt}"}
        ]
        
        response = await call_deepseek(messages)
        
        # Parse JSON from response
        # Remove any markdown code blocks if present
        cleaned = response.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            if lines[0].strip().startswith("```"):
                lines = lines[1:]
            if lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines)
        
        try:
            flow_data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Failed to parse LLM response as JSON: {str(e)}",
                "raw_response": response
            }
        
        return {
            "success": True,
            "nodes": flow_data.get("nodes", []),
            "edges": flow_data.get("edges", []),
            "settings": flow_data.get("settings", {})
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/convert")
async def convert_flow_to_code(req: ConvertFlowRequest):
    """
    Convert Flow nodes/edges to executable code.
    Supports: python (backtesting.py), mql5, nautilus
    """
    try:
        # Build strategy structure from nodes/edges
        nodes_by_id = {n["id"]: n for n in req.nodes}
        
        # Find indicators, conditions, actions
        indicators = [n for n in req.nodes if n.get("type") == "indicator"]
        conditions = [n for n in req.nodes if n.get("type") == "condition"]
        actions = [n for n in req.nodes if n.get("type") == "action"]
        triggers = [n for n in req.nodes if n.get("type") == "trigger"]
        
        settings = req.settings or {}
        symbol = settings.get("symbol", "EURUSD")
        
        if req.target == "python":
            code = generate_python_code(indicators, conditions, actions, settings)
        elif req.target == "mql5":
            code = generate_mql5_code(indicators, conditions, actions, settings)
        elif req.target == "nautilus":
            code = generate_nautilus_code(indicators, conditions, actions, settings)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown target: {req.target}")
        
        return {
            "success": True,
            "code": code,
            "target": req.target
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compile")
async def compile_flow(req: CompileFlowRequest):
    """
    Compile Flow nodes/edges into deterministic Python code.
    """
    result = compile_flow_strategy(req.nodes, req.edges, settings=req.settings)
    return {
        "success": result.validation.is_valid,
        "code": result.python_code,
        "compiled": result.compiled,
        "errors": result.validation.errors,
        "warnings": result.validation.warnings,
    }


@router.post("/backtest")
async def backtest_flow(req: BacktestFlowRequest):
    """
    Run a bar-based backtest using the Flow runtime engine.
    """
    settings = {**(req.settings or {}), "symbol": req.symbol}
    compile_result = compile_flow_strategy(req.nodes, req.edges, settings=settings)
    if not compile_result.validation.is_valid:
        return {
            "success": False,
            "errors": compile_result.validation.errors,
            "warnings": compile_result.validation.warnings,
        }

    data_service = MarketDataService(fmp_api_key=os.getenv("FMP_API_KEY"))
    data = data_service.get_data(
        symbol=req.symbol,
        start_date=req.start_date,
        end_date=req.end_date,
        timeframe="1h",
    )
    if data.empty:
        raise HTTPException(status_code=400, detail="No market data found for backtest.")

    engine = BacktestEngine(initial_cash=req.initial_cash)
    result = engine.run(
        strategy_code=compile_result.python_code,
        data=data,
        symbol=req.symbol,
    )

    return {
        "success": True,
        "equity_curve": result.equity_curve,
        "drawdown_curve": result.drawdown_curve,
        "trades": result.trades,
        "fills": result.fills,
        "metrics": result.metrics,
        "per_bar": result.per_bar,
    }


@router.post("/monte-carlo")
async def monte_carlo(req: MonteCarloRequest):
    """
    Run Monte Carlo simulation on backtest outputs.
    """
    report = run_monte_carlo(
        equity_curve=req.equity_curve,
        trades=req.trades,
        iterations=req.iterations,
        method=req.method,
    )
    return {"success": True, "report": report.__dict__}


def generate_python_code(indicators: list, conditions: list, actions: list, settings: dict) -> str:
    """Generate backtesting.py compatible Python code from flow nodes."""
    
    symbol = settings.get("symbol", "EURUSD")
    
    # Build indicator imports and initializations
    indicator_lines = []
    indicator_vars = []
    
    for ind in indicators:
        data = ind.get("data", {})
        ind_type = data.get("indicatorType", "SMA")
        period = data.get("period", 14)
        var_name = f"{ind_type.lower()}_{period}"
        indicator_vars.append((var_name, ind_type, period, ind["id"]))
        
        if ind_type == "SMA":
            indicator_lines.append(f"        self.{var_name} = self.I(SMA, self.data.Close, {period})")
        elif ind_type == "EMA":
            indicator_lines.append(f"        self.{var_name} = self.I(EMA, self.data.Close, {period})")
        elif ind_type == "RSI":
            indicator_lines.append(f"        self.{var_name} = self.I(lambda x: talib.RSI(x, {period}), self.data.Close)")
        elif ind_type == "MACD":
            fast = data.get("fastPeriod", 12)
            slow = data.get("slowPeriod", 26)
            signal = data.get("signalPeriod", 9)
            indicator_lines.append(f"        self.{var_name} = self.I(lambda x: talib.MACD(x, {fast}, {slow}, {signal})[0], self.data.Close)")
        elif ind_type == "BB":
            std = data.get("stdDev", 2)
            indicator_lines.append(f"        self.{var_name}_upper, self.{var_name}_mid, self.{var_name}_lower = self.I(lambda x: talib.BBANDS(x, {period}, {std}, {std}), self.data.Close)")
        elif ind_type == "ATR":
            indicator_lines.append(f"        self.{var_name} = self.I(lambda h, l, c: talib.ATR(h, l, c, {period}), self.data.High, self.data.Low, self.data.Close)")
    
    # Build condition logic
    condition_lines = []
    for cond in conditions:
        data = cond.get("data", {})
        cond_type = data.get("conditionType", "compare")
        operator = data.get("operator", "less_than")
        right_val = data.get("rightValue", 30)
        
        if isinstance(right_val, dict):
            right_val = right_val.get("value", 30)
        
        # Find connected indicator
        left_var = "self.data.Close[-1]"
        for var_name, ind_type, period, ind_id in indicator_vars:
            # Check if this condition is connected to the indicator
            left_var = f"self.{var_name}[-1]"
            break
        
        op_map = {
            "less_than": "<",
            "greater_than": ">",
            "equals": "==",
            "less_equals": "<=",
            "greater_equals": ">="
        }
        op_symbol = op_map.get(operator, "<")
        condition_lines.append(f"{left_var} {op_symbol} {right_val}")
    
    # Build entry/exit logic
    buy_conditions = []
    sell_conditions = []
    
    for action in actions:
        data = action.get("data", {})
        action_type = data.get("actionType", "buy")
        
        if action_type == "buy":
            buy_conditions = condition_lines[:1] if condition_lines else ["True"]
        elif action_type == "sell":
            sell_conditions = condition_lines[1:2] if len(condition_lines) > 1 else ["True"]
    
    buy_cond_str = " and ".join(buy_conditions) if buy_conditions else "False"
    sell_cond_str = " and ".join(sell_conditions) if sell_conditions else "False"
    
    code = f'''"""
Auto-generated Strategy from Strategy Flow
Symbol: {symbol}
"""
from backtesting import Backtest, Strategy
from backtesting.lib import crossover
from backtesting.test import SMA
import talib
import numpy as np

def EMA(arr, n):
    """Exponential Moving Average."""
    return talib.EMA(arr, n)

class FlowStrategy(Strategy):
    """Strategy generated from visual flow diagram."""
    
    def init(self):
{chr(10).join(indicator_lines) if indicator_lines else "        pass"}
    
    def next(self):
        # Entry conditions
        if not self.position:
            if {buy_cond_str}:
                self.buy()
        
        # Exit conditions
        elif self.position:
            if {sell_cond_str}:
                self.position.close()


# Run backtest
if __name__ == "__main__":
    from backtesting.test import GOOG
    
    bt = Backtest(GOOG, FlowStrategy, cash=10000, commission=0.002)
    stats = bt.run()
    print(stats)
'''
    
    return code


def generate_mql5_code(indicators: list, conditions: list, actions: list, settings: dict) -> str:
    """Generate MQL5 code from flow nodes."""
    return """//+------------------------------------------------------------------+
//| Auto-generated MQL5 Strategy from Strategy Flow                   |
//+------------------------------------------------------------------+
#property copyright "Strategy Flow Generator"
#property version   "1.00"

#include <Trade\\Trade.mqh>
CTrade trade;

// TODO: Implement MQL5 conversion
// This is a placeholder - full implementation coming soon

int OnInit() {
    return INIT_SUCCEEDED;
}

void OnTick() {
    // Strategy logic here
}
"""


def generate_nautilus_code(indicators: list, conditions: list, actions: list, settings: dict) -> str:
    """Generate NautilusTrader code from flow nodes."""
    return '''"""
Auto-generated NautilusTrader Strategy from Strategy Flow
"""
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.model.orders import MarketOrder

# TODO: Implement Nautilus conversion
# This is a placeholder - full implementation coming soon

class FlowStrategy(Strategy):
    def __init__(self):
        super().__init__()
    
    def on_start(self):
        pass
    
    def on_bar(self, bar):
        pass
    
    def on_stop(self):
        pass
'''


@router.post("/save")
async def save_flow_strategy(req: SaveFlowStrategyRequest):
    """Save a Flow strategy to the database."""
    try:
        import local_database as db
        
        # Convert flow to JSON for storage
        flow_json = json.dumps({
            "nodes": req.nodes,
            "edges": req.edges,
            "settings": req.settings
        })
        
        # Save using existing strategy storage
        strategy_id = db.save_user_strategy(
            user_id=req.user_id,
            name=req.name,
            xml=flow_json,  # Store flow JSON in xml field for now
            python_code="",
            block_count=len(req.nodes)
        )
        
        return {"success": True, "id": strategy_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates")
async def get_flow_templates():
    """Return pre-built Flow strategy templates."""
    templates = [
        {
            "id": "rsi_oversold",
            "name": "RSI Oversold/Overbought",
            "description": "Buy when RSI < 30, Sell when RSI > 70",
            "category": "Mean Reversion",
            "nodes": [
                {"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 100}, "data": {"label": "New Bar", "triggerType": "new_bar", "timeframe": "1H"}},
                {"id": "ind_rsi", "type": "indicator", "position": {"x": 300, "y": 100}, "data": {"label": "RSI(14)", "indicatorType": "RSI", "period": 14}},
                {"id": "cond_buy", "type": "condition", "position": {"x": 500, "y": 50}, "data": {"label": "RSI < 30", "conditionType": "compare", "operator": "less_than", "rightValue": 30}},
                {"id": "cond_sell", "type": "condition", "position": {"x": 500, "y": 150}, "data": {"label": "RSI > 70", "conditionType": "compare", "operator": "greater_than", "rightValue": 70}},
                {"id": "action_buy", "type": "action", "position": {"x": 700, "y": 50}, "data": {"label": "Buy", "actionType": "buy", "size": 0.1}},
                {"id": "action_sell", "type": "action", "position": {"x": 700, "y": 150}, "data": {"label": "Sell", "actionType": "sell", "size": 0.1}}
            ],
            "edges": [
                {"id": "e1", "source": "trigger_1", "sourceHandle": "output", "target": "ind_rsi", "targetHandle": "trigger"},
                {"id": "e2", "source": "ind_rsi", "sourceHandle": "value", "target": "cond_buy", "targetHandle": "input-a"},
                {"id": "e3", "source": "ind_rsi", "sourceHandle": "value", "target": "cond_sell", "targetHandle": "input-a"},
                {"id": "e4", "source": "cond_buy", "sourceHandle": "output", "target": "action_buy", "targetHandle": "trigger"},
                {"id": "e5", "source": "cond_sell", "sourceHandle": "output", "target": "action_sell", "targetHandle": "trigger"}
            ]
        },
        {
            "id": "ma_crossover",
            "name": "Moving Average Crossover",
            "description": "Buy when Fast EMA crosses above Slow EMA",
            "category": "Trend Following",
            "nodes": [
                {"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 100}, "data": {"label": "New Bar", "triggerType": "new_bar", "timeframe": "1H"}},
                {"id": "ind_ema_fast", "type": "indicator", "position": {"x": 300, "y": 50}, "data": {"label": "EMA(12)", "indicatorType": "EMA", "period": 12}},
                {"id": "ind_ema_slow", "type": "indicator", "position": {"x": 300, "y": 150}, "data": {"label": "EMA(26)", "indicatorType": "EMA", "period": 26}},
                {"id": "cond_cross_up", "type": "condition", "position": {"x": 500, "y": 50}, "data": {"label": "Cross Above", "conditionType": "crossover", "direction": "above"}},
                {"id": "cond_cross_down", "type": "condition", "position": {"x": 500, "y": 150}, "data": {"label": "Cross Below", "conditionType": "crossover", "direction": "below"}},
                {"id": "action_buy", "type": "action", "position": {"x": 700, "y": 50}, "data": {"label": "Buy", "actionType": "buy", "size": 0.1}},
                {"id": "action_sell", "type": "action", "position": {"x": 700, "y": 150}, "data": {"label": "Sell", "actionType": "sell", "size": 0.1}}
            ],
            "edges": [
                {"id": "e1", "source": "trigger_1", "sourceHandle": "output", "target": "ind_ema_fast", "targetHandle": "trigger"},
                {"id": "e2", "source": "trigger_1", "sourceHandle": "output", "target": "ind_ema_slow", "targetHandle": "trigger"},
                {"id": "e3", "source": "ind_ema_fast", "sourceHandle": "value", "target": "cond_cross_up", "targetHandle": "input-a"},
                {"id": "e4", "source": "ind_ema_slow", "sourceHandle": "value", "target": "cond_cross_up", "targetHandle": "input-b"},
                {"id": "e5", "source": "ind_ema_fast", "sourceHandle": "value", "target": "cond_cross_down", "targetHandle": "input-a"},
                {"id": "e6", "source": "ind_ema_slow", "sourceHandle": "value", "target": "cond_cross_down", "targetHandle": "input-b"},
                {"id": "e7", "source": "cond_cross_up", "sourceHandle": "output", "target": "action_buy", "targetHandle": "trigger"},
                {"id": "e8", "source": "cond_cross_down", "sourceHandle": "output", "target": "action_sell", "targetHandle": "trigger"}
            ]
        },
        {
            "id": "bb_reversal",
            "name": "Bollinger Band Reversal",
            "description": "Buy at lower band, Sell at upper band",
            "category": "Mean Reversion",
            "nodes": [
                {"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 100}, "data": {"label": "New Bar", "triggerType": "new_bar", "timeframe": "1H"}},
                {"id": "ind_bb", "type": "indicator", "position": {"x": 300, "y": 100}, "data": {"label": "BB(20,2)", "indicatorType": "BB", "period": 20, "stdDev": 2}},
                {"id": "cond_lower", "type": "condition", "position": {"x": 500, "y": 50}, "data": {"label": "Price < Lower", "conditionType": "compare", "operator": "less_than"}},
                {"id": "cond_upper", "type": "condition", "position": {"x": 500, "y": 150}, "data": {"label": "Price > Upper", "conditionType": "compare", "operator": "greater_than"}},
                {"id": "action_buy", "type": "action", "position": {"x": 700, "y": 50}, "data": {"label": "Buy", "actionType": "buy", "size": 0.1}},
                {"id": "action_sell", "type": "action", "position": {"x": 700, "y": 150}, "data": {"label": "Sell", "actionType": "sell", "size": 0.1}}
            ],
            "edges": [
                {"id": "e1", "source": "trigger_1", "sourceHandle": "output", "target": "ind_bb", "targetHandle": "trigger"},
                {"id": "e2", "source": "ind_bb", "sourceHandle": "lower", "target": "cond_lower", "targetHandle": "input-b"},
                {"id": "e3", "source": "ind_bb", "sourceHandle": "upper", "target": "cond_upper", "targetHandle": "input-b"},
                {"id": "e4", "source": "cond_lower", "sourceHandle": "output", "target": "action_buy", "targetHandle": "trigger"},
                {"id": "e5", "source": "cond_upper", "sourceHandle": "output", "target": "action_sell", "targetHandle": "trigger"}
            ]
        }
    ]
    
    return {"templates": templates}


@router.get("/status")
async def get_flow_status():
    """Check Flow API status."""
    return {
        "status": "active",
        "version": "1.0.0",
        "features": ["generate", "convert", "templates", "save"],
        "supported_targets": ["python", "mql5", "nautilus"]
    }
