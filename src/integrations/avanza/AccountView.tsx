/**
 * AccountView — per-account drill-down. Route: /account/:urlParameterId.
 * Shows the single account's positions, totals, and per-period performance.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PAGE_CONTENT_CLASS } from '@/components/PageHeader';
import { avanzaApi } from '@/integrations/avanza/api';

interface AmountValue {
  value: number;
  unit?: string;
}

interface PositionItem {
  account?: { id: string; type: string; name: string; urlParameterId: string };
  instrument?: {
    id: string;
    type: string;
    name: string;
    isin?: string;
    currency?: string;
    orderbook?: {
      id: string;
      name: string;
      flagCode?: string;
      quote?: { latest?: AmountValue; changePercent?: AmountValue };
    };
  };
  volume?: AmountValue;
  value?: AmountValue;
  averageAcquiredPrice?: AmountValue;
  lastTradingDayPerformance?: { absolute?: AmountValue; relative?: AmountValue };
}

const formatSek = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(n);
};

const fmtPct = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
};

const PERIODS = [
  { key: 'ONE_WEEK', label: '1W' },
  { key: 'ONE_MONTH', label: '1M' },
  { key: 'THREE_MONTHS', label: '3M' },
  { key: 'THIS_YEAR', label: 'YTD' },
  { key: 'ONE_YEAR', label: '1Y' },
  { key: 'THREE_YEARS', label: '3Y' },
];

export default function AccountView() {
  const { urlParameterId } = useParams<{ urlParameterId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof avanzaApi.accountDetail>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!urlParameterId) return;
    let cancelled = false;
    setLoading(true);
    avanzaApi
      .accountDetail(urlParameterId)
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [urlParameterId]);

  if (loading) {
    return (
      <div className={`${PAGE_CONTENT_CLASS} py-12 text-center text-muted-foreground text-sm`}>
        Loading account…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`${PAGE_CONTENT_CLASS} py-12 text-center`}>
        <p className="text-red-400 text-sm">{error ?? 'Account not found.'}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/portfolio')}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Portfolio
        </Button>
      </div>
    );
  }

  const overview = data.overview as Record<string, unknown> | undefined;
  const totals = data.totals as {
    totalValue?: { totalValue?: AmountValue; positionValue?: AmountValue };
    totalDevelopment?: Record<string, { absolute?: AmountValue; relative?: AmountValue }>;
    accounts?: Array<{ info: { name: string; type: string }; totalValue?: { totalValue?: AmountValue } }>;
  } | undefined;
  const positions = (data.positions as { withOrderbook?: PositionItem[] } | undefined)?.withOrderbook ?? [];

  const accountName =
    (totals?.accounts?.[0]?.info?.name as string) ||
    ((overview?.account as { name?: string })?.name) ||
    (urlParameterId ?? 'Account');
  const accountType = (totals?.accounts?.[0]?.info?.type as string) || '';

  const totalValue = totals?.totalValue?.totalValue?.value;
  const positionValue = totals?.totalValue?.positionValue?.value;

  return (
    <div className={`${PAGE_CONTENT_CLASS} space-y-4`}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/portfolio')}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Portfolio
        </Button>
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-orange-400" />
          <h1 className="text-xl font-semibold text-foreground">{accountName}</h1>
          {accountType && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {accountType}
            </Badge>
          )}
        </div>
      </div>

      {/* ─── Summary strip ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard label="Total Value" value={formatSek(totalValue)} accent="text-blue-400" icon={<Wallet className="w-3.5 h-3.5" />} />
        <SummaryCard label="Position Value" value={formatSek(positionValue)} accent="text-purple-400" icon={<Briefcase className="w-3.5 h-3.5" />} />
        <SummaryCard label="Positions" value={String(positions.length)} accent="text-emerald-400" icon={<Briefcase className="w-3.5 h-3.5" />} />
      </div>

      {/* ─── Returns by period ─── */}
      <Card className="bg-card/60 backdrop-blur-sm border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-foreground/80">Returns by Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {PERIODS.map(({ key, label }) => {
              const period = totals?.totalDevelopment?.[key];
              const pct = period?.relative?.value;
              const abs = period?.absolute?.value;
              const positive = (pct ?? 0) >= 0;
              return (
                <div key={key} className="p-2.5 rounded-md bg-muted/30 border border-border/30">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                  <div
                    className={`text-sm font-semibold mt-1 flex items-center gap-1 ${
                      positive ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {fmtPct(pct ?? null)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{formatSek(abs)}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── Positions table ─── */}
      <Card className="bg-card/60 backdrop-blur-sm border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-foreground/80">Positions ({positions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No positions in this account.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="text-left py-1.5 px-2">Name</th>
                  <th className="text-right py-1.5 px-2">Qty</th>
                  <th className="text-right py-1.5 px-2">Avg Cost (SEK)</th>
                  <th className="text-right py-1.5 px-2">Last</th>
                  <th className="text-right py-1.5 px-2">Day</th>
                  <th className="text-right py-1.5 px-2">Value (SEK)</th>
                </tr>
              </thead>
              <tbody>
                {positions
                  .slice()
                  .sort((a, b) => (b.value?.value ?? 0) - (a.value?.value ?? 0))
                  .map((p) => {
                    const ob = p.instrument?.orderbook;
                    const dayPct = p.lastTradingDayPerformance?.relative?.value;
                    const positive = (dayPct ?? 0) >= 0;
                    return (
                      <tr
                        key={`${p.account?.id}-${ob?.id}`}
                        onClick={() => ob?.id && navigate(`/stock/${ob.id}`)}
                        className="border-b border-border/20 hover:bg-muted/30 cursor-pointer"
                      >
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            {ob?.flagCode && (
                              <span className="text-[9px] uppercase text-muted-foreground">{ob.flagCode}</span>
                            )}
                            <span className="text-foreground">{p.instrument?.name ?? ob?.name ?? p.instrument?.id}</span>
                          </div>
                        </td>
                        <td className="text-right py-2 px-2 tabular-nums">{p.volume?.value ?? '—'}</td>
                        <td className="text-right py-2 px-2 tabular-nums text-muted-foreground">
                          {p.averageAcquiredPrice?.value ? p.averageAcquiredPrice.value.toFixed(2) : '—'}
                        </td>
                        <td className="text-right py-2 px-2 tabular-nums">
                          {ob?.quote?.latest?.value ? ob.quote.latest.value.toFixed(2) : '—'}
                        </td>
                        <td
                          className={`text-right py-2 px-2 tabular-nums font-medium ${
                            positive ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {fmtPct(dayPct ?? null)}
                        </td>
                        <td className="text-right py-2 px-2 tabular-nums font-medium">
                          {formatSek(p.value?.value)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-md bg-card/60 border border-border/30"
    >
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wide ${accent}`}>
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold text-foreground mt-1 tabular-nums">{value}</div>
    </motion.div>
  );
}
