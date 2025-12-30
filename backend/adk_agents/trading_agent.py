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
from .tools.broker_discovery import (
    research_broker_api,
    request_broker_credentials,
    save_broker_config,
    list_supported_brokers,
)


from .tools.connector_tools import (
    save_connector_config,
    list_connectors,
    get_connector_requirements,
)
from .tools.custom_block_tools import (
    create_custom_block,
    list_custom_blocks,
    get_custom_block,
    delete_custom_block,
)

# Main Trading Agent
trading_agent = Agent(
    name="trading_agent",
    model="gemini-2.0-flash",
    description="AI trading assistant that can analyze markets, create custom indicators, execute trades, and manage integrations",
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

### 5. Connectors & Integrations
- Help users connect third-party tools (Firecrawl, n8n, Discord, etc.)
- When a user asks to connect a tool:
  1. Use `get_connector_requirements` to see what is needed
  2. Explain what information is needed
  3. INTERVIEW the user: ask for credentials ONE BY ONE. Do not ask for everything at once.
  4. Once you have the info, use `save_connector_config` to save it.
- You can also list all supported connectors with `list_connectors`.

### 6. Custom Block Creation (NEW!)
- Create NEW custom Blockly blocks when users ask for specific functionality
- You can ONLY create new blocks, you CANNOT modify core blocks (environment, trade, ta_*, control, operator)
- All custom blocks are prefixed with "custom_" automatically
- When asked to create a block:
  1. Ask clarifying questions about what the block should do
  2. Determine the block type: "value" (outputs number), "condition" (outputs true/false), or "action"
  3. Write the Python code formula
  4. Use `create_custom_block` to save it
  5. Tell the user to check the "My Blocks" category in the toolbox

## Important Guidelines:

1. **Safety First**: Never execute trades without explicit user confirmation
2. **Explain Your Reasoning**: Before taking any action, explain what you're about to do
3. **Market Context**: When creating indicators, consider market conditions
4. **RAG First**: Before suggesting blocks, search the catalog for the best matches
5. **Connector Interview**: Be helpful and patient when asking for API keys
6. **Block Creation**: Only create NEW blocks - never try to modify existing ones

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

User: "Create a block that calculates 5-day momentum"
→ Ask: "I can create that! Should it output a percentage or absolute value?"
→ User: "percentage"
→ Use create_custom_block(
    name="momentum_5day",
    display_name="5-Day Momentum %",
    description="Calculates percentage price change over 5 days",
    block_type="value",
    output_type="Number",
    python_code="(close[-1] - close[-5]) / close[-5] * 100"
)
→ "Created! Find it in 'My Blocks' category. Refresh the page to see it."
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
        # Broker discovery tools
        research_broker_api,
        request_broker_credentials,
        save_broker_config,
        list_supported_brokers,
        # Connector tools
        save_connector_config,
        list_connectors,
        get_connector_requirements,
        # Custom block tools
        create_custom_block,
        list_custom_blocks,
        get_custom_block,
        delete_custom_block,
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
