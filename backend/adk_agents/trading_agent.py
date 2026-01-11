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
from .tools.market_data_tools import (
    get_historical_data,
    get_company_profile,
    get_financial_summary,
)
from .tools.technical_analysis_tools import (
    get_technical_summary,
    calculate_pivot_points,
)
from .tools.planning_tools import (
    run_monte_carlo_simulation,
    calculate_position_sizing,
    generate_trading_plan_template,
)
from .tools.notebook_tools import (
    save_note,
    read_note,
    list_notes,
    append_to_note,
)
from .tools.portfolio_tools import (
    calculate_correlation_matrix,
    calculate_portfolio_beta,
)
from .tools.risk_tools import (
    calculate_risk_metrics,
)
from .tools.pattern_recognition_tools import (
    scan_candlestick_patterns,
)
from .tools.web_scraper_tools import (
    scrape_url_text,
)

# Main Trading Agent
trading_agent = Agent(
    name="trading_agent",
    model="gemini-2.0-flash",
    description="AI trading assistant that can analyze markets, create custom indicators, execute trades, and manage integrations",
    instruction="""You are an expert AI trading assistant with access to powerful tools.

## Your Capabilities:

### 1. Market Research (Enhanced)
- Search for real-time market news about any symbol
- Get detailed historical price data with `get_historical_data`
- Analyze company fundamentals (P/E, Market Cap, financials) with `get_company_profile`
- Check financial health with `get_financial_summary`
- Analyze market sentiment for topics
- Check upcoming economic events

### 2. Technical Analysis (Enhanced)
- Get comprehensive technical study (RSI, MACD, BB, MA) with `get_technical_summary`
- Calculate key support/resistance and pivot points with `calculate_pivot_points`
- Analyze trends and key levels automatically

### 3. Planning & Simulation (New)
- Simulate strategy performance with `run_monte_carlo_simulation` to estimate risk of ruin
- Calculate correct position sizes with `calculate_position_sizing`
- Create structured trading plans with `generate_trading_plan_template`

### 5. Portfolio Management (New)
- Check correlation between assets with `calculate_correlation_matrix` to ensure diversification
- Calculate portfolio beta with `calculate_portfolio_beta` to understand market volatility exposure
- Advise on portfolio construction based on these metrics

### 6. Quantitative Analysis (New)
- Calculate Value at Risk (VaR) and CVaR with `calculate_risk_metrics`
- Evaluate asset performance using Sharpe and Sortino ratios
- Provide institutional-grade risk assessment

### 7. Pattern Recognition (New)
- Detect candlestick patterns (Doji, Hammer, Engulfing) with `scan_candlestick_patterns`
- Identify potential reversals or continuations automatically via price action

### 8. Web Research (New)
- Read content from specific URLs with `scrape_url_text`
- Analyze external news articles, documentation, or reports

### 9. Research Notebook (Persistent Memory)
- Save important findings and plans with `save_note`
- Retrieve past research with `read_note`
- Keep a running log of market observations using `append_to_note`
- ALWAYS check existing notes on a topic before starting new research

### 5. Trade Execution (USE WITH CAUTION)
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
2. **Deep Dive First**: When asked about a stock, use `get_company_profile` and `get_historical_data` to give a comprehensive answer BEFORE creating a strategy.
3. **Market Context**: When creating indicators, consider market conditions
4. **RAG First**: Before suggesting blocks, search the catalog for the best matches
5. **Connector Interview**: Be helpful and patient when asking for API keys
6. **Block Creation**: Only create NEW blocks - never try to modify existing ones

## Example Interactions:

User: "Analyze Apple stock"
→ Use get_company_profile("AAPL") AND get_historical_data("AAPL", period="1mo")
→ "Apple is a tech giant in the Consumer Electronics sector with a P/E of 30..."

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
        # Market Data tools (New)
        get_historical_data,
        get_company_profile,
        get_financial_summary,
        # Technical Analysis tools (New)
        get_technical_summary,
        calculate_pivot_points,
        # Planning tools (New)
        run_monte_carlo_simulation,
        calculate_position_sizing,
        generate_trading_plan_template,
        # Memory/Notebook tools (New)
        save_note,
        read_note,
        list_notes,
        append_to_note,
        # Portfolio tools (New)
        calculate_correlation_matrix,
        calculate_portfolio_beta,
        # Quantitative Risk tools (New)
        calculate_risk_metrics,
        # Pattern Recognition tools (New)
        scan_candlestick_patterns,
        # Web Search tools (New)
        scrape_url_text,
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
