/**
 * IndicesWidget — World equity indices (live).
 * Pulls /api/terminal/wei (yfinance-backed) and refreshes every 60s.
 */
import { useEffect, useState } from 'react';
import { terminalApiGet } from '@/features/terminal/apiClient';

interface IndexSnap {
  iso3: string;
  yfSymbol: string;
  price: number;
  prevClose: number;
  changeAbs: number;
  changePct: number;
  ytdPct: number | null;
}

interface WeiResponse {
  source: string;
  asOf: string;
  snapshots: IndexSnap[];
}

const TICKER_LABEL: Record<string, string> = {
  USA: 'SPX', US: 'SPX', JPN: 'NKY', GBR: 'UKX', DEU: 'DAX', FRA: 'CAC',
  HKG: 'HSI', CHN: 'SHCOMP', IND: 'NIFTY', SWE: 'OMX', NOR: 'OBX',
  CAN: 'TSX', AUS: 'ASX', BRA: 'BOVESPA', MEX: 'IPC', KOR: 'KOSPI',
  CHE: 'SMI', ESP: 'IBEX', ITA: 'FTSEMIB', NLD: 'AEX',
};

export default function IndicesWidget() {
  const [data, setData] = useState<IndexSnap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const load = async () => {
      const resp = await terminalApiGet<WeiResponse>('/api/terminal/wei', undefined, ctrl.signal);
      if (cancelled) return;
      if (resp?.snapshots) {
        setData(resp.snapshots.slice(0, 10));
        setError(null);
      } else {
        setError('Live feed unavailable');
      }
      setLoading(false);
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
        <span className="terminal-title">World Indices</span>
        <span className="text-[9px] text-zinc-500">
          {loading ? 'LOADING' : error ? 'OFFLINE' : 'LIVE'}
        </span>
      </div>

      <div className="p-1">
        <table className="terminal-table">
          <thead>
            <tr>
              <th className="text-left">Ticker</th>
              <th className="text-right">Last</th>
              <th className="text-right">Net</th>
              <th className="text-right">Pct</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-2 py-3 text-center text-[11px] text-zinc-500">
                  No index data
                </td>
              </tr>
            )}
            {data.map((idx) => {
              const up = idx.changeAbs >= 0;
              return (
                <tr key={idx.iso3}>
                  <td className="font-semibold text-amber-300">
                    {TICKER_LABEL[idx.iso3] ?? idx.iso3}
                  </td>
                  <td className="text-right font-mono text-zinc-100">
                    {idx.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className={`text-right font-mono ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                    {up ? '+' : ''}
                    {idx.changeAbs.toFixed(2)}
                  </td>
                  <td className={`text-right font-mono ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                    {up ? '+' : ''}
                    {idx.changePct.toFixed(2)}%
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
