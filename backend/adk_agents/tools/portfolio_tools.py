"""
Portfolio Tools
Provides tools for portfolio construction, correlation analysis, and diversification metrics.
"""
import pandas as pd
import yfinance as yf
from typing import List, Dict, Union

def calculate_correlation_matrix(symbols: List[str], period: str = "6mo") -> str:
    """
    Calculate the correlation matrix for a list of symbols.
    Useful for checking diversification (avoiding highly correlated assets).
    
    Args:
        symbols: List of ticker symbols (e.g., ["AAPL", "MSFT", "GOOG"])
        period: Lookback period
        
    Returns:
        Markdown table of correlation matrix
    """
    try:
        if len(symbols) < 2:
            return "Need at least 2 symbols for correlation analysis."
            
        # Fetch data
        data = yf.download(symbols, period=period, interval="1d", progress=False)['Close']
        
        if data.empty:
            return "No data found for symbols."
            
        # Calculate correlation
        corr_matrix = data.corr()
        
        # Format as markdown
        return f"## Correlation Matrix ({period})\n\n" + corr_matrix.to_markdown(floatfmt=".2f")
    except Exception as e:
        return f"Error calculating correlation: {str(e)}"

def calculate_portfolio_beta(holdings: Dict[str, float], benchmark: str = "SPY") -> str:
    """
    Calculate the weighted beta of a portfolio relative to a benchmark.
    Beta > 1: More volatile than market
    Beta < 1: Less volatile than market
    
    Args:
        holdings: Dict of symbol -> weight (e.g., {"AAPL": 0.5, "GLD": 0.5})
        benchmark: Benchmark ticker
    """
    try:
        symbols = list(holdings.keys())
        all_symbols = symbols + [benchmark]
        
        # Fetch data
        data = yf.download(all_symbols, period="1y", interval="1d", progress=False)['Close']
        
        if data.empty:
            return "No data found for analysis."
            
        # Calculate returns
        returns = data.pct_change().dropna()
        
        betas = {}
        weighted_beta = 0.0
        
        market_var = returns[benchmark].var()
        
        result = f"## Portfolio Beta Analysis (Benchmark: {benchmark})\n\n"
        
        for sym in symbols:
            # Beta = Cov(Asset, Market) / Var(Market)
            cov = returns[[sym, benchmark]].cov().iloc[0, 1]
            beta = cov / market_var
            betas[sym] = beta
            
            weight = holdings[sym]
            weighted_beta += beta * weight
            
            result += f"- **{sym}** (Weight {weight*100:.0f}%): Beta {beta:.2f}\n"
            
        result += f"\n**Portfolio Weighted Beta:** {weighted_beta:.2f}\n"
        
        if weighted_beta > 1.2:
            result += "⚠️ High Volatility: Portfolio is significantly more volatile than the market."
        elif weighted_beta < 0.8:
            result += "🛡️ Low Volatility: Portfolio is defensive."
        else:
            result += "⚖️ Moderate Volatility: Portfolio tracks market risk closely."
            
        return result
        
    except Exception as e:
        return f"Error calculating beta: {str(e)}"

__all__ = ["calculate_correlation_matrix", "calculate_portfolio_beta"]
