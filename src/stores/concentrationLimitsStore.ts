/**
 * Concentration limits + alerts.
 *
 * Per-account caps on:
 *   • Single-name weight (% of book)
 *   • Sector weight
 *   • Country / region weight
 *   • Currency weight
 *   • Asset-class weight
 *
 * The store provides current breach detection given a snapshot of weighted
 * exposures; UI panels subscribe and surface red banners when limits trip.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type LimitDimension = 'single_name' | 'sector' | 'country' | 'currency' | 'asset_class';

export interface Limit {
  id: string;
  /** Account scope; null = applies to aggregate / all accounts. */
  accountId: string | null;
  dimension: LimitDimension;
  /** When dimension is single_name/sector/etc., this names the bucket
   * (a symbol, sector name, country code, etc.). null = applies to ANY bucket. */
  bucket: string | null;
  /** Maximum weight as a fraction (0..1). */
  maxWeight: number;
  /** Optional label for UI. */
  label?: string;
  active: boolean;
}

export interface Breach {
  limitId: string;
  dimension: LimitDimension;
  bucket: string;
  weight: number;
  cap: number;
  excessBp: number;
  label: string;
}

interface ConcentrationState {
  limits: Limit[];

  addLimit: (l: Omit<Limit, 'id'>) => Limit;
  updateLimit: (id: string, updates: Partial<Limit>) => void;
  removeLimit: (id: string) => void;

  /**
   * Given current exposures by dimension+bucket, return all breaches.
   * exposures is a map { [dimension]: { [bucket]: weight (0..1) } }.
   */
  detectBreaches: (
    accountId: string | null,
    exposures: Partial<Record<LimitDimension, Record<string, number>>>
  ) => Breach[];
}

const DEFAULT_LIMITS: Limit[] = [
  // Single-name 10% cap is a common retail rule of thumb
  { id: 'def-single', accountId: null, dimension: 'single_name', bucket: null, maxWeight: 0.10, label: 'Single name ≤ 10%', active: false },
  { id: 'def-sector', accountId: null, dimension: 'sector', bucket: null, maxWeight: 0.30, label: 'Any sector ≤ 30%', active: false },
  { id: 'def-currency', accountId: null, dimension: 'currency', bucket: null, maxWeight: 0.40, label: 'Non-base currency ≤ 40%', active: false },
];

export const useConcentrationLimitsStore = create<ConcentrationState>()(
  persist(
    (set, get) => ({
      limits: DEFAULT_LIMITS,

      addLimit: (l) => {
        const id = `lim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const created: Limit = { ...l, id };
        set((s) => ({ limits: [...s.limits, created] }));
        return created;
      },

      updateLimit: (id, updates) =>
        set((s) => ({
          limits: s.limits.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        })),

      removeLimit: (id) =>
        set((s) => ({ limits: s.limits.filter((l) => l.id !== id) })),

      detectBreaches: (accountId, exposures) => {
        const breaches: Breach[] = [];
        for (const limit of get().limits) {
          if (!limit.active) continue;
          if (limit.accountId !== null && limit.accountId !== accountId) continue;
          const dimMap = exposures[limit.dimension];
          if (!dimMap) continue;

          if (limit.bucket) {
            const w = dimMap[limit.bucket] ?? 0;
            if (w > limit.maxWeight) {
              breaches.push({
                limitId: limit.id,
                dimension: limit.dimension,
                bucket: limit.bucket,
                weight: w,
                cap: limit.maxWeight,
                excessBp: (w - limit.maxWeight) * 10_000,
                label: limit.label ?? `${limit.dimension} ${limit.bucket} ≤ ${(limit.maxWeight * 100).toFixed(1)}%`,
              });
            }
          } else {
            // Apply to ALL buckets
            for (const [bucket, w] of Object.entries(dimMap)) {
              if (w > limit.maxWeight) {
                breaches.push({
                  limitId: limit.id,
                  dimension: limit.dimension,
                  bucket,
                  weight: w,
                  cap: limit.maxWeight,
                  excessBp: (w - limit.maxWeight) * 10_000,
                  label: limit.label ?? `${limit.dimension} ${bucket} ≤ ${(limit.maxWeight * 100).toFixed(1)}%`,
                });
              }
            }
          }
        }
        return breaches.sort((a, b) => b.excessBp - a.excessBp);
      },
    }),
    {
      name: 'openqwnt-concentration-limits',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useConcentrationLimitsStore;
