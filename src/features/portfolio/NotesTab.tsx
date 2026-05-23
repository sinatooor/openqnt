/**
 * NotesTab — per-asset notebook inside the Portfolio page.
 *
 * Each holding (manual or broker-imported) gets a free-text note that
 * persists via portfolioStore.updateHolding({ id, notes }). The store is
 * already localStorage-backed, so notes survive refreshes. For Avanza
 * holdings, the panel also surfaces the read-only Avanza-side note if one
 * exists (the user wrote it inside Avanza's app) — so this tab becomes
 * the single place to look for "what was I thinking when I bought this".
 *
 * Two views:
 *   - "With notes" — only holdings that already have a note
 *   - "All"        — every holding, blank rows ready for typing
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, StickyNote, Save, X, ChevronDown, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePortfolioStore, type PortfolioHolding } from '@/stores/portfolioStore';
import { avanzaApi } from '@/integrations/avanza/api';

const BROKER_LABEL: Record<string, { text: string; color: string }> = {
  avanza: { text: 'Avanza', color: 'bg-orange-500/15 text-orange-300' },
  ibkr: { text: 'IBKR', color: 'bg-blue-500/15 text-blue-300' },
  manual: { text: 'Manual', color: 'bg-zinc-500/15 text-zinc-300' },
};

export function NotesTab() {
  const holdings = usePortfolioStore((s) => s.holdings);
  const updateHolding = usePortfolioStore((s) => s.updateHolding);

  const [filter, setFilter] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const base = showAll ? holdings : holdings.filter((h) => (h.notes ?? '').trim().length > 0);
    if (!q) return base;
    return base.filter(
      (h) =>
        h.symbol.toLowerCase().includes(q)
        || (h.name ?? '').toLowerCase().includes(q)
        || (h.notes ?? '').toLowerCase().includes(q),
    );
  }, [holdings, filter, showAll]);

  const noteCount = useMemo(
    () => holdings.filter((h) => (h.notes ?? '').trim().length > 0).length,
    [holdings],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Header strip */}
      <Card className="bg-card/60 backdrop-blur-sm border-border/30">
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium text-foreground">
              {noteCount} of {holdings.length} holdings have notes
            </span>
          </div>
          <div className="flex-1 min-w-[200px] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by symbol, name, or note text"
              className="h-7 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant={showAll ? 'default' : 'outline'}
            onClick={() => setShowAll((s) => !s)}
            className="h-7 text-[11px]"
          >
            {showAll ? 'Showing all' : 'Show all holdings'}
          </Button>
        </CardContent>
      </Card>

      {/* Notes list */}
      {filtered.length === 0 ? (
        <Card className="bg-card/40 border-border/30 border-dashed">
          <CardContent className="py-12 text-center text-xs text-muted-foreground">
            {holdings.length === 0
              ? 'Add a holding to start taking notes.'
              : showAll
                ? 'No holdings match your filter.'
                : 'No notes yet. Click "Show all holdings" or use the note icon on any holding row.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((h) => (
            <HoldingNoteCard
              key={h.id}
              holding={h}
              onSave={(text) => updateHolding(h.id, { notes: text })}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

interface HoldingNoteCardProps {
  holding: PortfolioHolding;
  onSave: (text: string) => void;
}

function HoldingNoteCard({ holding, onSave }: HoldingNoteCardProps) {
  const initial = holding.notes ?? '';
  const [draft, setDraft] = useState(initial);
  const [avanzaNote, setAvanzaNote] = useState<string | null>(null);
  const [avanzaExpanded, setAvanzaExpanded] = useState(false);
  const broker = holding.broker ?? 'manual';
  const badge = BROKER_LABEL[broker] ?? BROKER_LABEL.manual;

  // Reset draft when the underlying note changes (e.g. cross-tab edit)
  useEffect(() => {
    setDraft(holding.notes ?? '');
  }, [holding.notes]);

  // For Avanza holdings, fetch the Avanza-side note (read-only) on demand.
  // We use the orderbook portion of `holding.id` which we set as `avanza-{account}-{orderbook}`.
  useEffect(() => {
    if (broker !== 'avanza') return;
    const parts = holding.id.split('-');
    const orderbookId = parts[parts.length - 1];
    if (!orderbookId || !/^\d+$/.test(orderbookId)) return;
    let cancelled = false;
    avanzaApi
      .noteFor(orderbookId)
      .then((d) => {
        if (cancelled) return;
        const text = (d && typeof d === 'object' && 'note' in d
          ? String((d as { note?: string }).note ?? '')
          : '').trim();
        if (text) setAvanzaNote(text);
      })
      .catch(() => {/* no avanza note — ignore */});
    return () => {
      cancelled = true;
    };
  }, [broker, holding.id]);

  const dirty = draft !== initial;

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-foreground/80 flex items-center gap-2 flex-wrap">
          <Briefcase className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-medium text-foreground">{holding.symbol}</span>
          <span className="text-muted-foreground font-normal truncate max-w-[280px]">
            {holding.name}
          </span>
          <Badge className={`${badge.color} text-[9px] px-1.5 py-0`}>{badge.text}</Badge>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {holding.quantity} @ avg {holding.avgCost?.toFixed(2)} {holding.currency}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Why you bought this, what to watch, exit plan…"
          className="text-xs min-h-[80px] font-sans"
        />
        <div className="flex items-center gap-2">
          {dirty ? (
            <>
              <Button size="sm" onClick={() => onSave(draft)} className="h-6 text-[11px] gap-1">
                <Save className="w-3 h-3" />
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDraft(initial)}
                className="h-6 text-[11px] gap-1"
              >
                <X className="w-3 h-3" />
                Discard
              </Button>
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              {initial ? 'Saved' : 'Empty — type to add a note'}
            </span>
          )}
          {avanzaNote && (
            <button
              onClick={() => setAvanzaExpanded((s) => !s)}
              className="ml-auto text-[10px] text-orange-300 hover:text-orange-200 inline-flex items-center gap-1"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${avanzaExpanded ? 'rotate-180' : ''}`} />
              {avanzaExpanded ? 'Hide' : 'Show'} Avanza-side note
            </button>
          )}
        </div>
        {avanzaNote && avanzaExpanded && (
          <div className="rounded bg-orange-500/5 border border-orange-500/20 p-2.5 text-[11px] text-foreground whitespace-pre-wrap">
            <div className="text-[9px] uppercase tracking-wide text-orange-300 mb-1">
              From Avanza (read-only)
            </div>
            {avanzaNote}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
