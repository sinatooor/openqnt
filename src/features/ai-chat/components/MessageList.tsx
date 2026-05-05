/**
 * MessageList — renders a session's items (messages + dividers) chronologically.
 *
 * Shared by the slide-in panel and the full-page /ai-chat.
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Loader2, Sparkles, User } from 'lucide-react';
import { useAiChatStore } from '../state/aiChatStore';
import { usePanelStore } from '../state/panelStore';
import { getSkill, SKILLS_BY_ID } from '../skills/registry';
import { getMode, MODE_REGISTRY } from '../transports/modeRegistry';
import { ToolCallCard } from '../cards/ToolCallCard';
import { StrategyNodesCard } from '../cards/StrategyNodesCard';
import { NavigationActionCard } from '../cards/NavigationActionCard';
import { cardRegistry } from '../cards';
import type { ChatMessage, DividerMessage, SessionItem, SkillId, ChatMode } from '../types';

interface Props {
  className?: string;
  emptyState?: React.ReactNode;
}

export function MessageList({ className, emptyState }: Props) {
  const items = useAiChatStore((s) =>
    s.activeSessionId ? s.items[s.activeSessionId] ?? [] : [],
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [items]);

  if (items.length === 0) {
    return (
      <div className={`flex-1 overflow-y-auto ${className ?? ''}`}>
        {emptyState}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={`flex-1 overflow-y-auto pb-4 scrollbar-thin ${className ?? ''}`}>
      <AnimatePresence initial={false}>
        {items.map((item) =>
          item.role === 'divider' ? (
            <DividerLine key={item.id} divider={item} />
          ) : (
            <MessageBubble key={item.id} msg={item} />
          ),
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Message bubble ──────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 py-3 px-2 ${isUser ? 'justify-end' : ''}`}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center mt-0.5">
          <Sparkles className="w-4 h-4 text-purple-400" />
        </div>
      )}

      <div className={`max-w-[80%] min-w-0 ${isUser ? '' : 'flex-1'}`}>
        {isUser ? (
          <div className="rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed bg-primary/20 text-foreground border border-primary/10">
            {msg.content}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Tool calls */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="space-y-1.5">
                {msg.toolCalls.map((tc, i) => (
                  <ToolCallCard key={`${tc.tool}-${i}`} tc={tc} />
                ))}
              </div>
            )}

            {/* Strategy nodes (legacy + Strategy mode) */}
            {msg.strategyNodes && msg.strategyNodes.length > 0 && (
              <StrategyNodesCard
                nodes={msg.strategyNodes}
                edges={msg.strategyEdges ?? []}
              />
            )}

            {/* Dynamic cards via registry */}
            {msg.cards && msg.cards.length > 0 && (
              <div className="space-y-2">
                {msg.cards.map((c) => {
                  // strategy_nodes is rendered above; skip duplicate
                  if (c.cardType === 'strategy_nodes') return null;
                  // navigation_action duplicated in actions; let actions handle it
                  if (c.cardType === 'navigation_action') return null;
                  // partial-stream cards have already been merged into strategyNodes/edges
                  if (
                    c.cardType === 'strategy_node_partial' ||
                    c.cardType === 'strategy_edges_partial'
                  ) return null;
                  const Cmp = cardRegistry[c.cardType];
                  if (!Cmp) return null;
                  return <Cmp key={c.id} payload={c.payload} />;
                })}
              </div>
            )}

            {/* Navigation actions */}
            {msg.actions?.map((act, i) =>
              act.action === 'navigate' ? (
                <NavigationActionCard
                  key={i}
                  payload={{ action: act.action, data: act.data }}
                />
              ) : null,
            )}

            {/* Text */}
            {msg.content && (
              <div className="rounded-2xl rounded-bl-md px-4 py-2.5 bg-white/[0.03] text-foreground/90 border border-white/[0.06]">
                <div className="text-sm prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2 [&_li]:mb-0.5 [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-pink-300 [&_code]:text-xs [&_pre]:bg-black/30 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:border [&_pre]:border-white/10 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-emerald-300 [&_pre_code]:text-[11px] [&_strong]:text-foreground">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            )}

            {msg.isStreaming &&
              !msg.content &&
              (!msg.toolCalls || msg.toolCalls.length === 0) &&
              (!msg.cards || msg.cards.length === 0) && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.03] border border-white/[0.06]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  <span className="text-xs text-muted-foreground">Thinking…</span>
                </div>
              )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center mt-0.5">
          <User className="w-4 h-4 text-white/60" />
        </div>
      )}
    </motion.div>
  );
}

// ── Divider line ─────────────────────────────────────────────

function DividerLine({ divider }: { divider: DividerMessage }) {
  let label = '';
  let icon: React.ReactNode = null;

  if (divider.kind === 'mode_change') {
    const target = MODE_REGISTRY[divider.to as ChatMode];
    label = `Mode changed to ${target?.label ?? divider.to}`;
    if (target) {
      const Icon = target.icon;
      icon = <Icon className="w-3 h-3" />;
    }
  } else if (divider.kind === 'skill_change') {
    if (divider.to == null) {
      label = 'Skill cleared';
    } else {
      const skill = SKILLS_BY_ID[divider.to as SkillId];
      label = `Skill changed to ${skill?.label ?? divider.to}`;
      if (skill) {
        const Icon = skill.icon;
        icon = <Icon className="w-3 h-3" />;
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-3 my-3 px-2"
    >
      <div className="flex-1 h-px bg-white/[0.08]" />
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] text-white/50 bg-white/[0.04] border border-white/[0.06]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex-1 h-px bg-white/[0.08]" />
    </motion.div>
  );
}
