/**
 * Avanza Insights - rich data surfaced from the Avanza account-performance
 * endpoints. Renders nothing if Avanza is not connected.
 *
 * Includes:
 *  - Multi-period returns strip (1W / 1M / 3M / YTD / 1Y / 3Y)
 *  - Key risk metrics (Sharpe ratio, std deviation, CAGR)
 *  - Per-account breakdown
 *  - Upcoming dividends list
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Activity, PieChart as PieIcon, Calendar, Wallet, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { avanzaApi } from '@/integrations/avanza/api';

// ─── Avanza response shapes (subset we use) ──────────────────────

interface AmountValue {
  value: number;
  unit?: string;
  unitType?: string;
  decimalPrecision?: number;
}

interface DevelopmentPeriod {
  absolute?: AmountValue;
  relative?: AmountValue;
}

interface TotalsResponse {
  totalValue?: {
    totalValue?: AmountValue;
    positionValue?: AmountValue;
    balanceOnTradingAccounts?: AmountValue;
    balanceOnSavingsAccounts?: AmountValue;
  };
  totalDevelopment?: Record<string, DevelopmentPeriod>;
  buyingPower?: { total?: AmountValue };
  accounts?: Array<{
    info: { id: string; type: string; name: string; urlParameterId: string };
    isTradable: boolean;
    totalValue?: { totalValue?: AmountValue; positionValue?: AmountValue };
  }>;
}

interface KeyRatiosResponse {
  sharpeRatio?: AmountValue;
  standardDeviation?: AmountValue;
  compoundAnnualGrowthRate?: AmountValue;
}

interface UpcomingDividend {
  isin: string;
  date: string;
  exDate?: string;
  amountInSek: number;
  instrumentName: string;
  volume: number;
  amountPerShareInSek: number;
  amount?: { value: number; currency: string };
  orderbook?: { id: string; flagCode?: string; currency?: string };
  status?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

const formatSek = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(n);
};

const formatPct = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
};

const PERIOD_LABELS: Array<{ key: string; label: string }> = [
  { key: 'ONE_WEEK', label: '1W' },
  { key: 'ONE_MONTH', label: '1M' },
  { key: 'THREE_MONTHS', label: '3M' },
  { key: 'THIS_YEAR', label: 'YTD' },
  { key: 'ONE_YEAR', label: '1Y' },
  { key: 'THREE_YEARS', label: '3Y' },
];

const ACCOUNT_TYPE_BADGE: Record<string, { label: string; color: string }> = {
  INVESTERINGSSPARKONTO: { label: 'ISK', color: 'bg-blue-500/15 text-blue-400' },
  KAPITALFORSAKRING: { label: 'KF', color: 'bg-purple-500/15 text-purple-400' },
  SPARKONTO: { label: 'Savings', color: 'bg-emerald-500/15 text-emerald-400' },
  AKTIEFONDKONTO: { label: 'AF', color: 'bg-orange-500/15 text-orange-400' },
};

// ─── Component ───────────────────────────────────────────────────

export function AvanzaInsights({ connected }: { connected: boolean }) {
  const navigate = useNavigate();
  const [totals, setTotals] = useState<TotalsResponse | null>(null);
  const [keyRatios, setKeyRatios] = useState<KeyRatiosResponse | null>(null);
  const [dividends, setDividends] = useState<UpcomingDividend[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      avanzaApi.performanceTotals(),
      avanzaApi.performanceKeyratios(),
      avanzaApi.upcomingDividends(),
    ])
      .then(([t, k, d]) => {
        if (cancelled) return;
        if (t.status === 'fulfilled') setTotals(t.value as TotalsResponse);
        if (k.status === 'fulfilled') setKeyRatios(k.value as KeyRatiosResponse);
        if (d.status === 'fulfilled' && Array.isArray(d.value)) {
          setDividends(d.value as UpcomingDividend[]);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [connected]);

  const totalDividendsSek = useMemo(
    () => dividends.reduce((sum, d) => sum + (d.amountInSek || 0), 0),
    [dividends],
  );

  if (!connected) return null;

  const totalValue = totals?.totalValue?.totalValue?.value;
  const positionValue = totals?.totalValue?.positionValue?.value;
  const cashValue = totals?.totalValue?.balanceOnTradingAccounts?.value;
  const sharpe = keyRatios?.sharpeRatio?.value;
  const stdDev = keyRatios?.standardDeviation?.value;
  const cagr = keyRatios?.compoundAnnualGrowthRate?.value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* ─── Banner: connected source ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-foreground/80">
            Live data from <span className="text-orange-400 font-medium">Avanza</span>
          </span>
        </div>
        {loading && <span className="text-[10px] text-muted-foreground">syncing…</span>}
      </div>

      {/* ─── Top summary cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Wallet className="w-4 h-4" />}
          label="Total Value"
          value={formatSek(totalValue)}
          accent="text-blue-400"
        />
        <SummaryCard
          icon={<PieIcon className="w-4 h-4" />}
          label="Positions"
          value={formatSek(positionValue)}
          accent="text-purple-400"
        />
        <SummaryCard
          icon={<Wallet className="w-4 h-4" />}
          label="Cash"
          value={formatSek(cashValue)}
          accent="text-emerald-400"
        />
        <SummaryCard
          icon={<Calendar className="w-4 h-4" />}
          label="Upcoming Dividends"
          value={formatSek(totalDividendsSek)}
          accent="text-orange-400"
        />
      </div>

      {/* ─── Multi-period returns strip ─── */}
      <Card className="bg-card/60 backdrop-blur-sm border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-foreground/80 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            Returns by Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {PERIOD_LABELS.map(({ key, label }) => {
              const period = totals?.totalDevelopment?.[key];
              const pct = period?.relative?.value ?? null;
              const abs = period?.absolute?.value ?? null;
              const positive = (pct ?? 0) >= 0;
              return (
                <div
                  key={key}
                  className="p-2.5 rounded-md bg-muted/30 border border-border/30"
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </div>
                  <div
                    className={`text-sm font-semibold mt-1 flex items-center gap-1 ${
                      positive ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {positive ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {formatPct(pct)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {abs != null ? formatSek(abs) : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── Risk Metrics ─── */}
        <Card className="bg-card/60 backdrop-blur-sm border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-foreground/80 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              Risk & Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MetricRow
              label="Sharpe Ratio"
              hint="Risk-adjusted return. Higher is better. >1 is good, >2 is great."
              value={sharpe != null ? sharpe.toFixed(2) : '—'}
              color={
                sharpe == null
                  ? 'text-muted-foreground'
                  : sharpe >= 2
                    ? 'text-emerald-400'
                    : sharpe >= 1
                      ? 'text-blue-400'
                      : 'text-orange-400'
              }
            />
            <MetricRow
              label="Volatility (σ)"
              hint="Standard deviation of returns. Lower is calmer."
              value={stdDev != null ? `${stdDev.toFixed(2)}%` : '—'}
              color="text-foreground"
            />
            <MetricRow
              label="CAGR"
              hint="Compound annual growth rate since opening."
              value={cagr != null ? `${cagr.toFixed(2)}%` : '—'}
              color={
                cagr == null
                  ? 'text-muted-foreground'
                  : cagr >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
              }
            />
          </CardContent>
        </Card>

        {/* ─── Accounts breakdown ─── */}
        <Card className="bg-card/60 backdrop-blur-sm border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-foreground/80 flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[200px] overflow-auto">
            {(totals?.accounts ?? [])
              .slice()
              .sort(
                (a, b) =>
                  (b.totalValue?.totalValue?.value ?? 0) -
                  (a.totalValue?.totalValue?.value ?? 0),
              )
              .map((acc) => {
                const badge = ACCOUNT_TYPE_BADGE[acc.info.type] ?? {
                  label: acc.info.type.slice(0, 4),
                  color: 'bg-muted text-muted-foreground',
                };
                return (
                  <button
                    key={acc.info.urlParameterId}
                    onClick={() => navigate(`/account/${acc.info.urlParameterId}`)}
                    className="w-full flex items-center justify-between p-2 rounded bg-muted/20 border border-border/20 hover:bg-muted/40 hover:border-border/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge className={`${badge.color} text-[9px] px-1.5 py-0 font-medium`}>
                        {badge.label}
                      </Badge>
                      <span className="text-xs text-foreground truncate">{acc.info.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground tabular-nums">
                        {formatSek(acc.totalValue?.totalValue?.value)}
                      </span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
                    </div>
                  </button>
                );
              })}
          </CardContent>
        </Card>
      </div>

      {/* ─── Upcoming Dividends ─── */}
      {dividends.length > 0 && (
        <Card className="bg-card/60 backdrop-blur-sm border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-foreground/80 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-orange-400" />
              Upcoming Dividends
              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                {dividends.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[260px] overflow-auto">
              {dividends
                .slice()
                .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
                .map((d) => (
                  <button
                    key={`${d.isin}-${d.date}`}
                    onClick={() => d.orderbook?.id && navigate(`/stock/${d.orderbook.id}`)}
                    className="text-left p-2.5 rounded bg-muted/20 border border-border/30 hover:bg-muted/40 hover:border-border/40 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {d.orderbook?.flagCode && (
                          <span className="text-[10px] uppercase text-muted-foreground">
                            {d.orderbook.flagCode}
                          </span>
                        )}
                        <span className="text-xs text-foreground font-medium truncate">
                          {d.instrumentName}
                        </span>
                      </div>
                      {d.status === 'PRELIMINARY' && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 text-orange-400 border-orange-400/30"
                        >
                          prelim
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-emerald-400 tabular-nums">
                        {formatSek(d.amountInSek)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {d.date}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {d.volume} × {d.amountPerShareInSek?.toFixed(2)} SEK
                    </div>
                  </button>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

// ─── Internal sub-components ─────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="p-3 rounded-md bg-card/60 border border-border/30">
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wide ${accent}`}>
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold text-foreground mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function MetricRow({
  label,
  hint,
  value,
  color,
}: {
  label: string;
  hint: string;
  value: string;
  color: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center justify-between cursor-help">
          <span className="text-xs text-muted-foreground border-b border-dotted border-muted-foreground/40">
            {label}
          </span>
          <span className={`text-base font-semibold tabular-nums ${color}`}>{value}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}
