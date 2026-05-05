/**
 * pageContextStore — the AI's grounding layer.
 *
 * Every page calls usePageContext({...}) to register what it shows. Transports
 * read this on every send and attach it to the request so the AI knows the
 * user's current view without being told.
 */

import { create } from 'zustand';
import type { PageContext } from '../types';

interface PageContextState {
  context: PageContext | null;
  setContext: (ctx: PageContext | null) => void;
  clear: () => void;
}

export const usePageContextStore = create<PageContextState>((set) => ({
  context: null,
  setContext: (ctx) => set({ context: ctx }),
  clear: () => set({ context: null }),
}));
