# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2026-01-02

### Added
- **Nordnet Integration**: Support for connecting to Nordnet broker for live trading.
- **Nordnet Client**: Dedicated Python client (`nordnet_client.py`) with Ed25519 authentication.
- **Broker Modals**: Updated `BrokerConnectModal` to handle Nordnet credentials (UUID, Private Key).
- **Backend API**: New `/api/live/nordnet/login` endpoint for secure authentication.

### Changed
- **Strategy Runner**: Refactored `StrategyRunner` to use an adapter pattern, supporting multiple brokers (IG, Nordnet) dynamically.
- **Profile Modal**: Added Nordnet to the list of available brokers and integrated the connection flow.
- **Live Trading Router**: Updated `/api/live/start` to accept a `broker` parameter for selecting the execution client.

### Fixed
- **Blockly Sidebar**: Resolved block overlap issue in "My Blocks" by moving custom blocks to a dedicated "Custom" category.
- **Category Navigation**: Fixed bug where clicking other categories after "Custom" stopped working by only showing "Custom" when blocks exist.
- **Custom Block Loader**: Made loader robust against malformed or legacy block definitions to prevent panel crashes.

## [1.5.0] - 2025-12-31

### Added
- TradingView Market Summary ticker bar at top of Live Trading Dashboard
- FlexLayout integration for resizable panels in modals
- TradingViewAdvancedChart component with full charting features
- TradingViewMarketOverview component with multi-asset tabs

### Changed
- BacktestVisualizationModal now uses FlexLayout with Chart/Summary/Trades panels
- FloatingChartModal upgraded with resizable TradingView widgets
- Increased modal heights to accommodate ticker bar

## [1.4.0] - 2025-12-30

### Fixed
- Nautilus backtest pipeline now correctly routes template strategies
- Strategy code generation properly handles tuple return from JSON generator
- Visualization HTML now generated in simple backtest fallback
- Fixed traceback import shadowing in nautilus_adapter.py

### Added
- Fallback visualization for simple backtest engine
- Better error logging for backtest failures

## [1.3.0] - 2025-12-29

### Added
- ProfileModal with user authentication and saved strategies
- Connector/Broker integration panel with 17+ broker logos
- Custom block creation via AI chat
- ADK trading_agent connected to frontend Chat mode
- Nautilus HTML visualization with Drawdown, Heatmap, Distribution charts

### Changed
- Modal centering and z-index management improvements
- Smooth corner unsnap behavior for draggable modals

## [1.2.0] - 2025-12-28

### Added
- Modular BlocklyWorkspace with extracted components
- WorkspaceToolbar and CodeViewPanel components
- Backtest result enhancements: trade analytics, duration, cumulative P&L
- Trade filters and Summary tab with secondary metrics

### Changed
- Settings Panel refactored with unified BacktestingPanel
- Strategy button replaced with Settings button

## [1.1.0] - 2025-12-27

### Added
- Strategy cloning and versioning (objective 017)
- Monte Carlo simulation for strategy robustness (objective 016)
- Walk-forward validation in backtester (objective 015)
- Local database caching for market data (objective 014)
- Strategy performance report generator (objective 013)
- Multi-timeframe indicator support (objective 012)

## [1.0.0] - 2025-12-26

### Added
- Initial release of PPM (Personal Portfolio Manager)
- Blockly-based visual strategy builder
- TradingView chart integration
- Multiple backtest engines (VectorBT, NautilusTrader, PyGenerator)
- AI-powered strategy generation via DeepSeek/Gemini
- Real-time code preview panel
- Strategy templates library
- Risk management blocks
- Technical indicator blocks (SMA, EMA, RSI, MACD, etc.)
- Multi-timeframe support
- Drag-and-drop workspace with snap grid

### Infrastructure
- React + TypeScript + Vite frontend
- Python FastAPI backend
- Supabase for authentication and storage
- ChromaDB for RAG embeddings
