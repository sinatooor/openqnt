/**
 * TCAPanel — recent fills' transaction-cost analysis. Computes implementation
 * shortfall, slippage vs arrival, slippage vs interval VWAP, and fee bps,
 * then aggregates across the period.
 *
 * Inputs come from /api/execution/fills (extended JournalOrder with
 * decision_price, arrival_price, interval_vwap, fees). Falls back to a
 * compact stub message when fewer than 1 fill has those attributes.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { type JournalOrder } from './api';
import { aggregateTCA, computeTCA, type FillReport } from './tca';

const fmtBps = (bps: number) => `${bps >= 0 ? '+' : ''}${bps.toFixed(2)}bps`;
const fmtCurrency = (n: number) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
    : '–';
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

interface ExtendedOrder extends JournalOrder {
  decision_price?: number | null;
  arrival_price?: number | null;
  interval_vwap?: number | null;
  fees?: number | null;
}

interface Props {
  orders: ExtendedOrder[];
}

export function TCAPanel({ orders }: Props) {
  const reportable = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === 'filled' &&
          o.fill_price != null &&
          o.fill_qty > 0 &&
          o.decision_price != null &&
          o.arrival_price != null &&
          o.interval_vwap != null
      ),
    [orders]
  );

  const fills: FillReport[] = useMemo(
    () =>
      reportable.map((o) => ({
        side: o.side,
        qty: o.fill_qty,
        decisionPrice: o.decision_price as number,
        arrivalPrice: o.arrival_price as number,
        fillPrice: o.fill_price as number,
        intervalVwap: o.interval_vwap as number,
        fees: o.fees ?? 0,
      })),
    [reportable]
  );

  const agg = useMemo(() => (fills.length > 0 ? aggregateTCA(fills) : null), [fills]);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
          <Activity className="w-4 h-4 text-blue-400" />
          Transaction-cost analysis
          <span className="text-[10px] font-normal text-muted-foreground">
            {fills.length} reportable fill{fills.length === 1 ? '' : 's'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {!agg ? (
          <p className="text-muted-foreground italic">
            No fills with TCA-required fields (decision/arrival/VWAP). Wire backend to capture these on submit.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-x-4 gap-y-1">
              <Metric label="Total notional" value={fmtCurrency(agg.totalNotional)} />
              <Metric label="IS (cost)" value={fmtCurrency(agg.implementationShortfall)} />
              <Metric label="IS in bps" value={fmtBps(agg.isShortfallBps)} />
              <Metric label="Slip vs arrival" value={fmtBps(agg.slippageVsArrivalBps)} />
              <Metric label="Slip vs VWAP" value={fmtBps(agg.slippageVsVwapBps)} />
              <Metric label="Fees" value={fmtBps(agg.feesBps)} />
            </div>
            <div className="rounded-md border border-border/40 p-2 max-h-64 overflow-auto">
              <table className="w-full text-[10px] font-mono">
                <thead className="text-muted-foreground sticky top-0 bg-card">
                  <tr>
                    <th className="text-left px-1 py-1">When</th>
                    <th className="text-left px-1 py-1">Sym</th>
                    <th className="text-left px-1 py-1">Side</th>
                    <th className="text-right px-1 py-1">Qty</th>
                    <th className="text-right px-1 py-1">Fill</th>
                    <th className="text-right px-1 py-1">Decision</th>
                    <th className="text-right px-1 py-1">Arr</th>
                    <th className="text-right px-1 py-1">VWAP</th>
                    <th className="text-right px-1 py-1">IS bps</th>
                    <th className="text-right px-1 py-1">Slip arr</th>
                    <th className="text-right px-1 py-1">Slip VWAP</th>
                  </tr>
                </thead>
                <tbody>
                  {reportable.map((o, i) => {
                    const f = fills[i];
                    const t = computeTCA(f);
                    return (
                      <tr key={o.id} className="border-t border-border/20">
                        <td className="px-1 py-0.5">{fmtTime(o.filled_at ?? o.submitted_at)}</td>
                        <td className="px-1 py-0.5 text-foreground">{o.symbol}</td>
                        <td className="px-1 py-0.5">{o.side}</td>
                        <td className="px-1 py-0.5 text-right">{o.fill_qty}</td>
                        <td className="px-1 py-0.5 text-right">{(o.fill_price ?? 0).toFixed(2)}</td>
                        <td className="px-1 py-0.5 text-right">{(o.decision_price ?? 0).toFixed(2)}</td>
                        <td className="px-1 py-0.5 text-right">{(o.arrival_price ?? 0).toFixed(2)}</td>
                        <td className="px-1 py-0.5 text-right">{(o.interval_vwap ?? 0).toFixed(2)}</td>
                        <td className={`px-1 py-0.5 text-right ${t.isShortfallBps >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {fmtBps(t.isShortfallBps)}
                        </td>
                        <td className={`px-1 py-0.5 text-right ${t.slippageVsArrivalBps >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {fmtBps(t.slippageVsArrivalBps)}
                        </td>
                        <td className={`px-1 py-0.5 text-right ${t.slippageVsVwapBps >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {fmtBps(t.slippageVsVwapBps)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium text-foreground">{value}</span>
    </div>
  );
}

export default TCAPanel;
