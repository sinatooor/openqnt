"""
Connector Tools for Google ADK

Allows the agent to help users connect third-party tools (Firecrawl, n8n, etc.)
by saving their configurations/API keys securely (to .env for MVP).
"""

import os
from typing import Dict, List, Optional

# List of supported connectors and their required fields
SUPPORTED_CONNECTORS = {
    "firecrawl": {
        "name": "Firecrawl",
        "description": "Web scraping API for turning websites into LLM-ready data",
        "fields": ["api_key"]
    },
    "n8n": {
        "name": "n8n",
        "description": "Workflow automation tool",
        "fields": ["webhook_url", "api_key"]
    },
    "discord_bot": {
        "name": "Discord Bot",
        "description": "Send notifications to Discord channels",
        "fields": ["webhook_url"]
    },
    "perplexity": {
        "name": "Perplexity",
        "description": "AI research assistant API",
        "fields": ["api_key"]
    },
    "tradingview": {
        "name": "TradingView",
        "description": "Charting and alerts integration",
        "fields": ["webhook_secret"]
    },
    "ig_markets": {
        "name": "IG Markets",
        "description": "Broker for CFDs and Spread Betting",
        "fields": ["api_key", "username", "password"]
    },
    "alpaca": {
        "name": "Alpaca",
        "description": "Commission-free API trading broker",
        "fields": ["api_key", "secret_key"]
    },
    "binance": {
        "name": "Binance",
        "description": "Crypto exchange",
        "fields": ["api_key", "secret_key"]
    }
}

def save_connector_config(service: str, config: Dict[str, str]) -> dict:
    """
    Saves the configuration for a specific service.
    For MVP, writes to .env file. In production, use secret manager.
    
    Args:
        service: The service slug (e.g., 'firecrawl', 'n8n', 'discord_bot')
        config: Dictionary of credential fields and values (e.g., {'api_key': '...'})
        
    Returns:
        dict: Status and message
    """
    service = service.lower().replace(" ", "_")
    
    if service not in SUPPORTED_CONNECTORS:
        return {
            "status": "error",
            "message": f"'{service}' is not a supported connector. Supported: {', '.join(SUPPORTED_CONNECTORS.keys())}"
        }
    
    # Read existing .env
    env_path = ".env"
    existing_lines = []
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            existing_lines = f.readlines()
            
    # Prepare new variables
    new_vars = {}
    for key, value in config.items():
        # Standardize naming: SERVICE_FIELD (e.g., FIRECRAWL_API_KEY)
        env_var_name = f"{service.upper()}_{key.upper()}"
        new_vars[env_var_name] = value
        
    # Update lines
    final_lines = []
    updated_keys = set()
    
    for line in existing_lines:
        line = line.strip()
        if not line or line.startswith("#"):
            final_lines.append(line)
            continue
            
        key = line.split("=")[0]
        if key in new_vars:
            final_lines.append(f"{key}={new_vars[key]}")
            updated_keys.add(key)
        else:
            final_lines.append(line)
            
    # Append new vars
    for key, value in new_vars.items():
        if key not in updated_keys:
            final_lines.append(f"{key}={value}")
            
    # Write back
    with open(env_path, "w") as f:
        f.write("\n".join(final_lines) + "\n")
        
    return {
        "status": "success",
        "message": f"Successfully connected to {SUPPORTED_CONNECTORS[service]['name']}! Configuration saved."
    }

def list_connectors() -> dict:
    """
    Lists all supported connectors and their status.
    
    Returns:
        dict: List of connectors with connection status
    """
    connectors = []
    for slug, info in SUPPORTED_CONNECTORS.items():
        # Check if connected (naive check: is at least one field in env?)
        is_connected = False
        first_field = info['fields'][0]
        env_var = f"{slug.upper()}_{first_field.upper()}"
        if os.getenv(env_var):
            is_connected = True
            
        connectors.append({
            "slug": slug,
            "name": info['name'],
            "description": info['description'],
            "connected": is_connected,
            "required_fields": info['fields']
        })
        
    return {
        "status": "success",
        "connectors": connectors
    }

def get_connector_requirements(service: str) -> dict:
    """
    Returns what is needed to connect to a service.
    
    Args:
        service: The service slug (e.g., 'firecrawl', 'n8n')
        
    Returns:
        dict: Required fields for the connector
    """
    service = service.lower()
    if service not in SUPPORTED_CONNECTORS:
        return {
            "status": "error",
            "message": f"Unknown service: {service}"
        }
        
    info = SUPPORTED_CONNECTORS[service]
    return {
        "status": "success",
        "service": service,
        "name": info['name'],
        "description": info['description'],
        "required_fields": info['fields']
    }
