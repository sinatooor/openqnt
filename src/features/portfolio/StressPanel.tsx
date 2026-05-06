/**
 * StressPanel — pre-canned macro shock scenarios applied to the live book.
 *
 * Each scenario assigns a shock factor by asset class. We then estimate
 * portfolio P&L by summing per-holding (weight × shock). This is a first-order
 * approximation; production-grade stress tests use factor exposures from a
 * Barra-style risk model, but this delivers ~80% of the directional insight
 * with zero external dependencies.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';
import type { AssetType } from '@/stores/portfolioStore';

interface Scenario {
  id: string;
  name: string;
  description: string;
  /** Shock factor by asset class — fractional return. -0.40 = -40%. */
  shocks: Partial<Record<AssetType, number>>;
}

/** Calibrated to historical episodes; rough but defensible. */
const SCENARIOS: Scenario[] = [
  {
    id: '2008',
    name: '2008 GFC (Sep–Mar)',
    description: 'Equity -40%, credit blowout, gold rally, USD spike.',
    shocks: { stock: -0.4, etf: -0.38, bond: -0.04, gold: 0.06, crypto: 0, commodity: -0.55, forex: 0, cash: 0 },
  },
  {
    id: 'covid',
    name: 'COVID Mar 2020',
    description: 'Equity -34% in 23 days, oil to negative, vol spike.',
    shocks: { stock: -0.34, etf: -0.32, bond: 0.04, gold: 0.05, crypto: -0.5, commodity: -0.45, forex: 0, cash: 0 },
  },
  {
    id: 'rates_up',
    name: 'Rates +200bp',
    description: 'Long-duration bonds -16%, growth stocks -25%, banks +5%.',
    shocks: { stock: -0.18, etf: -0.18, bond: -0.16, gold: -0.05, crypto: -0.2, commodity: 0, forex: 0, cash: 0 },
  },
  {
    id: 'usd_up',
    name: 'USD +10%',
    description: 'Strong dollar; commodity & non-USD equity hit hardest.',
    shocks: { stock: -0.04, etf: -0.04, bond: -0.02, gold: -0.08, crypto: -0.1, commodity: -0.12, forex: -0.1, cash: 0 },
  },
  {
    id: 'oil_up',
    name: 'Oil +50%',
    description: 'Inflationary shock — equities -8%, energy +30%.',
    shocks: { stock: -0.08, etf: -0.08, bond: -0.06, gold: 0.05, crypto: -0.05, commodity: 0.3, forex: 0, cash: 0 },
  },
  {
    id: 'crypto_crash',
    name: 'Crypto −60%',
    description: '2022-style winter; muted equity drag.',
    shocks: { stock: -0.05, etf: -0.05, bond: 0, gold: 0.02, crypto: -0.6, commodity: 0, forex: 0, cash: 0 },
  },
];

interface Holding {
  symbol: string;
  assetType: AssetType;
  value: number;
}

interface Props {
  holdings: Holding[];
  currency?: string;
}

export function StressPanel({ holdings, currency = 'USD' }: Props) {
  const totalValue = holdings.reduce((s, h) => s + h.value, 0);

  const results = useMemo(() => {
    return SCENARIOS.map((sc) => {
      let pnl = 0;
      for (const h of holdings) {
        const shock = sc.shocks[h.assetType] ?? 0;
        pnl += h.value * shock;
      }
      const pct = totalValue > 0 ? pnl / totalValue : 0;
      return { ...sc, pnl, pct };
    });
  }, [holdings, totalValue]);

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          Stress tests
          <span className="text-[10px] font-normal text-muted-foreground">first-order, by asset class</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalValue === 0 ? (
          <p className="text-xs text-muted-foreground italic">No live positions to stress.</p>
        ) : (
          <div className="space-y-1.5 text-xs">
            {results.map((r) => {
              const positive = r.pnl >= 0;
              return (
                <div key={r.id} className="rounded-md border border-border/30 bg-card/30 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground font-medium">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground">{r.description}</div>
                    </div>
                    <div className={`text-right font-mono ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                      <div className="text-sm font-medium">
                        {positive ? '+' : ''}
                        {(r.pct * 100).toFixed(2)}%
                      </div>
                      <div className="text-[10px]">
                        {positive ? '+' : ''}
                        {fmtCurrency(r.pnl)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default StressPanel;
