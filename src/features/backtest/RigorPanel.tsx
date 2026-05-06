/**
 * RigorPanel — backtest sanity checks: walk-forward windows, look-ahead
 * detection, survivorship-bias warning, capacity analysis.
 *
 * Self-contained; takes a small config object from the parent and renders
 * recommendations. Intended to live above or beside the equity-curve panel
 * on the Backtest page.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  buildWalkForwardWindows,
  detectLookAhead,
  checkSurvivorshipBias,
  capacity,
  type FeatureDependency,
} from './walk-forward';

interface Props {
  /** Total bars in the backtest timeline. */
  totalBars?: number;
  /** Universe size (number of symbols). */
  universeSize?: number;
  /** Whether the universe includes delisted/merged tickers. */
  hasDelistedTickers?: boolean;
  /** Years covered by the backtest. */
  windowYears?: number;
  /** Feature dependency graph for look-ahead detection. */
  features?: FeatureDependency[];
  /** Average daily volume of the traded universe (USD). */
  adv?: number;
}

export function RigorPanel({
  totalBars = 1000,
  universeSize = 50,
  hasDelistedTickers = false,
  windowYears = 5,
  features = [],
  adv = 1_000_000,
}: Props) {
  const [trainBars, setTrainBars] = useState('250');
  const [testBars, setTestBars] = useState('63'); // ~1 quarter
  const [mode, setMode] = useState<'expanding' | 'rolling'>('expanding');
  const [expectedAlphaBps, setExpectedAlphaBps] = useState('30');
  const [turnover, setTurnover] = useState('0.5');

  const wf = useMemo(
    () =>
      buildWalkForwardWindows({
        total: totalBars,
        trainBars: parseInt(trainBars) || 250,
        testBars: parseInt(testBars) || 63,
        mode,
      }),
    [totalBars, trainBars, testBars, mode]
  );

  const la = useMemo(() => detectLookAhead(features), [features]);
  const surv = useMemo(
    () => checkSurvivorshipBias({ universeSize, hasDelistedTickers, windowYears }),
    [universeSize, hasDelistedTickers, windowYears]
  );
  const cap = useMemo(
    () =>
      capacity(
        { notional: 1_000_000, adv, turnover: parseFloat(turnover) || 0.5 },
        parseFloat(expectedAlphaBps) || 30
      ),
    [adv, turnover, expectedAlphaBps]
  );

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          Rigor checks
          <Badge variant="outline" className="text-[10px]">
            walk-forward · look-ahead · survivorship · capacity
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {/* Walk-forward */}
        <section className="rounded-md border border-border/40 p-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-foreground font-medium">Walk-forward windows</span>
            <Badge variant="outline" className="text-[10px]">{wf.length} folds</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Train bars</Label>
              <Input
                type="number"
                value={trainBars}
                onChange={(e) => setTrainBars(e.target.value)}
                className="h-7 bg-muted/40 border-border/60 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Test bars</Label>
              <Input
                type="number"
                value={testBars}
                onChange={(e) => setTestBars(e.target.value)}
                className="h-7 bg-muted/40 border-border/60 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Mode</Label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'expanding' | 'rolling')}
                className="h-7 w-full rounded bg-muted/40 border border-border/60 text-xs px-2"
              >
                <option value="expanding">Expanding</option>
                <option value="rolling">Rolling</option>
              </select>
            </div>
          </div>
          {wf.length === 0 ? (
            <p className="text-[11px] text-amber-400 italic">
              Total {totalBars} bars too short for {trainBars}+{testBars} window.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {wf.length} OOS evaluation windows. First test: bar {wf[0].testStart}–{wf[0].testEnd};
              last test: bar {wf[wf.length - 1].testStart}–{wf[wf.length - 1].testEnd}.
            </p>
          )}
        </section>

        {/* Look-ahead */}
        <section className="rounded-md border border-border/40 p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-foreground font-medium">Look-ahead detection</span>
            {la.ok ? (
              <Badge variant="outline" className="text-[10px] text-emerald-400 gap-1">
                <CheckCircle2 className="w-3 h-3" /> clean
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-red-400 gap-1">
                <AlertTriangle className="w-3 h-3" /> {la.violations.length} violation{la.violations.length === 1 ? '' : 's'}
              </Badge>
            )}
          </div>
          {features.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">
              No feature dependencies declared. Pass a feature graph to enable static look-ahead checks.
            </p>
          ) : (
            <>
              {la.violations.map((v) => (
                <div key={v.feature + v.reason} className="text-[11px] text-red-400">
                  · <span className="font-medium">{v.feature}</span>: {v.reason}
                </div>
              ))}
              {la.warnings.map((w) => (
                <div key={w} className="text-[11px] text-amber-400">· {w}</div>
              ))}
            </>
          )}
        </section>

        {/* Survivorship */}
        <section className="rounded-md border border-border/40 p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-foreground font-medium">Survivorship bias</span>
            {surv.ok ? (
              <Badge variant="outline" className="text-[10px] text-emerald-400 gap-1">
                <CheckCircle2 className="w-3 h-3" /> ok
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-red-400 gap-1">
                <AlertTriangle className="w-3 h-3" /> review
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{surv.message}</p>
          <p className="text-[11px] text-amber-400">{surv.recommendation}</p>
        </section>

        {/* Capacity */}
        <section className="rounded-md border border-border/40 p-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-foreground font-medium">Capacity</span>
            <Badge variant="outline" className="text-[10px]">
              ADV ${adv.toLocaleString()}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Expected alpha (bps/period)</Label>
              <Input
                type="number"
                value={expectedAlphaBps}
                onChange={(e) => setExpectedAlphaBps(e.target.value)}
                className="h-7 bg-muted/40 border-border/60 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Turnover (fraction)</Label>
              <Input
                type="number"
                value={turnover}
                onChange={(e) => setTurnover(e.target.value)}
                className="h-7 bg-muted/40 border-border/60 text-xs"
              />
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Break-even AUM: {Number.isFinite(cap.breakEvenAUM) ? `$${cap.breakEvenAUM.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '–'}
          </div>
          <div className="grid grid-cols-4 gap-1 text-[10px]">
            {cap.knees.map((k) => (
              <div key={k.ratio} className="rounded bg-muted/20 p-1 text-center">
                <div className="text-muted-foreground">{(k.ratio * 100).toFixed(0)}% ADV</div>
                <div className="font-mono text-foreground">{k.cost_bps.toFixed(1)}bps</div>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

export default RigorPanel;
