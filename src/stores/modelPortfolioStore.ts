/**
 * Model portfolio store — target weight sets that an account can be measured
 * against and rebalanced into.
 *
 * Examples: 60/40 (60% equity / 40% bond), All-Weather (Bridgewater-style risk
 * parity), 100% equity, custom client-specific allocations. Each model is a
 * list of {symbol, targetWeight} that sums to ~100%.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ModelTarget {
  symbol: string;
  /** Asset name (display only). */
  name: string;
  /** Target weight as a fraction 0..1 (or 0..100, see `weightUnit`). */
  weight: number;
  /** Optional band — drift > tolerance triggers a rebalance proposal. */
  toleranceBp?: number;
  notes?: string;
}

export interface ModelPortfolio {
  id: string;
  name: string;
  description?: string;
  /** Whether weights are stored as fractions (0–1) or percents (0–100). */
  weightUnit: 'fraction' | 'percent';
  /** Default tolerance band when target.toleranceBp is missing. */
  defaultToleranceBp: number;
  targets: ModelTarget[];
  createdAt: number;
  updatedAt: number;
}

interface ModelState {
  models: ModelPortfolio[];
  /** Account-id → modelId mapping; null/missing means no model attached. */
  attachments: Record<string, string>;

  addModel: (m: Omit<ModelPortfolio, 'id' | 'createdAt' | 'updatedAt'>) => ModelPortfolio;
  updateModel: (id: string, updates: Partial<ModelPortfolio>) => void;
  removeModel: (id: string) => void;
  setTargets: (modelId: string, targets: ModelTarget[]) => void;
  attach: (accountId: string, modelId: string | null) => void;
  getForAccount: (accountId: string) => ModelPortfolio | null;
}

const SAMPLE_60_40: ModelPortfolio = {
  id: 'preset-60-40',
  name: '60/40 Classic',
  description: 'Vanilla equity/bond. SPY/AGG via two ETFs.',
  weightUnit: 'percent',
  defaultToleranceBp: 200,
  targets: [
    { symbol: 'SPY', name: 'S&P 500 ETF', weight: 60 },
    { symbol: 'AGG', name: 'US Aggregate Bond ETF', weight: 40 },
  ],
  createdAt: 0,
  updatedAt: 0,
};

const SAMPLE_THREE_FUND: ModelPortfolio = {
  id: 'preset-three-fund',
  name: 'Three-Fund (Bogleheads)',
  description: 'US total market, ex-US, total bond.',
  weightUnit: 'percent',
  defaultToleranceBp: 200,
  targets: [
    { symbol: 'VTI', name: 'US Total Market', weight: 50 },
    { symbol: 'VXUS', name: 'Ex-US', weight: 30 },
    { symbol: 'BND', name: 'US Total Bond', weight: 20 },
  ],
  createdAt: 0,
  updatedAt: 0,
};

const SAMPLE_PERMANENT: ModelPortfolio = {
  id: 'preset-permanent',
  name: 'Permanent Portfolio (Browne)',
  description: 'Equal-weight stocks/bonds/gold/cash for all-weather robustness.',
  weightUnit: 'percent',
  defaultToleranceBp: 250,
  targets: [
    { symbol: 'VTI', name: 'US Total Market', weight: 25 },
    { symbol: 'TLT', name: 'Long Treasuries', weight: 25 },
    { symbol: 'GLD', name: 'Gold', weight: 25 },
    { symbol: 'BIL', name: 'T-Bills', weight: 25 },
  ],
  createdAt: 0,
  updatedAt: 0,
};

export const useModelPortfolioStore = create<ModelState>()(
  persist(
    (set, get) => ({
      models: [SAMPLE_60_40, SAMPLE_THREE_FUND, SAMPLE_PERMANENT],
      attachments: {},

      addModel: (m) => {
        const now = Date.now();
        const id = `mp-${now}-${Math.random().toString(36).slice(2, 8)}`;
        const created: ModelPortfolio = { ...m, id, createdAt: now, updatedAt: now };
        set((s) => ({ models: [...s.models, created] }));
        return created;
      },

      updateModel: (id, updates) =>
        set((s) => ({
          models: s.models.map((m) => (m.id === id ? { ...m, ...updates, updatedAt: Date.now() } : m)),
        })),

      removeModel: (id) =>
        set((s) => ({
          models: s.models.filter((m) => m.id !== id),
          attachments: Object.fromEntries(
            Object.entries(s.attachments).filter(([, mid]) => mid !== id)
          ),
        })),

      setTargets: (modelId, targets) =>
        set((s) => ({
          models: s.models.map((m) =>
            m.id === modelId ? { ...m, targets, updatedAt: Date.now() } : m
          ),
        })),

      attach: (accountId, modelId) =>
        set((s) => {
          const next = { ...s.attachments };
          if (modelId) next[accountId] = modelId;
          else delete next[accountId];
          return { attachments: next };
        }),

      getForAccount: (accountId) => {
        const id = get().attachments[accountId];
        if (!id) return null;
        return get().models.find((m) => m.id === id) ?? null;
      },
    }),
    {
      name: 'openqwnt-model-portfolios',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ─── Rebalance math (pure) ──────────────────────────────────

export interface RebalanceLeg {
  symbol: string;
  /** Current dollar value of this position. */
  currentValue: number;
  /** Current weight as a fraction (0..1). */
  currentWeight: number;
  /** Target weight as a fraction (0..1). */
  targetWeight: number;
  /** Drift in basis points. Positive = overweight. */
  driftBp: number;
  /** Direction: positive = buy more, negative = sell. In dollars. */
  delta: number;
  /** True when |drift| exceeds the target's tolerance band. */
  needsAction: boolean;
}

export interface RebalanceProposal {
  totalValue: number;
  legs: RebalanceLeg[];
  /** Sum of |delta| across actionable legs — the minimum trade size required. */
  totalTurnover: number;
  /** Sum of unsigned drifts across all legs (basis points). */
  totalDriftBp: number;
}

/**
 * Generate rebalance proposal given current positions valued in dollars and a
 * target model. Symbols missing from current become buy-to-target legs;
 * symbols missing from target become sell-to-zero legs.
 */
export function buildRebalance(
  current: { symbol: string; value: number }[],
  model: ModelPortfolio
): RebalanceProposal {
  const totalValue = current.reduce((s, p) => s + p.value, 0);
  const targetMap = new Map(
    model.targets.map((t) => [
      t.symbol,
      model.weightUnit === 'percent' ? t.weight / 100 : t.weight,
    ])
  );
  const tolerances = new Map(
    model.targets.map((t) => [t.symbol, t.toleranceBp ?? model.defaultToleranceBp])
  );
  const symbols = new Set<string>([
    ...current.map((p) => p.symbol),
    ...model.targets.map((t) => t.symbol),
  ]);
  const legs: RebalanceLeg[] = [];
  let turnover = 0;
  let drift = 0;
  for (const sym of symbols) {
    const cur = current.find((p) => p.symbol === sym);
    const currentValue = cur?.value ?? 0;
    const currentWeight = totalValue > 0 ? currentValue / totalValue : 0;
    const targetWeight = targetMap.get(sym) ?? 0;
    const targetValue = targetWeight * totalValue;
    const delta = targetValue - currentValue;
    const driftBp = (currentWeight - targetWeight) * 10_000;
    const tol = tolerances.get(sym) ?? model.defaultToleranceBp;
    const needsAction = Math.abs(driftBp) > tol;
    legs.push({
      symbol: sym,
      currentValue,
      currentWeight,
      targetWeight,
      driftBp,
      delta,
      needsAction,
    });
    drift += Math.abs(driftBp);
    if (needsAction) turnover += Math.abs(delta);
  }
  legs.sort((a, b) => Math.abs(b.driftBp) - Math.abs(a.driftBp));
  return { totalValue, legs, totalTurnover: turnover, totalDriftBp: drift };
}
