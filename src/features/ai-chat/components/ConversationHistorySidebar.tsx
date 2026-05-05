/**
 * ConversationHistorySidebar — used on /ai-chat page.
 *
 * Lists all sessions across all modes with filter chips. Click a session →
 * sets it as active. Sessions are grouped by recency.
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
} from 'lucide-react';
import { useAiChatStore } from '../state/aiChatStore';
import { usePanelStore } from '../state/panelStore';
import { MODE_REGISTRY } from '../transports/modeRegistry';
import { SKILLS_BY_ID } from '../skills/registry';
import type { ChatMode, Session, SkillId } from '../types';

type Filter = 'all' | ChatMode | SkillId;

const MODE_FILTERS: { id: ChatMode; label: string }[] = [
  { id: 'ask', label: 'Ask' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'code', label: 'Code' },
  { id: 'boss', label: 'Boss' },
];

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
    <aside className="w-72 shrink-0 border-r border-white/[0.06] flex flex-col h-full bg-card/40">
      <div className="px-3 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">Chats</h2>
        <button
          onClick={handleNew}
          className="ml-auto h-7 px-2 rounded-md bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 flex items-center gap-1 text-xs font-medium"
        >
          <Plus className="w-3 h-3" />
          New
        </button>
      </div>

      {/* Filter chips */}
      <div className="px-2 py-2 border-b border-white/[0.06] overflow-x-auto scrollbar-none">
        <div className="flex gap-1 flex-wrap">
          <FilterChip id="all" label="All" filter={filter} onSelect={setFilter} />
          {MODE_FILTERS.map((m) => (
            <FilterChip key={m.id} id={m.id} label={m.label} filter={filter} onSelect={setFilter} />
          ))}
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="text-center text-[11px] text-white/30 py-8 px-3">
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

function FilterChip({
  id,
  label,
  filter,
  onSelect,
}: {
  id: Filter;
  label: string;
  filter: Filter;
  onSelect: (f: Filter) => void;
}) {
  const active = filter === id;
  return (
    <button
      onClick={() => onSelect(id)}
      className={`px-2 py-0.5 rounded-full text-[10.5px] border transition-colors ${
        active
          ? 'bg-purple-500/20 border-purple-500/40 text-purple-200'
          : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:text-white/80'
      }`}
    >
      {label}
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
  const skill = session.skillId ? SKILLS_BY_ID[session.skillId] : null;
  const ModeIcon = mode.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`group mx-1.5 my-0.5 px-2 py-2 rounded-md cursor-pointer flex items-start gap-2 ${
        active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'
      }`}
      onClick={() => !editing && onSelect()}
    >
      <ModeIcon className="w-3 h-3 mt-1 flex-shrink-0 text-white/50" />
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
              className="flex-1 bg-white/[0.06] border border-white/10 rounded px-1.5 py-0.5 text-[12px] text-white"
            />
            <button onClick={onCommit} className="text-emerald-400 p-0.5"><Check className="w-3 h-3" /></button>
            <button onClick={onCancel} className="text-white/40 p-0.5"><XIcon className="w-3 h-3" /></button>
          </div>
        ) : (
          <>
            <div className="text-[12px] text-white/90 font-medium truncate">{session.title}</div>
            <div className="text-[10px] text-white/40 truncate flex items-center gap-1">
              <span>{mode.shortLabel}</span>
              {skill && (
                <>
                  <span className="text-white/20">·</span>
                  <span>{skill.label}</span>
                </>
              )}
              <span className="text-white/20">·</span>
              <span>{session.tokenCount.toLocaleString()} tok</span>
            </div>
          </>
        )}
      </div>
      {!editing && (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-white/80 p-0.5"
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 z-10 w-32 rounded-md bg-[#15151b] border border-white/10 shadow-xl py-1 text-[11px]"
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onRename();
                }}
                className="w-full text-left px-2 py-1 hover:bg-white/[0.06] text-white/80 flex items-center gap-2"
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
