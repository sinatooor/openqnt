/**
 * LiveExecutionPanel — Live trading execution viewer.
 *
 * Sections:
 *   • Account header — broker, cash, equity, P&L, kill switch.
 *   • Send signal form — manual + take-template-signal flows.
 *   • Open positions table.
 *   • Order journal — paginated, status-filtered.
 *
 * Polls every {POLL_MS}ms. All colors driven by design tokens so the
 * panel follows the active theme (dark / light / hi-contrast / bloomberg).
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  CircleDollarSign,
  Loader2,
  Send,
  Sparkles,
  ShieldOff,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import {
  clearPanic,
  engagePanic,
  getAccount,
  getOrders,
  getTemplateSignal,
  submitSignal,
  type AccountSnapshot,
  type JournalOrder,
  type TemplateSignal,
} from './api';
import AdvancedOrderEntry from './AdvancedOrderEntry';
import ApprovalQueue from './ApprovalQueue';
import BlockTradeDialog from './BlockTradeDialog';
import TCAPanel from './TCAPanel';
import { useAuthStore } from '@/stores/authStore';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const POLL_MS = 2000;

/* -------------------------------------------------------------------------- */
/*  Formatting helpers                                                        */
/* -------------------------------------------------------------------------- */

function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function signed(n: number, digits = 2): string {
  const v = fmt(n, digits);
  return n > 0 ? `+${v}` : v;
}

function relTime(iso?: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const sec = Math.max(0, (Date.now() - t) / 1000);
  if (sec < 60) return `${sec.toFixed(0)}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function absTime(iso?: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  return new Date(t).toLocaleString();
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

interface KpiProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'profit' | 'loss';
  icon?: React.ComponentType<{ className?: string }>;
}

const Kpi = ({ label, value, hint, tone = 'default', icon: Icon }: KpiProps) => {
  const toneClass =
    tone === 'profit' ? 'text-profit'
      : tone === 'loss' ? 'text-loss'
        : 'text-foreground';
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className={cn('text-lg font-semibold tabular-nums leading-tight', toneClass)}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground/80 tabular-nums">{hint}</div>}
    </div>
  );
};

function statusVariant(status: JournalOrder['status']): {
  badge: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
} {
  switch (status) {
    case 'filled': return { badge: 'outline', className: 'border-profit/40 bg-profit/10 text-profit' };
    case 'rejected': return { badge: 'outline', className: 'border-loss/40 bg-loss/10 text-loss' };
    case 'pending': return { badge: 'outline', className: 'border-amber-500/40 bg-amber-500/10 text-amber-500' };
    case 'partial': return { badge: 'outline', className: 'border-amber-500/40 bg-amber-500/10 text-amber-500' };
    case 'cancelled': return { badge: 'outline', className: 'border-muted-foreground/30 bg-muted/40 text-muted-foreground' };
    default: return { badge: 'outline', className: 'border-muted-foreground/30 bg-muted/40 text-muted-foreground' };
  }
}

const StatusBadge = ({ status }: { status: JournalOrder['status'] }) => {
  const v = statusVariant(status);
  return (
    <Badge variant={v.badge} className={cn('uppercase font-bold tracking-wider text-[9px] px-1.5 py-0', v.className)}>
      {status}
    </Badge>
  );
};

/* -------------------------------------------------------------------------- */
/*  Main panel                                                                */
/* -------------------------------------------------------------------------- */

type OrderFilter = 'all' | 'filled' | 'pending' | 'rejected';

export default function LiveExecutionPanel() {
  const reviewer = useAuthStore((s) => s.user?.email ?? 'user');
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [orders, setOrders] = useState<JournalOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [symbol, setSymbol] = useState('SPY');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qty, setQty] = useState('1');
  const [tplSignal, setTplSignal] = useState<TemplateSignal | null>(null);

  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');

  const refresh = async () => {
    try {
      const [a, o] = await Promise.all([getAccount(), getOrders(50)]);
      setAccount(a);
      setOrders(o);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const onSend = async () => {
    setBusy(true);
    try {
      await submitSignal({ symbol, side, qty: parseFloat(qty) });
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onTemplate = async () => {
    setBusy(true);
    try {
      const s = await getTemplateSignal();
      setTplSignal(s);
      if (s.signal !== 'flat') {
        setSide(s.signal as 'buy' | 'sell');
        setSymbol((s.spec?.symbol as string) ?? 'SPY');
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onPanic = async () => {
    setBusy(true);
    try {
      await engagePanic('ui-button');
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onClearPanic = async () => {
    setBusy(true);
    try {
      await clearPanic();
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const totalPnl = useMemo(() => {
    if (!account) return 0;
    return (account.realised_pnl ?? 0) + (account.unrealised_pnl ?? 0);
  }, [account]);

  const positions = useMemo(
    () => account?.positions.filter((p) => p.qty !== 0) ?? [],
    [account],
  );

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return orders;
    return orders.filter((o) => o.status === orderFilter);
  }, [orders, orderFilter]);

  /* ------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-background text-foreground pt-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Page header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Live Execution</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Same path agents use: signal → RiskGate → broker → journal. Polling every {POLL_MS / 1000}s.
              </p>
            </div>
          </div>
          {account && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider gap-1.5">
              <span className={cn('w-1.5 h-1.5 rounded-full', account.panic.active ? 'bg-loss' : 'bg-profit')} />
              {account.panic.active ? 'Halted' : 'Live'}
            </Badge>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive p-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">{error}</div>
            <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {account?.halted && account.halt_reason && (
          <div className="flex items-center gap-3 rounded-lg border border-loss/30 bg-loss/10 text-loss p-3 text-sm">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>Trading halted by RiskGate · {account.halt_reason}</span>
          </div>
        )}

        {/* Account header card */}
        <Card className="bg-card/60 border-border/50">
          <CardContent className="p-5">
            {!account ? (
              <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting to broker…
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-5 items-end">
                <Kpi
                  label="Broker"
                  value={<span className="uppercase tracking-tight">{account.broker}</span>}
                  icon={Briefcase}
                />
                <Kpi label="Cash" value={`$${fmt(account.cash)}`} icon={Wallet} />
                <Kpi label="Equity" value={`$${fmt(account.equity)}`} icon={CircleDollarSign} />
                <Kpi
                  label="Realised"
                  value={`$${signed(account.realised_pnl)}`}
                  tone={account.realised_pnl >= 0 ? 'profit' : 'loss'}
                />
                <Kpi
                  label="Unrealised"
                  value={`$${signed(account.unrealised_pnl)}`}
                  tone={account.unrealised_pnl >= 0 ? 'profit' : 'loss'}
                />
                <Kpi
                  label="Total P&L"
                  value={`$${signed(totalPnl)}`}
                  tone={totalPnl >= 0 ? 'profit' : 'loss'}
                />
                <div className="flex items-center justify-end">
                  {account.panic.active ? (
                    <Button onClick={onClearPanic} disabled={busy} size="sm" className="gap-1.5">
                      <ShieldOff className="w-3.5 h-3.5" />
                      Clear panic
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={busy} className="gap-1.5 font-bold tracking-wider uppercase">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Kill all
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Engage kill switch?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will close <strong>all open positions</strong> immediately and block any new orders
                            until you clear the panic state. Use only in emergencies.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={onPanic}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Engage kill switch
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Two-column: positions + send signal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Positions */}
          <Card className="bg-card/60 border-border/50 lg:col-span-2">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                Open Positions
                <Badge variant="secondary" className="text-[10px] font-normal h-5 ml-auto">
                  {positions.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {positions.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-12">
                  No open positions.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/40">
                        <TableHead className="text-[10px] uppercase tracking-wider">Symbol</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-right">Qty</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-right">Avg</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-right">Last</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-right">Unreal P&L</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-right">Realised</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {positions.map((p) => (
                        <TableRow key={p.symbol} className="border-border/40">
                          <TableCell className="font-mono font-medium">{p.symbol}</TableCell>
                          <TableCell className="font-mono text-right tabular-nums">{fmt(p.qty, 4)}</TableCell>
                          <TableCell className="font-mono text-right tabular-nums">{fmt(p.avg_price)}</TableCell>
                          <TableCell className="font-mono text-right tabular-nums">{fmt(p.last_price)}</TableCell>
                          <TableCell className={cn('font-mono text-right tabular-nums', p.unrealised_pnl >= 0 ? 'text-profit' : 'text-loss')}>
                            {signed(p.unrealised_pnl)}
                          </TableCell>
                          <TableCell className={cn('font-mono text-right tabular-nums', p.realised_pnl >= 0 ? 'text-profit' : 'text-loss')}>
                            {signed(p.realised_pnl)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Send signal */}
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Send Signal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Symbol</Label>
                  <Input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="SPY"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Side</Label>
                  <Select value={side} onValueChange={(v) => setSide(v as 'buy' | 'sell')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Buy</SelectItem>
                      <SelectItem value="sell">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Quantity</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.0001"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={onSend} disabled={busy} className="gap-2 w-full">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send signal
                </Button>
                <Button
                  onClick={onTemplate}
                  disabled={busy}
                  variant="outline"
                  className="gap-2 w-full"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Take template signal
                </Button>
              </div>

              {tplSignal && (
                <div className="rounded-lg border border-border/40 bg-muted/30 p-3 space-y-1">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Template suggestion
                  </div>
                  <div className="text-sm font-mono tabular-nums flex items-center gap-3 flex-wrap">
                    <span>RSI {tplSignal.rsi?.toFixed(2)}</span>
                    <span className="text-muted-foreground/50">•</span>
                    <span>Last ${tplSignal.last_close?.toFixed(2)}</span>
                    <span className="text-muted-foreground/50">→</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'uppercase font-bold tracking-wider text-[10px]',
                        tplSignal.signal === 'buy' ? 'border-profit/40 bg-profit/10 text-profit'
                          : tplSignal.signal === 'sell' ? 'border-loss/40 bg-loss/10 text-loss'
                            : 'border-amber-500/40 bg-amber-500/10 text-amber-500',
                      )}
                    >
                      {tplSignal.signal}
                    </Badge>
                  </div>
                </div>
              )}
              <div className="pt-3 border-t border-border/40">
                <AdvancedOrderEntry defaultSymbol={symbol} onSubmitted={refresh} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Approval queue (pending agent / strategy / rebalance orders) */}
        <ApprovalQueue reviewer={reviewer} />

        {/* TCA — recent fills' transaction-cost analysis */}
        <TCAPanel orders={orders} />

        {/* Block trade — institutional multi-account allocation */}
        <div className="flex justify-end">
          <button
            onClick={() => setBlockOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs"
          >
            <Layers className="w-3.5 h-3.5" />
            Open block trade…
          </button>
          <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
            <BlockTradeDialog
              aumByAccount={{}}
              onClose={() => setBlockOpen(false)}
            />
          </Dialog>
        </div>

        {/* Order journal */}
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Order Journal
              <Badge variant="secondary" className="text-[10px] font-normal h-5">
                {filteredOrders.length}
              </Badge>
              <span className="text-xs text-muted-foreground font-normal ml-1">· newest first</span>
            </CardTitle>
            <Tabs value={orderFilter} onValueChange={(v) => setOrderFilter(v as OrderFilter)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs h-6 px-2.5">All</TabsTrigger>
                <TabsTrigger value="filled" className="text-xs h-6 px-2.5">Filled</TabsTrigger>
                <TabsTrigger value="pending" className="text-xs h-6 px-2.5">Pending</TabsTrigger>
                <TabsTrigger value="rejected" className="text-xs h-6 px-2.5">Rejected</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            {filteredOrders.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-12">
                No orders match this filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/40">
                      <TableHead className="text-[10px] uppercase tracking-wider">When</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Symbol</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Side</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-right">Qty</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-right">Fill</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Reason / risk</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((o) => {
                      const reason = o.rejected_reason ?? o.risk_decision?.warnings?.join(' · ') ?? '';
                      return (
                        <TableRow key={o.id} className="border-border/40">
                          <TableCell className="font-mono text-xs tabular-nums">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>{relTime(o.submitted_at)}</span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="text-xs">
                                {absTime(o.submitted_at)}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell><StatusBadge status={o.status} /></TableCell>
                          <TableCell className="font-mono">{o.symbol}</TableCell>
                          <TableCell className={cn('font-mono uppercase text-xs tracking-wider flex items-center gap-1', o.side === 'buy' ? 'text-profit' : 'text-loss')}>
                            {o.side === 'buy' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {o.side}
                          </TableCell>
                          <TableCell className="font-mono text-right tabular-nums">{fmt(o.qty, 4)}</TableCell>
                          <TableCell className="font-mono text-right tabular-nums">
                            {o.fill_price !== null ? `$${fmt(o.fill_price)}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                            {reason ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>{reason}</span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs max-w-sm">
                                  {reason}
                                </TooltipContent>
                              </Tooltip>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
