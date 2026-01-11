"""
Strategy Control Tools
Allows the agent to dynamically control and adapt the running strategy.
"""
from typing import Dict, Any, Optional
import sys
import os

# Ensure backend path is in sys.path to import strategy_runner
backend_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_path not in sys.path:
    sys.path.append(backend_path)

from strategy_runner import update_runner_parameters, get_runner_status, stop_strategy_runner

def check_active_strategy_status() -> str:
    """
    Check the status of the currently running strategy.
    Returns details on symbol, mode (Live/Paper), trade size, and active trades.
    """
    try:
        status = get_runner_status()
        if not status.get("active", False) and not status.get("is_running", False):
            return "No strategy is currently running."
            
        summary = "## Active Strategy Status\n"
        summary += f"- **Symbol:** {status.get('symbol')}\n"
        summary += f"- **Mode:** {'LIVE' if status.get('live_mode') else 'PAPER'}\n"
        summary += f"- **Broker:** {status.get('broker')}\n"
        summary += f"- **Active Trades:** {status.get('active_trades')}\n"
        summary += f"- **Total Trades:** {status.get('total_trades')}\n"
        if status.get('last_price'):
            summary += f"- **Last Price:** {status.get('last_price')}\n"
            
        return summary
    except Exception as e:
        return f"Error checking status: {str(e)}"

def update_strategy_risk_settings(max_trade_size: float = None, max_drawdown: float = None) -> str:
    """
    Update the safety/risk settings of the running strategy.
    Use this to tighten risk controls during volatile markets.
    
    Args:
        max_trade_size: New maximum allowed trade size
        max_drawdown: New maximum daily drawdown limit
    """
    try:
        status = get_runner_status()
        if not status.get("active", False) and not status.get("is_running", False):
            return "Cannot update: No strategy is currently running."
            
        safety_config = {}
        if max_trade_size is not None:
            safety_config["max_size"] = float(max_trade_size)
        if max_drawdown is not None:
            safety_config["max_drawdown"] = float(max_drawdown)
            
        if not safety_config:
            return "No changes requested."
            
        result = update_runner_parameters(safety_config=safety_config)
        
        if result.get("success"):
            return f"✅ Risk settings updated: {', '.join(result.get('changes', []))}"
        else:
            return f"❌ Failed to update: {result.get('error')}"
            
    except Exception as e:
        return f"Error updating risk settings: {str(e)}"

def adjust_trade_size(new_size: float) -> str:
    """
    Directly adjust the trade size for future orders.
    Use this to scale up/down based on conviction or volatility.
    
    Args:
        new_size: The new base position size per trade.
    """
    try:
        status = get_runner_status()
        if not status.get("active", False) and not status.get("is_running", False):
            return "Cannot update: No strategy is currently running."
            
        result = update_runner_parameters(trade_size=float(new_size))
        
        if result.get("success"):
            return f"✅ Trade size updated: {', '.join(result.get('changes', []))}"
        else:
            return f"❌ Failed to update: {result.get('error')}"
            
    except Exception as e:
        return f"Error adjusting trade size: {str(e)}"

def emergency_stop_strategy() -> str:
    """
    EMERGENCY: Stop the running strategy immediately.
    Use this if market conditions are extreme or the strategy is malfunctioning.
    """
    try:
        result = stop_strategy_runner()
        if result.get("success"):
            return "🔴 Strategy stopped successfully. Trading halted."
        else:
            return f"Failed to stop strategy: {result.get('error')}"
    except Exception as e:
        return f"Error stopping strategy: {str(e)}"

__all__ = [
    "check_active_strategy_status",
    "update_strategy_risk_settings",
    "adjust_trade_size",
    "emergency_stop_strategy"
]
