/**
 * MarketOverviewWidget — top index strip + gainers/losers tables.
 * Powered by /api/integrations/avanza/market-overview.
 */
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { avanzaApi } from '@/integrations/avanza/api';
import { useNavigate } from 'react-router-dom';

interface OrderbookRow {
  orderbookId: string;
  name: string;
  countryCode?: string;
  currency?: string;
  instrumentType?: string;
  closingPrice?: number;
  // Different priceXAgo / changeFromX % shapes vary by Avanza
  lastPrice?: number | { value?: number };
  priceOneDayAgo?: number | { value?: number };
  changePercent?: number | { value?: number };
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

const fmtPct = (n: number | null): string => (n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`);
const fmtPrice = (n: number | null, ccy = ''): string => (n == null ? '—' : `${n.toFixed(2)} ${ccy}`);

const INDEX_ALIASES: Array<{ id: string; label: string }> = [
  { id: '19002', label: 'OMX30' },
  { id: '19000', label: 'S&P 500' },
  { id: '18981', label: 'Nasdaq 100' },
  { id: '18983', label: 'Dow' },
];

interface IndexQuote {
  label: string;
  last?: number;
  changePct?: number;
}

export function MarketOverviewWidget() {
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof avanzaApi.marketOverview>> | null>(null);
  const [indexes, setIndexes] = useState<IndexQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    avanzaApi
      .marketOverview()
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    // Fetch indexes in parallel
    Promise.all(
      INDEX_ALIASES.map(async ({ id, label }) => {
        try {
          const r = (await avanzaApi.marketIndex(id)) as {
            quote?: { last?: number; changePercent?: number };
          };
          return { label, last: r.quote?.last, changePct: r.quote?.changePercent };
        } catch {
          return { label, last: undefined, changePct: undefined };
        }
      }),
    ).then((res) => !cancelled && setIndexes(res));
    return () => {
      cancelled = true;
    };
  }, []);

  const gainers = (data?.gainers?.orderbooks ?? []) as OrderbookRow[];
  const losers = (data?.losers?.orderbooks ?? []) as OrderbookRow[];

  return (
    <div className="space-y-4">
      {/* ─── Index ticker strip ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {indexes.map((idx) => {
          const positive = (idx.changePct ?? 0) >= 0;
          return (
            <div key={idx.label} className="p-3 rounded-md bg-card/60 border border-border/30">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Activity className="w-3 h-3" />
                {idx.label}
              </div>
              <div className="text-lg font-semibold text-foreground tabular-nums mt-1">
                {idx.last != null ? idx.last.toFixed(2) : '—'}
              </div>
              <div
                className={`text-xs font-medium tabular-nums flex items-center gap-1 ${
                  positive ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {fmtPct(idx.changePct ?? null)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Gainers / Losers tables ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MoverList
          title="Top Gainers"
          icon={<ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />}
          rows={gainers}
          tone="profit"
          onRowClick={(ob) => navigate(`/stock/${ob}`)}
          loading={loading}
        />
        <MoverList
          title="Top Losers"
          icon={<ArrowDownRight className="w-3.5 h-3.5 text-red-400" />}
          rows={losers}
          tone="loss"
          onRowClick={(ob) => navigate(`/stock/${ob}`)}
          loading={loading}
        />
      </div>
    </div>
  );
}

function MoverList({
  title,
  icon,
  rows,
  tone,
  onRowClick,
  loading,
}: {
  title: string;
  icon: React.ReactNode;
  rows: OrderbookRow[];
  tone: 'profit' | 'loss';
  onRowClick: (orderbookId: string) => void;
  loading: boolean;
}) {
  const accent = tone === 'profit' ? 'text-emerald-400' : 'text-red-400';
  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-foreground/80 flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-xs text-muted-foreground py-4 text-center">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">No data.</div>
        ) : (
          <div className="space-y-1">
            {rows.slice(0, 10).map((r) => {
              const change = num(r.changePercent);
              const price = num(r.lastPrice) ?? r.closingPrice ?? null;
              return (
                <button
                  key={r.orderbookId}
                  onClick={() => onRowClick(r.orderbookId)}
                  className="w-full flex items-center justify-between p-2 rounded hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    {r.countryCode && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {r.countryCode}
                      </Badge>
                    )}
                    <span className="text-xs text-foreground truncate">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs tabular-nums">
                    <span className="text-muted-foreground">{fmtPrice(price, r.currency ?? '')}</span>
                    <span className={`font-semibold ${accent}`}>{fmtPct(change)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
