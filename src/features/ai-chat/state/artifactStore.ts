/**
 * artifactStore — pinned artifacts (plots, tables, code blocks, strategies).
 *
 * Each card in any conversation gets a "Pin" button. Pinning copies the card
 * payload into this store, with a reference back to the source session/message
 * so users can re-open the original conversation.
 *
 * Persisted to localStorage (separate scope from chat sessions, which use
 * sessionStorage — artifacts are meant to survive across sessions).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Artifact {
  id: string;
  cardType: string;
  payload: any;
  title?: string;
  pinnedAt: number;
  sourceSessionId?: string;
  sourceMessageId?: string;
}

interface ArtifactState {
  artifacts: Artifact[];
  open: boolean;

  pin: (a: Omit<Artifact, 'pinnedAt'>) => void;
  unpin: (id: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
}

export const useArtifactStore = create<ArtifactState>()(
  persist(
    (set) => ({
      artifacts: [],
      open: false,

      pin: (a) =>
        set((s) => {
          // Avoid duplicate pinning of the same source card
          if (a.id && s.artifacts.find((x) => x.id === a.id)) return s;
          return {
            artifacts: [{ ...a, pinnedAt: Date.now() }, ...s.artifacts],
          };
        }),
      unpin: (id) => set((s) => ({ artifacts: s.artifacts.filter((x) => x.id !== id) })),
      clear: () => set({ artifacts: [] }),
      setOpen: (open) => set({ open }),
      toggleOpen: () => set((s) => ({ open: !s.open })),
    }),
    {
      name: 'fyer-ai-artifacts',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ artifacts: s.artifacts }),
    },
  ),
);
