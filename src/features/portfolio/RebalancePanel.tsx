/**
 * RebalancePanel — pick a model, see drift, proposes trades.
 *
 * For each leg shows current weight, target weight, drift, suggested $ delta.
 * Legs over the tolerance band are highlighted; "Trade" buttons hand off to
 * the existing approval queue (so the trade flows through review).
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Scale, Send } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useModelPortfolioStore, buildRebalance } from '@/stores/modelPortfolioStore';
import { useApprovalStore } from '@/stores/approvalStore';
import { useAuditStore } from '@/stores/auditStore';
import { toast } from 'sonner';

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

interface Props {
  /** Current account-scoped positions valued in dollars. */
  positions: { symbol: string; value: number }[];
  accountId: string;
}

export function RebalancePanel({ positions, accountId }: Props) {
  const models = useModelPortfolioStore((s) => s.models);
  const attached = useModelPortfolioStore((s) => s.attachments[accountId]);
  const attach = useModelPortfolioStore((s) => s.attach);
  const enqueue = useApprovalStore((s) => s.enqueue);
  const log = useAuditStore((s) => s.log);

  const [modelId, setModelId] = useState<string>(attached ?? models[0]?.id ?? '');
  const model = models.find((m) => m.id === modelId);

  const proposal = useMemo(() => {
    if (!model) return null;
    return buildRebalance(positions, model);
  }, [positions, model]);

  const handleAttach = (id: string) => {
    setModelId(id);
    attach(accountId, id);
  };

  const sendAll = () => {
    if (!proposal || !model) return;
    let sent = 0;
    for (const leg of proposal.legs.filter((l) => l.needsAction)) {
      const side = leg.delta > 0 ? 'buy' : 'sell';
      const qty = Math.abs(leg.delta); // notional; backend converts to shares
      enqueue({
        source: 'rebalance',
        proposedBy: `model:${model.name}`,
        rationale: `Rebalance to ${model.name}: drift ${(leg.driftBp).toFixed(0)}bp from target ${fmtPct(leg.targetWeight)}.`,
        accountId,
        symbol: leg.symbol,
        side,
        qty,
        type: 'market',
        estimatedNotional: Math.abs(leg.delta),
      });
      sent++;
    }
    log({
      category: 'order',
      summary: `Queued ${sent} rebalance leg${sent === 1 ? '' : 's'} (${model.name})`,
      actor: `rebalance:${model.name}`,
      accountId,
      data: { modelId: model.id, totalTurnover: proposal.totalTurnover },
    });
    toast.success(`Queued ${sent} legs for approval`);
  };

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
          <Scale className="w-4 h-4 text-blue-400" />
          Rebalance
          {proposal && (
            <Badge variant="outline" className="text-[10px]">
              {proposal.legs.filter((l) => l.needsAction).length} actionable
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={modelId} onValueChange={handleAttach}>
            <SelectTrigger className="h-7 w-[200px] bg-muted/40 border-border/60 text-[11px]">
              <SelectValue placeholder="Pick a model" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e1e2e] border-border/60">
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={sendAll}
            disabled={!proposal || proposal.legs.filter((l) => l.needsAction).length === 0}
            className="h-7 px-2 rounded-md bg-primary/20 hover:bg-primary/30 text-primary text-[11px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Send className="w-3 h-3" />
            Queue all
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {!proposal ? (
          <p className="text-xs text-muted-foreground italic">Select a model.</p>
        ) : (
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="text-muted-foreground text-[10px] uppercase tracking-wider border-b border-border/40">
                <th className="text-left py-1">Sym</th>
                <th className="text-right py-1">Current</th>
                <th className="text-right py-1">Target</th>
                <th className="text-right py-1">Drift</th>
                <th className="text-right py-1">Δ value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {proposal.legs.map((leg) => {
                const isBuy = leg.delta > 0;
                return (
                  <tr key={leg.symbol} className={`border-b border-border/20 ${leg.needsAction ? '' : 'opacity-50'}`}>
                    <td className="py-1 text-foreground">{leg.symbol}</td>
                    <td className="py-1 text-right">{fmtPct(leg.currentWeight)}</td>
                    <td className="py-1 text-right">{fmtPct(leg.targetWeight)}</td>
                    <td className={`py-1 text-right ${leg.needsAction ? 'text-amber-400' : 'text-muted-foreground'}`}>
                      {leg.driftBp >= 0 ? '+' : ''}
                      {leg.driftBp.toFixed(0)}bp
                    </td>
                    <td className={`py-1 text-right ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isBuy ? '+' : ''}
                      {fmtCurrency(leg.delta)}
                    </td>
                    <td className="py-1 text-right">
                      {leg.needsAction ? (
                        <button
                          onClick={() => {
                            enqueue({
                              source: 'rebalance',
                              proposedBy: `model:${model!.name}`,
                              rationale: `Single-leg rebalance: drift ${leg.driftBp.toFixed(0)}bp from target.`,
                              accountId,
                              symbol: leg.symbol,
                              side: isBuy ? 'buy' : 'sell',
                              qty: Math.abs(leg.delta),
                              type: 'market',
                              estimatedNotional: Math.abs(leg.delta),
                            });
                            toast.success(`Queued ${leg.symbol}`);
                          }}
                          className="text-[10px] text-primary hover:text-primary/80"
                        >
                          Trade →
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="text-[10px] text-muted-foreground">
                <td colSpan={6} className="pt-1">
                  Total drift: {proposal.totalDriftBp.toFixed(0)}bp · Turnover required:{' '}
                  {fmtCurrency(proposal.totalTurnover)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export default RebalancePanel;
