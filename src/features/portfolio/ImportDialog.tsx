/**
 * ImportDialog — paste or upload a CSV of holdings, preview row mapping, then commit.
 *
 * Recognized broker CSV layouts: Fidelity, Schwab, Robinhood, IBKR, Alpaca,
 * generic exports. Unrecognized columns can still be loaded — invalid rows are
 * flagged and skipped.
 */
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Upload, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { usePortfolioStore, type PortfolioHolding } from '@/stores/portfolioStore';
import { parsePortfolioCsv, type ImportedRow } from './csv';

interface ImportDialogProps {
  onClose: () => void;
}

export function ImportDialog({ onClose }: ImportDialogProps) {
  const importHoldings = usePortfolioStore((s) => s.importHoldings);
  const existing = usePortfolioStore((s) => s.holdings);
  const [text, setText] = useState('');
  const [parseResult, setParseResult] = useState<ReturnType<typeof parsePortfolioCsv> | null>(null);
  const [mode, setMode] = useState<'replace' | 'merge'>('merge');
  const fileRef = useRef<HTMLInputElement>(null);

  const recognized = useMemo(() => {
    if (!parseResult) return [] as string[];
    return Object.entries(parseResult.columnMap)
      .map(([field, idx]) => `${field} ← "${parseResult.headers[idx as number]}"`)
      .sort();
  }, [parseResult]);

  const validRows = useMemo(
    () => parseResult?.rows.filter((r) => r.errors.length === 0) ?? [],
    [parseResult]
  );
  const invalidRows = useMemo(
    () => parseResult?.rows.filter((r) => r.errors.length > 0) ?? [],
    [parseResult]
  );

  const handleParse = (raw: string) => {
    setText(raw);
    if (!raw.trim()) {
      setParseResult(null);
      return;
    }
    try {
      setParseResult(parsePortfolioCsv(raw));
    } catch (e) {
      toast.error(`CSV parse failed: ${(e as Error).message}`);
      setParseResult(null);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => handleParse(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const handleCommit = () => {
    if (validRows.length === 0) {
      toast.error('No valid rows to import.');
      return;
    }
    const newHoldings: PortfolioHolding[] = validRows.map((r: ImportedRow) => {
      const openedAt = r.openedAt ?? Date.now();
      return {
        id: `${r.symbol}-${openedAt}-${Math.random().toString(36).slice(2, 8)}`,
        symbol: r.symbol,
        name: r.name,
        assetType: r.assetType,
        inputMode: 'quantity' as const,
        quantity: r.quantity,
        targetPercentage: 0,
        avgCost: r.avgCost,
        currentPrice: r.avgCost,
        previousClose: r.avgCost,
        lastUpdated: Date.now(),
        currency: r.currency,
        addedAt: openedAt,
        lots: [
          {
            id: `lot-${openedAt}-${Math.random().toString(36).slice(2, 8)}`,
            qty: r.quantity,
            price: r.avgCost,
            fees: r.fees ?? 0,
            openedAt,
            closedQty: 0,
          },
        ],
      };
    });

    if (mode === 'replace') {
      importHoldings(newHoldings);
    } else {
      // Merge: keep existing, append imported (new rows always become new holdings/lots,
      // even when symbol already exists, so historical lots aren't silently merged).
      importHoldings([...existing, ...newHoldings]);
    }
    toast.success(`Imported ${newHoldings.length} holdings (${mode}).`);
    onClose();
  };

  return (
    <DialogContent className="bg-[#1e1e2e] border-border/60 text-foreground max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          Import portfolio from CSV
        </DialogTitle>
        <DialogDescription className="text-muted-foreground text-xs">
          Paste a CSV or upload a file. Recognized columns: symbol/ticker, quantity/shares, price/cost, currency, asset type, date.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/40 hover:bg-muted/60 text-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            Choose CSV file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
            className="hidden"
          />
          <span className="text-[10px] text-muted-foreground">
            or paste below
          </span>
        </div>

        <textarea
          value={text}
          onChange={(e) => handleParse(e.target.value)}
          placeholder="Symbol,Quantity,Avg Cost,Currency&#10;AAPL,50,178.50,USD&#10;BTC,0.5,42000,USD"
          rows={6}
          className="w-full bg-muted/40 border border-border/60 rounded-md p-2 text-xs font-mono"
        />

        {parseResult && (
          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap gap-2">
              <span className="text-muted-foreground">Recognized:</span>
              {recognized.length === 0 ? (
                <span className="text-amber-400">none</span>
              ) : (
                recognized.map((r) => (
                  <span key={r} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">
                    {r}
                  </span>
                ))
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">{validRows.length}</span>
                <span className="text-muted-foreground">valid</span>
              </div>
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400 font-medium">{invalidRows.length}</span>
                <span className="text-muted-foreground">invalid</span>
              </div>
              <div className="rounded-md border border-border/40 bg-muted/20 p-2">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'merge' | 'replace')}
                  className="w-full bg-transparent text-foreground outline-none text-[11px]"
                >
                  <option value="merge">Merge with existing</option>
                  <option value="replace">Replace existing</option>
                </select>
              </div>
            </div>

            {invalidRows.length > 0 && (
              <details className="text-[11px]">
                <summary className="cursor-pointer text-amber-400">
                  Skipped rows ({invalidRows.length})
                </summary>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {invalidRows.slice(0, 10).map((r) => (
                    <li key={r.rowIndex}>
                      Row {r.rowIndex}: {r.symbol || '(no symbol)'} —{' '}
                      <span className="text-amber-400">{r.errors.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {validRows.length > 0 && (
              <details className="text-[11px]">
                <summary className="cursor-pointer text-foreground">
                  Preview ({validRows.length} rows)
                </summary>
                <div className="mt-1 max-h-40 overflow-auto rounded border border-border/40">
                  <table className="w-full text-[10px] font-mono">
                    <thead className="bg-muted/30 sticky top-0">
                      <tr className="text-muted-foreground">
                        <th className="text-left px-2 py-1">Symbol</th>
                        <th className="text-right px-2 py-1">Qty</th>
                        <th className="text-right px-2 py-1">Avg Cost</th>
                        <th className="text-left px-2 py-1">Currency</th>
                        <th className="text-left px-2 py-1">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 100).map((r) => (
                        <tr key={r.rowIndex} className="border-t border-border/20">
                          <td className="px-2 py-0.5 text-foreground">{r.symbol}</td>
                          <td className="px-2 py-0.5 text-right">{r.quantity}</td>
                          <td className="px-2 py-0.5 text-right">{r.avgCost}</td>
                          <td className="px-2 py-0.5">{r.currency}</td>
                          <td className="px-2 py-0.5">{r.assetType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
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
          onClick={handleCommit}
          disabled={validRows.length === 0}
          className="px-4 py-2 rounded-lg text-xs bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Import {validRows.length} {validRows.length === 1 ? 'row' : 'rows'}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

export default ImportDialog;
