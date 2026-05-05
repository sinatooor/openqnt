/**
 * dataSourceStore
 * ---------------
 * Tracks which market-data provider the Terminal and other read-only screens
 * should prefer. Wired into:
 *   - src/features/terminal/apiClient.ts  (appends ?source= on every call)
 *   - src/features/terminal/useTerminalData.ts (re-fetches when source flips)
 *   - src/pages/Settings.tsx  (radio group)
 *
 * Default `auto` keeps the existing backend fallback chain
 * (yfinance -> SEC -> FMP -> mock). Picking a specific source pins the
 * backend to that provider; if that provider can't fulfil the request the
 * backend still falls back, but it's tried first.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type MarketDataSource = 'auto' | 'yfinance' | 'avanza' | 'fmp';

export const MARKET_DATA_SOURCES: { id: MarketDataSource; label: string; description: string }[] = [
  { id: 'auto', label: 'Auto', description: 'Backend chooses best available provider' },
  { id: 'yfinance', label: 'Yahoo Finance', description: 'Free, broad coverage, US-centric' },
  { id: 'avanza', label: 'Avanza', description: 'Nordic stockbroker, requires connection' },
  { id: 'fmp', label: 'Financial Modeling Prep', description: 'Fundamentals-heavy, requires API key' },
];

interface DataSourceStore {
  source: MarketDataSource;
  setSource: (source: MarketDataSource) => void;
}

export const useDataSourceStore = create<DataSourceStore>()(
  persist(
    (set) => ({
      source: 'auto',
      setSource: (source) => set({ source }),
    }),
    {
      name: 'openqwnt-data-source',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/**
 * Non-reactive read for use outside React components (e.g. inside the
 * Terminal API client). Always returns the live persisted value.
 */
export function getActiveDataSource(): MarketDataSource {
  return useDataSourceStore.getState().source;
}
