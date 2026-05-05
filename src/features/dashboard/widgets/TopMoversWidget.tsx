/**
 * TopMoversWidget — Live US gainers / losers from /api/terminal/movers
 * (yfinance day_gainers / day_losers screeners).
 */
import { useEffect, useState } from 'react';
import { terminalApiGet } from '@/features/terminal/apiClient';

interface MoverRow {
  ticker: string;
  name: string | null;
  lastPrice: number | null;
  changePct: number | null;
}

interface MoversResponse {
  source: string;
  region: string;
  data: { gainers: MoverRow[]; losers: MoverRow[]; active: MoverRow[] };
}

export default function TopMoversWidget() {
  const [gainers, setGainers] = useState<MoverRow[]>([]);
  const [losers, setLosers] = useState<MoverRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'live' | 'offline'>('loading');

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const load = async () => {
      const resp = await terminalApiGet<MoversResponse>('/api/terminal/movers', { region: 'us' }, ctrl.signal);
      if (cancelled) return;
      if (resp?.data) {
        setGainers(resp.data.gainers.slice(0, 5));
        setLosers(resp.data.losers.slice(0, 5));
        setStatus('live');
      } else {
        setStatus('offline');
      }
    };
    void load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

  return (
    <section className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">Top Movers</span>
        <span className="text-[9px] text-zinc-500">{status === 'live' ? 'US LIVE' : status.toUpperCase()}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 p-3">
        <div className="space-y-2">
          <h4 className="border-b border-zinc-800 pb-1 text-[10px] font-semibold tracking-wide text-zinc-500">
            GAINERS
          </h4>
          {gainers.length === 0 && (
            <p className="text-[10px] text-zinc-600">{status === 'loading' ? 'Loading…' : 'No data'}</p>
          )}
          {gainers.map((m) => (
            <div key={m.ticker} className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-zinc-100">{m.ticker}</span>
              <span className="font-mono text-emerald-400">
                {m.changePct != null ? `+${m.changePct.toFixed(2)}%` : '—'}
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <h4 className="border-b border-zinc-800 pb-1 text-[10px] font-semibold tracking-wide text-zinc-500">
            LOSERS
          </h4>
          {losers.length === 0 && (
            <p className="text-[10px] text-zinc-600">{status === 'loading' ? 'Loading…' : 'No data'}</p>
          )}
          {losers.map((m) => (
            <div key={m.ticker} className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-zinc-100">{m.ticker}</span>
              <span className="font-mono text-red-400">
                {m.changePct != null ? `${m.changePct.toFixed(2)}%` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
