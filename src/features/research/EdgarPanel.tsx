/**
 * EdgarPanel — symbol lookup → recent filings + insider transactions.
 *
 * Uses /api/edgar/* (proxied on backend so we don't hit SEC CORS).
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, FileText, ExternalLink } from 'lucide-react';
import {
  lookupCik,
  recentFilings,
  insiderTransactions,
  type EdgarFiling,
  type InsiderTransaction,
  type EdgarTickerInfo,
} from './edgar';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const FORM_GROUPS = [
  ['10-K', '10-Q', '8-K'],
  ['DEF 14A', 'S-1', 'S-3'],
  ['13F-HR', 'SC 13G', 'SC 13D'],
  ['4', '3', '5'],
];

export function EdgarPanel({ initialSymbol = 'AAPL' }: { initialSymbol?: string }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [info, setInfo] = useState<EdgarTickerInfo | null>(null);
  const [filings, setFilings] = useState<EdgarFiling[]>([]);
  const [insiders, setInsiders] = useState<InsiderTransaction[]>([]);
  const [filterForms, setFilterForms] = useState<string[]>(['10-K', '10-Q', '8-K']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async (sym: string) => {
    setLoading(true);
    setError(null);
    setInfo(null);
    setFilings([]);
    setInsiders([]);
    try {
      const lookup = await lookupCik(sym);
      if (!lookup) {
        setError('Symbol not found in EDGAR. Make sure it is a US-listed reporting issuer.');
        setLoading(false);
        return;
      }
      setInfo(lookup);
      const [fs, ins] = await Promise.all([
        recentFilings(lookup.cik, filterForms),
        insiderTransactions(lookup.cik, 90).catch(() => []),
      ]);
      setFilings(fs);
      setInsiders(ins);
    } catch (e) {
      setError(`EDGAR backend not reachable — wire /api/edgar/* router.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialSymbol) handleLookup(initialSymbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insiderSummary = useMemo(() => {
    if (insiders.length === 0) return null;
    let buys = 0;
    let sells = 0;
    let buyShares = 0;
    let sellShares = 0;
    for (const t of insiders) {
      if (t.transactionType === 'P') {
        buys++;
        buyShares += t.shares;
      } else if (t.transactionType === 'S') {
        sells++;
        sellShares += t.shares;
      }
    }
    return { buys, sells, buyShares, sellShares };
  }, [insiders]);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
          <FileText className="w-4 h-4 text-amber-400" />
          SEC EDGAR
          {info && <Badge variant="outline" className="text-[10px]">CIK {info.cik}</Badge>}
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <Input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLookup(symbol);
            }}
            placeholder="AAPL"
            className="h-7 w-24 bg-muted/40 border-border/60 text-[11px]"
          />
          <button
            onClick={() => handleLookup(symbol)}
            disabled={loading}
            className="h-7 px-2 rounded-md bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-40 text-[11px] flex items-center gap-1"
          >
            <Search className="w-3 h-3" />
            {loading ? 'Loading…' : 'Lookup'}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {error && <p className="text-amber-400 italic">{error}</p>}

        {info && (
          <>
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">{info.title}</span>
              {info.exchange && <span className="ml-2 text-[10px]">· {info.exchange}</span>}
            </div>

            <div className="flex flex-wrap gap-1">
              {FORM_GROUPS.flat().map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    const next = filterForms.includes(f)
                      ? filterForms.filter((x) => x !== f)
                      : [...filterForms, f];
                    setFilterForms(next);
                    if (info) {
                      void recentFilings(info.cik, next).then(setFilings).catch(() => {});
                    }
                  }}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    filterForms.includes(f)
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-muted/40 text-muted-foreground border border-border/40'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {insiderSummary && (
              <div className="grid grid-cols-4 gap-2 rounded-md border border-border/40 bg-muted/20 p-2 text-[11px]">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Insider buys (90d)</div>
                  <div className="font-mono text-emerald-400">{insiderSummary.buys}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Buy shares</div>
                  <div className="font-mono text-foreground">{insiderSummary.buyShares.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Insider sells</div>
                  <div className="font-mono text-red-400">{insiderSummary.sells}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Sell shares</div>
                  <div className="font-mono text-foreground">{insiderSummary.sellShares.toLocaleString()}</div>
                </div>
              </div>
            )}

            <div className="space-y-1 max-h-72 overflow-y-auto">
              {filings.length === 0 ? (
                <p className="text-muted-foreground italic">No filings match selected forms.</p>
              ) : (
                filings.map((f) => (
                  <a
                    key={f.accessionNumber}
                    href={f.url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/30"
                  >
                    <Badge variant="outline" className="text-[10px] w-16 justify-center">{f.formType}</Badge>
                    <span className="text-foreground flex-1 truncate">
                      {f.primaryDocumentDescription ?? f.primaryDocument ?? f.accessionNumber}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{fmtDate(f.filedAt)}</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </a>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default EdgarPanel;
