/**
 * EmptyStateLanding — centered greeting + composer + suggestion buttons for
 * the empty-state landing screen (no messages yet).
 *
 * Renders when the active session has zero items. Once the user sends a
 * message, the parent swaps to MessageList + the bottom-anchored Composer.
 * See `GlobalAiPanel.tsx` and `pages/AiChat.tsx` for the conditional swap.
 *
 * Visual intent: a calm "Hello, {name}" greeting with a large rounded input
 * centered on the canvas, mirroring Claude Code's empty state. Suggestion
 * prompts (the same dynamic list EmptyState used to render in the corner)
 * sit below the composer as compact buttons.
 */

import { motion } from 'framer-motion';
import { usePanelStore } from '../state/panelStore';
import { getSkill } from '../skills/registry';
import { getMode } from '../transports/modeRegistry';
import { useChatTransport } from '../transports/useChatTransport';
import { useAuthStore } from '@/stores/authStore';
import { OpenQntMark } from '@/components/OpenQntMark';
import { Composer } from './Composer';

const DEFAULT_PROMPTS: Record<string, string[]> = {
  ask: [
    'Build an RSI oversold buy strategy',
    'Show me my portfolio summary',
    'Compare SMA vs EMA crossover approaches',
    'Explain the Kelly criterion for position sizing',
  ],
  strategy: [
    'Build a 50/200 SMA crossover strategy',
    'MACD crossover with stop-loss and take-profit',
    'RSI mean-reversion on SPY with risk management',
    'Bollinger Band squeeze breakout strategy',
  ],
  code: [
    'Pine Script for a 20-period RSI alert',
    'Python backtest of MACD crossover on SPY',
    'MQL5 EA for breakout entries with trailing stop',
    'Nautilus strategy for VWAP reversion',
  ],
  boss: [
    'Research SPY mean-reversion edges across technical, fundamental, and news',
    'Find a momentum edge in tech stocks for the next quarter',
    'Build a multi-factor screen for quality + value + momentum',
    'Analyze macro positioning across rates, FX, equities, and commodities',
  ],
};

function firstNameFrom(user: { name?: string | null; email?: string | null } | null | undefined): string {
  if (!user) return 'there';
  const fromName = user.name?.split(' ')[0]?.trim();
  if (fromName) return fromName;
  const fromEmail = user.email?.split('@')[0];
  return fromEmail || 'there';
}

export function EmptyStateLanding() {
  const user = useAuthStore((s) => s.user);
  const mode = usePanelStore((s) => s.mode);
  const skillId = usePanelStore((s) => s.skillId);
  const skill = getSkill(skillId);
  const descriptor = getMode(mode);
  const { send } = useChatTransport();

  const prompts =
    skill?.suggestedPrompts ??
    DEFAULT_PROMPTS[mode] ??
    DEFAULT_PROMPTS.ask;

  const firstName = firstNameFrom(user);
  const subtitle = skill?.shortDescription ?? descriptor.description;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 select-none">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex items-center justify-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20 text-primary">
            <OpenQntMark size={22} />
          </div>
          <h1 className="text-2xl font-serif tracking-tight text-foreground">
            Hello, <span className="text-foreground/70">{firstName}</span>
          </h1>
        </motion.div>

        {/* Subtitle / current-mode hint */}
        <p className="text-center text-xs text-muted-foreground -mt-3">{subtitle}</p>

        {/* Composer — larger, centered, autofocused */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <Composer variant="landing" autoFocus />
        </motion.div>

        {/* Suggestion buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {prompts.slice(0, 4).map((p, i) => (
            <motion.button
              key={p}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + 0.04 * i }}
              onClick={() => send(p)}
              className="text-left text-[12px] px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-colors text-foreground/75 hover:text-foreground"
            >
              {p}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
