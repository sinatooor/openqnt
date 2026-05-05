/**
 * WatchlistWidget — Live quotes for symbols the user actually cares about.
 *
 * Source priority:
 *   1. Avanza watchlists (when connected) — symbols come from the user's
 *      first synced watchlist, prices via Avanza market-data.
 *   2. Local portfolioStore — every holding shows up.
 *   3. Sensible default basket (SPY, QQQ, AAPL, MSFT, NVDA, BTC-USD).
 *
 * Quote resolution always goes through /api/terminal/quotes (yfinance
 * batch download) so the widget stays light.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { terminalApiGet } from '@/features/terminal/apiClient';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { avanzaApi } from '@/integrations/avanza/api';
import { useIntegrationsStore } from '@/stores/integrationsStore';

interface QuoteRow {
  symbol: string;
  lastPrice: number | null;
  prevClose?: number | null;
  changePct: number | null;
}

interface QuotesResponse {
  source: string;
  quotes: QuoteRow[];
}

const DEFAULT_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'BTC-USD'];

export default function WatchlistWidget() {
  const holdings = usePortfolioStore((s) => s.holdings);
  const avanzaConnected = useIntegrationsStore((s) => s.integrations.avanza.status) === 'connected';
  const [symbols, setSymbols] = useState<string[]>([]);
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'live' | 'offline'>('loading');

  // Resolve which symbols to show.
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    const resolve = async () => {
      // Try Avanza first when connected
      if (avanzaConnected) {
        try {
          const wls = await avanzaApi.watchlists(ctrl.signal);
          if (cancelled) return;
          if (wls.watchlists.length > 0 && wls.watchlists[0].orderbookIds.length > 0) {
            // Avanza returns orderbookIds, not tickers — surface them as-is
            setSymbols(wls.watchlists[0].orderbookIds.slice(0, 8));
            return;
          }
        } catch {
          /* fall through */
        }
      }

      // Fall back to portfolio holdings
      if (holdings.length > 0) {
        setSymbols(holdings.slice(0, 8).map((h) => h.symbol));
        return;
      }

      setSymbols(DEFAULT_SYMBOLS);
    };

    void resolve();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [avanzaConnected, holdings]);

  // Resolve quotes for the selected symbols.
  useEffect(() => {
    if (symbols.length === 0) {
      setRows([]);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();

    const load = async () => {
      const resp = await terminalApiGet<QuotesResponse>(
        '/api/terminal/quotes',
        { symbols: symbols.join(',') },
        ctrl.signal,
      );
      if (cancelled) return;
      if (resp?.quotes) {
        setRows(resp.quotes);
        setStatus('live');
      } else {
        setRows(symbols.map((s) => ({ symbol: s, lastPrice: null, changePct: null })));
        setStatus('offline');
      }
    };

    void load();
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
  }, [symbols]);

  const headerLabel = useMemo(() => {
    if (status === 'loading') return 'LOADING';
    if (status === 'offline') return 'OFFLINE';
    return `${rows.length} SYMBOLS`;
  }, [status, rows.length]);

  return (
    <section className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">Watchlist</span>
        <span className="text-[9px] text-zinc-500">{headerLabel}</span>
      </div>
      <div className="p-1">
        <table className="terminal-table">
          <thead>
            <tr>
              <th className="text-left">Symbol</th>
              <th className="text-right">Price</th>
              <th className="text-right">Chg%</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-2 py-3 text-center text-[11px] text-zinc-500">
                  {status === 'loading' ? 'Loading…' : 'No symbols configured'}
                </td>
              </tr>
            )}
            {rows.map((item) => {
              const change = item.changePct ?? 0;
              const up = change >= 0;
              return (
                <tr key={item.symbol}>
                  <td className="font-semibold text-zinc-100">{item.symbol}</td>
                  <td className="text-right font-mono text-zinc-100">
                    {item.lastPrice == null
                      ? '—'
                      : item.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`text-right font-mono ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                    <span className="inline-flex items-center gap-1">
                      {item.changePct == null ? null : up ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {item.changePct == null ? '—' : `${Math.abs(change).toFixed(2)}%`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
