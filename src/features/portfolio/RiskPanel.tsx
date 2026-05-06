/**
 * RiskPanel — live-portfolio risk surface: VaR, CVaR, volatility, drawdown,
 * concentration (HHI / effective N), and a holdings correlation matrix.
 *
 * Inputs:
 *   - portfolioStore.history: PortfolioSnapshot[] for portfolio-level VaR.
 *   - portfolioStore.holdings: weights for concentration + per-symbol return
 *     series (reconstructed from snapshot.holdings[symbol].value).
 *
 * Caveats: VaR/CVaR need ≥ ~30 daily snapshots; correlations need overlapping
 * history per symbol. Insufficient-data states render "Need N more days".
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, Activity, Layers } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePortfolioStore } from '@/stores/portfolioStore';
import {
  annualizedVolatility,
  conditionalVaR,
  correlation,
  dailyReturns,
  effectiveHoldings,
  hhi,
  historicalVaR,
  maxDrawdown,
} from './risk-stats';

const MIN_OBS = 30;

const fmtCurrency = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);

const fmtPct = (n: number, digits = 2) =>
  `${(n * 100).toFixed(digits)}%`;

const concentrationLabel = (eff: number) => {
  if (eff >= 8) return { label: 'Diversified', color: 'text-emerald-400' };
  if (eff >= 4) return { label: 'Moderate', color: 'text-amber-400' };
  return { label: 'Concentrated', color: 'text-red-400' };
};

const heatColor = (corr: number): string => {
  // Diverging palette: -1 blue → 0 neutral → +1 red
  const t = (corr + 1) / 2;
  const r = Math.round(60 + t * 180);
  const g = Math.round(80 + (1 - Math.abs(corr)) * 80);
  const b = Math.round(180 - t * 140);
  return `rgba(${r},${g},${b},${0.35 + Math.abs(corr) * 0.35})`;
};

interface RiskPanelProps {
  /** Current values keyed by symbol (live-quote-aware). Used for HHI/weights. */
  liveValuesBySymbol: Record<string, number>;
  /** Display currency for absolute-VaR figures. */
  currency?: string;
}

export function RiskPanel({ liveValuesBySymbol, currency = 'USD' }: RiskPanelProps) {
  const history = usePortfolioStore((s) => s.history);
  const holdings = usePortfolioStore((s) => s.holdings);

  const stats = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    const totals = sorted.map((s) => s.totalValue);
    const rets = dailyReturns(totals);
    const obs = rets.length;
    const var95 = historicalVaR(rets, 0.95);
    const cvar95 = conditionalVaR(rets, 0.95);
    const vol = annualizedVolatility(rets);
    const mdd = maxDrawdown(totals);
    const liveTotal = Object.values(liveValuesBySymbol).reduce((s, v) => s + v, 0);
    return {
      obs,
      var95,
      cvar95,
      vol,
      mdd,
      liveTotal,
      varAbs: var95 * liveTotal,
      cvarAbs: cvar95 * liveTotal,
    };
  }, [history, liveValuesBySymbol]);

  // Concentration on live weights
  const conc = useMemo(() => {
    const symbols = Object.keys(liveValuesBySymbol);
    const weights = symbols.map((s) => liveValuesBySymbol[s]);
    const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
    const fracs = total > 0 ? weights.map((w) => w / total) : weights;
    const ranked = symbols
      .map((s, i) => ({ symbol: s, weight: fracs[i] }))
      .sort((a, b) => b.weight - a.weight);
    return {
      hhi: hhi(weights),
      effective: effectiveHoldings(weights),
      max: ranked[0],
      top3: ranked.slice(0, 3).reduce((s, r) => s + r.weight, 0),
      top5: ranked.slice(0, 5).reduce((s, r) => s + r.weight, 0),
      total,
    };
  }, [liveValuesBySymbol]);

  // Per-symbol return series, then a correlation matrix on overlapping windows
  const corrMatrix = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length < MIN_OBS) return null;
    const symbols = holdings.map((h) => h.symbol);
    if (symbols.length < 2) return null;

    // Build a value-by-symbol-by-date matrix (zero-fill missing observations)
    const valuesBySymbol: Record<string, number[]> = {};
    for (const sym of symbols) valuesBySymbol[sym] = [];
    for (const snap of sorted) {
      const map = new Map(snap.holdings.map((h) => [h.symbol, h.value]));
      for (const sym of symbols) {
        valuesBySymbol[sym].push(map.get(sym) ?? 0);
      }
    }
    const returnsBySymbol: Record<string, number[]> = {};
    for (const sym of symbols) {
      returnsBySymbol[sym] = dailyReturns(valuesBySymbol[sym]);
    }
    const matrix: { row: string; col: string; corr: number }[][] = symbols.map((row) =>
      symbols.map((col) => ({ row, col, corr: correlation(returnsBySymbol[row], returnsBySymbol[col]) }))
    );
    return { symbols, matrix };
  }, [history, holdings]);

  return (
    <TooltipProvider delayDuration={250}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ─── Tail risk ─── */}
        <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              Tail risk (95%)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {stats.obs < MIN_OBS ? (
              <p className="text-muted-foreground italic">
                Need {MIN_OBS - stats.obs} more daily observations to compute VaR (have {stats.obs}). Take portfolio snapshots regularly to populate.
              </p>
            ) : (
              <>
                <Row
                  label="VaR (1d, 95%)"
                  value={fmtPct(stats.var95)}
                  hint={fmtCurrency(stats.varAbs, currency)}
                  tooltip="Historical 1-day Value-at-Risk: the lower 5th-percentile loss observed in your portfolio's daily-return history. There is a 5% chance of a daily loss at least this big."
                />
                <Row
                  label="CVaR (Expected Shortfall)"
                  value={fmtPct(stats.cvar95)}
                  hint={fmtCurrency(stats.cvarAbs, currency)}
                  tooltip="Conditional VaR: the average loss in the worst 5% of historical days. Captures tail severity that VaR alone hides."
                />
                <Row
                  label="Volatility (ann.)"
                  value={fmtPct(stats.vol)}
                  tooltip="Annualized standard deviation of daily returns × √252."
                />
                <Row
                  label="Max drawdown"
                  value={fmtPct(stats.mdd)}
                  tooltip="Largest peak-to-trough decline in portfolio value across history."
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* ─── Concentration ─── */}
        <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4 text-amber-400" />
              Concentration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {(() => {
              const c = conc;
              const lab = concentrationLabel(c.effective);
              return (
                <>
                  <Row
                    label="Effective N"
                    value={c.effective.toFixed(2)}
                    hint={<span className={lab.color}>{lab.label}</span>}
                    tooltip="1 / HHI. Equivalent number of equally-weighted positions you'd need to match your current dispersion. <4 ≈ concentrated, 4–8 moderate, 8+ diversified."
                  />
                  <Row
                    label="HHI (0–1)"
                    value={c.hhi.toFixed(3)}
                    tooltip="Herfindahl–Hirschman index: sum of squared weights. 1 = one position, 0 = infinitely diversified."
                  />
                  <Row
                    label="Largest weight"
                    value={c.max ? `${(c.max.weight * 100).toFixed(1)}% · ${c.max.symbol}` : '-'}
                  />
                  <Row label="Top-3 weight" value={fmtPct(c.top3)} />
                  <Row label="Top-5 weight" value={fmtPct(c.top5)} />
                </>
              );
            })()}
          </CardContent>
        </Card>

        {/* ─── Correlation heatmap ─── */}
        <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-blue-400" />
              Correlation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs">
            {!corrMatrix ? (
              <p className="text-muted-foreground italic">
                Need ≥ {MIN_OBS} snapshots and ≥ 2 holdings to estimate correlations.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr>
                      <th className="text-left pr-1 text-muted-foreground"></th>
                      {corrMatrix.symbols.map((s) => (
                        <th key={s} className="px-1 text-muted-foreground">{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {corrMatrix.matrix.map((row, i) => (
                      <tr key={corrMatrix.symbols[i]}>
                        <td className="text-muted-foreground pr-1">{corrMatrix.symbols[i]}</td>
                        {row.map((cell) => (
                          <td
                            key={`${cell.row}-${cell.col}`}
                            className="text-center text-foreground p-0.5"
                            style={{ backgroundColor: heatColor(cell.corr) }}
                          >
                            {cell.corr.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

function Row({
  label,
  value,
  hint,
  tooltip,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tooltip?: string;
}) {
  const labelEl = tooltip ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-muted-foreground cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-[11px]">{tooltip}</TooltipContent>
    </Tooltip>
  ) : (
    <span className="text-muted-foreground">{label}</span>
  );
  return (
    <div className="flex items-center justify-between">
      {labelEl}
      <div className="flex items-center gap-2">
        <span className="font-mono font-medium text-foreground">{value}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

export default RiskPanel;
