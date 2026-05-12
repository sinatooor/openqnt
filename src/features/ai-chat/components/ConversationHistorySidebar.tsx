/**
 * ConversationHistorySidebar — used on /ai-chat page.
 *
 * Compact list of sessions with its own scroll container. Visual aesthetic
 * follows the Claude Code reference the user shared: slim "+ New session"
 * link at top, small uppercase "Recents" group header with a filter icon,
 * dense single-line rows (~24px), kebab on hover. Filter chips moved into
 * a popover triggered by the Filter icon — saved ~32px of chrome.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MoreHorizontal,
  Plus,
  Trash2,
  Pencil,
  Check,
  X as XIcon,
  Filter as FilterIcon,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAiChatStore } from '../state/aiChatStore';
import { usePanelStore } from '../state/panelStore';
import { MODE_REGISTRY } from '../transports/modeRegistry';
import { SKILLS_BY_ID } from '../skills/registry';
import type { ChatMode, Session, SkillId } from '../types';
import { cn } from '@/lib/utils';

type Filter = 'all' | ChatMode | SkillId;

const MODE_FILTERS: { id: ChatMode; label: string }[] = [
  { id: 'ask', label: 'Ask' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'code', label: 'Code' },
  { id: 'boss', label: 'Boss' },
];

const FILTER_LABEL: Record<Filter, string> = {
  all: 'All',
  ask: 'Ask',
  strategy: 'Strategy',
  code: 'Code',
  boss: 'Boss',
};

export function ConversationHistorySidebar() {
  const sessions = useAiChatStore((s) => s.sessions);
  const activeId = useAiChatStore((s) => s.activeSessionId);
  const setActive = useAiChatStore((s) => s.setActiveSession);
  const deleteSession = useAiChatStore((s) => s.deleteSession);
  const renameSession = useAiChatStore((s) => s.renameSession);
  const createSession = useAiChatStore((s) => s.createSession);
  const mode = usePanelStore((s) => s.mode);
  const skillId = usePanelStore((s) => s.skillId);

  const [filter, setFilter] = useState<Filter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filtered = sessions.filter((s) => {
    if (filter === 'all') return true;
    if (filter === 'ask' || filter === 'strategy' || filter === 'code' || filter === 'boss') {
      return s.primaryMode === filter;
    }
    return s.skillId === filter;
  });

  const handleNew = () => {
    createSession({ mode, skillId });
  };

  const handleRename = (s: Session) => {
    setEditingId(s.id);
    setEditTitle(s.title);
  };

  const commitRename = () => {
    if (editingId && editTitle.trim()) {
      renameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <aside className="w-64 shrink-0 border-r border-white/[0.06] flex flex-col h-full min-h-0 bg-card/40">
      {/* Top action — single tight row, no chunky header. */}
      <button
        onClick={handleNew}
        className="flex items-center gap-2 mx-2 mt-2 px-2 py-1.5 rounded-md text-[11.5px] text-foreground/80 hover:text-foreground hover:bg-white/[0.04] transition-colors"
      >
        <Plus className="w-3.5 h-3.5 text-muted-foreground" />
        <span>New session</span>
      </button>

      {/* Recents group header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1 select-none">
        <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-medium">
          Recents
        </span>
        {filter !== 'all' && (
          <span className="text-[9.5px] text-purple-300/80 font-medium">
            · {FILTER_LABEL[filter]}
          </span>
        )}
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <button
              className="ml-auto text-muted-foreground/70 hover:text-foreground transition-colors p-0.5"
              title="Filter sessions"
              aria-label="Filter sessions"
            >
              <FilterIcon className="w-3 h-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-40 p-1">
            <FilterRow id="all" current={filter} onSelect={(v) => { setFilter(v); setFilterOpen(false); }} />
            <div className="h-px bg-border/40 my-1" />
            {MODE_FILTERS.map((m) => (
              <FilterRow
                key={m.id}
                id={m.id}
                current={filter}
                onSelect={(v) => { setFilter(v); setFilterOpen(false); }}
              />
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Session list — only this scrolls. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center text-[10.5px] text-muted-foreground/60 py-6 px-3">
            No conversations yet.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                active={s.id === activeId}
                editing={editingId === s.id}
                editTitle={editTitle}
                onSetEditTitle={setEditTitle}
                onSelect={() => setActive(s.id)}
                onRename={() => handleRename(s)}
                onDelete={() => deleteSession(s.id)}
                onCommit={commitRename}
                onCancel={() => setEditingId(null)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </aside>
  );
}

function FilterRow({
  id,
  current,
  onSelect,
}: {
  id: Filter;
  current: Filter;
  onSelect: (f: Filter) => void;
}) {
  const active = current === id;
  return (
    <button
      onClick={() => onSelect(id)}
      className={cn(
        'w-full text-left px-2 py-1 rounded text-[11px] flex items-center gap-2',
        active
          ? 'bg-purple-500/15 text-purple-200'
          : 'text-foreground/75 hover:bg-white/[0.04] hover:text-foreground',
      )}
    >
      <span className="flex-1">{FILTER_LABEL[id]}</span>
      {active && <Check className="w-3 h-3 text-purple-300" />}
    </button>
  );
}

function SessionRow({
  session,
  active,
  editing,
  editTitle,
  onSetEditTitle,
  onSelect,
  onRename,
  onDelete,
  onCommit,
  onCancel,
}: {
  session: Session;
  active: boolean;
  editing: boolean;
  editTitle: string;
  onSetEditTitle: (v: string) => void;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mode = MODE_REGISTRY[session.primaryMode];
  const ModeIcon = mode.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn(
        'group mx-1 px-2 py-1 rounded cursor-pointer flex items-center gap-2',
        active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.03]',
      )}
      onClick={() => !editing && onSelect()}
    >
      <ModeIcon
        className={cn(
          'w-3 h-3 shrink-0',
          active ? 'text-purple-300' : 'text-muted-foreground/60',
        )}
      />
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => onSetEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommit();
                if (e.key === 'Escape') onCancel();
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-white/[0.06] border border-white/10 rounded px-1.5 py-0.5 text-[11.5px] text-white"
            />
            <button onClick={onCommit} className="text-emerald-400 p-0.5"><Check className="w-3 h-3" /></button>
            <button onClick={onCancel} className="text-white/40 p-0.5"><XIcon className="w-3 h-3" /></button>
          </div>
        ) : (
          <div
            className={cn(
              'text-[11.5px] truncate',
              active ? 'text-foreground' : 'text-foreground/80',
            )}
            title={session.title}
          >
            {session.title}
          </div>
        )}
      </div>
      {!editing && (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground/70 hover:text-foreground p-0.5 transition-opacity"
            aria-label="Session actions"
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 z-10 w-28 rounded-md bg-[#15151b] border border-white/10 shadow-xl py-1 text-[11px]"
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onRename();
                }}
                className="w-full text-left px-2 py-1 hover:bg-white/[0.06] text-foreground/80 flex items-center gap-2"
              >
                <Pencil className="w-3 h-3" /> Rename
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="w-full text-left px-2 py-1 hover:bg-white/[0.06] text-red-400 flex items-center gap-2"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
