/**
 * Account store — multi-account / household / client separation.
 *
 * Models the structure an RIA or DIY investor needs: each tradeable bucket
 * (Joint, IRA, Roth IRA, 529, individual broker account, advisor-managed
 * client account, etc.) is its own Account. Holdings, orders, fees, and
 * realized P&L all reference an accountId.
 *
 * Tax status drives short/long-term application — IRA/Roth/529 sales are
 * tax-deferred or tax-free, so `getRealizedPnL` consumers can opt to ignore
 * non-taxable accounts.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AccountType =
  | 'taxable'         // individual / joint / margin
  | 'traditional_ira' // pre-tax, taxable on distribution
  | 'roth_ira'        // post-tax, tax-free distributions
  | '401k'            // pre-tax, deferral limit
  | 'roth_401k'
  | '529'             // tax-advantaged education
  | 'hsa'             // tax-advantaged health
  | 'trust'           // revocable / irrevocable trust
  | 'crypto'          // crypto-only sub-bucket (often a separate venue)
  | 'cash'            // checking/savings
  | 'managed_client'; // an advisor's client account

/** US tax treatment groupings for reporting filters. */
export type TaxStatus = 'taxable' | 'tax_deferred' | 'tax_free' | 'non_taxable';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** Owner — for advisor accounts, the client name; otherwise the household member. */
  owner: string;
  /** Optional broker label (e.g., "Fidelity", "Schwab", "Alpaca"). */
  broker?: string;
  /** Free-form last 4 of acct number, for visual identification only. */
  last4?: string;
  taxStatus: TaxStatus;
  /** ISO currency code; reports default to portfolioStore.baseCurrency. */
  currency: string;
  /** Soft-archive flag — hidden from selectors but holdings remain. */
  archived?: boolean;
  createdAt: number;
}

interface AccountState {
  accounts: Account[];
  /** ID of the currently-focused account; null = "All accounts" (aggregate view). */
  activeAccountId: string | null;
  // ─── Actions ─────────────────────
  addAccount: (acct: Omit<Account, 'id' | 'createdAt'>) => Account;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  removeAccount: (id: string) => void;
  setActiveAccount: (id: string | null) => void;
  archiveAccount: (id: string, archived?: boolean) => void;
  // ─── Getters ─────────────────────
  getActiveAccount: () => Account | null;
  /** Default tax status for a given account type. */
  defaultTaxStatusFor: (type: AccountType) => TaxStatus;
}

const TAX_STATUS_BY_TYPE: Record<AccountType, TaxStatus> = {
  taxable: 'taxable',
  traditional_ira: 'tax_deferred',
  roth_ira: 'tax_free',
  '401k': 'tax_deferred',
  roth_401k: 'tax_free',
  '529': 'tax_free',
  hsa: 'tax_free',
  trust: 'taxable',
  crypto: 'taxable',
  cash: 'non_taxable',
  managed_client: 'taxable',
};

const DEFAULT_ACCOUNT: Account = {
  id: 'default',
  name: 'Default',
  type: 'taxable',
  owner: 'me',
  taxStatus: 'taxable',
  currency: 'USD',
  createdAt: 0,
};

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      accounts: [DEFAULT_ACCOUNT],
      activeAccountId: null, // null = aggregate view across all accounts

      addAccount: (acct) => {
        const now = Date.now();
        const id = `acct-${now}-${Math.random().toString(36).slice(2, 8)}`;
        const taxStatus = acct.taxStatus ?? get().defaultTaxStatusFor(acct.type);
        const created: Account = { ...acct, id, taxStatus, createdAt: now };
        set((s) => ({ accounts: [...s.accounts, created] }));
        return created;
      },

      updateAccount: (id, updates) =>
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),

      removeAccount: (id) =>
        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
          activeAccountId: s.activeAccountId === id ? null : s.activeAccountId,
        })),

      setActiveAccount: (id) => set({ activeAccountId: id }),

      archiveAccount: (id, archived = true) =>
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, archived } : a)),
        })),

      getActiveAccount: () => {
        const { accounts, activeAccountId } = get();
        if (!activeAccountId) return null;
        return accounts.find((a) => a.id === activeAccountId) ?? null;
      },

      defaultTaxStatusFor: (type) => TAX_STATUS_BY_TYPE[type] ?? 'taxable',
    }),
    {
      name: 'openqwnt-accounts',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  taxable: 'Taxable / Brokerage',
  traditional_ira: 'Traditional IRA',
  roth_ira: 'Roth IRA',
  '401k': '401(k)',
  roth_401k: 'Roth 401(k)',
  '529': '529 Education',
  hsa: 'HSA',
  trust: 'Trust',
  crypto: 'Crypto',
  cash: 'Cash',
  managed_client: 'Managed (client)',
};

export default useAccountStore;
