/**
 * ToolCallCard — renders an in-progress / completed / errored tool invocation.
 *
 * Lifted from AiChat.tsx so all chat surfaces share the same look.
 */

import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  BarChart,
  BarChart3,
  Blocks,
  Briefcase,
  Check,
  Dice5,
  FlaskConical,
  Lightbulb,
  Loader2,
  Newspaper,
  Wrench,
} from 'lucide-react';
import type { StoredToolCall } from '../types';

export const TOOL_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  build_strategy:        { label: 'Building Strategy',     icon: <Blocks className="w-3.5 h-3.5" />,        color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  run_backtest:          { label: 'Running Backtest',      icon: <BarChart className="w-3.5 h-3.5" />,      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  run_monte_carlo:       { label: 'Monte Carlo Test',      icon: <Dice5 className="w-3.5 h-3.5" />,         color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  navigate_to_page:      { label: 'Navigating',            icon: <ArrowRight className="w-3.5 h-3.5" />,    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  get_portfolio_summary: { label: 'Fetching Portfolio',    icon: <Briefcase className="w-3.5 h-3.5" />,     color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  list_user_strategies:  { label: 'Loading Strategies',    icon: <Blocks className="w-3.5 h-3.5" />,        color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  get_execution_history: { label: 'Fetching Executions',   icon: <BarChart3 className="w-3.5 h-3.5" />,     color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  get_market_news:       { label: 'Fetching News',         icon: <Newspaper className="w-3.5 h-3.5" />,     color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  analyze_strategy:      { label: 'Analyzing Strategy',    icon: <FlaskConical className="w-3.5 h-3.5" />,  color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  explain_trading_concept: { label: 'Explaining',          icon: <Lightbulb className="w-3.5 h-3.5" />,     color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  create_custom_node:    { label: 'Adding Custom Node',    icon: <Wrench className="w-3.5 h-3.5" />,        color: 'text-cyan-300 bg-cyan-600/10 border-cyan-600/30' },
};

interface Props {
  tc: StoredToolCall;
}

export function ToolCallCard({ tc }: Props) {
  const meta =
    TOOL_META[tc.tool] ?? {
      label: tc.tool,
      icon: <Wrench className="w-3.5 h-3.5" />,
      color: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
    };
  const isDone = tc.status === 'done';
  const isError = tc.status === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${meta.color} ${
        isError ? 'border-red-500/30 bg-red-500/5' : ''
      }`}
    >
      {isDone ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : isError ? (
        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
      ) : (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      )}
      <span className="font-medium">{meta.label}</span>
      {tc.args?.description && (
        <span className="text-white/40 truncate max-w-[200px]">— {tc.args.description}</span>
      )}
      {tc.args?.symbol && <span className="text-white/40">{tc.args.symbol}</span>}
    </motion.div>
  );
}
