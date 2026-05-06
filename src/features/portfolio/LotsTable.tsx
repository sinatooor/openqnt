/**
 * LotsTable — drill-down view of tax lots backing a holding.
 *
 * Shows each lot's open qty, basis, days held, and short/long-term tax
 * classification. Read-only for now; the source of truth is portfolioStore.
 */
import type { Lot } from '@/stores/portfolioStore';

const fmtNum = (n: number, decimals = 4) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n);

const fmtCurrency = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(n);

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const MS_PER_DAY = 86_400_000;
const LONG_TERM_DAYS = 365;

interface LotsTableProps {
  lots: Lot[];
  currency?: string;
}

export function LotsTable({ lots, currency = 'USD' }: LotsTableProps) {
  const now = Date.now();
  if (!lots || lots.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground italic px-2 py-1">
        No tax lots — added before lot tracking. Buy/sell to populate.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] font-mono">
        <thead>
          <tr className="text-muted-foreground text-[10px] uppercase tracking-wider border-b border-border/40">
            <th className="text-left py-1.5 px-1 font-medium">Opened</th>
            <th className="text-right py-1.5 px-1 font-medium">Qty / Open</th>
            <th className="text-right py-1.5 px-1 font-medium">Basis / unit</th>
            <th className="text-right py-1.5 px-1 font-medium">Days held</th>
            <th className="text-center py-1.5 px-1 font-medium">Term</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((l) => {
            const open = Math.max(0, l.qty - l.closedQty);
            const days = Math.floor((now - l.openedAt) / MS_PER_DAY);
            const isLong = days > LONG_TERM_DAYS;
            const isClosed = open === 0;
            const basis = l.price + (l.qty > 0 ? l.fees / l.qty : 0);
            return (
              <tr
                key={l.id}
                className={`border-b border-border/20 ${isClosed ? 'opacity-50' : ''}`}
              >
                <td className="py-1.5 px-1 text-foreground">{fmtDate(l.openedAt)}</td>
                <td className="py-1.5 px-1 text-right text-foreground">
                  {fmtNum(l.qty)} <span className="text-muted-foreground">/ {fmtNum(open)}</span>
                </td>
                <td className="py-1.5 px-1 text-right text-foreground">
                  {fmtCurrency(basis, currency)}
                </td>
                <td className="py-1.5 px-1 text-right text-foreground">{days}</td>
                <td className="py-1.5 px-1 text-center">
                  <span
                    className={
                      isLong
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }
                  >
                    {isLong ? 'LT' : 'ST'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default LotsTable;
