/**
 * AuditLogPanel — append-only event viewer with category filters.
 *
 * Reads from useAuditStore.events; intended as the "what happened and why"
 * timeline a compliance officer or PM would scan to reconstruct decisions.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Filter } from 'lucide-react';
import { useAuditStore, type AuditCategory, type AuditEvent } from '@/stores/auditStore';

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  trade: 'Trade',
  order: 'Order',
  portfolio: 'Portfolio',
  account: 'Account',
  agent: 'Agent',
  risk: 'Risk',
  config: 'Config',
};

const CATEGORY_COLOR: Record<AuditCategory, string> = {
  trade: 'text-emerald-400',
  order: 'text-blue-400',
  portfolio: 'text-purple-400',
  account: 'text-cyan-400',
  agent: 'text-amber-400',
  risk: 'text-red-400',
  config: 'text-muted-foreground',
};

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export function AuditLogPanel() {
  const events = useAuditStore((s) => s.events);
  const [filter, setFilter] = useState<AuditCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  const filtered: AuditEvent[] = useMemo(() => {
    let xs = events;
    if (filter !== 'all') xs = xs.filter((e) => e.category === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      xs = xs.filter(
        (e) =>
          e.summary.toLowerCase().includes(q) ||
          (e.note ?? '').toLowerCase().includes(q) ||
          e.actor.toLowerCase().includes(q)
      );
    }
    return [...xs].reverse();
  }, [events, filter, query]);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
          <ScrollText className="w-4 h-4 text-primary" />
          Audit log
          <span className="text-[10px] font-normal text-muted-foreground">
            {filtered.length} of {events.length}
          </span>
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search…"
            className="h-7 px-2 rounded-md bg-muted/40 border border-border/60 text-[11px] w-32"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as AuditCategory | 'all')}
            className="h-7 px-2 rounded-md bg-muted/40 border border-border/60 text-[11px]"
          >
            <option value="all">All</option>
            {(Object.keys(CATEGORY_LABEL) as AuditCategory[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-6">
            No events match. Trigger a buy/sell/import to populate.
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <ul className="divide-y divide-border/30">
              {filtered.map((e) => (
                <li key={e.id} className="px-3 py-1.5 text-xs hover:bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLOR[e.category]}`}>
                      {CATEGORY_LABEL[e.category]}
                    </Badge>
                    <span className="text-foreground">{e.summary}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{fmtTime(e.ts)}</span>
                    <span>·</span>
                    <span>{e.actor}</span>
                    {e.accountId && (
                      <>
                        <span>·</span>
                        <span>{e.accountId}</span>
                      </>
                    )}
                  </div>
                  {e.note && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground italic">{e.note}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AuditLogPanel;
