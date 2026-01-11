"""
Market Data Tools
Provides access to historical data, company profiles, and financial metrics.
Uses yfinance for broad market coverage (stocks, crypto, forex).
"""
import yfinance as yf
import pandas as pd
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta

def get_historical_data(symbol: str, period: str = "1mo", interval: str = "1d") -> str:
    """
    Get historical price data for a symbol.
    
    Args:
        symbol: Ticker symbol (e.g., "AAPL", "BTC-USD", "EURUSD=X")
        period: Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
        interval: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
        
    Returns:
        String representation of the dataframe (markdown table)
    """
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        
        if df.empty:
            return f"No data found for {symbol}"
            
        # Format for readability
        df = df.reset_index()
        # Convert datetime to string
        if 'Date' in df.columns:
            df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
        elif 'Datetime' in df.columns:
            df['Datetime'] = df['Datetime'].dt.strftime('%Y-%m-%d %H:%M')
            
        # Select key columns
        cols = [c for c in df.columns if c in ['Date', 'Datetime', 'Open', 'High', 'Low', 'Close', 'Volume']]
        df = df[cols]
        
        # Round numbers
        for col in ['Open', 'High', 'Low', 'Close']:
            if col in df.columns:
                df[col] = df[col].round(4)
                
        return df.to_markdown(index=False)
    except Exception as e:
        return f"Error fetching history for {symbol}: {str(e)}"

def get_company_profile(symbol: str) -> str:
    """
    Get fundamental company profile and key metrics.
    
    Args:
        symbol: Ticker symbol (e.g., "AAPL")
        
    Returns:
        Structured summary of company profile
    """
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        
        if not info:
            return f"No profile found for {symbol}"
            
        # Extract key fields
        profile = {
            "Name": info.get("longName"),
            "Sector": info.get("sector"),
            "Industry": info.get("industry"),
            "Market Cap": info.get("marketCap"),
            "PE Ratio": info.get("trailingPE"),
            "Forward PE": info.get("forwardPE"),
            "Dividend Yield": info.get("dividendYield"),
            "52w High": info.get("fiftyTwoWeekHigh"),
            "52w Low": info.get("fiftyTwoWeekLow"),
            "Description": info.get("longBusinessSummary", "")[:500] + "...",
            "Website": info.get("website")
        }
        
        # Format as string
        result = f"## Profile: {profile['Name']} ({symbol})\n"
        result += f"**Sector:** {profile['Sector']} | **Industry:** {profile['Industry']}\n"
        result += f"**Market Cap:** {format_large_number(profile.get('Market Cap'))}\n"
        result += f"**P/E:** {profile.get('PE Ratio')} | **Fwd P/E:** {profile.get('Forward PE')}\n"
        result += f"**Price Range:** {profile.get('52w Low')} - {profile.get('52w High')}\n\n"
        result += f"**Description:** {profile['Description']}\n"
        
        return result
    except Exception as e:
        return f"Error fetching profile for {symbol}: {str(e)}"

def get_financial_summary(symbol: str) -> Dict[str, Any]:
    """
    Get financial statement summary (Income, Balance Sheet, Cash Flow).
    
    Args:
        symbol: Ticker symbol
    """
    try:
        ticker = yf.Ticker(symbol)
        
        # Get latest annual financials
        income = ticker.income_stmt
        balance = ticker.balance_sheet
        cashflow = ticker.cashflow
        
        summary = {
            "income": {},
            "balance": {},
            "cashflow": {}
        }
        
        if not income.empty:
            latest = income.iloc[:, 0]
            summary["income"] = {
                "Revenue": format_large_number(latest.get("Total Revenue")),
                "Net Income": format_large_number(latest.get("Net Income")),
                "Gross Profit": format_large_number(latest.get("Gross Profit"))
            }
            
        if not balance.empty:
            latest = balance.iloc[:, 0]
            summary["balance"] = {
                "Total Assets": format_large_number(latest.get("Total Assets")),
                "Total Liab": format_large_number(latest.get("Total Liabilities Net Minority Interest")),
                "Cash": format_large_number(latest.get("Cash And Cash Equivalents"))
            }
            
        return summary
    except Exception as e:
        return {"error": str(e)}

def format_large_number(num) -> str:
    """Format large numbers (M, B, T)."""
    if not isinstance(num, (int, float)):
        return str(num)
        
    if num >= 1e12:
        return f"${num/1e12:.2f}T"
    if num >= 1e9:
        return f"${num/1e9:.2f}B"
    if num >= 1e6:
        return f"${num/1e6:.2f}M"
    return f"${num:,.2f}"

__all__ = ["get_historical_data", "get_company_profile", "get_financial_summary"]
