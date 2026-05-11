/**
 * AccountSelector — Avanza-style "Alla konton ▾" dropdown for the Portfolio
 * page's Holdings tab.
 *
 * Shows the active account (or "All accounts") and a dropdown with one entry
 * per account including its computed market value + a small broker / type
 * badge. Clicking an entry calls `setActiveAccount(id)`; the existing filter
 * in Portfolio.tsx (`h.accountId === activeAccountId`) handles the rest.
 *
 * Below the selector, a small horizontal strip of per-account cards is
 * shown when the user is in "All accounts" mode and has more than one
 * non-archived account — useful for spotting concentration / drift at a
 * glance.
 */

import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { ChevronDown, LayoutGrid, Settings2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAccountStore, ACCOUNT_TYPE_LABELS } from '@/stores/accountStore';
import type { PortfolioHolding } from '@/stores/portfolioStore';
import { cn } from '@/lib/utils';

interface Props {
  holdings: PortfolioHolding[];
}

function fmt(value: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}

export function AccountSelector({ holdings }: Props) {
  const navigate = useNavigate();
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const setActiveAccount = useAccountStore((s) => s.setActiveAccount);

  const visibleAccounts = useMemo(
    () => accounts.filter((a) => !a.archived),
    [accounts],
  );

  /** Holdings filter mirrors Portfolio.tsx: a holding with no accountId belongs
   *  to the legacy 'default' account. */
  const valueFor = (acctId: string | null) => {
    const list = acctId
      ? holdings.filter((h) => (h.accountId ?? 'default') === acctId)
      : holdings;
    return list.reduce(
      (sum, h) => sum + h.quantity * (h.currentPrice || h.avgCost),
      0,
    );
  };

  const totalValue = valueFor(null);
  const activeAccount = activeAccountId
    ? visibleAccounts.find((a) => a.id === activeAccountId)
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md border border-border/60 bg-card/60 hover:bg-card transition-colors',
                'text-sm font-medium text-foreground',
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{activeAccount ? activeAccount.name : 'All accounts'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80" align="start">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Scope
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => setActiveAccount(null)}
              className={cn(
                'flex items-center gap-3 py-2',
                activeAccountId === null && 'bg-primary/10',
              )}
            >
              <LayoutGrid className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">All accounts</div>
                <div className="text-[11px] text-muted-foreground">
                  Aggregate across {visibleAccounts.length || 1} account
                  {visibleAccounts.length === 1 ? '' : 's'}
                </div>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {fmt(totalValue)}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Accounts
            </DropdownMenuLabel>
            {visibleAccounts.length === 0 ? (
              <div className="px-2 py-3 text-[11px] text-muted-foreground text-center">
                No accounts yet
              </div>
            ) : (
              visibleAccounts.map((acct) => {
                const v = valueFor(acct.id);
                const active = activeAccountId === acct.id;
                return (
                  <DropdownMenuItem
                    key={acct.id}
                    onClick={() => setActiveAccount(acct.id)}
                    className={cn('flex items-center gap-3 py-2', active && 'bg-primary/10')}
                  >
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{acct.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {acct.broker ? `${acct.broker} · ` : ''}
                        {ACCOUNT_TYPE_LABELS[acct.type]}
                        {acct.last4 ? ` · ····${acct.last4}` : ''}
                      </div>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                      {fmt(v, acct.currency)}
                    </span>
                  </DropdownMenuItem>
                );
              })
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate('/settings#accounts')}
              className="text-xs text-muted-foreground"
            >
              <Settings2 className="w-3.5 h-3.5 mr-2" />
              Manage accounts
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {activeAccount && (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            {ACCOUNT_TYPE_LABELS[activeAccount.type]}
          </Badge>
        )}

        <span className="ml-auto text-[11px] text-muted-foreground font-mono">
          Total · {fmt(activeAccountId ? valueFor(activeAccountId) : totalValue)}
        </span>
      </div>

      {/* Per-account cards strip: shown when in aggregate view across >1 account. */}
      {!activeAccountId && visibleAccounts.length > 1 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {visibleAccounts.map((acct) => {
            const v = valueFor(acct.id);
            return (
              <button
                key={acct.id}
                onClick={() => setActiveAccount(acct.id)}
                className="text-left rounded-md border border-border/60 bg-card/40 hover:bg-card hover:border-border transition-colors p-3"
              >
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="truncate">{acct.name}</span>
                </div>
                <div className="text-base font-semibold mt-1 tabular-nums">
                  {fmt(v, acct.currency)}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {acct.broker ?? ACCOUNT_TYPE_LABELS[acct.type]}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
