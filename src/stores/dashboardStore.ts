import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WidgetLayout {
  id: string;
  type: string;
  w: number;
  h: number;
  x: number; // for grid layouts
  y: number; // for grid layouts
}

export interface DashboardState {
  widgets: WidgetLayout[];
  addWidget: (type: string) => void;
  removeWidget: (id: string) => void;
  reorderWidgets: (newWidgets: WidgetLayout[]) => void;
  resetToDefault: () => void;
}

const defaultWidgets: WidgetLayout[] = [
  { id: '1', type: 'indices', w: 6, h: 4, x: 0, y: 0 },
  { id: '2', type: 'sector-heatmap', w: 6, h: 4, x: 6, y: 0 },
  { id: '3', type: 'top-movers', w: 4, h: 3, x: 0, y: 4 },
  { id: '4', type: 'market-sentiment', w: 4, h: 3, x: 4, y: 4 },
  { id: '5', type: 'portfolio-summary', w: 4, h: 3, x: 8, y: 4 },
  { id: '6', type: 'watchlist', w: 6, h: 4, x: 0, y: 7 },
  { id: '7', type: 'news-feed', w: 6, h: 4, x: 6, y: 7 },
  { id: '8', type: 'economic-calendar', w: 12, h: 3, x: 0, y: 11 },
];

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      widgets: defaultWidgets,
      addWidget: (type) =>
        set((state) => {
          const newId = Date.now().toString();
          return {
            widgets: [
              ...state.widgets,
              { id: newId, type, w: 6, h: 2, x: 0, y: 100 }, // appended to bottom roughly
            ],
          };
        }),
      removeWidget: (id) =>
        set((state) => ({
          widgets: state.widgets.filter((w) => w.id !== id),
        })),
      reorderWidgets: (newWidgets) =>
        set({
          widgets: newWidgets,
        }),
      resetToDefault: () =>
        set({
          widgets: defaultWidgets,
        }),
    }),
    {
      name: 'fyer-dashboard-layout',
    }
  )
);
