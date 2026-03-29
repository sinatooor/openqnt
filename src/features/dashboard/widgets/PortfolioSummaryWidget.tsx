export default function PortfolioSummaryWidget() {
  return (
    <section className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">Portfolio Summary</span>
        <span className="text-[9px] text-emerald-400">LIVE</span>
      </div>

      <div className="grid grid-cols-2 gap-3 p-3 text-xs">
        <div>
          <p className="text-zinc-500">TOTAL EQUITY</p>
          <p className="mt-1 font-mono text-2xl font-bold text-zinc-100">$124,560.85</p>
          <p className="mt-1 font-mono text-[11px] text-emerald-400">+1.24% TODAY</p>
        </div>
        <div className="space-y-1.5 text-right">
          <div>
            <span className="text-zinc-500">Daily PnL: </span>
            <span className="font-mono text-emerald-400">+$1,524.30</span>
          </div>
          <div>
            <span className="text-zinc-500">Open Positions: </span>
            <span className="font-mono text-zinc-200">12</span>
          </div>
          <div>
            <span className="text-zinc-500">Buying Power: </span>
            <span className="font-mono text-zinc-200">$45,000.00</span>
          </div>
          <div>
            <span className="text-zinc-500">Drawdown: </span>
            <span className="font-mono text-red-400">-2.14%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
