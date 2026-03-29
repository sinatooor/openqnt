import { Progress } from '@/components/ui/progress';

type Mover = { symbol: string; change: number; volume: string };
type Snapshot = { label: string; value: string; change: string };

const GAINERS: Mover[] = [
  { symbol: 'SMCI', change: 4.56, volume: '2.1M' },
  { symbol: 'PLTR', change: 3.89, volume: '45.3M' },
  { symbol: 'NVDA', change: 2.34, volume: '38.7M' },
];

const LOSERS: Mover[] = [
  { symbol: 'RIVN', change: -5.67, volume: '12.4M' },
  { symbol: 'COIN', change: -3.45, volume: '8.9M' },
  { symbol: 'MARA', change: -4.12, volume: '6.2M' },
];

const SNAPSHOT: Snapshot[] = [
  { label: 'VIX', value: '18.42', change: '+1.23%' },
  { label: 'US 10Y', value: '4.28%', change: '-0.15%' },
  { label: 'DXY', value: '104.32', change: '+0.08%' },
  { label: 'GOLD', value: '$2,345', change: '+0.45%' },
  { label: 'OIL WTI', value: '$78.34', change: '-0.67%' },
  { label: 'BTC', value: '$67.2K', change: '+2.12%' },
];

const EXCHANGES = [
  { name: 'NYSE/NASDAQ', region: 'US', status: 'OPEN' },
  { name: 'LSE', region: 'UK', status: 'OPEN' },
  { name: 'TSE (TOKYO)', region: 'JP', status: 'CLOSED' },
  { name: 'SSE (SHANGHAI)', region: 'CN', status: 'CLOSED' },
  { name: 'NSE (INDIA)', region: 'IN', status: 'PRE' },
] as const;

function statusColor(status: 'OPEN' | 'PRE' | 'CLOSED') {
  if (status === 'OPEN') return 'text-emerald-400';
  if (status === 'PRE') return 'text-amber-400';
  return 'text-red-400';
}

export default function MarketPulsePanel() {
  const fearGreed = 62;
  return (
    <aside className="terminal-panel h-full min-h-[720px] overflow-hidden">
      <div className="terminal-panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-amber-400">◈</span>
          <span className="terminal-title">Market Pulse</span>
        </div>
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
      </div>

      <div className="h-[calc(100%-28px)] overflow-y-auto terminal-scroll">
        <section className="terminal-section px-3 py-2">
          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <span>FEAR & GREED INDEX</span>
            <span className="text-amber-400">◎</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-gradient-to-r from-red-600 via-yellow-400 to-emerald-500" />
          <div className="mt-2 flex items-end justify-between">
            <div className="flex items-end gap-1">
              <span className="text-2xl font-bold text-emerald-400">{fearGreed}</span>
              <span className="pb-1 text-[10px] text-zinc-500">/100</span>
            </div>
            <span className="text-[10px] font-semibold tracking-wide text-emerald-400">GREED</span>
          </div>
        </section>

        <section className="terminal-section">
          <div className="terminal-subheader px-3">MARKET BREADTH</div>
          <div className="space-y-2 px-3 py-2">
            {[
              { label: 'NYSE', advancing: 1847, declining: 1253 },
              { label: 'NASDAQ', advancing: 2156, declining: 1644 },
              { label: 'S&P 500', advancing: 312, declining: 188 },
            ].map((b) => {
              const total = b.advancing + b.declining;
              const pct = Math.round((b.advancing / total) * 100);
              return (
                <div key={b.label}>
                  <div className="mb-1 flex items-center justify-between text-[10px]">
                    <span className="text-zinc-300">{b.label}</span>
                    <span className="font-mono">
                      <span className="text-emerald-400">{b.advancing}</span>
                      <span className="text-zinc-500"> / </span>
                      <span className="text-red-400">{b.declining}</span>
                    </span>
                  </div>
                  <Progress value={pct} className="h-1 rounded-none" />
                </div>
              );
            })}
          </div>
        </section>

        <section className="terminal-section">
          <div className="terminal-subheader px-3">TOP GAINERS</div>
          {GAINERS.map((m) => (
            <div key={m.symbol} className="terminal-row px-3 text-[11px]">
              <span className="font-semibold text-zinc-200">{m.symbol}</span>
              <span className="font-mono text-emerald-400">+{m.change.toFixed(2)}%</span>
            </div>
          ))}
        </section>

        <section className="terminal-section">
          <div className="terminal-subheader px-3">TOP LOSERS</div>
          {LOSERS.map((m) => (
            <div key={m.symbol} className="terminal-row px-3 text-[11px]">
              <span className="font-semibold text-zinc-200">{m.symbol}</span>
              <span className="font-mono text-red-400">{m.change.toFixed(2)}%</span>
            </div>
          ))}
        </section>

        <section className="terminal-section">
          <div className="terminal-subheader px-3">GLOBAL SNAPSHOT</div>
          {SNAPSHOT.map((s) => (
            <div key={s.label} className="terminal-row px-3 text-[10px]">
              <span className="text-zinc-400">{s.label}</span>
              <div className="font-mono">
                <span className="mr-2 text-zinc-200">{s.value}</span>
                <span className={s.change.startsWith('-') ? 'text-red-400' : 'text-emerald-400'}>
                  {s.change}
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="terminal-section">
          <div className="terminal-subheader px-3">MARKET HOURS</div>
          {EXCHANGES.map((exchange) => (
            <div key={exchange.name} className="terminal-row px-3 text-[10px]">
              <span className="text-zinc-300">{exchange.name}</span>
              <span className={`font-semibold ${statusColor(exchange.status)}`}>{exchange.status}</span>
            </div>
          ))}
        </section>
      </div>
    </aside>
  );
}
