/**
 * BlockTradeDialog — institutional block-trade workflow.
 *
 * Compose a block order across multiple accounts, choose an allocation method
 * (pro-rata by AUM, equal qty, custom %), preview per-account child quantities,
 * then push the parent + child orders into the approval queue as a group.
 *
 * Allocation methods:
 *   • pro_rata_aum: child_qty_i = parent_qty × (AUM_i / sum(AUM))
 *   • equal_qty:    child_qty_i = parent_qty / N (integer fractional split)
 *   • custom:       per-account percentages set by the user (must sum to 100)
 */
import { useMemo, useState } from 'react';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useAccountStore } from '@/stores/accountStore';
import { useApprovalStore } from '@/stores/approvalStore';
import { useAuditStore } from '@/stores/auditStore';
import type { OrderType } from './api';

type AllocationMethod = 'pro_rata_aum' | 'equal_qty' | 'custom';

interface Props {
  /** AUM per account (ID → USD-equivalent). Driver of pro_rata_aum splits. */
  aumByAccount: Record<string, number>;
  onClose: () => void;
}

export function BlockTradeDialog({ aumByAccount, onClose }: Props) {
  const accounts = useAccountStore((s) => s.accounts.filter((a) => !a.archived));
  const enqueue = useApprovalStore((s) => s.enqueue);
  const log = useAuditStore((s) => s.log);

  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [qty, setQty] = useState('');
  const [limit, setLimit] = useState('');
  const [method, setMethod] = useState<AllocationMethod>('pro_rata_aum');
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(accounts.map((a) => [a.id, true]))
  );
  const [customPcts, setCustomPcts] = useState<Record<string, string>>({});

  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selected[a.id]),
    [accounts, selected]
  );

  const allocation = useMemo(() => {
    const parentQty = parseFloat(qty) || 0;
    if (parentQty <= 0 || selectedAccounts.length === 0) return [];
    if (method === 'equal_qty') {
      const each = parentQty / selectedAccounts.length;
      return selectedAccounts.map((a) => ({ accountId: a.id, accountName: a.name, qty: each }));
    }
    if (method === 'pro_rata_aum') {
      const totalAum = selectedAccounts.reduce((s, a) => s + (aumByAccount[a.id] ?? 0), 0);
      if (totalAum <= 0) {
        const each = parentQty / selectedAccounts.length;
        return selectedAccounts.map((a) => ({ accountId: a.id, accountName: a.name, qty: each }));
      }
      return selectedAccounts.map((a) => ({
        accountId: a.id,
        accountName: a.name,
        qty: parentQty * ((aumByAccount[a.id] ?? 0) / totalAum),
      }));
    }
    // custom
    const totalPct = selectedAccounts.reduce(
      (s, a) => s + (parseFloat(customPcts[a.id] ?? '0') || 0),
      0
    );
    return selectedAccounts.map((a) => ({
      accountId: a.id,
      accountName: a.name,
      qty: totalPct > 0 ? parentQty * ((parseFloat(customPcts[a.id] ?? '0') || 0) / totalPct) : 0,
    }));
  }, [qty, method, selectedAccounts, aumByAccount, customPcts]);

  const customPctTotal = useMemo(
    () => selectedAccounts.reduce((s, a) => s + (parseFloat(customPcts[a.id] ?? '0') || 0), 0),
    [selectedAccounts, customPcts]
  );

  const submit = () => {
    if (!symbol.trim()) {
      toast.error('Symbol required');
      return;
    }
    if (allocation.length === 0) {
      toast.error('Pick accounts and quantity');
      return;
    }
    const parentQty = parseFloat(qty);
    const limitPx = parseFloat(limit);
    const blockId = `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let queued = 0;
    for (const leg of allocation) {
      if (leg.qty <= 0) continue;
      enqueue({
        source: 'manual',
        proposedBy: `block:${blockId.slice(0, 14)}`,
        rationale: `Block ${side} ${parentQty} ${symbol.toUpperCase()} (${method}) → leg ${leg.qty.toFixed(4)} for ${leg.accountName}`,
        accountId: leg.accountId,
        symbol: symbol.toUpperCase(),
        side,
        qty: leg.qty,
        type,
        limit_price: type === 'limit' || type === 'stop_limit' ? limitPx : undefined,
        estimatedNotional: leg.qty * (Number.isFinite(limitPx) && limitPx > 0 ? limitPx : 0),
      });
      queued++;
    }
    log({
      category: 'order',
      summary: `Block ${side} ${parentQty} ${symbol.toUpperCase()} → ${queued} legs (${method})`,
      actor: 'user',
      data: { blockId, allocation: allocation.map((l) => ({ accountId: l.accountId, qty: l.qty })) },
    });
    toast.success(`Block queued: ${queued} legs`);
    onClose();
  };

  return (
    <DialogContent className="bg-[#1e1e2e] border-border/60 text-foreground max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          Block trade
        </DialogTitle>
        <DialogDescription className="text-muted-foreground text-xs">
          Allocate one parent order across multiple accounts. Children route through the
          approval queue and reference the same block ID for downstream reconciliation.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-2 text-xs">
        <div className="grid grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Symbol</Label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="h-8 bg-muted/40 border-border/60 text-xs"
              placeholder="SPY"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Side</Label>
            <Select value={side} onValueChange={(v) => setSide(v as 'buy' | 'sell')}>
              <SelectTrigger className="h-8 bg-muted/40 border-border/60 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e2e] border-border/60">
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as OrderType)}>
              <SelectTrigger className="h-8 bg-muted/40 border-border/60 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e2e] border-border/60">
                <SelectItem value="market">Market</SelectItem>
                <SelectItem value="limit">Limit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Total qty</Label>
            <Input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-8 bg-muted/40 border-border/60 text-xs"
              step="any"
            />
          </div>
        </div>

        {type === 'limit' && (
          <div className="space-y-1 max-w-xs">
            <Label className="text-[10px]">Limit price</Label>
            <Input
              type="number"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="h-8 bg-muted/40 border-border/60 text-xs"
              step="any"
            />
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-[10px]">Allocation method</Label>
          <div className="flex gap-2">
            {(['pro_rata_aum', 'equal_qty', 'custom'] as AllocationMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`px-3 py-1.5 rounded-md text-[11px] ${method === m ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-muted/40 text-muted-foreground'}`}
              >
                {m === 'pro_rata_aum' ? 'Pro-rata by AUM' : m === 'equal_qty' ? 'Equal quantity' : 'Custom %'}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border/40 max-h-56 overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-muted/30 sticky top-0">
              <tr className="text-[10px] uppercase text-muted-foreground">
                <th className="px-2 py-1 text-left">
                  <input
                    type="checkbox"
                    checked={accounts.every((a) => selected[a.id])}
                    onChange={(e) =>
                      setSelected(Object.fromEntries(accounts.map((a) => [a.id, e.target.checked])))
                    }
                  />
                </th>
                <th className="px-2 py-1 text-left">Account</th>
                <th className="px-2 py-1 text-right">AUM</th>
                {method === 'custom' && <th className="px-2 py-1 text-right">%</th>}
                <th className="px-2 py-1 text-right">Allocated qty</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const leg = allocation.find((l) => l.accountId === a.id);
                return (
                  <tr key={a.id} className="border-t border-border/20">
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={!!selected[a.id]}
                        onChange={(e) =>
                          setSelected((s) => ({ ...s, [a.id]: e.target.checked }))
                        }
                      />
                    </td>
                    <td className="px-2 py-1 text-foreground">
                      {a.name}
                      {a.last4 && <span className="text-[10px] text-muted-foreground ml-1">··{a.last4}</span>}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      ${(aumByAccount[a.id] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    {method === 'custom' && (
                      <td className="px-2 py-1 text-right">
                        <Input
                          type="number"
                          value={customPcts[a.id] ?? ''}
                          onChange={(e) => setCustomPcts((p) => ({ ...p, [a.id]: e.target.value }))}
                          className="h-6 w-20 bg-muted/40 border-border/60 text-[10px] text-right ml-auto"
                          step="any"
                          disabled={!selected[a.id]}
                        />
                      </td>
                    )}
                    <td className="px-2 py-1 text-right font-mono text-foreground">
                      {leg?.qty?.toFixed(4) ?? '0'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {method === 'custom' && (
              <tfoot>
                <tr className="bg-muted/20 text-[10px]">
                  <td colSpan={2} className="px-2 py-1 text-muted-foreground">
                    Total %
                  </td>
                  <td colSpan={1}></td>
                  <td className={`px-2 py-1 text-right font-mono ${Math.abs(customPctTotal - 100) > 0.01 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {customPctTotal.toFixed(2)}%
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <DialogFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!symbol.trim() || allocation.length === 0 || !parseFloat(qty)}
          className="px-4 py-2 rounded-lg text-xs bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-40"
        >
          Queue block ({allocation.length} legs)
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

export default BlockTradeDialog;
