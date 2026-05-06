/**
 * ApprovalQueue — supervisor view of pending agent/strategy orders.
 *
 * For each pending order, shows source, rationale, account, sized notional,
 * and approve/reject buttons. Approved orders are forwarded to the broker
 * via submitSignal; rejected orders are persisted with the reviewer's note.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Bot, Settings2 } from 'lucide-react';
import { useApprovalStore, type PendingOrder } from '@/stores/approvalStore';
import { submitSignal } from './api';

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

interface ApprovalQueueProps {
  /** Identity of the approver attached to decisions for audit. */
  reviewer: string;
}

export function ApprovalQueue({ reviewer }: ApprovalQueueProps) {
  // Subscribe to the raw queue, filter via useMemo to keep snapshot stable.
  const queue = useApprovalStore((s) => s.queue);
  const pending = useMemo(() => queue.filter((o) => o.status === 'pending'), [queue]);
  const approve = useApprovalStore((s) => s.approve);
  const reject = useApprovalStore((s) => s.reject);
  const setBrokerOrderId = useApprovalStore((s) => s.setBrokerOrderId);
  const rules = useApprovalStore((s) => s.rules);
  const setRules = useApprovalStore((s) => s.setRules);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [autoNotional, setAutoNotional] = useState(rules.autoApproveBelowNotional?.toString() ?? '0');
  const [showRules, setShowRules] = useState(false);

  const handleApprove = async (o: PendingOrder, note?: string) => {
    setBusyId(o.id);
    try {
      // Forward approved order to broker via existing signal endpoint.
      const order = await submitSignal({
        symbol: o.symbol,
        side: o.side,
        qty: o.qty,
        type: o.type,
        limit_price: o.limit_price ?? undefined,
        stop_price: o.stop_price ?? undefined,
        tif: o.tif ?? undefined,
      });
      approve(o.id, reviewer, note);
      setBrokerOrderId(o.id, order.id);
      toast.success(`Approved ${o.symbol} ${o.side} ${o.qty}`);
    } catch (e) {
      toast.error(`Broker rejected: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = (o: PendingOrder) => {
    const note = window.prompt('Reason for rejection (optional):') ?? undefined;
    reject(o.id, reviewer, note ?? undefined);
    toast.info(`Rejected ${o.symbol} ${o.side} ${o.qty}`);
  };

  return (
    <Card className="bg-card/60 border-border/50">
      <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          Approval Queue
          <Badge variant="secondary" className="text-[10px] font-normal h-5">
            {pending.length}
          </Badge>
        </CardTitle>
        <button
          onClick={() => setShowRules((s) => !s)}
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Settings2 className="w-3 h-3" />
          Auto-approve rules
        </button>
      </CardHeader>
      <CardContent className="p-3">
        {showRules && (
          <div className="mb-3 rounded-md border border-border/40 bg-muted/20 p-2 text-xs space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Auto-approve below notional:</span>
              <input
                type="number"
                value={autoNotional}
                onChange={(e) => setAutoNotional(e.target.value)}
                onBlur={() => {
                  const n = Number(autoNotional);
                  setRules({ ...rules, autoApproveBelowNotional: Number.isFinite(n) ? n : 0 });
                }}
                className="bg-muted/40 border border-border/60 rounded px-2 py-0.5 w-28 text-right"
              />
              <span className="text-muted-foreground">USD</span>
              <span className="text-[10px] text-muted-foreground">
                (0 = always require review)
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Sources auto-approved: {(rules.autoApproveSources ?? []).join(', ') || 'none'}
            </div>
          </div>
        )}

        {pending.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-6">
            No pending approvals.
          </div>
        ) : (
          <div className="space-y-2">
            {pending
              .sort((a, b) => b.estimatedNotional - a.estimatedNotional)
              .map((o) => {
                const isBig = o.estimatedNotional > 50_000;
                return (
                  <div
                    key={o.id}
                    className={`rounded-md border p-2.5 text-xs ${
                      isBig ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/40 bg-card/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Bot className="w-3 h-3" />
                            {o.proposedBy}
                          </Badge>
                          <span className="font-mono text-foreground">
                            {o.side.toUpperCase()} {o.qty} {o.symbol}
                          </span>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {o.type.replace('_', ' ')}
                          </Badge>
                          {(o.limit_price || o.stop_price) && (
                            <span className="text-[10px] text-muted-foreground">
                              {o.limit_price && `lim ${o.limit_price}`}
                              {o.limit_price && o.stop_price && ' / '}
                              {o.stop_price && `stop ${o.stop_price}`}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            ≈ {fmtCurrency(o.estimatedNotional)}
                          </span>
                          {isBig && (
                            <Badge variant="outline" className="text-[10px] text-amber-400 gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              large
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground italic">{o.rationale}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Account: {o.accountId} · {fmtTime(o.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={() => handleApprove(o)}
                          disabled={busyId === o.id}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition disabled:opacity-40"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(o)}
                          disabled={busyId === o.id}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-red-500/15 text-red-400 hover:bg-red-500/25 transition disabled:opacity-40"
                        >
                          <XCircle className="w-3 h-3" />
                          Reject
                        </button>
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

export default ApprovalQueue;
