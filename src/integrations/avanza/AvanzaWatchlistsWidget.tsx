/**
 * AvanzaWatchlistsWidget — pick one of the user's Avanza watchlists, see
 * live quotes for every item in it. Powered by /watchlist/quotes which calls
 * Avanza's /_api/watchlist/data/by-id under the hood.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ListChecks, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { avanzaApi, type AvanzaWatchlist } from '@/integrations/avanza/api';

// Row shape from /_api/watchlist/data/by-id — fields vary by data points requested
interface QuoteRow {
  id: string;
  name?: string;
  flagCode?: string;
  shortName?: string;
  instrumentType?: string;
  currency?: string;
  // Avanza nests these under inconsistent shapes
  lastPrice?: number | { value?: number };
  changePercent?: number | { value?: number };
  change?: number | { value?: number };
  highestPrice?: number | { value?: number };
  lowestPrice?: number | { value?: number };
  oneYearPerformance?: number | { value?: number };
}

const num = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'object' && v !== null && 'value' in v) {
    const inner = (v as { value?: unknown }).value;
    return typeof inner === 'number' && Number.isFinite(inner) ? inner : null;
  }
  return null;
};

const fmtPct = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`);
const fmtPrice = (n: number | null) => (n == null ? '—' : n.toFixed(2));

export function AvanzaWatchlistsWidget({ connected }: { connected: boolean }) {
  const navigate = useNavigate();
  const [watchlists, setWatchlists] = useState<AvanzaWatchlist[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedList = useMemo(
    () => watchlists.find((w) => w.id === selectedId),
    [watchlists, selectedId],
  );

  // Load watchlist list once
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    avanzaApi
      .watchlists()
      .then(({ watchlists: list }) => {
        if (cancelled) return;
        setWatchlists(list);
        // Auto-select the first non-empty list
        const firstWithItems = list.find((w) => w.orderbookIds.length > 0) ?? list[0];
        if (firstWithItems) setSelectedId(firstWithItems.id);
      })
      .catch((e: unknown) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [connected]);

  // Load quotes for selected list
  const refetch = async () => {
    if (!selectedList || selectedList.orderbookIds.length === 0) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = (await avanzaApi.watchlistQuotes({
        watchlistId: selectedList.id,
        orderbookIds: selectedList.orderbookIds,
      })) as unknown as QuoteRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (!connected) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-card/60 backdrop-blur-sm border-border/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xs text-foreground/80 flex items-center gap-2">
              <ListChecks className="w-3.5 h-3.5 text-orange-400" />
              Avanza Watchlists
              {selectedList && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  {selectedList.orderbookIds.length} items
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="h-7 w-[180px] text-xs">
                  <SelectValue placeholder="Pick a watchlist" />
                </SelectTrigger>
                <SelectContent>
                  {watchlists.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.orderbookIds.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => void refetch()}
                disabled={loading}
                className="p-1.5 rounded hover:bg-muted/60 text-foreground/70 hover:text-foreground transition-colors"
                title="Refresh quotes"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-xs text-red-400 py-2 px-3 rounded bg-red-500/5 border border-red-500/20 mb-2">
              {error}
            </div>
          )}
          {!selectedList || selectedList.orderbookIds.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">
              {watchlists.length === 0
                ? 'No watchlists found.'
                : 'This watchlist is empty.'}
            </div>
          ) : rows.length === 0 && loading ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Loading quotes…</div>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card/95 backdrop-blur">
                  <tr className="border-b border-border/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="text-left py-1.5 px-2">Name</th>
                    <th className="text-right py-1.5 px-2">Last</th>
                    <th className="text-right py-1.5 px-2">Change</th>
                    <th className="text-right py-1.5 px-2">Day H/L</th>
                    <th className="text-right py-1.5 px-2">1Y</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const last = num(r.lastPrice);
                    const chg = num(r.changePercent);
                    const high = num(r.highestPrice);
                    const low = num(r.lowestPrice);
                    const oneY = num(r.oneYearPerformance);
                    const positive = (chg ?? 0) >= 0;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => navigate(`/stock/${r.id}`)}
                        className="border-b border-border/20 hover:bg-muted/30 cursor-pointer"
                      >
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {r.flagCode && (
                              <span className="text-[9px] uppercase text-muted-foreground">
                                {r.flagCode}
                              </span>
                            )}
                            <span className="text-foreground truncate">
                              {r.name ?? r.shortName ?? r.id}
                            </span>
                          </div>
                        </td>
                        <td className="text-right py-2 px-2 tabular-nums">
                          {fmtPrice(last)}
                        </td>
                        <td
                          className={`text-right py-2 px-2 tabular-nums font-medium ${
                            positive ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {positive ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {fmtPct(chg)}
                          </span>
                        </td>
                        <td className="text-right py-2 px-2 text-muted-foreground tabular-nums text-[10px]">
                          {high != null && low != null
                            ? `${low.toFixed(2)} / ${high.toFixed(2)}`
                            : '—'}
                        </td>
                        <td
                          className={`text-right py-2 px-2 tabular-nums text-[10px] ${
                            (oneY ?? 0) >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'
                          }`}
                        >
                          {fmtPct(oneY)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
