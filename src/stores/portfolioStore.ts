/**
 * Portfolio Store - Manage user portfolio holdings
 *
 * Supports adding assets by quantity or percentage, tracks live prices,
 * and computes allocation/performance metrics.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ─── Types ───────────────────────────────────────────────────

export type AssetType = 'stock' | 'crypto' | 'gold' | 'commodity' | 'forex' | 'etf' | 'bond' | 'cash';

export type HoldingInputMode = 'quantity' | 'percentage';

export interface PortfolioHolding {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  inputMode: HoldingInputMode;
  /** Number of units held (shares, coins, oz, etc.) */
  quantity: number;
  /** Target allocation percentage (0-100) — used when inputMode is 'percentage' */
  targetPercentage: number;
  /** Average cost basis per unit */
  avgCost: number;
  /** Current live price per unit */
  currentPrice: number;
  /** Previous close price */
  previousClose: number;
  /** Timestamp of last price update */
  lastUpdated: number;
  /** Currency of the asset */
  currency: string;
  /** Notes */
  notes?: string;
  /** When added */
  addedAt: number;
}

export interface PortfolioSnapshot {
  timestamp: number;
  totalValue: number;
  holdings: { symbol: string; value: number; weight: number }[];
}

export interface PortfolioState {
  holdings: PortfolioHolding[];
  history: PortfolioSnapshot[];
  baseCurrency: string;

  // ─── Computed Getters ─────────────────────────────
  getTotalValue: () => number;
  getTotalCost: () => number;
  getTotalPnL: () => number;
  getTotalPnLPercent: () => number;
  getHoldingValue: (id: string) => number;
  getHoldingPnL: (id: string) => { pnl: number; pnlPercent: number };
  getAllocations: () => { symbol: string; name: string; assetType: AssetType; value: number; weight: number; color: string }[];
  getByAssetType: () => Record<AssetType, PortfolioHolding[]>;
  getDayChange: () => { change: number; changePercent: number };

  // ─── Actions ──────────────────────────────────────
  addHolding: (holding: Omit<PortfolioHolding, 'id' | 'currentPrice' | 'previousClose' | 'lastUpdated' | 'addedAt'>) => void;
  updateHolding: (id: string, updates: Partial<PortfolioHolding>) => void;
  removeHolding: (id: string) => void;
  updatePrice: (symbol: string, price: number, previousClose?: number) => void;
  updatePrices: (prices: Record<string, { price: number; previousClose?: number }>) => void;
  setBaseCurrency: (currency: string) => void;
  takeSnapshot: () => void;
  clearHistory: () => void;
  importHoldings: (holdings: PortfolioHolding[]) => void;
}

// ─── Color palette for pie chart ────────────────────────────

const ASSET_COLORS: Record<AssetType, string> = {
  stock: '#3b82f6',
  crypto: '#f59e0b',
  gold: '#eab308',
  commodity: '#f97316',
  forex: '#8b5cf6',
  etf: '#06b6d4',
  bond: '#64748b',
  cash: '#22c55e',
};

const CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#6366f1',
  '#a855f7', '#14b8a6', '#e11d48', '#0ea5e9', '#d946ef',
];

// ─── Store ──────────────────────────────────────────────────

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      holdings: [],
      history: [],
      baseCurrency: 'USD',

      // ─── Getters ──────────────────────

      getTotalValue: () => {
        return get().holdings.reduce((sum, h) => {
          const price = h.currentPrice || h.avgCost;
          return sum + h.quantity * price;
        }, 0);
      },

      getTotalCost: () => {
        return get().holdings.reduce((sum, h) => sum + h.quantity * h.avgCost, 0);
      },

      getTotalPnL: () => {
        const totalValue = get().getTotalValue();
        const totalCost = get().getTotalCost();
        return totalValue - totalCost;
      },

      getTotalPnLPercent: () => {
        const cost = get().getTotalCost();
        if (cost === 0) return 0;
        return (get().getTotalPnL() / cost) * 100;
      },

      getHoldingValue: (id) => {
        const h = get().holdings.find((h) => h.id === id);
        if (!h) return 0;
        return h.quantity * (h.currentPrice || h.avgCost);
      },

      getHoldingPnL: (id) => {
        const h = get().holdings.find((h) => h.id === id);
        if (!h) return { pnl: 0, pnlPercent: 0 };
        const value = h.quantity * (h.currentPrice || h.avgCost);
        const cost = h.quantity * h.avgCost;
        const pnl = value - cost;
        const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
        return { pnl, pnlPercent };
      },

      getAllocations: () => {
        const totalValue = get().getTotalValue();
        if (totalValue === 0) return [];
        return get().holdings.map((h, i) => {
          const value = h.quantity * (h.currentPrice || h.avgCost);
          return {
            symbol: h.symbol,
            name: h.name,
            assetType: h.assetType,
            value,
            weight: (value / totalValue) * 100,
            color: CHART_COLORS[i % CHART_COLORS.length],
          };
        });
      },

      getByAssetType: () => {
        const groups: Record<AssetType, PortfolioHolding[]> = {
          stock: [], crypto: [], gold: [], commodity: [],
          forex: [], etf: [], bond: [], cash: [],
        };
        get().holdings.forEach((h) => {
          if (groups[h.assetType]) groups[h.assetType].push(h);
        });
        return groups;
      },

      getDayChange: () => {
        let change = 0;
        get().holdings.forEach((h) => {
          if (h.previousClose && h.currentPrice) {
            change += (h.currentPrice - h.previousClose) * h.quantity;
          }
        });
        const totalValue = get().getTotalValue();
        const changePercent = totalValue > 0 ? (change / (totalValue - change)) * 100 : 0;
        return { change, changePercent };
      },

      // ─── Actions ──────────────────────

      addHolding: (holding) => {
        const newHolding: PortfolioHolding = {
          ...holding,
          id: `${holding.symbol}-${Date.now()}`,
          currentPrice: holding.avgCost,
          previousClose: holding.avgCost,
          lastUpdated: Date.now(),
          addedAt: Date.now(),
        };
        set((state) => ({
          holdings: [...state.holdings, newHolding],
        }));
      },

      updateHolding: (id, updates) => {
        set((state) => ({
          holdings: state.holdings.map((h) =>
            h.id === id ? { ...h, ...updates } : h
          ),
        }));
      },

      removeHolding: (id) => {
        set((state) => ({
          holdings: state.holdings.filter((h) => h.id !== id),
        }));
      },

      updatePrice: (symbol, price, previousClose) => {
        set((state) => ({
          holdings: state.holdings.map((h) =>
            h.symbol === symbol
              ? {
                  ...h,
                  currentPrice: price,
                  previousClose: previousClose ?? h.previousClose,
                  lastUpdated: Date.now(),
                }
              : h
          ),
        }));
      },

      updatePrices: (prices) => {
        set((state) => ({
          holdings: state.holdings.map((h) => {
            const priceData = prices[h.symbol];
            if (!priceData) return h;
            return {
              ...h,
              currentPrice: priceData.price,
              previousClose: priceData.previousClose ?? h.previousClose,
              lastUpdated: Date.now(),
            };
          }),
        }));
      },

      setBaseCurrency: (currency) => set({ baseCurrency: currency }),

      takeSnapshot: () => {
        const totalValue = get().getTotalValue();
        const snapshot: PortfolioSnapshot = {
          timestamp: Date.now(),
          totalValue,
          holdings: get().holdings.map((h) => ({
            symbol: h.symbol,
            value: h.quantity * (h.currentPrice || h.avgCost),
            weight: totalValue > 0 ? ((h.quantity * (h.currentPrice || h.avgCost)) / totalValue) * 100 : 0,
          })),
        };
        set((state) => ({
          history: [...state.history, snapshot].slice(-365), // keep last 365 snapshots
        }));
      },

      clearHistory: () => set({ history: [] }),

      importHoldings: (holdings) => set({ holdings }),
    }),
    {
      name: 'fyer-portfolio',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export { ASSET_COLORS, CHART_COLORS };
export default usePortfolioStore;
