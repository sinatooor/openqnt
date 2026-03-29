const INDICES = [
  { symbol: 'SPX', price: 5118.37, change: 44.32 },
  { symbol: 'NDX', price: 18085.11, change: 180.54 },
  { symbol: 'INDU', price: 38996.39, change: 132.87 },
  { symbol: 'RTY', price: 2089.47, change: -4.81 },
  { symbol: 'UKX', price: 7930.92, change: 35.69 },
  { symbol: 'NKY', price: 39098.68, change: 479.41 },
  { symbol: 'HSI', price: 16589.55, change: -147.82 },
  { symbol: 'DAX', price: 17940.2, change: 120.13 },
];

export default function IndicesWidget() {
  return (
    <section className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">World Indices</span>
        <span className="text-[9px] text-zinc-500">PG1</span>
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
            {INDICES.map((idx) => {
              const pct = (idx.change / idx.price) * 100;
              const up = idx.change >= 0;
              return (
                <tr key={idx.symbol}>
                  <td className="font-semibold text-amber-300">{idx.symbol}</td>
                  <td className="text-right font-mono text-zinc-100">{idx.price.toFixed(2)}</td>
                  <td className={`text-right font-mono ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                    {up ? '+' : ''}
                    {idx.change.toFixed(2)}
                  </td>
                  <td className={`text-right font-mono ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                    {up ? '+' : ''}
                    {pct.toFixed(2)}%
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
