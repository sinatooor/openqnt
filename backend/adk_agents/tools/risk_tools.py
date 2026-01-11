"""
Quantitative Risk Tools
Provides advanced risk metrics including Value at Risk (VaR), CVaR, and Sharpe/Sortino ratios.
"""
import pandas as pd
import numpy as np
import yfinance as yf
from typing import Dict, Union, Optional

def calculate_risk_metrics(symbol: str, period: str = "2y") -> str:
    """
    Calculate quantitative risk metrics for an asset.
    Includes Volatility, VaR (95%), CVaR (95%), Sharpe, and Sortino ratios.
    
    Args:
        symbol: Ticker symbol
        period: Lookback period for calculation
    """
    try:
        # Fetch data
        data = yf.download(symbol, period=period, interval="1d", progress=False)['Close']
        
        if data.empty:
            return "No data found for risk analysis."
            
        # Calculate daily returns
        returns = data.pct_change().dropna()
        
        # 1. Annualized Volatility
        volatility = returns.std() * np.sqrt(252)
        
        # 2. Value at Risk (95% Confidence)
        # "We are 95% confident that the daily loss will not exceed X%"
        var_95 = np.percentile(returns, 5) * -1
        
        # 3. Conditional VaR (Expected Shortfall)
        # "If things go bad (>VaR), what is the average loss?"
        cvar_95 = returns[returns <= -var_95].mean() * -1
        
        # 4. Sharpe Ratio (assuming 0% risk free rate for simplicity)
        mean_return = returns.mean() * 252
        sharpe = mean_return / volatility if volatility != 0 else 0
        
        # 5. Sortino Ratio (only downside volatility)
        downside_returns = returns[returns < 0]
        downside_std = downside_returns.std() * np.sqrt(252)
        sortino = mean_return / downside_std if downside_std != 0 else 0
        
        # 6. Max Drawdown
        cumulative = (1 + returns).cumprod()
        peak = cumulative.cummax()
        drawdown = (cumulative - peak) / peak
        max_drawdown = drawdown.min()
        
        # Interpretations
        risk_level = "High" if volatility > 0.30 else "Medium" if volatility > 0.15 else "Low"
        
        # Format output
        summary = f"## Quantitative Risk Profile: {symbol} ({period})\n\n"
        summary += f"**Risk Level:** {risk_level} (Vol: {volatility*100:.1f}%)\n\n"
        
        summary += "### Risk Metrics\n"
        summary += f"- **Value at Risk (95% Daily):** {var_95*100:.2f}%\n"
        summary += f"  *(Interpretation: 95% chance daily loss < {var_95*100:.2f}%)*\n"
        summary += f"- **CVaR / Expected Shortfall:** {cvar_95*100:.2f}%\n"
        summary += f"  *(Interpretation: Avg loss on worst 5% of days)*\n"
        summary += f"- **Max Drawdown:** {max_drawdown*100:.2f}%\n\n"
        
        summary += "### Performance Metrics (Annualized)\n"
        summary += f"- **Sharpe Ratio:** {sharpe:.2f} (>1 is good, >2 is excellent)\n"
        summary += f"- **Sortino Ratio:** {sortino:.2f} (Penalizes only downside volatility)\n"
        
        return summary
        
    except Exception as e:
        return f"Error calculating risk metrics: {str(e)}"

__all__ = ["calculate_risk_metrics"]
