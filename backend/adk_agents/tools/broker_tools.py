"""
Broker Tools for ADK Trading Agent — IG Trading API.

⚠ DEPRECATED for the voice + Anthropic chat paths.

  - Voice agent (services/voice/tool_dispatch.py) → now uses Avanza/IBKR
    managers directly. The `get_positions` / `get_account_info` /
    `get_market_price` / `execute_trade` here are NO LONGER called from
    the Gemini Live tool registry.
  - Chat agent (routers/ai_assistant.py) → uses
    `get_portfolio_summary(broker='all'|...)` which talks to Avanza/IBKR.

This module is still imported by `adk_agents/trading_agent.py` (the
legacy Google-ADK trading agent reachable from `routers/agent_chat.py`).
If/when that ADK path is retired, this whole file can be deleted.
"""

import os
import sys
from typing import Optional
from pathlib import Path

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

try:
    from ig_trading import IGTradingSession
    IG_AVAILABLE = True
except ImportError:
    IG_AVAILABLE = False


def _get_session():
    """Get or create IG trading session."""
    if not IG_AVAILABLE:
        return None
    
    api_key = os.getenv("IG_API_KEY")
    username = os.getenv("IG_USERNAME")
    password = os.getenv("IG_PASSWORD")
    account_type = os.getenv("IG_ACCOUNT_TYPE", "DEMO")
    
    if not all([api_key, username, password]):
        return None
    
    return IGTradingSession(api_key, username, password, account_type)


def execute_trade(
    symbol: str,
    direction: str,
    size: float,
    stop_loss: Optional[float] = None,
    take_profit: Optional[float] = None,
    order_type: str = "market",
    confirmed: bool = False
) -> dict:
    """
    Execute a trade through the broker API.
    
    IMPORTANT: Requires explicit confirmation (confirmed=True) to execute.
    This is a safety measure to prevent accidental trades.
    
    Args:
        symbol: Trading symbol/epic (e.g., "EURUSD", "IX.D.FTSE.DAILY.IP")
        direction: Trade direction - "buy" or "sell"
        size: Position size (lot size or contract quantity)
        stop_loss: Optional stop loss price
        take_profit: Optional take profit price  
        order_type: "market" or "limit"
        confirmed: MUST be True to execute trade. Safety confirmation.
        
    Returns:
        dict: Trade execution result with deal reference
        
    Example:
        >>> execute_trade("EURUSD", "buy", 0.1, stop_loss=1.0800, confirmed=True)
        {"status": "success", "deal_reference": "DIAAAAA123..."}
    """
    # Safety check - require confirmation
    if not confirmed:
        return {
            "status": "pending_confirmation",
            "message": f"Trade requires confirmation: {direction.upper()} {size} {symbol}",
            "details": {
                "symbol": symbol,
                "direction": direction,
                "size": size,
                "stop_loss": stop_loss,
                "take_profit": take_profit,
                "order_type": order_type
            },
            "instruction": "Set confirmed=True to execute this trade"
        }
    
    # Validate direction
    if direction.lower() not in ["buy", "sell"]:
        return {
            "status": "error",
            "error_message": "Direction must be 'buy' or 'sell'"
        }
    
    session = _get_session()
    if not session:
        return {
            "status": "error",
            "error_message": "Broker API not configured. Set IG_API_KEY, IG_USERNAME, IG_PASSWORD in .env"
        }
    
    try:
        result = session.place_order(
            epic=symbol,
            direction=direction.upper(),
            size=size,
            stop_loss=stop_loss,
            take_profit=take_profit,
            order_type=order_type
        )
        
        return {
            "status": "success",
            "deal_reference": result.get("deal_reference"),
            "deal_id": result.get("deal_id"),
            "symbol": symbol,
            "direction": direction,
            "size": size
        }
    except Exception as e:
        return {
            "status": "error",
            "error_message": str(e)
        }


def get_positions() -> dict:
    """
    Get all currently open positions from the broker.
    
    Returns:
        dict: Status and list of open positions with details
        
    Example:
        >>> get_positions()
        {"status": "success", "positions": [{"symbol": "EURUSD", "direction": "buy", ...}]}
    """
    session = _get_session()
    if not session:
        return {
            "status": "error",
            "error_message": "Broker API not configured"
        }
    
    try:
        positions = session.get_positions()
        
        return {
            "status": "success",
            "count": len(positions),
            "positions": [
                {
                    "deal_id": p.get("deal_id"),
                    "symbol": p.get("epic"),
                    "direction": p.get("direction").lower() if p.get("direction") else None,
                    "size": p.get("size"),
                    "entry_price": p.get("level"),
                    "current_price": p.get("current_price"),
                    "pnl": p.get("pnl"),
                    "stop_loss": p.get("stop_level"),
                    "take_profit": p.get("limit_level")
                }
                for p in positions
            ] if positions else []
        }
    except Exception as e:
        return {
            "status": "error",
            "error_message": str(e)
        }


def close_position(
    deal_id: str,
    size: Optional[float] = None,
    confirmed: bool = False
) -> dict:
    """
    Close an open position.
    
    Args:
        deal_id: The deal ID of the position to close
        size: Size to close (optional, closes full position if not specified)
        confirmed: MUST be True to close position. Safety confirmation.
        
    Returns:
        dict: Close result with deal reference
    """
    if not confirmed:
        return {
            "status": "pending_confirmation",
            "message": f"Position close requires confirmation: Deal {deal_id}",
            "instruction": "Set confirmed=True to close this position"
        }
    
    session = _get_session()
    if not session:
        return {
            "status": "error",
            "error_message": "Broker API not configured"
        }
    
    try:
        result = session.close_position(deal_id, size)
        
        return {
            "status": "success",
            "deal_reference": result.get("deal_reference"),
            "message": f"Closed position {deal_id}"
        }
    except Exception as e:
        return {
            "status": "error",
            "error_message": str(e)
        }


def get_account_info() -> dict:
    """
    Get account balance and margin information.
    
    Returns:
        dict: Account details including balance, margin, and available funds
    """
    session = _get_session()
    if not session:
        return {
            "status": "error", 
            "error_message": "Broker API not configured"
        }
    
    try:
        info = session.get_account_info()
        
        return {
            "status": "success",
            "account": {
                "balance": info.get("balance"),
                "available": info.get("available"),
                "deposit": info.get("deposit"),
                "pnl": info.get("profitLoss"),
                "currency": info.get("currency", "USD")
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "error_message": str(e)
        }


def get_market_price(symbol: str) -> dict:
    """
    Get current market price for a symbol.
    
    Args:
        symbol: Trading symbol/epic
        
    Returns:
        dict: Current bid/ask prices and spread
    """
    session = _get_session()
    if not session:
        # Return mock data for demo purposes
        return {
            "status": "demo",
            "symbol": symbol,
            "message": "Broker API not configured - showing demo data",
            "bid": 1.0950,
            "ask": 1.0952,
            "spread": 0.0002
        }
    
    try:
        prices = session.get_prices(symbol)
        
        return {
            "status": "success",
            "symbol": symbol,
            "bid": prices.get("bid"),
            "ask": prices.get("offer"),
            "spread": prices.get("offer", 0) - prices.get("bid", 0)
        }
    except Exception as e:
        return {
            "status": "error",
            "error_message": str(e)
        }
