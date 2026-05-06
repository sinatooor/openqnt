/**
 * TradeDialog — record a buy or sell against a holding.
 *
 * The buy form appends a new tax lot. The sell form previews the exact lot
 * consumption under the active cost-basis method (FIFO/LIFO/HIFO/AVERAGE)
 * and shows estimated realized P&L before committing.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowDownRight, ArrowUpRight, ShoppingCart, Coins } from 'lucide-react';
import {
  usePortfolioStore,
  type CostBasisMethod,
  type Lot,
  type PortfolioHolding,
} from '@/stores/portfolioStore';

const MS_PER_DAY = 86_400_000;
const LONG_TERM_DAYS = 365;

const fmt = (n: number, decimals = 2) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);

const fmtCurrency = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(n);

interface TradeDialogProps {
  holding: PortfolioHolding;
  side: 'buy' | 'sell';
  onClose: () => void;
}

/** Mirror of orderLotsForSale in the store, kept private here for preview-only math. */
function previewSale(
  lots: Lot[],
  qtyToSell: number,
  salePrice: number,
  fees: number,
  method: CostBasisMethod,
  closedAt: number,
): {
  ok: boolean;
  consumed: { lotId: string; qty: number; pricePerUnit: number; openedAt: number; daysHeld: number; longTerm: boolean }[];
  costBasis: number;
  proceeds: number;
  realizedPnL: number;
  shortTermPnL: number;
  longTermPnL: number;
  remainingOpen: number;
} {
  const open = lots.filter((l) => l.qty - l.closedQty > 0).map((l) => ({ ...l }));
  const totalOpen = open.reduce((s, l) => s + (l.qty - l.closedQty), 0);
  if (qtyToSell > totalOpen) {
    return {
      ok: false,
      consumed: [],
      costBasis: 0,
      proceeds: 0,
      realizedPnL: 0,
      shortTermPnL: 0,
      longTermPnL: 0,
      remainingOpen: totalOpen,
    };
  }

  const ordered = (() => {
    switch (method) {
      case 'FIFO': return [...open].sort((a, b) => a.openedAt - b.openedAt);
      case 'LIFO': return [...open].sort((a, b) => b.openedAt - a.openedAt);
      case 'HIFO': return [...open].sort((a, b) => b.price - a.price);
      case 'AVERAGE': return [...open].sort((a, b) => a.openedAt - b.openedAt);
    }
  })();

  // For AVERAGE method, every open lot's effective basis = weighted-avg-cost.
  let avgPerUnit = 0;
  if (method === 'AVERAGE') {
    let q = 0;
    let cs = 0;
    for (const l of open) {
      const o = l.qty - l.closedQty;
      q += o;
      cs += o * (l.price + (l.qty > 0 ? l.fees / l.qty : 0));
    }
    avgPerUnit = q > 0 ? cs / q : 0;
  }

  let remaining = qtyToSell;
  let costBasis = 0;
  const consumed: ReturnType<typeof previewSale>['consumed'] = [];
  for (const lot of ordered) {
    if (remaining <= 0) break;
    const available = lot.qty - lot.closedQty;
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    const perUnit = method === 'AVERAGE' ? avgPerUnit : lot.price + (lot.qty > 0 ? lot.fees / lot.qty : 0);
    costBasis += take * perUnit;
    const daysHeld = Math.floor((closedAt - lot.openedAt) / MS_PER_DAY);
    consumed.push({
      lotId: lot.id,
      qty: take,
      pricePerUnit: perUnit,
      openedAt: lot.openedAt,
      daysHeld,
      longTerm: daysHeld > LONG_TERM_DAYS,
    });
    remaining -= take;
  }

  const proceeds = qtyToSell * salePrice - fees;
  const realizedPnL = proceeds - costBasis;
  let shortTermPnL = 0;
  let longTermPnL = 0;
  for (const c of consumed) {
    const share = qtyToSell > 0 ? c.qty / qtyToSell : 0;
    if (c.longTerm) longTermPnL += realizedPnL * share;
    else shortTermPnL += realizedPnL * share;
  }
  return {
    ok: true,
    consumed,
    costBasis,
    proceeds,
    realizedPnL,
    shortTermPnL,
    longTermPnL,
    remainingOpen: totalOpen - qtyToSell,
  };
}

export function TradeDialog({ holding, side, onClose }: TradeDialogProps) {
  const buy = usePortfolioStore((s) => s.buy);
  const sell = usePortfolioStore((s) => s.sell);
  const costBasisMethod = usePortfolioStore((s) => s.costBasisMethod);

  const [qtyStr, setQtyStr] = useState('');
  const [priceStr, setPriceStr] = useState(
    side === 'sell' ? String(holding.currentPrice || holding.avgCost) : ''
  );
  const [feesStr, setFeesStr] = useState('0');

  const qty = parseFloat(qtyStr) || 0;
  const price = parseFloat(priceStr) || 0;
  const fees = parseFloat(feesStr) || 0;

  const lots = holding.lots ?? [];
  const totalOpen = lots.reduce((s, l) => s + Math.max(0, l.qty - l.closedQty), 0);

  const preview = useMemo(() => {
    if (side !== 'sell') return null;
    if (qty <= 0 || price <= 0) return null;
    return previewSale(lots, qty, price, fees, costBasisMethod, Date.now());
  }, [side, qty, price, fees, lots, costBasisMethod]);

  const canSubmit =
    qty > 0 && price > 0 && (side === 'buy' || (preview?.ok ?? false));

  const handleSubmit = () => {
    if (side === 'buy') {
      buy(holding.id, qty, price, fees);
      toast.success(`Bought ${qty} ${holding.symbol} @ ${fmtCurrency(price, holding.currency)}`);
    } else {
      const sale = sell(holding.id, qty, price, fees);
      if (!sale) {
        toast.error('Insufficient open quantity for this sale.');
        return;
      }
      const sign = sale.realizedPnL >= 0 ? '+' : '';
      toast.success(
        `Sold ${qty} ${holding.symbol} · realized ${sign}${fmtCurrency(sale.realizedPnL, holding.currency)} (${costBasisMethod})`
      );
    }
    onClose();
  };

  const Icon = side === 'buy' ? ShoppingCart : Coins;
  const accent = side === 'buy' ? 'text-emerald-400' : 'text-amber-400';

  return (
    <DialogContent className="bg-[#1e1e2e] border-border/60 text-foreground max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${accent}`} />
          {side === 'buy' ? 'Buy' : 'Sell'} {holding.symbol}
        </DialogTitle>
        <DialogDescription className="text-muted-foreground text-xs">
          {side === 'buy'
            ? 'Adds a new tax lot. Cost basis tracked separately for tax reporting.'
            : `Consumes open lots under ${costBasisMethod}. Open: ${fmt(totalOpen, 4)} units.`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Quantity</Label>
            <Input
              type="number"
              value={qtyStr}
              onChange={(e) => setQtyStr(e.target.value)}
              placeholder="e.g. 10"
              className="bg-muted/40 border-border/60 text-sm"
              min="0"
              step="any"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {side === 'buy' ? 'Price / unit' : 'Sale price / unit'}
            </Label>
            <Input
              type="number"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder="e.g. 178.50"
              className="bg-muted/40 border-border/60 text-sm"
              min="0"
              step="any"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Commission / fees</Label>
          <Input
            type="number"
            value={feesStr}
            onChange={(e) => setFeesStr(e.target.value)}
            placeholder="0"
            className="bg-muted/40 border-border/60 text-sm"
            min="0"
            step="any"
          />
        </div>

        {/* Preview block */}
        {side === 'buy' && qty > 0 && price > 0 && (
          <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
            <div className="font-medium text-emerald-400 mb-2 flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3" /> Lot preview
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-muted-foreground">
              <span>Notional</span>
              <span className="text-right text-foreground font-mono">
                {fmtCurrency(qty * price, holding.currency)}
              </span>
              <span>Total cost (incl. fees)</span>
              <span className="text-right text-foreground font-mono">
                {fmtCurrency(qty * price + fees, holding.currency)}
              </span>
              <span>Effective basis / unit</span>
              <span className="text-right text-foreground font-mono">
                {fmtCurrency(price + (qty > 0 ? fees / qty : 0), holding.currency)}
              </span>
            </div>
          </div>
        )}

        {side === 'sell' && preview && (
          <div
            className={`mt-2 rounded-md border p-3 text-xs ${
              preview.ok
                ? preview.realizedPnL >= 0
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-red-500/20 bg-red-500/5'
                : 'border-amber-500/30 bg-amber-500/5'
            }`}
          >
            {!preview.ok ? (
              <div className="text-amber-400">
                Insufficient open quantity. You have {fmt(preview.remainingOpen + qty, 4)} open;
                requested {fmt(qty, 4)}.
              </div>
            ) : (
              <>
                <div
                  className={`font-medium mb-2 flex items-center gap-1 ${
                    preview.realizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {preview.realizedPnL >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  Realized P&L preview · {costBasisMethod}
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-muted-foreground">
                  <span>Proceeds (net of fees)</span>
                  <span className="text-right text-foreground font-mono">
                    {fmtCurrency(preview.proceeds, holding.currency)}
                  </span>
                  <span>Cost basis consumed</span>
                  <span className="text-right text-foreground font-mono">
                    {fmtCurrency(preview.costBasis, holding.currency)}
                  </span>
                  <span className="font-medium">Realized P&L</span>
                  <span
                    className={`text-right font-mono font-medium ${
                      preview.realizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {fmtCurrency(preview.realizedPnL, holding.currency)}
                  </span>
                  {preview.shortTermPnL !== 0 && (
                    <>
                      <span className="text-[10px]">↳ Short-term (≤365d)</span>
                      <span className="text-right font-mono text-[10px]">
                        {fmtCurrency(preview.shortTermPnL, holding.currency)}
                      </span>
                    </>
                  )}
                  {preview.longTermPnL !== 0 && (
                    <>
                      <span className="text-[10px]">↳ Long-term (&gt;365d)</span>
                      <span className="text-right font-mono text-[10px]">
                        {fmtCurrency(preview.longTermPnL, holding.currency)}
                      </span>
                    </>
                  )}
                  <span>Remaining open</span>
                  <span className="text-right text-foreground font-mono">
                    {fmt(preview.remainingOpen, 4)}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
                  Lots consumed:{' '}
                  {preview.consumed
                    .map((c) => `${fmt(c.qty, 4)} @ ${fmtCurrency(c.pricePerUnit, holding.currency)} (${c.daysHeld}d${c.longTerm ? ' LT' : ''})`)
                    .join(', ')}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`px-4 py-2 rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            side === 'buy'
              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
          }`}
        >
          {side === 'buy' ? 'Record Buy' : 'Record Sell'}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

export default TradeDialog;
