/**
 * Data-source nodes — let strategies declare which provider feeds their
 * OHLCV. The backtest engine inspects the flow for the first node with
 * `nodeType: 'dataSource'` and passes its provider + symbol overrides
 * through to `_fetch_data` in backtrader_engine.py.
 *
 * Outputs are intentionally typed as 'OHLCV' so a downstream indicator
 * node can validate that its input is a price feed (not a scalar).
 */
import { NodeCatalogItem } from '../../types';

export const DATA_SOURCE_NODES: NodeCatalogItem[] = [
  {
    type: 'yfinanceData',
    nodeType: 'dataSource',
    label: 'Yahoo Finance',
    description: 'Free OHLCV from Yahoo Finance',
    tooltip:
      'Fetches historical OHLCV from Yahoo Finance. Best for global stocks, ETFs, indices, and major crypto. Free, no API key.',
    inputs: [],
    outputs: ['OHLCV'],
    category: 'dataSources',
    subcategory: 'Market Data',
    icon: 'BarChart3',
    color: '#a855f7',
    backtestEligible: true,
    defaultData: {
      provider: 'yfinance',
      symbol: 'AAPL',
      timeframe: '1d',
    },
  },
  {
    type: 'avanzaData',
    nodeType: 'dataSource',
    label: 'Avanza',
    description: 'Nordic broker OHLCV via Avanza _api',
    tooltip:
      "Fetches OHLCV from Avanza's reverse-engineered web API. Best for Nordic listings (Stockholm, Copenhagen, Helsinki, Oslo). The orderbookId is auto-resolved by ticker or ISIN.",
    inputs: [],
    outputs: ['OHLCV'],
    category: 'dataSources',
    subcategory: 'Market Data',
    icon: 'Building2',
    color: '#06b6d4',
    backtestEligible: true,
    defaultData: {
      provider: 'avanza',
      symbol: 'VOLV-B.ST',
      timeframe: '1d',
    },
  },
  {
    type: 'fmpData',
    nodeType: 'dataSource',
    label: 'Financial Modeling Prep',
    description: 'FMP OHLCV (requires FMP_API_KEY)',
    tooltip:
      'Fetches OHLCV from Financial Modeling Prep. Better fundamentals coverage than yfinance for US equities. Requires FMP_API_KEY env var.',
    inputs: [],
    outputs: ['OHLCV'],
    category: 'dataSources',
    subcategory: 'Market Data',
    icon: 'Database',
    color: '#10b981',
    backtestEligible: true,
    defaultData: {
      provider: 'fmp',
      symbol: 'AAPL',
      timeframe: '1d',
    },
  },
  {
    type: 'avanzaPositions',
    nodeType: 'dataSource',
    label: 'Avanza Positions',
    description: 'Live portfolio positions from Avanza',
    tooltip:
      'Streams the user\'s connected Avanza account positions into the flow. Useful for portfolio-aware risk overlays. Live-only; not backtestable.',
    inputs: [],
    outputs: ['Positions'],
    category: 'dataSources',
    subcategory: 'Account',
    icon: 'Wallet',
    color: '#06b6d4',
    backtestEligible: false,
    defaultData: {
      provider: 'avanza',
      kind: 'positions',
    },
  },
  {
    type: 'avanzaWatchlist',
    nodeType: 'dataSource',
    label: 'Avanza Watchlist',
    description: 'Symbols from a saved Avanza watchlist',
    tooltip:
      'Iterates over the symbols in one of the user\'s saved Avanza watchlists. Useful as the symbol input for a multi-asset strategy. Live-only.',
    inputs: [],
    outputs: ['SymbolList'],
    category: 'dataSources',
    subcategory: 'Account',
    icon: 'List',
    color: '#06b6d4',
    backtestEligible: false,
    defaultData: {
      provider: 'avanza',
      kind: 'watchlist',
      watchlistId: '',
    },
  },
  {
    type: 'fredMacro',
    nodeType: 'dataSource',
    label: 'FRED Macro',
    description: 'St. Louis Fed macro time-series',
    tooltip:
      'Fetches macro time-series from FRED (CPI, unemployment, fed funds, GDP, etc.). Use as a regime filter or macro-overlay input. Free with FRED_API_KEY.',
    inputs: [],
    outputs: ['Series'],
    category: 'dataSources',
    subcategory: 'Macro',
    icon: 'TrendingUp',
    color: '#f59e0b',
    backtestEligible: true,
    defaultData: {
      provider: 'fred',
      seriesId: 'CPIAUCSL',
    },
  },
  {
    type: 'apiDataSource',
    nodeType: 'dataSource',
    label: 'External API',
    description: 'Fetch JSON from any configured provider (FMP, Finnhub, Polygon, ...)',
    tooltip:
      'Generic data source backed by backend/data_providers/manifest.json. Pick a provider + endpoint; the manifest resolves URL, params, and auth. Returns arbitrary JSON (not OHLCV) — pipe through a Code (Python) node to shape it. Live-only.',
    inputs: [],
    outputs: ['JSON'],
    category: 'dataSources',
    subcategory: 'External APIs',
    icon: 'Plug',
    color: '#f59e0b',
    backtestEligible: false,
    defaultData: {
      dataSourceType: 'apiDataSource',
      provider: 'fmp',
      endpoint: 'senate-trading',
      paramOverrides: { symbol: 'AAPL' },
    },
  },
];
