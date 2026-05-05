/**
 * panelStore — ephemeral panel UI state.
 *
 * Kept separate from aiChatStore so panel open/close + active mode/skill don't
 * pollute the persisted conversation store. Mode and skill default per session
 * but the panel can override them temporarily.
 */

import { create } from 'zustand';
import type { ChatMode, SkillId } from '../types';

interface PanelState {
  open: boolean;
  mode: ChatMode;
  skillId: SkillId | null;
  width: number;
  /**
   * One-shot message the next mounted Composer should auto-send.
   * Set by the CommandPalette / SelectionPill / AskAi handle when the user
   * wants to "open in panel" with a pre-filled prompt.
   */
  pendingMessage: string | null;

  setOpen: (open: boolean) => void;
  open_: (mode?: ChatMode, skillId?: SkillId | null) => void;
  openWithMessage: (
    message: string,
    opts?: { mode?: ChatMode; skillId?: SkillId | null },
  ) => void;
  consumePendingMessage: () => string | null;
  close: () => void;
  toggle: (mode?: ChatMode) => void;
  setMode: (mode: ChatMode) => void;
  setSkill: (skillId: SkillId | null) => void;
  setWidth: (width: number) => void;
}

export const usePanelStore = create<PanelState>((set, get) => ({
  open: false,
  mode: 'ask',
  skillId: null,
  width: 480,
  pendingMessage: null,

  setOpen: (open) => set({ open }),
  open_: (mode, skillId) =>
    set((s) => ({
      open: true,
      mode: mode ?? s.mode,
      skillId: skillId !== undefined ? skillId : s.skillId,
    })),
  openWithMessage: (message, opts) =>
    set((s) => ({
      open: true,
      mode: opts?.mode ?? s.mode,
      skillId: opts?.skillId !== undefined ? opts.skillId : s.skillId,
      pendingMessage: message,
    })),
  consumePendingMessage: () => {
    const msg = get().pendingMessage;
    if (msg) set({ pendingMessage: null });
    return msg;
  },
  close: () => set({ open: false }),
  toggle: (mode) =>
    set((s) => ({
      open: !s.open,
      mode: mode ?? s.mode,
    })),
  setMode: (mode) => set({ mode }),
  setSkill: (skillId) => set({ skillId }),
  setWidth: (width) => set({ width }),
}));
