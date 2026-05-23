/**
 * IbkrInsights — top-of-Portfolio panel for the IBKR section.
 *
 * Mirrors `AvanzaInsights` visually but uses IBKR's simpler data model
 * (no native multi-period dev breakdown out of the box). Shows
 * equity / cash / buying power / unrealised P&L plus the top positions.
 *
 * Renders an empty state when IBKR is disconnected so the user has a
 * clear path to start TWS — no infinite spinner.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Wallet,
  PieChart as PieIcon,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ibkrApi, type IbkrAccount } from '@/integrations/ibkr/api';

const fmtUsd = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
};

const fmtPct = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
};

export function IbkrInsights({ connected }: { connected: boolean }) {
  const [account, setAccount] = useState<IbkrAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) {
      setAccount(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    ibkrApi
      .account()
      .then((a) => {
        if (cancelled) return;
        setAccount(a);
        setError(null);
      })
      .catch((e: unknown) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [connected]);

  const topPositions = useMemo(() => {
    if (!account?.positions) return [];
    return [...account.positions]
      .filter((p) => p.qty !== 0)
      .sort((a, b) => Math.abs(b.qty * b.last_price) - Math.abs(a.qty * a.last_price))
      .slice(0, 8);
  }, [account]);

  // ── Disconnected state ───────────────────────────────────────
  if (!connected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-lg border border-border/30 bg-card/40 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-muted-foreground/40 mt-2 shrink-0" />
          <div className="flex-1">
            <div className="text-xs text-foreground/80 flex items-center gap-2">
              Interactive Brokers
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
                Not connected
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Start TWS or IB Gateway and connect from Settings → Brokers → Interactive Brokers to load
              positions, equity, and buying power here.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Loaded state ─────────────────────────────────────────────
  const equity = account?.equity;
  const cash = account?.cash;
  const buyingPower = account?.buying_power;
  const unrealised = account?.unrealised_pnl;
  const positionsCount = topPositions.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-xs text-foreground/80">
            Live data from <span className="text-blue-400 font-medium">Interactive Brokers</span>
          </span>
        </div>
        {loading && <span className="text-[10px] text-muted-foreground">syncing…</span>}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded border border-red-500/30 bg-red-500/5 text-xs text-red-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Wallet className="w-4 h-4" />}
          label="Equity"
          value={fmtUsd(equity)}
          accent="text-blue-400"
        />
        <SummaryCard
          icon={<Wallet className="w-4 h-4" />}
          label="Cash"
          value={fmtUsd(cash)}
          accent="text-emerald-400"
        />
        <SummaryCard
          icon={<Activity className="w-4 h-4" />}
          label="Buying Power"
          value={fmtUsd(buyingPower)}
          accent="text-purple-400"
        />
        <SummaryCard
          icon={(unrealised ?? 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          label="Unrealised P&L"
          value={fmtUsd(unrealised)}
          accent={(unrealised ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>

      <Card className="bg-card/60 backdrop-blur-sm border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-foreground/80 flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5 text-blue-400" />
            Top Positions
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
              {positionsCount} of {account?.positions?.length ?? 0}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {positionsCount === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              {loading ? 'Loading positions…' : 'No open positions.'}
            </div>
          ) : (
            <div className="space-y-1">
              {topPositions.map((p) => {
                const value = p.qty * p.last_price;
                const pnlPct = p.avg_price ? ((p.last_price - p.avg_price) / p.avg_price) * 100 : 0;
                const isLong = p.qty > 0;
                return (
                  <div
                    key={p.symbol}
                    className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/20"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 ${
                          isLong ? 'text-emerald-300 border-emerald-500/40' : 'text-red-300 border-red-500/40'
                        }`}
                      >
                        {isLong ? 'L' : 'S'}
                      </Badge>
                      <span className="text-xs text-foreground font-medium">{p.symbol}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {Math.abs(p.qty)} @ {p.avg_price.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs tabular-nums">
                      <span className="text-muted-foreground">{fmtUsd(value)}</span>
                      <span
                        className={`font-semibold ${
                          pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {fmtPct(pnlPct)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

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
