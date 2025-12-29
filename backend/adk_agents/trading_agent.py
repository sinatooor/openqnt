"""
Trading Agent - Main ADK Agent for Trading Operations

This agent can:
1. Search for market news and sentiment
2. Create custom technical indicators
3. Execute trades through broker API
4. Find relevant blocks from the catalog
"""

import os
from google.adk.agents import Agent

from .tools.search_tools import (
    search_market_news,
    search_sentiment,
    search_economic_calendar,
)
from .tools.indicator_tools import (
    create_custom_indicator,
    update_custom_indicator,
    delete_custom_indicator,
    list_custom_indicators,
    get_custom_indicator,
)
from .tools.broker_tools import (
    execute_trade,
    get_positions,
    close_position,
    get_account_info,
    get_market_price,
)
from .tools.rag_tools import (
    find_similar_blocks,
    get_block_info,
    list_block_categories,
)


# Main Trading Agent
trading_agent = Agent(
    name="trading_agent",
    model="gemini-2.0-flash",
    description="AI trading assistant that can analyze markets, create custom indicators, and execute trades",
    instruction="""You are an expert AI trading assistant with access to powerful tools.

## Your Capabilities:

### 1. Market Research
- Search for real-time market news about any symbol
- Analyze market sentiment for topics
- Check upcoming economic events

### 2. Custom Indicators
- Create new technical indicator blocks with custom formulas
- Update and manage existing custom indicators
- These indicators are saved and can be used in the block-based strategy builder

### 3. Trade Execution (USE WITH CAUTION)
- Execute trades through the broker API
- View current positions
- Close positions
- Get account balance information
- ALWAYS require explicit user confirmation before executing trades

### 4. Block Discovery
- Find relevant blocks from the trading strategy catalog
- Get detailed information about specific blocks
- Help users build strategies with the right components

## Important Guidelines:

1. **Safety First**: Never execute trades without explicit user confirmation
2. **Explain Your Reasoning**: Before taking any action, explain what you're about to do
3. **Market Context**: When creating indicators, consider market conditions
4. **RAG First**: Before suggesting blocks, search the catalog for the best matches

## Example Interactions:

User: "What's the latest news on Apple stock?"
→ Use search_market_news("AAPL")

User: "Create a custom momentum indicator"
→ Use create_custom_indicator with appropriate formula

User: "Find blocks for RSI strategy"
→ Use find_similar_blocks("RSI overbought oversold")

User: "Buy 0.1 lots of EURUSD"
→ First explain the trade, then use execute_trade with confirmed=False
→ Wait for user to confirm, then execute with confirmed=True
""",
    tools=[
        # Search tools
        search_market_news,
        search_sentiment,
        search_economic_calendar,
        # Indicator tools
        create_custom_indicator,
        update_custom_indicator,
        delete_custom_indicator,
        list_custom_indicators,
        get_custom_indicator,
        # Broker tools
        execute_trade,
        get_positions,
        close_position,
        get_account_info,
        get_market_price,
        # RAG tools
        find_similar_blocks,
        get_block_info,
        list_block_categories,
    ],
)


# Specialized sub-agents for more focused tasks
research_agent = Agent(
    name="research_agent",
    model="gemini-2.0-flash",
    description="Market research and news analysis agent",
    instruction="""You are a market research specialist.
    
Your job is to:
1. Find and summarize relevant market news
2. Analyze sentiment around trading topics
3. Identify upcoming economic events that could impact markets

Be concise and focus on actionable insights.
""",
    tools=[
        search_market_news,
        search_sentiment,
        search_economic_calendar,
    ],
)


indicator_agent = Agent(
    name="indicator_agent", 
    model="gemini-2.0-flash",
    description="Custom indicator creation and management agent",
    instruction="""You are a technical analysis expert.

Your job is to:
1. Design custom technical indicators based on user requirements
2. Write clear, efficient Python formulas for indicator calculations
3. Manage the library of custom indicators

When creating indicators:
- Use descriptive names (snake_case)
- Include all necessary parameters with sensible defaults
- Write formulas that work with: close, open, high, low, volume, data
- Test logic conceptually before creating
""",
    tools=[
        create_custom_indicator,
        update_custom_indicator,
        delete_custom_indicator,
        list_custom_indicators,
        get_custom_indicator,
        find_similar_blocks,
    ],
)


# Export all agents
__all__ = ["trading_agent", "research_agent", "indicator_agent"]
