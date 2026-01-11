"""
Planning Tools
Provides strategic planning, risk management, and simulation tools.
"""
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional

def run_monte_carlo_simulation(
    initial_balance: float = 10000.0,
    win_rate: float = 0.5,
    risk_reward: float = 2.0,
    risk_per_trade: float = 0.01,
    num_trades: int = 100,
    num_simulations: int = 1000
) -> str:
    """
    Run Monte Carlo simulation to estimate strategy performance ranges.
    
    Args:
        initial_balance: Starting account balance
        win_rate: Expected win rate (0.0 to 1.0)
        risk_reward: Reward to Risk ratio (e.g., 2.0 means win is 2x loss)
        risk_per_trade: % of equity at risk per trade (0.01 = 1%)
        num_trades: Number of trades in a sequence
        num_simulations: Number of paths to simulate
    
    Returns:
        Summary of simulation results
    """
    try:
        results = []
        
        for _ in range(num_simulations):
            balance = initial_balance
            # Generate wins/losses based on win rate
            outcomes = np.random.random(num_trades) < win_rate
            
            for is_win in outcomes:
                risk_amt = balance * risk_per_trade
                if is_win:
                    balance += risk_amt * risk_reward
                else:
                    balance -= risk_amt
            
            results.append(balance)
            
        results = np.array(results)
        
        # Calculate stats
        avg_final = np.mean(results)
        median_final = np.median(results)
        worst_case = np.percentile(results, 1) # 1st percentile
        best_case = np.percentile(results, 99)
        risk_of_ruin = np.mean(results < initial_balance * 0.5) * 100
        
        summary = f"## Monte Carlo Simulation Results ({num_simulations} paths)\n"
        summary += f"**Params:** Win Rate {win_rate*100}%, R:R {risk_reward}, Risk {risk_per_trade*100}%\n\n"
        summary += f"**Median Final Balance:** ${median_final:,.2f} ({(median_final/initial_balance - 1)*100:.1f}%)\n"
        summary += f"**Average Final Balance:** ${avg_final:,.2f}\n"
        summary += f"**Worst Case (Bottom 1%):** ${worst_case:,.2f}\n"
        summary += f"**Best Case (Top 1%):** ${best_case:,.2f}\n"
        summary += f"**Risk of Ruin (<50%):** {risk_of_ruin:.1f}%\n"
        
        return summary
    except Exception as e:
        return f"Error running simulation: {str(e)}"

def calculate_position_sizing(
    account_size: float,
    risk_percentage: float,
    entry_price: float,
    stop_loss_price: float
) -> Dict[str, Any]:
    """
    Calculate recommended position size based on risk parameters.
    """
    try:
        risk_amount = account_size * (risk_percentage / 100)
        price_diff = abs(entry_price - stop_loss_price)
        
        if price_diff == 0:
            return {"error": "Stop loss cannot be same as entry"}
            
        units = risk_amount / price_diff
        total_exposure = units * entry_price
        leverage = total_exposure / account_size
        
        return {
            "risk_amount": risk_amount,
            "recommended_units": round(units, 4),
            "total_exposure": round(total_exposure, 2),
            "leverage_required": round(leverage, 2)
        }
    except Exception as e:
        return {"error": str(e)}

def generate_trading_plan_template(strategy_name: str) -> str:
    """Generate a structured trading plan template."""
    return f"""
# Trading Plan: {strategy_name}

## 1. Strategy Logic
**Concept:** [Describe the edge]
**Timeframe:** [e.g., 1H, 4H]
**Markets:** [e.g., EURUSD, AAPL]

## 2. Entry Rules
- [Condition A]
- [Condition B]

## 3. Exit Rules
- **Stop Loss:** [Fixed dist, ATR based, etc.]
- **Take Profit:** [Fixed R:R, Trailing, etc.]

## 4. Risk Management
- **Risk Per Trade:** 1-2%
- **Max Open Positions:** 3
- **Max Daily Drawdown:** 5%
"""

__all__ = ["run_monte_carlo_simulation", "calculate_position_sizing", "generate_trading_plan_template"]
