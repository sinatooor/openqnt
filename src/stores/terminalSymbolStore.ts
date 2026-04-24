/**
 * terminalSymbolStore — the single source of truth for the "active
 * terminal symbol" across all Bloomberg-style screens.
 *
 * Anything in the app can call `useTerminalSymbol().setActiveSymbol('AAPL')`
 * and every terminal pane that reads the store via the optional helper
 * (or that has no URL ticker param) will switch in lock-step. The cmd+k
 * symbol palette is the primary writer; URL-driven pages (e.g.
 * `/terminal/des/:ticker`) write through too so the store stays in sync.
 *
 * Persisted to localStorage so opening a fresh tab keeps the last
 * symbol active — matches Bloomberg's "stickiness".
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface TerminalSymbolState {
  activeSymbol: string;
  recents: string[];
  setActiveSymbol: (sym: string) => void;
  clearRecents: () => void;
}

const MAX_RECENTS = 12;

export const useTerminalSymbolStore = create<TerminalSymbolState>()(
  persist(
    (set, get) => ({
      activeSymbol: 'SPY',
      recents: ['SPY', 'AAPL', 'NVDA', 'MSFT'],
      setActiveSymbol: (raw) => {
        const sym = raw.trim().toUpperCase();
        if (!sym) return;
        const recents = [sym, ...get().recents.filter((s) => s !== sym)].slice(
          0,
          MAX_RECENTS,
        );
        set({ activeSymbol: sym, recents });
      },
      clearRecents: () => set({ recents: [] }),
    }),
    {
      name: 'fyer:terminal-symbol',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
