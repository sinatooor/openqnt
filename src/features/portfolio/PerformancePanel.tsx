/**
 * PerformancePanel — TWR / IRR / Sharpe / Sortino / Calmar / max DD computed
 * over the live history snapshots, with optional benchmark overlay.
 *
 * GIPS-style separation of TWR (cash-flow neutral) and MWR/IRR (investor
 * experience). Benchmark is a synthetic series for now — wire to a real
 * SPY/ACWI feed once /api/quotes/history exists.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { dailyReturns, sharpe, stdDev, maxDrawdown, mean, beta as betaFn } from './risk-stats';
import { irr, twr, type CashFlow, type TwrSegment } from './performance';
import { ExplainTip } from './ExplainTip';

const TRADING_DAYS = 252;
const fmtPct = (n: number, d = 2) => `${(n * 100).toFixed(d)}%`;
const fmtNum = (n: number, d = 2) =>
  Number.isFinite(n) ? n.toFixed(d) : '–';

interface Props {
  /** Optional benchmark daily-return series, aligned to portfolio history. */
  benchmarkReturns?: number[];
  /** Risk-free rate (annual decimal) — default 4%. */
  riskFreeAnnual?: number;
}

export function PerformancePanel({ benchmarkReturns, riskFreeAnnual = 0.04 }: Props) {
  const history = usePortfolioStore((s) => s.history);
  const realizedSales = usePortfolioStore((s) => s.realizedSales);

  const stats = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    const totals = sorted.map((s) => s.totalValue);
    const rets = dailyReturns(totals);
    const obs = rets.length;

    if (obs < 2) return null;

    const rfDaily = riskFreeAnnual / TRADING_DAYS;
    const meanRet = mean(rets);
    const sd = stdDev(rets);
    const annReturn = Math.pow(1 + meanRet, TRADING_DAYS) - 1;
    const annVol = sd * Math.sqrt(TRADING_DAYS);
    const downside = stdDev(rets.filter((r) => r < 0));
    const annDownside = downside * Math.sqrt(TRADING_DAYS);
    const sharpeR = sharpe(rets, rfDaily);
    const sortino = annDownside > 0 ? (annReturn - riskFreeAnnual) / annDownside : 0;
    const mdd = maxDrawdown(totals);
    const calmar = mdd > 0 ? annReturn / mdd : 0;

    // TWR — treat each snapshot interval as a no-flow segment
    const segments: TwrSegment[] = [];
    for (let i = 1; i < sorted.length; i++) {
      segments.push({
        startValue: sorted[i - 1].totalValue,
        endValue: sorted[i].totalValue,
        contribution: 0,
      });
    }
    const twrTotal = twr(segments);

    // IRR — derive cash flows from realized sales (positive = withdrawal-like)
    // Initial outflow = first snapshot value; final inflow = last snapshot value;
    // realized sale proceeds in between are partial withdrawals.
    const t0 = sorted[0]?.timestamp ?? 0;
    const tN = sorted[sorted.length - 1]?.timestamp ?? 0;
    const flows: CashFlow[] = [];
    if (sorted.length >= 2) {
      flows.push({ date: t0, amount: -sorted[0].totalValue });
      for (const s of realizedSales) {
        if (s.closedAt >= t0 && s.closedAt <= tN) {
          flows.push({ date: s.closedAt, amount: s.proceeds });
        }
      }
      flows.push({ date: tN, amount: sorted[sorted.length - 1].totalValue });
    }
    const irrTotal = flows.length >= 2 ? irr(flows) : NaN;

    // Beta vs supplied benchmark
    let portfolioBeta: number | null = null;
    let trackingError: number | null = null;
    if (benchmarkReturns && benchmarkReturns.length >= obs) {
      portfolioBeta = betaFn(rets, benchmarkReturns.slice(-obs));
      const diff = rets.map((r, i) => r - benchmarkReturns.slice(-obs)[i]);
      trackingError = stdDev(diff) * Math.sqrt(TRADING_DAYS);
    }

    return {
      obs,
      annReturn,
      annVol,
      sharpe: sharpeR,
      sortino,
      mdd,
      calmar,
      twr: twrTotal,
      irr: irrTotal,
      portfolioBeta,
      trackingError,
    };
  }, [history, realizedSales, benchmarkReturns, riskFreeAnnual]);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Performance
          <span className="text-[10px] font-normal text-muted-foreground">
            GIPS-style · risk-free {fmtPct(riskFreeAnnual, 1)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs">
        {!stats ? (
          <p className="text-muted-foreground italic">
            Need ≥ 2 portfolio snapshots to compute performance. Take snapshots regularly to populate.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <Row term="twr" label="TWR (cumulative)" value={fmtPct(stats.twr)} />
            <Row term="mwr" label="MWR / IRR" value={Number.isFinite(stats.irr) ? fmtPct(stats.irr) : '–'} />
            <Row label="Annualized return" value={fmtPct(stats.annReturn)} />
            <Row label="Annualized volatility" value={fmtPct(stats.annVol)} />
            <Row term="sharpe" label="Sharpe" value={fmtNum(stats.sharpe)} />
            <Row term="sortino" label="Sortino" value={fmtNum(stats.sortino)} />
            <Row term="calmar" label="Calmar" value={fmtNum(stats.calmar)} />
            <Row term="max_drawdown" label="Max drawdown" value={fmtPct(stats.mdd)} />
            {stats.portfolioBeta != null && (
              <>
                <Row term="beta" label="Beta vs benchmark" value={fmtNum(stats.portfolioBeta)} />
                <Row label="Tracking error" value={fmtPct(stats.trackingError ?? 0)} />
              </>
            )}
            <Row label="Observations" value={String(stats.obs)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  term,
  label,
  value,
}: {
  term?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      {term ? (
        <ExplainTip term={term}>
          <span className="text-muted-foreground">{label}</span>
        </ExplainTip>
      ) : (
        <span className="text-muted-foreground">{label}</span>
      )}
      <span className="font-mono font-medium text-foreground">{value}</span>
    </div>
  );
}

export default PerformancePanel;
