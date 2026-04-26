# FinceptTerminal vs fyer Feature Gap Analysis

Date: 2026-03-25
Reference repo cloned at: /Users/sina/project-fire/FinceptTerminal_ref

## Important note
- FinceptTerminal is a Qt/C++ desktop app.
- fyer is a React/TypeScript web app.
- The files below are best used as feature/logic reference, not direct copy-paste.

## High-priority gaps (based on your request)

### 1) Missing News tab/screen (explicitly requested)
Status in fyer:
- No News route in src/App.tsx
- No News item in src/components/AppNavBar.tsx
- No dedicated News page/component in src/pages

Copy-from reference files:
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/news/NewsScreen.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/news/NewsScreen.h
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/news/NewsCommandBar.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/news/NewsFeedPanel.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/news/NewsFeedModel.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/news/NewsDetailPanel.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/news/NewsSidePanel.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/news/NewsTickerStrip.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/services/news/NewsService.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/services/news/NewsNlpService.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/services/news/NewsCorrelationService.cpp

Where to implement in fyer:
- src/App.tsx (add /news route)
- src/components/AppNavBar.tsx (add News nav item)
- src/pages/News.tsx (new)
- src/services/news.ts (new API service)

---

### 2) Dashboard lacks modular widget architecture
Status in fyer:
- Dashboard is a static page with fixed sections (stats, strategies, quick actions, health, portfolio snapshot, recent executions)
- No add/remove/reorder widget system
- No layout templates
- No persisted dashboard layout

Copy-from reference files:
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/DashboardScreen.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/canvas/DashboardCanvas.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/canvas/WidgetRegistry.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/canvas/DashboardTemplates.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/canvas/AddWidgetDialog.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/canvas/TemplatePicker.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/storage/repositories/DashboardLayoutRepository.cpp

Where to implement in fyer:
- src/pages/Dashboard.tsx (replace with composition layer)
- src/stores (new dashboard layout store)
- src/features/dashboard (new folder for canvas, registry, templates, widgets)

---

### 3) Dashboard is missing many concrete widgets
Status in fyer:
- No dedicated widget cards for market/news/calendar/watchlist/screener/risk modules

Copy-from reference files (widget-level):
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/widgets/NewsWidget.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/widgets/WatchlistWidget.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/widgets/EconomicCalendarWidget.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/widgets/ScreenerWidget.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/widgets/RiskMetricsWidget.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/widgets/TopMoversWidget.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/widgets/MarketSentimentWidget.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/widgets/PortfolioSummaryWidget.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/widgets/PerformanceWidget.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/widgets/QuickTradeWidget.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/widgets/SectorHeatmapWidget.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/widgets/StockQuoteWidget.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/dashboard/widgets/VideoPlayerWidget.cpp

Where to implement in fyer:
- src/features/dashboard/widgets/*.tsx (new)
- src/pages/Dashboard.tsx (render from widget registry)

---

## Medium-priority gaps

### 4) Missing standalone Watchlist screen
Status in fyer:
- No dedicated watchlist route/page

Copy-from reference files:
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/watchlist/WatchlistScreen.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/watchlist/WatchlistScreen.h

Where to implement in fyer:
- src/pages/Watchlist.tsx (new)
- src/App.tsx and src/components/AppNavBar.tsx (route + nav)

### 5) Portfolio module is less deep than FinceptTerminal
Status in fyer:
- Strong base portfolio page exists, but no separate advanced views for optimization/planning/risk/reports/economics

Copy-from reference files:
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/portfolio/PortfolioScreen.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/portfolio/views/PerformanceRiskView.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/portfolio/views/RiskManagementView.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/portfolio/views/PortfolioOptimizationView.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/portfolio/views/PlanningView.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/portfolio/views/ReportsView.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/portfolio/views/EconomicsView.cpp

Where to implement in fyer:
- src/pages/Portfolio.tsx (expand tabs)
- src/features/portfolio/views/*.tsx (new)

### 6) Missing dedicated Economics page
Status in fyer:
- Economics appears only as generic utility contexts, no dedicated economics route/page

Copy-from reference files:
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/economics/EconomicsScreen.cpp
- /Users/sina/project-fire/FinceptTerminal_ref/fincept-qt/src/screens/economics/EconomicsScreen.h

Where to implement in fyer:
- src/pages/Economics.tsx (new)
- src/App.tsx and src/components/AppNavBar.tsx (route + nav)

---

## Extensive Expansion Gaps (Domain-Specific Screens)

FinceptTerminal has a vast array of specialized research and trading screens that `fyer` currently completely lacks. 

### 7) Asset-Class Specific Trading & Overviews
Status in fyer: Only generic portfolio & strategy builder available.
Missing Screens:
- **Crypto Trading**: `src/screens/crypto_trading/CryptoTradingScreen.cpp`
- **Equity Trading**: `src/screens/equity_trading/EquityTradingScreen.cpp`
- **Derivatives Options**: `src/screens/derivatives/DerivativesScreen.cpp`
- **Polymarket/Prediction Markets**: `src/screens/polymarket/PolymarketScreen.cpp`
- **Asia Markets**: `src/screens/asia_markets/AsiaMarketsScreen.cpp`
- **Alpha Arena** (Strategy competition): `src/screens/alpha_arena/AlphaArenaScreen.cpp`

### 8) Specialized Data Integrations & Quant Views
Status in fyer: Has a solid "Research" tab but lacks specialized dashboards for unique data pipelines.
Missing Screens:
- **Gov Data** (Congressional trading, treasury data): `src/screens/gov_data/GovDataScreen.cpp`
- **Alternative Investments**: `src/screens/alt_investments/AltInvestmentsScreen.cpp`
- **M&A Analytics** (Mergers and Acquisitions): `src/screens/ma_analytics/MAAnalyticsScreen.cpp`
- **Geopolitics Hub** (Conflict monitors, relationship mapping): `src/screens/geopolitics/GeopoliticsScreen.cpp`
- **Maritime/Shipping Data**: `src/screens/maritime/MaritimeScreen.cpp`
- **DBnomics / AKShare**: `src/screens/dbnomics/DBnomicsScreen.cpp`, `src/screens/akshare/AkShareScreen.cpp`
- **QuantLib Tooling**: `src/screens/quantlib/QuantLibScreen.cpp`
- **Surface Analytics** (3D charting & order book mapping): `src/screens/surface_analytics/SurfaceAnalyticsScreen.cpp`
- **Trade Pattern Viz**: `src/screens/trade_viz/TradeVizScreen.cpp`

### 9) Productivity, Community & Workflow Tools
Status in fyer: Missing entirely.
Missing Screens:
- **Financial Spreadsheet / Excel Sync**: `src/screens/excel/ExcelScreen.cpp`
- **Report Builder / Canvas**: `src/screens/report_builder/ReportBuilderScreen.cpp`
- **Forum / Social Feed**: `src/screens/forum/ForumScreen.cpp`
- **Notes / Workspaces**: `src/screens/notes/NotesScreen.cpp`
- **Code Editor** (Integrated script editing): `src/screens/code_editor/CodeEditorScreen.cpp`
- **File Manager**: `src/screens/file_manager/FileManagerScreen.cpp`
- **MCP Servers Management**: `src/screens/mcp_servers/McpServersScreen.cpp`

## Quick implementation order (recommended)
1. Add News screen + nav + route.
2. Convert Dashboard into widget registry architecture.
3. Implement first 6 widgets: News, Watchlist, Economic Calendar, Top Movers, Risk Metrics, Screener.
4. Add saved dashboard layouts and templates.
5. Add standalone Watchlist/Economics pages.
6. Gradually introduce one specialized tab (e.g. Geopolitics or Gov Data) by wrapping existing API services.

## Snapshot of what fyer already has (good foundation)
- Strategy Builder flow and execution pipeline pages.
- Research page with quant tools (MCPT, Monte Carlo, HMM, WFO, VaR, cointegration, stress).
- Portfolio page with holdings, allocation, PnL and charts.
- Agent config screen.

This means the highest-value delta is UI/product depth: news intelligence + modular dashboard + richer market widgets.
