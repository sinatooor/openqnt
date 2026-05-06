/**
 * OptionsLab — interactive Black-Scholes pricer + Greeks. Plug in spot,
 * strike, vol, rate, time-to-expiry, type → see price and full Greeks.
 *
 * Includes an IV solver: enter the market price and recover σ.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { bsGreeks, impliedVol } from './options-greeks';
import { ExplainTip } from './ExplainTip';

const fmtCurrency = (n: number) => `$${n.toFixed(4)}`;
const fmtNum = (n: number, d = 4) => (Number.isFinite(n) ? n.toFixed(d) : '–');
const fmtPct = (n: number, d = 2) => `${(n * 100).toFixed(d)}%`;

export function OptionsLab() {
  const [type, setType] = useState<'call' | 'put'>('call');
  const [spot, setSpot] = useState('100');
  const [strike, setStrike] = useState('100');
  const [vol, setVol] = useState('25');
  const [rate, setRate] = useState('5');
  const [div, setDiv] = useState('0');
  const [days, setDays] = useState('30');
  const [marketPrice, setMarketPrice] = useState('');

  const result = useMemo(() => {
    const T = (parseFloat(days) || 0) / 365;
    const S = parseFloat(spot) || 0;
    const K = parseFloat(strike) || 0;
    const sigma = (parseFloat(vol) || 0) / 100;
    const r = (parseFloat(rate) || 0) / 100;
    const q = (parseFloat(div) || 0) / 100;
    if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) return null;
    const greeks = bsGreeks({ S, K, r, q, sigma, T, type });

    let iv: number | null = null;
    const mp = parseFloat(marketPrice);
    if (Number.isFinite(mp) && mp > 0) {
      const solved = impliedVol({ S, K, r, q, T, type }, mp);
      if (Number.isFinite(solved)) iv = solved;
    }

    return { ...greeks, iv };
  }, [type, spot, strike, vol, rate, div, days, marketPrice]);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
          <Sparkles className="w-4 h-4 text-purple-400" />
          Options lab
          <span className="text-[10px] font-normal text-muted-foreground">Black-Scholes · Greeks · IV solver</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="grid grid-cols-7 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'call' | 'put')}>
              <SelectTrigger className="h-8 bg-muted/40 border-border/60 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e2e] border-border/60">
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="put">Put</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Spot" value={spot} onChange={setSpot} />
          <Field label="Strike" value={strike} onChange={setStrike} />
          <Field label="Vol %" value={vol} onChange={setVol} />
          <Field label="Rate %" value={rate} onChange={setRate} />
          <Field label="Div %" value={div} onChange={setDiv} />
          <Field label="Days" value={days} onChange={setDays} />
        </div>
        {result && (
          <>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
              <Metric label="Theoretical price" value={fmtCurrency(result.price)} />
              <Metric term="delta" label="Delta" value={fmtNum(result.delta)} />
              <Metric term="gamma" label="Gamma" value={fmtNum(result.gamma)} />
              <Metric term="vega" label="Vega (per 1.0 vol)" value={fmtNum(result.vega)} />
              <Metric term="theta" label="Theta / year" value={fmtNum(result.theta)} />
              <Metric label="Rho" value={fmtNum(result.rho)} />
            </div>
            <div className="rounded-md border border-border/40 p-2 grid grid-cols-2 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Recover IV from market price</Label>
                <Input
                  type="number"
                  value={marketPrice}
                  onChange={(e) => setMarketPrice(e.target.value)}
                  placeholder="market price"
                  className="h-8 bg-muted/40 border-border/60 text-xs font-mono"
                  step="any"
                />
              </div>
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground">Implied vol: </span>
                <span className="font-mono font-medium text-foreground">
                  {result.iv != null ? fmtPct(result.iv) : marketPrice ? '(no solution)' : '–'}
                </span>
              </div>
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

export default OptionsLab;
