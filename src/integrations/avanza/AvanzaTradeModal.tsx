/**
 * AvanzaTradeModal
 * ----------------
 * Two-step order entry for the Avanza /trading-critical endpoints. The
 * modal explicitly surfaces the reverse-engineered nature of the API and
 * requires a "Confirm" click after the review screen before any write
 * leaves the browser.
 */

import { useState } from 'react';
import { WindowModal } from '@/features/strategy-flow/components/modals/WindowModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';
import { avanzaApi, type AvanzaOrderRequest } from './api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountId?: string;
  defaultOrderbookId?: string;
  defaultSide?: 'BUY' | 'SELL';
  defaultPrice?: number;
  defaultVolume?: number;
}

export function AvanzaTradeModal({
  open,
  onOpenChange,
  defaultAccountId = '',
  defaultOrderbookId = '',
  defaultSide = 'BUY',
  defaultPrice,
  defaultVolume,
}: Props) {
  const [step, setStep] = useState<'edit' | 'review' | 'submitting'>('edit');
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [orderbookId, setOrderbookId] = useState(defaultOrderbookId);
  const [side, setSide] = useState<'BUY' | 'SELL'>(defaultSide);
  const [price, setPrice] = useState<number | undefined>(defaultPrice);
  const [volume, setVolume] = useState<number | undefined>(defaultVolume);

  const close = () => {
    setStep('edit');
    onOpenChange(false);
  };

  const submit = async () => {
    if (!accountId || !orderbookId || price == null || volume == null) {
      toast.error('Fill in all fields');
      return;
    }
    setStep('submitting');
    try {
      const order: AvanzaOrderRequest = {
        accountId,
        orderbookId,
        side,
        price,
        volume,
        confirmed: true,
      };
      await avanzaApi.placeOrder(order);
      toast.success('Order submitted to Avanza');
      close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Order failed';
      toast.error(msg);
      setStep('review');
    }
  };

  const total = price != null && volume != null ? price * volume : null;

  return (
    <WindowModal
      open={open}
      onOpenChange={(o) => (!o ? close() : onOpenChange(o))}
      title={`${side} order — Avanza`}
      defaultWidth={520}
      defaultHeight={620}
    >
      <div className="p-6 space-y-4 text-sm">
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            This places a real order via Avanza's reverse-engineered web API.
            There are no SLAs and the platform's own reference advises against
            using it for real-money trading. Verify in Avanza before relying.
          </div>
        </div>

        {step === 'edit' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Account ID</Label>
                <Input value={accountId} onChange={(e) => setAccountId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Side</Label>
                <select
                  value={side}
                  onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}
                  className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Orderbook ID</Label>
              <Input value={orderbookId} onChange={(e) => setOrderbookId(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price</Label>
                <Input
                  type="number"
                  value={price ?? ''}
                  onChange={(e) => setPrice(e.target.value === '' ? undefined : Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Volume</Label>
                <Input
                  type="number"
                  value={volume ?? ''}
                  onChange={(e) => setVolume(e.target.value === '' ? undefined : Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button onClick={() => setStep('review')}>Review</Button>
            </div>
          </>
        )}

        {step !== 'edit' && (
          <>
            <dl className="grid grid-cols-2 gap-2 rounded border border-white/10 bg-black/30 p-3 text-xs">
              <dt className="text-muted-foreground">Account</dt>
              <dd className="text-right font-mono">{accountId}</dd>
              <dt className="text-muted-foreground">Orderbook</dt>
              <dd className="text-right font-mono">{orderbookId}</dd>
              <dt className="text-muted-foreground">Side</dt>
              <dd className="text-right font-mono">{side}</dd>
              <dt className="text-muted-foreground">Price</dt>
              <dd className="text-right font-mono">{price?.toFixed(2)}</dd>
              <dt className="text-muted-foreground">Volume</dt>
              <dd className="text-right font-mono">{volume}</dd>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="text-right font-mono">{total?.toFixed(2)}</dd>
            </dl>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep('edit')} disabled={step === 'submitting'}>
                Back
              </Button>
              <Button onClick={submit} disabled={step === 'submitting'}>
                {step === 'submitting' ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  'Confirm & send'
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </WindowModal>
  );
}

export default AvanzaTradeModal;
