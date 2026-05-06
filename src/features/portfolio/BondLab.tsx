/**
 * BondLab — interactive bond analytics. Plug in face/coupon/maturity/price
 * → see YTM, duration, DV01, convexity, and a yield-shock price impact.
 *
 * Uses the pure math in fixed-income.ts. No backend dependencies.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Banknote } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { bondAnalytics, priceImpact, type BondSpec } from './fixed-income';
import { ExplainTip } from './ExplainTip';

const fmtCurrency = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const fmtPct = (n: number, d = 4) => `${(n * 100).toFixed(d)}%`;
const fmtNum = (n: number, d = 4) => (Number.isFinite(n) ? n.toFixed(d) : '–');

export function BondLab() {
  const [face, setFace] = useState('1000');
  const [couponPct, setCouponPct] = useState('5');
  const [freq, setFreq] = useState('2');
  const [ttm, setTtm] = useState('10');
  const [price, setPrice] = useState('1000');

  const result = useMemo(() => {
    const bond: BondSpec = {
      face: parseFloat(face) || 0,
      couponRate: (parseFloat(couponPct) || 0) / 100,
      freq: parseFloat(freq) || 2,
      ttm: parseFloat(ttm) || 0,
    };
    const p = parseFloat(price) || 0;
    if (bond.face <= 0 || bond.ttm <= 0 || p <= 0) return null;
    const a = bondAnalytics(bond, p);
    const shocks = [-0.02, -0.01, -0.005, 0.005, 0.01, 0.02];
    const sensitivity = shocks.map((dy) => ({
      dy,
      pct: priceImpact(bond, a.ytm, dy),
      newPrice: p * (1 + priceImpact(bond, a.ytm, dy)),
    }));
    return { ...a, bond, price: p, sensitivity };
  }, [face, couponPct, freq, ttm, price]);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
          <Banknote className="w-4 h-4 text-cyan-400" />
          Bond lab
          <span className="text-[10px] font-normal text-muted-foreground">YTM · duration · DV01 · convexity</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="grid grid-cols-5 gap-2">
          <Field label="Face" value={face} onChange={setFace} />
          <Field label="Coupon %" value={couponPct} onChange={setCouponPct} />
          <div className="space-y-1">
            <Label className="text-[10px]">Freq</Label>
            <Select value={freq} onValueChange={setFreq}>
              <SelectTrigger className="h-8 bg-muted/40 border-border/60 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e2e] border-border/60">
                <SelectItem value="1">Annual</SelectItem>
                <SelectItem value="2">Semi-annual</SelectItem>
                <SelectItem value="4">Quarterly</SelectItem>
                <SelectItem value="12">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="TTM (yrs)" value={ttm} onChange={setTtm} />
          <Field label="Market price" value={price} onChange={setPrice} />
        </div>
        {result && (
          <>
            <div className="grid grid-cols-4 gap-x-4 gap-y-1">
              <Metric term="ytm" label="YTM" value={fmtPct(result.ytm)} />
              <Metric term="modified_duration" label="Mod Duration" value={fmtNum(result.modifiedDuration)} />
              <Metric label="Mac Duration" value={fmtNum(result.macaulayDuration)} />
              <Metric term="dv01" label="DV01" value={fmtCurrency(result.dv01)} />
              <Metric term="convexity" label="Convexity" value={fmtNum(result.convexity)} />
              <Metric label="Clean price" value={fmtCurrency(result.cleanPrice)} />
            </div>
            <div className="rounded-md border border-border/40 p-2">
              <div className="text-[10px] text-muted-foreground uppercase mb-1">
                Price impact under yield shocks (mod-duration + convexity)
              </div>
              <table className="w-full text-[11px] font-mono">
                <thead className="text-muted-foreground text-[10px]">
                  <tr>
                    <th className="text-left py-0.5">Δ yield</th>
                    <th className="text-right py-0.5">% impact</th>
                    <th className="text-right py-0.5">New price</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sensitivity.map((s) => (
                    <tr key={s.dy} className="border-t border-border/20">
                      <td className="py-0.5">{s.dy >= 0 ? '+' : ''}{(s.dy * 10000).toFixed(0)}bp</td>
                      <td className={`text-right py-0.5 ${s.pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {s.pct >= 0 ? '+' : ''}{(s.pct * 100).toFixed(2)}%
                      </td>
                      <td className="py-0.5 text-right">{fmtCurrency(s.newPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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

function Metric({ term, label, value }: { term?: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
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

export default BondLab;
