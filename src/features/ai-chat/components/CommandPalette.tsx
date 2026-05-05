/**
 * CommandPalette — ⌘J ambient AI access, available from any page.
 *
 * Three response shapes:
 *   1. Inline answer — short questions stay in the palette popover
 *   2. Action — "go to portfolio" / "show TSLA chart" → executes immediately
 *   3. Open conversation — long/complex prompts auto-open the panel
 *
 * Auto-mode detection picks a likely mode based on keywords; the user can
 * override with explicit slash commands like `/strategy`, `/code`, `/boss`.
 *
 * Keybindings:
 *   - ⌘J / Ctrl+J  → toggle from anywhere
 *   - `/`          → open when no input is focused
 *   - Esc          → close
 *   - Enter        → dispatch
 *   - Shift+Enter  → force "Open in panel" (skip inline)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CornerDownLeft,
  ExternalLink,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
} from 'lucide-react';
import { create } from 'zustand';
import { api } from '@/services/api';
import { usePanelStore } from '../state/panelStore';
import { usePageContextStore } from '../state/pageContextStore';
import { getSkill } from '../skills/registry';
import { detectMode, looksLikeTicker } from '../utils/modeDetection';
import { MODE_REGISTRY } from '../transports/modeRegistry';
import type { ChatMode } from '../types';

// Tiny store so anything can open the palette programmatically (e.g. AskAi
// drop-in component on a card can route through here for inline answers).
interface PaletteState {
  open: boolean;
  initialQuery?: string;
  forceMode?: ChatMode;
  openWith: (opts?: { initialQuery?: string; forceMode?: ChatMode }) => void;
  close: () => void;
}
export const useCommandPalette = create<PaletteState>((set) => ({
  open: false,
  openWith: (opts) => set({ open: true, ...opts }),
  close: () => set({ open: false, initialQuery: undefined, forceMode: undefined }),
}));

// ── Action dispatch (Action shape) ──────────────────────────

interface ActionMatch {
  label: string;
  description?: string;
  run: () => void;
}

function buildActions(
  input: string,
  navigate: (route: string) => void,
  openPanel: (mode?: ChatMode) => void,
): ActionMatch[] {
  const lc = input.toLowerCase().trim();
  if (!lc) return [];

  const out: ActionMatch[] = [];

  // Navigation patterns
  const NAV: Array<[RegExp, string, string]> = [
    [/^(go to |show )?(dashboard|home)$/i, '/dashboard', 'Dashboard'],
    [/^(go to |show )?(portfolio)$/i, '/portfolio', 'Portfolio'],
    [/^(go to |show )?(news)$/i, '/news', 'News'],
    [/^(go to |show )?(executions?|history)$/i, '/executions', 'Execution history'],
    [/^(go to |open )?(strategy|builder|canvas)$/i, '/', 'Strategy Builder'],
    [/^(go to |open )?(backtest)$/i, '/backtest', 'Backtest'],
    [/^(go to |open )?(boss|agent[- ]?boss)$/i, '/boss', 'Agent Boss'],
    [/^(go to |open )?(ai|chat|ai chat|history)$/i, '/ai-chat', 'AI Chat history'],
  ];
  for (const [re, route, label] of NAV) {
    if (re.test(lc)) out.push({ label: `Go to ${label}`, run: () => navigate(route) });
  }

  // Show <ticker> chart
  const chartMatch = lc.match(/^(show|open|view)\s+([a-z]{1,5}(?:\.[a-z])?)\s*(chart|rmap|bmap|hds|graph|price)?$/i);
  if (chartMatch) {
    const tk = chartMatch[2].toUpperCase();
    out.push({
      label: `Open ${tk} chart`,
      description: 'Terminal RMAP',
      run: () => navigate(`/terminal/rmap/${tk}`),
    });
  }

  // Bare ticker → terminal jump
  if (looksLikeTicker(input)) {
    const tk = input.trim().toUpperCase();
    out.push({
      label: `Open ${tk} in Terminal`,
      run: () => navigate(`/terminal/rmap/${tk}`),
    });
  }

  // Mode-jump shortcuts
  if (/^\/?(strategy|build a strategy|new strategy)$/i.test(lc)) {
    out.push({ label: 'Open AI Panel — Strategy mode', run: () => openPanel('strategy') });
  }
  if (/^\/?(code|generate code)$/i.test(lc)) {
    out.push({ label: 'Open AI Panel — Code mode', run: () => openPanel('code') });
  }
  if (/^\/?(boss|research|delegate)$/i.test(lc)) {
    out.push({ label: 'Open AI Panel — Agent Boss mode', run: () => openPanel('boss') });
  }

  return out;
}

// ── Component ───────────────────────────────────────────────

export function CommandPalette() {
  const open = useCommandPalette((s) => s.open);
  const initialQuery = useCommandPalette((s) => s.initialQuery);
  const forceMode = useCommandPalette((s) => s.forceMode);
  const openWith = useCommandPalette((s) => s.openWith);
  const close = useCommandPalette((s) => s.close);

  const [input, setInput] = useState('');
  const [inlineAnswer, setInlineAnswer] = useState<string>('');
  const [streaming, setStreaming] = useState(false);
  const cancelRef = useRef<{ cancel: () => void } | null>(null);
  const navigate = useNavigate();

  const openPanel = usePanelStore((s) => s.open_);
  const openWithMessage = usePanelStore((s) => s.openWithMessage);
  const pageContext = usePageContextStore((s) => s.context);

  // Sync initialQuery when opened programmatically
  useEffect(() => {
    if (open) setInput(initialQuery ?? '');
  }, [open, initialQuery]);

  // Global shortcut: ⌘J / Ctrl+J → toggle. `/` → open when no input focused.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isModJ = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j';
      if (isModJ) {
        e.preventDefault();
        if (open) close();
        else openWith();
        return;
      }
      // `/` opens palette when not typing in a form field
      if (e.key === '/' && !open) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName?.toLowerCase();
        const editable =
          tag === 'input' ||
          tag === 'textarea' ||
          (t as HTMLElement | null)?.isContentEditable;
        if (!editable) {
          e.preventDefault();
          openWith();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, openWith, close]);

  // Cancel stream on close
  useEffect(() => {
    if (!open) {
      cancelRef.current?.cancel();
      cancelRef.current = null;
      setInlineAnswer('');
      setStreaming(false);
    }
  }, [open]);

  const detectedMode: ChatMode = useMemo(
    () => forceMode ?? detectMode(input),
    [input, forceMode],
  );
  const actions = useMemo(
    () => buildActions(input, navigate, (m) => openPanel(m)),
    [input, navigate, openPanel],
  );

  const onClose = () => {
    cancelRef.current?.cancel();
    close();
  };

  const popOutToPanel = () => {
    if (input.trim()) {
      openWithMessage(input, { mode: detectedMode });
    } else {
      openPanel(detectedMode);
    }
    onClose();
  };

  const askInline = () => {
    if (!input.trim() || streaming) return;
    setInlineAnswer('');
    setStreaming(true);

    // Inline answers always use Ask transport directly via SSE — no card
    // events, no tool calls. Short reply lives in the palette.
    const skill = getSkill(usePanelStore.getState().skillId);
    const ctx: Record<string, any> = {};
    if (pageContext) ctx.page_context = pageContext;
    if (skill) ctx.system_prompt = skill.systemPrompt;
    ctx.inline = true;

    const { cancel } = api.streamAiChat(
      input,
      [],
      ctx,
      (event) => {
        if (event.type === 'text_delta') {
          setInlineAnswer((p) => p + event.content);
        } else if (event.type === 'done' || event.type === 'error') {
          setStreaming(false);
          if (event.type === 'error') {
            setInlineAnswer((p) => p + `\n\n*Error: ${event.message}*`);
          }
        }
      },
    );
    cancelRef.current = { cancel };
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // If we have an exact action match, run the first one
    if (actions.length > 0 && !input.startsWith('?')) {
      actions[0].run();
      onClose();
      return;
    }
    // Default to inline answer; Shift+Enter pops out to panel
    askInline();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Modal backdrop — clickable to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[600] bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 -translate-x-1/2 top-[20vh] z-[601] w-[640px] max-w-[92vw] glass border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          >
            <form onSubmit={onSubmit}>
              <PaletteInput
                value={input}
                onChange={setInput}
                streaming={streaming}
                detectedMode={detectedMode}
                onClose={onClose}
                onShiftEnter={popOutToPanel}
              />

              {inlineAnswer ? (
                <InlineAnswer text={inlineAnswer} streaming={streaming} />
              ) : (
                <PaletteResults
                  input={input}
                  actions={actions}
                  detectedMode={detectedMode}
                  onAsk={askInline}
                  onPopOut={popOutToPanel}
                />
              )}

              <PaletteFooter
                hasActions={actions.length > 0}
                hasInput={input.trim().length > 0}
              />
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Subcomponents ───────────────────────────────────────────

function PaletteInput({
  value,
  onChange,
  streaming,
  detectedMode,
  onClose,
  onShiftEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  streaming: boolean;
  detectedMode: ChatMode;
  onClose: () => void;
  onShiftEnter: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const ModeIcon = MODE_REGISTRY[detectedMode].icon;

  return (
    <div className="flex items-center gap-2 px-3.5 py-3 border-b border-white/[0.06]">
      <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            onShiftEnter();
          }
        }}
        placeholder="Ask, do, or jump anywhere…"
        className="flex-1 bg-transparent outline-none text-[14px] text-foreground placeholder:text-white/30"
      />
      {value.trim() && (
        <div
          title={`Detected mode: ${MODE_REGISTRY[detectedMode].label}`}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] border ${MODE_REGISTRY[detectedMode].accentColor}`}
        >
          <ModeIcon className="w-3 h-3" />
          {MODE_REGISTRY[detectedMode].shortLabel}
        </div>
      )}
      {streaming && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />}
    </div>
  );
}

function PaletteResults({
  input,
  actions,
  detectedMode,
  onAsk,
  onPopOut,
}: {
  input: string;
  actions: ActionMatch[];
  detectedMode: ChatMode;
  onAsk: () => void;
  onPopOut: () => void;
}) {
  const trimmed = input.trim();
  const ModeIcon = MODE_REGISTRY[detectedMode].icon;

  if (!trimmed) {
    return (
      <div className="px-3.5 py-4 text-[12px] text-white/40 space-y-1.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Try: "show TSLA chart", "go to portfolio", "build an RSI strategy", or just ask a question.</span>
        </div>
        <div className="text-[10.5px] text-white/30 mt-1">
          Press <kbd className="px-1 py-0.5 bg-white/[0.06] rounded">Enter</kbd> to ask · <kbd className="px-1 py-0.5 bg-white/[0.06] rounded">Shift</kbd>+<kbd className="px-1 py-0.5 bg-white/[0.06] rounded">Enter</kbd> to open in panel
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[50vh] overflow-y-auto py-1">
      {actions.length > 0 && (
        <div>
          <div className="px-3.5 py-1.5 text-[10px] uppercase tracking-wider text-white/30">
            Actions
          </div>
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => a.run()}
              className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-white/[0.04] text-left"
            >
              <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
              <div className="flex-1">
                <div className="text-[12.5px] text-white/90">{a.label}</div>
                {a.description && (
                  <div className="text-[10.5px] text-white/40">{a.description}</div>
                )}
              </div>
              <ExternalLink className="w-3 h-3 text-white/30" />
            </button>
          ))}
        </div>
      )}

      <div>
        <div className="px-3.5 py-1.5 text-[10px] uppercase tracking-wider text-white/30">
          Ask AI
        </div>
        <button
          type="button"
          onClick={onAsk}
          className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-white/[0.04] text-left"
        >
          <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
          <div className="flex-1">
            <div className="text-[12.5px] text-white/90">Quick answer (inline)</div>
            <div className="text-[10.5px] text-white/40">"{trimmed}"</div>
          </div>
          <CornerDownLeft className="w-3 h-3 text-white/30" />
        </button>
        <button
          type="button"
          onClick={onPopOut}
          className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-white/[0.04] text-left"
        >
          <ModeIcon className="w-3.5 h-3.5 text-pink-400" />
          <div className="flex-1">
            <div className="text-[12.5px] text-white/90">
              Open in panel — {MODE_REGISTRY[detectedMode].label}
            </div>
            <div className="text-[10.5px] text-white/40">Full conversation, tool calls, cards</div>
          </div>
          <span className="text-[10px] text-white/30">⇧ ↵</span>
        </button>
      </div>
    </div>
  );
}

function InlineAnswer({ text, streaming }: { text: string; streaming: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [text]);
  return (
    <div
      ref={ref}
      className="max-h-[42vh] overflow-y-auto px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap text-white/85"
    >
      {text}
      {streaming && <span className="inline-block w-1.5 h-3.5 bg-purple-400 align-middle ml-0.5 animate-pulse" />}
    </div>
  );
}

function PaletteFooter({ hasActions, hasInput }: { hasActions: boolean; hasInput: boolean }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2 border-t border-white/[0.06] text-[10px] text-white/40">
      <div className="flex items-center gap-3">
        <span>
          <kbd className="px-1 py-0.5 bg-white/[0.06] rounded">↑↓</kbd> navigate
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-white/[0.06] rounded">↵</kbd>{' '}
          {hasActions ? 'run' : hasInput ? 'ask inline' : 'send'}
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-white/[0.06] rounded">⇧↵</kbd> open in panel
        </span>
      </div>
      <span>
        <kbd className="px-1 py-0.5 bg-white/[0.06] rounded">⌘J</kbd> close
      </span>
    </div>
  );
}
