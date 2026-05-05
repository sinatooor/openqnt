/**
 * Skill registry — financial role personas.
 *
 * Each skill is a system-prompt swap. Orthogonal to modes (Ask/Strategy/Code/Boss).
 * System prompts live in prompts/<id>.md and are bundled at build time via
 * Vite's `?raw` import.
 */

import {
  Calculator,
  Newspaper,
  PiggyBank,
  Briefcase,
  Zap,
  ShieldAlert,
  Globe,
  Heart,
  type LucideIcon,
} from 'lucide-react';
import type { ChatMode, SkillId } from '../types';

import quantPrompt from './prompts/quant.md?raw';
import marketResearcherPrompt from './prompts/market-researcher.md?raw';
import wealthAdvisorPrompt from './prompts/wealth-advisor.md?raw';
import portfolioManagerPrompt from './prompts/portfolio-manager.md?raw';
import salesTraderPrompt from './prompts/sales-trader.md?raw';
import riskQuantPrompt from './prompts/risk-quant.md?raw';
import macroStrategistPrompt from './prompts/macro-strategist.md?raw';
import tradingCoachPrompt from './prompts/trading-coach.md?raw';

export interface Skill {
  id: SkillId;
  label: string;
  shortDescription: string;
  systemPrompt: string;
  suggestedPrompts: string[];
  recommendedToolCategories: string[];
  recommendedModes?: ChatMode[];
  icon: LucideIcon;
  accentColor: string;
}

export const SKILLS: Skill[] = [
  {
    id: 'quant',
    label: 'Quant',
    shortDescription: 'PhD-level statistical edge analysis. Calls out overfitting and bias.',
    systemPrompt: quantPrompt,
    suggestedPrompts: [
      'Is a 20/50 SMA crossover statistically significant on SPY?',
      'Run a walk-forward analysis on my current strategy.',
      'What\'s the t-stat of these returns?',
      'How much overfitting risk does this strategy have?',
    ],
    recommendedToolCategories: ['backtest', 'monte_carlo', 'analyze_strategy'],
    recommendedModes: ['ask', 'strategy', 'boss'],
    icon: Calculator,
    accentColor: 'text-violet-300 bg-violet-500/10 border-violet-500/30',
  },
  {
    id: 'market-researcher',
    label: 'Market Researcher',
    shortDescription: 'Sourced news + fundamentals synthesis. Signal vs noise.',
    systemPrompt: marketResearcherPrompt,
    suggestedPrompts: [
      'Why did NVDA move yesterday?',
      'Summarize the latest news on AAPL with sources.',
      'What\'s the consensus view on the next FOMC decision?',
      'Pull recent earnings highlights for my watchlist.',
    ],
    recommendedToolCategories: ['get_market_news', 'terminal_news'],
    recommendedModes: ['ask', 'boss'],
    icon: Newspaper,
    accentColor: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
  },
  {
    id: 'wealth-advisor',
    label: 'Wealth Advisor',
    shortDescription: 'Long-term, goal-based, fiduciary tone. Risk + tax aware.',
    systemPrompt: wealthAdvisorPrompt,
    suggestedPrompts: [
      'Help me build a long-term allocation for retirement.',
      'Am I taking too much concentration risk?',
      'How should I think about tax-loss harvesting?',
      'What\'s an appropriate emergency fund target?',
    ],
    recommendedToolCategories: ['get_portfolio_summary'],
    recommendedModes: ['ask'],
    icon: PiggyBank,
    accentColor: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  },
  {
    id: 'portfolio-manager',
    label: 'Portfolio Manager',
    shortDescription: 'Allocation, factor exposure, rebalancing, risk-adjusted returns.',
    systemPrompt: portfolioManagerPrompt,
    suggestedPrompts: [
      'Decompose my portfolio by factor exposure.',
      'What\'s my biggest concentration risk right now?',
      'Should I rebalance? What\'s my tracking error?',
      'Compare my returns to SPY adjusted for beta.',
    ],
    recommendedToolCategories: ['get_portfolio_summary', 'run_monte_carlo'],
    recommendedModes: ['ask', 'boss'],
    icon: Briefcase,
    accentColor: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  },
  {
    id: 'sales-trader',
    label: 'Sales Trader',
    shortDescription: 'Execution-focused. Order types, slippage, microstructure.',
    systemPrompt: salesTraderPrompt,
    suggestedPrompts: [
      'Best way to enter a $1M TSLA position without moving it?',
      'Should I use VWAP or TWAP for this name?',
      'What\'s the typical spread on small-cap names like this?',
      'Liquidity profile for AAPL last hour of trading.',
    ],
    recommendedToolCategories: ['get_execution_history'],
    recommendedModes: ['ask'],
    icon: Zap,
    accentColor: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  },
  {
    id: 'risk-quant',
    label: 'Risk Quant',
    shortDescription: 'VaR, stress tests, tail risk, hedge structures.',
    systemPrompt: riskQuantPrompt,
    suggestedPrompts: [
      'What\'s my portfolio\'s 95% 1-day VaR?',
      'Stress-test my book against a 2008 scenario.',
      'How would I hedge against a 10% drawdown?',
      'What\'s the tail risk in my current strategy?',
    ],
    recommendedToolCategories: ['run_monte_carlo', 'analyze_strategy'],
    recommendedModes: ['ask', 'boss'],
    icon: ShieldAlert,
    accentColor: 'text-red-300 bg-red-500/10 border-red-500/30',
  },
  {
    id: 'macro-strategist',
    label: 'Macro Strategist',
    shortDescription: 'Top-down: rates, FX, commodities, regime detection.',
    systemPrompt: macroStrategistPrompt,
    suggestedPrompts: [
      'What\'s the current macro regime?',
      'Is the yield curve inversion still a recession signal?',
      'How is positioning in oil and gold right now?',
      'What\'s the Fed\'s likely path over the next 6 months?',
    ],
    recommendedToolCategories: ['get_market_news', 'terminal_macro'],
    recommendedModes: ['ask', 'boss'],
    icon: Globe,
    accentColor: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  },
  {
    id: 'trading-coach',
    label: 'Trading Coach',
    shortDescription: 'Process, discipline, journaling, pattern recognition.',
    systemPrompt: tradingCoachPrompt,
    suggestedPrompts: [
      'Review my last 10 trades and tell me what I\'m doing wrong.',
      'I keep cutting winners early — help me fix this.',
      'Build me a pre-trade checklist.',
      'Am I revenge trading after losses?',
    ],
    recommendedToolCategories: ['get_execution_history', 'get_portfolio_summary'],
    recommendedModes: ['ask'],
    icon: Heart,
    accentColor: 'text-pink-300 bg-pink-500/10 border-pink-500/30',
  },
];

export const SKILLS_BY_ID: Record<SkillId, Skill> = SKILLS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<SkillId, Skill>,
);

export function getSkill(id: SkillId | null | undefined): Skill | null {
  if (!id) return null;
  return SKILLS_BY_ID[id] ?? null;
}
