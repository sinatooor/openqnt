/**
 * Saved chart layouts — let users name and recall a chart's symbol /
 * timeframe / indicator stack / drawing tools across sessions.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ChartIndicatorConfig {
  type: string; // 'sma' | 'ema' | 'rsi' | 'macd' | 'bollinger' | 'vwap' | ...
  params: Record<string, number | string | boolean>;
  /** Optional pane id when we render the indicator on a separate pane. */
  pane?: number;
}

export interface ChartDrawing {
  id: string;
  type: 'trendline' | 'horizontal' | 'rectangle' | 'fib' | 'text';
  /** Anchor points (price, time-ms) pairs. */
  points: { price: number; time: number }[];
  /** Optional styling. */
  color?: string;
  width?: number;
  text?: string;
}

export interface ChartLayout {
  id: string;
  name: string;
  symbol: string;
  /** Timeframe key, e.g. '1m', '5m', '1h', '1d'. */
  timeframe: string;
  indicators: ChartIndicatorConfig[];
  drawings: ChartDrawing[];
  /** Optional symbols to overlay on the same chart. */
  overlays?: string[];
  /** Free-form notes (a journal scratchpad on the chart). */
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

interface LayoutState {
  layouts: ChartLayout[];
  activeLayoutId: string | null;

  saveLayout: (l: Omit<ChartLayout, 'id' | 'createdAt' | 'updatedAt'>) => ChartLayout;
  updateLayout: (id: string, updates: Partial<ChartLayout>) => void;
  removeLayout: (id: string) => void;
  setActive: (id: string | null) => void;
  duplicate: (id: string, newName?: string) => ChartLayout | null;
}

export const useChartLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      layouts: [],
      activeLayoutId: null,

      saveLayout: (l) => {
        const now = Date.now();
        const id = `layout-${now}-${Math.random().toString(36).slice(2, 6)}`;
        const created: ChartLayout = { ...l, id, createdAt: now, updatedAt: now };
        set((s) => ({ layouts: [...s.layouts, created] }));
        return created;
      },

      updateLayout: (id, updates) =>
        set((s) => ({
          layouts: s.layouts.map((l) =>
            l.id === id ? { ...l, ...updates, updatedAt: Date.now() } : l
          ),
        })),

      removeLayout: (id) =>
        set((s) => ({
          layouts: s.layouts.filter((l) => l.id !== id),
          activeLayoutId: s.activeLayoutId === id ? null : s.activeLayoutId,
        })),

      setActive: (id) => set({ activeLayoutId: id }),

      duplicate: (id, newName) => {
        const src = get().layouts.find((l) => l.id === id);
        if (!src) return null;
        const copy = get().saveLayout({
          name: newName ?? `${src.name} copy`,
          symbol: src.symbol,
          timeframe: src.timeframe,
          indicators: structuredClone(src.indicators),
          drawings: structuredClone(src.drawings),
          overlays: src.overlays ? [...src.overlays] : undefined,
          notes: src.notes,
        });
        return copy;
      },
    }),
    {
      name: 'openqwnt-chart-layouts',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useChartLayoutStore;
