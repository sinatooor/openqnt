/**
 * Portfolio Store - Manage user portfolio holdings
 *
 * Each holding is backed by tax lots: every buy creates a Lot, every sell
 * consumes lots under a configurable cost-basis method (FIFO/LIFO/HIFO/AVERAGE)
 * and writes a RealizedSale. Legacy holdings (added before lots existed) are
 * lazily migrated to a single synthetic lot the first time they are mutated.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useAuditStore } from './auditStore';

// ─── Types ───────────────────────────────────────────────────

export type AssetType = 'stock' | 'crypto' | 'gold' | 'commodity' | 'forex' | 'etf' | 'bond' | 'cash';

export type HoldingInputMode = 'quantity' | 'percentage';

export type CostBasisMethod = 'FIFO' | 'LIFO' | 'HIFO' | 'AVERAGE';

/** A single buy event. The lot is the unit of cost-basis accounting. */
export interface Lot {
  id: string;
  /** Total units originally purchased in this lot. */
  qty: number;
  /** Cost basis per unit, excluding fees (fees tracked separately for transparency). */
  price: number;
  /** Buy-side fees/commissions for this lot, in the holding's currency. */
  fees: number;
  /** When the lot was opened (ms epoch). Drives short- vs long-term tax classification. */
  openedAt: number;
  /** Units already sold from this lot. Lot is fully closed when closedQty === qty. */
  closedQty: number;
}

/** A single sell event, recording realized P&L and which lots it consumed. */
export interface RealizedSale {
  id: string;
  holdingId: string;
  /** Account scope captured at time of sale — survives later holding deletion. */
  accountId?: string;
  symbol: string;
  /** Units sold. */
  qty: number;
  /** Sale price per unit. */
  salePrice: number;
  /** Sell-side fees. */
  fees: number;
  /** Net proceeds = qty * salePrice - fees. */
  proceeds: number;
  /** Total cost basis of consumed lots (incl. capitalized buy fees pro-rata). */
  costBasis: number;
  /** proceeds - costBasis. */
  realizedPnL: number;
  /** When the sale closed (ms epoch). */
  closedAt: number;
  /** Per-lot detail of what was consumed. Used for tax reporting. */
  consumed: {
    lotId: string;
    qty: number;
    pricePerUnit: number;
    openedAt: number;
    daysHeld: number;
    /** US tax convention: long-term if held >365 days. */
    longTerm: boolean;
  }[];
}

export interface PortfolioHolding {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  inputMode: HoldingInputMode;
  /** Open units (sum across open lots when lots[] is present). */
  quantity: number;
  /** Target allocation percentage (0-100) — used when inputMode is 'percentage' */
  targetPercentage: number;
  /** Average cost basis per unit across open lots (or legacy single value). */
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
  /**
   * Tax lots backing this holding. Optional for migration: a holding without
   * lots is treated as a single synthetic lot at avgCost; the first mutation
   * (buy/sell) materializes that lot.
   */
  lots?: Lot[];
  /**
   * Account scope. Optional for backward compat — pre-account holdings are
   * implicitly assigned to 'default' when the active-account filter applies.
   */
  accountId?: string;
  /**
   * Source broker for this holding. 'manual' = user-added in the UI.
   * Optional for backward compat — undefined treated as 'manual'. Used to
   * partition the Portfolio page into per-broker sections and to scope
   * re-import / merge operations safely.
   */
  broker?: 'avanza' | 'ibkr' | 'manual';
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
  realizedSales: RealizedSale[];
  costBasisMethod: CostBasisMethod;

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

  /** Total realized P&L since inception. */
  getRealizedPnL: () => number;
  /** Realized P&L for the current calendar year (UTC). */
  getRealizedPnLYTD: () => number;
  /** Realized P&L split by US tax holding period: short ≤ 365 days, long > 365 days. */
  getRealizedByPeriod: () => { shortTerm: number; longTerm: number };
  /**
   * US 30-day wash-sale detection. A loss sale is flagged when a buy on the
   * same holding (≈ same symbol; "substantially identical" is approximated)
   * occurred within ±30 calendar days of the sale's close. Returns one entry
   * per affected sale with the disallowed loss amount and the matching lots.
   */
  getWashSaleAlerts: () => {
    saleId: string;
    symbol: string;
    closedAt: number;
    realizedLoss: number;
    disallowedLoss: number;
    replacementLotIds: string[];
  }[];

  // ─── Actions ──────────────────────────────────────
  addHolding: (holding: Omit<PortfolioHolding, 'id' | 'currentPrice' | 'previousClose' | 'lastUpdated' | 'addedAt' | 'lots'>) => void;
  updateHolding: (id: string, updates: Partial<PortfolioHolding>) => void;
  removeHolding: (id: string) => void;
  updatePrice: (symbol: string, price: number, previousClose?: number) => void;
  updatePrices: (prices: Record<string, { price: number; previousClose?: number }>) => void;
  setBaseCurrency: (currency: string) => void;
  takeSnapshot: () => void;
  clearHistory: () => void;
  importHoldings: (holdings: PortfolioHolding[]) => void;

  /** Record a buy: appends a new lot and refreshes derived qty/avgCost. */
  buy: (holdingId: string, qty: number, price: number, fees?: number, ts?: number) => void;
  /**
   * Record a sell: consumes open lots per the active costBasisMethod, writes a
   * RealizedSale, and refreshes derived qty/avgCost. Returns the sale or null
   * if there was insufficient open quantity.
   */
  sell: (holdingId: string, qty: number, price: number, fees?: number, ts?: number) => RealizedSale | null;
  setCostBasisMethod: (method: CostBasisMethod) => void;
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

// ─── Lot helpers (pure) ──────────────────────────────────────

const MS_PER_DAY = 86_400_000;
const LONG_TERM_DAYS = 365;

function makeLot(qty: number, price: number, fees: number, openedAt: number): Lot {
  return {
    id: `lot-${openedAt}-${Math.random().toString(36).slice(2, 8)}`,
    qty,
    price,
    fees,
    openedAt,
    closedQty: 0,
  };
}

/** Lazily turn a legacy holding into one with lots — single lot at addedAt. */
function ensureLots(h: PortfolioHolding): Lot[] {
  if (h.lots && h.lots.length > 0) return h.lots;
  if (h.quantity > 0 && h.avgCost > 0) {
    return [makeLot(h.quantity, h.avgCost, 0, h.addedAt || Date.now())];
  }
  return [];
}

function openQty(lot: Lot): number {
  return Math.max(0, lot.qty - lot.closedQty);
}

/** Order open lots for consumption per the chosen cost-basis method. */
function orderLotsForSale(lots: Lot[], method: CostBasisMethod): Lot[] {
  const open = lots.filter((l) => openQty(l) > 0);
  switch (method) {
    case 'FIFO':
      return open.sort((a, b) => a.openedAt - b.openedAt);
    case 'LIFO':
      return open.sort((a, b) => b.openedAt - a.openedAt);
    case 'HIFO':
      return open.sort((a, b) => b.price - a.price);
    case 'AVERAGE':
      // AVERAGE consumption order doesn't matter for the realized total since
      // every open lot's effective cost basis is the same weighted average.
      // We still iterate FIFO to keep openedAt info on the consumed entries.
      return open.sort((a, b) => a.openedAt - b.openedAt);
  }
}

/** Recompute (qty, avgCost) from lots. avgCost is the weighted avg over OPEN lots. */
function recomputeDerived(lots: Lot[]): { quantity: number; avgCost: number } {
  let qty = 0;
  let costSum = 0;
  for (const l of lots) {
    const open = openQty(l);
    if (open <= 0) continue;
    qty += open;
    // Pro-rate the lot's buy fees over its original qty so the per-share
    // cost basis stays stable as the lot is partially consumed.
    const perUnit = l.price + (l.qty > 0 ? l.fees / l.qty : 0);
    costSum += open * perUnit;
  }
  return {
    quantity: qty,
    avgCost: qty > 0 ? costSum / qty : 0,
  };
}

// ─── Store ──────────────────────────────────────────────────

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      holdings: [],
      history: [],
      baseCurrency: 'USD',
      realizedSales: [],
      costBasisMethod: 'FIFO',

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

      getRealizedPnL: () => {
        return get().realizedSales.reduce((sum, s) => sum + s.realizedPnL, 0);
      },

      getRealizedPnLYTD: () => {
        const yearStart = Date.UTC(new Date().getUTCFullYear(), 0, 1);
        return get().realizedSales.reduce(
          (sum, s) => (s.closedAt >= yearStart ? sum + s.realizedPnL : sum),
          0
        );
      },

      getWashSaleAlerts: () => {
        const WASH_WINDOW_MS = 30 * MS_PER_DAY;
        const out: ReturnType<PortfolioState['getWashSaleAlerts']> = [];
        const state = get();
        for (const sale of state.realizedSales) {
          if (sale.realizedPnL >= 0) continue;
          const holding = state.holdings.find((h) => h.id === sale.holdingId);
          // Replacement lots: same holding, opened within ±30 days of the sale
          // closing, that are NOT among the lots consumed by this sale.
          const consumedIds = new Set(sale.consumed.map((c) => c.lotId));
          const replacements = (holding?.lots ?? []).filter(
            (l) =>
              !consumedIds.has(l.id) &&
              Math.abs(l.openedAt - sale.closedAt) <= WASH_WINDOW_MS
          );
          if (replacements.length === 0) continue;
          // Disallowed loss = pro-rata to replacement shares vs sold shares.
          const replacementQty = replacements.reduce((s, l) => s + l.qty, 0);
          const ratio = Math.min(1, replacementQty / Math.max(sale.qty, 1e-9));
          const disallowed = -sale.realizedPnL * ratio;
          out.push({
            saleId: sale.id,
            symbol: sale.symbol,
            closedAt: sale.closedAt,
            realizedLoss: sale.realizedPnL,
            disallowedLoss: disallowed,
            replacementLotIds: replacements.map((l) => l.id),
          });
        }
        return out;
      },

      getRealizedByPeriod: () => {
        let shortTerm = 0;
        let longTerm = 0;
        for (const sale of get().realizedSales) {
          for (const c of sale.consumed) {
            // Allocate this consumed slice's contribution to the sale's overall P&L
            // proportional to its qty share. (P&L per share isn't stored per-slice;
            // proportional split is the right approximation when all slices share
            // the same sale price.)
            const shareOfSale = sale.qty > 0 ? c.qty / sale.qty : 0;
            const slicePnL = sale.realizedPnL * shareOfSale;
            if (c.longTerm) longTerm += slicePnL;
            else shortTerm += slicePnL;
          }
        }
        return { shortTerm, longTerm };
      },

      // ─── Actions ──────────────────────

      addHolding: (holding) => {
        const now = Date.now();
        const initialLot = holding.quantity > 0 && holding.avgCost > 0
          ? [makeLot(holding.quantity, holding.avgCost, 0, now)]
          : [];
        const newHolding: PortfolioHolding = {
          ...holding,
          id: `${holding.symbol}-${now}`,
          currentPrice: holding.avgCost,
          previousClose: holding.avgCost,
          lastUpdated: now,
          addedAt: now,
          lots: initialLot,
          accountId: holding.accountId ?? 'default',
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

      buy: (holdingId, qty, price, fees = 0, ts) => {
        if (qty <= 0 || price <= 0) return;
        const openedAt = ts ?? Date.now();
        const target = get().holdings.find((h) => h.id === holdingId);
        set((state) => ({
          holdings: state.holdings.map((h) => {
            if (h.id !== holdingId) return h;
            const lots = [...ensureLots(h), makeLot(qty, price, fees, openedAt)];
            const { quantity, avgCost } = recomputeDerived(lots);
            return { ...h, lots, quantity, avgCost, lastUpdated: Date.now() };
          }),
        }));
        if (target) {
          useAuditStore.getState().log({
            category: 'trade',
            summary: `Bought ${qty} ${target.symbol} @ ${price}`,
            actor: 'user',
            accountId: target.accountId,
            data: { holdingId, qty, price, fees, openedAt },
          });
        }
      },

      sell: (holdingId, qty, price, fees = 0, ts) => {
        if (qty <= 0 || price <= 0) return null;
        const closedAt = ts ?? Date.now();
        const state = get();
        const holding = state.holdings.find((h) => h.id === holdingId);
        if (!holding) return null;

        const lots = ensureLots(holding).map((l) => ({ ...l }));
        const totalOpen = lots.reduce((sum, l) => sum + openQty(l), 0);
        if (totalOpen < qty) return null;

        const method = state.costBasisMethod;
        // For AVERAGE we use the holding's current weighted-avg cost as the
        // per-unit basis; for the others we consume lot-by-lot at lot.price.
        const avgPerUnit = recomputeDerived(lots).avgCost;
        const order = orderLotsForSale(lots, method);

        let remaining = qty;
        let costBasis = 0;
        const consumed: RealizedSale['consumed'] = [];

        for (const lot of order) {
          if (remaining <= 0) break;
          const available = openQty(lot);
          if (available <= 0) continue;
          const take = Math.min(available, remaining);
          const perUnit =
            method === 'AVERAGE'
              ? avgPerUnit
              : lot.price + (lot.qty > 0 ? lot.fees / lot.qty : 0);
          costBasis += take * perUnit;
          lot.closedQty += take;
          remaining -= take;
          const daysHeld = Math.floor((closedAt - lot.openedAt) / MS_PER_DAY);
          consumed.push({
            lotId: lot.id,
            qty: take,
            pricePerUnit: perUnit,
            openedAt: lot.openedAt,
            daysHeld,
            longTerm: daysHeld > LONG_TERM_DAYS,
          });
        }

        const proceeds = qty * price - fees;
        const realizedPnL = proceeds - costBasis;
        const sale: RealizedSale = {
          id: `sale-${closedAt}-${Math.random().toString(36).slice(2, 8)}`,
          holdingId,
          accountId: holding.accountId ?? 'default',
          symbol: holding.symbol,
          qty,
          salePrice: price,
          fees,
          proceeds,
          costBasis,
          realizedPnL,
          closedAt,
          consumed,
        };

        const { quantity, avgCost } = recomputeDerived(lots);

        set((s) => ({
          holdings: s.holdings.map((h) =>
            h.id === holdingId
              ? { ...h, lots, quantity, avgCost, lastUpdated: Date.now() }
              : h
          ),
          realizedSales: [...s.realizedSales, sale],
        }));

        useAuditStore.getState().log({
          category: 'trade',
          summary: `Sold ${qty} ${holding.symbol} @ ${price} · realized ${realizedPnL.toFixed(2)}`,
          note: `Method=${method}; consumed ${consumed.length} lot${consumed.length === 1 ? '' : 's'}`,
          actor: 'user',
          accountId: holding.accountId,
          data: { saleId: sale.id, holdingId, qty, price, fees, method, realizedPnL },
        });

        return sale;
      },

      setCostBasisMethod: (method) => set({ costBasisMethod: method }),
    }),
    {
      name: 'openqwnt-portfolio',
      storage: createJSONStorage(() => localStorage),
      version: 3,
      migrate: (persisted: unknown, version) => {
        // v1 → v2: add lots[] to existing holdings, realizedSales[], costBasisMethod
        // v2 → v3: assign accountId='default' to holdings missing it
        const s = (persisted ?? {}) as Partial<PortfolioState>;
        let holdings = s.holdings ?? [];
        if (version < 2) {
          holdings = holdings.map((h) => {
            if (h.lots && h.lots.length > 0) return h;
            const lots =
              h.quantity > 0 && h.avgCost > 0
                ? [makeLot(h.quantity, h.avgCost, 0, h.addedAt || Date.now())]
                : [];
            return { ...h, lots };
          });
        }
        if (version < 3) {
          holdings = holdings.map((h) => (h.accountId ? h : { ...h, accountId: 'default' }));
        }
        return {
          ...s,
          holdings,
          realizedSales: s.realizedSales ?? [],
          costBasisMethod: s.costBasisMethod ?? 'FIFO',
        } as PortfolioState;
      },
    }
  )
);

export { ASSET_COLORS, CHART_COLORS };
export default usePortfolioStore;
