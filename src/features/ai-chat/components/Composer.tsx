/**
 * Composer — textarea + send + ContextRing + ModeBar.
 *
 * Used by both the slide-in panel and the full-page /ai-chat.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAiChatStore } from '../state/aiChatStore';
import { usePanelStore } from '../state/panelStore';
import { useChatTransport } from '../transports/useChatTransport';
import { getMode } from '../transports/modeRegistry';
import { ContextRing } from './ContextRing';
import { ModeBar } from './ModeBar';
import { MAX_CONTEXT_TOKENS } from '../state/contextWindow';
import { toast } from 'sonner';

export function Composer({ autoFocus = true }: { autoFocus?: boolean }) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const mode = usePanelStore((s) => s.mode);
  const descriptor = getMode(mode);

  const activeSession = useAiChatStore((s) =>
    s.activeSessionId ? s.sessions.find((x) => x.id === s.activeSessionId) ?? null : null,
  );
  const isStreaming = useAiChatStore(
    (s) =>
      activeSession ? !!s.streamingMessageId[activeSession.id] : false,
  );
  const { send, cancel } = useChatTransport();

  const tokens = activeSession?.tokenCount ?? 0;
  const overflow = tokens >= MAX_CONTEXT_TOKENS;
  const warning = !overflow && tokens >= 0.9 * MAX_CONTEXT_TOKENS;

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Drain pending message queued by CommandPalette / AskAi / SelectionPill
  useEffect(() => {
    const pending = usePanelStore.getState().consumePendingMessage();
    if (pending && pending.trim()) {
      // Defer to ensure session/state is ready
      setTimeout(() => send(pending), 30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-time warning when crossing 90%
  const lastWarn = useRef(false);
  useEffect(() => {
    if (warning && !lastWarn.current) {
      lastWarn.current = true;
      toast.warning('Context nearing limit', {
        description: 'Start a new session to keep performance fast.',
      });
    }
    if (!warning) lastWarn.current = false;
  }, [warning]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleSend = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;
    if (overflow) {
      toast.error('Context full', {
        description: 'Start a new session to continue.',
      });
      return;
    }
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    send(content);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  return (
    <div className="pt-2">
      <form
        onSubmit={handleSubmit}
        className="relative flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm px-4 py-3 focus-within:border-purple-500/40 transition-colors shadow-lg shadow-black/20"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={descriptor.placeholder}
          rows={1}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-40 leading-relaxed"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <ContextRing tokens={tokens} />
          {isStreaming ? (
            <Button
              type="button"
              size="icon"
              onClick={cancel}
              className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/15"
            >
              <X className="w-4 h-4 text-white/70" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || overflow}
              className="h-8 w-8 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </form>
      <ModeBar />
    </div>
  );
}
