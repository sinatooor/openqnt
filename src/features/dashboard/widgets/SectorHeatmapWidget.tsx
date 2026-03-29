const SECTORS = [
  { label: 'Technology', change: 1.42 },
  { label: 'Healthcare', change: -0.87 },
  { label: 'Financials', change: 0.15 },
  { label: 'Energy', change: -0.64 },
  { label: 'Consumer Disc.', change: -1.12 },
  { label: 'Industrials', change: 0.41 },
  { label: 'Materials', change: -0.35 },
  { label: 'Utilities', change: 0.22 },
  { label: 'Real Estate', change: -0.55 },
  { label: 'Comm. Svc.', change: -0.09 },
  { label: 'Consumer Stap.', change: 0.03 },
  { label: 'Semis', change: 0.88 },
];

function heatClass(change: number) {
  if (change >= 1) return 'bg-emerald-700/60 border-emerald-500/50';
  if (change > 0) return 'bg-emerald-800/40 border-emerald-700/50';
  if (change <= -1) return 'bg-red-700/60 border-red-500/50';
  return 'bg-red-800/35 border-red-700/50';
}

export default function SectorHeatmapWidget() {
  return (
    <section className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">Sector Heatmap</span>
        <span className="text-[9px] text-zinc-500">US</span>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1.5 sm:grid-cols-3">
        {SECTORS.map((s) => (
          <div
            key={s.label}
            className={`rounded-sm border p-2 text-center ${heatClass(s.change)}`}
          >
            <div className="truncate text-[10px] text-zinc-100">{s.label}</div>
            <div className={`mt-1 font-mono text-[11px] font-semibold ${s.change >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {s.change >= 0 ? '+' : ''}
              {s.change.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
