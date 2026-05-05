/**
 * EmptyState — shown when the active session has no messages.
 *
 * Renders the active skill's suggested prompts, or a default set if no skill
 * is active. Click a suggestion → sends it via useChatTransport.
 */

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { usePanelStore } from '../state/panelStore';
import { getSkill } from '../skills/registry';
import { getMode } from '../transports/modeRegistry';
import { useChatTransport } from '../transports/useChatTransport';

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

export function EmptyState() {
  const mode = usePanelStore((s) => s.mode);
  const skillId = usePanelStore((s) => s.skillId);
  const skill = getSkill(skillId);
  const descriptor = getMode(mode);
  const { send } = useChatTransport();

  const prompts = skill?.suggestedPrompts ?? DEFAULT_PROMPTS[mode] ?? DEFAULT_PROMPTS.ask;

  const Icon = skill?.icon ?? Sparkles;
  const label = skill ? `${skill.label} · ${descriptor.label}` : descriptor.label;
  const subtitle = skill?.shortDescription ?? descriptor.description;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 select-none px-4 py-8">
      <div className="relative">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            skill?.accentColor ??
            'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 text-purple-400'
          }`}
        >
          <Icon className="w-7 h-7" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-base font-semibold text-foreground">{label}</h2>
        <p className="text-xs text-muted-foreground max-w-md">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 gap-1.5 w-full max-w-md mt-2">
        {prompts.slice(0, 4).map((p, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            onClick={() => send(p)}
            className="text-left text-[12px] px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] transition-colors text-white/70 hover:text-white"
          >
            {p}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
