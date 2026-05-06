/**
 * GoalPlanner — retirement / FIRE / education-fund / "house deposit" planner.
 *
 * Three inputs: target ($), horizon (years), expected real return (%).
 * Outputs:
 *   • Required monthly savings under a deterministic geometric growth path.
 *   • Probability-of-success Monte Carlo with N=2000 paths around the
 *     expected return ± supplied volatility (default 12%, equity-like).
 *   • A final-balance percentile fan (5/25/50/75/95).
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const fmtCurrency = (n: number) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
    : '–';

const fmtPct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;

interface PlanInputs {
  target: number;
  startingValue: number;
  years: number;
  /** Expected real return (annual decimal). */
  expectedReturn: number;
  /** Annual volatility for Monte Carlo (decimal). */
  vol: number;
}

function deterministicMonthlyContribution(p: PlanInputs): number {
  // FV = start * (1+r)^n + PMT * [((1+r)^n - 1) / r], all monthly
  const r = Math.pow(1 + p.expectedReturn, 1 / 12) - 1;
  const n = Math.max(1, Math.round(p.years * 12));
  const startGrown = p.startingValue * Math.pow(1 + r, n);
  const need = p.target - startGrown;
  if (need <= 0) return 0;
  if (r === 0) return need / n;
  return (need * r) / (Math.pow(1 + r, n) - 1);
}

function monteCarloFinalBalance(
  p: PlanInputs,
  monthlyContribution: number,
  paths = 2000
): { successProb: number; quantiles: { p: number; v: number }[] } {
  const monthlyReturn = Math.pow(1 + p.expectedReturn, 1 / 12) - 1;
  const monthlyVol = p.vol / Math.sqrt(12);
  const months = Math.max(1, Math.round(p.years * 12));
  const finals: number[] = new Array(paths);

  for (let i = 0; i < paths; i++) {
    let bal = p.startingValue;
    for (let m = 0; m < months; m++) {
      // Box-Muller draw
      const u1 = Math.random() || 1e-12;
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const r = monthlyReturn + monthlyVol * z;
      bal = bal * (1 + r) + monthlyContribution;
    }
    finals[i] = bal;
  }
  finals.sort((a, b) => a - b);
  const successCount = finals.filter((v) => v >= p.target).length;
  const q = (frac: number) => finals[Math.min(finals.length - 1, Math.max(0, Math.floor(frac * finals.length)))];
  return {
    successProb: successCount / paths,
    quantiles: [0.05, 0.25, 0.5, 0.75, 0.95].map((qi) => ({ p: qi, v: q(qi) })),
  };
}

export function GoalPlanner() {
  const [target, setTarget] = useState('1500000');
  const [starting, setStarting] = useState('100000');
  const [years, setYears] = useState('25');
  const [expReturn, setExpReturn] = useState('5');
  const [vol, setVol] = useState('12');

  const inputs: PlanInputs = useMemo(
    () => ({
      target: parseFloat(target) || 0,
      startingValue: parseFloat(starting) || 0,
      years: parseFloat(years) || 0,
      expectedReturn: (parseFloat(expReturn) || 0) / 100,
      vol: (parseFloat(vol) || 0) / 100,
    }),
    [target, starting, years, expReturn, vol]
  );

  const monthly = useMemo(() => deterministicMonthlyContribution(inputs), [inputs]);

  const mc = useMemo(() => {
    if (inputs.target <= 0 || inputs.years <= 0) return null;
    return monteCarloFinalBalance(inputs, monthly);
  }, [inputs, monthly]);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
          <Target className="w-4 h-4 text-emerald-400" />
          Goal planner
          <span className="text-[10px] font-normal text-muted-foreground">deterministic + Monte Carlo</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="grid grid-cols-5 gap-2">
          <Field label="Target $" value={target} onChange={setTarget} />
          <Field label="Starting $" value={starting} onChange={setStarting} />
          <Field label="Years" value={years} onChange={setYears} />
          <Field label="Real return %" value={expReturn} onChange={setExpReturn} />
          <Field label="Vol %" value={vol} onChange={setVol} />
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border/40 p-3">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">Required monthly savings</div>
            <div className="font-mono text-lg text-foreground">{fmtCurrency(monthly)}</div>
            <div className="text-[10px] text-muted-foreground">
              ≈ {fmtCurrency(monthly * 12)}/year for {years} years
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">Probability of success (MC, 2000 paths)</div>
            <div className={`font-mono text-lg ${(mc?.successProb ?? 0) >= 0.8 ? 'text-emerald-400' : (mc?.successProb ?? 0) >= 0.6 ? 'text-amber-400' : 'text-red-400'}`}>
              {mc ? fmtPct(mc.successProb) : '–'}
            </div>
            <div className="text-[10px] text-muted-foreground">
              At supplied vol {fmtPct(inputs.vol, 0)}.
            </div>
          </div>
        </div>
        {mc && (
          <div className="rounded-md border border-border/40 p-2">
            <div className="text-[10px] text-muted-foreground uppercase mb-1">
              Final-balance percentiles
            </div>
            <div className="grid grid-cols-5 gap-2 font-mono text-[11px]">
              {mc.quantiles.map((q) => (
                <div key={q.p} className="text-center">
                  <div className="text-[10px] text-muted-foreground">P{(q.p * 100).toFixed(0)}</div>
                  <div className={q.v >= inputs.target ? 'text-emerald-400' : 'text-red-400'}>
                    {fmtCurrency(q.v)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px]">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 bg-muted/40 border-border/60 text-xs font-mono"
        step="any"
      />
    </div>
  );
}

export default GoalPlanner;
