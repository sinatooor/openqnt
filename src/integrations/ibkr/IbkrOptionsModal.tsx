/**
 * IbkrOptionsModal — discover an equity's option chain on IBKR, pick a
 * strike/expiry/right, and place an order.
 *
 * Backend flow:
 *   1. GET /api/integrations/ibkr/options/{symbol}/chain
 *      → expirations + strikes (per exchange, we use the first param-set)
 *   2. POST /api/integrations/ibkr/options/order with `confirmed: true`
 *
 * Safety: the order endpoint requires `confirmed: true`, and the UI
 * always shows a confirm step before posting. Order results are surfaced
 * via toast and an inline status row inside the modal.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Search,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { WindowModal } from '@/features/strategy-flow/components/modals/WindowModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  ibkrApi,
  type IbkrOptionChain,
  type IbkrOrderResult,
} from '@/integrations/ibkr/api';

interface IbkrOptionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSymbol?: string;
}

// Format YYYYMMDD → "26 May 2026"
const formatExpiry = (yyyymmdd: string): string => {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  const y = yyyymmdd.slice(0, 4);
  const m = parseInt(yyyymmdd.slice(4, 6), 10);
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m - 1] ?? '?'} ${y}`;
};

// Days from today → YYYYMMDD
const daysUntil = (yyyymmdd: string): number => {
  if (yyyymmdd.length !== 8) return 0;
  const y = parseInt(yyyymmdd.slice(0, 4), 10);
  const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  const target = new Date(y, m, d);
  return Math.round((target.getTime() - Date.now()) / 86400000);
};

interface PendingOrder {
  expiry: string;
  strike: number;
  right: 'C' | 'P';
  side: 'buy' | 'sell';
}

export function IbkrOptionsModal({ open, onOpenChange, initialSymbol = 'AAPL' }: IbkrOptionsModalProps) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [loading, setLoading] = useState(false);
  const [chain, setChain] = useState<IbkrOptionChain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [centerStrike, setCenterStrike] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [orderType, setOrderType] = useState<'market' | 'limit'>('limit');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const [placing, setPlacing] = useState(false);
  const [lastOrder, setLastOrder] = useState<IbkrOrderResult | null>(null);

  // Use the first param-set (SMART / first exchange); IBKR returns multiple
  // but they share the same strikes for standard listed options.
  const primaryParams = chain?.params?.[0];
  const allExpirations = useMemo(() => primaryParams?.expirations ?? [], [primaryParams]);
  const allStrikes = useMemo(() => primaryParams?.strikes ?? [], [primaryParams]);

  // When chain loads, default to the nearest expiry > 7 days out
  useEffect(() => {
    if (!chain || !allExpirations.length) return;
    if (selectedExpiry && allExpirations.includes(selectedExpiry)) return;
    const future = allExpirations.find((e) => daysUntil(e) >= 7) ?? allExpirations[0];
    setSelectedExpiry(future);
    if (allStrikes.length > 0 && centerStrike == null) {
      // Default ATM strike — middle of the list as a placeholder
      setCenterStrike(allStrikes[Math.floor(allStrikes.length / 2)]);
    }
  }, [chain, allExpirations, allStrikes, selectedExpiry, centerStrike]);

  const handleFetchChain = async () => {
    if (!symbol.trim()) {
      toast.error('Enter a symbol');
      return;
    }
    setLoading(true);
    setError(null);
    setChain(null);
    try {
      const c = await ibkrApi.optionChain(symbol.trim().toUpperCase());
      setChain(c);
      toast.success(`Loaded ${symbol.toUpperCase()} chain: ${c.params[0]?.expirations.length ?? 0} expirations`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!pending) return;
    setPlacing(true);
    try {
      const { order } = await ibkrApi.placeOptionOrder({
        symbol: symbol.toUpperCase(),
        expiry: pending.expiry,
        strike: pending.strike,
        right: pending.right,
        side: pending.side,
        qty,
        orderType,
        ...(orderType === 'limit' && limitPrice ? { limitPrice: parseFloat(limitPrice) } : {}),
        confirmed: true,
      });
      setLastOrder(order);
      if (order.status === 'rejected') {
        toast.error(`Order rejected: ${order.rejected_reason ?? 'unknown'}`);
      } else {
        toast.success(`Order ${order.status}: ${order.symbol}`);
      }
      setPending(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPlacing(false);
    }
  };

  // Limit strikes shown to ±15 around the center for performance + readability
  const visibleStrikes = useMemo(() => {
    if (!allStrikes.length || centerStrike == null) return allStrikes.slice(0, 30);
    const idx = allStrikes.findIndex((s) => s >= centerStrike);
    const start = Math.max(0, idx - 15);
    return allStrikes.slice(start, start + 30);
  }, [allStrikes, centerStrike]);

  return (
    <WindowModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="IBKR Options"
      size="lg"
    >
      <div className="space-y-4 p-1">
        {/* ─── Symbol search ─── */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Underlying Symbol</Label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleFetchChain()}
              placeholder="AAPL"
              className="font-mono"
            />
          </div>
          <Button onClick={handleFetchChain} disabled={loading} size="sm">
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5 mr-1" />
            )}
            Load chain
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded border border-red-500/30 bg-red-500/5 text-xs text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {chain && (
          <>
            {/* ─── Underlying header + expiry picker ─── */}
            <div className="flex items-center justify-between p-2 rounded bg-muted/30 border border-border/30">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {chain.underlyingSymbol}
                  <span className="text-xs text-muted-foreground ml-2">{chain.longName ?? ''}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  conId {chain.underlyingConId} · {chain.params.length} exchange param-set
                  {chain.params.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Expiry</Label>
                <Select value={selectedExpiry} onValueChange={setSelectedExpiry}>
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allExpirations.map((e) => (
                      <SelectItem key={e} value={e}>
                        {formatExpiry(e)}{' '}
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ({daysUntil(e)}d)
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ─── Order config strip ─── */}
            <div className="flex items-end gap-3 p-2.5 rounded bg-muted/20 border border-border/30">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Qty (contracts)</Label>
                <Input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-20 h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Order type</Label>
                <Select value={orderType} onValueChange={(v) => setOrderType(v as 'market' | 'limit')}>
                  <SelectTrigger className="h-8 w-[110px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">Market</SelectItem>
                    <SelectItem value="limit">Limit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {orderType === 'limit' && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Limit price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="w-24 h-8 text-xs font-mono"
                    placeholder="1.50"
                  />
                </div>
              )}
              <div className="ml-auto text-[10px] text-muted-foreground">
                1 contract = 100 shares · paper account = paper money
              </div>
            </div>

            {/* ─── Strikes table ─── */}
            <div className="rounded border border-border/30 overflow-hidden">
              <table className="w-full text-xs tabular-nums">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left py-1.5 px-2 w-[35%]" colSpan={2}>
                      <span className="text-emerald-400">CALL</span>
                    </th>
                    <th className="text-center py-1.5 px-2">Strike</th>
                    <th className="text-right py-1.5 px-2 w-[35%]" colSpan={2}>
                      <span className="text-red-400">PUT</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="max-h-[300px]">
                  {visibleStrikes.map((strike) => (
                    <tr key={strike} className="border-t border-border/20 hover:bg-muted/30">
                      <td className="py-1 px-2">
                        <button
                          onClick={() => setPending({ expiry: selectedExpiry, strike, right: 'C', side: 'buy' })}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition"
                        >
                          <ArrowUpRight className="w-3 h-3 inline mr-0.5" />
                          Buy C
                        </button>
                      </td>
                      <td className="py-1 px-2">
                        <button
                          onClick={() => setPending({ expiry: selectedExpiry, strike, right: 'C', side: 'sell' })}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted/40 text-muted-foreground hover:bg-muted/60 transition"
                        >
                          Sell C
                        </button>
                      </td>
                      <td className="text-center py-1 px-2 font-semibold text-foreground">
                        ${strike.toFixed(strike >= 1000 ? 0 : 2)}
                      </td>
                      <td className="text-right py-1 px-2">
                        <button
                          onClick={() => setPending({ expiry: selectedExpiry, strike, right: 'P', side: 'sell' })}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted/40 text-muted-foreground hover:bg-muted/60 transition"
                        >
                          Sell P
                        </button>
                      </td>
                      <td className="text-right py-1 px-2">
                        <button
                          onClick={() => setPending({ expiry: selectedExpiry, strike, right: 'P', side: 'buy' })}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-300 hover:bg-red-500/25 transition"
                        >
                          <ArrowDownRight className="w-3 h-3 inline mr-0.5" />
                          Buy P
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-2 py-1 text-[10px] text-muted-foreground bg-muted/20 border-t border-border/20">
                Showing {visibleStrikes.length} of {allStrikes.length} strikes — pick a different center strike
                in a future build to scroll
              </div>
            </div>
          </>
        )}

        {/* ─── Last order status ─── */}
        {lastOrder && (
          <div
            className={`flex items-start gap-2 p-2.5 rounded border text-xs ${
              lastOrder.status === 'rejected'
                ? 'border-red-500/30 bg-red-500/5 text-red-300'
                : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
            }`}
          >
            {lastOrder.status === 'rejected' ? (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-mono">
                {lastOrder.symbol} · {lastOrder.side} · {lastOrder.qty} · status {lastOrder.status}
              </div>
              {lastOrder.rejected_reason && (
                <div className="text-[11px] mt-0.5">{lastOrder.rejected_reason}</div>
              )}
              {lastOrder.fill_price && (
                <div className="text-[11px] mt-0.5">
                  filled {lastOrder.fill_qty} @ ${lastOrder.fill_price.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Confirm overlay ─── */}
      {pending && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 rounded-lg z-10">
          <div className="bg-card border border-border rounded-lg p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2">
              {pending.side === 'buy' ? (
                <ArrowUpRight className="w-5 h-5 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-400" />
              )}
              <h3 className="text-sm font-semibold text-foreground">Confirm Option Order</h3>
            </div>
            <div className="space-y-1 text-xs font-mono bg-muted/40 p-3 rounded">
              <div>
                <span className="text-muted-foreground">Side: </span>
                <span className={pending.side === 'buy' ? 'text-emerald-400' : 'text-red-400'}>
                  {pending.side.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Contract: </span>
                <span className="text-foreground">
                  {symbol} {formatExpiry(pending.expiry)} {pending.right === 'C' ? 'CALL' : 'PUT'} ${pending.strike}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Qty: </span>
                <span className="text-foreground">{qty} contract{qty === 1 ? '' : 's'} (= {qty * 100} shares notional)</span>
              </div>
              <div>
                <span className="text-muted-foreground">Order: </span>
                <span className="text-foreground">
                  {orderType.toUpperCase()}
                  {orderType === 'limit' && limitPrice ? ` @ $${limitPrice}` : ''}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPending(null)} disabled={placing}>
                Cancel
              </Button>
              <Button size="sm" onClick={handlePlaceOrder} disabled={placing}>
                {placing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Badge className="mr-1 px-1 py-0 text-[10px]">{symbol}</Badge>
                    Place order
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </WindowModal>
  );
}
