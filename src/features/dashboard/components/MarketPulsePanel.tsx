/**
 * MarketPulsePanel — terminal-style sidebar that shows live market state.
 *
 * Backend: /api/terminal/movers (gainers/losers) + /api/terminal/quotes
 * (VIX, 10Y, DXY, GOLD, OIL, BTC). Refreshes every 60 s.
 * Market hours computed from system time + IANA tz, no external API needed.
 */

import { useEffect, useState } from 'react';
import { terminalApiGet } from '@/features/terminal/apiClient';

type Mover = {
  ticker: string;
  name?: string;
  lastPrice?: number | null;
  changePct?: number | null;
};
type MoversResponse = {
  source: string;
  region: string;
  data: { gainers?: Mover[]; losers?: Mover[]; active?: Mover[] };
};

type Quote = {
  symbol: string;
  lastPrice: number | null;
  changePct: number | null;
};
type QuotesResponse = { source: string; quotes: Quote[] };

type FearGreedComponent = {
  id: string;
  label: string;
  description: string;
  score: number;
  raw?: Record<string, unknown>;
};
type FearGreedResponse = {
  source: string;
  score: number;
  label: 'Extreme Fear' | 'Fear' | 'Greed' | 'Extreme Greed';
  components: FearGreedComponent[];
  components_computed: number;
  components_total: number;
  missing: string[];
};

const SNAPSHOT_TICKERS = [
  { label: 'VIX',     symbol: '^VIX',     fmt: (v: number) => v.toFixed(2) },
  { label: 'US 10Y',  symbol: '^TNX',     fmt: (v: number) => `${v.toFixed(2)}%` },
  { label: 'DXY',     symbol: 'DX-Y.NYB', fmt: (v: number) => v.toFixed(2) },
  { label: 'GOLD',    symbol: 'GC=F',     fmt: (v: number) => `$${v.toFixed(0)}` },
  { label: 'OIL WTI', symbol: 'CL=F',     fmt: (v: number) => `$${v.toFixed(2)}` },
  { label: 'BTC',     symbol: 'BTC-USD',  fmt: (v: number) => `$${(v / 1000).toFixed(1)}K` },
] as const;

const EXCHANGE_HOURS: Array<{
  name: string;
  region: string;
  tz: string;
  open: number;   // local-time hours (e.g. 9.5 = 09:30)
  close: number;
}> = [
  { name: 'NYSE/NASDAQ',   region: 'US', tz: 'America/New_York', open: 9.5,  close: 16 },
  { name: 'LSE',           region: 'UK', tz: 'Europe/London',    open: 8,    close: 16.5 },
  { name: 'TSE (TOKYO)',   region: 'JP', tz: 'Asia/Tokyo',       open: 9,    close: 15 },
  { name: 'SSE (SHANGHAI)',region: 'CN', tz: 'Asia/Shanghai',    open: 9.5,  close: 15 },
  { name: 'NSE (INDIA)',   region: 'IN', tz: 'Asia/Kolkata',     open: 9.25, close: 15.5 },
];

function exchangeStatus(tz: string, open: number, close: number): 'OPEN' | 'PRE' | 'CLOSED' {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric', minute: 'numeric',
    hour12: false, weekday: 'short',
  });
  const parts = fmt.formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const day = parts.find((p) => p.type === 'weekday')?.value ?? '';
  if (day === 'Sat' || day === 'Sun') return 'CLOSED';
  const t = hour + minute / 60;
  if (t >= open && t < close) return 'OPEN';
  if (t >= open - 0.5 && t < open) return 'PRE';
  return 'CLOSED';
}

function statusColor(status: 'OPEN' | 'PRE' | 'CLOSED') {
  if (status === 'OPEN') return 'text-emerald-400';
  if (status === 'PRE') return 'text-amber-400';
  return 'text-red-400';
}

export default function MarketPulsePanel() {
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);
  const [snapshot, setSnapshot] = useState<Map<string, Quote>>(new Map());
  const [fg, setFg] = useState<FearGreedResponse | null>(null);
  const [fgExpanded, setFgExpanded] = useState(false);
  const [status, setStatus] = useState<'loading' | 'live' | 'offline'>('loading');

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const [movers, quotes, fearGreed] = await Promise.all([
          terminalApiGet<MoversResponse>(
            '/api/terminal/movers',
            { region: 'us', limit: 5 },
            ctrl.signal,
          ),
          terminalApiGet<QuotesResponse>(
            '/api/terminal/quotes',
            { symbols: SNAPSHOT_TICKERS.map((t) => t.symbol).join(',') },
            ctrl.signal,
          ),
          terminalApiGet<FearGreedResponse>('/api/terminal/fear-greed', undefined, ctrl.signal),
        ]);
        if (cancelled) return;
        setGainers(movers?.data?.gainers ?? []);
        setLosers(movers?.data?.losers ?? []);
        const map = new Map<string, Quote>();
        for (const q of quotes?.quotes ?? []) map.set(q.symbol, q);
        setSnapshot(map);
        if (fearGreed) setFg(fearGreed);
        setStatus(movers?.data || quotes?.quotes || fearGreed ? 'live' : 'offline');
      } catch {
        if (!cancelled) setStatus('offline');
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

  // Bands match CNN: 0-24 Extreme Fear, 25-49 Fear, 50-74 Greed, 75-100 Extreme Greed.
  const fearGreed = fg?.score != null ? Math.round(fg.score) : null;
  const fearGreedLabel = (fg?.label ?? '').toUpperCase();
  const fearGreedColor =
    fearGreed == null ? 'text-zinc-500' :
    fearGreed >= 75 ? 'text-emerald-400' :
    fearGreed >= 50 ? 'text-emerald-300' :
    fearGreed >= 25 ? 'text-amber-400' : 'text-red-400';

  return (
    <aside className="terminal-panel h-full min-h-[720px] overflow-hidden">
      <div className="terminal-panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-amber-400">◈</span>
          <span className="terminal-title">Market Pulse</span>
        </div>
        <span
          className={`h-2 w-2 rounded-full ${
            status === 'live' ? 'bg-emerald-400' :
            status === 'loading' ? 'bg-amber-400' : 'bg-red-400'
          }`}
          title={status === 'live' ? 'Live data' : status === 'loading' ? 'Loading…' : 'Offline'}
        />
      </div>

      <div className="h-[calc(100%-28px)] overflow-y-auto terminal-scroll">
        <section className="terminal-section px-3 py-2">
          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <span>FEAR & GREED INDEX</span>
            <button
              type="button"
              onClick={() => setFgExpanded((v) => !v)}
              className="text-amber-400 hover:text-amber-300 transition-colors text-[9px]"
              title={fgExpanded ? 'Hide components' : 'Show component breakdown'}
            >
              {fgExpanded ? 'HIDE' : 'BREAKDOWN'}
            </button>
          </div>
          {/* Gradient bar with indicator marker */}
          <div className="relative mt-2 h-1.5 rounded-full bg-gradient-to-r from-red-600 via-yellow-400 to-emerald-500">
            {fearGreed != null && (
              <div
                className="absolute -top-0.5 w-1 h-2.5 bg-white rounded-full shadow-md"
                style={{ left: `calc(${fearGreed}% - 2px)` }}
              />
            )}
          </div>
          <div className="mt-2 flex items-end justify-between">
            <div className="flex items-end gap-1">
              <span className={`text-2xl font-bold ${fearGreedColor}`}>
                {fearGreed ?? '—'}
              </span>
              <span className="pb-1 text-[10px] text-zinc-500">/100</span>
            </div>
            <span className={`text-[10px] font-semibold tracking-wide ${fearGreedColor}`}>
              {fearGreedLabel || (status === 'loading' ? '…' : 'NO DATA')}
            </span>
          </div>
          <div className="mt-1 text-[9px] text-zinc-500">
            CNN-style — equal-weighted average of {fg?.components_computed ?? 0}/{fg?.components_total ?? 7} components.
          </div>

          {fgExpanded && fg?.components && (
            <div className="mt-2 space-y-1.5 border-t border-white/[0.05] pt-2">
              {fg.components.map((c) => {
                const cls =
                  c.score >= 75 ? 'bg-emerald-500' :
                  c.score >= 50 ? 'bg-emerald-400/70' :
                  c.score >= 25 ? 'bg-amber-400' : 'bg-red-500';
                return (
                  <div key={c.id} title={c.description}>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-300 truncate">{c.label}</span>
                      <span className="font-mono text-zinc-200">{c.score.toFixed(0)}</span>
                    </div>
                    <div className="mt-0.5 h-1 rounded-full bg-zinc-800/80 overflow-hidden">
                      <div className={`h-full ${cls}`} style={{ width: `${c.score}%` }} />
                    </div>
                  </div>
                );
              })}
              {fg.missing?.length > 0 && (
                <div className="text-[9px] text-zinc-500 pt-1">
                  Not computed: {fg.missing.join(', ')} (no free data feed).
                </div>
              )}
            </div>
          )}
        </section>

        <section className="terminal-section">
          <div className="terminal-subheader px-3">TOP GAINERS</div>
          {gainers.length === 0 && status !== 'loading' && (
            <div className="px-3 py-1 text-[10px] text-zinc-500">No data</div>
          )}
          {gainers.slice(0, 5).map((m) => (
            <div key={m.ticker} className="terminal-row px-3 text-[11px]">
              <span className="font-semibold text-zinc-200">{m.ticker}</span>
              <span className="font-mono text-emerald-400">
                {m.changePct != null ? `+${m.changePct.toFixed(2)}%` : '—'}
              </span>
            </div>
          ))}
        </section>

        <section className="terminal-section">
          <div className="terminal-subheader px-3">TOP LOSERS</div>
          {losers.length === 0 && status !== 'loading' && (
            <div className="px-3 py-1 text-[10px] text-zinc-500">No data</div>
          )}
          {losers.slice(0, 5).map((m) => (
            <div key={m.ticker} className="terminal-row px-3 text-[11px]">
              <span className="font-semibold text-zinc-200">{m.ticker}</span>
              <span className="font-mono text-red-400">
                {m.changePct != null ? `${m.changePct.toFixed(2)}%` : '—'}
              </span>
            </div>
          ))}
        </section>

        <section className="terminal-section">
          <div className="terminal-subheader px-3">GLOBAL SNAPSHOT</div>
          {SNAPSHOT_TICKERS.map((s) => {
            const q = snapshot.get(s.symbol);
            const value = q?.lastPrice != null ? s.fmt(q.lastPrice) : '—';
            const pct = q?.changePct;
            const cls =
              pct == null ? 'text-zinc-500' :
              pct < 0 ? 'text-red-400' : 'text-emerald-400';
            const pctStr =
              pct == null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
            return (
              <div key={s.label} className="terminal-row px-3 text-[10px]">
                <span className="text-zinc-400">{s.label}</span>
                <div className="font-mono">
                  <span className="mr-2 text-zinc-200">{value}</span>
                  <span className={cls}>{pctStr}</span>
                </div>
              </div>
            );
          })}
        </section>

        <section className="terminal-section">
          <div className="terminal-subheader px-3">MARKET HOURS</div>
          {EXCHANGE_HOURS.map((exchange) => {
            const s = exchangeStatus(exchange.tz, exchange.open, exchange.close);
            return (
              <div key={exchange.name} className="terminal-row px-3 text-[10px]">
                <span className="text-zinc-300">{exchange.name}</span>
                <span className={`font-semibold ${statusColor(s)}`}>{s}</span>
              </div>
            );
          })}
        </section>
      </div>
    </aside>
  );
}
