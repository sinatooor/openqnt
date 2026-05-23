/**
 * StockDetail — per-stock detail page. Route: /stock/:orderbookId.
 * Shows quote, key indicators, order depth, recent trades, and user notes.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Activity, BookOpen, Building2, StickyNote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PAGE_CONTENT_CLASS } from '@/components/PageHeader';
import { avanzaApi } from '@/integrations/avanza/api';

interface Quote {
  buy?: number;
  sell?: number;
  last?: number;
  highest?: number;
  lowest?: number;
  change?: number;
  changePercent?: number;
  spread?: number;
  totalVolumeTraded?: number;
  isRealTime?: boolean;
  timeOfLast?: number;
}

interface DepthLevel {
  price?: number;
  volume?: number;
  total?: number;
}

interface OrderDepth {
  receivedTime?: string;
  totalLevel?: number;
  highestBuyPrice?: number;
  lowestSellPrice?: number;
  levels?: Array<{ buySide?: DepthLevel; sellSide?: DepthLevel }>;
}

interface Trade {
  buyer?: string;
  seller?: string;
  price?: number;
  volume?: number;
  time?: string;
  matchedOnMarket?: boolean;
}

interface Info {
  name?: string;
  isin?: string;
  tickerSymbol?: string;
  currency?: string;
  flagCode?: string;
  listing?: { tickerSymbol?: string; currency?: string; marketPlaceCode?: string };
  keyIndicators?: Record<string, number>;
}

const fmt = (n: number | undefined | null, d = 2): string =>
  n == null || !Number.isFinite(n) ? '—' : n.toFixed(d);

const fmtVol = (n: number | undefined | null): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
};

const fmtPct = (n: number | undefined | null) =>
  n == null || !Number.isFinite(n) ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

export default function StockDetail() {
  const { orderbookId } = useParams<{ orderbookId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof avanzaApi.stockDetail>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderbookId) return;
    let cancelled = false;
    setLoading(true);
    avanzaApi
      .stockDetail(orderbookId)
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [orderbookId]);

  if (loading) {
    return (
      <div className={`${PAGE_CONTENT_CLASS} py-12 text-center text-muted-foreground text-sm`}>
        Loading stock…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`${PAGE_CONTENT_CLASS} py-12 text-center`}>
        <p className="text-red-400 text-sm">{error ?? 'Stock not found.'}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back
        </Button>
      </div>
    );
  }

  const info = (data.info as Info) ?? {};
  const quote = (data.quote as Quote) ?? {};
  const orderdepth = (data.orderdepth as OrderDepth) ?? {};
  const trades = (data.trades as { trades?: Trade[] })?.trades ?? [];
  const positive = (quote.changePercent ?? 0) >= 0;

  const ticker = info.tickerSymbol ?? info.listing?.tickerSymbol;
  const currency = info.currency ?? info.listing?.currency ?? 'SEK';

  return (
    <div className={`${PAGE_CONTENT_CLASS} space-y-4`}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          {info.flagCode && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {info.flagCode}
            </Badge>
          )}
          <h1 className="text-xl font-semibold text-foreground truncate">
            {info.name ?? orderbookId}
          </h1>
          {ticker && <span className="text-sm text-muted-foreground">({ticker})</span>}
        </div>
      </div>

      {/* ─── Quote panel ─── */}
      <Card className="bg-card/60 backdrop-blur-sm border-border/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Last</div>
              <div className="text-3xl font-bold text-foreground tabular-nums">
                {fmt(quote.last)} <span className="text-base text-muted-foreground">{currency}</span>
              </div>
            </div>
            <div
              className={`text-lg font-semibold flex items-center gap-1 ${
                positive ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {fmt(quote.change)} ({fmtPct(quote.changePercent)})
            </div>
            <div className="ml-auto text-[10px] text-muted-foreground">
              {quote.isRealTime ? 'Real-time' : 'Delayed'}
              {quote.timeOfLast ? ` · ${new Date(quote.timeOfLast).toLocaleTimeString()}` : ''}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
            <Stat label="Buy" value={fmt(quote.buy)} />
            <Stat label="Sell" value={fmt(quote.sell)} />
            <Stat label="High" value={fmt(quote.highest)} />
            <Stat label="Low" value={fmt(quote.lowest)} />
            <Stat label="Spread" value={fmt(quote.spread, 4)} />
            <Stat label="Volume" value={fmtVol(quote.totalVolumeTraded)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── Order depth ─── */}
        <Card className="bg-card/60 backdrop-blur-sm border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-foreground/80 flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              Order Depth
              {orderdepth.totalLevel != null && (
                <span className="text-[10px] text-muted-foreground">({orderdepth.totalLevel} levels)</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!orderdepth.levels?.length ? (
              <div className="text-xs text-muted-foreground py-6 text-center">No depth data.</div>
            ) : (
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border/40">
                    <th className="text-right py-1.5 px-2">Buy Vol</th>
                    <th className="text-right py-1.5 px-2">Buy</th>
                    <th className="text-right py-1.5 px-2">Sell</th>
                    <th className="text-right py-1.5 px-2">Sell Vol</th>
                  </tr>
                </thead>
                <tbody>
                  {orderdepth.levels.slice(0, 10).map((lv, i) => (
                    <tr key={i} className="border-b border-border/20">
                      <td className="text-right py-1.5 px-2 text-muted-foreground">{fmtVol(lv.buySide?.volume)}</td>
                      <td className="text-right py-1.5 px-2 text-emerald-400 font-medium">{fmt(lv.buySide?.price)}</td>
                      <td className="text-right py-1.5 px-2 text-red-400 font-medium">{fmt(lv.sellSide?.price)}</td>
                      <td className="text-right py-1.5 px-2 text-muted-foreground">{fmtVol(lv.sellSide?.volume)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* ─── Recent trades ─── */}
        <Card className="bg-card/60 backdrop-blur-sm border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-foreground/80 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Recent Trades
              <span className="text-[10px] text-muted-foreground">({trades.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trades.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">No trades.</div>
            ) : (
              <div className="max-h-[280px] overflow-auto">
                <table className="w-full text-xs tabular-nums">
                  <thead className="sticky top-0 bg-card/95">
                    <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border/40">
                      <th className="text-left py-1.5 px-2">Time</th>
                      <th className="text-right py-1.5 px-2">Price</th>
                      <th className="text-right py-1.5 px-2">Vol</th>
                      <th className="text-left py-1.5 px-2">B/S</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.slice(0, 25).map((t, i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-1.5 px-2 text-muted-foreground">{t.time?.slice(11, 19) ?? ''}</td>
                        <td className="text-right py-1.5 px-2">{fmt(t.price)}</td>
                        <td className="text-right py-1.5 px-2 text-muted-foreground">{fmtVol(t.volume)}</td>
                        <td className="py-1.5 px-2 text-[10px] text-muted-foreground truncate">
                          {t.buyer ?? ''} / {t.seller ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Key indicators + Notes ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {info.keyIndicators && Object.keys(info.keyIndicators).length > 0 && (
          <Card className="bg-card/60 backdrop-blur-sm border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-foreground/80 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                Key Indicators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(info.keyIndicators).slice(0, 12).map(([k, v]) => (
                  <div key={k} className="flex justify-between p-1.5 rounded bg-muted/20">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-foreground tabular-nums font-medium">
                      {typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <NoteCard note={data.note} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-foreground tabular-nums font-medium">{value}</div>
    </div>
  );
}

function NoteCard({ note }: { note: unknown }) {
  const text =
    note && typeof note === 'object' && 'note' in note
      ? String((note as { note?: string }).note ?? '')
      : note && typeof note === 'string'
        ? note
        : '';
  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-foreground/80 flex items-center gap-2">
          <StickyNote className="w-3.5 h-3.5 text-orange-400" />
          My Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {text ? (
          <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{text}</div>
        ) : (
          <div className="text-xs text-muted-foreground italic">No note saved for this instrument.</div>
        )}
      </CardContent>
    </Card>
  );
}
