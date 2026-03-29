import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Layout } from 'react-grid-layout';

export interface DashboardState {
  layout: Layout[];
  widgetTypes: Record<string, string>; // maps layout item "i" → widget type id
  addWidget: (type: string) => void;
  removeWidget: (id: string) => void;
  updateLayout: (layout: Layout[]) => void;
  resetToDefault: () => void;
}

const defaultLayout: Layout[] = [
  { i: '1', x: 0, y: 0, w: 12, h: 6, minW: 4, minH: 3 },
  { i: '2', x: 0, y: 6, w: 6, h: 5, minW: 3, minH: 3 },
  { i: '3', x: 6, y: 6, w: 6, h: 5, minW: 3, minH: 3 },
  { i: '4', x: 0, y: 11, w: 6, h: 5, minW: 3, minH: 3 },
  { i: '5', x: 6, y: 11, w: 6, h: 5, minW: 3, minH: 3 },
  { i: '6', x: 0, y: 16, w: 4, h: 4, minW: 2, minH: 3 },
  { i: '7', x: 4, y: 16, w: 4, h: 4, minW: 2, minH: 3 },
  { i: '8', x: 8, y: 16, w: 4, h: 4, minW: 2, minH: 3 },
];

const defaultWidgetTypes: Record<string, string> = {
  '1': 'sector-heatmap',
  '2': 'indices',
  '3': 'top-movers',
  '4': 'watchlist',
  '5': 'news-feed',
  '6': 'market-sentiment',
  '7': 'portfolio-summary',
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
      updateLayout: (layout) => set({ layout }),
      resetToDefault: () =>
        set({ layout: defaultLayout, widgetTypes: defaultWidgetTypes }),
    }),
    {
      name: 'fyer-dashboard-layout-v2',
    },
  ),
);
