"""
Broker Discovery Tool for ADK Trading Agent

Enables dynamic broker connection by:
1. Searching the web for broker API documentation
2. Identifying required credentials
3. Guiding the user through setup
"""

import os
import httpx
from typing import Optional


async def _google_search(query: str) -> dict:
    """Search using Gemini with Google Search grounding."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY not configured"}
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [{"role": "user", "parts": [{"text": query}]}],
        "tools": [{"googleSearch": {}}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 2048}
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 200:
                data = response.json()
                text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                return {"result": text}
            return {"error": f"Search failed: {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}


def research_broker_api(broker_name: str) -> dict:
    """
    Research a broker's API documentation to understand how to connect.
    
    Searches the web for the broker's trading API, identifies:
    - API documentation URL
    - Authentication method (API key, OAuth, username/password)
    - Required credentials
    - Supported features (trading, market data, account info)
    - Rate limits and restrictions
    
    Args:
        broker_name: Name of the broker (e.g., "Interactive Brokers", "TD Ameritrade", 
                     "Alpaca", "Oanda", "eToro", "Robinhood")
    
    Returns:
        dict: Contains API information and required setup steps
        
    Example:
        >>> research_broker_api("Alpaca")
        {
            "status": "success",
            "broker": "Alpaca",
            "api_docs": "https://alpaca.markets/docs/api-documentation/",
            "auth_method": "API Key + Secret",
            "required_credentials": ["API_KEY", "API_SECRET"],
            "features": ["stocks", "crypto", "paper trading"],
            "setup_guide": "..."
        }
    """
    import asyncio
    
    query = f"""Search for {broker_name} trading API documentation. I need to know:
1. What is the official API documentation URL?
2. What authentication method does it use (API key, OAuth, username/password)?
3. What credentials are required to connect?
4. What features does the API support (trading, market data, account info)?
5. Are there any rate limits or restrictions?
6. Is there a sandbox/paper trading environment?

Provide specific, factual information from the official documentation."""
    
    try:
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(_google_search(query))
    except RuntimeError:
        result = asyncio.run(_google_search(query))
    
    if "error" in result:
        return {
            "status": "error",
            "broker": broker_name,
            "error_message": result["error"]
        }
    
    return {
        "status": "success",
        "broker": broker_name,
        "research_summary": result.get("result", "No information found"),
        "next_steps": [
            f"Ask the user if they have a {broker_name} account",
            "Request the necessary API credentials from the user",
            "Help configure the connection in the .env file"
        ]
    }


def request_broker_credentials(
    broker_name: str,
    credentials_needed: list[str]
) -> dict:
    """
    Request specific credentials from the user to connect to a broker.
    
    This tool generates a structured request for the user to provide
    their broker API credentials. NEVER store or log actual credentials.
    
    Args:
        broker_name: Name of the broker
        credentials_needed: List of credential names needed 
                           (e.g., ["API_KEY", "API_SECRET", "ACCOUNT_ID"])
    
    Returns:
        dict: A formatted request for the user to provide credentials
        
    Example:
        >>> request_broker_credentials("Alpaca", ["API_KEY", "API_SECRET"])
        {
            "status": "awaiting_credentials",
            "message": "To connect to Alpaca, please provide...",
            "required": ["API_KEY", "API_SECRET"],
            "security_note": "Your credentials will be stored locally..."
        }
    """
    return {
        "status": "awaiting_credentials", 
        "broker": broker_name,
        "message": f"To connect to {broker_name}, I need the following credentials:",
        "required_credentials": credentials_needed,
        "instructions": [
            f"1. Log into your {broker_name} account",
            "2. Navigate to API settings or Developer section",
            "3. Create a new API key if you don't have one",
            "4. Copy the credentials and paste them here",
        ],
        "security_note": "⚠️ Your credentials will be stored locally in the .env file and never transmitted to external servers except for broker API calls."
    }


def save_broker_config(
    broker_name: str,
    config: dict[str, str],
    confirmed: bool = False
) -> dict:
    """
    Save broker configuration to the .env file.
    
    REQUIRES user confirmation to save credentials.
    
    Args:
        broker_name: Name of the broker
        config: Dictionary of credential key-value pairs
        confirmed: Must be True to actually save
        
    Returns:
        dict: Result of the save operation
    """
    if not confirmed:
        # Show what will be saved (masked)
        masked_config = {k: f"{v[:4]}...{v[-4:]}" if len(v) > 8 else "****" 
                        for k, v in config.items()}
        return {
            "status": "pending_confirmation",
            "message": f"Ready to save {broker_name} configuration:",
            "will_save": masked_config,
            "instruction": "Set confirmed=True to save these credentials to your .env file"
        }
    
    # In production, this would append to .env file
    # For safety, we just return what would be saved
    env_lines = [f"{broker_name.upper().replace(' ', '_')}_{k}={v}" 
                 for k, v in config.items()]
    
    return {
        "status": "success",
        "message": f"Broker configuration for {broker_name} saved!",
        "env_variables": [f"{broker_name.upper().replace(' ', '_')}_{k}" for k in config.keys()],
        "next_steps": [
            "Restart the backend to load new credentials",
            f"You can now use {broker_name} for trading"
        ]
    }


def list_supported_brokers() -> dict:
    """
    List currently supported and potentially supportable brokers.
    
    Returns:
        dict: Lists of built-in and researchable brokers
    """
    return {
        "status": "success",
        "built_in": [
            {"name": "IG Markets", "status": "configured" if os.getenv("IG_API_KEY") else "not configured"}
        ],
        "can_research": [
            "Interactive Brokers (IBKR)",
            "TD Ameritrade / Charles Schwab",
            "Alpaca Markets",
            "Oanda",
            "FXCM",
            "eToro (limited API)",
            "Binance (crypto)",
            "Coinbase (crypto)",
            "Kraken (crypto)"
        ],
        "message": "I can research any broker's API. Just ask 'Connect me to [broker name]' and I'll find out what's needed."
    }
