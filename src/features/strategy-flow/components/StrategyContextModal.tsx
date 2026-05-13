/**
 * StrategyContextModal — first-run modal that creates the Start node.
 *
 * Shown automatically when the canvas is empty (no Start node yet). The user
 * picks portfolio, tickers, capital, and mode; on submit the modal calls
 * `ensureStartNode` with those fields, which inserts the Start node at the
 * pinned top-left position. Source of truth from that point onward is the
 * Start node itself.
 */

import { memo, useState, KeyboardEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Play, X } from 'lucide-react';
import { useStrategyContextActions } from '../store/useStrategyContext';
import type { StrategyRunMode } from '../types';

interface StrategyContextModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional preset suggestions (e.g. from URL params or last-used). */
  initialTickers?: string[];
}

const normalizeTicker = (raw: string): string => raw.trim().toUpperCase().replace(/[^A-Z0-9.\-:]/g, '');

export const StrategyContextModal = memo(({
  open,
  onOpenChange,
  initialTickers = [],
}: StrategyContextModalProps) => {
  const { ensureStartNode } = useStrategyContextActions();

  const [portfolio, setPortfolio] = useState('paper-default');
  const [tickers, setTickers] = useState<string[]>(initialTickers);
  const [tickerDraft, setTickerDraft] = useState('');
  const [capitalStr, setCapitalStr] = useState('10000');
  const [mode, setMode] = useState<StrategyRunMode>('paper');

  const addTickerFromDraft = () => {
    const t = normalizeTicker(tickerDraft);
    if (t && !tickers.includes(t)) {
      setTickers([...tickers, t]);
    }
    setTickerDraft('');
  };

  const handleTickerKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addTickerFromDraft();
    } else if (e.key === 'Backspace' && tickerDraft === '' && tickers.length > 0) {
      setTickers(tickers.slice(0, -1));
    }
  };

  const handleSubmit = () => {
    // If the user typed a ticker but didn't press Enter, take it anyway.
    let finalTickers = tickers;
    const pending = normalizeTicker(tickerDraft);
    if (pending && !finalTickers.includes(pending)) finalTickers = [...finalTickers, pending];

    const capital = Math.max(0, parseFloat(capitalStr) || 0);

    ensureStartNode({
      portfolio: portfolio.trim(),
      tickers: finalTickers,
      capital,
      mode,
    });
    onOpenChange(false);
  };

  const canSubmit = tickers.length > 0 || normalizeTicker(tickerDraft).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="strategy-context-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
              <Play className="h-4 w-4" />
            </span>
            What does this strategy trade?
          </DialogTitle>
          <DialogDescription>
            Pick the portfolio, primary tickers, capital, and run mode. This becomes the strategy&apos;s Start node — every downstream node inherits this context.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ctx-portfolio">Portfolio / account</Label>
            <Input
              id="ctx-portfolio"
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
              placeholder="e.g. paper-default, alpaca-live, ibkr-paper"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ctx-tickers">Tickers</Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 min-h-[2.4rem]">
              {tickers.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  {t}
                  <button
                    type="button"
                    onClick={() => setTickers(tickers.filter((x) => x !== t))}
                    className="opacity-60 hover:opacity-100"
                    aria-label={`Remove ${t}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <input
                id="ctx-tickers"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500 min-w-[6rem]"
                placeholder={tickers.length === 0 ? 'e.g. AAPL, MSFT, BTCUSDT' : 'Add another...'}
                value={tickerDraft}
                onChange={(e) => setTickerDraft(e.target.value)}
                onKeyDown={handleTickerKey}
                onBlur={addTickerFromDraft}
              />
            </div>
            <p className="text-xs text-slate-500">Press Enter, comma, or space to add. Symbols normalized to upper-case.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ctx-capital">Starting capital</Label>
              <Input
                id="ctx-capital"
                type="number"
                min="0"
                step="100"
                value={capitalStr}
                onChange={(e) => setCapitalStr(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctx-mode">Run mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as StrategyRunMode)}>
                <SelectTrigger id="ctx-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paper">Paper</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="backtest">Backtest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Skip for now
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Start building
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

StrategyContextModal.displayName = 'StrategyContextModal';
