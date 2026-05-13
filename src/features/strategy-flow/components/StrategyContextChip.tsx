/**
 * StrategyContextChip — read-only summary chip in the canvas header.
 *
 * Mirrors the Start node's data. Clicking opens the Start node's property
 * panel so the user can edit. The Start node remains the source of truth.
 */

import { memo } from 'react';
import { Briefcase, DollarSign, Hash, MousePointerClick } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useStrategyContext } from '../store/useStrategyContext';
import { useStrategyFlowStore, START_NODE_ID } from '../store/strategyFlowStore';

interface StrategyContextChipProps {
  /** Called when the user clicks the chip; default opens Start node properties. */
  onEdit?: () => void;
  className?: string;
}

const formatCapital = (amount: number, ccy = 'USD'): string => {
  if (amount >= 1_000_000) return `${ccy} ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${ccy} ${(amount / 1_000).toFixed(amount >= 10_000 ? 0 : 1)}k`;
  return `${ccy} ${amount}`;
};

const MODE_COLORS: Record<string, string> = {
  paper: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  live: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  backtest: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

export const StrategyContextChip = memo(({ onEdit, className }: StrategyContextChipProps) => {
  const ctx = useStrategyContext();
  const selectNode = useStrategyFlowStore((s) => s.selectNode);

  const handleClick = () => {
    if (onEdit) {
      onEdit();
      return;
    }
    // Default: select the Start node so its properties panel opens.
    selectNode(START_NODE_ID);
  };

  if (!ctx.hasContext) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-2.5 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/10 transition-colors',
          className,
        )}
        title="No Strategy Context yet — click to set portfolio and tickers"
      >
        <MousePointerClick className="w-3.5 h-3.5" />
        Set strategy context
      </button>
    );
  }

  const tickersLabel =
    ctx.tickers.length === 0
      ? '(no tickers)'
      : ctx.tickers.length <= 3
        ? ctx.tickers.join(' · ')
        : `${ctx.tickers.slice(0, 2).join(' · ')} +${ctx.tickers.length - 2}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-xs hover:bg-slate-800 transition-colors',
        className,
      )}
      title="Strategy context — portfolio, tickers, capital, mode. Click to edit."
      data-testid="strategy-context-chip"
    >
      <span className="inline-flex items-center gap-1 text-slate-300">
        <Hash className="w-3.5 h-3.5 text-slate-500" />
        {tickersLabel}
      </span>
      <span className="h-3 w-px bg-slate-700" />
      <span className="inline-flex items-center gap-1 text-slate-300">
        <DollarSign className="w-3.5 h-3.5 text-slate-500" />
        {formatCapital(ctx.capital)}
      </span>
      {ctx.portfolio ? (
        <>
          <span className="h-3 w-px bg-slate-700" />
          <span className="inline-flex items-center gap-1 text-slate-300">
            <Briefcase className="w-3.5 h-3.5 text-slate-500" />
            {ctx.portfolio}
          </span>
        </>
      ) : null}
      <Badge variant="outline" className={cn('h-5 px-1.5 text-[10px] uppercase tracking-wide', MODE_COLORS[ctx.mode])}>
        {ctx.mode}
      </Badge>
    </button>
  );
});

StrategyContextChip.displayName = 'StrategyContextChip';
