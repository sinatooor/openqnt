/**
 * AiChat — unified full-page AI surface.
 *
 * Two-pane layout: ConversationHistorySidebar + (MessageList | EmptyState) + Composer.
 * Reuses the same components as the slide-in panel so the two surfaces never drift.
 *
 * Also serves as the new home for /boss runs — the route /boss renders this
 * same page with defaultMode='boss' (see pages/Boss.tsx).
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import {
  ConversationHistorySidebar,
  MessageList,
  Composer,
  EmptyState,
  SkillChip,
  PageContextChip,
  ContextRing,
  useAiChatStore,
  usePanelStore,
} from '@/features/ai-chat';
import type { ChatMode } from '@/features/ai-chat';
import { Button } from '@/components/ui/button';

interface Props {
  defaultMode?: ChatMode;
  defaultFilter?: ChatMode;
}

const AiChat = ({ defaultMode, defaultFilter }: Props = {}) => {
  const [params] = useSearchParams();
  const sessionParam = params.get('session');
  const modeParam = params.get('mode') as ChatMode | null;

  const setMode = usePanelStore((s) => s.setMode);
  const setActive = useAiChatStore((s) => s.setActiveSession);
  const sessions = useAiChatStore((s) => s.sessions);
  const activeId = useAiChatStore((s) => s.activeSessionId);
  const activeSession = activeId ? sessions.find((s) => s.id === activeId) : null;
  const items = useAiChatStore((s) => (activeId ? s.items[activeId] ?? [] : []));
  const tokens = activeSession?.tokenCount ?? 0;
  const popoutToPanel = usePanelStore((s) => s.open_);

  // Apply default mode (used when /boss → unified page)
  useEffect(() => {
    if (modeParam) setMode(modeParam);
    else if (defaultMode) setMode(defaultMode);
  }, [defaultMode, modeParam, setMode]);

  // Deep-link to session
  useEffect(() => {
    if (sessionParam && sessions.find((s) => s.id === sessionParam)) {
      setActive(sessionParam);
    }
  }, [sessionParam, sessions, setActive]);

  return (
    <div className="min-h-screen bg-background flex flex-col pt-14">
      <div className="flex flex-1 min-h-[calc(100vh-3.5rem)]">
        <ConversationHistorySidebar />

        <main className="flex-1 flex flex-col min-w-0">
          {/* Header bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60">
            <SkillChip />
            <PageContextChip />
            <div className="ml-auto flex items-center gap-2">
              {activeSession && (
                <>
                  <ContextRing tokens={tokens} />
                  <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[260px]">
                    {activeSession.title}
                  </span>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => popoutToPanel()}
                className="h-7 text-[11px] text-foreground/70 hover:text-foreground"
                title="Open in slide-in panel"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Open as panel
              </Button>
            </div>
          </div>

          {/* Conversation */}
          <div className="flex-1 flex flex-col min-h-0 max-w-4xl w-full mx-auto px-4">
            {items.length === 0 ? <EmptyState /> : <MessageList />}
            <div className="pb-4">
              <Composer />
              <p className="text-center text-[10.5px] text-muted-foreground/50 mt-2">
                AI can call tools and build strategies. Responses are for informational
                purposes — not financial advice.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AiChat;
