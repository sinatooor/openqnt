/**
 * ToolCallCard — renders an in-progress / completed / errored tool invocation.
 *
 * Lifted from AiChat.tsx so all chat surfaces share the same look.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  AlertCircle,
  Activity,
  ArrowRight,
  BarChart,
  BarChart3,
  Blocks,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  Dice5,
  FlaskConical,
  Gauge,
  Lightbulb,
  LineChart,
  Loader2,
  Newspaper,
  ShieldAlert,
  Wrench,
  XCircle,
} from 'lucide-react';
import { apiBase } from '@/lib/runtimeConfig';
import type { StoredToolCall } from '../types';

export const TOOL_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  build_strategy:        { label: 'Building Strategy',     icon: <Blocks className="w-3.5 h-3.5" />,        color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  run_backtest:          { label: 'Running Backtest',      icon: <BarChart className="w-3.5 h-3.5" />,      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  run_monte_carlo:       { label: 'Monte Carlo Test',      icon: <Dice5 className="w-3.5 h-3.5" />,         color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  navigate_to_page:      { label: 'Navigating',            icon: <ArrowRight className="w-3.5 h-3.5" />,    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  get_portfolio_summary: { label: 'Fetching Portfolio',    icon: <Briefcase className="w-3.5 h-3.5" />,     color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  get_stock_quote:        { label: 'Fetching Quote',        icon: <Gauge className="w-3.5 h-3.5" />,         color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  get_market_index:       { label: 'Reading Index',         icon: <Activity className="w-3.5 h-3.5" />,      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  get_upcoming_dividends: { label: 'Fetching Dividends',    icon: <Calendar className="w-3.5 h-3.5" />,      color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  get_portfolio_performance: { label: 'Reading Performance',icon: <LineChart className="w-3.5 h-3.5" />,     color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
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
  const isRejected = tc.status === 'rejected';
  const isPendingApproval = tc.status === 'pending_approval';

  if (isPendingApproval && tc.toolCallId) {
    return <ApprovalCard tc={tc} meta={meta} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${meta.color} ${
        isError ? 'border-red-500/30 bg-red-500/5' : ''
      } ${isRejected ? 'border-amber-500/30 bg-amber-500/5 text-amber-400' : ''}`}
    >
      {isDone ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : isError ? (
        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
      ) : isRejected ? (
        <XCircle className="w-3.5 h-3.5 text-amber-400" />
      ) : (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      )}
      <span className="font-medium">
        {isRejected ? `${meta.label} — rejected` : meta.label}
      </span>
      {tc.args?.description && (
        <span className="text-white/40 truncate max-w-[200px]">— {tc.args.description}</span>
      )}
      {tc.args?.symbol && <span className="text-white/40">{tc.args.symbol}</span>}
    </motion.div>
  );
}

interface ApprovalCardProps {
  tc: StoredToolCall;
  meta: { label: string; icon: React.ReactNode; color: string };
}

function ApprovalCard({ tc, meta }: ApprovalCardProps) {
  const [busy, setBusy] = useState(false);
  const [decided, setDecided] = useState<'approved' | 'rejected' | null>(null);

  const submit = async (approved: boolean) => {
    if (!tc.toolCallId || busy || decided) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiBase()}/api/ai-assistant/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_call_id: tc.toolCallId, approved }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      setDecided(approved ? 'approved' : 'rejected');
      if (approved) toast.success(`Approved ${meta.label.toLowerCase()}`);
      else toast.info(`Rejected ${meta.label.toLowerCase()}`);
    } catch (e) {
      toast.error(`Failed to send decision: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // Compact argument preview — pick a few common keys we know about
  const previewKeys = ['symbol', 'time_period', 'description', 'start_date', 'end_date'];
  const argParts = previewKeys
    .map((k) => (tc.args?.[k] != null ? `${k}: ${tc.args[k]}` : null))
    .filter(Boolean)
    .slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-orange-500/30 bg-orange-500/5 text-xs overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-orange-500/20 bg-orange-500/5 text-orange-300">
        <ShieldAlert className="w-3.5 h-3.5" />
        <span className="font-medium">Agent wants to run: {meta.label}</span>
        {decided && (
          <span className={`ml-auto text-[10px] uppercase tracking-wide ${decided === 'approved' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
            {decided === 'approved' ? 'Approved' : 'Rejected'}
          </span>
        )}
      </div>
      {argParts.length > 0 && (
        <div className="px-3 py-2 text-foreground/70 font-mono text-[11px]">
          {argParts.join(' · ')}
        </div>
      )}
      {!decided && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-orange-500/20 bg-card/40">
          <button
            disabled={busy}
            onClick={() => submit(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-3 h-3" />
            Accept
          </button>
          <button
            disabled={busy}
            onClick={() => submit(false)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-3 h-3" />
            Reject
          </button>
          {busy && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          <span className="ml-auto text-[10px] text-muted-foreground">
            Sensitive tool · awaiting your decision
          </span>
        </div>
      )}
    </motion.div>
  );
}
