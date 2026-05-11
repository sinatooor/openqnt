/**
 * Global registry of "popped-out" floating windows.
 *
 * Each entry is a non-modal, draggable/resizable window rendered above the
 * app by `<FloatingWindowsRoot/>` (mounted in App.tsx GlobalOverlays).
 * Windows persist across route changes — open a research chart, navigate
 * to Strategy Flow, the chart stays on screen.
 *
 * Content is held as a render function (`() => ReactNode`) so the renderer
 * can re-invoke it on every render. To keep data inside the window fresh as
 * underlying state changes, the opener should either:
 *   1. Have the render function read from a global store (executionStore,
 *      researchStore, …) so the lookup is current at render time, or
 *   2. Re-call `open(...)` in a useEffect whenever its data prop changes.
 */

import { create } from 'zustand';
import type { ReactNode } from 'react';

export interface FloatingWindowEntry {
  id: string;
  title: string;
  /** Re-invoked on every render of FloatingWindowsRoot. */
  content: () => ReactNode;
  position: { x: number; y: number };
  size: { width: number; height: number };
  minimized: boolean;
  zIndex: number;
}

export interface OpenWindowArgs {
  id: string;
  title: string;
  content: () => ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
}

interface FloatingWindowsStore {
  windows: Record<string, FloatingWindowEntry>;
  open: (args: OpenWindowArgs) => void;
  close: (id: string) => void;
  closeAll: () => void;
  toggleMinimize: (id: string) => void;
  bringToFront: (id: string) => void;
  setPosition: (id: string, p: { x: number; y: number }) => void;
  setSize: (id: string, s: { width: number; height: number }) => void;
}

// Monotonic z-index counter so the most-recently-focused window is on top.
// Starts well above the GlobalAiPanel (z-50) and dialog overlay (z-50/60).
let nextZ = 200;

export const useFloatingWindowsStore = create<FloatingWindowsStore>((set) => ({
  windows: {},

  open: ({ id, title, content, defaultPosition, defaultSize }) =>
    set((s) => {
      const existing = s.windows[id];
      if (existing) {
        // Reopen → refresh content fn, un-minimize, bring to front. Keep
        // user-adjusted position/size.
        return {
          windows: {
            ...s.windows,
            [id]: {
              ...existing,
              title,
              content,
              minimized: false,
              zIndex: ++nextZ,
            },
          },
        };
      }
      // Stagger new windows so they don't all stack at the same coords.
      const count = Object.keys(s.windows).length;
      const pos = defaultPosition ?? { x: 120 + count * 28, y: 96 + count * 28 };
      const size = defaultSize ?? { width: 640, height: 480 };
      return {
        windows: {
          ...s.windows,
          [id]: {
            id,
            title,
            content,
            position: pos,
            size,
            minimized: false,
            zIndex: ++nextZ,
          },
        },
      };
    }),

  close: (id) =>
    set((s) => {
      if (!(id in s.windows)) return s;
      const next = { ...s.windows };
      delete next[id];
      return { windows: next };
    }),

  closeAll: () => set({ windows: {} }),

  toggleMinimize: (id) =>
    set((s) => {
      const w = s.windows[id];
      if (!w) return s;
      return {
        windows: { ...s.windows, [id]: { ...w, minimized: !w.minimized } },
      };
    }),

  bringToFront: (id) =>
    set((s) => {
      const w = s.windows[id];
      if (!w) return s;
      return {
        windows: { ...s.windows, [id]: { ...w, zIndex: ++nextZ } },
      };
    }),

  setPosition: (id, position) =>
    set((s) => {
      const w = s.windows[id];
      if (!w) return s;
      return { windows: { ...s.windows, [id]: { ...w, position } } };
    }),

  setSize: (id, size) =>
    set((s) => {
      const w = s.windows[id];
      if (!w) return s;
      return { windows: { ...s.windows, [id]: { ...w, size } } };
    }),
}));

/** Convenience hook: scoped helpers for a single window id. */
export function useFloatingWindow(id: string) {
  const isOpen = useFloatingWindowsStore((s) => id in s.windows);
  const open = useFloatingWindowsStore((s) => s.open);
  const close = useFloatingWindowsStore((s) => s.close);
  const bringToFront = useFloatingWindowsStore((s) => s.bringToFront);

  return {
    isOpen,
    open: (args: Omit<OpenWindowArgs, 'id'>) => open({ id, ...args }),
    close: () => close(id),
    bringToFront: () => bringToFront(id),
  };
}
