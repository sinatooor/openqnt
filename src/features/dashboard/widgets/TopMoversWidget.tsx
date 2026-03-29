const MOVERS = [
  { symbol: 'SMCI', name: 'Super Micro Computer', change: 12.4, isGainer: true },
  { symbol: 'ARM', name: 'Advanced Micro Devices', change: 8.2, isGainer: true },
  { symbol: 'SNOW', name: 'Snowflake', change: -6.5, isGainer: false },
  { symbol: 'MDB', name: 'MongoDB', change: -4.2, isGainer: false },
];

export default function TopMoversWidget() {
  return (
    <section className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">Top Movers</span>
        <span className="text-[9px] text-zinc-500">US</span>
      </div>
      <div className="grid grid-cols-2 gap-3 p-3">
        <div className="space-y-2">
          <h4 className="border-b border-zinc-800 pb-1 text-[10px] font-semibold tracking-wide text-zinc-500">
            GAINERS
          </h4>
          {MOVERS
            .filter((m) => m.isGainer)
            .map((m) => (
              <div key={m.symbol} className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-100">{m.symbol}</span>
                <span className="font-mono text-emerald-400">+{m.change}%</span>
              </div>
            ))}
        </div>
        <div className="space-y-2">
          <h4 className="border-b border-zinc-800 pb-1 text-[10px] font-semibold tracking-wide text-zinc-500">
            LOSERS
          </h4>
          {MOVERS
            .filter((m) => !m.isGainer)
            .map((m) => (
              <div key={m.symbol} className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-100">{m.symbol}</span>
                <span className="font-mono text-red-400">{m.change}%</span>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
