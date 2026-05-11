/**
 * GlobalAiPanel — slide-in panel from the right side.
 *
 * Layout:
 *   ┌─────────────────────────────────────┐
 *   │ Header: SkillChip · ContextChip · ⨯ │
 *   ├─────────────────────────────────────┤
 *   │ MessageList (or EmptyState)         │
 *   ├─────────────────────────────────────┤
 *   │ Composer (textarea + send + ring)   │
 *   │ ModeBar (pill buttons)              │
 *   └─────────────────────────────────────┘
 */

import { useEffect } from 'react';
import { ExternalLink, History, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePanelStore } from '../state/panelStore';
import { useAiChatStore } from '../state/aiChatStore';
import { usePageContextStore } from '../state/pageContextStore';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { EmptyStateLanding } from './EmptyStateLanding';
import { SkillChip } from './SkillChip';
import { PageContextChip } from './PageContextChip';

export function GlobalAiPanel() {
  const open = usePanelStore((s) => s.open);
  const close = usePanelStore((s) => s.close);
  const width = usePanelStore((s) => s.width);

  // Body class so other components can react if needed
  useEffect(() => {
    if (open) document.documentElement.classList.add('ai-panel-open');
    else document.documentElement.classList.remove('ai-panel-open');
    return () => {
      document.documentElement.classList.remove('ai-panel-open');
    };
  }, [open]);

  // ESC closes panel
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close]);

  if (!open) return null;

  return (
    <aside
      className="fixed right-0 top-0 bottom-0 z-[500] glass border-l border-border/50 shadow-trading-lg flex flex-col animate-in slide-in-from-right duration-300"
      style={{ width }}
      role="complementary"
      aria-label="AI assistant"
    >
      <PanelHeader onClose={close} />
      <PanelBody />
    </aside>
  );
}

// ── Header ───────────────────────────────────────────────────

function PanelHeader({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const mode = usePanelStore((s) => s.mode);
  const skillId = usePanelStore((s) => s.skillId);
  const ctx = usePageContextStore((s) => s.context);
  const activeId = useAiChatStore((s) => s.activeSessionId);
  const createSession = useAiChatStore((s) => s.createSession);

  const startNewSession = () => {
    createSession({ mode, skillId, pageContextSnapshot: ctx ?? undefined });
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06]">
      {/* SkillChip moved into Composer's bottom toolbar */}
      {ctx && <PageContextChip />}
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={startNewSession}
          title="New session"
          className="w-7 h-7 rounded-md hover:bg-white/[0.06] text-white/60 hover:text-white flex items-center justify-center transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            navigate(activeId ? `/ai-chat?session=${activeId}` : '/ai-chat');
            onClose();
          }}
          title="Open in full page"
          className="w-7 h-7 rounded-md hover:bg-white/[0.06] text-white/60 hover:text-white flex items-center justify-center transition-colors"
        >
          <History className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onClose}
          title="Close (Esc)"
          className="w-7 h-7 rounded-md hover:bg-white/[0.06] text-white/60 hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Body ─────────────────────────────────────────────────────

// Module-level constant — see AiChat.tsx for the rationale (a fresh `[]`
// inside a Zustand selector breaks useSyncExternalStore equality and
// triggers an infinite-loop crash).
const EMPTY_ITEMS: never[] = [];

function PanelBody() {
  const activeId = useAiChatStore((s) => s.activeSessionId);
  const items = useAiChatStore((s) => (activeId ? s.items[activeId] ?? EMPTY_ITEMS : EMPTY_ITEMS));

  return (
    <div className="flex-1 flex flex-col min-h-0 px-2">
      {items.length === 0 ? (
        // Landing state: greeting + centered composer + suggestions, all in
        // one component. The bottom-anchored Composer is intentionally not
        // rendered here — it gets swapped in once messages exist.
        <div className="px-2 pb-3 flex-1 flex flex-col min-h-0">
          <EmptyStateLanding />
        </div>
      ) : (
        <>
          <MessageList />
          <div className="px-2 pb-3">
            <Composer />
          </div>
        </>
      )}
    </div>
  );
}
