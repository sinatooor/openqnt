/**
 * EarningsCalendar — upcoming earnings for symbols you hold (or watch).
 *
 * Reads from /api/earnings/upcoming when available; otherwise shows a stub
 * with empty rows so the UI shape is in place. Highlights symbols you hold.
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePortfolioStore } from '@/stores/portfolioStore';

import { apiBase } from '@/lib/runtimeConfig';
const API_BASE =
  apiBase();

export interface EarningsEvent {
  symbol: string;
  name?: string;
  /** ISO date of expected report. */
  reportDate: string;
  /** "bmo" = before market open, "amc" = after market close. */
  session?: 'bmo' | 'amc' | 'unknown';
  /** Consensus EPS estimate. */
  epsEstimate?: number | null;
  /** Most recent EPS actual (last quarter). */
  epsLast?: number | null;
  /** YoY revenue growth estimate (decimal, e.g. 0.08). */
  revenueGrowth?: number | null;
  /** Implied move from options (decimal). */
  impliedMove?: number | null;
}

const STUB_EVENTS: EarningsEvent[] = [];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });

export function EarningsCalendar({ symbols }: { symbols?: string[] } = {}) {
  const holdings = usePortfolioStore((s) => s.holdings);
  const heldSymbols = useMemo(() => new Set(holdings.map((h) => h.symbol)), [holdings]);
  const watchlist = symbols ?? holdings.map((h) => h.symbol);

  const [events, setEvents] = useState<EarningsEvent[]>(STUB_EVENTS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (watchlist.length === 0) return;
    const ctrl = new AbortController();
    const params = new URLSearchParams({ symbols: watchlist.join(',') });
    fetch(`${API_BASE}/api/earnings/upcoming?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data: { events?: EarningsEvent[] }) => {
        if (Array.isArray(data?.events)) setEvents(data.events);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => ctrl.abort();
  }, [watchlist.join(',')]);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
          <Calendar className="w-4 h-4 text-purple-400" />
          Earnings calendar
          <span className="text-[10px] font-normal text-muted-foreground">
            next 14 days · your holdings
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">
            {error
              ? `Live earnings feed unavailable — wire ${API_BASE}/api/earnings/upcoming.`
              : 'No earnings reports for your holdings in the next 14 days.'}
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {events.map((e, i) => {
              const held = heldSymbols.has(e.symbol);
              return (
                <li key={`${e.symbol}-${i}`} className="py-1.5 flex items-center gap-2 text-xs">
                  <span className="font-mono text-foreground w-16">{e.symbol}</span>
                  {held && <Briefcase className="w-3 h-3 text-emerald-400" />}
                  <span className="text-muted-foreground flex-1 truncate">{e.name ?? ''}</span>
                  <span className="text-foreground">{fmtDate(e.reportDate)}</span>
                  {e.session && (
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {e.session === 'bmo' ? 'pre' : e.session === 'amc' ? 'post' : '?'}
                    </Badge>
                  )}
                  {e.epsEstimate != null && (
                    <span className="text-[10px] text-muted-foreground font-mono w-16 text-right">
                      est ${e.epsEstimate.toFixed(2)}
                    </span>
                  )}
                  {e.impliedMove != null && (
                    <span className="text-[10px] text-amber-400 font-mono w-16 text-right">
                      ±{(e.impliedMove * 100).toFixed(1)}%
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default EarningsCalendar;
