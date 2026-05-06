/**
 * AccountManagerDialog — add, rename, archive, and delete accounts.
 *
 * Tax status is auto-set from account type but can be overridden (e.g. a trust
 * account that holds tax-deferred wrappers internally).
 */
import { useState } from 'react';
import { toast } from 'sonner';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Plus, Archive, Trash2, ArchiveRestore } from 'lucide-react';
import {
  useAccountStore,
  ACCOUNT_TYPE_LABELS,
  type AccountType,
  type TaxStatus,
} from '@/stores/accountStore';

const TAX_STATUS_LABELS: Record<TaxStatus, string> = {
  taxable: 'Taxable',
  tax_deferred: 'Tax-deferred',
  tax_free: 'Tax-free',
  non_taxable: 'Non-taxable',
};

interface Props {
  onClose: () => void;
}

export function AccountManagerDialog({ onClose }: Props) {
  const accounts = useAccountStore((s) => s.accounts);
  const addAccount = useAccountStore((s) => s.addAccount);
  const removeAccount = useAccountStore((s) => s.removeAccount);
  const archiveAccount = useAccountStore((s) => s.archiveAccount);
  const updateAccount = useAccountStore((s) => s.updateAccount);
  const defaultTaxStatusFor = useAccountStore((s) => s.defaultTaxStatusFor);

  // Add form state
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('taxable');
  const [owner, setOwner] = useState('me');
  const [broker, setBroker] = useState('');
  const [last4, setLast4] = useState('');
  const [currency, setCurrency] = useState('USD');

  const handleAdd = () => {
    if (!name.trim()) {
      toast.error('Name required');
      return;
    }
    addAccount({
      name: name.trim(),
      type,
      owner: owner.trim() || 'me',
      broker: broker.trim() || undefined,
      last4: last4.trim() || undefined,
      currency: currency.trim().toUpperCase() || 'USD',
      taxStatus: defaultTaxStatusFor(type),
    });
    toast.success(`Added ${name}`);
    setName('');
    setBroker('');
    setLast4('');
  };

  return (
    <DialogContent className="bg-[#1e1e2e] border-border/60 text-foreground max-w-2xl">
      <DialogHeader>
        <DialogTitle>Manage accounts</DialogTitle>
        <DialogDescription className="text-muted-foreground text-xs">
          Each account is a separate tax/legal entity. Holdings, lots, and realized P&L are
          tracked per-account; the selector switches between aggregate and per-account views.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Existing accounts */}
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Accounts ({accounts.length})</Label>
          <div className="rounded-md border border-border/40 max-h-60 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 sticky top-0">
                <tr className="text-muted-foreground text-[10px] uppercase">
                  <th className="text-left px-2 py-1.5">Name</th>
                  <th className="text-left px-2 py-1.5">Type</th>
                  <th className="text-left px-2 py-1.5">Tax</th>
                  <th className="text-left px-2 py-1.5">Owner</th>
                  <th className="text-left px-2 py-1.5">Broker</th>
                  <th className="text-right px-2 py-1.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className={`border-t border-border/20 ${a.archived ? 'opacity-50' : ''}`}>
                    <td className="px-2 py-1.5 text-foreground">{a.name}</td>
                    <td className="px-2 py-1.5">{ACCOUNT_TYPE_LABELS[a.type]}</td>
                    <td className="px-2 py-1.5">{TAX_STATUS_LABELS[a.taxStatus]}</td>
                    <td className="px-2 py-1.5">{a.owner}</td>
                    <td className="px-2 py-1.5">
                      {a.broker ?? '-'}
                      {a.last4 ? <span className="text-[10px] text-muted-foreground"> ··{a.last4}</span> : null}
                    </td>
                    <td className="px-2 py-1.5 text-right space-x-1">
                      <button
                        onClick={() => archiveAccount(a.id, !a.archived)}
                        className="p-1 rounded hover:bg-muted/40 text-amber-400"
                        title={a.archived ? 'Restore' : 'Archive'}
                      >
                        {a.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => {
                          if (a.id === 'default') {
                            toast.info('Default account cannot be deleted; archive instead.');
                            return;
                          }
                          if (confirm(`Delete account "${a.name}"? Holdings linked to it will become orphaned.`)) {
                            removeAccount(a.id);
                          }
                        }}
                        className="p-1 rounded hover:bg-red-500/20 text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add new */}
        <div className="space-y-2 rounded-md border border-border/40 p-3">
          <Label className="text-[11px] text-muted-foreground">Add new account</Label>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Joint Brokerage"
                className="bg-muted/40 border-border/60 h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                <SelectTrigger className="h-8 bg-muted/40 border-border/60 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1e1e2e] border-border/60">
                  {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => (
                    <SelectItem key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Owner</Label>
              <Input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="me / John D"
                className="bg-muted/40 border-border/60 h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Broker (opt)</Label>
              <Input
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
                placeholder="Fidelity, Schwab…"
                className="bg-muted/40 border-border/60 h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Last 4 (opt)</Label>
              <Input
                value={last4}
                onChange={(e) => setLast4(e.target.value.slice(0, 4))}
                placeholder="0123"
                className="bg-muted/40 border-border/60 h-8 text-xs"
                maxLength={4}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Currency</Label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="bg-muted/40 border-border/60 h-8 text-xs"
                maxLength={4}
              />
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Tax status: {TAX_STATUS_LABELS[defaultTaxStatusFor(type)]} (auto)
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary/20 hover:bg-primary/30 text-primary text-xs"
          >
            <Plus className="w-3 h-3" />
            Add account
          </button>
        </div>
      </div>

      <DialogFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-xs bg-muted/40 hover:bg-muted/60 transition-colors"
        >
          Done
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

export default AccountManagerDialog;
