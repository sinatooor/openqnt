/**
 * App Mode Store - Demo / Real mode toggle
 * 
 * Wraps the entire app to distinguish between demo (paper trading)
 * and real (live trading) modes. Persisted to localStorage.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AppMode = 'demo' | 'real';

interface AppModeState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
  isDemo: () => boolean;
  isReal: () => boolean;
}

export const useAppModeStore = create<AppModeState>()(
  persist(
    (set, get) => ({
      mode: 'demo',

      setMode: (mode: AppMode) => set({ mode }),

      toggleMode: () =>
        set((state) => ({ mode: state.mode === 'demo' ? 'real' : 'demo' })),

      isDemo: () => get().mode === 'demo',
      isReal: () => get().mode === 'real',
    }),
    {
      name: 'openqwnt-app-mode',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useAppModeStore;
