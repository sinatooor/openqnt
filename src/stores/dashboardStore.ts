import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// `Layout` from react-grid-layout is the *array* type (`readonly
// LayoutItem[]`). Each grid cell is a `LayoutItem` (`{ i, x, y, w, h, ... }`).
// Older code in this file imported `Layout` and used `Layout[]` — that
// resolved to `(readonly LayoutItem[])[]`, hence the type errors.
import type { LayoutItem } from 'react-grid-layout';

export interface DashboardState {
  layout: LayoutItem[];
  widgetTypes: Record<string, string>; // maps layout item "i" → widget type id
  addWidget: (type: string) => void;
  removeWidget: (id: string) => void;
  updateLayout: (layout: readonly LayoutItem[]) => void;
  resetToDefault: () => void;
}

const defaultLayout: LayoutItem[] = [
  // Row 1: indices + heatmap + top movers
  { i: '1', x: 0, y: 0, w: 3, h: 5, minW: 3, minH: 3 },
  { i: '2', x: 3, y: 0, w: 6, h: 5, minW: 4, minH: 3 },
  { i: '3', x: 9, y: 0, w: 3, h: 5, minW: 3, minH: 3 },
  // Row 2: news + performance + sentiment
  { i: '4', x: 0, y: 5, w: 6, h: 4, minW: 3, minH: 3 },
  { i: '5', x: 6, y: 5, w: 3, h: 4, minW: 3, minH: 3 },
  { i: '6', x: 9, y: 5, w: 3, h: 4, minW: 3, minH: 3 },
  // Row 3: large watchlist + calendar strip
  { i: '7', x: 0, y: 9, w: 8, h: 4, minW: 4, minH: 3 },
  { i: '8', x: 8, y: 9, w: 4, h: 4, minW: 3, minH: 3 },
];

const defaultWidgetTypes: Record<string, string> = {
  '1': 'indices',
  '2': 'sector-heatmap',
  '3': 'top-movers',
  '4': 'news-feed',
  '5': 'portfolio-summary',
  '6': 'market-sentiment',
  '7': 'watchlist',
  '8': 'economic-calendar',
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      layout: defaultLayout,
      widgetTypes: defaultWidgetTypes,
      addWidget: (type) =>
        set((state) => {
          const newId = Date.now().toString();
          return {
            layout: [
              ...state.layout,
              { i: newId, x: 0, y: Infinity, w: 6, h: 4, minW: 2, minH: 3 },
            ],
            widgetTypes: { ...state.widgetTypes, [newId]: type },
          };
        }),
      removeWidget: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.widgetTypes;
          return {
            layout: state.layout.filter((l) => l.i !== id),
            widgetTypes: rest,
          };
        }),
      updateLayout: (layout) => set({ layout: [...layout] }),
      resetToDefault: () =>
        set({ layout: defaultLayout, widgetTypes: defaultWidgetTypes }),
    }),
    {
      // Bump persist key so the new terminal blueprint is applied immediately.
      name: 'fyer-dashboard-layout-v3',
    },
  ),
);
