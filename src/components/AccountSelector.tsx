/**
 * AccountSelector — compact dropdown for switching the active account scope.
 *
 * "All accounts" = aggregate view; specific account selected = focused view.
 * Used in the nav bar and Portfolio page header.
 */
import { useMemo, useState } from 'react';
import { Briefcase, Plus, Settings2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { useAccountStore, ACCOUNT_TYPE_LABELS } from '@/stores/accountStore';
import { AccountManagerDialog } from './AccountManagerDialog';

const ALL_VALUE = '__all__';
const MANAGE_VALUE = '__manage__';

export function AccountSelector() {
  // Subscribe to the raw array reference; filter via useMemo so the snapshot
  // returned by zustand is stable across renders (else: getSnapshot warning).
  const allAccounts = useAccountStore((s) => s.accounts);
  const accounts = useMemo(
    () => allAccounts.filter((a) => !a.archived),
    [allAccounts]
  );
  const activeId = useAccountStore((s) => s.activeAccountId);
  const setActive = useAccountStore((s) => s.setActiveAccount);
  const [managerOpen, setManagerOpen] = useState(false);

  const value = activeId ?? ALL_VALUE;

  return (
    <>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === MANAGE_VALUE) {
            setManagerOpen(true);
            return;
          }
          setActive(v === ALL_VALUE ? null : v);
        }}
      >
        <SelectTrigger className="h-7 w-[170px] bg-muted/40 border-border/60 text-[11px]">
          <Briefcase className="w-3 h-3 mr-1 text-muted-foreground" />
          <SelectValue placeholder="All accounts" />
        </SelectTrigger>
        <SelectContent className="bg-[#1e1e2e] border-border/60">
          <SelectGroup>
            <SelectLabel className="text-[10px]">Scope</SelectLabel>
            <SelectItem value={ALL_VALUE}>All accounts (aggregate)</SelectItem>
          </SelectGroup>
          {accounts.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-[10px]">Accounts</SelectLabel>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span>{a.name}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {ACCOUNT_TYPE_LABELS[a.type]}
                      {a.last4 ? ` ··${a.last4}` : ''}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}
          <SelectSeparator />
          <SelectGroup>
            <SelectItem value={MANAGE_VALUE}>
              <Settings2 className="w-3 h-3 mr-1 inline" />
              Manage accounts…
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <AccountManagerDialog onClose={() => setManagerOpen(false)} />
      </Dialog>
    </>
  );
}

export default AccountSelector;
