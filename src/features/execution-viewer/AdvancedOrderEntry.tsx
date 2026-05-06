/**
 * AdvancedOrderEntry — full order ticket with type/TIF/stops/brackets/OCO.
 *
 * Hides options the active broker doesn't support via getBrokerCapabilities().
 * Validates required fields per type before allowing submit. Order params are
 * forwarded verbatim to /api/execution/signal — backend authority on accept/reject.
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type BracketLegs,
  type BrokerCapabilities,
  type OrderType,
  type SignalRequest,
  type TimeInForce,
  getBrokerCapabilities,
  submitSignal,
} from './api';

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  market: 'Market',
  limit: 'Limit',
  stop: 'Stop',
  stop_limit: 'Stop-limit',
  trailing_stop: 'Trailing stop',
};

const TIF_LABELS: Record<TimeInForce, string> = {
  DAY: 'Day',
  GTC: 'Good-til-cancelled',
  GTD: 'Good-til-date',
  IOC: 'Immediate-or-cancel',
  FOK: 'Fill-or-kill',
};

interface Props {
  defaultSymbol?: string;
  onSubmitted?: () => void;
}

export default function AdvancedOrderEntry({ defaultSymbol = 'SPY', onSubmitted }: Props) {
  const [caps, setCaps] = useState<BrokerCapabilities | null>(null);

  const [symbol, setSymbol] = useState(defaultSymbol);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qty, setQty] = useState('1');
  const [type, setType] = useState<OrderType>('market');
  const [tif, setTif] = useState<TimeInForce>('DAY');
  const [goodTil, setGoodTil] = useState('');

  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [trailMode, setTrailMode] = useState<'amount' | 'percent'>('amount');
  const [trailValue, setTrailValue] = useState('');

  const [withBracket, setWithBracket] = useState(false);
  const [bracketTakeProfit, setBracketTakeProfit] = useState('');
  const [bracketStop, setBracketStop] = useState('');
  const [bracketStopLimit, setBracketStopLimit] = useState('');

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getBrokerCapabilities().then((c) => {
      if (!cancelled) setCaps(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const allowedTypes: OrderType[] = caps?.order_types ?? ['market', 'limit'];
  const allowedTifs: TimeInForce[] = caps?.tif ?? ['DAY', 'GTC'];
  const supportsBrackets = caps?.brackets ?? false;
  const supportsTrailing = caps?.trailing_stops ?? false;

  // Reset incompatible state when broker caps change
  useEffect(() => {
    if (!allowedTypes.includes(type)) setType(allowedTypes[0] ?? 'market');
    if (!allowedTifs.includes(tif)) setTif(allowedTifs[0] ?? 'DAY');
  }, [allowedTypes, allowedTifs, type, tif]);

  const validation = useMemo(() => {
    const errs: string[] = [];
    if (!symbol.trim()) errs.push('symbol required');
    const q = parseFloat(qty);
    if (!Number.isFinite(q) || q <= 0) errs.push('quantity must be > 0');
    if ((type === 'limit' || type === 'stop_limit') && !limitPrice) errs.push('limit price required');
    if ((type === 'stop' || type === 'stop_limit') && !stopPrice) errs.push('stop price required');
    if (type === 'trailing_stop' && !trailValue) errs.push('trail value required');
    if (tif === 'GTD' && !goodTil) errs.push('good-til date required');
    if (withBracket) {
      if (!bracketTakeProfit) errs.push('bracket take-profit required');
      if (!bracketStop) errs.push('bracket stop required');
    }
    return errs;
  }, [symbol, qty, type, limitPrice, stopPrice, trailValue, tif, goodTil, withBracket, bracketTakeProfit, bracketStop]);

  const buildRequest = (): SignalRequest => {
    const req: SignalRequest = {
      symbol: symbol.trim().toUpperCase(),
      side,
      qty: parseFloat(qty),
      type,
      tif,
    };
    if (type === 'limit' || type === 'stop_limit') req.limit_price = parseFloat(limitPrice);
    if (type === 'stop' || type === 'stop_limit') req.stop_price = parseFloat(stopPrice);
    if (type === 'trailing_stop') {
      const v = parseFloat(trailValue);
      if (trailMode === 'amount') req.trail_amount = v;
      else req.trail_percent = v;
    }
    if (tif === 'GTD' && goodTil) req.good_til = new Date(goodTil).toISOString();
    if (withBracket) {
      const bracket: BracketLegs = {
        take_profit_price: parseFloat(bracketTakeProfit),
        stop_price: parseFloat(bracketStop),
      };
      if (bracketStopLimit) bracket.stop_limit_price = parseFloat(bracketStopLimit);
      req.bracket = bracket;
    }
    return req;
  };

  const handleSubmit = async () => {
    if (validation.length > 0) {
      toast.error(`Fix: ${validation.join('; ')}`);
      return;
    }
    setBusy(true);
    try {
      const order = await submitSignal(buildRequest());
      toast.success(
        `Submitted ${ORDER_TYPE_LABELS[type]} ${side} ${qty} ${symbol} · #${order.id.slice(0, 8)}`
      );
      onSubmitted?.();
    } catch (e) {
      toast.error(`Submit failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-border/40 bg-card/40 p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-foreground font-medium">Advanced order ticket</span>
        {caps && (
          <span className="text-[10px] text-muted-foreground uppercase">
            broker: {caps.broker}
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-[10px] text-muted-foreground">Symbol</Label>
          <Input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="bg-muted/40 border-border/60 h-8 text-xs"
            placeholder="SPY"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Side</Label>
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
          <Label className="text-[10px] text-muted-foreground">Quantity</Label>
          <Input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="bg-muted/40 border-border/60 h-8 text-xs"
            min="0"
            step={caps?.fractional ? 'any' : '1'}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as OrderType)}>
            <SelectTrigger className="h-8 bg-muted/40 border-border/60 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1e1e2e] border-border/60">
              {allowedTypes.map((t) => (
                <SelectItem
                  key={t}
                  value={t}
                  disabled={t === 'trailing_stop' && !supportsTrailing}
                >
                  {ORDER_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Time in force</Label>
          <Select value={tif} onValueChange={(v) => setTif(v as TimeInForce)}>
            <SelectTrigger className="h-8 bg-muted/40 border-border/60 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1e1e2e] border-border/60">
              {allowedTifs.map((t) => (
                <SelectItem key={t} value={t}>{TIF_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(type === 'limit' || type === 'stop_limit') && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Limit price</Label>
          <Input
            type="number"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            className="bg-muted/40 border-border/60 h-8 text-xs"
            step="any"
          />
        </div>
      )}

      {(type === 'stop' || type === 'stop_limit') && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Stop price</Label>
          <Input
            type="number"
            value={stopPrice}
            onChange={(e) => setStopPrice(e.target.value)}
            className="bg-muted/40 border-border/60 h-8 text-xs"
            step="any"
          />
        </div>
      )}

      {type === 'trailing_stop' && (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Trail mode</Label>
            <Select value={trailMode} onValueChange={(v) => setTrailMode(v as 'amount' | 'percent')}>
              <SelectTrigger className="h-8 bg-muted/40 border-border/60 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e2e] border-border/60">
                <SelectItem value="amount">$ amount</SelectItem>
                <SelectItem value="percent">%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Trail {trailMode === 'amount' ? 'amount' : 'percent'}
            </Label>
            <Input
              type="number"
              value={trailValue}
              onChange={(e) => setTrailValue(e.target.value)}
              className="bg-muted/40 border-border/60 h-8 text-xs"
              step="any"
            />
          </div>
        </div>
      )}

      {tif === 'GTD' && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Good-til date</Label>
          <Input
            type="date"
            value={goodTil}
            onChange={(e) => setGoodTil(e.target.value)}
            className="bg-muted/40 border-border/60 h-8 text-xs"
          />
        </div>
      )}

      {supportsBrackets && (
        <div className="rounded-md border border-border/40 p-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={withBracket}
              onChange={(e) => setWithBracket(e.target.checked)}
            />
            <span className="text-foreground">Attach bracket (take-profit + stop)</span>
          </label>
          {withBracket && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Take profit</Label>
                <Input
                  type="number"
                  value={bracketTakeProfit}
                  onChange={(e) => setBracketTakeProfit(e.target.value)}
                  className="bg-muted/40 border-border/60 h-8 text-xs"
                  step="any"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Stop</Label>
                <Input
                  type="number"
                  value={bracketStop}
                  onChange={(e) => setBracketStop(e.target.value)}
                  className="bg-muted/40 border-border/60 h-8 text-xs"
                  step="any"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Stop-limit (opt)</Label>
                <Input
                  type="number"
                  value={bracketStopLimit}
                  onChange={(e) => setBracketStopLimit(e.target.value)}
                  className="bg-muted/40 border-border/60 h-8 text-xs"
                  step="any"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {validation.length > 0 && (
        <div className="text-[10px] text-amber-400">{validation.join(' · ')}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={busy || validation.length > 0}
        className="w-full rounded-md bg-primary/20 hover:bg-primary/30 text-primary py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? 'Submitting…' : `Submit ${ORDER_TYPE_LABELS[type]} ${side} ${qty} ${symbol}`}
      </button>
    </div>
  );
}
